import type { AuditEvent } from "@aicoo/sharedos-core";

import { analyzeTrackRecord, type AgentTrackRecord, type TrackRecordSummary } from "./analyzer.js";
import type { TrackRecordStore, TurnRecord } from "./collector.js";

/**
 * A named time window with a label and bounds.
 */
export interface TimeWindow {
  readonly label: string;
  readonly from: string;
  readonly to: string;
}

/**
 * Track record snapshot for one time window.
 */
export interface WindowedRecord {
  readonly window: TimeWindow;
  readonly summary: TrackRecordSummary;
  readonly eventCount: number;
  readonly turnCount: number;
}

/**
 * Rolling window aggregation for an agent's track record.
 *
 * Computes metrics over multiple time windows to show trends instead of
 * only point-in-time snapshots.
 */
export interface WindowedTrackRecord {
  readonly agentId: string;
  readonly windows: readonly WindowedRecord[];
  readonly latest: AgentTrackRecord;
}

/**
 * Predefined rolling windows relative to a reference time.
 */
export const ROLLING_WINDOWS: readonly TimeWindow[] = [
  { label: "1h", from: "", to: "" }, // filled at call time
  { label: "24h", from: "", to: "" },
  { label: "7d", from: "", to: "" },
  { label: "30d", from: "", to: "" },
  { label: "all", from: "", to: "" },
];

/**
 * Compute rolling window track records for an agent.
 *
 * @param store - The indexed audit events and turn records.
 * @param agentId - The agent to analyze.
 * @param referenceTime - The "now" to compute windows from (ISO 8601).
 * @param overrides - Optional custom windows. Defaults to 1h / 24h / 7d / 30d / all.
 */
export function computeWindowedTrackRecord(
  store: TrackRecordStore,
  agentId: string,
  referenceTime: string,
  overrides?: readonly TimeWindow[],
): WindowedTrackRecord {
  const windows = (overrides ?? ROLLING_WINDOWS).map((w) => ({
    ...w,
    from: computeFrom(referenceTime, w.label),
    to: referenceTime,
  }));

  const windowedRecords = windows.map((window) => {
    const events = filterEvents(store.events.get(agentId) ?? [], window.from, window.to);
    const turns = filterTurns(store.turns.get(agentId) ?? [], window.from, window.to);

    const authEvents = events.filter((e) => e.type === "authorization.checked");
    const allowed = authEvents.filter((e) => e.outcome === "allowed").length;
    const denied = authEvents.filter((e) => e.outcome === "denied").length;
    const totalAuth = allowed + denied;

    const totalDenials = turns.reduce((sum, t) => sum + t.denials, 0);
    const totalToolCalls = turns.reduce((sum, t) => sum + t.toolCalls, 0);
    const totalEscalations = turns.reduce((sum, t) => sum + t.escalations, 0);

    // Compute denial breakdown for this window
    let registration = 0;
    let capabilityGrant = 0;
    let infrastructure = 0;
    let productCeiling = 0;
    for (const event of authEvents) {
      if (event.outcome !== "denied") continue;
      const cat = classifyDenialSimple(event.reason ?? "");
      if (cat === "registration") registration++;
      else if (cat === "productCeiling") productCeiling++;
      else if (cat === "infrastructure") infrastructure++;
      else capabilityGrant++;
    }

    // Compute edge probe score
    const denialRatio = totalAuth > 0 ? totalDenials / totalAuth : 0;
    const escRate = turns.length > 0 ? totalEscalations / turns.length : 0;
    const edgeProbeScore = Math.min(1, denialRatio * 0.5 + escRate * 0.2);

    const summary: TrackRecordSummary = {
      totalTurns: turns.length,
      totalToolCalls,
      authorizationRate: totalAuth > 0 ? allowed / totalAuth : 1,
      escalationRate: turns.length > 0 ? totalEscalations / turns.length : 0,
      denialBreakdown: { registration, capabilityGrant, infrastructure, productCeiling },
      edgeProbeScore,
    };

    return {
      window,
      summary,
      eventCount: events.length,
      turnCount: turns.length,
    };
  });

  const latest = analyzeTrackRecord(store, agentId);

  return { agentId, windows: windowedRecords, latest };
}

function computeFrom(referenceTime: string, label: string): string {
  const ref = new Date(referenceTime).getTime();
  const ms = parseDuration(label);
  return new Date(ref - ms).toISOString();
}

function parseDuration(label: string): number {
  const match = /^(\d+)(m|h|d)$/.exec(label);
  if (match === null) {
    return 0; // "all" or unparseable
  }
  const n = parseInt(match[1]!, 10);
  const unit = match[2]!;
  switch (unit) {
    case "m":
      return n * 60_000;
    case "h":
      return n * 3_600_000;
    case "d":
      return n * 86_400_000;
    default:
      return 0;
  }
}

function filterEvents(
  events: readonly AuditEvent[],
  from: string,
  to: string,
): readonly AuditEvent[] {
  return events.filter((e) => e.at >= from && e.at <= to);
}

function filterTurns(
  turns: readonly TurnRecord[],
  from: string,
  to: string,
): readonly TurnRecord[] {
  return turns.filter((t) => t.startedAt >= from && t.completedAt <= to);
}

function classifyDenialSimple(
  reason: string,
): "registration" | "productCeiling" | "infrastructure" | "capabilityGrant" {
  if (reason.includes("tool_unavailable") || reason.includes("namespace_disabled")) {
    return "registration";
  }
  if (reason.includes("host_policy_denied") || reason.includes("host_policy_unavailable")) {
    return "productCeiling";
  }
  if (
    reason.includes("usage_store_unavailable") ||
    reason.includes("authority_unavailable") ||
    reason.includes("delegation_chain")
  ) {
    return "infrastructure";
  }
  return "capabilityGrant";
}
