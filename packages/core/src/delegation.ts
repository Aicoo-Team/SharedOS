import type {
  Address,
  Capability,
  CapabilityConstraints,
  CapabilityGrant,
} from "@aicoo/sharedos-contracts";

import { addressesEqual } from "./authorization.js";

export type DelegationRefusal =
  | "namespace_mismatch"
  | "issuer_is_not_the_holder"
  | "parent_not_delegable"
  | "depth_exhausted"
  | "capability_not_within_parent"
  | "purpose_not_within_parent"
  | "window_not_within_parent"
  | "bounded_parent_not_delegable"
  | "empty_capabilities";

export type DeriveGrantResult =
  | { readonly ok: true; readonly grant: CapabilityGrant }
  | { readonly ok: false; readonly reason: DelegationRefusal };

export interface DeriveGrantRequest {
  /** Identifier for the derived grant. Must be unique within the namespace. */
  readonly id: string;
  /** Who receives the derived authority. */
  readonly subject: Address;
  /** The subset being passed on. Must be within the parent, capability by capability. */
  readonly capabilities: readonly Capability[];
  readonly constraints?: Omit<CapabilityConstraints, "delegationDepth"> & {
    readonly delegationDepth?: number;
  };
  readonly issuedAt: string;
  readonly metadata?: CapabilityGrant["metadata"];
}

function pathIsWithin(parent: readonly string[], candidate: readonly string[]): boolean {
  return (
    parent.length <= candidate.length &&
    parent.every((segment, index) => segment === candidate[index])
  );
}

function pathsEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((segment, index) => segment === right[index]);
}

function parseTimestamp(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Is `child` entirely contained by `parent`?
 *
 * Every axis is checked separately and on purpose. A single "looks narrower"
 * comparison is how a delegation model grows a hole: an actions subset with a
 * wider path, or an equal path with a wider scope, both read as "smaller" to a
 * casual check.
 */
function capabilityIsWithin(parent: Capability, child: Capability): boolean {
  if (parent.resource.namespace !== child.resource.namespace) return false;

  const parentOwner = parent.resource.owner;
  const childOwner = child.resource.owner;
  // An unowned parent capability is resolved against the caller's owner at use
  // time, so a child may not pin an owner the parent did not name.
  if (parentOwner === undefined) {
    if (childOwner !== undefined) return false;
  } else if (childOwner === undefined || !addressesEqual(parentOwner, childOwner)) {
    return false;
  }

  const parentActions = new Set(parent.actions);
  const grantsEveryAction = parentActions.has("*");
  if (!grantsEveryAction && !child.actions.every((action) => parentActions.has(action))) {
    return false;
  }
  // A wildcard cannot be passed on as a wildcard-plus-more, and a child that
  // asks for "*" is asking for anything the parent may later be widened to.
  if (child.actions.includes("*") && !grantsEveryAction) return false;

  if (parent.scope === "exact") {
    // An exact parent covers one path, so a descendants child would reach past it.
    return child.scope === "exact" && pathsEqual(parent.resource.path, child.resource.path);
  }

  return pathIsWithin(parent.resource.path, child.resource.path);
}

function everyCapabilityIsWithin(
  parent: CapabilityGrant,
  capabilities: readonly Capability[],
): boolean {
  // Each child capability must fit inside ONE parent capability. Satisfying it
  // from parts of several is the cross-product the kernel refuses everywhere
  // else, and it must not reappear here.
  return capabilities.every((child) =>
    parent.capabilities.some((candidate) => capabilityIsWithin(candidate, child)),
  );
}

/**
 * An omitted constraint inherits the parent's, so silence never widens. Only a
 * constraint the delegator states explicitly has to be checked.
 */
function purposesAreWithin(
  parent: CapabilityConstraints,
  child: DeriveGrantRequest["constraints"],
): boolean {
  const parentPurposes = parent.purposes;
  const childPurposes = child?.purposes;
  if (parentPurposes === undefined || childPurposes === undefined) return true;
  const allowed = new Set(parentPurposes);
  return childPurposes.every((purpose) => allowed.has(purpose));
}

function windowIsWithin(
  parent: CapabilityConstraints,
  child: DeriveGrantRequest["constraints"],
): boolean {
  const parentNotBefore = parseTimestamp(parent.notBefore);
  const childNotBefore = parseTimestamp(child?.notBefore);
  if (child?.notBefore !== undefined && childNotBefore === undefined) return false;
  if (parentNotBefore !== undefined && childNotBefore !== undefined) {
    if (childNotBefore < parentNotBefore) return false;
  }

  const parentExpiresAt = parseTimestamp(parent.expiresAt);
  const childExpiresAt = parseTimestamp(child?.expiresAt);
  if (child?.expiresAt !== undefined && childExpiresAt === undefined) return false;
  // An omitted child expiry inherits the parent's below, so it cannot outlive it.
  if (parentExpiresAt !== undefined && childExpiresAt !== undefined) {
    if (childExpiresAt > parentExpiresAt) return false;
  }

  return true;
}

/**
 * Derive a narrower grant from one the delegator already holds.
 *
 * This is the only supported way to produce a grant whose issuer is not the
 * resource owner. It is a pure function: it never consults a store, never
 * mints authority the parent does not carry, and refuses rather than clamping
 * when a request would exceed the parent — a silently clamped delegation reads
 * as accepted, and the delegator then believes it passed on more than it did.
 *
 * Bounded (`maxUses`) parents are refused outright. Sharing one use budget
 * across a chain needs usage accounting that spans grants, and an
 * unaccounted-for child would multiply the budget by the number of delegates.
 */
export function deriveGrant(
  parent: CapabilityGrant,
  request: DeriveGrantRequest,
): DeriveGrantResult {
  if (request.capabilities.length === 0) {
    return { ok: false, reason: "empty_capabilities" };
  }
  if (parent.constraints.maxUses !== undefined) {
    return { ok: false, reason: "bounded_parent_not_delegable" };
  }

  const parentDepth = parent.constraints.delegationDepth;
  if (parentDepth === undefined || parentDepth <= 0) {
    return { ok: false, reason: "parent_not_delegable" };
  }

  const remainingDepth = parentDepth - 1;
  const requestedDepth = request.constraints?.delegationDepth;
  if (requestedDepth !== undefined && requestedDepth > remainingDepth) {
    return { ok: false, reason: "depth_exhausted" };
  }

  if (!everyCapabilityIsWithin(parent, request.capabilities)) {
    return { ok: false, reason: "capability_not_within_parent" };
  }
  if (!purposesAreWithin(parent.constraints, request.constraints)) {
    return { ok: false, reason: "purpose_not_within_parent" };
  }
  if (!windowIsWithin(parent.constraints, request.constraints)) {
    return { ok: false, reason: "window_not_within_parent" };
  }

  const depth = requestedDepth ?? remainingDepth;
  const constraints: CapabilityConstraints = {
    ...(parent.constraints.purposes !== undefined || request.constraints?.purposes !== undefined
      ? { purposes: [...(request.constraints?.purposes ?? parent.constraints.purposes!)] }
      : {}),
    ...(request.constraints?.notBefore !== undefined
      ? { notBefore: request.constraints.notBefore }
      : parent.constraints.notBefore !== undefined
        ? { notBefore: parent.constraints.notBefore }
        : {}),
    ...(request.constraints?.expiresAt !== undefined
      ? { expiresAt: request.constraints.expiresAt }
      : parent.constraints.expiresAt !== undefined
        ? { expiresAt: parent.constraints.expiresAt }
        : {}),
    ...(request.constraints?.maxUses !== undefined ? { maxUses: request.constraints.maxUses } : {}),
    delegationDepth: depth,
  };

  return {
    ok: true,
    grant: {
      id: request.id,
      namespaceId: parent.namespaceId,
      subject: request.subject,
      // The delegator issues in its own name, so an audit trail names who
      // passed the authority on rather than only who originally owned it.
      issuer: parent.subject,
      capabilities: request.capabilities.map((capability) => ({
        ...capability,
        actions: [...capability.actions],
        resource: { ...capability.resource, path: [...capability.resource.path] },
      })),
      constraints,
      issuedAt: request.issuedAt,
      delegation: {
        parentGrantId: parent.id,
        depth,
        chain: [...(parent.delegation?.chain ?? []), parent.id],
      },
      ...(request.metadata ? { metadata: request.metadata } : {}),
    },
  };
}

/** Resolves an ancestor grant so its revocation and expiry still bind. */
export interface GrantChainResolver {
  get(namespaceId: string, grantId: string): Promise<CapabilityGrant | undefined>;
}

/**
 * Delegating who may delegate is separate from delegating what they may do:
 * a holder must not be able to hand on a longer chain than it received.
 */
export function delegationChainIsConsistent(grant: CapabilityGrant): boolean {
  const delegation = grant.delegation;
  if (delegation === undefined) return true;
  if (delegation.chain.at(-1) !== delegation.parentGrantId) return false;
  if (new Set(delegation.chain).size !== delegation.chain.length) return false;
  if (delegation.chain.includes(grant.id)) return false;
  return grant.constraints.delegationDepth === delegation.depth;
}
