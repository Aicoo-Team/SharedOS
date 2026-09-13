import { z } from "zod";
import { IdentifierSchema } from "./common.js";
import { ToolResultSchema } from "./tool.js";

/** Receipt identity binds a durable ingestion to one exact, canonical result. */
export const ToolResultIngestionAckSchema = z
  .object({
    version: z.literal("1"),
    executionId: IdentifierSchema,
    traceId: IdentifierSchema,
    callId: IdentifierSchema,
    tool: IdentifierSchema,
    resultDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  })
  .strict();
export type ToolResultIngestionAck = z.infer<typeof ToolResultIngestionAckSchema>;

/** Parsing checks identity and digest format, not hashing or durable ingestion. */
export const ToolResultIngestionEnvelopeSchema = ToolResultIngestionAckSchema.extend({
  result: ToolResultSchema,
})
  .strict()
  .superRefine((envelope, ctx) => {
    for (const key of ["callId", "tool"] as const) {
      if (envelope[key] !== envelope.result[key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["result", key],
          message: `Result ${key} must match the ingestion envelope`,
        });
      }
    }
  });
export type ToolResultIngestionEnvelope = z.infer<typeof ToolResultIngestionEnvelopeSchema>;

export const OperationSettlementSchema = z
  .object({
    callId: IdentifierSchema,
    tool: IdentifierSchema,
    result: z.enum(["ready", "pending", "failed"]),
    resultDigest: z
      .string()
      .regex(/^[a-f0-9]{64}$/u)
      .optional(),
    ingestion: z.enum(["acknowledged", "pending", "failed", "unsupported"]),
    audit: z.enum(["recorded", "failed", "pending", "unknown"]),
  })
  .strict()
  .superRefine((operation, ctx) => {
    if (operation.result === "ready" && operation.resultDigest === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["resultDigest"],
        message: "Ready results require a digest",
      });
    }
    if (operation.ingestion === "acknowledged" && operation.result !== "ready") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ingestion"],
        message: "Acknowledged ingestion requires a ready result",
      });
    }
  });
export type OperationSettlement = z.infer<typeof OperationSettlementSchema>;

const HistoryStateSchema = z.enum(["completed", "pending", "failed", "unsupported"]);
/** A deadline snapshot, independent of the execution's success or cancellation. */
export const ExecutionSettlementSchema = z
  .object({
    version: z.literal("1"),
    status: z.enum(["settled", "incomplete", "unsupported"]),
    operations: z.array(OperationSettlementSchema),
    history: z.object({ finish: HistoryStateSchema, cleanup: HistoryStateSchema }).strict(),
    pendingOperationIds: z.array(IdentifierSchema),
    pendingWorkIds: z.array(z.string().min(1)),
  })
  .strict()
  .superRefine((settlement, ctx) => {
    const callIds = new Set<string>();
    const pendingIds = new Set<string>();
    settlement.operations.forEach((operation, index) => {
      if (callIds.has(operation.callId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["operations", index, "callId"],
          message: "Operation call IDs must be unique",
        });
      }
      callIds.add(operation.callId);
      if (
        operation.result === "pending" ||
        operation.ingestion === "pending" ||
        operation.audit === "pending"
      ) {
        pendingIds.add(operation.callId);
      }
    });
    const reportedPendingIds = new Set(settlement.pendingOperationIds);
    if (
      reportedPendingIds.size !== settlement.pendingOperationIds.length ||
      reportedPendingIds.size !== pendingIds.size ||
      [...pendingIds].some((id) => !reportedPendingIds.has(id))
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pendingOperationIds"],
        message: "Pending operation IDs must identify exactly the pending operations",
      });
    }
    if (
      settlement.status === "settled" &&
      (settlement.operations.some(
        (operation) =>
          operation.result !== "ready" ||
          operation.ingestion !== "acknowledged" ||
          operation.audit !== "recorded",
      ) ||
        settlement.history.finish !== "completed" ||
        settlement.history.cleanup !== "completed" ||
        settlement.pendingOperationIds.length > 0 ||
        settlement.pendingWorkIds.length > 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["status"],
        message: "Settled reports require completed operations and history with no pending work",
      });
    }
  });
export type ExecutionSettlement = z.infer<typeof ExecutionSettlementSchema>;
