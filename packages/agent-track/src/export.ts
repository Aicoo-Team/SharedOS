import type { AgentTrackRecord } from "./analyzer.js";

/**
 * Export an agent's track record as CSV.
 *
 * Returns a CSV string with one row per metric. Useful for spreadsheet
 * analysis or data pipeline ingestion.
 */
export function exportCSV(record: AgentTrackRecord): string {
  const lines: string[] = [];
  const s = record.summary;

  // Header
  lines.push("agentId,metric,value");

  // Summary metrics
  lines.push(`"${record.agentId}",window_from,"${record.window.from}"`);
  lines.push(`"${record.agentId}",window_to,"${record.window.to}"`);
  lines.push(`"${record.agentId}",totalTurns,${s.totalTurns}`);
  lines.push(`"${record.agentId}",totalToolCalls,${s.totalToolCalls}`);
  lines.push(`"${record.agentId}",authorizationRate,${s.authorizationRate}`);
  lines.push(`"${record.agentId}",escalationRate,${s.escalationRate}`);
  lines.push(`"${record.agentId}",edgeProbeScore,${s.edgeProbeScore}`);

  // Gate denials
  lines.push(`"${record.agentId}",denial_registration,${s.denialBreakdown.registration}`);
  lines.push(`"${record.agentId}",denial_capabilityGrant,${s.denialBreakdown.capabilityGrant}`);
  lines.push(`"${record.agentId}",denial_infrastructure,${s.denialBreakdown.infrastructure}`);
  lines.push(`"${record.agentId}",denial_productCeiling,${s.denialBreakdown.productCeiling}`);

  // Precedents
  const allowed = record.precedents.filter((p) => p.outcome === "allowed").length;
  const denied = record.precedents.filter((p) => p.outcome === "denied").length;
  lines.push(`"${record.agentId}",precedents_allowed,${allowed}`);
  lines.push(`"${record.agentId}",precedents_denied,${denied}`);

  return lines.join("\n") + "\n";
}

/**
 * Export multiple agents' track records as a single CSV with a header row
 * and one row per agent.
 */
export function exportCSVComparison(records: readonly AgentTrackRecord[]): string {
  const lines: string[] = [];

  lines.push(
    "agentId,totalTurns,totalToolCalls,authorizationRate,escalationRate,edgeProbeScore," +
      "denial_registration,denial_capabilityGrant,denial_infrastructure,denial_productCeiling," +
      "precedents_allowed,precedents_denied",
  );

  for (const record of records) {
    const s = record.summary;
    const allowed = record.precedents.filter((p) => p.outcome === "allowed").length;
    const denied = record.precedents.filter((p) => p.outcome === "denied").length;

    lines.push(
      [
        `"${record.agentId}"`,
        s.totalTurns,
        s.totalToolCalls,
        s.authorizationRate,
        s.escalationRate,
        s.edgeProbeScore,
        s.denialBreakdown.registration,
        s.denialBreakdown.capabilityGrant,
        s.denialBreakdown.infrastructure,
        s.denialBreakdown.productCeiling,
        allowed,
        denied,
      ].join(","),
    );
  }

  return lines.join("\n") + "\n";
}

/**
 * Export an agent's track record as Prometheus exposition format.
 *
 * Metrics follow the naming convention `sharedos_agent_track_<metric>`.
 * Labels include `agent_id`.
 *
 * @see https://prometheus.io/docs/instrumenting/exposition_formats/
 */
export function exportPrometheus(record: AgentTrackRecord): string {
  const s = record.summary;
  const id = record.agentId;
  const lines: string[] = [];

  lines.push("# HELP sharedos_agent_track_authorization_rate Authorization rate (allowed / total)");
  lines.push("# TYPE sharedos_agent_track_authorization_rate gauge");
  lines.push(`sharedos_agent_track_authorization_rate{agent_id="${id}"} ${s.authorizationRate}`);

  lines.push(
    "# HELP sharedos_agent_track_escalation_rate Escalation rate (escalations / totalTurns)",
  );
  lines.push("# TYPE sharedos_agent_track_escalation_rate gauge");
  lines.push(`sharedos_agent_track_escalation_rate{agent_id="${id}"} ${s.escalationRate}`);

  lines.push("# HELP sharedos_agent_track_edge_probe_score Edge-probe score (0-1)");
  lines.push("# TYPE sharedos_agent_track_edge_probe_score gauge");
  lines.push(`sharedos_agent_track_edge_probe_score{agent_id="${id}"} ${s.edgeProbeScore}`);

  lines.push("# HELP sharedos_agent_track_total_turns Total number of turns");
  lines.push("# TYPE sharedos_agent_track_total_turns gauge");
  lines.push(`sharedos_agent_track_total_turns{agent_id="${id}"} ${s.totalTurns}`);

  lines.push("# HELP sharedos_agent_track_total_tool_calls Total tool calls");
  lines.push("# TYPE sharedos_agent_track_total_tool_calls gauge");
  lines.push(`sharedos_agent_track_total_tool_calls{agent_id="${id}"} ${s.totalToolCalls}`);

  lines.push("# HELP sharedos_agent_track_denials_total Total denials by gate");
  lines.push("# TYPE sharedos_agent_track_denials_total gauge");
  lines.push(
    `sharedos_agent_track_denials_total{agent_id="${id}",gate="registration"} ${s.denialBreakdown.registration}`,
  );
  lines.push(
    `sharedos_agent_track_denials_total{agent_id="${id}",gate="capabilityGrant"} ${s.denialBreakdown.capabilityGrant}`,
  );
  lines.push(
    `sharedos_agent_track_denials_total{agent_id="${id}",gate="infrastructure"} ${s.denialBreakdown.infrastructure}`,
  );
  lines.push(
    `sharedos_agent_track_denials_total{agent_id="${id}",gate="productCeiling"} ${s.denialBreakdown.productCeiling}`,
  );

  const pAllowed = record.precedents.filter((p) => p.outcome === "allowed").length;
  const pDenied = record.precedents.filter((p) => p.outcome === "denied").length;

  lines.push("# HELP sharedos_agent_track_precedents_total Total precedents by outcome");
  lines.push("# TYPE sharedos_agent_track_precedents_total gauge");
  lines.push(
    `sharedos_agent_track_precedents_total{agent_id="${id}",outcome="allowed"} ${pAllowed}`,
  );
  lines.push(`sharedos_agent_track_precedents_total{agent_id="${id}",outcome="denied"} ${pDenied}`);

  return lines.join("\n") + "\n";
}

/**
 * Export multiple agents' track records as Prometheus text.
 */
export function exportPrometheusMulti(records: readonly AgentTrackRecord[]): string {
  return records.map(exportPrometheus).join("\n");
}
