/**
 * Quick demo: what a denial looks like WITHOUT the debugger.
 * Run this first to show the problem, then run the full demo.
 *
 * Run: node examples/denial-debugger/dist/before.js
 */
import { SharedOSKernel } from "@aicoo/sharedos";
import { InMemoryGrantSource } from "@aicoo/sharedos-testkit";

const kernel = new SharedOSKernel({
  grantSource: new InMemoryGrantSource([]),
});

const context = {
  namespaceId: "acme",
  actor: { kind: "agent" as const, agentId: "agent-1" },
  authority: { kind: "human" as const, userId: "owner" },
  owner: { kind: "human" as const, userId: "owner" },
  purpose: "search",
  traceId: "trace-1",
  enabledToolNamespaces: ["files"],
  now: "2026-01-01T00:00:00.000Z",
};

const call = {
  id: "call-1",
  tool: "files.search",
  arguments: { query: "hello" },
  traceId: "trace-1",
  requestedAt: "2026-01-01T00:00:00.000Z",
};

const result = await kernel.invokeTool(context, call);

console.log("\n── Without the debugger ──\n");
console.log("  result.status:", result.status);
if (result.status === "denied") {
  console.log("  result.error.code:", result.error.code);
  console.log("  result.error.message:", result.error.message);
}
console.log("\n  ...that's all you get. Good luck figuring out what went wrong.\n");
