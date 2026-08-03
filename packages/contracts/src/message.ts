import { z } from "zod";

import { AddressSchema } from "./address.js";
import { IdentifierSchema, ProtocolVersionSchema, TimestampSchema } from "./common.js";
import { JsonObjectSchema, JsonValueSchema } from "./json.js";
import { ProtocolErrorSchema } from "./protocol-error.js";

export const MessageProvenanceSchema = z
  .object({
    source: IdentifierSchema,
    parentIds: z.array(IdentifierSchema).max(64),
    metadata: JsonObjectSchema.optional(),
  })
  .strict();

export type MessageProvenance = z.infer<typeof MessageProvenanceSchema>;

/**
 * A message carries intent and context, never authority. Authority is supplied
 * separately through AccessContext and evaluated at the point of use.
 */
export const MessageEnvelopeSchema = z
  .object({
    version: ProtocolVersionSchema,
    id: IdentifierSchema,
    sender: AddressSchema,
    receiver: AddressSchema,
    intent: z.string().trim().min(1).max(512),
    purpose: z.string().trim().min(1).max(512),
    payload: JsonValueSchema,
    traceId: IdentifierSchema,
    createdAt: TimestampSchema,
    replyTo: IdentifierSchema.optional(),
    provenance: MessageProvenanceSchema.optional(),
  })
  .strict();

export type MessageEnvelope = z.infer<typeof MessageEnvelopeSchema>;

const MessageDeliveryBaseSchema = z.object({
  messageId: IdentifierSchema,
  timestamp: TimestampSchema,
  metadata: JsonObjectSchema.optional(),
});

/** The transport-neutral outcome of submitting a message for delivery. */
export const MessageDeliveryResultSchema = z.discriminatedUnion("status", [
  MessageDeliveryBaseSchema.extend({ status: z.literal("accepted") }).strict(),
  MessageDeliveryBaseSchema.extend({ status: z.literal("delivered") }).strict(),
  MessageDeliveryBaseSchema.extend({
    status: z.literal("denied"),
    error: ProtocolErrorSchema,
  }).strict(),
  MessageDeliveryBaseSchema.extend({
    status: z.literal("failed"),
    error: ProtocolErrorSchema,
  }).strict(),
]);

export type MessageDeliveryResult = z.infer<typeof MessageDeliveryResultSchema>;
