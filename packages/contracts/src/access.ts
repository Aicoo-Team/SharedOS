import { z } from "zod";

import { AddressSchema } from "./address.js";
import { CapabilityRequestSchema } from "./capability.js";
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

/** A portable explanation of one authorization check. */
export const AuthorizationDecisionSchema = z
  .object({
    allowed: z.boolean(),
    reasonCode: IdentifierSchema,
    matchedGrantId: IdentifierSchema.optional(),
    /**
     * The authority that would have satisfied this request.
     *
     * Present only on a `no_matching_grant` denial, where the authorizer
     * already holds every field: the resource and action the caller named, and
     * the owner, namespace, purpose and instant from its own access context.
     *
     * It is a description, not an offer. It grants nothing, no port accepts one
     * back as authority, and the denial is still a denial -- `allowed` stays
     * `false` and fail-closed behaviour is untouched. A host that ignores this
     * field behaves exactly as it did before the field existed.
     *
     * It discloses nothing the caller did not already hold, and in particular
     * it is not an existence oracle: the same description is produced for a
     * path that is absent and for one the actor merely cannot reach, because it
     * is never built from anything a provider knows. Populating it from
     * provider state would turn a denial into a lookup.
     *
     * It is deliberately absent from the other denials. `grant_exhausted` names
     * a grant that already exists, and an infrastructure denial names a fact
     * SharedOS could not establish; describing a capability for either would
     * suggest that issuing one is the remedy when it is not. See ADR 0019.
     */
    requiredCapability: CapabilityRequestSchema.optional(),
    metadata: JsonObjectSchema.optional(),
  })
  .strict();

export type AuthorizationDecision = z.infer<typeof AuthorizationDecisionSchema>;
