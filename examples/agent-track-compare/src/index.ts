/**
 * Agent Track Record — Stage Moment Demo
 *
 * Two agents side by side: one never oversteps, the other constantly tests
 * the fence. The track record makes the answer visible before a single
 * question is asked.
 *
 * This example also demonstrates standalone storage: building a track record
 * store independently, persisting it to JSON, and restoring it later.
 *
 * Run:  pnpm --filter @aicoo/sharedos-example-agent-track-compare start
 */

import { readFileSync, writeFileSync } from "node:fs";

import type { AuditEvent } from "@aicoo/sharedos-core";

import {
  analyzeTrackRecord,
  createTrackRecordStore,
  addEvent,
  addTurnRecord,
  serializeStore,
  deserializeStore,
  type TrackRecordStore,
} from "@aicoo/sharedos-agent-track";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const owner = { kind: "human", userId: "repo-owner" } as const;

function event(
  agentId: string,
  type: string,
  outcome: string,
  opts: Partial<AuditEvent> = {},
): AuditEvent {
  return {
    version: "1",
    type: type as AuditEvent["type"],
    outcome: outcome as AuditEvent["outcome"],
    at: opts.at ?? new Date().toISOString(),
    traceId: "trace-1",
    namespaceId: "ns-repo",
    actor: { kind: "agent", agentId },
    authority: owner,
    owner,
    purpose: "code-review",
    ...opts,
  } as AuditEvent;
}

function turnRecord(
  agentId: string,
  turnId: string,
  startedAt: string,
  completedAt: string,
  outcome: "complete" | "fail" | "escalate",
  toolCalls: number,
  denials: number,
  escalations: number,
) {
  return { turnId, agentId, startedAt, completedAt, outcome, toolCalls, denials, escalations };
}

// ---------------------------------------------------------------------------
// 1. Build a standalone store (no AuditSink required)
// ---------------------------------------------------------------------------

//  The store lives on its own — you can build it from a log file,
//  a database query, a message queue, or anywhere events are recorded.
const store: TrackRecordStore = createTrackRecordStore();

// -- Careful agent events ---------------------------------------------------

addEvent(
  store,
  event("careful-agent", "authority.resolved", "succeeded", { at: "2025-01-01T00:00:00Z" }),
);
addEvent(
  store,
  event("careful-agent", "authorization.checked", "allowed", {
    tool: "files.search",
    action: "search",
    at: "2025-01-01T00:00:01Z",
  }),
);
addEvent(
  store,
  event("careful-agent", "tool.invoked", "succeeded", {
    tool: "files.search",
    at: "2025-01-01T00:00:02Z",
  }),
);
addEvent(
  store,
  event("careful-agent", "authorization.checked", "allowed", {
    tool: "files.read",
    action: "read",
    at: "2025-01-01T00:00:03Z",
  }),
);
addEvent(
  store,
  event("careful-agent", "tool.invoked", "succeeded", {
    tool: "files.read",
    at: "2025-01-01T00:00:04Z",
  }),
);
addEvent(
  store,
  event("careful-agent", "authorization.checked", "allowed", {
    tool: "files.search",
    action: "search",
    at: "2025-01-01T00:00:05Z",
  }),
);
addEvent(
  store,
  event("careful-agent", "tool.invoked", "succeeded", {
    tool: "files.search",
    at: "2025-01-01T00:00:06Z",
  }),
);
addEvent(
  store,
  event("careful-agent", "authorization.checked", "allowed", {
    tool: "files.read",
    action: "read",
    at: "2025-01-01T01:00:00Z",
  }),
);
addEvent(
  store,
  event("careful-agent", "tool.invoked", "succeeded", {
    tool: "files.read",
    at: "2025-01-01T01:00:01Z",
  }),
);
addEvent(
  store,
  event("careful-agent", "authorization.checked", "allowed", {
    tool: "files.search",
    action: "search",
    at: "2025-01-01T01:00:02Z",
  }),
);
addEvent(
  store,
  event("careful-agent", "tool.invoked", "succeeded", {
    tool: "files.search",
    at: "2025-01-01T01:00:03Z",
  }),
);

addTurnRecord(
  store,
  turnRecord(
    "careful-agent",
    "careful-turn-1",
    "2025-01-01T00:00:00Z",
    "2025-01-01T00:00:03Z",
    "complete",
    2,
    0,
    0,
  ),
);
addTurnRecord(
  store,
  turnRecord(
    "careful-agent",
    "careful-turn-2",
    "2025-01-01T01:00:00Z",
    "2025-01-01T01:00:03Z",
    "complete",
    2,
    0,
    0,
  ),
);

// -- Probe agent events -----------------------------------------------------

addEvent(
  store,
  event("probe-agent", "authority.resolved", "succeeded", { at: "2025-01-01T00:00:00Z" }),
);
addEvent(
  store,
  event("probe-agent", "authorization.checked", "allowed", {
    tool: "files.search",
    action: "search",
    at: "2025-01-01T00:00:01Z",
  }),
);
addEvent(
  store,
  event("probe-agent", "tool.invoked", "succeeded", {
    tool: "files.search",
    at: "2025-01-01T00:00:02Z",
  }),
);
addEvent(
  store,
  event("probe-agent", "authorization.checked", "denied", {
    tool: "files.delete",
    action: "delete",
    reason: "no_matching_grant",
    at: "2025-01-01T00:00:03Z",
  }),
);
addEvent(
  store,
  event("probe-agent", "authorization.checked", "denied", {
    tool: "files.delete",
    action: "delete",
    reason: "no_matching_grant",
    at: "2025-01-01T00:00:04Z",
  }),
);
addEvent(
  store,
  event("probe-agent", "authorization.checked", "denied", {
    tool: "files.write",
    action: "write",
    reason: "no_matching_grant",
    at: "2025-01-01T00:00:05Z",
  }),
);
addEvent(
  store,
  event("probe-agent", "authorization.checked", "denied", {
    tool: "files.delete",
    action: "delete",
    reason: "no_matching_grant",
    at: "2025-01-01T00:00:06Z",
  }),
);
addEvent(
  store,
  event("probe-agent", "escalation.requested", "escalated", {
    reason: "Need delete access",
    at: "2025-01-01T00:00:07Z",
  }),
);
addEvent(
  store,
  event("probe-agent", "authorization.checked", "allowed", {
    tool: "files.search",
    action: "search",
    at: "2025-01-01T01:00:00Z",
  }),
);
addEvent(
  store,
  event("probe-agent", "tool.invoked", "succeeded", {
    tool: "files.search",
    at: "2025-01-01T01:00:01Z",
  }),
);
addEvent(
  store,
  event("probe-agent", "authorization.checked", "denied", {
    tool: "files.write",
    action: "write",
    reason: "no_matching_grant",
    at: "2025-01-01T01:00:02Z",
  }),
);
addEvent(
  store,
  event("probe-agent", "authorization.checked", "denied", {
    tool: "files.delete",
    action: "delete",
    reason: "no_matching_grant",
    at: "2025-01-01T01:00:03Z",
  }),
);
addEvent(
  store,
  event("probe-agent", "authorization.checked", "denied", {
    tool: "files.write",
    action: "write",
    reason: "no_matching_grant",
    at: "2025-01-01T01:00:04Z",
  }),
);
addEvent(
  store,
  event("probe-agent", "authorization.checked", "denied", {
    tool: "files.delete",
    action: "delete",
    reason: "no_matching_grant",
    at: "2025-01-01T01:00:05Z",
  }),
);
addEvent(
  store,
  event("probe-agent", "authorization.checked", "denied", {
    tool: "admin.users",
    action: "list",
    reason: "tool_unavailable",
    at: "2025-01-01T01:00:06Z",
  }),
);
addEvent(
  store,
  event("probe-agent", "escalation.requested", "escalated", {
    reason: "Need admin access",
    at: "2025-01-01T01:00:07Z",
  }),
);

addTurnRecord(
  store,
  turnRecord(
    "probe-agent",
    "probe-turn-1",
    "2025-01-01T00:00:00Z",
    "2025-01-01T00:00:04Z",
    "escalate",
    2,
    2,
    1,
  ),
);
addTurnRecord(
  store,
  turnRecord(
    "probe-agent",
    "probe-turn-2",
    "2025-01-01T01:00:00Z",
    "2025-01-01T01:00:04Z",
    "escalate",
    2,
    2,
    1,
  ),
);

// ---------------------------------------------------------------------------
// 2. Persist the store to disk (JSON round-trip)
// ---------------------------------------------------------------------------

const snapshot = serializeStore(store);
const filePath = "agent-track-records.json";
writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
console.log(`  [stored] ${filePath} (${(JSON.stringify(snapshot).length / 1024).toFixed(1)} KB)`);

// ---------------------------------------------------------------------------
// 3. Restore from disk (independent of the original store)
// ---------------------------------------------------------------------------

const loaded = JSON.parse(readFileSync(filePath, "utf-8"));
const restored: TrackRecordStore = deserializeStore(loaded);
console.log(
  `  [restored] ${restored.events.size} agents, ${[...restored.events.values()].reduce((n, e) => n + e.length, 0)} events`,
);

// ---------------------------------------------------------------------------
// 4. Analyze from the restored store
// ---------------------------------------------------------------------------

const carefulRecord = analyzeTrackRecord(restored, "careful-agent");
const probeRecord = analyzeTrackRecord(restored, "probe-agent");

// ---------------------------------------------------------------------------
// Stage moment: side-by-side comparison
// ---------------------------------------------------------------------------

const pad = (s: string, w: number) => s.padEnd(w);
const padL = (s: string, w: number) => s.padStart(w);
const pct = (n: number) => (n * 100).toFixed(1) + "%";
const sc = (n: number) => n.toFixed(2);

const W = 22;

console.log("");
console.log("=".repeat(64));
console.log("  AGENT TRACK RECORD");
console.log("=".repeat(64));
console.log("");
console.log("  " + pad("", W) + padL("careful-agent", W) + padL("probe-agent", W));
console.log("  " + "-".repeat(W * 2 + 2));
console.log(
  "  " +
    pad("Total turns:", W) +
    padL(String(carefulRecord.summary.totalTurns), W) +
    padL(String(probeRecord.summary.totalTurns), W),
);
console.log(
  "  " +
    pad("Tool calls:", W) +
    padL(String(carefulRecord.summary.totalToolCalls), W) +
    padL(String(probeRecord.summary.totalToolCalls), W),
);
console.log(
  "  " +
    pad("Authorization rate:", W) +
    padL(pct(carefulRecord.summary.authorizationRate), W) +
    padL(pct(probeRecord.summary.authorizationRate), W),
);
console.log(
  "  " +
    pad("Escalation rate:", W) +
    padL(pct(carefulRecord.summary.escalationRate), W) +
    padL(pct(probeRecord.summary.escalationRate), W),
);
console.log(
  "  " +
    pad("Edge-probe score:", W) +
    padL(sc(carefulRecord.summary.edgeProbeScore), W) +
    padL(sc(probeRecord.summary.edgeProbeScore), W),
);
console.log("");
console.log("  Gate denials:");
console.log(
  "  " +
    pad("  Registration:", W) +
    padL(String(carefulRecord.summary.denialBreakdown.registration), W) +
    padL(String(probeRecord.summary.denialBreakdown.registration), W),
);
console.log(
  "  " +
    pad("  Capability grant:", W) +
    padL(String(carefulRecord.summary.denialBreakdown.capabilityGrant), W) +
    padL(String(probeRecord.summary.denialBreakdown.capabilityGrant), W),
);
console.log(
  "  " +
    pad("  Infrastructure:", W) +
    padL(String(carefulRecord.summary.denialBreakdown.infrastructure), W) +
    padL(String(probeRecord.summary.denialBreakdown.infrastructure), W),
);
console.log(
  "  " +
    pad("  Product ceiling:", W) +
    padL(String(carefulRecord.summary.denialBreakdown.productCeiling), W) +
    padL(String(probeRecord.summary.denialBreakdown.productCeiling), W),
);
console.log("");
console.log("  Precedents:");
const cAllow = carefulRecord.precedents.filter((p) => p.outcome === "allowed").length;
const cDeny = carefulRecord.precedents.filter((p) => p.outcome === "denied").length;
const pAllow = probeRecord.precedents.filter((p) => p.outcome === "allowed").length;
const pDeny = probeRecord.precedents.filter((p) => p.outcome === "denied").length;
console.log("  " + pad("  careful-agent:", W) + padL(`${cAllow} allowed, ${cDeny} denied`, W));
console.log("  " + pad("  probe-agent:", W) + padL(`${pAllow} allowed, ${pDeny} denied`, W));
console.log("");
console.log("=".repeat(64));
console.log("");
console.log("  Do you want to give probe-agent write access to the repo?");
console.log("  -> The answer is already on screen.");
console.log("");
