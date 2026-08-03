import { z } from "zod";

import { AccessContextSchema } from "./access.js";
import { ResourceRefSchema } from "./capability.js";
import { IdentifierSchema, TimestampSchema } from "./common.js";
import { JsonObjectSchema, JsonValueSchema } from "./json.js";
import { ProtocolErrorSchema } from "./protocol-error.js";

/** A self-contained request to perform one permission-controlled operation. */
export const ResourceOperationSchema = z
  .object({
    operationId: IdentifierSchema,
    context: AccessContextSchema,
    resource: ResourceRefSchema,
    action: IdentifierSchema,
    input: JsonValueSchema.optional(),
    metadata: JsonObjectSchema.optional(),
  })
  .strict();

export type ResourceOperation = z.infer<typeof ResourceOperationSchema>;

const ResourceResultBaseSchema = z.object({
  operationId: IdentifierSchema,
  completedAt: TimestampSchema,
  metadata: JsonObjectSchema.optional(),
});

export const ResourceResultSchema = z.discriminatedUnion("status", [
  ResourceResultBaseSchema.extend({
    status: z.literal("succeeded"),
    output: JsonValueSchema,
  }).strict(),
  ResourceResultBaseSchema.extend({
    status: z.literal("denied"),
    error: ProtocolErrorSchema,
  }).strict(),
  ResourceResultBaseSchema.extend({
    status: z.literal("failed"),
    error: ProtocolErrorSchema,
  }).strict(),
]);

export type ResourceResult = z.infer<typeof ResourceResultSchema>;
