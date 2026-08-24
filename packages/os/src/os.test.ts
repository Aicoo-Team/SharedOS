import { describe, expect, it, vi } from "vitest";

import type {
  AccessContext,
  CapabilityGrant,
  JsonObject,
  ResourceOperation,
  ResourceResult,
  ToolCall,
} from "@aicoo/sharedos-contracts";
import { SharedOSKernel, type GrantSource, type ResourceProvider } from "@aicoo/sharedos-core";

import { createFileTools, FILES_NAMESPACE } from "./index.js";

const now = "2026-08-03T00:00:00.000Z";
const actor = { kind: "agent", agentId: "agent-bob" } as const;
const owner = { kind: "human", userId: "user-alice" } as const;

function grantFor(actions: string[], path = ["Memory", "Self"]): CapabilityGrant {
  return {
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
}

function contextFor(): AccessContext {
  return {
    actor,
    authority: owner,
    owner,
    namespaceId: "world-1",
    enabledToolNamespaces: [FILES_NAMESPACE],
    purpose: "prepare-report",
    traceId: "trace-1",
    now,
  };
}

/** The trusted store the kernel loads authority from. */
function grantSource(grants: readonly CapabilityGrant[]): GrantSource {
  return {
    async load() {
      await Promise.resolve();
      return grants;
    },
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
    const kernel = new SharedOSKernel({ grantSource: grantSource([grantFor(["search"])]) });
    for (const handler of createFileTools(provider(invoke))) kernel.registerTool(handler);
    const context = contextFor();

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
    const kernel = new SharedOSKernel({
      grantSource: grantSource([grantFor(["create", "replace", "append", "delete"])]),
    });
    for (const handler of createFileTools(provider(invoke))) kernel.registerTool(handler);
    const context = contextFor();
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
    const kernel = new SharedOSKernel({
      grantSource: grantSource([grantFor(["append"], ["Memory", "Self", "Logs"])]),
    });
    for (const handler of createFileTools(provider(invoke))) kernel.registerTool(handler);
    const context = contextFor();
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

  it("does not let read or mutation authority reach snapshot restore", async () => {
    const invoke = vi.fn(async (operation: ResourceOperation): Promise<ResourceResult> => ({
      operationId: operation.operationId,
      status: "succeeded",
      output: { action: operation.action },
      completedAt: now,
    }));
    const kernel = new SharedOSKernel({
      grantSource: grantSource([
        grantFor([
          "read",
          "create",
          "replace",
          "append",
          "delete",
          "snapshot:create",
          "snapshot:list",
        ]),
      ]),
    });
    for (const handler of createFileTools(provider(invoke))) kernel.registerTool(handler);
    const context = contextFor();
    const path = ["Memory", "Self", "MEMORY.md"];

    // Everything a principal could hold short of restore itself: the whole read
    // and mutation vocabulary, plus the two snapshot actions that only look at
    // history. Rollback is a distinct action, so none of it reaches restore.
    const created = await kernel.invokeTool(context, call("files.snapshot.create", { path }));
    const listed = await kernel.invokeTool(context, call("files.snapshot.list", { path }));
    const restored = await kernel.invokeTool(
      context,
      call("files.snapshot.restore", { path, snapshotId: "snapshot-1" }),
    );

    expect(created.status).toBe("succeeded");
    expect(listed.status).toBe("succeeded");
    expect(restored).toMatchObject({ status: "denied", error: { code: "tool_unavailable" } });

    // Undiscoverable as well as uninvocable: a rollback path that showed up in
    // the catalogue would invite the call even though it could never succeed.
    const visible = (await kernel.listTools(context)).map(({ name }) => name);
    expect(visible).toContain("files.snapshot.create");
    expect(visible).not.toContain("files.snapshot.restore");

    // The refusal is an authorization decision, not a provider that declined.
    expect(invoke.mock.calls.map(([operation]) => operation.action)).toEqual([
      "snapshot:create",
      "snapshot:list",
    ]);
  });

  it("rejects providers from a second resource namespace", () => {
    expect(() => createFileTools({ ...provider(), namespace: "memory" })).toThrow(
      "Expected a files provider",
    );
  });
});
