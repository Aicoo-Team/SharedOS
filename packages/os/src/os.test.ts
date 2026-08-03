import { describe, expect, it, vi } from "vitest";

import type {
  AccessContext,
  CapabilityGrant,
  ResourceOperation,
  ResourceResult,
  ToolCall,
} from "@sharedos/contracts";
import { SharedOSKernel, type ResourceProvider } from "@sharedos/core";

import { createMemoryTools } from "./index.js";

const now = "2026-08-03T00:00:00.000Z";
const actor = { kind: "agent", agentId: "agent-bob" } as const;
const owner = { kind: "human", userId: "user-alice" } as const;
const grant: CapabilityGrant = {
  id: "grant-1",
  namespaceId: "world-1",
  subject: actor,
  issuer: owner,
  capabilities: [
    {
      resource: { namespace: "memory", path: ["project-x"], owner },
      actions: ["search"],
      scope: "descendants",
    },
  ],
  constraints: { purposes: ["prepare-report"] },
  issuedAt: now,
};
const context: AccessContext = {
  actor,
  authority: owner,
  owner,
  namespaceId: "world-1",
  purpose: "prepare-report",
  traceId: "trace-1",
  grants: [grant],
  now,
};

function call(path: string[]): ToolCall {
  return {
    id: `call-${path.at(-1)}`,
    tool: "memory.search",
    arguments: { path, query: "launch" },
    traceId: context.traceId,
    requestedAt: now,
  };
}

describe("standard OS tools", () => {
  it("shows a memory tool for a narrow grant and authorizes the exact call path", async () => {
    const invoke = vi.fn(async (operation: ResourceOperation): Promise<ResourceResult> => ({
      operationId: operation.operationId,
      status: "succeeded",
      output: { hits: [] },
      completedAt: now,
    }));
    const provider: ResourceProvider = { namespace: "memory", invoke };
    const kernel = new SharedOSKernel();
    for (const handler of createMemoryTools(provider)) {
      kernel.registerTool(handler);
    }

    await expect(kernel.listTools(context)).resolves.toEqual([
      expect.objectContaining({ name: "memory.search" }),
    ]);

    const mutableCall = call(["project-x"]);
    const allowedPromise = kernel.invokeTool(context, mutableCall);
    mutableCall.arguments.path = ["project-y"];
    const allowed = await allowedPromise;
    const denied = await kernel.invokeTool(context, call(["project-y"]));

    expect(allowed.status).toBe("succeeded");
    expect(denied.status).toBe("denied");
    expect(invoke).toHaveBeenCalledOnce();
    expect(invoke).toHaveBeenCalledWith(
      expect.objectContaining({ resource: expect.objectContaining({ path: ["project-x"] }) }),
      expect.any(AbortSignal),
    );
  });
});
