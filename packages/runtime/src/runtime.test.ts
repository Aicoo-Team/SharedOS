import { describe, expect, it, vi } from "vitest";

import type {
  AccessContext,
  ExecutionRequest,
  ToolDefinition,
  ToolResult,
} from "@aicoo/sharedos-contracts";
import { SPAN, SharedOSKernel, type Span, type SpanSink } from "@aicoo/sharedos-core";
import type { CapabilityGrant } from "@aicoo/sharedos-contracts";

import {
  ESCALATION_REASON_MAX_LENGTH,
  ESCALATION_TOOL_DEFINITION,
  ESCALATION_TOOL_NAME,
  ESCALATION_TOOL_NAMESPACE,
  TurnExecutor,
  escalationReason,
  escalationRequest,
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
  actor: receiver,
  authority: owner,
  owner,
  namespaceId: "namespace-1",
  enabledToolNamespaces: ["files"],
  purpose: "prepare-report",
  traceId: "trace-1",
  now,
};

function request(options: { readonly escalation?: boolean } = {}): ExecutionRequest {
  const escalation = options.escalation === true;
  return {
    version: "1",
    executionId: "execution-1",
    agent: receiver,
    context: escalation
      ? { ...context, enabledToolNamespaces: ["files", ESCALATION_TOOL_NAMESPACE] }
      : context,
    message: {
      version: "1",
      id: "message-1",
      sender,
      receiver,
      purpose: context.purpose,
      payload: { topic: "status" },
      traceId: context.traceId,
      createdAt: now,
    },
    tools: [
      { ...tool, description: "Caller-supplied description" },
      ...(escalation ? [ESCALATION_TOOL_DEFINITION] : []),
    ],
  };
}

function kernel(
  result?: ToolResult,
  options: { readonly escalation?: boolean } = {},
): Pick<SharedOSKernel, "admitTurn" | "reach" | "listTools" | "invokeTool"> {
  const catalogue = options.escalation === true ? [tool, ESCALATION_TOOL_DEFINITION] : [tool];
  return {
    admitTurn: vi.fn(async () => ({
      allowed: true as const,
      reasonCode: "allowed" as const,
      matchedGrantId: "grant-turn",
    })),
    listTools: vi.fn(async () => catalogue),
    reach: vi.fn(async () => ({ status: "computed" as const, reach: [] })),
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
  it("tells the driver where it may operate, narrowed to what its catalogue can act on", async () => {
    const seen: unknown[] = [];
    const driver: AgentTurnDriver = {
      open: async (request) => {
        seen.push(request.context.reach);
        return { next: async () => ({ type: "complete" as const, output: null }) };
      },
    };
    const turnKernel = kernel();
    const files = {
      namespace: "files",
      path: ["Work", "atlas"],
      actions: ["read", "search"],
      scope: "descendants" as const,
    };
    turnKernel.reach = vi.fn(async () => ({
      status: "computed" as const,
      reach: [
        files,
        // Authorized, but no offered tool acts on it: not somewhere this turn
        // can work, so the driver is not sent there.
        {
          namespace: "sharedos.execution",
          path: ["agent", "agent-alice"],
          actions: ["invoke"],
          scope: "exact" as const,
        },
      ],
    }));

    await new TurnExecutor(turnKernel, driver).execute(request());

    expect(seen[0]).toEqual({ status: "computed", reach: [files] });
    // The point of the shape: nothing about who allowed it, for how long, or
    // how much budget is left.
    expect(JSON.stringify(seen[0])).not.toContain("grant");
  });

  it("hands the driver a reach it could not establish as such, and still runs the turn", async () => {
    const seen: unknown[] = [];
    const driver: AgentTurnDriver = {
      open: async (request) => {
        seen.push(request.context.reach);
        return { next: async () => ({ type: "complete" as const, output: null }) };
      },
    };
    const turnKernel = kernel();
    turnKernel.reach = vi.fn(async () => ({
      status: "unavailable" as const,
      reasonCode: "usage_store_unavailable" as const,
    }));

    const result = await new TurnExecutor(turnKernel, driver).execute(request());

    // Not an empty list, which would read as "nothing" and be false here.
    expect(seen[0]).toEqual({ status: "unavailable", reasonCode: "usage_store_unavailable" });
    expect(result.status).toBe("succeeded");
  });

  it("executes an inbound message as its recipient", async () => {
    const input = request();
    const runtimeKernel = kernel();
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
      .mockResolvedValueOnce({ type: "complete", output: { ok: true } });

    const result = await new TurnExecutor(
      runtimeKernel,
      {
        open: async () => ({ next }),
      },
      {
        clock: () => now,
        createId: () => "event-1",
      },
    ).execute(input);

    expect(result.status).toBe("succeeded");
    expect(runtimeKernel.admitTurn).toHaveBeenCalledWith(
      expect.objectContaining({ actor: receiver }),
      receiver,
      expect.anything(),
    );
    expect(runtimeKernel.listTools).toHaveBeenCalledWith(
      expect.objectContaining({ actor: receiver }),
      expect.anything(),
    );
    expect(runtimeKernel.invokeTool).toHaveBeenCalledWith(
      expect.objectContaining({ actor: receiver }),
      expect.objectContaining({ id: "call-1", tool: tool.name }),
      expect.anything(),
    );
  });

  it("ends the turn as escalated when the driver asks for a human", async () => {
    // The variant exists so a driver inside this loop can reach the terminal
    // outcome `RuntimeTurnOutcome` has always declared. Without it a driver
    // could only complete or fail, and every driven column reported the
    // escalation row as structurally unavailable -- a limit of this type rather
    // than of any vendor.
    const session: AgentTurnSession = {
      next: vi.fn<AgentTurnSession["next"]>(async () => ({
        type: "escalate",
        reason: "issuing a control-plane grant is outside this agent's authority",
      })),
    };
    const driver: AgentTurnDriver = { open: async () => session };

    const result = await new TurnExecutor(kernel(undefined, { escalation: true }), driver, {
      clock: () => now,
      createId: () => "event-1",
    }).execute(request({ escalation: true }));

    expect(result.status).toBe("escalated");
    expect(result.status === "escalated" ? result.escalation.reason : undefined).toBe(
      "issuing a control-plane grant is outside this agent's authority",
    );
    // Escalation is not failure. A turn that asked and a turn that broke are
    // different events, and collapsing them would lose the distinction the row
    // exists to record.
    expect(result.status).not.toBe("failed");
  });

  it("refuses an escalate decision whose reason is not a usable string", async () => {
    const session: AgentTurnSession = {
      next: vi.fn<AgentTurnSession["next"]>(
        async () => ({ type: "escalate", reason: "  " }) as never,
      ),
    };
    const driver: AgentTurnDriver = { open: async () => session };

    const result = await new TurnExecutor(kernel(), driver, {
      clock: () => now,
      createId: () => "event-1",
    }).execute(request());

    // Bounded exactly as the outcome is. A decision that parsed here but not as
    // an outcome would fail further in, where the cause is no longer visible.
    expect(result.status).toBe("failed");
    expect(result.status === "failed" ? result.error.code : undefined).toBe(
      "invalid_driver_decision",
    );
  });

  it("refuses an escalate decision whose metadata is not an object", async () => {
    const session: AgentTurnSession = {
      next: vi.fn<AgentTurnSession["next"]>(
        async () =>
          ({ type: "escalate", reason: "needs an owner", metadata: "not an object" }) as never,
      ),
    };
    const driver: AgentTurnDriver = { open: async () => session };

    const result = await new TurnExecutor(kernel(), driver, {
      clock: () => now,
      createId: () => "event-1",
    }).execute(request());

    // Parsed exactly as `complete`'s metadata is. An escalation whose metadata
    // failed further in would surface as a runtime failure with the cause gone.
    expect(result.status).toBe("failed");
    expect(result.status === "failed" ? result.error.code : undefined).toBe(
      "invalid_driver_decision",
    );
  });

  it("refuses an escalate decision whose reason runs past the outcome's bound", async () => {
    const session: AgentTurnSession = {
      next: vi.fn<AgentTurnSession["next"]>(async () => ({
        type: "escalate",
        reason: "x".repeat(ESCALATION_REASON_MAX_LENGTH + 1),
      })),
    };
    const driver: AgentTurnDriver = { open: async () => session };

    const result = await new TurnExecutor(kernel(), driver, {
      clock: () => now,
      createId: () => "event-1",
    }).execute(request());

    // A decision is code, not input. A driver handing the loop more than the
    // outcome carries has a bug, and refusing the decision is how it is found;
    // the recogniser a driver reads model output through is what cuts.
    expect(result.status).toBe("failed");
    expect(result.status === "failed" ? result.error.code : undefined).toBe(
      "invalid_driver_decision",
    );
  });

  it("refuses a declared step behind the loop's own position", async () => {
    // The declaration exists to reach past the budget. A driver naming a step
    // the loop has already passed is making a claim the loop can see is false,
    // and the record would otherwise carry it as the position of the call.
    const call = (id: string) => ({
      id,
      tool: tool.name,
      arguments: { query: "status" },
      traceId: context.traceId,
      requestedAt: now,
    });
    const next = vi
      .fn<AgentTurnSession["next"]>()
      .mockResolvedValueOnce({ type: "tool_call", call: call("call-1"), step: 1 })
      .mockResolvedValueOnce({ type: "tool_call", call: call("call-2"), step: 0 })
      .mockResolvedValue({ type: "complete", output: { ok: true } });
    const runtimeKernel = kernel();

    const result = await new TurnExecutor(
      runtimeKernel,
      { open: async () => ({ next }) },
      { clock: () => now, createId: () => "event-1" },
    ).execute(request());

    // The first call reached forward (1 at position 0) and went through; the
    // second reached back (0 at position 1) and ended the turn.
    expect(runtimeKernel.invokeTool).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("failed");
    expect(result.status === "failed" ? result.error.code : undefined).toBe(
      "invalid_driver_decision",
    );
  });

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

  it("denies a turn when the access actor differs from the executing agent", async () => {
    const input = request();
    input.context = { ...input.context, actor: sender };
    const runtimeKernel = kernel();
    const driver: AgentTurnDriver = { open: vi.fn() };

    const result = await new TurnExecutor(runtimeKernel, driver, {
      clock: () => now,
      createId: () => "event-1",
    }).execute(input);

    expect(result.status).toBe("denied");
    if (result.status === "denied") {
      expect(result.error.code).toBe("actor_mismatch");
    }
    expect(driver.open).not.toHaveBeenCalled();
    expect(runtimeKernel.admitTurn).not.toHaveBeenCalled();
    expect(runtimeKernel.listTools).not.toHaveBeenCalled();
    expect(runtimeKernel.invokeTool).not.toHaveBeenCalled();
  });

  it("denies a turn when the message receiver differs from the executing agent", async () => {
    const input = request();
    input.message.receiver = sender;
    const runtimeKernel = kernel();
    const driver: AgentTurnDriver = { open: vi.fn() };

    const result = await new TurnExecutor(runtimeKernel, driver, {
      clock: () => now,
      createId: () => "event-1",
    }).execute(input);

    expect(result.status).toBe("denied");
    if (result.status === "denied") {
      expect(result.error.code).toBe("receiver_mismatch");
    }
    expect(driver.open).not.toHaveBeenCalled();
    expect(runtimeKernel.admitTurn).not.toHaveBeenCalled();
    expect(runtimeKernel.listTools).not.toHaveBeenCalled();
    expect(runtimeKernel.invokeTool).not.toHaveBeenCalled();
  });

  it("denies a turn when the message purpose differs from the access context", async () => {
    const input = request();
    input.message.purpose = "different-purpose";
    const runtimeKernel = kernel();
    const driver: AgentTurnDriver = { open: vi.fn() };

    const result = await new TurnExecutor(runtimeKernel, driver, {
      clock: () => now,
      createId: () => "event-1",
    }).execute(input);

    expect(result.status).toBe("denied");
    if (result.status === "denied") {
      expect(result.error.code).toBe("message_context_mismatch");
    }
    expect(driver.open).not.toHaveBeenCalled();
    expect(runtimeKernel.admitTurn).not.toHaveBeenCalled();
    expect(runtimeKernel.listTools).not.toHaveBeenCalled();
    expect(runtimeKernel.invokeTool).not.toHaveBeenCalled();
  });

  it("denies a turn when the message trace differs from the access context", async () => {
    const input = request();
    input.message.traceId = "different-trace";
    const runtimeKernel = kernel();
    const driver: AgentTurnDriver = { open: vi.fn() };

    const result = await new TurnExecutor(runtimeKernel, driver, {
      clock: () => now,
      createId: () => "event-1",
    }).execute(input);

    expect(result.status).toBe("denied");
    if (result.status === "denied") {
      expect(result.error.code).toBe("message_context_mismatch");
    }
    expect(driver.open).not.toHaveBeenCalled();
    expect(runtimeKernel.admitTurn).not.toHaveBeenCalled();
    expect(runtimeKernel.listTools).not.toHaveBeenCalled();
    expect(runtimeKernel.invokeTool).not.toHaveBeenCalled();
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
    const runtimeKernel: Pick<SharedOSKernel, "admitTurn" | "reach" | "listTools" | "invokeTool"> =
      {
        admitTurn: async () => ({
          allowed: true,
          reasonCode: "allowed",
          matchedGrantId: "grant-turn",
        }),
        reach: async () => ({ status: "computed", reach: [] }),
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

  it("forwards a span sink to the executor it fronts", async () => {
    const spans: Span[] = [];
    const sink: SpanSink = { record: (span) => void spans.push(span) };
    const next = vi
      .fn<AgentTurnSession["next"]>()
      .mockResolvedValueOnce({ type: "complete", output: { ok: true } });

    const result = await new TurnExecutor(
      kernel(),
      { open: async () => ({ next }) },
      { clock: () => now, createId: () => "event-1", spans: sink },
    ).execute(request());

    expect(result.status).toBe("succeeded");
    expect(spans.map((span) => span.name)).toContain(SPAN.TURN);
  });

  it("forwards a turn-error sink to the executor it fronts", async () => {
    // The same defect the span sink had: the facade forwards its options one by
    // one, so a new one is dropped silently unless it is added here too, and a
    // host installing a diagnostic on the facade would be told nothing by a
    // hook that never fires.
    const thrown = new Error("the driver's session store is down");
    const seen: unknown[] = [];
    const driver: AgentTurnDriver = {
      open: async () => {
        throw thrown;
      },
    };

    const result = await new TurnExecutor(kernel(), driver, {
      clock: () => now,
      createId: () => "event-1",
      onTurnError: (error) => void seen.push(error),
    }).execute(request());

    // The loop caught this one, not the envelope: a driver's throw becomes the
    // cooperative `driver_failed` outcome and never reaches the executor's
    // catch. So the facade has to forward the sink to both, and one hook covers
    // both containment sites.
    expect(result.status).toBe("failed");
    expect(result.status === "failed" ? result.error.code : undefined).toBe("driver_failed");
    expect(seen).toEqual([thrown]);
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

describe("recognising an escalation in a call", () => {
  it("keeps the reason as given, cut to the bound rather than replaced", () => {
    const given = "needs an owner: " + "y".repeat(ESCALATION_REASON_MAX_LENGTH * 2);
    const recognised = escalationRequest(ESCALATION_TOOL_NAME, { reason: given });

    // The occupant's own words, and the first 512 of them: replacing the whole
    // reason with the canned fallback would record that nothing was said.
    expect(recognised).toBe(given.slice(0, ESCALATION_REASON_MAX_LENGTH));
    expect(recognised).toHaveLength(ESCALATION_REASON_MAX_LENGTH);
    expect(escalationRequest(ESCALATION_TOOL_NAME, { reason: "  short  " })).toBe("short");
  });

  it("does not cut through a surrogate pair at the bound", () => {
    const reason = "z".repeat(ESCALATION_REASON_MAX_LENGTH - 1) + "\u{1F600}" + "tail";
    const recognised = escalationRequest(ESCALATION_TOOL_NAME, { reason });

    expect(recognised).toBe("z".repeat(ESCALATION_REASON_MAX_LENGTH - 1));
    expect(recognised).not.toMatch(/[\uD800-\uDBFF]$/u);
  });

  it("escalates under a reason of its own when the call carries none it can read", () => {
    const fallback = "the turn asked for a human decision without saying what needs deciding";

    expect(escalationRequest(ESCALATION_TOOL_NAME, {})).toBe(fallback);
    expect(escalationRequest(ESCALATION_TOOL_NAME, { reason: "   " })).toBe(fallback);
    expect(escalationRequest(ESCALATION_TOOL_NAME, { reason: 42 })).toBe(fallback);
    expect(escalationRequest(ESCALATION_TOOL_NAME, "not an object")).toBe(fallback);
    expect(escalationRequest(ESCALATION_TOOL_NAME, undefined)).toBe(fallback);
  });

  it("recognises nothing but the affordance's own name", () => {
    expect(escalationRequest("files.read", { reason: "please" })).toBeUndefined();
    expect(escalationRequest("sharedos.escalate.now", { reason: "please" })).toBeUndefined();
  });

  it("bounds a decision's reason strictly, as the outcome does", () => {
    expect(escalationReason("x".repeat(ESCALATION_REASON_MAX_LENGTH))).toHaveLength(
      ESCALATION_REASON_MAX_LENGTH,
    );
    expect(escalationReason("x".repeat(ESCALATION_REASON_MAX_LENGTH + 1))).toBeUndefined();
    expect(escalationReason("   ")).toBeUndefined();
    expect(escalationReason(7)).toBeUndefined();
  });
});
