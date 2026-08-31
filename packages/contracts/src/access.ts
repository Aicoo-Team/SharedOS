import { z } from "zod";

import { AddressSchema } from "./address.js";
import { GovernedViewSchema } from "./capability.js";
import { IdentifierSchema, TimestampSchema } from "./common.js";
import { JsonObjectSchema } from "./json.js";
import { EnabledToolNamespacesSchema } from "./tool.js";

/**
 * The identity, purpose, time, and tool-namespace inputs to a permission
 * decision.
 *
 * An access context deliberately carries no authority. Grants are loaded by the
 * kernel from a trusted `GrantSource` at the moment of the decision, so a
 * caller cannot present, extend, or replay authority by constructing a context.
 */
export const AccessContextSchema = z
  .object({
    namespaceId: IdentifierSchema,
    actor: AddressSchema,
    authority: AddressSchema,
    owner: AddressSchema,
    purpose: z.string().trim().min(1).max(512),
    traceId: IdentifierSchema,
    enabledToolNamespaces: EnabledToolNamespacesSchema,
    now: TimestampSchema,
  })
  .strict();

export type AccessContext = z.infer<typeof AccessContextSchema>;

/**
 * A portable explanation of one authorization check.
 *
 * `view` is present only on an allowed decision whose matched capability
 * carries a typed governed view. It is the view the kernel must serve in place
 * of the raw resource, and it travels on the decision because the projection is
 * enforcement: a caller that could lose the view between deciding and serving
 * would be handed the record the grant withheld.
 */
export const AuthorizationDecisionSchema = z
  .object({
    allowed: z.boolean(),
    reasonCode: IdentifierSchema,
    matchedGrantId: IdentifierSchema.optional(),
    view: GovernedViewSchema.optional(),
    metadata: JsonObjectSchema.optional(),
  })
  .strict();

export type AuthorizationDecision = z.infer<typeof AuthorizationDecisionSchema>;
