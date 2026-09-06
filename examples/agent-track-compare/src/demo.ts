#!/usr/bin/env node
/**
 * 3-MINUTE DEMO — Agent Track Record
 *
 * Two agents. One plays nice. One tests the fence.
 * The answer is already on screen before you ask the question.
 *
 * Run:  node examples/agent-track-compare/dist/demo.js
 */

import type { JsonObject, ResourceResult } from "@aicoo/sharedos-contracts";
import { agentExecutionCapability, CapabilityAuthorizer, InMemoryGrantUsageStore, SharedOSKernel } from "@aicoo/sharedos-core";
import { createFileTools } from "@aicoo/sharedos-os";
import { InMemoryResourceProvider, InMemoryGrantSource, createTestContext, createTestGrant } from "@aicoo/sharedos-testkit";
import { TrackRecordCollector, analyzeTrackRecord, computeToolBreakdown, agentTrackRecordTool } from "@aicoo/sharedos-agent-track";

const now = "2026-01-01T00:00:00.000Z";
const careful = { kind: "agent", agentId: "careful-agent" } as const;
const probe = { kind: "agent", agentId: "probe-agent" } as const;
const owner = { kind: "human", userId: "repo-owner" } as const;

// ── Setup ──────────────────────────────────────────────────────────────

const files = new InMemoryResourceProvider("files", async (op): Promise<ResourceResult> => ({
  operationId: op.operationId, status: "succeeded", output: { result: "ok" }, completedAt: op.context.now,
}));

const collector = new TrackRecordCollector({ async record() {} });
const kernel = new SharedOSKernel({
  grantSource: new InMemoryGrantSource([
    // careful-agent: search + read (stays within grants)
    createTestGrant({ id: "g1", subject: careful, issuer: owner, capabilities: [agentExecutionCapability(careful, owner)], purposes: ["review"] }),
    createTestGrant({ id: "g2", subject: careful, issuer: owner, capabilities: [{ resource: { namespace: "files", path: ["workspace"], owner }, actions: ["search", "read"], scope: "descendants" }], purposes: ["review"] }),
    // probe-agent: search only (delete/write not granted)
    createTestGrant({ id: "g3", subject: probe, issuer: owner, capabilities: [agentExecutionCapability(probe, owner)], purposes: ["review"] }),
    createTestGrant({ id: "g4", subject: probe, issuer: owner, capabilities: [{ resource: { namespace: "files", path: ["workspace"], owner }, actions: ["search"], scope: "descendants" }], purposes: ["review"] }),
    // track record tool grant
    createTestGrant({ id: "g5", subject: careful, issuer: owner, capabilities: [{ resource: { namespace: "agent", path: ["trackRecord"], owner }, actions: ["read"], scope: "exact" }], purposes: ["review"] }),
  ]),
  audit: collector,
  authorizer: new CapabilityAuthorizer({ usageStore: new InMemoryGrantUsageStore() }),
});

for (const handler of createFileTools(files)) kernel.registerTool(handler);
kernel.registerTool(agentTrackRecordTool(collector));

// ── Helper ─────────────────────────────────────────────────────────────

async function call(agent: typeof careful | typeof probe, tool: string, args: { [k: string]: unknown }) {
  const ctx = createTestContext({ actor: agent, authority: owner, owner, purpose: "review", enabledToolNamespaces: ["files"], now });
  const r = await kernel.invokeTool(ctx, { id: `c-${Date.now()}-${Math.random()}`, tool, arguments: args as JsonObject, traceId: ctx.traceId, requestedAt: now });
  return r.status;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ══════════════════════════════════════════════════════════════════════
//  ACT 1 — Two agents, same repo
// ══════════════════════════════════════════════════════════════════════

console.log();
console.log("  ACT 1: Two agents, same repo");
console.log("  ─────────────────────────────────────────────────────");
await sleep(500);

// careful-agent: stays within grants (search + read only)
console.log();
console.log("  careful-agent:");
for (const [tool, args] of [
  ["files.search", { path: ["workspace"], query: "auth" }],
  ["files.read", { path: ["workspace/report.md"] }],
  ["files.search", { path: ["workspace"], query: "design" }],
  ["files.read", { path: ["workspace/notes.md"] }],
  ["files.search", { path: ["workspace"], query: "spec" }],
] as const) {
  const r = await call(careful, tool, args);
  console.log(`    ${tool.padEnd(14)} → ${r}`);
  await sleep(200);
}
await sleep(600);

// probe-agent: tests the fence (delete, write, admin — all unauthorized)
console.log();
console.log("  probe-agent:");
for (const [tool, args] of [
  ["files.search", { path: ["workspace"], query: "test" }],
  ["files.delete", { path: ["workspace/file.txt"] }],
  ["files.write", { path: ["workspace/hack.txt"], content: "owned" }],
  ["files.delete", { path: ["workspace/important.txt"] }],
  ["files.delete", { path: ["workspace/secret.txt"] }],
  ["files.write", { path: ["workspace/config.json"], content: "pwned" }],
  ["files.delete", { path: ["workspace/db.sql"] }],
  ["files.search", { path: ["workspace"], query: "retry" }],
] as const) {
  const r = await call(probe, tool, args);
  console.log(`    ${tool.padEnd(14)} → ${r}`);
  await sleep(200);
}
await sleep(800);

// ══════════════════════════════════════════════════════════════════════
//  ACT 2 — The reveal
// ══════════════════════════════════════════════════════════════════════

console.log();
console.log("  ACT 2: Agent Track Record");
console.log("  ─────────────────────────────────────────────────────");
await sleep(600);

const c = analyzeTrackRecord(collector.getStore(), "careful-agent");
const p = analyzeTrackRecord(collector.getStore(), "probe-agent");

const W = 20;
const pad = (s: string) => s.padEnd(W);
const padL = (s: string) => s.padStart(W);
const pct = (n: number) => (n * 100).toFixed(1) + "%";

console.log();
console.log("  " + pad("") + padL("careful-agent") + padL("probe-agent"));
console.log("  " + "─".repeat(W * 3));
await sleep(400);
console.log("  " + pad("Authorization rate:") + padL(pct(c.summary.authorizationRate)) + padL(pct(p.summary.authorizationRate)));
await sleep(300);
console.log("  " + pad("Edge-probe score:") + padL(c.summary.edgeProbeScore.toFixed(2)) + padL(p.summary.edgeProbeScore.toFixed(2)));
await sleep(300);
console.log("  " + pad("Escalation rate:") + padL(pct(c.summary.escalationRate)) + padL(pct(p.summary.escalationRate)));
await sleep(300);
console.log("  " + pad("Total denials:") + padL(String(c.summary.denialBreakdown.capabilityGrant + c.summary.denialBreakdown.registration)) + padL(String(p.summary.denialBreakdown.capabilityGrant + p.summary.denialBreakdown.registration)));
await sleep(800);

// Tool breakdown for probe-agent
console.log();
console.log("  Tool breakdown (probe-agent):");
const bd = computeToolBreakdown(collector.getStore(), "probe-agent");
for (const tool of bd.tools) {
  const rate = (tool.authorizationRate * 100).toFixed(0);
  console.log(`    ${tool.tool.padEnd(16)} ${rate.padStart(3)}% allowed  ${tool.denied} denied`);
}
await sleep(1000);

// ══════════════════════════════════════════════════════════════════════
//  ACT 3 — The punchline
// ══════════════════════════════════════════════════════════════════════

console.log();
console.log("  ─────────────────────────────────────────────────────");
await sleep(500);
console.log();
console.log("  Do you want to give probe-agent write access to the repo?");
await sleep(1200);
console.log("  → The answer is already on screen.");
await sleep(800);

// ══════════════════════════════════════════════════════════════════════
//  ACT 4 — Code (5 lines)
// ══════════════════════════════════════════════════════════════════════

console.log();
console.log("  ─────────────────────────────────────────────────────");
console.log("  Integration: 5 lines");
console.log("  ─────────────────────────────────────────────────────");
console.log();
console.log("  const collector = new TrackRecordCollector(auditSink);");
console.log("  kernel.registerTool(agentTrackRecordTool(collector));");
console.log("  // ... tool calls happen ...");
console.log("  const record = analyzeTrackRecord(collector.getStore(), agentId);");
console.log("  // record.summary.edgeProbeScore → 0.81");
console.log();
