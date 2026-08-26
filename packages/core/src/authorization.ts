import type {
  AccessContext,
  AuthorizationDecision,
  Capability,
  CapabilityGrant,
  JsonObject,
  ResourceRef,
} from "@aicoo/sharedos-contracts";

import type { ResolvedAuthority } from "./authority.js";
import {
  type DelegationChainResolver,
  type DelegationValidation,
  validateDelegationChain,
} from "./delegation.js";
import {
  addressesEqual,
  grantIsActive,
  parseTimestamp,
  pathIsWithin,
  pathsEqual,
} from "./internal.js";

export { addressesEqual };

export interface AuthorizationRequest {
  readonly resource: ResourceRef;
  readonly action: string;
}

export type AuthorizationReasonCode =
  | "allowed"
  | "invalid_context"
  | "invalid_request"
  | "no_matching_grant"
  | "grant_exhausted"
  | "delegation_chain_invalid"
  | "authority_unavailable"
  | "delegation_chain_unverified"
  | "usage_store_unavailable";

/**
 * Denials caused by SharedOS being unable to establish a fact, not by policy.
 *
 * Fail-closed behaviour makes these look like denials at the call site. An
 * experiment must separate them from expected permission denials before
 * computing any rate, so they are named once here and marked `failClosed` in
 * the audit record.
 */
export const INFRASTRUCTURE_DENIAL_REASONS: readonly AuthorizationReasonCode[] = [
  "authority_unavailable",
  "delegation_chain_unverified",
  "usage_store_unavailable",
];

export function isInfrastructureDenial(reasonCode: string): boolean {
  return (INFRASTRUCTURE_DENIAL_REASONS as readonly string[]).includes(reasonCode);
}

export interface GrantUsageStore {
  getUsage(namespaceId: string, grantId: string): Promise<number>;
  tryConsume(namespaceId: string, grantId: string, maximumUses: number): Promise<boolean>;
}

export interface CapabilityGrantVerifier {
  verify(grant: CapabilityGrant, context: AccessContext): Promise<boolean>;
}

export interface AuthorizeOptions {
  /**
   * Consumption is reserved for execution. Discovery calls must leave this
   * false so merely viewing a catalog cannot spend a bounded grant.
   */
  readonly consume?: boolean;
}

export interface CapabilityAuthorizerOptions {
  readonly usageStore?: GrantUsageStore;
  readonly grantVerifier?: CapabilityGrantVerifier;
  /**
   * Trusted ancestor lookup for delegated grants. Without it, a grant that
   * claims a parent can never authorize anything.
   */
  readonly delegationResolver?: DelegationChainResolver;
  readonly maxDelegationChainLength?: number;
}

/**
 * An atomic, process-local usage store suitable for tests and single-process
 * hosts. Distributed hosts should inject a durable compare-and-set store.
 */
export class InMemoryGrantUsageStore implements GrantUsageStore {
  readonly #usageByNamespace = new Map<string, Map<string, number>>();

  async getUsage(namespaceId: string, grantId: string): Promise<number> {
    return this.#usageByNamespace.get(namespaceId)?.get(grantId) ?? 0;
  }

  async tryConsume(namespaceId: string, grantId: string, maximumUses: number): Promise<boolean> {
    let namespaceUsage = this.#usageByNamespace.get(namespaceId);
    if (namespaceUsage === undefined) {
      namespaceUsage = new Map<string, number>();
      this.#usageByNamespace.set(namespaceId, namespaceUsage);
    }

    const current = namespaceUsage.get(grantId) ?? 0;
    if (current >= maximumUses) {
      return false;
    }

    namespaceUsage.set(grantId, current + 1);
    return true;
  }
}

export class CapabilityAuthorizer {
  readonly #usageStore: GrantUsageStore | undefined;
  readonly #grantVerifier: CapabilityGrantVerifier | undefined;
  readonly #delegationResolver: DelegationChainResolver | undefined;
  readonly #maxDelegationChainLength: number | undefined;

  constructor(options: CapabilityAuthorizerOptions = {}) {
    this.#usageStore = options.usageStore;
    this.#grantVerifier = options.grantVerifier;
    this.#delegationResolver = options.delegationResolver;
    this.#maxDelegationChainLength = options.maxDelegationChainLength;
  }

  async authorize(
    authority: ResolvedAuthority,
    request: AuthorizationRequest,
    options: AuthorizeOptions = {},
  ): Promise<AuthorizationDecision> {
    return this.#decide(authority, request, capabilityMatches, options.consume ?? false);
  }

  /**
   * Non-consuming catalog check. A narrow grant can discover a tool whose
   * declared resource is a broader ceiling; invocation still checks the exact
   * argument-selected resource.
   */
  async canDiscover(
    authority: ResolvedAuthority,
    ceiling: AuthorizationRequest,
  ): Promise<AuthorizationDecision> {
    return this.#decide(authority, ceiling, capabilityIntersectsCeiling, false);
  }

  async #decide(
    authority: ResolvedAuthority,
    request: AuthorizationRequest,
    matches: (
      capability: Capability,
      request: AuthorizationRequest,
      context: AccessContext,
    ) => boolean,
    consume: boolean,
  ): Promise<AuthorizationDecision> {
    const context = structuredClone(authority.context);
    const grants = structuredClone([...authority.grants]);
    request = structuredClone(request);
    const now = parseTimestamp(context.now);
    if (now === undefined || context.purpose.length === 0 || context.traceId.length === 0) {
      return deny("invalid_context");
    }

    if (
      request.action.length === 0 ||
      request.resource.namespace.length === 0 ||
      !resourceBelongsToContext(request.resource, context)
    ) {
      return deny("invalid_request");
    }

    let foundExhaustedGrant = false;
    let delegationFailure: DelegationFailure | undefined;

    for (const grant of grants) {
      if (!(await this.#grantIsEligible(context, grant, now))) {
        continue;
      }

      const capability = grant.capabilities.find((candidate) =>
        matches(candidate, request, context),
      );
      if (capability === undefined) {
        continue;
      }

      const delegation = await this.#validateDelegation(context, grant, now);
      if (delegation.status !== "valid") {
        delegationFailure = worstDelegationFailure(delegationFailure, {
          status: delegation.status,
          code: delegation.code,
          grantId: delegation.grantId,
        });
        continue;
      }

      const maximumUses = grant.constraints.maxUses;
      if (maximumUses === undefined) {
        return allow(grant.id);
      }

      if (this.#usageStore === undefined) {
        return deny("usage_store_unavailable");
      }

      try {
        const available = consume
          ? await this.#usageStore.tryConsume(context.namespaceId, grant.id, maximumUses)
          : (await this.#usageStore.getUsage(context.namespaceId, grant.id)) < maximumUses;

        if (available) {
          return allow(grant.id);
        }

        foundExhaustedGrant = true;
      } catch {
        return deny("usage_store_unavailable");
      }
    }

    if (delegationFailure !== undefined) {
      return deny(
        delegationFailure.status === "unverified"
          ? "delegation_chain_unverified"
          : "delegation_chain_invalid",
        { delegation: { code: delegationFailure.code, grantId: delegationFailure.grantId } },
      );
    }

    return deny(foundExhaustedGrant ? "grant_exhausted" : "no_matching_grant");
  }

  async #validateDelegation(
    context: AccessContext,
    grant: CapabilityGrant,
    now: number,
  ): Promise<DelegationValidation> {
    return validateDelegationChain(grant, context, now, {
      ...(this.#delegationResolver === undefined ? {} : { resolver: this.#delegationResolver }),
      ...(this.#maxDelegationChainLength === undefined
        ? {}
        : { maxChainLength: this.#maxDelegationChainLength }),
    });
  }

  async #grantIsEligible(
    context: AccessContext,
    grant: CapabilityGrant,
    now: number,
  ): Promise<boolean> {
    if (
      !addressesEqual(grant.subject, context.actor) ||
      !addressesEqual(grant.issuer, context.authority) ||
      grant.namespaceId !== context.namespaceId ||
      !grantIsActive(grant, context.purpose, now)
    ) {
      return false;
    }

    if (this.#grantVerifier !== undefined) {
      try {
        if (!(await this.#grantVerifier.verify(grant, context))) {
          return false;
        }
      } catch {
        return false;
      }
    }

    return true;
  }
}

interface DelegationFailure {
  readonly status: "invalid" | "unverified";
  readonly code: string;
  readonly grantId: string;
}

/** An unverifiable chain outranks an invalid one so failures stay fail-closed. */
function worstDelegationFailure(
  current: DelegationFailure | undefined,
  candidate: DelegationFailure,
): DelegationFailure {
  if (
    current === undefined ||
    (current.status === "invalid" && candidate.status === "unverified")
  ) {
    return candidate;
  }
  return current;
}

function allow(grantId: string): AuthorizationDecision {
  return { allowed: true, reasonCode: "allowed", matchedGrantId: grantId };
}

function deny(
  reasonCode: Exclude<AuthorizationReasonCode, "allowed">,
  metadata?: JsonObject,
): AuthorizationDecision {
  return { allowed: false, reasonCode, ...(metadata === undefined ? {} : { metadata }) };
}

export function capabilityMatches(
  capability: Capability,
  request: AuthorizationRequest,
  context: AccessContext,
): boolean {
  const grantedResource = capability.resource;
  const requestedResource = request.resource;

  if (
    grantedResource.namespace !== requestedResource.namespace ||
    (!capability.actions.includes(request.action) && !capability.actions.includes("*"))
  ) {
    return false;
  }

  const grantedOwner = grantedResource.owner ?? context.owner;
  const requestedOwner = requestedResource.owner ?? context.owner;
  if (!addressesEqual(grantedOwner, requestedOwner)) {
    return false;
  }

  if (capability.scope === "exact") {
    return pathsEqual(grantedResource.path, requestedResource.path);
  }

  return pathIsWithin(grantedResource.path, requestedResource.path);
}

export function capabilityIntersectsCeiling(
  capability: Capability,
  ceiling: AuthorizationRequest,
  context: AccessContext,
): boolean {
  const grantedResource = capability.resource;
  const ceilingResource = ceiling.resource;

  if (
    grantedResource.namespace !== ceilingResource.namespace ||
    (!capability.actions.includes(ceiling.action) && !capability.actions.includes("*"))
  ) {
    return false;
  }

  const grantedOwner = grantedResource.owner ?? context.owner;
  const ceilingOwner = ceilingResource.owner ?? context.owner;
  if (!addressesEqual(grantedOwner, ceilingOwner)) {
    return false;
  }

  if (capability.scope === "exact") {
    return pathIsWithin(ceilingResource.path, grantedResource.path);
  }

  return (
    pathIsWithin(grantedResource.path, ceilingResource.path) ||
    pathIsWithin(ceilingResource.path, grantedResource.path)
  );
}

function resourceBelongsToContext(resource: ResourceRef, context: AccessContext): boolean {
  return resource.owner === undefined || addressesEqual(resource.owner, context.owner);
}
