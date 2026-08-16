import { z } from "zod";

import { IdentifierSchema, ProtocolVersionSchema } from "./common.js";
import { JsonObjectSchema, JsonValueSchema } from "./json.js";
import { ProtocolErrorSchema } from "./protocol-error.js";

/** Stable, JSON-safe provenance for one installed runtime implementation. */
export const RuntimeManifestSchema = z
  .object({
    id: IdentifierSchema,
    version: IdentifierSchema,
    protocolVersion: ProtocolVersionSchema,
    metadata: JsonObjectSchema.optional(),
  })
  .strict();

export type RuntimeManifest = z.infer<typeof RuntimeManifestSchema>;

/** A runtime-originated observation. The SharedOS envelope assigns its audit identity. */
export const RuntimeEventSchema = z
  .object({
    type: IdentifierSchema,
    data: JsonValueSchema,
  })
  .strict();

export type RuntimeEvent = z.infer<typeof RuntimeEventSchema>;

const RuntimeTurnOutcomeBaseSchema = z.object({
  metadata: JsonObjectSchema.optional(),
});

/** The only terminal outcomes a runtime plugin may return for one bounded turn. */
export const RuntimeTurnOutcomeSchema = z.discriminatedUnion("type", [
  RuntimeTurnOutcomeBaseSchema.extend({
    type: z.literal("complete"),
    output: JsonValueSchema,
  }).strict(),
  RuntimeTurnOutcomeBaseSchema.extend({
    type: z.literal("fail"),
    error: ProtocolErrorSchema,
  }).strict(),
]);

export type RuntimeTurnOutcome = z.infer<typeof RuntimeTurnOutcomeSchema>;
