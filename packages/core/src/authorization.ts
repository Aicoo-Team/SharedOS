import type {
  AccessContext,
  AuthorizationDecision,
  Capability,
  CapabilityGrant,
  JsonObject,
  ResourceRef,
} from "@aicoo/sharedos-contracts";

import type { ResolvedAuthority } from "./authority.js";
import { describeRequiredCapability } from "./capability-request.js";
import {
  type DelegationChainResolver,
  type DelegationValidation,
  validateDelegationChain,
} from "./delegation.js";
import {
  addressesEqual,
  type GrantInstants,
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

/**
 * The instant one decision is made at, when it is not the turn's own.
 *
 * `ResolvedAuthority.context` carries the instant the turn's authority was
 * resolved, and that is what a turn is admitted against. A caller that knows the
 * instant of the *operation* -- `SharedOSKernel` does, because the executor
 * stamps a live context onto every call -- names it here, and a grant whose
 * validity window has closed since admission is refused without re-reading the
 * store. Omitting it decides at the turn's instant, which is what a kernel call
 * outside any turn is. See `grantIsActive` in `internal.ts` for which removals
 * move and which do not, and ADR 0016 for why.
 */
export interface AuthorizationInstantOptions {
  readonly now?: string;
}

export interface AuthorizeOptions extends AuthorizationInstantOptions {
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
    return this.#decide(
      authority,
      request,
      capabilityMatches,
      options.consume ?? false,
      options.now,
    );
  }

  /**
   * Non-consuming catalog check. A narrow grant can discover a tool whose
   * declared resource is a broader ceiling; invocation still checks the exact
   * argument-selected resource.
   */
  async canDiscover(
    authority: ResolvedAuthority,
    ceiling: AuthorizationRequest,
    options: AuthorizationInstantOptions = {},
  ): Promise<AuthorizationDecision> {
    return this.#decide(authority, ceiling, capabilityIntersectsCeiling, false, options.now);
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
    operationNow: string | undefined,
  ): Promise<AuthorizationDecision> {
    const context = structuredClone(authority.context);
    const grants = structuredClone([...authority.grants]);
    request = structuredClone(request);
    const admittedAt = parseTimestamp(context.now);
    // An unparsable operation instant is a broken context, not an absent one:
    // falling back to the turn's instant would silently decide at a moment the
    // caller did not ask for, which is the one thing naming an instant is for.
    const now = operationNow === undefined ? admittedAt : parseTimestamp(operationNow);
    if (
      admittedAt === undefined ||
      now === undefined ||
      context.purpose.length === 0 ||
      context.traceId.length === 0
    ) {
      return deny("invalid_context");
    }
    const at: GrantInstants = { admittedAt, now };

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
      if (!(await this.#grantIsEligible(context, grant, at))) {
        continue;
      }

      const capability = grant.capabilities.find((candidate) =>
        matches(candidate, request, context),
      );
      if (capability === undefined) {
        continue;
      }

      const delegation = await this.#validateDelegation(context, grant, at);
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

    if (foundExhaustedGrant) {
      return deny("grant_exhausted");
    }

    // The one denial that describes what would have satisfied it. A grant
    // exists for `grant_exhausted` and issuing another is not the remedy, and an
    // infrastructure denial names a fact SharedOS could not establish; only
    // "nothing granted this" is answered by authority that does not yet exist.
    // See ADR 0019.
    const requiredCapability = await describeRequiredCapability(context, request);
    return {
      ...deny("no_matching_grant"),
      ...(requiredCapability === undefined ? {} : { requiredCapability }),
    };
  }

  async #validateDelegation(
    context: AccessContext,
    grant: CapabilityGrant,
    at: GrantInstants,
  ): Promise<DelegationValidation> {
    return validateDelegationChain(grant, context, at.now, {
      admittedAt: at.admittedAt,
      ...(this.#delegationResolver === undefined ? {} : { resolver: this.#delegationResolver }),
      ...(this.#maxDelegationChainLength === undefined
        ? {}
        : { maxChainLength: this.#maxDelegationChainLength }),
    });
  }

  async #grantIsEligible(
    context: AccessContext,
    grant: CapabilityGrant,
    at: GrantInstants,
  ): Promise<boolean> {
    if (
      !addressesEqual(grant.subject, context.actor) ||
      !addressesEqual(grant.issuer, context.authority) ||
      grant.namespaceId !== context.namespaceId ||
      !grantIsActive(grant, context.purpose, at)
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
