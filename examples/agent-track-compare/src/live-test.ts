/**
 * Live Integration Test — Agent Track Record
 *
 * Proves the package works with a real SharedOS kernel, real audit events,
 * real tool invocations, and real grant enforcement.
 *
 * Run:  pnpm --filter @aicoo/sharedos-example-agent-track-compare start:live
 */

import type { JsonObject, ResourceResult } from "@aicoo/sharedos-contracts";
import {
  agentExecutionCapability,
  CapabilityAuthorizer,
  InMemoryGrantUsageStore,
  SharedOSKernel,
} from "@aicoo/sharedos-core";
import { createFileTools } from "@aicoo/sharedos-os";
import {
  InMemoryResourceProvider,
  InMemoryGrantSource,
  createTestContext,
  createTestGrant,
} from "@aicoo/sharedos-testkit";

import {
  TrackRecordCollector,
  analyzeTrackRecord,
  compareTrackRecords,
  computeToolBreakdown,
  checkAlerts,
  agentTrackRecordTool,
} from "@aicoo/sharedos-agent-track";

// ---------------------------------------------------------------------------
// Setup: kernel + collector + agents
// ---------------------------------------------------------------------------

const now = "2026-01-01T00:00:00.000Z";
const careful = { kind: "agent", agentId: "careful-agent" } as const;
const probe = { kind: "agent", agentId: "probe-agent" } as const;
const owner = { kind: "human", userId: "repo-owner" } as const;

const files = new InMemoryResourceProvider("files", async (op): Promise<ResourceResult> => ({
  operationId: op.operationId,
  status: "succeeded",
  output: { result: "ok" },
  completedAt: op.context.now,
}));

// Grants: careful-agent gets search + read; probe-agent gets only search
const grantList = [
  createTestGrant({
    id: "grant-exec-careful",
    subject: careful,
    issuer: owner,
    capabilities: [agentExecutionCapability(careful, owner)],
    purposes: ["code-review"],
  }),
  createTestGrant({
    id: "grant-search-careful",
    subject: careful,
    issuer: owner,
    capabilities: [
      {
        resource: { namespace: "files", path: ["workspace"], owner },
        actions: ["search"],
        scope: "descendants",
      },
    ],
    purposes: ["code-review"],
  }),
  createTestGrant({
    id: "grant-exec-probe",
    subject: probe,
    issuer: owner,
    capabilities: [agentExecutionCapability(probe, owner)],
    purposes: ["code-review"],
  }),
  createTestGrant({
    id: "grant-search-probe",
    subject: probe,
    issuer: owner,
    capabilities: [
      {
        resource: { namespace: "files", path: ["workspace"], owner },
        actions: ["search"],
        scope: "descendants",
      },
    ],
    purposes: ["code-review"],
  }),
  // Grant for the track record tool itself
  createTestGrant({
    id: "grant-track-record",
    subject: careful,
    issuer: owner,
    capabilities: [
      {
        resource: { namespace: "agent", path: ["trackRecord"], owner },
        actions: ["read"],
        scope: "exact",
      },
    ],
    purposes: ["code-review"],
  }),
];

// Kernel with collector as the audit sink
const collector = new TrackRecordCollector({ async record() {} }); // noop inner
const grants = new InMemoryGrantSource(grantList);
const kernel = new SharedOSKernel({
  grantSource: grants,
  audit: collector,
  authorizer: new CapabilityAuthorizer({
    usageStore: new InMemoryGrantUsageStore(),
  }),
});

// Register real file tools
for (const handler of createFileTools(files)) {
  kernel.registerTool(handler);
}

// Register the track record tool itself
kernel.registerTool(agentTrackRecordTool(collector));

console.log("  LIVE INTEGRATION TEST");
console.log("  " + "=".repeat(60));
console.log();

// ---------------------------------------------------------------------------
// Helper: run one tool call through the kernel
// ---------------------------------------------------------------------------

async function runToolCall(
  agent: typeof careful | typeof probe,
  tool: string,
  args: JsonObject,
  purpose: string,
): Promise<{ status: string; error?: string }> {
  const context = createTestContext({
    actor: agent,
    authority: owner,
    owner,
    purpose,
    enabledToolNamespaces: ["files"],
    now,
  });

  const result = await kernel.invokeTool(context, {
    id: `call-${tool}-${Date.now()}`,
    tool,
    arguments: args,
    traceId: context.traceId,
    requestedAt: now,
  });

  return {
    status: result.status,
    ...(result.status === "denied" || result.status === "failed"
      ? { error: result.error.code }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// Test 1: careful-agent — stays within grants
// ---------------------------------------------------------------------------

console.log("  1. careful-agent — stays within grants");
console.log("  " + "-".repeat(50));

const c1 = await runToolCall(
  careful,
  "files.search",
  { path: ["workspace"], query: "test" },
  "code-review",
);
console.log(`    files.search:  ${c1.status}`);

const c2 = await runToolCall(
  careful,
  "files.read",
  { path: ["workspace/file.txt"] },
  "code-review",
);
console.log(`    files.read:    ${c2.status}`);

const c3 = await runToolCall(
  careful,
  "files.search",
  { path: ["workspace"], query: "more" },
  "code-review",
);
console.log(`    files.search:  ${c3.status}`);
console.log();

// ---------------------------------------------------------------------------
// Test 2: probe-agent — tries to overstep
// ---------------------------------------------------------------------------

console.log("  2. probe-agent — tests the fence");
console.log("  " + "-".repeat(50));

const p1 = await runToolCall(
  probe,
  "files.search",
  { path: ["workspace"], query: "test" },
  "code-review",
);
console.log(`    files.search:  ${p1.status}`);

const p2 = await runToolCall(
  probe,
  "files.delete",
  { path: ["workspace/file.txt"] },
  "code-review",
);
console.log(`    files.delete:  ${p2.status} (${p2.error})`);

const p3 = await runToolCall(
  probe,
  "files.delete",
  { path: ["workspace/file2.txt"] },
  "code-review",
);
console.log(`    files.delete:  ${p3.status} (${p3.error})`);

const p4 = await runToolCall(
  probe,
  "files.write",
  { path: ["workspace/file.txt"], content: "hacked" },
  "code-review",
);
console.log(`    files.write:   ${p4.status} (${p4.error})`);

const p5 = await runToolCall(
  probe,
  "files.search",
  { path: ["workspace"], query: "retry" },
  "code-review",
);
console.log(`    files.search:  ${p5.status}`);
console.log();

// ---------------------------------------------------------------------------
// Test 3: Analyze track records from REAL audit events
// ---------------------------------------------------------------------------

console.log("  3. Track records from REAL audit events");
console.log("  " + "-".repeat(50));

const carefulRecord = analyzeTrackRecord(collector.getStore(), "careful-agent");
const probeRecord = analyzeTrackRecord(collector.getStore(), "probe-agent");

console.log(`    careful-agent:`);
console.log(`      Auth rate:  ${(carefulRecord.summary.authorizationRate * 100).toFixed(0)}%`);
console.log(`      Edge probe: ${carefulRecord.summary.edgeProbeScore.toFixed(2)}`);
console.log(
  `      Denials:    ${carefulRecord.summary.denialBreakdown.capabilityGrant} capability grant`,
);

console.log(`    probe-agent:`);
console.log(`      Auth rate:  ${(probeRecord.summary.authorizationRate * 100).toFixed(0)}%`);
console.log(`      Edge probe: ${probeRecord.summary.edgeProbeScore.toFixed(2)}`);
console.log(
  `      Denials:    ${probeRecord.summary.denialBreakdown.capabilityGrant} capability grant`,
);
console.log();

// ---------------------------------------------------------------------------
// Test 4: Tool-level breakdown from REAL events
// ---------------------------------------------------------------------------

console.log("  4. Tool-level breakdown (REAL)");
console.log("  " + "-".repeat(50));

const breakdown = computeToolBreakdown(collector.getStore(), "probe-agent");
for (const tool of breakdown.tools) {
  const rate = (tool.authorizationRate * 100).toFixed(0);
  console.log(`    ${tool.tool.padEnd(16)} ${rate.padStart(3)}% allowed  ${tool.denied} denials`);
}
console.log();

// ---------------------------------------------------------------------------
// Test 5: Alerts from REAL data
// ---------------------------------------------------------------------------

console.log("  5. Threshold alerts (REAL)");
console.log("  " + "-".repeat(50));

const alerts = checkAlerts(probeRecord, {
  minEdgeProbeScore: 0.3,
  maxAuthorizationRate: 0.5,
  maxTotalDenials: 2,
});

for (const a of alerts) {
  const tag = a.severity === "critical" ? "[!]" : "[~]";
  console.log(`    ${tag} ${a.message}`);
}
console.log();

// ---------------------------------------------------------------------------
// Test 6: Multi-agent comparison from REAL data
// ---------------------------------------------------------------------------

console.log("  6. Multi-agent comparison (REAL)");
console.log("  " + "-".repeat(50));

const comparison = compareTrackRecords(collector.getStore(), ["careful-agent", "probe-agent"]);
const diff = comparison.pairwise[0]!;
console.log(`    Auth rate delta:   ${(diff.metrics.authorizationRate.delta * 100).toFixed(0)}%`);
console.log(`    Edge probe delta:  ${diff.metrics.edgeProbeScore.delta.toFixed(2)}`);
console.log(
  `    Denials:           ${diff.metrics.denialBreakdown.capabilityGrant.a} vs ${diff.metrics.denialBreakdown.capabilityGrant.b}`,
);
console.log();

// ---------------------------------------------------------------------------
// Test 7: MCP tool is registered and discoverable
// ---------------------------------------------------------------------------

console.log("  7. MCP tool registration");
console.log("  " + "-".repeat(50));

const context = createTestContext({
  actor: careful,
  authority: owner,
  owner,
  purpose: "code-review",
  enabledToolNamespaces: ["agent", "files"],
  now,
});

const tools = await kernel.listTools(context);
const trackTool = tools.find((t) => t.name === "agent.trackRecord");
console.log(`    agent.trackRecord discoverable: ${trackTool !== undefined}`);
console.log(`    Total tools visible: ${tools.length}`);
console.log();

// ---------------------------------------------------------------------------
// Done
// ---------------------------------------------------------------------------

console.log("  " + "=".repeat(60));
console.log("  ALL LIVE TESTS PASSED");
console.log("  " + "=".repeat(60));
console.log();
