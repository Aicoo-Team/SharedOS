import { describe, expect, it } from "vitest";
import { ExecutionResultSchema } from "./execution.js";
import {
  ExecutionSettlementSchema,
  OperationSettlementSchema,
  ToolResultIngestionEnvelopeSchema,
  type ExecutionSettlement,
  type OperationSettlement,
} from "./settlement.js";

const operation: OperationSettlement = {
  callId: "call-1",
  tool: "files.read",
  result: "ready",
  resultDigest: "a".repeat(64),
  ingestion: "acknowledged",
  audit: "recorded",
};
const settled: ExecutionSettlement = {
  version: "1",
  status: "settled",
  operations: [operation],
  history: { finish: "completed", cleanup: "completed" },
  pendingOperationIds: [],
  pendingWorkIds: [],
};
const envelope = {
  version: "1",
  executionId: "execution-1",
  traceId: "trace-1",
  callId: operation.callId,
  tool: operation.tool,
  resultDigest: operation.resultDigest,
  result: {
    callId: operation.callId,
    tool: operation.tool,
    status: "succeeded",
    output: null,
    completedAt: "2026-09-14T00:00:00.000Z",
  },
};

describe("settlement contracts", () => {
  it.each(["callId", "tool"] as const)("rejects mismatched envelope %s", (key) => {
    expect(
      ToolResultIngestionEnvelopeSchema.safeParse({ ...envelope, [key]: "different" }).success,
    ).toBe(false);
  });

  it("validates digest format without claiming to verify result content or durability", () => {
    expect(ToolResultIngestionEnvelopeSchema.safeParse(envelope).success).toBe(true);
    expect(
      ToolResultIngestionEnvelopeSchema.safeParse({ ...envelope, resultDigest: "bad" }).success,
    ).toBe(false);
  });

  it("requires a digest for ready results", () => {
    expect(
      OperationSettlementSchema.safeParse({ ...operation, resultDigest: undefined }).success,
    ).toBe(false);
  });

  it.each(["pending", "failed"])("rejects acknowledged ingestion for a %s result", (result) => {
    expect(OperationSettlementSchema.safeParse({ ...operation, result }).success).toBe(false);
  });

  it.each([
    {
      operations: [{ ...operation, result: "pending", ingestion: "pending" }],
      pendingOperationIds: [operation.callId],
    },
    { operations: [{ ...operation, ingestion: "failed" }] },
    { operations: [{ ...operation, audit: "unknown" }] },
    { history: { finish: "failed", cleanup: "completed" } },
    { history: { finish: "completed", cleanup: "pending" } },
    { pendingWorkIds: ["work-1"] },
  ])("rejects a contradictory settled snapshot: %j", (change) => {
    expect(ExecutionSettlementSchema.safeParse({ ...settled, ...change }).success).toBe(false);
  });

  it("rejects duplicate operation identities", () => {
    expect(
      ExecutionSettlementSchema.safeParse({ ...settled, operations: [operation, operation] })
        .success,
    ).toBe(false);
  });

  it.each(
    [[], ["other"], ["call-1", "call-1"]].map((pendingOperationIds) => ({ pendingOperationIds })),
  )("rejects incorrect pending identities: %j", ({ pendingOperationIds }) => {
    expect(
      ExecutionSettlementSchema.safeParse({
        ...settled,
        status: "incomplete",
        operations: [{ ...operation, ingestion: "pending" }],
        pendingOperationIds,
      }).success,
    ).toBe(false);
  });

  it("rejects a nonpending operation listed as pending", () => {
    expect(
      ExecutionSettlementSchema.safeParse({
        ...settled,
        status: "incomplete",
        pendingOperationIds: [operation.callId],
      }).success,
    ).toBe(false);
  });

  it.each([
    { ...settled },
    { ...settled, status: "incomplete", history: { finish: "failed", cleanup: "completed" } },
    {
      ...settled,
      status: "incomplete",
      operations: [
        {
          ...operation,
          result: "pending",
          resultDigest: undefined,
          ingestion: "pending",
          audit: "recorded",
        },
      ],
      pendingOperationIds: [operation.callId],
    },
    {
      ...settled,
      status: "incomplete",
      operations: [
        {
          ...operation,
          result: "failed",
          resultDigest: undefined,
          ingestion: "failed",
          audit: "recorded",
        },
      ],
    },
    {
      ...settled,
      status: "unsupported",
      history: { finish: "unsupported", cleanup: "unsupported" },
      operations: [{ ...operation, ingestion: "unsupported" }],
    },
  ])("accepts consistent snapshots, including partial failures: %j", (report) => {
    expect(ExecutionSettlementSchema.safeParse(report).success).toBe(true);
  });

  it("requires a coordinated upgrade for old strict v1 consumers", () => {
    const legacySucceededSchema = ExecutionResultSchema.options[0].omit({ settlement: true });
    const legacy = {
      version: "1",
      executionId: "execution-1",
      traceId: "trace-1",
      status: "succeeded",
      output: null,
      events: [],
      startedAt: "2026-09-14T00:00:00.000Z",
      completedAt: "2026-09-14T00:00:00.000Z",
    };
    expect(legacySucceededSchema.safeParse(legacy).success).toBe(true);
    expect(legacySucceededSchema.safeParse({ ...legacy, settlement: settled }).success).toBe(false);
    expect(ExecutionResultSchema.safeParse({ ...legacy, settlement: settled }).success).toBe(true);
  });
});
