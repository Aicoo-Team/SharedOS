/**
 * Tool-Level Breakdown
 *
 * Per-tool authorization rates and denial counts.
 */

import type { AuditEvent } from "@aicoo/sharedos-core";
import {
  computeToolBreakdown,
  createTrackRecordStore,
  addEvent,
} from "@aicoo/sharedos-agent-track";

function makeEvent(tool: string, action: string, outcome: string, reason?: string): AuditEvent {
  return {
    version: "1",
    type: "authorization.checked",
    outcome: outcome as AuditEvent["outcome"],
    at: "2025-01-01T00:00:00Z",
    traceId: "t",
    namespaceId: "ns",
    actor: { kind: "agent", agentId: "agent-1" },
    authority: { kind: "human", userId: "owner" },
    owner: { kind: "human", userId: "owner" },
    purpose: "demo",
    tool,
    action,
    ...(reason !== undefined ? { reason } : {}),
  } as AuditEvent;
}

const store = createTrackRecordStore();

// files.search: always allowed
addEvent(store, makeEvent("files.search", "search", "allowed"));
addEvent(store, makeEvent("files.search", "search", "allowed"));
addEvent(store, makeEvent("files.search", "search", "allowed"));

// files.read: mostly allowed, one denial
addEvent(store, makeEvent("files.read", "read", "allowed"));
addEvent(store, makeEvent("files.read", "read", "allowed"));
addEvent(store, makeEvent("files.read", "read", "denied", "no_matching_grant"));

// files.delete: always denied, retried
addEvent(store, makeEvent("files.delete", "delete", "denied", "no_matching_grant"));
addEvent(store, makeEvent("files.delete", "delete", "denied", "no_matching_grant"));
addEvent(store, makeEvent("files.delete", "delete", "denied", "no_matching_grant"));

// admin.users: denied (tool not found)
addEvent(store, makeEvent("admin.users", "list", "denied", "tool_unavailable"));

const breakdown = computeToolBreakdown(store, "agent-1");

console.log("  TOOL-LEVEL BREAKDOWN");
console.log("  " + "-".repeat(50));
console.log(`  Unique tools attempted: ${breakdown.summary.uniqueToolsAttempted}`);
console.log(`  Unique tools denied:    ${breakdown.summary.uniqueToolsDenied}`);
console.log(`  Most attempted tool:    ${breakdown.summary.mostAttemptedTool ?? "none"}`);
console.log(`  Most denied tool:       ${breakdown.summary.mostDeniedTool ?? "none"}`);
console.log();

console.log("  Per-tool stats:");
for (const tool of breakdown.tools) {
  const rate = (tool.authorizationRate * 100).toFixed(0);
  const retry = tool.retriedAfterDenial ? " (retried)" : "";
  console.log(
    `    ${tool.tool.padEnd(16)} ${rate.padStart(3)}% allowed  ${tool.denied} denials${retry}`,
  );
}
console.log();
