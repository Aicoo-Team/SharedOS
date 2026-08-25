import type {
  AccessContext,
  Address,
  AuthorizationDecision,
  Capability,
  CapabilityGrant,
  ResourceReach,
  ResourceRef,
} from "@aicoo/sharedos-contracts";

import { delegationChainIsConsistent, type GrantChainResolver } from "./delegation.js";

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
  | "usage_store_unavailable"
  | "delegation_chain_unavailable"
  | "delegation_chain_broken";

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
   * Resolves ancestors of a derived grant. Required to use one: a derived
   * grant's constraints are narrowed at derivation, but revocation and expiry
   * happen afterwards, and only the ancestors carry them.
   */
  readonly chainResolver?: GrantChainResolver;
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
  readonly #chainResolver: GrantChainResolver | undefined;

  constructor(options: CapabilityAuthorizerOptions = {}) {
    this.#usageStore = options.usageStore;
    this.#grantVerifier = options.grantVerifier;
    this.#chainResolver = options.chainResolver;
  }

  async authorize(
    context: AccessContext,
    request: AuthorizationRequest,
    options: AuthorizeOptions = {},
  ): Promise<AuthorizationDecision> {
    return this.#decide(context, request, capabilityMatches, options.consume ?? false);
  }

  /**
   * Non-consuming catalog check. A narrow grant can discover a tool whose
   * declared resource is a broader ceiling; invocation still checks the exact
   * argument-selected resource.
   */
  async canDiscover(
    context: AccessContext,
    ceiling: AuthorizationRequest,
  ): Promise<AuthorizationDecision> {
    return this.#decide(context, ceiling, capabilityIntersectsCeiling, false);
  }

  /**
   * The reachable surface for this context, with authority removed.
   *
   * Answers "where may I look" for a runtime that is deliberately never shown
   * its grants. Only currently eligible grants contribute — an expired,
   * revoked, wrong-purpose, or chain-broken grant is not reach — and nothing
   * here is consumed, so asking never spends a bounded grant.
   *
   * This is descriptive, never permissive. Every operation is authorized
   * independently afterwards.
   */
  async reach(context: AccessContext): Promise<readonly ResourceReach[]> {
    context = structuredClone(context);
    const now = parseTimestamp(context.now);
    if (now === undefined || context.purpose.length === 0 || context.traceId.length === 0) {
      return [];
    }

    const reachable: ResourceReach[] = [];
    const seen = new Set<string>();

    for (const grant of context.grants) {
      if (!(await this.#grantIsEligible(context, grant, now))) {
        continue;
      }
      // A grant with a spent budget can still be listed as reach only if it has
      // budget left; otherwise it advertises a door that is already closed.
      if (grant.constraints.maxUses !== undefined) {
        if (this.#usageStore === undefined) continue;
        try {
          if (
            (await this.#usageStore.getUsage(context.namespaceId, grant.id)) >=
            grant.constraints.maxUses
          ) {
            continue;
          }
        } catch {
          continue;
        }
      }

      for (const capability of grant.capabilities) {
        const entry: ResourceReach = {
          namespace: capability.resource.namespace,
          path: [...capability.resource.path],
          actions: [...capability.actions].sort(),
          scope: capability.scope,
        };
        const key = JSON.stringify(entry);
        if (seen.has(key)) continue;
        seen.add(key);
        reachable.push(entry);
      }
    }

    return reachable;
  }

  async #decide(
    context: AccessContext,
    request: AuthorizationRequest,
    matches: (
      capability: Capability,
      request: AuthorizationRequest,
      context: AccessContext,
    ) => boolean,
    consume: boolean,
  ): Promise<AuthorizationDecision> {
    context = structuredClone(context);
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

    for (const grant of context.grants) {
      if (!(await this.#grantIsEligible(context, grant, now))) {
        continue;
      }

      const capability = grant.capabilities.find((candidate) =>
        matches(candidate, request, context),
      );
      if (capability === undefined) {
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

    return deny(foundExhaustedGrant ? "grant_exhausted" : "no_matching_grant");
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

    return this.#chainIsUsable(context, grant, now);
  }

  /**
   * A derived grant is only as alive as every grant above it.
   *
   * Narrowing is settled at derivation, so nothing here re-checks scope. That
   * is safe only because `AccessContext` is a trusted host-created boundary
   * (see kernel.ts): a grant reaching this point was either issued by the host
   * or produced by `deriveGrant`, which refuses anything outside its parent. A
   * host that rebuilds grants from untrusted storage must re-validate them
   * before assembling the context — this function will not catch a forged
   * capability set, only a forged or dead chain.
   *
   * What cannot be settled in advance is what happens later: revoking the root
   * must stop everything derived from it, immediately and without rewriting the
   * children. That is why revocation is checked here, at the point of use.
   */
  async #chainIsUsable(
    context: AccessContext,
    grant: CapabilityGrant,
    now: number,
  ): Promise<boolean> {
    const delegation = grant.delegation;
    if (delegation === undefined) return true;
    if (!delegationChainIsConsistent(grant)) return false;
    // No resolver means ancestor revocation cannot be observed. Treating that
    // as "probably still fine" is exactly the failure a revocation is for.
    if (this.#chainResolver === undefined) return false;

    for (const ancestorId of delegation.chain) {
      let ancestor: CapabilityGrant | undefined;
      try {
        ancestor = await this.#chainResolver.get(context.namespaceId, ancestorId);
      } catch {
        return false;
      }
      if (
        ancestor === undefined ||
        ancestor.namespaceId !== grant.namespaceId ||
        !grantIsActive(ancestor, context.purpose, now)
      ) {
        return false;
      }
    }

    return true;
  }
}

function allow(grantId: string): AuthorizationDecision {
  return { allowed: true, reasonCode: "allowed", matchedGrantId: grantId };
}

function deny(reasonCode: Exclude<AuthorizationReasonCode, "allowed">): AuthorizationDecision {
  return { allowed: false, reasonCode };
}

export function addressesEqual(left: Address, right: Address): boolean {
  return canonicalJson(left) === canonicalJson(right);
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

function grantIsActive(grant: CapabilityGrant, purpose: string, now: number): boolean {
  const issuedAt = parseTimestamp(grant.issuedAt);
  const notBefore = parseTimestamp(grant.constraints.notBefore);
  const expiresAt = parseTimestamp(grant.constraints.expiresAt);
  const revokedAt = parseTimestamp(grant.revokedAt);

  if (
    issuedAt === undefined ||
    issuedAt > now ||
    (grant.constraints.notBefore !== undefined && notBefore === undefined) ||
    (notBefore !== undefined && now < notBefore) ||
    (grant.constraints.expiresAt !== undefined && expiresAt === undefined) ||
    (expiresAt !== undefined && now >= expiresAt) ||
    (grant.revokedAt !== undefined && revokedAt === undefined) ||
    (revokedAt !== undefined && now >= revokedAt)
  ) {
    return false;
  }

  const purposes = grant.constraints.purposes;
  return purposes === undefined || purposes.includes(purpose);
}

function pathsEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((segment, index) => segment === right[index]);
}

function pathIsWithin(parent: readonly string[], candidate: readonly string[]): boolean {
  return (
    parent.length <= candidate.length &&
    parent.every((segment, index) => segment === candidate[index])
  );
}

function parseTimestamp(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }

  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value) ?? "undefined";
}
