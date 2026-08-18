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
