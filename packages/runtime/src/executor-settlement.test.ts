import { describe, expect, it, vi } from "vitest";

import type {
  ExecutionRequest,
  ToolDefinition,
  ToolResultIngestionEnvelope,
} from "@aicoo/sharedos-contracts";
import { SharedOSKernel, type AuditSink, type ToolHandler } from "@aicoo/sharedos-core";

import { TurnExecutor } from "./executor.js";
import { createEscalationTool, ESCALATION_TOOL_DEFINITION } from "./escalation.js";

const now = "2026-09-14T00:00:00.000Z";
const actor = { kind: "agent", agentId: "actor-1" } as const;
const owner = { kind: "human", userId: "owner-1" } as const;
const tool: ToolDefinition = {
  name: "files.replace",
  namespace: "files",
  source: "sharedos",
  description: "Replace one file",
  readWrite: "write",
  inputSchema: { type: "object" },
  requiredCapability: {
    resource: { namespace: "files", path: ["MEMORY.md"] },
    action: "write",
  },
};
const call = {
  id: "call-1",
  tool: tool.name,
  arguments: {},
  traceId: "trace-1",
  requestedAt: now,
};

function gate() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function ack(envelope: ToolResultIngestionEnvelope) {
  const { result: _result, ...identity } = envelope;
  return identity;
}

function request(): ExecutionRequest {
  return {
    version: "1",
    executionId: "execution-1",
    agent: actor,
    context: {
      actor,
      authority: owner,
      owner,
      namespaceId: "world-1",
      enabledToolNamespaces: ["files"],
      purpose: "settlement-test",
      traceId: "trace-1",
      now,
    },
    message: {
      version: "1",
      id: "message-1",
      sender: owner,
      receiver: actor,
      purpose: "settlement-test",
      traceId: "trace-1",
      payload: null,
      createdAt: now,
    },
    tools: [],
  };
}

function kernel(
  options: { audit?: AuditSink; invoke?: ToolHandler["invoke"] } = {},
): SharedOSKernel {
  const result = new SharedOSKernel({
    ...(options.audit === undefined ? {} : { audit: options.audit }),
    grantSource: {
      load: async () => [
        {
          id: "grant-turn",
          namespaceId: "world-1",
          subject: actor,
          issuer: owner,
          capabilities: [
            {
              resource: { namespace: "sharedos.execution", path: ["agent", "actor-1"], owner },
              actions: ["invoke"],
              scope: "exact",
            },
            { resource: tool.requiredCapability.resource, actions: ["write"], scope: "exact" },
            {
              resource: ESCALATION_TOOL_DEFINITION.requiredCapability.resource,
              actions: ["request"],
              scope: "exact",
            },
          ],
          constraints: {},
          issuedAt: "2026-09-13T00:00:00.000Z",
        },
      ],
    },
  });
  result.registerTool({
    definition: tool,
    parseArguments: (input) => input,
    invoke:
      options.invoke ??
      (async (_context, input) => ({
        callId: input.id,
        tool: input.tool,
        status: "succeeded",
        output: { version: 1 },
        completedAt: now,
      })),
  });
  result.registerTool(createEscalationTool());
  return result;
}

describe("executor settlement profile", () => {
  it("selects the non-generative ingestion session and awaits explicit finish and cleanup", async () => {
    const next = vi.fn(async () => ({ type: "complete" as const, output: "legacy" }));
    const finish = vi.fn(async () => undefined);
    const close = vi.fn(async () => undefined);
    const executor = new TurnExecutor(
      kernel(),
      {
        open: async () => ({
          next,
          settlement: {
            version: "1" as const,
            nextDecision: async () => ({ type: "complete" as const, output: "settlement" }),
            ingestToolResult: vi.fn(),
            finish,
            close,
          },
        }),
      },
      { clock: () => now, settlement: { version: "1", timeoutMs: 100 } },
    );

    const result = await executor.execute(request());
    expect(result).toMatchObject({
      status: "succeeded",
      output: "settlement",
      settlement: { version: "1", status: "settled" },
    });
    expect(next).not.toHaveBeenCalled();
    expect(finish).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("fails unsupported drivers before generating under the opt-in profile", async () => {
    const next = vi.fn(async () => ({ type: "complete" as const, output: null }));
    const result = await new TurnExecutor(
      kernel(),
      { open: async () => ({ next }) },
      { clock: () => now, settlement: { version: "1", timeoutMs: 100 } },
    ).execute(request());
    expect(result.status).toBe("failed");
    expect(result.settlement?.status).toBe("unsupported");
    expect(next).not.toHaveBeenCalled();
  });

  it("validates the independent settlement budget", () => {
    const driver = {
      open: async () => ({ next: async () => ({ type: "complete" as const, output: null }) }),
    };
    for (const timeoutMs of [0, -1, Infinity, 1.5, 60_001]) {
      expect(
        () =>
          new TurnExecutor(kernel(), driver, {
            settlement: { version: "1", timeoutMs },
          }),
      ).toThrow();
    }
  });

  it("keeps the legacy profile and result shape unchanged", async () => {
    const next = vi.fn(async () => ({ type: "complete" as const, output: "legacy" }));
    const result = await new TurnExecutor(
      kernel(),
      { open: async () => ({ next }) },
      { clock: () => now },
    ).execute(request());
    expect(result).toMatchObject({ status: "succeeded", output: "legacy" });
    expect(result).not.toHaveProperty("settlement");
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("delivers the actual result before gated audit and drains without another decision after cancel", async () => {
    const auditEntered = gate();
    const auditRelease = gate();
    const ingested = gate();
    const controller = new AbortController();
    const order: string[] = [];
    let effects = 0;
    const actualKernel = kernel({
      audit: {
        record: async (event) => {
          if (event.type === "tool.invoked") {
            auditEntered.resolve();
            await auditRelease.promise;
            order.push("audit");
          }
        },
      },
      invoke: async () => {
        effects += 1;
        order.push("effect");
        return {
          callId: call.id,
          tool: call.tool,
          status: "succeeded",
          output: { version: 1 },
          completedAt: now,
        };
      },
    });
    const nextDecision = vi.fn(async () => ({ type: "tool_call" as const, call }));
    const finish = vi.fn(async () => {
      order.push("finish");
    });
    const close = vi.fn(async () => {
      order.push("close");
    });
    const resultPromise = new TurnExecutor(
      actualKernel,
      {
        open: async () => ({
          next: vi.fn(),
          settlement: {
            version: "1",
            nextDecision,
            ingestToolResult: async (envelope) => {
              order.push("ack");
              controller.abort();
              ingested.resolve();
              return ack(envelope);
            },
            finish,
            close,
          },
        }),
      },
      { clock: () => now, settlement: { version: "1", timeoutMs: 200 } },
    ).execute({ ...request(), tools: [tool] }, { signal: controller.signal });
    await Promise.all([auditEntered.promise, ingested.promise]);
    expect(finish).not.toHaveBeenCalled();
    auditRelease.resolve();
    const result = await resultPromise;
    expect(result).toMatchObject({ status: "cancelled", settlement: { status: "settled" } });
    expect(result.settlement?.operations[0]).toMatchObject({
      result: "ready",
      ingestion: "acknowledged",
      audit: "recorded",
    });
    expect(order).toEqual(["effect", "ack", "audit", "finish", "close"]);
    expect(nextDecision).toHaveBeenCalledTimes(1);
    expect(effects).toBe(1);
    expect(result.events.filter((event) => event.type === "tool.completed")).toHaveLength(1);
  });

  it("does not finish history while an admitted result is still being persisted", async () => {
    const ingestionEntered = gate();
    const persist = gate();
    const controller = new AbortController();
    const finish = vi.fn(async () => undefined);
    const nextDecision = vi.fn(async () => ({ type: "tool_call" as const, call }));
    const resultPromise = new TurnExecutor(
      kernel(),
      {
        open: async () => ({
          next: vi.fn(),
          settlement: {
            version: "1",
            nextDecision,
            ingestToolResult: async (envelope) => {
              ingestionEntered.resolve();
              await persist.promise;
              return ack(envelope);
            },
            finish,
            close: async () => undefined,
          },
        }),
      },
      { clock: () => now, settlement: { version: "1", timeoutMs: 200 } },
    ).execute({ ...request(), tools: [tool] }, { signal: controller.signal });
    await ingestionEntered.promise;
    controller.abort();
    await Promise.resolve();
    expect(finish).not.toHaveBeenCalled();
    persist.resolve();
    const result = await resultPromise;
    expect(result).toMatchObject({ status: "cancelled", settlement: { status: "settled" } });
    expect(finish).toHaveBeenCalledOnce();
    expect(nextDecision).toHaveBeenCalledOnce();
  });

  it("keeps joining finish when the caller cancels after ACK but before finish completes", async () => {
    const finishing = gate();
    const finishRelease = gate();
    const controller = new AbortController();
    const ingestToolResult = vi.fn(async (envelope: ToolResultIngestionEnvelope) => ack(envelope));
    const nextDecision = vi
      .fn()
      .mockResolvedValueOnce({ type: "tool_call", call })
      .mockResolvedValueOnce({ type: "complete", output: "done" });
    let returned = false;
    const resultPromise = new TurnExecutor(
      kernel(),
      {
        open: async () => ({
          next: vi.fn(),
          settlement: {
            version: "1",
            nextDecision,
            ingestToolResult,
            finish: async () => {
              finishing.resolve();
              await finishRelease.promise;
            },
            close: async () => undefined,
          },
        }),
      },
      { clock: () => now, settlement: { version: "1", timeoutMs: 200 } },
    )
      .execute({ ...request(), tools: [tool] }, { signal: controller.signal })
      .then((result) => {
        returned = true;
        return result;
      });
    await finishing.promise;
    expect(ingestToolResult).toHaveBeenCalledOnce();
    controller.abort();
    await Promise.resolve();
    expect(returned).toBe(false);
    finishRelease.resolve();
    // Work had already completed before cancellation; cancellation of cleanup
    // neither abandons finish nor rewrites the previously decided work outcome.
    expect(await resultPromise).toMatchObject({
      status: "succeeded",
      settlement: { status: "settled" },
    });
  });

  it("returns incomplete for an unresolved handler without replay or late report mutation", async () => {
    const entered = gate();
    const release = gate();
    const controller = new AbortController();
    const invoke = vi.fn(async () => {
      entered.resolve();
      await release.promise;
      return {
        callId: call.id,
        tool: call.tool,
        status: "succeeded" as const,
        output: null,
        completedAt: now,
      };
    });
    const ingestToolResult = vi.fn(async (envelope: ToolResultIngestionEnvelope) => ack(envelope));
    const finish = vi.fn(async () => undefined);
    const resultPromise = new TurnExecutor(
      kernel({ invoke }),
      {
        open: async () => ({
          next: vi.fn(),
          settlement: {
            version: "1",
            nextDecision: async () => ({ type: "tool_call", call }),
            ingestToolResult,
            finish,
            close: async () => undefined,
          },
        }),
      },
      { clock: () => now, settlement: { version: "1", timeoutMs: 10 } },
    ).execute({ ...request(), tools: [tool] }, { signal: controller.signal });
    await entered.promise;
    controller.abort();
    const result = await resultPromise;
    expect(result).toMatchObject({
      status: "cancelled",
      settlement: { status: "incomplete", pendingOperationIds: [call.id] },
    });
    const frozen = JSON.stringify(result);
    release.resolve();
    await invoke.mock.results[0]!.value;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(JSON.stringify(result)).toBe(frozen);
    expect(invoke).toHaveBeenCalledOnce();
    expect(ingestToolResult).not.toHaveBeenCalled();
    expect(finish).not.toHaveBeenCalled();
  });

  it("bounds terminal audit with the same settlement budget", async () => {
    const release = gate();
    const finish = vi.fn(async () => undefined);
    const result = await new TurnExecutor(
      kernel({
        audit: {
          record: async (event) => {
            if (event.type === "turn.ended") await release.promise;
          },
        },
      }),
      {
        open: async () => ({
          next: vi.fn(),
          settlement: {
            version: "1",
            nextDecision: async () => ({ type: "complete", output: null }),
            ingestToolResult: vi.fn(),
            finish,
            close: async () => undefined,
          },
        }),
      },
      { clock: () => now, settlement: { version: "1", timeoutMs: 10 } },
    ).execute(request());
    expect(result).toMatchObject({
      status: "succeeded",
      settlement: {
        status: "incomplete",
        pendingWorkIds: ["turn-end-audit"],
      },
    });
    expect(finish).not.toHaveBeenCalled();
    release.resolve();
  });

  it("does not finish a cancelled escalation while its admitted audit is still pending", async () => {
    const entered = gate();
    const release = gate();
    const controller = new AbortController();
    const finish = vi.fn(async () => undefined);
    const actualKernel = kernel({
      audit: {
        record: async (event) => {
          if (event.type === "escalation.requested") {
            entered.resolve();
            await release.promise;
          }
        },
      },
    });
    const input = request();
    const resultPromise = new TurnExecutor(
      actualKernel,
      {
        open: async () => ({
          next: vi.fn(),
          settlement: {
            version: "1",
            nextDecision: async () => ({ type: "escalate", reason: "Needs authority" }),
            ingestToolResult: vi.fn(),
            finish,
            close: async () => undefined,
          },
        }),
      },
      { clock: () => now, settlement: { version: "1", timeoutMs: 10 } },
    ).execute(
      {
        ...input,
        context: { ...input.context, enabledToolNamespaces: ["files", "sharedos"] },
        tools: [ESCALATION_TOOL_DEFINITION],
      },
      { signal: controller.signal },
    );
    await entered.promise;
    controller.abort();
    const result = await resultPromise;
    release.resolve();
    expect(result).toMatchObject({
      status: "cancelled",
      settlement: {
        status: "incomplete",
        pendingWorkIds: ["escalation-audit"],
      },
    });
    expect(finish).not.toHaveBeenCalled();
  });

  it("settles a published result after the natural work deadline without another model decision", async () => {
    let published = false;
    let workSignal: AbortSignal | undefined;
    const nextDecision = vi.fn(async () => ({ type: "tool_call" as const, call }));
    const ingestToolResult = vi.fn(
      async (envelope: ToolResultIngestionEnvelope, signal: AbortSignal) => {
        expect(published).toBe(true);
        expect(workSignal?.aborted).toBe(true);
        expect(signal.aborted).toBe(false);
        expect(signal).not.toBe(workSignal);
        return ack(envelope);
      },
    );
    const actualKernel = kernel({
      invoke: async (_context, _call, signal) => {
        published = true;
        workSignal = signal;
        await new Promise<void>((resolve) => {
          if (signal.aborted) resolve();
          else signal.addEventListener("abort", () => resolve(), { once: true });
        });
        return {
          callId: call.id,
          tool: call.tool,
          status: "succeeded",
          output: { published },
          completedAt: now,
        };
      },
    });
    const result = await new TurnExecutor(
      actualKernel,
      {
        open: async () => ({
          next: vi.fn(),
          settlement: {
            version: "1",
            nextDecision,
            ingestToolResult,
            finish: async () => undefined,
            close: async () => undefined,
          },
        }),
      },
      { clock: () => now, settlement: { version: "1", timeoutMs: 100 } },
    ).execute({ ...request(), tools: [tool], options: { timeoutMs: 20 } });
    expect(result).toMatchObject({ status: "cancelled", settlement: { status: "settled" } });
    expect(nextDecision).toHaveBeenCalledOnce();
    expect(ingestToolResult).toHaveBeenCalledOnce();
  });
});
