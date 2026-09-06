/**
 * Time-Window Aggregation
 *
 * Shows how to compute rolling window metrics (1h, 24h, 7d, 30d, all)
 * to see trends instead of only point-in-time snapshots.
 */

import type { AuditEvent } from "@aicoo/sharedos-core";
import {
  computeWindowedTrackRecord,
  createTrackRecordStore,
  addEvent,
} from "@aicoo/sharedos-agent-track";

function makeEvent(tool: string, outcome: string, at: string): AuditEvent {
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
  } as AuditEvent;
}

const store = createTrackRecordStore();

// Spread events across 7 days — some allowed, some denied
const now = new Date("2025-01-08T00:00:00Z").getTime();
for (let i = 0; i < 200; i++) {
  const daysAgo = Math.random() * 7;
  const at = new Date(now - daysAgo * 86_400_000).toISOString();
  const outcome = Math.random() > 0.3 ? "allowed" : "denied";
  addEvent(store, makeEvent("files.search", outcome, at));
}

const windowed = computeWindowedTrackRecord(store, "agent-1", "2025-01-08T00:00:00Z");

console.log("  TIME-WINDOW AGGREGATION");
console.log("  " + "-".repeat(50));
for (const w of windowed.windows) {
  const rate = (w.summary.authorizationRate * 100).toFixed(1);
  const probe = w.summary.edgeProbeScore.toFixed(2);
  console.log(
    `  ${w.window.label.padEnd(6)} auth: ${rate.padStart(6)}%  probe: ${probe}  (${w.eventCount} events)`,
  );
}
console.log();
