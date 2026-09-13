import { describe, expect, it, vi } from "vitest";
import type { ToolCall, ToolResult } from "@aicoo/sharedos-contracts";
import { ExecutionSettlementSchema } from "@aicoo/sharedos-contracts";
import { TurnSettlement, type AgentTurnSettlementSession } from "./settlement.js";

const call: ToolCall = {
  id: "call",
  tool: "files.write",
  arguments: {},
  traceId: "trace",
  requestedAt: "2026-09-14T00:00:00.000Z",
};
const result: ToolResult = {
  callId: call.id,
  tool: call.tool,
  status: "succeeded",
  output: {},
  completedAt: call.requestedAt,
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function session(overrides: Partial<AgentTurnSettlementSession> = {}): AgentTurnSettlementSession {
  return {
    version: "1",
    nextDecision: vi.fn(),
    ingestToolResult: vi.fn(async ({ result: _result, ...ack }) => ack),
    finish: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    ...overrides,
  };
}
function observation(value: ToolResult = result) {
  return {
    version: "1" as const,
    result: Promise.resolve(value),
    audit: Promise.resolve("recorded" as const),
    completion: Promise.resolve(value),
  };
}

describe("TurnSettlement", () => {
  it.each(["", null, 42])("normalizes an invalid pending-work label (%s)", async (label) => {
    const turn = new TurnSettlement("execution", "trace", 10);
    turn.host.register(session());
    turn.trackWork(new Promise(() => {}), label as string);
    const report = await turn.settle("cancelled");
    expect(() => ExecutionSettlementSchema.parse(report)).not.toThrow();
    expect(report.pendingWorkIds).toEqual(["work-1"]);
  });

  it("reports incomplete while a session open has not established capability", async () => {
    const turn = new TurnSettlement("execution", "trace", 10);
    turn.trackWork(new Promise(() => {}), "session-open");
    const report = await turn.settle("cancelled");
    expect(report.status).toBe("incomplete");
    expect(report.pendingWorkIds).toEqual(["session-open"]);
    expect(() => ExecutionSettlementSchema.parse(report)).not.toThrow();
  });

  it("refuses an unknown observation version and observes its rejected completion", async () => {
    const turn = new TurnSettlement("execution", "trace", 100);
    const driver = session();
    turn.host.register(driver);
    await expect(
      turn.trackTool(call, () => ({
        ...observation(),
        version: "2" as "1",
        completion: Promise.reject(undefined),
      })),
    ).rejects.toThrow("version");
    const report = await turn.settle("failed");
    expect(report.status).toBe("incomplete");
    expect(driver.ingestToolResult).not.toHaveBeenCalled();
    expect(driver.finish).not.toHaveBeenCalled();
  });

  it("ingests actual denied results and rejects duplicate identity before invocation", async () => {
    const turn = new TurnSettlement("execution", "trace", 100);
    const driver = session();
    turn.host.register(driver);
    const denied: ToolResult = {
      callId: call.id,
      tool: call.tool,
      completedAt: call.requestedAt,
      status: "denied",
      error: { code: "forbidden", message: "Denied", retryable: false },
    };
    await expect(turn.trackTool(call, () => observation(denied))).resolves.toEqual(denied);
    const factory = vi.fn(() => observation());
    await expect(turn.trackTool(call, factory)).rejects.toThrow();
    expect(factory).not.toHaveBeenCalled();
    expect((await turn.settle("cancelled")).status).toBe("settled");
    expect(driver.ingestToolResult).toHaveBeenCalledTimes(1);
  });

  it("delivers result before audit and drains audit before finish", async () => {
    const turn = new TurnSettlement("execution", "trace", 100);
    const audit = deferred<"recorded">();
    const driver = session();
    turn.host.register(driver);
    await turn.trackTool(call, () => ({ ...observation(), audit: audit.promise }));
    const settling = turn.settle("cancelled");
    await Promise.resolve();
    expect(driver.finish).not.toHaveBeenCalled();
    audit.resolve("recorded");
    expect((await settling).status).toBe("settled");
    expect(driver.finish).toHaveBeenCalledWith("cancelled", expect.any(AbortSignal));
  });

  it("bounds pending ACK and freezes the report against late resolution", async () => {
    const turn = new TurnSettlement("execution", "trace", 10);
    const ack = deferred<any>();
    const driver = session({ ingestToolResult: vi.fn(() => ack.promise) });
    turn.host.register(driver);
    const invoked = turn.trackTool(call, () => observation());
    invoked.catch(() => {});
    const report = await turn.settle("cancelled");
    expect(report.status).toBe("incomplete");
    expect(report.operations[0]?.ingestion).toBe("pending");
    expect(driver.finish).not.toHaveBeenCalled();
    const before = JSON.stringify(report);
    ack.resolve({});
    await Promise.resolve();
    expect(JSON.stringify(report)).toBe(before);
    expect(Object.isFrozen(report)).toBe(true);
  });

  it.each(["executionId", "traceId", "callId", "tool", "resultDigest"])(
    "rejects a foreign %s ACK",
    async (field) => {
      const turn = new TurnSettlement("execution", "trace", 100);
      const driver = session({
        ingestToolResult: async ({ result: _result, ...ack }) => ({ ...ack, [field]: "foreign" }),
      });
      turn.host.register(driver);
      await expect(turn.trackTool(call, () => observation())).rejects.toThrow();
      const report = await turn.settle("failed");
      expect(report.status).toBe("incomplete");
      expect(report.operations[0]?.ingestion).toBe("failed");
      expect(driver.finish).not.toHaveBeenCalled();
    },
  );

  it("does not publish finish while generation is still running", async () => {
    const turn = new TurnSettlement("execution", "trace", 10);
    const driver = session();
    turn.host.register(driver);
    turn.trackWork(new Promise(() => {}), "decision");
    const report = await turn.settle("cancelled");
    expect(report.status).toBe("incomplete");
    expect(report.pendingWorkIds).toContain("decision");
    expect(driver.finish).not.toHaveBeenCalled();
  });

  it.each(["finish", "close"] as const)("bounds a pending %s", async (method) => {
    const turn = new TurnSettlement("execution", "trace", 10);
    turn.host.register(session({ [method]: () => new Promise(() => {}) }));
    const report = await turn.settle("cancelled");
    expect(report.status).toBe("incomplete");
    expect(report.history[method === "finish" ? "finish" : "cleanup"]).toBe("pending");
  });

  it("reports unsupported without a session registration", async () => {
    const turn = new TurnSettlement("execution", "trace", 10);
    expect((await turn.settle("succeeded")).status).toBe("unsupported");
  });

  it("reports result-ready and acknowledged while audit remains pending", async () => {
    const turn = new TurnSettlement("execution", "trace", 10);
    const driver = session();
    turn.host.register(driver);
    await turn.trackTool(call, () => ({ ...observation(), audit: new Promise(() => {}) }));
    const report = await turn.settle("cancelled");
    expect(report.operations[0]).toMatchObject({
      result: "ready",
      ingestion: "acknowledged",
      audit: "pending",
    });
    expect(report.status).toBe("incomplete");
    expect(driver.finish).not.toHaveBeenCalled();
  });

  it("keeps an unknown tool result pending without synthesizing an ingestion", async () => {
    const turn = new TurnSettlement("execution", "trace", 10);
    const driver = session();
    turn.host.register(driver);
    void turn
      .trackTool(call, () => ({
        ...observation(),
        result: new Promise(() => {}),
        completion: new Promise(() => {}),
      }))
      .catch(() => {});
    const report = await turn.settle("cancelled");
    expect(report.operations[0]?.result).toBe("pending");
    expect(report.pendingOperationIds).toEqual([call.id]);
    expect(driver.ingestToolResult).not.toHaveBeenCalled();
    expect(driver.finish).not.toHaveBeenCalled();
  });

  it.each([null, undefined, "failure"])(
    "contains a non-Error finish rejection (%s)",
    async (failure) => {
      const turn = new TurnSettlement("execution", "trace", 100);
      turn.host.register(
        session({
          finish: async () => {
            throw failure;
          },
        }),
      );
      const report = await turn.settle("failed");
      expect(report.status).toBe("incomplete");
      expect(report.history).toEqual({ finish: "failed", cleanup: "completed" });
    },
  );
});
