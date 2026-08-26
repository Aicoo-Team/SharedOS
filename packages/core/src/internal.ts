import type { Address, CapabilityGrant } from "@aicoo/sharedos-contracts";

/** Structural JSON equality for protocol values with unordered object keys. */
export function canonicalJson(value: unknown): string {
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

export function addressesEqual(left: Address, right: Address): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

export function parseTimestamp(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function pathsEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((segment, index) => segment === right[index]);
}

export function pathIsWithin(parent: readonly string[], candidate: readonly string[]): boolean {
  return (
    parent.length <= candidate.length &&
    parent.every((segment, index) => segment === candidate[index])
  );
}

/**
 * Time, revocation, and purpose eligibility for one grant considered alone.
 *
 * Every way a grant leaves an actor's authority funnels through here: not yet
 * active, expired, revoked, or withdrawn from the requested purpose. That makes
 * this the single point where "when is a removal observed?" is decided, and the
 * answer is `now`.
 *
 * `now` is the instant the *turn's* authority was resolved, not the instant of
 * the operation being authorized, because `SharedOSKernel` freezes a resolved
 * authority -- grants and the context that carries `now` together -- for the
 * whole turn. A removal recorded while a turn is running is therefore observed
 * by the next turn. See `MID_TURN_AUTHORITY_REFRESH` in `authority.ts` for the
 * fuse that restores per-operation resolution, and for why expiry and
 * revocation are frozen together today.
 *
 * An unparsable declared timestamp is treated as inactive so a malformed grant
 * can never outlive a well-formed one.
 */
export function grantIsActive(grant: CapabilityGrant, purpose: string, now: number): boolean {
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
