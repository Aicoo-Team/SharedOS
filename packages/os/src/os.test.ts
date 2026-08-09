import { describe, expect, it, vi } from "vitest";

import type {
  AccessContext,
  CapabilityGrant,
  JsonObject,
  ResourceOperation,
  ResourceResult,
  ToolCall,
} from "@sharedos/contracts";
import { SharedOSKernel, type ResourceProvider } from "@sharedos/core";

import { createFileTools, FILES_NAMESPACE } from "./index.js";

const now = "2026-08-03T00:00:00.000Z";
const actor = { kind: "agent", agentId: "agent-bob" } as const;
const owner = { kind: "human", userId: "user-alice" } as const;

function contextFor(actions: string[], path = ["Memory", "Self"]): AccessContext {
  const grant: CapabilityGrant = {
    id: "grant-1",
    namespaceId: "world-1",
    subject: actor,
    issuer: owner,
    capabilities: [
      {
        resource: { namespace: FILES_NAMESPACE, path, owner },
        actions,
        scope: "descendants",
      },
    ],
    constraints: { purposes: ["prepare-report"] },
    issuedAt: now,
  };
  return {
    actor,
    authority: owner,
    owner,
    namespaceId: "world-1",
    purpose: "prepare-report",
    traceId: "trace-1",
    grants: [grant],
    now,
  };
}

function call(tool: string, arguments_: JsonObject): ToolCall {
  return {
    id: `call-${tool.replaceAll(".", "-")}`,
    tool,
    arguments: arguments_,
    traceId: "trace-1",
    requestedAt: now,
  };
}

function provider(
  invoke = vi.fn(async (operation: ResourceOperation): Promise<ResourceResult> => ({
    operationId: operation.operationId,
    status: "succeeded",
    output: { ok: true },
    completedAt: now,
  })),
): ResourceProvider {
  return { namespace: FILES_NAMESPACE, invoke };
}

describe("standard OS file tools", () => {
  it("shows a file tool for a narrow grant and authorizes the exact call path", async () => {
    const invoke = vi.fn(async (operation: ResourceOperation): Promise<ResourceResult> => ({
      operationId: operation.operationId,
      status: "succeeded",
      output: { hits: [] },
      completedAt: now,
    }));
    const kernel = new SharedOSKernel();
    for (const handler of createFileTools(provider(invoke))) kernel.registerTool(handler);
    const context = contextFor(["search"]);

    await expect(kernel.listTools(context)).resolves.toEqual([
      expect.objectContaining({ name: "files.search" }),
    ]);

    const mutableCall = call("files.search", {
      path: ["Memory", "Self"],
      query: "launch",
    });
    const allowedPromise = kernel.invokeTool(context, mutableCall);
    mutableCall.arguments.path = ["Memory", "@alice"];
    const allowed = await allowedPromise;
    const denied = await kernel.invokeTool(
      context,
      call("files.search", { path: ["Memory", "@alice"], query: "launch" }),
    );

    expect(allowed.status).toBe("succeeded");
    expect(denied.status).toBe("denied");
    expect(invoke).toHaveBeenCalledOnce();
    expect(invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: expect.objectContaining({
          namespace: FILES_NAMESPACE,
          path: ["Memory", "Self"],
        }),
      }),
      expect.any(AbortSignal),
    );
  });

  it("publishes one files vocabulary without memory or workspace aliases", () => {
    const names = createFileTools(provider()).map(({ definition }) => definition.name);
    expect(names).toEqual([
      "files.list",
      "files.stat",
      "files.read",
      "files.search",
      "files.grep",
      "files.create",
      "files.replace",
      "files.append",
      "files.delete",
      "files.snapshot.create",
      "files.snapshot.list",
      "files.snapshot.restore",
    ]);
    expect(names.some((name) => name.startsWith("memory."))).toBe(false);
    expect(names.some((name) => name.startsWith("workspace."))).toBe(false);
  });

  it("maps mutating calls to distinct file actions and provider inputs", async () => {
    const invoke = vi.fn(async (operation: ResourceOperation): Promise<ResourceResult> => ({
      operationId: operation.operationId,
      status: "succeeded",
      output: { action: operation.action },
      completedAt: now,
    }));
    const kernel = new SharedOSKernel();
    for (const handler of createFileTools(provider(invoke))) kernel.registerTool(handler);
    const context = contextFor(["create", "replace", "append", "delete"]);
    const path = ["Memory", "Self", "MEMORY.md"];

    await kernel.invokeTool(context, call("files.create", { path, content: "# Memory" }));
    await kernel.invokeTool(
      context,
      call("files.replace", { path, content: "# Updated", expectedVersion: "v1" }),
    );
    await kernel.invokeTool(
      context,
      call("files.append", { path, content: "\n- Decision", expectedVersion: "v2" }),
    );
    await kernel.invokeTool(context, call("files.delete", { path }));

    expect(invoke.mock.calls.map(([operation]) => operation.action)).toEqual([
      "create",
      "replace",
      "append",
      "delete",
    ]);
    expect(invoke.mock.calls[3]?.[0].input).toEqual({ recursive: false });
  });

  it("does not widen append-only authority into replace or delete", async () => {
    const invoke = vi.fn(async (operation: ResourceOperation): Promise<ResourceResult> => ({
      operationId: operation.operationId,
      status: "succeeded",
      output: { action: operation.action },
      completedAt: now,
    }));
    const kernel = new SharedOSKernel();
    for (const handler of createFileTools(provider(invoke))) kernel.registerTool(handler);
    const context = contextFor(["append"], ["Memory", "Self", "Logs"]);
    const path = ["Memory", "Self", "Logs", "2026-08-07.md"];

    const appended = await kernel.invokeTool(
      context,
      call("files.append", { path, content: "- Durable decision" }),
    );
    const replaced = await kernel.invokeTool(
      context,
      call("files.replace", { path, content: "overwritten" }),
    );
    const deleted = await kernel.invokeTool(context, call("files.delete", { path }));

    expect(appended.status).toBe("succeeded");
    expect(replaced.status).toBe("denied");
    expect(deleted.status).toBe("denied");
    expect(invoke).toHaveBeenCalledOnce();
    expect(invoke.mock.calls[0]?.[0].action).toBe("append");
  });

  it("rejects providers from a second resource namespace", () => {
    expect(() => createFileTools({ ...provider(), namespace: "memory" })).toThrow(
      "Expected a files provider",
    );
  });
});
