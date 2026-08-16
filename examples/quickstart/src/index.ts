import type { ExecutionRequest, ResourceResult } from "@sharedos/contracts";
import { agentExecutionCapability } from "@sharedos/core";
import { createFileTools } from "@sharedos/os";
import { SharedOSExecutor, StandardRuntime, type AgentTurnDriver } from "@sharedos/runtime";
import {
  InMemoryResourceProvider,
  createTestContext,
  createTestGrant,
  createTestKernel,
} from "@sharedos/testkit";

const now = "2026-08-03T00:00:00.000Z";
const bob = { kind: "agent", agentId: "agent-bob" } as const;
const alice = { kind: "agent", agentId: "agent-alice" } as const;
const owner = { kind: "human", userId: "owner-1" } as const;
const { kernel } = createTestKernel();

const files = new InMemoryResourceProvider("files", async (operation): Promise<ResourceResult> => ({
  operationId: operation.operationId,
  status: "succeeded",
  output: { hits: [{ text: "SharedOS keeps authority outside the message." }] },
  completedAt: operation.context.now,
}));
for (const handler of createFileTools(files)) {
  kernel.registerTool(handler);
}

const grants = [
  createTestGrant({
    id: "grant-invoke-alice",
    subject: bob,
    issuer: owner,
    capabilities: [agentExecutionCapability(alice, owner)],
    purposes: ["prepare-report"],
  }),
  createTestGrant({
    id: "grant-search-files",
    subject: bob,
    issuer: owner,
    capabilities: [
      {
        resource: { namespace: "files", path: ["Workspace", "project-x"], owner },
        actions: ["search"],
        scope: "descendants",
      },
    ],
    purposes: ["prepare-report"],
  }),
];
const context = createTestContext({
  actor: bob,
  authority: owner,
  owner,
  purpose: "prepare-report",
  enabledToolNamespaces: ["files"],
  grants,
  now,
});

const driver: AgentTurnDriver = {
  async open() {
    return {
      async next(input) {
        if (input.type === "start") {
          return {
            type: "tool_call",
            call: {
              id: "call-search-files",
              tool: "files.search",
              arguments: { path: ["Workspace", "project-x"], query: "authority" },
              traceId: context.traceId,
              requestedAt: now,
            },
          };
        }

        return input.result.status === "succeeded"
          ? { type: "complete", output: { fileResult: input.result.output } }
          : { type: "complete", output: { fileError: input.result.error.code } };
      },
    };
  },
};

const tools = await kernel.listTools(context);
const request: ExecutionRequest = {
  version: "1",
  executionId: "execution-1",
  agent: alice,
  context,
  message: {
    version: "1",
    id: "message-1",
    sender: bob,
    receiver: alice,
    intent: "prepare-report",
    purpose: context.purpose,
    payload: { topic: "SharedOS authority" },
    traceId: context.traceId,
    createdAt: now,
  },
  tools: [...tools],
};

let eventSequence = 0;
const result = await new SharedOSExecutor(kernel, new StandardRuntime(driver), {
  clock: () => now,
  createId: () => `event-${(eventSequence += 1)}`,
}).execute(request);

console.log({
  visibleTools: tools.map(({ name }) => name),
  status: result.status,
  output: result.status === "succeeded" ? result.output : result.error,
});
