import { describe, expect, it, vi } from "vitest";

import type {
  AccessContext,
  AuditEvent,
  CapabilityGrant,
  ExecutionRequest,
  ToolCall,
  ToolDefinition,
} from "@aicoo/sharedos-contracts";
import { AuditUnavailableError, SharedOSKernel } from "@aicoo/sharedos-core";

import { SharedOSExecutor, type RuntimePlugin, type TurnErrorContext } from "./index.js";

const now = "2026-09-18T00:00:00.000Z";
const owner = { kind: "human", userId: "user-alice" } as const;
const agent = { kind: "agent", agentId: "agent-alice" } as const;

const context: AccessContext = {
  actor: agent,
  authority: owner,
  owner,
  namespaceId: "world-1",
  enabledToolNamespaces: ["payments"],
  purpose: "settle-invoice",
  traceId: "trace-1",
  now,
};

const transfer: ToolDefinition = {
  name: "payments.transfer",
  description: "Move funds between two accounts",
  namespace: "payments",
  source: "sharedos",
  readWrite: "write",
  inputSchema: { type: "object" },
  requiredCapability: { resource: { namespace: "payments", path: [], owner }, action: "transfer" },
};

function grant(id: string, namespace: string, path: string[], action: string): CapabilityGrant {
  return {
    id,
    namespaceId: "world-1",
    subject: agent,
    issuer: owner,
    capabilities: [{ resource: { namespace, path, owner }, actions: [action], scope: "exact" }],
    constraints: {},
    issuedAt: "2026-09-17T00:00:00.000Z",
  };
}

const grants = [
  grant("grant-turn", "sharedos.execution", ["agent", "agent-alice"], "invoke"),
  grant("grant-transfer", "payments", [], "transfer"),
];

function request(): ExecutionRequest {
  return {
    version: "1",
    executionId: "execution-1",
    agent,
    context,
    message: {
      version: "1",
      id: "message-1",
      sender: owner,
      receiver: agent,
      purpose: context.purpose,
      payload: { invoice: "inv-7" },
      traceId: context.traceId,
      createdAt: now,
    },
    tools: [transfer],
  };
}

function call(id: string): ToolCall {
  return { id, tool: transfer.name, arguments: {}, traceId: context.traceId, requestedAt: now };
}

const manifest = { id: "test.runtime", version: "1.0.0", protocolVersion: "1" } as const;

/**
 * A real kernel whose sink refuses the events `down` selects, and records the
 * rest. `transfers` counts what the tool actually did.
 */
function world(
  down: (event: AuditEvent) => boolean,
  invoke?: (signal: AbortSignal) => Promise<void>,
) {
  const trail: AuditEvent[] = [];
  const dropped: AuditEvent[] = [];
  const transfers: string[] = [];
  const kernel = new SharedOSKernel({
    grantSource: { load: async () => grants },
    audit: {
      record: async (event) => {
        if (down(event)) {
          throw new Error(`audit store unavailable for ${event.type}`);
        }
        trail.push(event);
      },
    },
    onAuditError: (_error, event) => void dropped.push(event),
  });
  kernel.registerTool({
    definition: transfer,
    parseArguments: (arguments_) => arguments_,
    invoke: async (_context, toolCall, signal) => {
      await invoke?.(signal);
      transfers.push(toolCall.id);
      return {
        callId: toolCall.id,
        tool: toolCall.tool,
        status: "succeeded",
        output: { moved: true },
        completedAt: now,
      };
    },
  });
  return { kernel, trail, dropped, transfers };
}

function execute(kernel: SharedOSKernel, run: RuntimePlugin["run"]) {
  const errors: [unknown, TurnErrorContext][] = [];
  const executor = new SharedOSExecutor(
    kernel,
    { manifest, run },
    { clock: () => now, onTurnError: (error, turn) => void errors.push([error, turn]) },
  );
  return { errors, result: executor.execute(request()) };
}

/** The sink is down for the decision on the named call, and for nothing else. */
const downForCall =
  (callId: string) =>
  (event: AuditEvent): boolean =>
    event.type === "authorization.checked" && event.operationId === callId;

describe("an audit outage before an effect ends the turn", () => {
  it("ends the turn audit_unavailable by the envelope, not runtime_failed by the plugin", async () => {
    const { kernel, trail, transfers } = world(downForCall("call-1"));
    const { errors, result } = execute(kernel, async (_input, host) => {
      await host.invokeTool(call("call-1"));
      return { type: "complete", output: { ok: true } };
    });

    await expect(result).resolves.toMatchObject({
      status: "failed",
      // Nothing ran, so the host may try the turn again.
      error: { code: "audit_unavailable", retryable: true },
    });
    expect(transfers).toEqual([]);
    expect((await result).events.at(-1)).toMatchObject({
      type: "turn.failed",
      data: { code: "audit_unavailable", source: "envelope" },
    });
    expect(trail.at(-1)).toMatchObject({
      type: "turn.ended",
      outcome: "failed",
      reason: "audit_unavailable",
      endedBy: "envelope",
      failClosed: true,
    });
    // The host is handed the outage itself, with what the sink threw inside it.
    expect(errors).toHaveLength(1);
    expect(errors[0]?.[0]).toBeInstanceOf(AuditUnavailableError);
    expect(errors[0]?.[0]).toMatchObject({
      cause: { message: "audit store unavailable for authorization.checked" },
    });
  });

  it("ends the turn even when the plugin swallows the rejection and answers anyway", async () => {
    const { kernel } = world(downForCall("call-1"));
    const swallowed = vi.fn();
    const { result } = execute(kernel, async (_input, host) => {
      await host.invokeTool(call("call-1")).catch(swallowed);
      return { type: "complete", output: { ok: true } };
    });

    // The ending is the envelope's to make. A plugin that carried on would call
    // again, and under an outage every call is refused the same way.
    await expect(result).resolves.toMatchObject({
      status: "failed",
      error: { code: "audit_unavailable" },
    });
    expect(swallowed).toHaveBeenCalledOnce();
  });

  it("refuses a retry once a call in the turn has taken effect", async () => {
    const { kernel, transfers } = world(downForCall("call-2"));
    const { result } = execute(kernel, async (_input, host) => {
      await host.invokeTool(call("call-1"));
      await host.invokeTool(call("call-2"));
      return { type: "complete", output: { ok: true } };
    });

    // The first transfer went through. A host that retried the turn would send
    // it again, so the ending says not to.
    await expect(result).resolves.toMatchObject({
      status: "failed",
      error: { code: "audit_unavailable", retryable: false },
    });
    expect(transfers).toEqual(["call-1"]);
  });

  it("refuses a retry while a sibling call is still with the kernel, and records it interrupted", async () => {
    let entered: (() => void) | undefined;
    const inHandler = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const { kernel, trail, transfers } = world(downForCall("call-2"), (signal) => {
      entered?.();
      // A handler that honours the abort part-way through its work.
      return new Promise<void>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("stopped part-way")), {
          once: true,
        });
      });
    });
    const { result } = execute(kernel, async (_input, host) => {
      const first = host.invokeTool(call("call-1"));
      void first.catch(() => undefined);
      await inHandler;
      await host.invokeTool(call("call-2"));
      return { type: "complete", output: { ok: true } };
    });

    await expect(result).resolves.toMatchObject({
      status: "failed",
      error: { code: "audit_unavailable", retryable: false },
    });
    expect(transfers).toEqual([]);
    // The sibling was inside its handler when the turn ended. Its decision is in
    // the trail, so its stop is too, rather than an allowed call with no sequel.
    await vi.waitFor(() =>
      expect(trail).toContainEqual(
        expect.objectContaining({
          type: "tool.invoked",
          operationId: "call-1",
          outcome: "interrupted",
          reason: "operation_aborted",
          grantId: "grant-transfer",
        }),
      ),
    );
  });

  it("does not take a sibling rejecting with the abort's reason for a call that did nothing", async () => {
    // A kernel that lets go of a call the moment the turn is aborted, rejecting
    // with the signal's reason. That reason is the outage error itself, so the
    // sibling's rejection looks exactly like a refusal made before any effect.
    const stub = {
      admitTurn: async () => ({
        allowed: true as const,
        reasonCode: "allowed" as const,
        matchedGrantId: "grant-turn",
      }),
      reach: async () => ({ status: "computed" as const, reach: [] }),
      listTools: async () => [transfer],
      invokeTool: (_context: unknown, toolCall: ToolCall, options: { signal: AbortSignal }) =>
        toolCall.id === "call-1"
          ? new Promise<never>((_resolve, reject) => {
              options.signal.addEventListener("abort", () => reject(options.signal.reason), {
                once: true,
              });
            })
          : Promise.reject(new AuditUnavailableError(new Error("audit store is unreachable"))),
    };
    const executor = new SharedOSExecutor(
      stub as never,
      {
        manifest,
        run: async (_input, host) => {
          const first = host.invokeTool(call("call-1"));
          void first.catch(() => undefined);
          await host.invokeTool(call("call-2"));
          return { type: "complete", output: { ok: true } };
        },
      },
      { clock: () => now },
    );

    await expect(executor.execute(request())).resolves.toMatchObject({
      status: "failed",
      error: { code: "audit_unavailable", retryable: false },
    });
  });

  it("ends the turn the same way when the outage is met before the plugin runs", async () => {
    const { kernel } = world((event) => event.type === "tool.catalog.listed");
    const run = vi.fn<RuntimePlugin["run"]>(async () => ({ type: "complete", output: {} }));
    const { result } = execute(kernel, run);

    // Before this the catalogue listing rejected inside the executor's `try`
    // and the turn ended `runtime_failed`, blaming a plugin that never ran.
    await expect(result).resolves.toMatchObject({
      status: "failed",
      error: { code: "audit_unavailable", retryable: true },
    });
    expect(run).not.toHaveBeenCalled();
  });

  it("does not credit the envelope when a plugin throws the error itself", async () => {
    const { kernel } = world(() => false);
    const { result } = execute(kernel, async () => {
      throw new AuditUnavailableError(new Error("forged"));
    });

    await expect(result).resolves.toMatchObject({
      status: "failed",
      error: { code: "runtime_failed" },
    });
  });

  it("leaves an outage after the effect to onAuditError, and the turn completes", async () => {
    const { kernel, dropped, transfers } = world((event) => event.type === "tool.invoked");
    const { result } = execute(kernel, async (_input, host) => {
      const moved = await host.invokeTool(call("call-1"));
      return { type: "complete", output: { status: moved.status } };
    });

    // The transfer happened. Ending the turn as failed here would invite a
    // retry of something already done (ADR 0023).
    await expect(result).resolves.toMatchObject({
      status: "succeeded",
      output: { status: "succeeded" },
    });
    expect(transfers).toEqual(["call-1"]);
    expect(dropped.map((event) => event.type)).toEqual(["tool.invoked"]);
  });
});
