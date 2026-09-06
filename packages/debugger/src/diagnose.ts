import type { AuditEvent } from "@aicoo/sharedos-core";
import type { JsonObject, ToolResult } from "@aicoo/sharedos-contracts";

// ============================================================
// Types
// ============================================================

export type DenialGate =
  | "registration"
  | "capability_grant"
  | "product_ceiling"
  | "infrastructure"
  | "delegation"
  | "turn"
  | "envelope"
  | "unknown";

export interface DenialDiagnosis {
  /** Which of the four gates (plus delegation/envelope) refused this call. */
  readonly gate: DenialGate;
  /** The raw refusal code from the ToolResult error. */
  readonly code: string;
  /** Human-readable explanation of what happened. */
  readonly message: string;
  /** Actionable next step to fix the issue. */
  readonly nextStep: string;
  /** Audit metadata if available (rejectedGrants, cause, etc). */
  readonly metadata?: JsonObject;
}

// ============================================================
// Lookup table: code → gate + message + fix
// ============================================================

interface DiagnosisEntry {
  readonly gate: DenialGate;
  readonly message: string;
  readonly nextStep: string;
}

const DIAGNOSIS_TABLE: Readonly<Record<string, DiagnosisEntry>> = {
  // ── Registration gate ──
  tool_unavailable: {
    gate: "registration",
    message:
      "Tool is not registered, its namespace is disabled, or no grant makes it discoverable.",
    nextStep:
      "Check audit metadata.cause: 'not_registered' → registerTool(); 'namespace_disabled' → enable namespace via PUT /v1/tools/namespaces; otherwise → issue a grant covering this tool.",
  },

  // ── Capability grant gate ──
  no_matching_grant: {
    gate: "capability_grant",
    message:
      "No grant covers this resource and action. Walk the 9-item checklist: authority=issuer, actor=subject, purpose match, window, namespace, path, action, verifier, single-grant rule.",
    nextStep:
      "Check audit rejectedGrants[] to see which grant failed and why (issuer/subject/namespace/window/purpose/capability). Issue a new grant covering the exact resource+action.",
  },
  grant_exhausted: {
    gate: "capability_grant",
    message: "A matching grant exists but its maxUses budget is spent.",
    nextStep:
      "Issue a new grant. Usage is not resettable — grants with a spent budget authorize nothing.",
  },
  invalid_request: {
    gate: "capability_grant",
    message: "The resolved requirement names a world other than the caller's own.",
    nextStep: "Check path segments, action naming, and the owner in the capability request.",
  },
  trace_mismatch: {
    gate: "capability_grant",
    message: "call.traceId does not match the context traceId.",
    nextStep: "Ensure the tool call's traceId matches the AccessContext.traceId.",
  },

  // ── Product ceiling gate ──
  host_policy_denied: {
    gate: "product_ceiling",
    message: "A grant matched, but the host ceiling (toolAccess.allowedTools) overrode it.",
    nextStep:
      "Check the host's toolAccess.allowedTools policy. This is product/org policy, not authority — widen the ceiling or adjust the grant.",
  },

  // ── Infrastructure gate (fail-closed) ──
  authority_unavailable: {
    gate: "infrastructure",
    message:
      "The GrantSource threw, returned invalid material, or returned grants outside the context's scope. Fail-closed.",
    nextStep:
      "Check GrantSource.load() for throws or invalid grants. Audit metadata.rejectedGrants shows which grant broke and why.",
  },
  usage_store_unavailable: {
    gate: "infrastructure",
    message: "Grant has maxUses but no usageStore is wired, or the store threw. Fail-closed.",
    nextStep:
      "Wire a GrantUsageStore: new CapabilityAuthorizer({ usageStore: new InMemoryGrantUsageStore() }).",
  },
  delegation_chain_unverified: {
    gate: "infrastructure",
    message:
      "Grant needs a delegationResolver but none is wired, or the resolver threw. Fail-closed.",
    nextStep:
      "Wire a DelegationChainResolver: new CapabilityAuthorizer({ delegationResolver: new InMemoryDelegationChainResolver() }).",
  },
  host_policy_unavailable: {
    gate: "infrastructure",
    message:
      "The host ceiling threw or the turn's PolicySource failed. Fail-closed — a ceiling may only narrow.",
    nextStep: "Check the HostCeiling implementation and PolicySource for errors.",
  },
  invalid_context: {
    gate: "infrastructure",
    message: "The AccessContext failed its schema validation.",
    nextStep:
      "Build the context server-side. Do not construct it from request bodies or model output.",
  },

  // ── Delegation gate ──
  delegation_chain_invalid: {
    gate: "delegation",
    message: "The delegation chain resolved but broke a rule — often a revoked ancestor.",
    nextStep:
      "Check metadata for the failing link's code and grantId. Common: parent_inactive (upstream revocation), capability_widened, constraints_widened.",
  },

  // ── Turn gate ──
  actor_mismatch: {
    gate: "turn",
    message: "The turn's agent is not the admitted one.",
    nextStep: "context.actor must equal the agent that was admitted to run this turn.",
  },
  receiver_mismatch: {
    gate: "turn",
    message: "The delivered message's receiver is not the executing agent.",
    nextStep: "Ensure the message.receiver matches the turn's admitted agent.",
  },
  message_context_mismatch: {
    gate: "turn",
    message: "The delivered message's trace or purpose disagrees with the context.",
    nextStep: "Ensure message.traceId and message.purpose match the AccessContext.",
  },
  step_limit_exceeded: {
    gate: "envelope",
    message: "The call names a step at or past the envelope's maxSteps.",
    nextStep: "Increase maxSteps in SharedOSExecutor options, or let the turn complete.",
  },
  tool_call_limit_exceeded: {
    gate: "envelope",
    message: "The envelope's maxToolCalls budget is spent.",
    nextStep: "Increase maxToolCalls in SharedOSExecutor options.",
  },
};

// ============================================================
// Infrastructure denial codes (fail-closed, not policy)
// ============================================================

const INFRASTRUCTURE_DENIAL_REASONS = new Set([
  "authority_unavailable",
  "usage_store_unavailable",
  "delegation_chain_unverified",
  "host_policy_unavailable",
]);

// ============================================================
// Core diagnose function
// ============================================================

/**
 * Diagnose a SharedOS denial and produce a human-readable explanation.
 *
 * @param result - A ToolResult with status "denied" (or any result; non-denials get a passthrough)
 * @param auditEvents - Optional audit trail for deeper diagnosis (rejectedGrants, cause, etc.)
 * @returns A DenialDiagnosis naming the gate, explaining the refusal, and suggesting a fix
 */
export function diagnoseDenial(
  result: ToolResult,
  auditEvents?: readonly AuditEvent[],
): DenialDiagnosis {
  // Non-denials: return immediately
  if (result.status !== "denied") {
    return {
      gate: "unknown",
      code: result.status,
      message: `Result status is "${result.status}", not a denial.`,
      nextStep: "No diagnosis needed — the operation was not denied.",
    };
  }

  const code = result.error.code;
  const entry = DIAGNOSIS_TABLE[code];

  // Base diagnosis from lookup table
  const base: DenialDiagnosis = entry
    ? {
        gate: entry.gate,
        code,
        message: entry.message,
        nextStep: entry.nextStep,
      }
    : {
        gate: "unknown",
        code,
        message: `Unknown refusal code "${code}". Check docs/errors.md for the full reference.`,
        nextStep: "Review the error code in docs/errors.md or ask David.",
      };

  // Enhance with audit trail if available
  if (auditEvents === undefined || auditEvents.length === 0) {
    return base;
  }

  const { metadata, gateOverride } = enrichFromAudit(code, auditEvents);
  if (metadata !== undefined || gateOverride !== undefined) {
    return {
      ...base,
      ...(gateOverride !== undefined ? { gate: gateOverride } : {}),
      ...(metadata !== undefined ? { metadata } : {}),
    };
  }

  return base;
}

// ============================================================
// Audit enrichment helpers
// ============================================================

function enrichFromAudit(
  code: string,
  events: readonly AuditEvent[],
): { metadata?: JsonObject; gateOverride?: DenialGate } {
  const relevant = events.filter(
    (e) =>
      (e.type === "authorization.checked" || e.type === "tool.invoked") && e.outcome === "denied",
  );

  if (relevant.length === 0) {
    return {};
  }

  // For tool_unavailable, look specifically at tool.invoked events (discovery failure)
  // For other codes, use the last relevant denial (authorization.checked or tool.invoked)
  let lastDenial: AuditEvent | undefined;
  if (code === "tool_unavailable") {
    lastDenial = relevant.filter((e) => e.type === "tool.invoked").slice(-1)[0];
  } else {
    lastDenial = relevant[relevant.length - 1];
  }

  if (lastDenial === undefined) {
    return {};
  }

  const meta: JsonObject = {};
  let gateOverride: DenialGate | undefined;

  // Extract rejectedGrants for no_matching_grant
  if (code === "no_matching_grant" && lastDenial.metadata !== undefined) {
    const rejectedGrants = lastDenial.metadata.rejectedGrants;
    if (Array.isArray(rejectedGrants)) {
      meta.rejectedGrants = rejectedGrants;
      // Build a human-readable summary
      const reasons = (rejectedGrants as Array<{ grantId: string; reason: string }>)
        .map((g) => `${g.grantId}: ${g.reason}`)
        .join(", ");
      meta.summary = `Rejected grants: ${reasons}`;
    }
    const grantsResolved = lastDenial.metadata.grantsResolved;
    if (typeof grantsResolved === "number") {
      meta.grantsResolved = grantsResolved;
      if (grantsResolved === 0) {
        meta.summary =
          "GrantSource returned zero grants for this context. Check GrantSource.load() filtering.";
      }
    }
  }

  // Extract cause for tool_unavailable
  if (code === "tool_unavailable" && lastDenial.metadata !== undefined) {
    const cause = lastDenial.metadata.cause;
    if (typeof cause === "string") {
      meta.cause = cause;
      switch (cause) {
        case "not_registered":
          meta.summary = "Tool is not registered on this kernel.";
          break;
        case "namespace_disabled":
          meta.summary = "Tool's namespace is disabled for this context.";
          break;
        case "not_offered":
          meta.summary = "Tool was not in the turn's permission-filtered catalogue.";
          break;
        case "no_matching_grant":
          meta.summary = "Tool exists but no grant makes it discoverable for this context.";
          gateOverride = "capability_grant";
          break;
        case "host_policy_denied":
          meta.summary = "Tool exists but host ceiling policy blocked discovery.";
          gateOverride = "product_ceiling";
          break;
        case "usage_store_unavailable":
          meta.summary = "Tool exists but the grant's usage store is not wired. Fail-closed.";
          gateOverride = "infrastructure";
          break;
        default:
          meta.summary = `Discovery check returned: ${cause}`;
      }
    }
  }

  // Extract failClosed for infrastructure denials
  if (INFRASTRUCTURE_DENIAL_REASONS.has(code) && lastDenial.metadata !== undefined) {
    const failClosed = lastDenial.metadata.failClosed;
    if (failClosed === true) {
      meta.failClosed = true;
      meta.summary =
        "This is a fail-closed infrastructure denial — SharedOS could not establish a fact and denied rather than widening.";
    }
    const missingDependency = lastDenial.metadata.missingDependency;
    if (typeof missingDependency === "string") {
      meta.missingDependency = missingDependency;
      meta.summary = `Missing wiring: ${missingDependency}. This is not a permission problem — it is a configuration problem.`;
    }
  }

  // Extract host ceiling info for host_policy_denied
  if (code === "host_policy_denied" && lastDenial.metadata !== undefined) {
    const grantId = lastDenial.metadata.grantedId;
    if (typeof grantId === "string") {
      meta.overriddenGrantId = grantId;
      meta.summary = `Grant ${grantId} was overridden by host ceiling policy.`;
    }
  }

  // Extract delegation chain detail
  if (code === "delegation_chain_invalid" && lastDenial.metadata !== undefined) {
    const delegation = lastDenial.metadata.delegation;
    if (typeof delegation === "object" && delegation !== null) {
      meta.delegation = delegation;
      const d = delegation as JsonObject;
      meta.summary = `Chain broke at link: ${String(d.grantId ?? "unknown")} — ${String(d.reason ?? "unknown")}`;
    }
  }

  // Extract source (kernel vs envelope)
  const source = lastDenial.metadata?.source;
  if (typeof source === "string") {
    meta.auditSource = source;
  }

  return {
    ...(Object.keys(meta).length > 0 ? { metadata: meta } : {}),
    ...(gateOverride !== undefined ? { gateOverride } : {}),
  };
}

// ============================================================
// Convenience: batch diagnose multiple results
// ============================================================

/**
 * Diagnose a batch of tool results and group by gate.
 * Useful for the demo: run 4 calls, show 4 different diagnoses.
 */
export function diagnoseBatch(
  results: readonly ToolResult[],
  auditEvents?: readonly AuditEvent[],
): Array<{ result: ToolResult; diagnosis: DenialDiagnosis }> {
  return results.map((result) => ({
    result,
    diagnosis: diagnoseDenial(result, auditEvents),
  }));
}
