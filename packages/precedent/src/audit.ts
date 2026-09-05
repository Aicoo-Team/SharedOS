import type { AccessContext } from "@aicoo/sharedos-contracts";
import { type AuditEvent, auditEvent } from "@aicoo/sharedos-core";

import type { AdmittedAutoDecision } from "./admission.js";

/**
 * The `escalation.auto_decided` event for one admitted auto-decision.
 *
 * R4's other half. An operator asking "what did the machine decide on our
 * behalf, and what did it cite" reads it from the audit stream, and that
 * question is the one that decides whether a matcher stays turned on.
 *
 * It takes an admitted decision and nothing else, so an inadmissible proposal
 * has no way to become an event. That is deliberate: the escalation it concerns
 * is already recorded and already waiting for a human, and a second record of
 * the same unanswered request would double-count in every denominator ADR 0011
 * was careful about.
 *
 * The outcome is `allowed` or `denied`, never `escalated`. An escalation is a
 * decision SharedOS declined to make; this is one that was made, by a matcher
 * the host installed, on a precedent a human set. Recording it as `escalated`
 * would count a machine answer as a request for help.
 *
 * `context` is the control plane's, not a turn's: the auto-decision happens
 * where the human's would have, between turns, against an escalation that is
 * already terminal.
 *
 * `createId` mints the record's identity, as `SharedOSKernelOptions.createAuditId`
 * does for the kernel's own records; a random UUID when the control plane passes
 * nothing.
 */
export function autoDecisionAuditEvent(
  context: AccessContext,
  decision: AdmittedAutoDecision,
  createId?: () => string,
): AuditEvent {
  return auditEvent(
    context,
    {
      type: "escalation.auto_decided",
      outcome: decision.allowed ? "allowed" : "denied",
      ...(decision.allowed && decision.narrowed ? { reason: "auto_allow_narrowed" } : {}),
      metadata: decision.metadata,
    },
    createId,
  );
}
