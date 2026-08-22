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

/** A positive capability. SharedOS is deny-by-default when no grant matches. */
export const CapabilitySchema = z
  .object({
    resource: ResourceRefSchema,
    actions: z.array(ActionSchema).min(1).max(64),
    scope: z.enum(["exact", "descendants"]),
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

/** Authority issued to one subject and bounded by explicit constraints. */
/**
 * Where a derived grant came from.
 *
 * `chain` is ordered root-first and ends with the immediate parent, so a
 * verifier can re-check every ancestor without walking links one at a time.
 * It is provenance, not authority: the constraints on a derived grant are
 * already narrowed at derivation, and the chain exists so a *later* revocation
 * or expiry upstream can still invalidate what was derived from it.
 */
export const GrantDelegationSchema = z
  .object({
    parentGrantId: IdentifierSchema,
    /** Remaining redelegations. Strictly less than the parent's. */
    depth: z.number().int().nonnegative(),
    chain: z.array(IdentifierSchema).min(1).max(16),
  })
  .strict();

export type GrantDelegation = z.infer<typeof GrantDelegationSchema>;

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
    /** Present only on a grant produced by `deriveGrant`. */
    delegation: GrantDelegationSchema.optional(),
    metadata: JsonObjectSchema.optional(),
  })
  .strict();

export type CapabilityGrant = z.infer<typeof CapabilityGrantSchema>;

/** The exact capability a tool invocation requires. */
export const CapabilityRequirementSchema = z
  .object({
    resource: ResourceRefSchema,
    action: ActionSchema,
  })
  .strict();

export type CapabilityRequirement = z.infer<typeof CapabilityRequirementSchema>;
