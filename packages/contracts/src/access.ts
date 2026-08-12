import { z } from "zod";

import { AddressSchema } from "./address.js";
import { CapabilityGrantSchema } from "./capability.js";
import { IdentifierSchema, TimestampSchema } from "./common.js";
import { JsonObjectSchema } from "./json.js";
import { EnabledToolNamespacesSchema } from "./tool.js";

/** All inputs needed for a deterministic permission decision. */
export const AccessContextSchema = z
  .object({
    namespaceId: IdentifierSchema,
    actor: AddressSchema,
    authority: AddressSchema,
    owner: AddressSchema,
    purpose: z.string().trim().min(1).max(512),
    traceId: IdentifierSchema,
    enabledToolNamespaces: EnabledToolNamespacesSchema,
    grants: z.array(CapabilityGrantSchema).max(256),
    now: TimestampSchema,
  })
  .strict();

export type AccessContext = z.infer<typeof AccessContextSchema>;

/** A portable explanation of one authorization check. */
export const AuthorizationDecisionSchema = z
  .object({
    allowed: z.boolean(),
    reasonCode: IdentifierSchema,
    matchedGrantId: IdentifierSchema.optional(),
    metadata: JsonObjectSchema.optional(),
  })
  .strict();

export type AuthorizationDecision = z.infer<typeof AuthorizationDecisionSchema>;
