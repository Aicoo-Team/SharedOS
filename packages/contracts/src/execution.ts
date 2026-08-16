import { z } from "zod";

import { AccessContextSchema } from "./access.js";
import { AgentAddressSchema } from "./address.js";
import { IdentifierSchema, ProtocolVersionSchema, TimestampSchema } from "./common.js";
import { JsonObjectSchema, JsonValueSchema } from "./json.js";
import { MessageEnvelopeSchema } from "./message.js";
import { ProtocolErrorSchema } from "./protocol-error.js";
import { ToolDefinitionSchema } from "./tool.js";

export const MAX_EXECUTION_TIMEOUT_MS = 600_000;
export const MAX_EXECUTION_TOOL_CALLS = 10_000;

export const ExecutionOptionsSchema = z
  .object({
    maxSteps: z.number().int().positive().max(1_000).optional(),
    maxToolCalls: z.number().int().positive().max(MAX_EXECUTION_TOOL_CALLS).optional(),
    timeoutMs: z.number().int().positive().max(MAX_EXECUTION_TIMEOUT_MS).optional(),
  })
  .strict();

export type ExecutionOptions = z.infer<typeof ExecutionOptionsSchema>;

/** One permission-controlled agent turn. Tick scheduling stays with the host. */
export const ExecutionRequestSchema = z
  .object({
    version: ProtocolVersionSchema,
    executionId: IdentifierSchema,
    agent: AgentAddressSchema,
    context: AccessContextSchema,
    message: MessageEnvelopeSchema,
    tools: z.array(ToolDefinitionSchema).max(512),
    state: JsonObjectSchema.optional(),
    options: ExecutionOptionsSchema.optional(),
    metadata: JsonObjectSchema.optional(),
  })
  .strict();

export type ExecutionRequest = z.infer<typeof ExecutionRequestSchema>;

/** An append-only event emitted while executing a request. */
export const ExecutionEventSchema = z
  .object({
    version: ProtocolVersionSchema,
    eventId: IdentifierSchema,
    executionId: IdentifierSchema,
    traceId: IdentifierSchema,
    sequence: z.number().int().nonnegative(),
    type: z.string().trim().min(1).max(128),
    data: JsonValueSchema,
    occurredAt: TimestampSchema,
  })
  .strict();

export type ExecutionEvent = z.infer<typeof ExecutionEventSchema>;

const ExecutionResultBaseSchema = z.object({
  version: ProtocolVersionSchema,
  executionId: IdentifierSchema,
  traceId: IdentifierSchema,
  events: z.array(ExecutionEventSchema),
  startedAt: TimestampSchema,
  completedAt: TimestampSchema,
  metadata: JsonObjectSchema.optional(),
});

export const ExecutionResultSchema = z.discriminatedUnion("status", [
  ExecutionResultBaseSchema.extend({
    status: z.literal("succeeded"),
    output: JsonValueSchema,
  }).strict(),
  ExecutionResultBaseSchema.extend({
    status: z.literal("denied"),
    error: ProtocolErrorSchema,
  }).strict(),
  ExecutionResultBaseSchema.extend({
    status: z.literal("failed"),
    error: ProtocolErrorSchema,
  }).strict(),
  ExecutionResultBaseSchema.extend({
    status: z.literal("cancelled"),
    error: ProtocolErrorSchema.optional(),
  }).strict(),
]);

export type ExecutionResult = z.infer<typeof ExecutionResultSchema>;
