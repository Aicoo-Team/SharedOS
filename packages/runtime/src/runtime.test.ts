import { describe, expect, it, vi } from "vitest";

import type {
  AccessContext,
  ExecutionRequest,
  ToolDefinition,
  ToolResult,
} from "@aicoo/sharedos-contracts";
import { SharedOSKernel } from "@aicoo/sharedos-core";
import type { CapabilityGrant } from "@aicoo/sharedos-contracts";

import {
  TurnExecutor,
  type AgentTurnDriver,
  type AgentTurnRequest,
  type AgentTurnSession,
} from "./index.js";

const now = "2026-08-03T00:00:00.000Z";
const sender = { kind: "agent", agentId: "agent-bob" } as const;
const receiver = { kind: "agent", agentId: "agent-alice" } as const;
const owner = { kind: "human", userId: "user-alice" } as const;

const tool: ToolDefinition = {
  name: "files.search",
  description: "Authoritative registry definition",
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
  now,
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
    tools: [{ ...tool, description: "Caller-supplied description" }],
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

describe("TurnExecutor", () => {
  it("uses the registry's permission-filtered tool definition", async () => {
    let openedRequest: AgentTurnRequest | undefined;
    const session: AgentTurnSession = {
      next: vi.fn<AgentTurnSession["next"]>(async () => ({
        type: "complete",
        output: { ok: true },
      })),
    };
    const driver: AgentTurnDriver = {
      open: vi.fn(async (input) => {
        openedRequest = input;
        return session;
      }),
    };

    const result = await new TurnExecutor(kernel(), driver, {
      clock: () => now,
      createId: () => "event-1",
    }).execute(request());

    expect(result.status).toBe("succeeded");
    expect(openedRequest?.tools).toEqual([tool]);
    expect(openedRequest?.context).not.toHaveProperty("grants");
    expect(openedRequest?.context).not.toHaveProperty("authority");
    expect(openedRequest?.context).not.toHaveProperty("enabledToolNamespaces");
  });

  it("feeds permission-checked tool results back into the driver", async () => {
    const denied: ToolResult = {
      callId: "call-1",
      tool: tool.name,
      status: "denied",
      completedAt: now,
      error: { code: "no_matching_grant", message: "Denied" },
    };
    const next = vi
      .fn<AgentTurnSession["next"]>()
      .mockResolvedValueOnce({
        type: "tool_call",
        call: {
          id: "call-1",
          tool: tool.name,
          arguments: { query: "status" },
          traceId: context.traceId,
          requestedAt: now,
        },
      })
      .mockResolvedValueOnce({ type: "complete", output: { handled: true } });
    const driver: AgentTurnDriver = { open: async () => ({ next }) };
    const runtimeKernel = kernel(denied);

    const result = await new TurnExecutor(runtimeKernel, driver, {
      clock: () => now,
      createId: () => "event-1",
    }).execute(request());

    expect(result.status).toBe("succeeded");
    expect(runtimeKernel.invokeTool).toHaveBeenCalledOnce();
    expect(next).toHaveBeenNthCalledWith(
      2,
      { type: "tool_result", result: denied },
      expect.anything(),
    );
  });

  it("denies a turn when message authority does not match", async () => {
    const input = request();
    input.message.sender = { kind: "agent", agentId: "forged-agent" };
    const driver: AgentTurnDriver = { open: vi.fn() };

    const result = await new TurnExecutor(kernel(), driver, {
      clock: () => now,
      createId: () => "event-1",
    }).execute(input);

    expect(result.status).toBe("denied");
    expect(driver.open).not.toHaveBeenCalled();
  });

  it("denies a turn before opening the driver without an execution grant", async () => {
    const runtimeKernel = kernel();
    runtimeKernel.admitTurn = vi.fn(async () => ({
      allowed: false,
      reasonCode: "no_matching_grant",
    }));
    const driver: AgentTurnDriver = { open: vi.fn() };

    const result = await new TurnExecutor(runtimeKernel, driver, {
      clock: () => now,
      createId: () => "event-1",
    }).execute(request());

    expect(result.status).toBe("denied");
    expect(driver.open).not.toHaveBeenCalled();
    expect(runtimeKernel.listTools).not.toHaveBeenCalled();
  });

  it("does not dispatch a tool outside the effective catalog", async () => {
    const next = vi
      .fn<AgentTurnSession["next"]>()
      .mockResolvedValueOnce({
        type: "tool_call",
        call: {
          id: "call-hidden",
          tool: "files.delete",
          arguments: { path: ["secret"], content: "changed" },
          traceId: context.traceId,
          requestedAt: now,
        },
      })
      .mockResolvedValueOnce({ type: "complete", output: { handled: true } });
    const runtimeKernel = kernel();

    const result = await new TurnExecutor(
      runtimeKernel,
      { open: async () => ({ next }) },
      { clock: () => now, createId: () => "event-1" },
    ).execute(request());

    expect(result.status).toBe("succeeded");
    expect(runtimeKernel.invokeTool).not.toHaveBeenCalled();
    expect(next).toHaveBeenNthCalledWith(
      2,
      {
        type: "tool_result",
        result: expect.objectContaining({
          tool: "files.delete",
          status: "denied",
          error: expect.objectContaining({ code: "tool_unavailable" }),
        }),
      },
      expect.anything(),
    );
  });

  it("fails closed on a malformed driver decision", async () => {
    const driver: AgentTurnDriver = {
      open: async () => ({
        next: async () => ({ type: "complete", output: undefined }) as never,
      }),
    };

    const result = await new TurnExecutor(kernel(), driver, {
      clock: () => now,
      createId: () => "event-1",
    }).execute(request());

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error.code).toBe("invalid_driver_decision");
    }
  });

  it("applies timeout while loading the visible tool catalog", async () => {
    const runtimeKernel: Pick<SharedOSKernel, "admitTurn" | "listTools" | "invokeTool"> = {
      admitTurn: async () => ({
        allowed: true,
        reasonCode: "allowed",
        matchedGrantId: "grant-turn",
      }),
      listTools: async () => new Promise(() => undefined),
      invokeTool: vi.fn(),
    };
    const input = request();
    input.options = { timeoutMs: 5 };
    const driver: AgentTurnDriver = { open: vi.fn() };

    const result = await new TurnExecutor(runtimeKernel, driver, {
      clock: () => now,
      createId: () => "event-1",
    }).execute(input);

    expect(result.status).toBe("cancelled");
    expect(driver.open).not.toHaveBeenCalled();
  });

  it("propagates timeout cancellation to a running tool", async () => {
    let sideEffect = false;
    const runtimeKernel = kernel();
    runtimeKernel.invokeTool = vi.fn(async (_access, call, options) => {
      return new Promise<ToolResult>((resolve, reject) => {
        const timer = setTimeout(() => {
          sideEffect = true;
          resolve({
            callId: call.id,
            tool: call.tool,
            status: "succeeded",
            output: null,
            completedAt: now,
          });
        }, 50);
        options.signal?.addEventListener(
          "abort",
          () => {
            clearTimeout(timer);
            reject(options.signal?.reason);
          },
          { once: true },
        );
      });
    });
    const input = request();
    input.options = { timeoutMs: 5 };
    const driver: AgentTurnDriver = {
      open: async () => ({
        next: async () => ({
          type: "tool_call",
          call: {
            id: "call-1",
            tool: tool.name,
            arguments: { query: "status" },
            traceId: context.traceId,
            requestedAt: now,
          },
        }),
      }),
    };

    const result = await new TurnExecutor(runtimeKernel, driver, {
      clock: () => now,
      createId: () => "event-1",
    }).execute(input);
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(result.status).toBe("cancelled");
    expect(sideEffect).toBe(false);
  });

  it("bounds a provider session that hangs while closing", async () => {
    const driver: AgentTurnDriver = {
      open: async () => ({
        next: async () => ({ type: "complete", output: null }),
        close: async () => new Promise(() => undefined),
      }),
    };

    const result = await new TurnExecutor(kernel(), driver, {
      clock: () => now,
      createId: () => "event-1",
      closeTimeoutMs: 5,
    }).execute(request());

    expect(result.status).toBe("succeeded");
  });
});

describe("turn-scoped authority", () => {
  const agentGrant: CapabilityGrant = {
    id: "grant-turn",
    namespaceId: "world-1",
    subject: receiver,
    issuer: owner,
    capabilities: [
      {
        resource: { namespace: "sharedos.execution", path: ["agent", "agent-alice"], owner },
        actions: ["invoke"],
        scope: "exact",
      },
    ],
    constraints: {},
    issuedAt: "2026-08-02T00:00:00.000Z",
  };

  const completingDriver: AgentTurnDriver = {
    open: async () => ({ next: async () => ({ type: "complete", output: { ok: true } }) }),
  };

  it("releases the turn's authority when the turn is cancelled while it is being resolved", async () => {
    let loads = 0;
    let revoked = false;
    let releaseLoad: (() => void) | undefined;

    const kernel = new SharedOSKernel({
      grantSource: {
        async load() {
          loads += 1;
          if (loads === 1) {
            await new Promise<void>((resolve) => {
              releaseLoad = resolve;
            });
          }
          return revoked ? [] : [agentGrant];
        },
      },
    });
    const executor = new TurnExecutor(kernel, completingDriver, { clock: () => now });

    const controller = new AbortController();
    const cancelled = executor.execute(request(), { signal: controller.signal });
    // Abort while the very first authority load is still in flight.
    await Promise.resolve();
    controller.abort();
    await expect(cancelled).resolves.toMatchObject({ status: "cancelled" });

    // Let the abandoned load finish, and revoke before the next turn opens.
    releaseLoad?.();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    revoked = true;

    // The abandoned lease must not answer this turn.
    await expect(executor.execute(request())).resolves.toMatchObject({
      status: "denied",
      error: { code: "no_matching_grant" },
    });
    expect(loads).toBe(2);
  });
});
