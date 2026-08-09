import { z } from "zod";

import { CapabilityRequirementSchema } from "./capability.js";
import { IdentifierSchema, TimestampSchema } from "./common.js";
import { JsonObjectSchema, JsonValueSchema } from "./json.js";
import { ProtocolErrorSchema } from "./protocol-error.js";

/** A logical group of tools that a trusted host may enable for one access context. */
export const ToolNamespaceSchema = IdentifierSchema;
export type ToolNamespace = z.infer<typeof ToolNamespaceSchema>;

/**
 * The host-defined origin of a tool, for example `sharedos`, `native`, `mcp`,
 * or `composio`. This is catalog metadata, never proof of authority.
 */
export const ToolSourceSchema = IdentifierSchema;
export type ToolSource = z.infer<typeof ToolSourceSchema>;

/** A conservative catalog classification. Capabilities remain the authorization source. */
export const ToolReadWriteSchema = z.enum(["read", "write"]);
export type ToolReadWrite = z.infer<typeof ToolReadWriteSchema>;

export const EnabledToolNamespacesSchema = z
  .array(ToolNamespaceSchema)
  .max(256)
  .superRefine((namespaces, context) => {
    if (new Set(namespaces).size !== namespaces.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "enabled tool namespaces must be unique",
      });
    }
  });
export type EnabledToolNamespaces = z.infer<typeof EnabledToolNamespacesSchema>;

/**
 * An idempotent patch to a host-owned tool namespace selection.
 *
 * The host applies this atomically and returns the authoritative effective
 * selection after product policy ceilings have been enforced.
 */
export const ToolNamespaceUpdateSchema = z
  .object({
    enable: EnabledToolNamespacesSchema.optional(),
    disable: EnabledToolNamespacesSchema.optional(),
  })
  .strict()
  .superRefine((update, context) => {
    const enable = update.enable ?? [];
    const disable = update.disable ?? [];
    if (enable.length === 0 && disable.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "a tool namespace update must enable or disable at least one namespace",
      });
    }

    const enabled = new Set(enable);
    for (const namespace of disable) {
      if (enabled.has(namespace)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "a tool namespace cannot be enabled and disabled in the same update",
          path: ["disable"],
        });
      }
    }
  });
export type ToolNamespaceUpdate = z.infer<typeof ToolNamespaceUpdateSchema>;

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
    namespace: ToolNamespaceSchema,
    source: ToolSourceSchema,
    readWrite: ToolReadWriteSchema,
    inputSchema: JsonObjectSchema,
    outputSchema: JsonObjectSchema.optional(),
    requiredCapability: CapabilityRequirementSchema,
    annotations: ToolAnnotationsSchema.optional(),
    metadata: JsonObjectSchema.optional(),
  })
  .strict()
  .superRefine((definition, context) => {
    if (definition.readWrite === "read" && definition.annotations?.destructive === true) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "a read-classified tool cannot be destructive",
        path: ["annotations", "destructive"],
      });
    }
    if (definition.readWrite === "write" && definition.annotations?.readOnly === true) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "a write-classified tool cannot be read-only",
        path: ["annotations", "readOnly"],
      });
    }
  });

export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;

export const ToolNamespaceDescriptorSchema = z
  .object({
    namespace: ToolNamespaceSchema,
    sources: z.array(ToolSourceSchema).min(1).max(64),
    toolCount: z.number().int().positive(),
    enabled: z.boolean(),
  })
  .strict()
  .superRefine((descriptor, context) => {
    if (new Set(descriptor.sources).size !== descriptor.sources.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "tool namespace sources must be unique",
        path: ["sources"],
      });
    }
  });
export type ToolNamespaceDescriptor = z.infer<typeof ToolNamespaceDescriptorSchema>;

export const ToolNamespaceCatalogSchema = z
  .object({
    namespaces: z.array(ToolNamespaceDescriptorSchema).max(256),
    summary: z
      .object({
        total: z.number().int().nonnegative(),
        enabled: z.number().int().nonnegative(),
        disabled: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict()
  .superRefine((catalog, context) => {
    const names = catalog.namespaces.map(({ namespace }) => namespace);
    if (new Set(names).size !== names.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "tool namespaces in a catalog must be unique",
        path: ["namespaces"],
      });
    }

    const enabled = catalog.namespaces.filter((namespace) => namespace.enabled).length;
    const disabled = catalog.namespaces.length - enabled;
    if (
      catalog.summary.total !== catalog.namespaces.length ||
      catalog.summary.enabled !== enabled ||
      catalog.summary.disabled !== disabled
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "tool namespace catalog summary does not match its entries",
        path: ["summary"],
      });
    }
  });
export type ToolNamespaceCatalog = z.infer<typeof ToolNamespaceCatalogSchema>;

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
