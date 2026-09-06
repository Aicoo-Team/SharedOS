import type { AgentTrackRecord } from "./analyzer.js";

/**
 * A single alert triggered when a metric crosses a threshold.
 */
export interface TrackRecordAlert {
  readonly agentId: string;
  readonly severity: "info" | "warning" | "critical";
  readonly metric: string;
  readonly value: number;
  readonly threshold: number;
  readonly message: string;
}

/**
 * Configurable thresholds for triggering alerts.
 *
 * All fields are optional. Only configured thresholds produce alerts.
 */
export interface AlertThresholds {
  /** Minimum edge-probe score to trigger an alert (0–1). */
  readonly minEdgeProbeScore?: number;
  /** Maximum authorization rate before alerting (0–1). */
  readonly maxAuthorizationRate?: number;
  /** Minimum escalation rate to trigger an alert (0–1). */
  readonly minEscalationRate?: number;
  /** Maximum registration denials (tool not found / namespace disabled). */
  readonly maxRegistrationDenials?: number;
  /** Maximum capability grant denials. */
  readonly maxCapabilityGrantDenials?: number;
  /** Maximum total denials across all gates. */
  readonly maxTotalDenials?: number;
}

const DEFAULT_SEVERITY: Record<string, "info" | "warning" | "critical"> = {
  minEdgeProbeScore: "warning",
  maxAuthorizationRate: "warning",
  minEscalationRate: "info",
  maxRegistrationDenials: "warning",
  maxCapabilityGrantDenials: "warning",
  maxTotalDenials: "critical",
};

/**
 * Check an agent's track record against configurable thresholds.
 *
 * Returns an array of alerts for every threshold that was breached.
 * An empty array means the agent is within all configured bounds.
 *
 * @param record - The agent's track record.
 * @param thresholds - Configurable thresholds.
 */
export function checkAlerts(
  record: AgentTrackRecord,
  thresholds: AlertThresholds,
): readonly TrackRecordAlert[] {
  const alerts: TrackRecordAlert[] = [];
  const s = record.summary;

  if (
    thresholds.minEdgeProbeScore !== undefined &&
    s.edgeProbeScore >= thresholds.minEdgeProbeScore
  ) {
    alerts.push({
      agentId: record.agentId,
      severity: DEFAULT_SEVERITY.minEdgeProbeScore!,
      metric: "edgeProbeScore",
      value: s.edgeProbeScore,
      threshold: thresholds.minEdgeProbeScore,
      message: `Edge-probe score ${s.edgeProbeScore.toFixed(2)} exceeds threshold ${thresholds.minEdgeProbeScore.toFixed(2)}`,
    });
  }

  if (
    thresholds.maxAuthorizationRate !== undefined &&
    s.authorizationRate <= thresholds.maxAuthorizationRate
  ) {
    alerts.push({
      agentId: record.agentId,
      severity: DEFAULT_SEVERITY.maxAuthorizationRate!,
      metric: "authorizationRate",
      value: s.authorizationRate,
      threshold: thresholds.maxAuthorizationRate,
      message: `Authorization rate ${(s.authorizationRate * 100).toFixed(1)}% is below threshold ${(thresholds.maxAuthorizationRate * 100).toFixed(1)}%`,
    });
  }

  if (
    thresholds.minEscalationRate !== undefined &&
    s.escalationRate >= thresholds.minEscalationRate
  ) {
    alerts.push({
      agentId: record.agentId,
      severity: DEFAULT_SEVERITY.minEscalationRate!,
      metric: "escalationRate",
      value: s.escalationRate,
      threshold: thresholds.minEscalationRate,
      message: `Escalation rate ${(s.escalationRate * 100).toFixed(1)}% exceeds threshold ${(thresholds.minEscalationRate * 100).toFixed(1)}%`,
    });
  }

  if (
    thresholds.maxRegistrationDenials !== undefined &&
    s.denialBreakdown.registration >= thresholds.maxRegistrationDenials
  ) {
    alerts.push({
      agentId: record.agentId,
      severity: DEFAULT_SEVERITY.maxRegistrationDenials!,
      metric: "registrationDenials",
      value: s.denialBreakdown.registration,
      threshold: thresholds.maxRegistrationDenials,
      message: `${s.denialBreakdown.registration} registration denials exceeds threshold ${thresholds.maxRegistrationDenials}`,
    });
  }

  if (
    thresholds.maxCapabilityGrantDenials !== undefined &&
    s.denialBreakdown.capabilityGrant >= thresholds.maxCapabilityGrantDenials
  ) {
    alerts.push({
      agentId: record.agentId,
      severity: DEFAULT_SEVERITY.maxCapabilityGrantDenials!,
      metric: "capabilityGrantDenials",
      value: s.denialBreakdown.capabilityGrant,
      threshold: thresholds.maxCapabilityGrantDenials,
      message: `${s.denialBreakdown.capabilityGrant} capability grant denials exceeds threshold ${thresholds.maxCapabilityGrantDenials}`,
    });
  }

  const totalDenials =
    s.denialBreakdown.registration +
    s.denialBreakdown.capabilityGrant +
    s.denialBreakdown.infrastructure +
    s.denialBreakdown.productCeiling;

  if (thresholds.maxTotalDenials !== undefined && totalDenials >= thresholds.maxTotalDenials) {
    alerts.push({
      agentId: record.agentId,
      severity: DEFAULT_SEVERITY.maxTotalDenials!,
      metric: "totalDenials",
      value: totalDenials,
      threshold: thresholds.maxTotalDenials,
      message: `${totalDenials} total denials exceeds threshold ${thresholds.maxTotalDenials}`,
    });
  }

  return alerts;
}

/**
 * Convenience: check alerts and return only critical ones.
 */
export function criticalAlerts(
  record: AgentTrackRecord,
  thresholds: AlertThresholds,
): readonly TrackRecordAlert[] {
  return checkAlerts(record, thresholds).filter((a) => a.severity === "critical");
}

/**
 * Convenience: check alerts and return only warning-level ones.
 */
export function warningAlerts(
  record: AgentTrackRecord,
  thresholds: AlertThresholds,
): readonly TrackRecordAlert[] {
  return checkAlerts(record, thresholds).filter((a) => a.severity === "warning");
}
