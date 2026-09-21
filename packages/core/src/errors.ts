export class DuplicateRegistrationError extends Error {
  override readonly name = "DuplicateRegistrationError";

  constructor(
    kind: "resource namespace" | "tool" | "tool provider" | "tool namespace settings",
    identifier: string,
  ) {
    super(`${kind} is already registered: ${identifier}`);
  }
}

export class MissingRegistrationError extends Error {
  override readonly name = "MissingRegistrationError";

  constructor(
    kind: "resource namespace" | "tool" | "tool provider" | "tool namespace settings",
    identifier: string,
  ) {
    super(`${kind} is not registered: ${identifier}`);
  }
}

/** The code a turn ends on, and an error carries, when audit could not record a decision. */
export const AUDIT_UNAVAILABLE = "audit_unavailable";

/** The code on the error `onAuditError` is handed when a sink did not answer in time. */
export const AUDIT_WRITE_TIMEOUT = "audit_write_timeout";

/**
 * Handed to `onAuditError` when a record written after an effect was still
 * unanswered at `auditWriteTimeoutMs`.
 *
 * Never thrown at a caller. The effect has committed, so the caller is given
 * its result and the host is told the record is unconfirmed: the sink may still
 * write it, and nothing waits to find out.
 */
export class AuditWriteTimeoutError extends Error {
  override readonly name = "AuditWriteTimeoutError";
  readonly code = AUDIT_WRITE_TIMEOUT;
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`The audit sink did not answer a record written after an effect within ${timeoutMs} ms`);
    this.timeoutMs = timeoutMs;
  }
}

/**
 * The audit sink failed on a record that comes before an effect.
 *
 * An authority load, an authorization decision and a catalogue listing are each
 * written before anything acts on them, and a decision that was never recorded
 * is not one SharedOS will act on, so the operation is refused by rejecting with
 * this. `cause` is what the sink threw.
 *
 * `effect` says what the caller may assume about the operation it asked for.
 * `none`: the record that failed came before the operation's port was entered,
 * so nothing ran. `unknown`: the port was entered and then asked the kernel for
 * a decision of its own that could not be recorded -- a host tool calling back
 * into the kernel for a governed read -- so whatever the port did before that
 * stands, and the operation is recorded `interrupted`.
 *
 * Typed so a caller can tell an audit outage from a fault of its own: the
 * execution envelope ends the turn on it as `audit_unavailable` rather than
 * blaming the runtime plugin that happened to be waiting on the call (ADR 0023).
 */
export class AuditUnavailableError extends Error {
  override readonly name = "AuditUnavailableError";
  readonly code = AUDIT_UNAVAILABLE;
  readonly effect: "none" | "unknown";

  constructor(cause: unknown, effect: "none" | "unknown" = "none") {
    super("The audit sink could not record a decision, so the operation was refused", { cause });
    this.effect = effect;
  }
}
