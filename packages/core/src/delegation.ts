import type { AccessContext, Capability, CapabilityGrant } from "@aicoo/sharedos-contracts";

import {
  addressesEqual,
  grantIsActive,
  parseTimestamp,
  pathIsWithin,
  pathsEqual,
} from "./internal.js";

/** The longest ancestor chain SharedOS will walk before failing closed. */
export const DEFAULT_MAX_DELEGATION_CHAIN_LENGTH = 16;

/**
 * The trusted lookup for ancestors of a derived grant.
 *
 * A delegated grant travels with a parent identifier, never with its parent's
 * contents, so the ancestor must be loaded from an authoritative source. An
 * implementation must resolve only within the requested namespace and must
 * throw rather than return a partial or stale ancestor.
 */
export interface DelegationChainResolver {
  resolve(namespaceId: string, grantId: string): Promise<CapabilityGrant | undefined>;
}

/** A structural rule the presented chain broke. */
export type DelegationViolationCode =
  | "delegation_not_permitted"
  | "delegation_depth_exceeded"
  | "issuer_not_parent_subject"
  | "namespace_mismatch"
  | "parent_inactive"
  | "capability_widened"
  | "constraints_widened"
  | "chain_cycle"
  | "chain_too_long";

/** The chain could not be established, which is never treated as valid. */
export type DelegationUnverifiedCode =
  "resolver_unavailable" | "parent_not_found" | "resolver_failed";

export type DelegationValidation =
  | { readonly status: "valid"; readonly chain: readonly string[] }
  | {
      readonly status: "invalid";
      readonly chain: readonly string[];
      readonly code: DelegationViolationCode;
      readonly grantId: string;
    }
  | {
      readonly status: "unverified";
      readonly chain: readonly string[];
      readonly code: DelegationUnverifiedCode;
      readonly grantId: string;
    };

export interface DelegationValidationOptions {
  readonly resolver?: DelegationChainResolver;
  readonly maxChainLength?: number;
}

/**
 * Validate the complete ancestor chain of one grant.
 *
 * A grant without `parentGrantId` is a root grant and is valid here; its own
 * expiry, revocation, and purpose remain the caller's separate check. For a
 * derived grant every link must satisfy all of:
 *
 * - the child's issuer is exactly the parent's subject;
 * - both grants live in the same namespace;
 * - the parent is itself active for the requested purpose at `now`, so
 *   revoking or expiring an ancestor invalidates every descendant;
 * - every child capability is covered by one parent capability;
 * - time window, purposes, and bounded uses never widen;
 * - the parent holds delegation budget and the child's budget is strictly
 *   smaller.
 *
 * Anything the resolver cannot establish returns `unverified`, never `valid`.
 */
export async function validateDelegationChain(
  grant: CapabilityGrant,
  context: AccessContext,
  now: number,
  options: DelegationValidationOptions = {},
): Promise<DelegationValidation> {
  const chain: string[] = [];
  if (grant.parentGrantId === undefined) {
    return { status: "valid", chain };
  }

  const maxChainLength = options.maxChainLength ?? DEFAULT_MAX_DELEGATION_CHAIN_LENGTH;
  const seen = new Set<string>([grant.id]);
  let child = grant;

  while (child.parentGrantId !== undefined) {
    if (options.resolver === undefined) {
      return unverified(chain, "resolver_unavailable", child.id);
    }
    if (chain.length >= maxChainLength) {
      return invalid(chain, "chain_too_long", child.id);
    }

    let parent: CapabilityGrant | undefined;
    try {
      parent = await options.resolver.resolve(child.namespaceId, child.parentGrantId);
    } catch {
      return unverified(chain, "resolver_failed", child.id);
    }

    if (parent === undefined) {
      return unverified(chain, "parent_not_found", child.id);
    }
    if (seen.has(parent.id)) {
      return invalid(chain, "chain_cycle", parent.id);
    }

    const violation = linkViolation(child, parent, context, now);
    if (violation !== undefined) {
      return invalid(chain, violation, parent.id);
    }

    seen.add(parent.id);
    chain.push(parent.id);
    child = parent;
  }

  return { status: "valid", chain };
}

function linkViolation(
  child: CapabilityGrant,
  parent: CapabilityGrant,
  context: AccessContext,
  now: number,
): DelegationViolationCode | undefined {
  if (parent.namespaceId !== child.namespaceId) {
    return "namespace_mismatch";
  }
  if (!addressesEqual(parent.subject, child.issuer)) {
    return "issuer_not_parent_subject";
  }
  if (!grantIsActive(parent, context.purpose, now)) {
    return "parent_inactive";
  }

  const parentDepth = parent.constraints.delegationDepth;
  if (parentDepth === undefined || parentDepth < 1) {
    return "delegation_not_permitted";
  }
  if ((child.constraints.delegationDepth ?? 0) > parentDepth - 1) {
    return "delegation_depth_exceeded";
  }

  const covered = child.capabilities.every((capability) =>
    parent.capabilities.some((ancestor) => capabilityIsWithin(capability, ancestor, context)),
  );
  if (!covered) {
    return "capability_widened";
  }

  return constraintsAreAttenuated(child, parent) ? undefined : "constraints_widened";
}

/** True when every access `capability` permits is also permitted by `ancestor`. */
function capabilityIsWithin(
  capability: Capability,
  ancestor: Capability,
  context: AccessContext,
): boolean {
  if (capability.resource.namespace !== ancestor.resource.namespace) {
    return false;
  }

  const owner = capability.resource.owner ?? context.owner;
  const ancestorOwner = ancestor.resource.owner ?? context.owner;
  if (!addressesEqual(owner, ancestorOwner)) {
    return false;
  }

  const ancestorActions = new Set(ancestor.actions);
  if (
    !ancestorActions.has("*") &&
    !capability.actions.every((action) => ancestorActions.has(action))
  ) {
    return false;
  }

  if (ancestor.scope === "exact") {
    return (
      capability.scope === "exact" && pathsEqual(ancestor.resource.path, capability.resource.path)
    );
  }

  return pathIsWithin(ancestor.resource.path, capability.resource.path);
}

function constraintsAreAttenuated(child: CapabilityGrant, parent: CapabilityGrant): boolean {
  const childIssuedAt = parseTimestamp(child.issuedAt);
  const parentIssuedAt = parseTimestamp(parent.issuedAt);
  if (
    childIssuedAt === undefined ||
    parentIssuedAt === undefined ||
    childIssuedAt < parentIssuedAt
  ) {
    return false;
  }

  if (parent.constraints.expiresAt !== undefined) {
    const parentExpiry = parseTimestamp(parent.constraints.expiresAt);
    const childExpiry = parseTimestamp(child.constraints.expiresAt);
    if (parentExpiry === undefined || childExpiry === undefined || childExpiry > parentExpiry) {
      return false;
    }
  }

  if (parent.constraints.notBefore !== undefined) {
    const parentNotBefore = parseTimestamp(parent.constraints.notBefore);
    const childNotBefore = parseTimestamp(child.constraints.notBefore ?? child.issuedAt);
    if (
      parentNotBefore === undefined ||
      childNotBefore === undefined ||
      childNotBefore < parentNotBefore
    ) {
      return false;
    }
  }

  if (parent.constraints.purposes !== undefined) {
    const allowed = new Set(parent.constraints.purposes);
    const purposes = child.constraints.purposes;
    if (purposes === undefined || !purposes.every((purpose) => allowed.has(purpose))) {
      return false;
    }
  }

  if (parent.constraints.maxUses !== undefined) {
    const maxUses = child.constraints.maxUses;
    if (maxUses === undefined || maxUses > parent.constraints.maxUses) {
      return false;
    }
  }

  return true;
}

function invalid(
  chain: readonly string[],
  code: DelegationViolationCode,
  grantId: string,
): DelegationValidation {
  return { status: "invalid", chain: [...chain], code, grantId };
}

function unverified(
  chain: readonly string[],
  code: DelegationUnverifiedCode,
  grantId: string,
): DelegationValidation {
  return { status: "unverified", chain: [...chain], code, grantId };
}
