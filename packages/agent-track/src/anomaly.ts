import type { AuditEvent } from "@aicoo/sharedos-core";

import type { TrackRecordStore, TurnRecord } from "./collector.js";

/**
 * A detected anomaly in an agent's behavior.
 */
export interface Anomaly {
  readonly agentId: string;
  readonly type: "spike_denials" | "new_tool_pattern" | "escalation_surge" | "unusual_timing";
  readonly severity: "low" | "medium" | "high";
  readonly description: string;
  readonly detectedAt: string;
  readonly evidence: {
    readonly current: number;
    readonly baseline: number;
    readonly deviation: number;
  };
}

/**
 * Configuration for anomaly detection sensitivity.
 */
export interface AnomalyConfig {
  /** Number of historical events to use as baseline window. */
  readonly baselineWindow?: number;
  /** Number of standard deviations to trigger an alert. */
  readonly sensitivity?: number;
  /** Minimum events before detection is meaningful. */
  readonly minEvents?: number;
}

const DEFAULT_CONFIG: Required<AnomalyConfig> = {
  baselineWindow: 50,
  sensitivity: 2.0,
  minEvents: 10,
};

/**
 * Detect anomalies in an agent's behavior by comparing recent events
 * against a baseline.
 *
 * Uses simple statistical deviation: if a metric deviates from the
 * rolling mean by more than `sensitivity` standard deviations, it
 * is flagged as an anomaly.
 *
 * @param store - The track record store.
 * @param agentId - The agent to analyze.
 * @param config - Detection sensitivity configuration.
 */
export function detectAnomalies(
  store: TrackRecordStore,
  agentId: string,
  config?: AnomalyConfig,
): readonly Anomaly[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const events = store.events.get(agentId) ?? [];
  const turns = store.turns.get(agentId) ?? [];

  if (events.length < cfg.minEvents) {
    return [];
  }

  const anomalies: Anomaly[] = [];

  // Split into baseline (older) and recent
  const midpoint = Math.floor(events.length * 0.7);
  const baselineEvents = events.slice(0, midpoint);
  const recentEvents = events.slice(midpoint);

  const baselineAuth = baselineEvents.filter((e) => e.type === "authorization.checked");
  const recentAuth = recentEvents.filter((e) => e.type === "authorization.checked");

  // Check 1: Denial spike
  const denialAnomaly = checkDenialSpike(baselineAuth, recentAuth, agentId, cfg.sensitivity);
  if (denialAnomaly !== undefined) anomalies.push(denialAnomaly);

  // Check 2: New tool pattern
  const toolAnomaly = checkNewToolPattern(baselineAuth, recentAuth, agentId);
  if (toolAnomaly !== undefined) anomalies.push(toolAnomaly);

  // Check 3: Escalation surge
  const escalationAnomaly = checkEscalationSurge(turns, agentId, cfg.sensitivity);
  if (escalationAnomaly !== undefined) anomalies.push(escalationAnomaly);

  // Check 4: Unusual timing
  const timingAnomaly = checkUnusualTiming(baselineAuth, recentAuth, agentId, cfg.sensitivity);
  if (timingAnomaly !== undefined) anomalies.push(timingAnomaly);

  return anomalies;
}

function checkDenialSpike(
  baseline: readonly AuditEvent[],
  recent: readonly AuditEvent[],
  agentId: string,
  sensitivity: number,
): Anomaly | undefined {
  const baseRate = computeDenialRate(baseline);
  const recentRate = computeDenialRate(recent);

  if (recentRate <= baseRate + sensitivity * 0.1) return undefined;

  return {
    agentId,
    type: "spike_denials",
    severity: recentRate > 0.8 ? "high" : recentRate > 0.5 ? "medium" : "low",
    description: `Denial rate spiked from ${(baseRate * 100).toFixed(1)}% to ${(recentRate * 100).toFixed(1)}%`,
    detectedAt: new Date().toISOString(),
    evidence: { current: recentRate, baseline: baseRate, deviation: recentRate - baseRate },
  };
}

function checkNewToolPattern(
  baseline: readonly AuditEvent[],
  recent: readonly AuditEvent[],
  agentId: string,
): Anomaly | undefined {
  const baselineTools = new Set(baseline.filter((e) => e.tool !== undefined).map((e) => e.tool));
  const recentTools = new Set(recent.filter((e) => e.tool !== undefined).map((e) => e.tool));

  const newTools = [...recentTools].filter((t) => !baselineTools.has(t));

  if (newTools.length === 0) return undefined;

  // Check if new tools are being denied
  const newToolDenials = recent.filter(
    (e) => newTools.includes(e.tool ?? "") && e.outcome === "denied",
  );

  if (newToolDenials.length === 0) return undefined;

  return {
    agentId,
    type: "new_tool_pattern",
    severity: "medium",
    description: `Agent attempting new tools: ${newTools.join(", ")}`,
    detectedAt: new Date().toISOString(),
    evidence: {
      current: newTools.length,
      baseline: baselineTools.size,
      deviation: newTools.length,
    },
  };
}

function checkEscalationSurge(
  turns: readonly TurnRecord[],
  agentId: string,
  sensitivity: number,
): Anomaly | undefined {
  if (turns.length < 4) return undefined;

  const midpoint = Math.floor(turns.length * 0.7);
  const baselineTurns = turns.slice(0, midpoint);
  const recentTurns = turns.slice(midpoint);

  const baseRate =
    baselineTurns.filter((t) => t.outcome === "escalate").length / baselineTurns.length;
  const recentRate =
    recentTurns.filter((t) => t.outcome === "escalate").length / recentTurns.length;

  if (recentRate <= baseRate + sensitivity * 0.15) return undefined;

  return {
    agentId,
    type: "escalation_surge",
    severity: recentRate > 0.8 ? "high" : "medium",
    description: `Escalation rate surged from ${(baseRate * 100).toFixed(1)}% to ${(recentRate * 100).toFixed(1)}%`,
    detectedAt: new Date().toISOString(),
    evidence: { current: recentRate, baseline: baseRate, deviation: recentRate - baseRate },
  };
}

function checkUnusualTiming(
  baseline: readonly AuditEvent[],
  recent: readonly AuditEvent[],
  agentId: string,
  sensitivity: number,
): Anomaly | undefined {
  const baseInterval = computeAvgInterval(baseline);
  const recentInterval = computeAvgInterval(recent);

  if (baseInterval === 0 || recentInterval === 0) return undefined;

  // Unusual if requests are much faster (lower interval)
  const ratio = recentInterval / baseInterval;
  if (ratio > 1 / sensitivity) return undefined;

  return {
    agentId,
    type: "unusual_timing",
    severity: ratio < 0.3 ? "high" : "medium",
    description: `Event timing accelerated from ${(baseInterval / 1000).toFixed(1)}s to ${(recentInterval / 1000).toFixed(1)}s average`,
    detectedAt: new Date().toISOString(),
    evidence: {
      current: recentInterval,
      baseline: baseInterval,
      deviation: baseInterval - recentInterval,
    },
  };
}

function computeDenialRate(events: readonly AuditEvent[]): number {
  const authEvents = events.filter((e) => e.type === "authorization.checked");
  if (authEvents.length === 0) return 0;
  const denied = authEvents.filter((e) => e.outcome === "denied").length;
  return denied / authEvents.length;
}

function computeAvgInterval(events: readonly AuditEvent[]): number {
  if (events.length < 2) return 0;
  let totalMs = 0;
  for (let i = 1; i < events.length; i++) {
    const prev = new Date(events[i - 1]!.at).getTime();
    const curr = new Date(events[i]!.at).getTime();
    totalMs += curr - prev;
  }
  return totalMs / (events.length - 1);
}
