import { describe, expect, it, vi } from "vitest";

import type {
  AccessContext,
  ExecutionRequest,
  RuntimeManifest,
  ToolDefinition,
  ToolResult,
} from "@sharedos/contracts";
import type { SharedOSKernel } from "@sharedos/core";

import {
  RuntimeNotFoundError,
  RuntimeRegistry,
  SharedOSExecutor,
  type RuntimeHost,
  type RuntimePlugin,
  type RuntimeTurnRequest,
} from "./index.js";

const now = "2026-08-14T00:00:00.000Z";
const sender = { kind: "agent", agentId: "agent-bob" } as const;
const receiver = { kind: "agent", agentId: "agent-alice" } as const;
const owner = { kind: "human", userId: "user-alice" } as const;

const tool: ToolDefinition = {
  name: "files.search",
  description: "Search authorized files",
  namespace: "files",
  source: "sharedos",
  readWrite: "read",
  inputSchema: { type: "object" },
  requiredCapability: {
    resource: { namespace: "files", path: [] },
    action: "search",
  },
};

const context: AccessContext = {
  actor: sender,
  authority: owner,
  owner,
  namespaceId: "namespace-1",
  enabledToolNamespaces: ["files"],
  purpose: "prepare-report",
  traceId: "trace-1",
  grants: [],
  now,
};

const manifest: RuntimeManifest = {
  id: "test.custom-runtime",
  version: "1.2.3",
  protocolVersion: "1",
  metadata: { harness: "test" },
};

function request(): ExecutionRequest {
  return {
    version: "1",
    executionId: "execution-1",
    agent: receiver,
    context,
    message: {
      version: "1",
      id: "message-1",
      sender,
      receiver,
      intent: "prepare",
      purpose: context.purpose,
      payload: { topic: "status" },
      traceId: context.traceId,
      createdAt: now,
    },
    tools: [tool],
  };
}

function kernel(
  result?: ToolResult,
): Pick<SharedOSKernel, "admitTurn" | "listTools" | "invokeTool"> {
  return {
    admitTurn: vi.fn(async () => ({
      allowed: true as const,
      reasonCode: "allowed" as const,
      matchedGrantId: "grant-turn",
    })),
    listTools: vi.fn(async () => [tool]),
    invokeTool: vi.fn(async (_context, call): Promise<ToolResult> => {
      return (
        result ?? {
          callId: call.id,
          tool: call.tool,
          status: "succeeded" as const,
          output: { hits: [] },
          completedAt: now,
        }
      );
    }),
  };
}

function runtime(
  run: RuntimePlugin["run"] = async () => ({ type: "complete", output: { ok: true } }),
): RuntimePlugin {
  return { manifest, run };
}

describe("RuntimePlugin security envelope", () => {
  it("runs a custom harness with sanitized input and authoritative provenance", async () => {
    let visibleRequest: RuntimeTurnRequest | undefined;
    const observedEvents: string[] = [];
    const plugin = runtime(async (input, host) => {
      visibleRequest = input;
      host.emit({ type: "turn.completed", data: { providerEvent: true } });
      return {
        type: "complete",
        output: { ok: true },
        metadata: { model: "test-model", runtime: "forged" },
      };
    });

    const result = await new SharedOSExecutor(kernel(), plugin, {
      clock: () => now,
      createId: () => "event-1",
    }).execute(request(), {
      onEvent: (event) => {
        observedEvents.push(event.type);
        expect(Object.isFrozen(event)).toBe(true);
      },
    });

    expect(result.status).toBe("succeeded");
    expect(visibleRequest?.tools).toEqual([tool]);
    expect(visibleRequest?.context).not.toHaveProperty("grants");
    expect(visibleRequest?.context).not.toHaveProperty("authority");
    expect(visibleRequest?.context).not.toHaveProperty("enabledToolNamespaces");
    expect(Object.isFrozen(visibleRequest)).toBe(true);
    expect(Object.isFrozen(visibleRequest?.context)).toBe(true);
    expect(result.metadata).toMatchObject({
      model: "test-model",
      runtime: {
        id: manifest.id,
        version: manifest.version,
        protocolVersion: "1",
        metadata: manifest.metadata,
      },
    });
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: "runtime.event",
        data: expect.objectContaining({ type: "turn.completed" }),
      }),
    );
    expect(result.events.filter(({ type }) => type === "turn.completed")).toHaveLength(1);
    expect(observedEvents).toEqual(result.events.map(({ type }) => type));
  });

  it("denies a plugin call outside the effective catalog without touching the kernel", async () => {
    const runtimeKernel = kernel();
    const plugin = runtime(async (_input, host) => {
      const result = await host.invokeTool({
        id: "call-hidden",
        tool: "files.delete",
        arguments: { path: ["secret"] },
        traceId: context.traceId,
        requestedAt: now,
      });
      return {
        type: "complete",
        output:
          result.status === "succeeded"
            ? { tool: result.tool, status: result.status, output: result.output }
            : {
                tool: result.tool,
                status: result.status,
                error: { code: result.error.code, message: result.error.message },
              },
      };
    });

    const result = await new SharedOSExecutor(runtimeKernel, plugin, {
      clock: () => now,
      createId: () => "event-1",
    }).execute(request());

    expect(result.status).toBe("succeeded");
    if (result.status === "succeeded") {
      expect(result.output).toMatchObject({
        tool: "files.delete",
        status: "denied",
        error: { code: "tool_not_available" },
      });
    }
    expect(runtimeKernel.invokeTool).not.toHaveBeenCalled();
  });

  it("re-authorizes an allowed custom-runtime call with the trusted context", async () => {
    const denied: ToolResult = {
      callId: "call-allowed",
      tool: tool.name,
      status: "denied",
      completedAt: now,
      error: { code: "no_matching_grant", message: "Denied at point of use" },
    };
    const runtimeKernel = kernel(denied);
    const plugin = runtime(async (_input, host) => {
      const result = await host.invokeTool({
        id: "call-allowed",
        tool: tool.name,
        arguments: { query: "status" },
        traceId: context.traceId,
        requestedAt: now,
      });
      return {
        type: "complete",
        output: {
          status: result.status,
          code: result.status === "succeeded" ? null : result.error.code,
        },
      };
    });

    const result = await new SharedOSExecutor(runtimeKernel, plugin, {
      clock: () => now,
      createId: () => "event-1",
    }).execute(request());

    expect(result.status).toBe("succeeded");
    expect(runtimeKernel.invokeTool).toHaveBeenCalledOnce();
    expect(runtimeKernel.invokeTool).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: sender,
        authority: owner,
        grants: context.grants,
      }),
      expect.objectContaining({ id: "call-allowed", tool: tool.name }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    if (result.status === "succeeded") {
      expect(result.output).toEqual({ status: "denied", code: "no_matching_grant" });
    }
  });

  it("does not open a custom runtime before target-agent admission", async () => {
    const runtimeKernel = kernel();
    runtimeKernel.admitTurn = vi.fn(async () => ({
      allowed: false,
      reasonCode: "no_matching_grant",
    }));
    const run = vi.fn<RuntimePlugin["run"]>();

    const result = await new SharedOSExecutor(runtimeKernel, runtime(run), {
      clock: () => now,
      createId: () => "event-1",
    }).execute(request());

    expect(result.status).toBe("denied");
    expect(run).not.toHaveBeenCalled();
    expect(runtimeKernel.listTools).not.toHaveBeenCalled();
  });

  it("fails closed when a custom runtime returns a malformed outcome", async () => {
    const plugin = runtime(async () => ({ type: "complete", output: undefined }) as never);

    const result = await new SharedOSExecutor(kernel(), plugin, {
      clock: () => now,
      createId: () => "event-1",
    }).execute(request());

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error.code).toBe("invalid_runtime_outcome");
    }
  });

  it("cancels a custom runtime at the SharedOS deadline", async () => {
    let runtimeSignal: AbortSignal | undefined;
    const plugin = runtime(async (_input, _host, signal) => {
      runtimeSignal = signal;
      return new Promise(() => undefined);
    });
    const input = request();
    input.options = { timeoutMs: 5 };

    const result = await new SharedOSExecutor(kernel(), plugin, {
      clock: () => now,
      createId: () => "event-1",
    }).execute(input);

    expect(result.status).toBe("cancelled");
    expect(runtimeSignal?.aborted).toBe(true);
  });

  it("closes the capability broker when a runtime returns", async () => {
    let capturedHost: RuntimeHost | undefined;
    const runtimeKernel = kernel();
    const plugin = runtime(async (_input, host) => {
      capturedHost = host;
      return { type: "complete", output: null };
    });

    const result = await new SharedOSExecutor(runtimeKernel, plugin, {
      clock: () => now,
      createId: () => "event-1",
    }).execute(request());
    expect(result.status).toBe("succeeded");

    await expect(
      capturedHost?.invokeTool({
        id: "call-late",
        tool: tool.name,
        arguments: { query: "late" },
        traceId: context.traceId,
        requestedAt: now,
      }),
    ).rejects.toThrow("Runtime host is closed");
    expect(runtimeKernel.invokeTool).not.toHaveBeenCalled();
  });

  it("enforces a tool-call ceiling independently of a custom harness loop", async () => {
    const runtimeKernel = kernel();
    const plugin = runtime(async (_input, host) => {
      const call = (id: string) =>
        host.invokeTool({
          id,
          tool: tool.name,
          arguments: { query: id },
          traceId: context.traceId,
          requestedAt: now,
        });
      const first = await call("call-1");
      const second = await call("call-2");
      return {
        type: "complete",
        output: {
          first: first.status,
          second: second.status,
          secondCode: second.status === "succeeded" ? null : second.error.code,
        },
      };
    });

    const result = await new SharedOSExecutor(runtimeKernel, plugin, {
      clock: () => now,
      createId: () => "event-1",
      defaultMaxToolCalls: 1,
    }).execute(request());

    expect(result.status).toBe("succeeded");
    if (result.status === "succeeded") {
      expect(result.output).toEqual({
        first: "succeeded",
        second: "denied",
        secondCode: "tool_call_limit_exceeded",
      });
    }
    expect(runtimeKernel.invokeTool).toHaveBeenCalledOnce();
  });

  it("does not let an observational event sink replace the turn outcome", async () => {
    const result = await new SharedOSExecutor(kernel(), runtime(), {
      clock: () => now,
      createId: () => "event-1",
    }).execute(request(), {
      onEvent: () => {
        throw new Error("stream consumer closed");
      },
    });

    expect(result.status).toBe("succeeded");
  });
});

describe("RuntimeRegistry", () => {
  it("validates, snapshots, and resolves trusted runtime registrations", () => {
    const plugin = runtime();
    const registry = new RuntimeRegistry([plugin]);

    expect(registry.has(manifest.id)).toBe(true);
    expect(registry.resolve(manifest.id).manifest).toEqual(manifest);
    expect(registry.list()).toEqual([manifest]);
    expect(() => registry.register(plugin)).toThrow("already registered");
    expect(() => registry.resolve("missing.runtime")).toThrow(RuntimeNotFoundError);

    const listed = registry.list()[0];
    if (listed !== undefined) {
      listed.version = "mutated";
    }
    expect(registry.resolve(manifest.id).manifest.version).toBe(manifest.version);
  });

  it("rejects malformed runtime manifests at registration and execution", () => {
    const malformed = {
      manifest: { id: "broken", version: "1" },
      run: async () => ({ type: "complete", output: null }) as const,
    } as unknown as RuntimePlugin;

    expect(() => new RuntimeRegistry([malformed])).toThrow("Runtime manifest");
    expect(() => new SharedOSExecutor(kernel(), malformed)).toThrow("Runtime manifest");
  });
});
