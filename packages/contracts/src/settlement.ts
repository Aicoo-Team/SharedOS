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

export const ToolResultIngestionEnvelopeSchema = ToolResultIngestionAckSchema.extend({
  result: ToolResultSchema,
}).strict();
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
  .strict();
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
  .strict();
export type ExecutionSettlement = z.infer<typeof ExecutionSettlementSchema>;
