import type { AuditEvent } from "@aicoo/sharedos-core";

import type { TrackRecordStore, TurnRecord } from "./collector.js";

/**
 * The four gate categories in the SharedOS authorization pipeline.
 *
 * Each maps to a set of audit event reason codes. The classification is
 * derived, not declared: the analyzer reads `reason` metadata on denied
 * audit events and maps it to a gate.
 */
export interface GateDenialBreakdown {
  /** Tool not found in registry or namespace disabled. */
  readonly registration: number;
  /** No matching grant, grant exhausted, or grant rejected (issuer/subject/namespace/window/purpose/verifier/capability/delegation). */
  readonly capabilityGrant: number;
  /** Infrastructure unavailable: usageStore, delegationResolver, authority. */
  readonly infrastructure: number;
  /** Host policy ceiling denied. */
  readonly productCeiling: number;
}

/**
 * A precedent entry: a past authorization decision for this agent.
 *
 * Derived from `authorization.checked` audit events. Each entry records
 * what the agent tried, whether it was allowed, and the reason code.
 */
export interface PrecedentEntry {
  readonly tool: string;
  readonly action: string;
  readonly outcome: "allowed" | "denied";
  readonly reasonCode: string;
  readonly at: string;
  readonly grantId?: string;
}

/**
 * Summary of a single turn from the agent's perspective.
 */
export interface TurnSummary {
  readonly turnId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly outcome: "complete" | "fail" | "escalate";
  readonly toolCalls: number;
  readonly denials: number;
  readonly escalations: number;
}

/**
 * Computed summary metrics for an agent's track record.
 */
export interface TrackRecordSummary {
  readonly totalTurns: number;
  readonly totalToolCalls: number;
  /** allowed / (allowed + denied) across all authorization-checked events. */
  readonly authorizationRate: number;
  /** escalations / totalTurns. */
  readonly escalationRate: number;
  /** Breakdown of denials by the gate that refused. */
  readonly denialBreakdown: GateDenialBreakdown;
  /**
   * 0.0–1.0 score measuring how much the agent tests boundaries.
   *
   * Computed from three signals:
   * - Denial ratio: denials / total authorization attempts
   * - Retry-after-denial: repeated attempts at the same tool after denial
   * - Escalation rate: asking for more authority than granted
   *
   * A well-behaved agent scores near 0. An agent that constantly probes
   * the fence scores near 1.
   */
  readonly edgeProbeScore: number;
}

/**
 * An agent's complete track record, built entirely from kernel-recorded facts.
 *
 * Not one line of this is self-reported. Every field is derived from audit
 * events the kernel wrote.
 */
export interface AgentTrackRecord {
  readonly agentId: string;
  readonly window: { readonly from: string; readonly to: string };
  readonly summary: TrackRecordSummary;
  readonly precedents: readonly PrecedentEntry[];
  readonly turns: readonly TurnSummary[];
}

/**
 * Analyze a track record store and produce a full {@link AgentTrackRecord}
 * for one agent.
 *
 * @param store - The indexed audit events and turn records.
 * @param agentId - The agent to analyze.
 * @param options - Optional time window filter.
 */
export function analyzeTrackRecord(
  store: TrackRecordStore,
  agentId: string,
  options?: { readonly from?: string; readonly to?: string },
): AgentTrackRecord {
  const events = filterByTimeWindow(store.events.get(agentId) ?? [], options);
  const turns = store.turns.get(agentId) ?? [];

  const authEvents = events.filter((e) => e.type === "authorization.checked");
  const precedents = buildPrecedents(authEvents, events);
  const denialBreakdown = classifyDenials(authEvents);
  const summary = computeSummary(authEvents, turns, denialBreakdown);
  const turnSummaries = summarizeTurns(turns);

  const from = events.length > 0 ? events[0]!.at : new Date().toISOString();
  const to = events.length > 0 ? events[events.length - 1]!.at : new Date().toISOString();

  return {
    agentId,
    window: { from: options?.from ?? from, to: options?.to ?? to },
    summary,
    precedents,
    turns: turnSummaries,
  };
}

function filterByTimeWindow(
  events: readonly AuditEvent[],
  options?: { readonly from?: string; readonly to?: string },
): readonly AuditEvent[] {
  if (options?.from === undefined && options?.to === undefined) {
    return events;
  }

  return events.filter((event) => {
    if (options?.from !== undefined && event.at < options.from) {
      return false;
    }
    if (options?.to !== undefined && event.at > options.to) {
      return false;
    }
    return true;
  });
}

function buildPrecedents(
  authEvents: readonly AuditEvent[],
  allEvents: readonly AuditEvent[],
): readonly PrecedentEntry[] {
  // Build a map from resource+action to tool name using tool.invoked events.
  // The kernel sets `tool` on tool.invoked but not on authorization.checked.
  const toolByResourceAction = new Map<string, string>();
  for (const event of allEvents) {
    if (event.type === "tool.invoked" && event.tool !== undefined && event.resource !== undefined) {
      const key = `${event.resource.namespace}:${event.resource.path.join("/")}:${event.action ?? ""}`;
      toolByResourceAction.set(key, event.tool);
    }
  }

  return authEvents.map((event) => {
    // Try to get tool name from the event, or look it up via resource+action
    let toolName = event.tool;
    if (toolName === undefined && event.resource !== undefined) {
      const key = `${event.resource.namespace}:${event.resource.path.join("/")}:${event.action ?? ""}`;
      toolName = toolByResourceAction.get(key);
    }

    const base = {
      tool: toolName ?? event.resource?.path?.[0] ?? "unknown",
      action: event.action ?? "unknown",
      outcome: event.outcome === "allowed" ? ("allowed" as const) : ("denied" as const),
      reasonCode: event.reason ?? "unknown",
      at: event.at,
    };
    if (event.grantId !== undefined) {
      return { ...base, grantId: event.grantId };
    }
    return base;
  });
}

function classifyDenials(authEvents: readonly AuditEvent[]): GateDenialBreakdown {
  let registration = 0;
  let capabilityGrant = 0;
  let infrastructure = 0;
  let productCeiling = 0;

  for (const event of authEvents) {
    if (event.outcome !== "denied") {
      continue;
    }

    const reason = event.reason ?? "";
    const category = classifyDenial(reason);

    switch (category) {
      case "registration":
        registration += 1;
        break;
      case "capabilityGrant":
        capabilityGrant += 1;
        break;
      case "infrastructure":
        infrastructure += 1;
        break;
      case "productCeiling":
        productCeiling += 1;
        break;
    }
  }

  return { registration, capabilityGrant, infrastructure, productCeiling };
}

type DenialCategory = "registration" | "capabilityGrant" | "infrastructure" | "productCeiling";

function classifyDenial(reason: string): DenialCategory {
  if (
    reason.includes("tool_unavailable") ||
    reason.includes("namespace_disabled") ||
    reason.includes("not_registered")
  ) {
    return "registration";
  }

  if (reason.includes("host_policy_denied") || reason.includes("host_policy_unavailable")) {
    return "productCeiling";
  }

  if (
    reason.includes("usage_store_unavailable") ||
    reason.includes("authority_unavailable") ||
    reason.includes("delegation_chain") ||
    reason.includes("infrastructure")
  ) {
    return "infrastructure";
  }

  // Everything else is a capability grant denial:
  // no_matching_grant, grant_exhausted, invalid_context, invalid_request,
  // issuer, subject, namespace, window, purpose, verifier, capability,
  // delegation, exhausted
  return "capabilityGrant";
}

function computeSummary(
  authEvents: readonly AuditEvent[],
  turns: readonly TurnRecord[],
  denialBreakdown: GateDenialBreakdown,
): TrackRecordSummary {
  const allowed = authEvents.filter((e) => e.outcome === "allowed").length;
  const denied = authEvents.filter((e) => e.outcome === "denied").length;
  const totalAuthAttempts = allowed + denied;

  const totalDenials =
    denialBreakdown.registration +
    denialBreakdown.capabilityGrant +
    denialBreakdown.infrastructure +
    denialBreakdown.productCeiling;

  const totalToolCalls = turns.reduce((sum, t) => sum + t.toolCalls, 0);
  const totalEscalations = turns.reduce((sum, t) => sum + t.escalations, 0);
  const totalTurns = turns.length;

  const authorizationRate = totalAuthAttempts > 0 ? allowed / totalAuthAttempts : 1;
  const escalationRate = totalTurns > 0 ? totalEscalations / totalTurns : 0;

  const edgeProbeScore = computeEdgeProbeScore(authEvents, turns, totalAuthAttempts, totalDenials);

  return {
    totalTurns,
    totalToolCalls,
    authorizationRate,
    escalationRate,
    denialBreakdown,
    edgeProbeScore,
  };
}

/**
 * Compute the edge-probing score.
 *
 * Three signals, each normalized to [0, 1], combined with weights:
 * - 50% denial ratio (denials / total auth attempts)
 * - 30% retry-after-denial (repeated attempts at same tool after denial)
 * - 20% escalation rate (escalations / total turns)
 */
function computeEdgeProbeScore(
  authEvents: readonly AuditEvent[],
  turns: readonly TurnRecord[],
  totalAuthAttempts: number,
  totalDenials: number,
): number {
  // Signal 1: Denial ratio
  const denialRatio = totalAuthAttempts > 0 ? totalDenials / totalAuthAttempts : 0;

  // Signal 2: Retry-after-denial
  const retryScore = computeRetryScore(authEvents);

  // Signal 3: Escalation rate
  const totalTurns = turns.length;
  const totalEscalations = turns.reduce((sum, t) => sum + t.escalations, 0);
  const escalationRate = totalTurns > 0 ? totalEscalations / totalTurns : 0;

  // Weighted combination
  const raw = denialRatio * 0.5 + retryScore * 0.3 + escalationRate * 0.2;
  return Math.min(1, Math.max(0, raw));
}

/**
 * Detect retry-after-denial patterns.
 *
 * For each denied tool call, check if the agent attempted the same tool
 * again afterward. The score is retries / denied_attempts, capped at 1.
 */
function computeRetryScore(authEvents: readonly AuditEvent[]): number {
  const deniedAttempts: Array<{ tool: string; at: string }> = [];
  const allAttempts: Array<{ tool: string; at: string }> = [];

  for (const event of authEvents) {
    if (event.tool === undefined) {
      continue;
    }
    allAttempts.push({ tool: event.tool, at: event.at });
    if (event.outcome === "denied") {
      deniedAttempts.push({ tool: event.tool, at: event.at });
    }
  }

  if (deniedAttempts.length === 0) {
    return 0;
  }

  let retries = 0;
  for (const denied of deniedAttempts) {
    const laterAttempt = allAttempts.some((a) => a.tool === denied.tool && a.at > denied.at);
    if (laterAttempt) {
      retries += 1;
    }
  }

  return Math.min(1, retries / deniedAttempts.length);
}

function summarizeTurns(turns: readonly TurnRecord[]): readonly TurnSummary[] {
  return turns.map((t) => ({
    turnId: t.turnId,
    startedAt: t.startedAt,
    completedAt: t.completedAt,
    outcome: t.outcome,
    toolCalls: t.toolCalls,
    denials: t.denials,
    escalations: t.escalations,
  }));
}
