/**
 * Anomaly Detection
 *
 * Detects behavioral deviations using statistical analysis.
 */

import type { AuditEvent } from "@aicoo/sharedos-core";
import {
  detectAnomalies,
  createTrackRecordStore,
  addEvent,
  addTurnRecord,
  type TurnRecord,
} from "@aicoo/sharedos-agent-track";

function makeEvent(tool: string, outcome: string, at: string, reason?: string): AuditEvent {
  return {
    version: "1",
    type: "authorization.checked",
    outcome: outcome as AuditEvent["outcome"],
    at,
    traceId: "t",
    namespaceId: "ns",
    actor: { kind: "agent", agentId: "agent-1" },
    authority: { kind: "human", userId: "owner" },
    owner: { kind: "human", userId: "owner" },
    purpose: "demo",
    tool,
    action: "use",
    ...(reason !== undefined ? { reason } : {}),
  } as AuditEvent;
}

const store = createTrackRecordStore();
const base = new Date("2025-01-01T00:00:00Z").getTime();

// Baseline: mostly allowed
for (let i = 0; i < 30; i++) {
  const at = new Date(base + i * 60_000).toISOString();
  addEvent(store, makeEvent("files.search", "allowed", at));
}

// Recent: spike in denials
for (let i = 0; i < 20; i++) {
  const at = new Date(base + (30 + i) * 60_000).toISOString();
  const outcome = i < 2 ? "allowed" : "denied";
  addEvent(store, makeEvent("files.delete", outcome, at, "no_matching_grant"));
}

// Baseline turns
for (let i = 0; i < 5; i++) {
  addTurnRecord(store, {
    turnId: `baseline-${i}`,
    agentId: "agent-1",
    startedAt: new Date(base + i * 300_000).toISOString(),
    completedAt: new Date(base + i * 300_000 + 1000).toISOString(),
    outcome: "complete",
    toolCalls: 5,
    denials: 0,
    escalations: 0,
  } satisfies TurnRecord);
}

// Recent turns with escalation surge
for (let i = 0; i < 3; i++) {
  addTurnRecord(store, {
    turnId: `recent-${i}`,
    agentId: "agent-1",
    startedAt: new Date(base + (150 + i) * 60_000).toISOString(),
    completedAt: new Date(base + (150 + i) * 60_000 + 1000).toISOString(),
    outcome: "escalate",
    toolCalls: 3,
    denials: 2,
    escalations: 1,
  } satisfies TurnRecord);
}

const anomalies = detectAnomalies(store, "agent-1", {
  baselineWindow: 30,
  sensitivity: 2.0,
  minEvents: 10,
});

console.log("  ANOMALY DETECTION");
console.log("  " + "-".repeat(50));

if (anomalies.length === 0) {
  console.log("  No anomalies detected.");
} else {
  for (const a of anomalies) {
    const tag = a.severity === "high" ? "[!!!]" : a.severity === "medium" ? "[!!]" : "[!]";
    console.log(`  ${tag} ${a.type}`);
    console.log(`       ${a.description}`);
    console.log(
      `       current: ${a.evidence.current.toFixed(3)}  baseline: ${a.evidence.baseline.toFixed(3)}  deviation: ${a.evidence.deviation.toFixed(3)}`,
    );
  }
}
console.log();
