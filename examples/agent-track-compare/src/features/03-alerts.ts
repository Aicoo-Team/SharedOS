/**
 * Threshold Alerts
 *
 * Configurable thresholds that flag agents crossing boundaries.
 */

import type { AuditEvent } from "@aicoo/sharedos-core";
import {
  checkAlerts,
  criticalAlerts,
  createTrackRecordStore,
  addEvent,
  addTurnRecord,
  analyzeTrackRecord,
  type TurnRecord,
} from "@aicoo/sharedos-agent-track";

function makeEvent(tool: string, outcome: string, reason?: string): AuditEvent {
  return {
    version: "1",
    type: "authorization.checked",
    outcome: outcome as AuditEvent["outcome"],
    at: "2025-01-01T00:00:00Z",
    traceId: "t",
    namespaceId: "ns",
    actor: { kind: "agent", agentId: "risky-agent" },
    authority: { kind: "human", userId: "owner" },
    owner: { kind: "human", userId: "owner" },
    purpose: "demo",
    tool,
    action: "use",
    ...(reason !== undefined ? { reason } : {}),
  } as AuditEvent;
}

const store = createTrackRecordStore();

// 8 denials, 2 allowed — a risky agent
addEvent(store, makeEvent("files.delete", "denied", "no_matching_grant"));
addEvent(store, makeEvent("files.delete", "denied", "no_matching_grant"));
addEvent(store, makeEvent("files.delete", "denied", "no_matching_grant"));
addEvent(store, makeEvent("files.write", "denied", "no_matching_grant"));
addEvent(store, makeEvent("files.write", "denied", "no_matching_grant"));
addEvent(store, makeEvent("admin.users", "denied", "tool_unavailable"));
addEvent(store, makeEvent("files.search", "allowed"));
addEvent(store, makeEvent("files.search", "allowed"));

addTurnRecord(store, {
  turnId: "t1",
  agentId: "risky-agent",
  startedAt: "2025-01-01T00:00:00Z",
  completedAt: "2025-01-01T00:00:01Z",
  outcome: "escalate",
  toolCalls: 8,
  denials: 6,
  escalations: 1,
} satisfies TurnRecord);

const record = analyzeTrackRecord(store, "risky-agent");

console.log("  THRESHOLD ALERTS");
console.log("  " + "-".repeat(50));

const alerts = checkAlerts(record, {
  minEdgeProbeScore: 0.3,
  maxAuthorizationRate: 0.5,
  minEscalationRate: 0.1,
  maxTotalDenials: 5,
});

for (const a of alerts) {
  const tag = a.severity === "critical" ? "[!]" : a.severity === "warning" ? "[~]" : "[i]";
  console.log(`  ${tag} ${a.message}`);
}
console.log();

const critical = criticalAlerts(record, {
  maxTotalDenials: 3,
});
console.log(`  Critical alerts: ${critical.length}`);
for (const a of critical) {
  console.log(`    ${a.message}`);
}
console.log();
