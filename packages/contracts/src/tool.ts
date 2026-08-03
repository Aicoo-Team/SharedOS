import { z } from "zod";

import { CapabilityRequirementSchema } from "./capability.js";
import { IdentifierSchema, TimestampSchema } from "./common.js";
import { JsonObjectSchema, JsonValueSchema } from "./json.js";
import { ProtocolErrorSchema } from "./protocol-error.js";

export const ToolAnnotationsSchema = z
  .object({
    readOnly: z.boolean().optional(),
    destructive: z.boolean().optional(),
    idempotent: z.boolean().optional(),
  })
  .strict();

export type ToolAnnotations = z.infer<typeof ToolAnnotationsSchema>;

/** A JSON-Schema-described tool bound to one permission requirement. */
export const ToolDefinitionSchema = z
  .object({
    name: IdentifierSchema,
    description: z.string().min(1).max(8_192),
    inputSchema: JsonObjectSchema,
    outputSchema: JsonObjectSchema.optional(),
    requiredCapability: CapabilityRequirementSchema,
    annotations: ToolAnnotationsSchema.optional(),
    metadata: JsonObjectSchema.optional(),
  })
  .strict();

export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;

export const ToolCallSchema = z
  .object({
    id: IdentifierSchema,
    tool: IdentifierSchema,
    arguments: JsonObjectSchema,
    traceId: IdentifierSchema,
    requestedAt: TimestampSchema,
  })
  .strict();

export type ToolCall = z.infer<typeof ToolCallSchema>;

const ToolResultBaseSchema = z.object({
  callId: IdentifierSchema,
  tool: IdentifierSchema,
  completedAt: TimestampSchema,
  metadata: JsonObjectSchema.optional(),
});

export const ToolResultSchema = z.discriminatedUnion("status", [
  ToolResultBaseSchema.extend({
    status: z.literal("succeeded"),
    output: JsonValueSchema,
  }).strict(),
  ToolResultBaseSchema.extend({
    status: z.literal("denied"),
    error: ProtocolErrorSchema,
  }).strict(),
  ToolResultBaseSchema.extend({
    status: z.literal("failed"),
    error: ProtocolErrorSchema,
  }).strict(),
]);

export type ToolResult = z.infer<typeof ToolResultSchema>;
