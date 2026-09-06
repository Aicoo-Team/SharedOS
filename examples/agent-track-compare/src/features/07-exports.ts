/**
 * Export Formats
 *
 * CSV and Prometheus exposition format.
 */

import type { AuditEvent } from "@aicoo/sharedos-core";
import {
  exportCSV,
  exportCSVComparison,
  exportPrometheus,
  createTrackRecordStore,
  addEvent,
  analyzeTrackRecord,
} from "@aicoo/sharedos-agent-track";

function makeEvent(agentId: string, outcome: string, tool = "files.search"): AuditEvent {
  return {
    version: "1",
    type: "authorization.checked",
    outcome: outcome as AuditEvent["outcome"],
    at: "2025-01-01T00:00:00Z",
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

const store = createTrackRecordStore();
addEvent(store, makeEvent("agent-a", "allowed"));
addEvent(store, makeEvent("agent-a", "allowed"));
addEvent(store, makeEvent("agent-a", "denied", "files.delete"));
addEvent(store, makeEvent("agent-b", "allowed"));
addEvent(store, makeEvent("agent-b", "denied", "files.delete"));
addEvent(store, makeEvent("agent-b", "denied", "files.delete"));

const recordA = analyzeTrackRecord(store, "agent-a");
const recordB = analyzeTrackRecord(store, "agent-b");

console.log("  EXPORT FORMATS");
console.log("  " + "-".repeat(50));

console.log("  --- CSV (single agent) ---");
const csv = exportCSV(recordA);
console.log(
  csv
    .split("\n")
    .slice(0, 8)
    .map((l) => `  ${l}`)
    .join("\n"),
);

console.log("  --- CSV (comparison) ---");
const csvComp = exportCSVComparison([recordA, recordB]);
console.log(
  csvComp
    .split("\n")
    .map((l) => `  ${l}`)
    .join("\n"),
);

console.log("  --- Prometheus ---");
const prom = exportPrometheus(recordA);
const lines = prom.split("\n").filter((l) => l.length > 0);
console.log(lines.map((l) => `  ${l}`).join("\n"));
console.log();
