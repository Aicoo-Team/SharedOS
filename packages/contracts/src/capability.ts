import { z } from "zod";

import { AddressSchema } from "./address.js";
import { IdentifierSchema, TimestampSchema } from "./common.js";
import { JsonObjectSchema } from "./json.js";

/**
 * One opaque resource-path segment.
 *
 * Separators, traversal markers, and control characters are rejected here so
 * every host receives the same canonical path vocabulary. Filesystem-backed
 * providers must still resolve beneath their configured root and reject
 * symlink escapes.
 */
export const PathSegmentSchema = z
  .string()
  .trim()
  .min(1)
  .max(256)
  .regex(/^(?!\.{1,2}$)[^/\\\u0000-\u001f\u007f]+$/u, {
    message: "path segments must not contain traversal markers, separators, or control characters",
  });
const ActionSchema = z.string().trim().min(1).max(128);
const PurposeSchema = z.string().trim().min(1).max(512);

/** A host-independent reference to a resource exposed through SharedOS. */
export const ResourceRefSchema = z
  .object({
    namespace: IdentifierSchema,
    path: z.array(PathSegmentSchema).max(64),
    owner: AddressSchema.optional(),
  })
  .strict();

export type ResourceRef = z.infer<typeof ResourceRefSchema>;

/**
 * One field of a typed governed view, by name.
 *
 * A field name is a JSON object key on the representation a read serves, so the
 * vocabulary is the data plane's, not the identifier plane's: anything but
 * control characters, bounded, and never empty.
 */
export const ViewFieldSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[^\u0000-\u001f\u007f]+$/u, {
    message: "view fields must not contain control characters",
  });

/**
 * A typed governed view: the authorised representation of a resource, declared
 * on the capability that serves it.
 *
 * A grant carrying a view does not authorize the record behind the view. The
 * kernel refuses a raw read against it (`view_required`) and serves a request
 * that names the view with only the declared fields -- a calendar entry's
 * free/busy without its title, attendees, or notes. The definition lives here,
 * on authority, because a view whose field list arrived with the request would
 * be disclosure the presenter controls.
 */
export const GovernedViewSchema = z
  .object({
    name: IdentifierSchema,
    fields: z.array(ViewFieldSchema).min(1).max(64),
  })
  .strict()
  .superRefine((view, context) => {
    if (new Set(view.fields).size !== view.fields.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "view fields must be unique",
        path: ["fields"],
      });
    }
  });

export type GovernedView = z.infer<typeof GovernedViewSchema>;

/**
 * A positive capability. SharedOS is deny-by-default when no grant matches.
 *
 * A capability carrying `view` authorizes the named view of the resource and
 * nothing rawer: requests that do not name the view are refused, and requests
 * that do are served only the view's declared fields.
 */
export const CapabilitySchema = z
  .object({
    resource: ResourceRefSchema,
    actions: z.array(ActionSchema).min(1).max(64),
    scope: z.enum(["exact", "descendants"]),
    view: GovernedViewSchema.optional(),
  })
  .strict();

export type Capability = z.infer<typeof CapabilitySchema>;

export const CapabilityConstraintsSchema = z
  .object({
    purposes: z.array(PurposeSchema).min(1).max(64).optional(),
    notBefore: TimestampSchema.optional(),
    expiresAt: TimestampSchema.optional(),
    maxUses: z.number().int().positive().optional(),
    delegationDepth: z.number().int().nonnegative().optional(),
  })
  .strict()
  .superRefine((constraints, context) => {
    if (
      constraints.notBefore !== undefined &&
      constraints.expiresAt !== undefined &&
      Date.parse(constraints.notBefore) > Date.parse(constraints.expiresAt)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "notBefore must not be after expiresAt",
        path: ["notBefore"],
      });
    }
  });

export type CapabilityConstraints = z.infer<typeof CapabilityConstraintsSchema>;

/** A request for authority. A request is not itself proof of authority. */
export const CapabilityRequestSchema = z
  .object({
    id: IdentifierSchema,
    namespaceId: IdentifierSchema,
    requester: AddressSchema,
    owner: AddressSchema,
    capabilities: z.array(CapabilitySchema).min(1).max(64),
    purpose: PurposeSchema,
    constraints: CapabilityConstraintsSchema.optional(),
    requestedAt: TimestampSchema,
    metadata: JsonObjectSchema.optional(),
  })
  .strict();

export type CapabilityRequest = z.infer<typeof CapabilityRequestSchema>;

/**
 * Authority issued to one subject and bounded by explicit constraints.
 *
 * A grant that was derived from another grant names its immediate ancestor in
 * `parentGrantId`. The link is a claim, not proof: SharedOS resolves and
 * validates the complete chain before the grant may authorize anything.
 *
 * `deriveGrant` in `@aicoo/sharedos-core` is the supported way to produce one.
 * It only ever emits this single link: a chain embedded in the grant would be
 * provenance the presenter controls, and the ancestors are re-resolved from the
 * issuing store at every decision instead.
 */
export const CapabilityGrantSchema = z
  .object({
    id: IdentifierSchema,
    namespaceId: IdentifierSchema,
    subject: AddressSchema,
    issuer: AddressSchema,
    capabilities: z.array(CapabilitySchema).min(1).max(64),
    constraints: CapabilityConstraintsSchema,
    issuedAt: TimestampSchema,
    revokedAt: TimestampSchema.optional(),
    parentGrantId: IdentifierSchema.optional(),
    metadata: JsonObjectSchema.optional(),
  })
  .strict()
  .superRefine((grant, context) => {
    if (grant.parentGrantId === grant.id) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "a grant must not name itself as its delegation parent",
        path: ["parentGrantId"],
      });
    }
  });

export type CapabilityGrant = z.infer<typeof CapabilityGrantSchema>;

/** The exact capability a tool invocation requires. */
export const CapabilityRequirementSchema = z
  .object({
    resource: ResourceRefSchema,
    action: ActionSchema,
  })
  .strict();

export type CapabilityRequirement = z.infer<typeof CapabilityRequirementSchema>;
