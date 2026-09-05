import type { Address, CapabilityGrant, JsonObject, JsonValue } from "@aicoo/sharedos-contracts";

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

/**
 * A tool parser's return value, as `JsonObjectSchema` would have returned it.
 *
 * The verdict is the schema's, rule for rule, and so is the value. A number
 * is kept only when finite; `undefined`, a bigint, a symbol and a function
 * are refused wherever they sit; a Date, a Map, a Set and a thenable are
 * refused where an object was expected, and every other object is read as a
 * record -- the keys `for...in` reaches, inherited ones included, into a
 * fresh plain object with a `"__proto__"` key dropped at every depth, its
 * value still checked. An array is rebuilt element by element, so a hole is
 * refused as the `undefined` it reads as. Containers are always copied, as
 * the schema always copied them, so what comes back is plain whatever the
 * parser handed over.
 *
 * The schema reached the same answer by trying every branch of the value
 * union at every node, which cost some twenty-five times the clone that
 * follows.
 */
export function readJsonObject(value: unknown): JsonObject | undefined {
  if (!isRecordLike(value)) {
    return undefined;
  }
  const read = readJsonValue(value);
  return read === REFUSED ? undefined : (read as JsonObject);
}

const REFUSED: unique symbol = Symbol("refused");

/** The objects the schema reads as records: what is left once its own types are named. */
function isRecordLike(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const candidate = value as { then?: unknown; catch?: unknown };
  if (typeof candidate.then === "function" && typeof candidate.catch === "function") {
    return false;
  }
  return !(value instanceof Map || value instanceof Set || value instanceof Date);
}

function readJsonValue(value: unknown): JsonValue | typeof REFUSED {
  switch (typeof value) {
    case "string":
    case "boolean":
      return value;
    case "number":
      return Number.isFinite(value) ? value : REFUSED;
    case "object":
      break;
    default:
      return REFUSED;
  }
  if (value === null) {
    return null;
  }
  if (Array.isArray(value)) {
    const copy: JsonValue[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const item = readJsonValue(value[index]);
      if (item === REFUSED) {
        return REFUSED;
      }
      copy.push(item);
    }
    return copy;
  }
  if (!isRecordLike(value)) {
    return REFUSED;
  }
  const copy: JsonObject = {};
  for (const key in value) {
    const item = readJsonValue(value[key]);
    if (item === REFUSED) {
      return REFUSED;
    }
    if (key !== "__proto__") {
      copy[key] = item;
    }
  }
  return copy;
}

/** Freeze a protocol value and everything reachable from it. */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
}

export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw signal.reason ?? new Error("operation aborted");
  }
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
 * The two instants one grant is judged against.
 *
 * They differ because the removals that can end a grant do not all become
 * observable at the same moment. See {@link grantIsActive}.
 */
export interface GrantInstants {
  /**
   * The instant the turn's authority was resolved.
   *
   * What the turn was admitted with. Everything that would *add* authority is
   * judged here, so a turn can never gain authority it was not admitted with.
   */
  readonly admittedAt: number;
  /**
   * The instant of the operation being authorized.
   *
   * Equal to {@link admittedAt} for a caller that names no separate operation
   * instant, which is what a kernel call outside any turn is.
   */
  readonly now: number;
}

/**
 * Time, revocation, and purpose eligibility for one grant considered alone.
 *
 * Every way a grant leaves an actor's authority funnels through here: not yet
 * active, expired, revoked, or withdrawn from the requested purpose. That makes
 * this the single point where "when is a removal observed?" is decided, and
 * there are two answers rather than one.
 *
 * Expiry is observed at the *operation* instant. It is a property the grant
 * already carried when the turn began, so refusing it part-way through costs no
 * store read and leaks no store state -- the grant set the turn holds already
 * says when its own authority ends, and honouring that needs nothing but a
 * clock.
 *
 * Everything else is observed at the instant the turn's authority was resolved.
 * Revocation and purpose withdrawal are store-side edits, invisible without
 * re-reading the store, and `SharedOSKernel` freezes a resolved authority for
 * the whole turn -- so they are observed by the *next* turn. `issuedAt` and
 * `notBefore` are frozen for the opposite reason: they would *widen* authority
 * mid-turn, and a request must carry the authority it was admitted with rather
 * than acquire more while it runs.
 *
 * The split is therefore directional, not a matter of where the fact came from:
 * the operation's clock may only take authority away. See ADR 0016 for the
 * decision and ADR 0010 for the turn boundary it narrows.
 *
 * An unparsable declared timestamp is treated as inactive so a malformed grant
 * can never outlive a well-formed one.
 */
export function grantIsActive(grant: CapabilityGrant, purpose: string, at: GrantInstants): boolean {
  return grantInactiveReason(grant, purpose, at) === undefined;
}

/**
 * Which of the two activity conditions a grant failed, for the host-facing
 * explanation. `grantIsActive` is this function's only other caller, so the
 * decision and the account of it can never disagree.
 */
export function grantInactiveReason(
  grant: CapabilityGrant,
  purpose: string,
  at: GrantInstants,
): "window" | "purpose" | undefined {
  const issuedAt = parseTimestamp(grant.issuedAt);
  const notBefore = parseTimestamp(grant.constraints.notBefore);
  const expiresAt = parseTimestamp(grant.constraints.expiresAt);
  const revokedAt = parseTimestamp(grant.revokedAt);
  // The later of the two instants, which is normally the operation's. Taking
  // the maximum rather than the operation instant alone means a host whose
  // clock runs backwards cannot revive an expired grant by presenting an
  // earlier instant than the one its turn was admitted at.
  const expiryObservedAt = Math.max(at.admittedAt, at.now);

  if (
    issuedAt === undefined ||
    issuedAt > at.admittedAt ||
    (grant.constraints.notBefore !== undefined && notBefore === undefined) ||
    (notBefore !== undefined && at.admittedAt < notBefore) ||
    (grant.constraints.expiresAt !== undefined && expiresAt === undefined) ||
    (expiresAt !== undefined && expiryObservedAt >= expiresAt) ||
    (grant.revokedAt !== undefined && revokedAt === undefined) ||
    (revokedAt !== undefined && at.admittedAt >= revokedAt)
  ) {
    return "window";
  }

  const purposes = grant.constraints.purposes;
  return purposes === undefined || purposes.includes(purpose) ? undefined : "purpose";
}
