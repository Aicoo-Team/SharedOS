import type { AuditEvent } from "./audit.js";
import { isInfrastructureDenial } from "./authorization.js";

/**
 * Which check refused an operation, read from its audit record.
 *
 * A refusal code says what the caller was told; a gate says which of the
 * kernel's checks produced it. The two differ on purpose: `tool_unavailable` is
 * one code over "not registered", "namespace disabled", and "not discoverable
 * to you", and `no_matching_grant` is one code over nine conditions, so that a
 * caller cannot map the permission topology by reading refusals (ADR 0012).
 * The host is not the caller. It wired the store, issued the grant, and built
 * the context, and the audit record already says which of those was wrong --
 * as `metadata.cause`, `metadata.source`, and `metadata.failClosed`. The gate
 * is those three fields and the code read together, and it is derived from the
 * record rather than written into it because every input is already there.
 *
 * - `envelope`: the execution envelope refused before the kernel was asked. A
 *   tool the turn's catalogue never offered, or a spent step or call budget.
 * - `registration`: the kernel has no such tool for this context, or the
 *   tool's namespace is switched off. No grant changes either.
 * - `request`: the call or context itself was malformed, or named another
 *   world. A host bug; not a permission problem.
 * - `infrastructure`: SharedOS could not establish a fact and failed closed.
 *   A store threw, or a port the grant needed was never wired.
 * - `ceiling`: a grant authorized the operation and host policy overrode it.
 *   Issuing another grant will not help.
 * - `grant`: nothing the trusted source returned covers the operation, or
 *   what covers it is spent or its chain is broken. The one gate a grant fixes.
 */
export type RefusalGate =
  "envelope" | "registration" | "request" | "infrastructure" | "ceiling" | "grant";

/**
 * Causes `tool_unavailable` carries that name a registration fact rather than a
 * decision. Every other cause is a reason code and is classified as one.
 */
const REGISTRATION_CAUSES: ReadonlySet<string> = new Set(["not_registered", "namespace_disabled"]);

const REQUEST_CODES: ReadonlySet<string> = new Set([
  "invalid_context",
  "invalid_request",
  "trace_mismatch",
  "actor_mismatch",
  "receiver_mismatch",
  "message_context_mismatch",
]);

const GRANT_CODES: ReadonlySet<string> = new Set([
  "no_matching_grant",
  "grant_exhausted",
  "delegation_chain_invalid",
]);

function gateForCode(code: string): RefusalGate | undefined {
  if (isInfrastructureDenial(code)) {
    return "infrastructure";
  }
  if (code === "host_policy_denied") {
    return "ceiling";
  }
  if (REQUEST_CODES.has(code)) {
    return "request";
  }
  if (GRANT_CODES.has(code)) {
    return "grant";
  }
  return undefined;
}

function metadataString(event: AuditEvent, key: string): string | undefined {
  const value = event.metadata?.[key];
  return typeof value === "string" ? value : undefined;
}

/**
 * Name the gate a denied audit event was refused at.
 *
 * Total over every code the kernel and the envelope deny with. It returns
 * `undefined` for an event that is not a denial, and for a denial whose code
 * this package does not know -- a host that installs its own codes classifies
 * them itself -- rather than filing an unknown refusal under a gate it may not
 * belong to.
 *
 * The order is the order the checks run in. The envelope refuses before the
 * kernel sees a call, so `metadata.source` is read first, on the one record
 * type where it names the refuser rather than the recorder. The kernel refuses
 * an unregistered or disabled tool before consulting the authorizer, so
 * `metadata.cause` is read next; a cause that is itself a reason code is the
 * discovery decision `tool_unavailable` stood in for, and is classified as that
 * decision would be. `failClosed` is honoured as well as the code, so a
 * ceiling's or a source's outage counts as infrastructure whichever code
 * carried it.
 */
export function classifyRefusal(event: AuditEvent): RefusalGate | undefined {
  if (event.outcome !== "denied" || event.reason === undefined) {
    return undefined;
  }
  // `source` on an operation record says who refused. On a `turn.ended` it
  // says who recorded -- always the envelope, whichever check ended the turn
  // -- so it is read only where it carries the first meaning.
  if (event.type === "tool.invoked" && metadataString(event, "source") === "envelope") {
    return "envelope";
  }
  const cause = metadataString(event, "cause");
  if (cause !== undefined && REGISTRATION_CAUSES.has(cause)) {
    return "registration";
  }
  if (event.metadata?.["failClosed"] === true) {
    return "infrastructure";
  }
  if (event.reason === "tool_unavailable") {
    return cause === undefined ? undefined : gateForCode(cause);
  }
  return gateForCode(event.reason);
}

/**
 * A refused tool call, joined to the records that explain it.
 *
 * Carries no prose. What each gate means and what fixes it is one table, in
 * `docs/errors.md`, and a sentence copied out of it into a return value is a
 * sentence that drifts. Everything here is a fact the kernel recorded.
 */
export interface RefusalExplanation {
  readonly gate: RefusalGate | undefined;
  /** The code the caller was given. */
  readonly code: string;
  /** Which boundary refused, from `metadata.source`. */
  readonly source: string | undefined;
  /** Which situation a coarse code was, from `metadata.cause`, where it carried one. */
  readonly cause: string | undefined;
  /** The `tool.invoked` record of the refusal. */
  readonly refusal: AuditEvent;
  /**
   * The `authorization.checked` record the refusal followed from, where there
   * was a decision. Its metadata carries `rejectedGrants`, `grantsResolved`,
   * and `missingDependency`. Absent when nothing was checked: an unregistered
   * tool, a disabled namespace, an envelope refusal.
   */
  readonly decision: AuditEvent | undefined;
}

/**
 * Join a denied `ToolResult` to its audit records and name the gate.
 *
 * The join is on `operationId`, which the kernel and the envelope both stamp
 * with the call's id. It is never on recency: two turns interleaved on one
 * sink put another call's refusal last, and a reader that took the most recent
 * `tool.invoked` would explain the wrong denial with the right code. A call id
 * is the caller's, so a caller that reuses one across calls gets the latest
 * record under it; the executor mints distinct ids and never does.
 *
 * `undefined` when no denied `tool.invoked` record carries the id -- an audit
 * sink that was not wired, or one that dropped the write. Wire one first.
 */
export function explainRefusal(
  result: { readonly callId: string },
  events: readonly AuditEvent[],
): RefusalExplanation | undefined {
  const own = events.filter((event) => event.operationId === result.callId);
  const refusal = own.filter((e) => e.type === "tool.invoked" && e.outcome === "denied").at(-1);
  if (refusal === undefined || refusal.reason === undefined) {
    return undefined;
  }
  const decision = own
    .filter((e) => e.type === "authorization.checked" && e.outcome === "denied")
    .at(-1);
  return {
    gate: classifyRefusal(refusal),
    code: refusal.reason,
    source: metadataString(refusal, "source"),
    cause: metadataString(refusal, "cause"),
    refusal,
    decision,
  };
}
