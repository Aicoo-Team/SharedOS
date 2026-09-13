import { describe, expect, it, vi } from "vitest";
import {
  StandardRuntime,
  type AgentTurnDecision,
  type AgentTurnSession,
} from "./standard-runtime.js";
import { TurnSettlement, type AgentTurnSettlementSession } from "./settlement.js";
import type { RuntimeHost, RuntimeTurnRequest } from "./runtime-plugin.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const request = { executionId: "execution", context: { traceId: "trace" } } as RuntimeTurnRequest;
function fixture(extension: Partial<AgentTurnSettlementSession> = {}) {
  const settlement = new TurnSettlement("execution", "trace", 20);
  const session: AgentTurnSession = {
    next: vi.fn(),
    close: vi.fn(),
    settlement: {
      version: "1",
      nextDecision: vi.fn(async () => ({ type: "complete" as const, output: null })),
      ingestToolResult: vi.fn(),
      finish: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
      ...extension,
    },
  };
  const host: RuntimeHost = {
    limits: { maxSteps: 3, maxToolCalls: 3, timeoutMs: 100 },
    settlement: settlement.host,
    invokeTool: vi.fn(),
    emit: vi.fn(),
  };
  return { settlement, session, host };
}

describe("StandardRuntime settlement mode", () => {
  it("registers once before generation and never calls the legacy combined session", async () => {
    const { settlement, session, host } = fixture();
    const runtime = new StandardRuntime({ open: async () => session });
    await runtime.run(request, host, new AbortController().signal);
    expect(session.next).not.toHaveBeenCalled();
    expect(session.close).not.toHaveBeenCalled();
    expect((await settlement.settle("succeeded")).status).toBe("settled");
    expect(session.settlement!.finish).toHaveBeenCalledTimes(1);
    expect(session.settlement!.close).toHaveBeenCalledTimes(1);
  });

  it("fails unsupported before the first model decision", async () => {
    const { settlement, host } = fixture();
    const next = vi.fn();
    const runtime = new StandardRuntime({ open: async () => ({ next }) });
    expect((await runtime.run(request, host, new AbortController().signal)).type).toBe("fail");
    expect(next).not.toHaveBeenCalled();
    expect((await settlement.settle("failed")).status).toBe("unsupported");
  });

  it("never finishes abandoned generation or asks for a new decision after cancellation", async () => {
    const pending = deferred<AgentTurnDecision>();
    const entered = deferred<void>();
    const { settlement, session, host } = fixture({
      nextDecision: vi.fn(() => {
        entered.resolve();
        return pending.promise;
      }),
    });
    const abort = new AbortController();
    const runtime = new StandardRuntime({ open: async () => session });
    const running = runtime.run(request, host, abort.signal);
    void running.catch(() => {});
    await entered.promise;
    abort.abort();
    settlement.start();
    await expect(running).rejects.toBeDefined();
    const report = await settlement.settle("cancelled");
    expect(report.status).toBe("incomplete");
    expect(report.pendingWorkIds).toContain("session-decision");
    expect(session.settlement!.finish).not.toHaveBeenCalled();
    pending.resolve({
      type: "tool_call",
      call: {
        id: "late",
        tool: "files.write",
        arguments: {},
        traceId: "trace",
        requestedAt: "2026-09-14T00:00:00.000Z",
      },
    });
    await Promise.resolve();
    expect(host.invokeTool).not.toHaveBeenCalled();
    expect(session.settlement!.nextDecision).toHaveBeenCalledTimes(1);
  });

  it("closes a late open only through the resource cleanup port", async () => {
    const opened = deferred<AgentTurnSession>();
    const { settlement, session, host } = fixture();
    const abort = new AbortController();
    const runtime = new StandardRuntime({ open: () => opened.promise });
    const running = runtime.run(request, host, abort.signal);
    void running.catch(() => {});
    abort.abort();
    settlement.start();
    await expect(running).rejects.toBeDefined();
    const settling = settlement.settle("cancelled");
    opened.resolve(session);
    const report = await settling;
    expect(report.status).toBe("unsupported");
    expect(session.settlement!.finish).not.toHaveBeenCalled();
    expect(session.settlement!.close).toHaveBeenCalledTimes(1);
    expect(session.close).not.toHaveBeenCalled();
    expect(session.next).not.toHaveBeenCalled();
    expect(session.settlement!.nextDecision).not.toHaveBeenCalled();
  });
});
