/**
 * Multi-Agent Comparison
 *
 * Compares multiple agents with structured diffs and rankings.
 */

import type { AuditEvent } from "@aicoo/sharedos-core";
import {
  compareTrackRecords,
  createTrackRecordStore,
  addEvent,
  addTurnRecord,
  type TurnRecord,
} from "@aicoo/sharedos-agent-track";

function makeEvent(agentId: string, tool: string, outcome: string, at: string): AuditEvent {
  return {
    version: "1",
    type: "authorization.checked",
    outcome: outcome as AuditEvent["outcome"],
    at,
    traceId: "t",
    namespaceId: "ns",
    actor: { kind: "agent", agentId },
    authority: { kind: "human", userId: "owner" },
    owner: { kind: "human", userId: "owner" },
    purpose: "demo",
    tool,
    action: "use",
  } as AuditEvent;
}

function makeTurn(
  agentId: string,
  id: string,
  outcome: "complete" | "escalate",
  toolCalls: number,
  denials: number,
  escalations: number,
): TurnRecord {
  return {
    turnId: id,
    agentId,
    startedAt: "2025-01-01T00:00:00Z",
    completedAt: "2025-01-01T00:00:01Z",
    outcome,
    toolCalls,
    denials,
    escalations,
  };
}

const store = createTrackRecordStore();

// Agent A: well-behaved, high authorization rate
for (let i = 0; i < 20; i++) {
  addEvent(
    store,
    makeEvent(
      "agent-a",
      "files.search",
      "allowed",
      `2025-01-01T00:${String(i).padStart(2, "0")}:00Z`,
    ),
  );
}
addTurnRecord(store, makeTurn("agent-a", "a1", "complete", 20, 0, 0));

// Agent B: probes boundaries, high denial rate
for (let i = 0; i < 10; i++) {
  addEvent(
    store,
    makeEvent(
      "agent-b",
      "files.search",
      "allowed",
      `2025-01-01T00:${String(i).padStart(2, "0")}:00Z`,
    ),
  );
  addEvent(
    store,
    makeEvent(
      "agent-b",
      "files.delete",
      "denied",
      `2025-01-01T00:${String(i).padStart(2, "0")}:01Z`,
    ),
  );
}
addTurnRecord(store, makeTurn("agent-b", "b1", "escalate", 10, 10, 1));

// Agent C: worst of the three
for (let i = 0; i < 5; i++) {
  addEvent(
    store,
    makeEvent(
      "agent-c",
      "files.search",
      "allowed",
      `2025-01-01T00:${String(i).padStart(2, "0")}:00Z`,
    ),
  );
  addEvent(
    store,
    makeEvent(
      "agent-c",
      "files.delete",
      "denied",
      `2025-01-01T00:${String(i).padStart(2, "0")}:01Z`,
    ),
  );
  addEvent(
    store,
    makeEvent(
      "agent-c",
      "admin.users",
      "denied",
      `2025-01-01T00:${String(i).padStart(2, "0")}:02Z`,
    ),
  );
}
addTurnRecord(store, makeTurn("agent-c", "c1", "escalate", 5, 10, 1));

const comparison = compareTrackRecords(store, ["agent-a", "agent-b", "agent-c"]);

console.log("  MULTI-AGENT COMPARISON");
console.log("  " + "-".repeat(50));

console.log("  Pairwise diff (agent-a vs agent-b):");
const diff = comparison.pairwise.find((d) => d.agentA === "agent-a" && d.agentB === "agent-b")!;
console.log(
  `    Authorization rate: ${(diff.metrics.authorizationRate.a * 100).toFixed(0)}% vs ${(diff.metrics.authorizationRate.b * 100).toFixed(0)}% (delta: ${(diff.metrics.authorizationRate.delta * 100).toFixed(0)}%)`,
);
console.log(
  `    Edge-probe score:  ${diff.metrics.edgeProbeScore.a.toFixed(2)} vs ${diff.metrics.edgeProbeScore.b.toFixed(2)}`,
);
console.log();

console.log("  Rankings by authorization rate:");
for (const r of comparison.rankings.byAuthorizationRate) {
  console.log(`    ${r.agentId.padEnd(12)} ${(r.value * 100).toFixed(1)}%`);
}
console.log();

console.log("  Rankings by edge-probe score (highest = most risky):");
for (const r of comparison.rankings.byEdgeProbeScore) {
  console.log(`    ${r.agentId.padEnd(12)} ${r.value.toFixed(2)}`);
}
console.log();
