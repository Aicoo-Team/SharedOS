import { z } from "zod";

import {
  JsonValueSchema,
  PathSegmentSchema,
  ResourceResultSchema,
  type AccessContext,
  type JsonObject,
  type JsonValue,
  type ResourceOperation,
  type ResourceResult,
  type ToolCall,
  type ToolDefinition,
  type ToolResult,
} from "@sharedos/contracts";
import type { ResourceProvider, SharedOSKernel, ToolHandler } from "@sharedos/core";

/** The canonical SharedOS resource plane. Memory is a role of files, not a second store. */
export const FILES_NAMESPACE = "files";
export const SHAREDOS_TOOL_SOURCE = "sharedos";

export const FilePathSchema = z.array(PathSegmentSchema).max(64);
export type FilePath = z.infer<typeof FilePathSchema>;

export const FilesPathArgumentsSchema = z.object({ path: FilePathSchema }).strict();
export type FilesPathArguments = z.infer<typeof FilesPathArgumentsSchema>;

export const FilesSearchArgumentsSchema = z
  .object({
    path: FilePathSchema,
    query: z.string().trim().min(1).max(8_192),
    limit: z.number().int().positive().max(100).optional(),
  })
  .strict();
export type FilesSearchArguments = z.infer<typeof FilesSearchArgumentsSchema>;

export const FilesGrepArgumentsSchema = z
  .object({
    path: FilePathSchema,
    pattern: z.string().min(1).max(8_192),
    mode: z.enum(["literal", "regex"]).default("literal"),
    caseSensitive: z.boolean().default(false),
    contextBefore: z.number().int().nonnegative().max(100).default(0),
    contextAfter: z.number().int().nonnegative().max(100).default(0),
  })
  .strict();
export type FilesGrepArguments = z.infer<typeof FilesGrepArgumentsSchema>;

export const FilesCreateArgumentsSchema = z
  .object({
    path: FilePathSchema.min(1),
    content: JsonValueSchema,
    metadata: z.record(JsonValueSchema).optional(),
  })
  .strict();
export type FilesCreateArguments = z.infer<typeof FilesCreateArgumentsSchema>;

export const FilesReplaceArgumentsSchema = z
  .object({
    path: FilePathSchema.min(1),
    content: JsonValueSchema,
    expectedVersion: z.string().trim().min(1).max(256).optional(),
  })
  .strict();
export type FilesReplaceArguments = z.infer<typeof FilesReplaceArgumentsSchema>;

export const FilesAppendArgumentsSchema = z
  .object({
    path: FilePathSchema.min(1),
    content: JsonValueSchema,
    expectedVersion: z.string().trim().min(1).max(256).optional(),
    metadata: z.record(JsonValueSchema).optional(),
  })
  .strict();
export type FilesAppendArguments = z.infer<typeof FilesAppendArgumentsSchema>;

export const FilesDeleteArgumentsSchema = z
  .object({
    path: FilePathSchema.min(1),
    expectedVersion: z.string().trim().min(1).max(256).optional(),
    recursive: z.boolean().default(false),
  })
  .strict();
export type FilesDeleteArguments = z.infer<typeof FilesDeleteArgumentsSchema>;

export const FilesSnapshotCreateArgumentsSchema = z
  .object({
    path: FilePathSchema,
    label: z.string().trim().min(1).max(256).optional(),
  })
  .strict();
export type FilesSnapshotCreateArguments = z.infer<typeof FilesSnapshotCreateArgumentsSchema>;

export const FilesSnapshotListArgumentsSchema = z
  .object({
    path: FilePathSchema,
    limit: z.number().int().positive().max(100).optional(),
  })
  .strict();
export type FilesSnapshotListArguments = z.infer<typeof FilesSnapshotListArgumentsSchema>;

export const FilesSnapshotRestoreArgumentsSchema = z
  .object({
    path: FilePathSchema.min(1),
    snapshotId: z.string().trim().min(1).max(256),
    expectedVersion: z.string().trim().min(1).max(256).optional(),
  })
  .strict();
export type FilesSnapshotRestoreArguments = z.infer<typeof FilesSnapshotRestoreArgumentsSchema>;

interface ParsedResourceCall {
  readonly path: string[];
  readonly input?: JsonValue;
}

interface ResourceToolSpec {
  readonly definition: ToolDefinition;
  parse(arguments_: JsonObject): ParsedResourceCall;
}

export interface StandardOsProviders {
  readonly files?: ResourceProvider;
}

export function registerStandardOsTools(
  kernel: Pick<SharedOSKernel, "registerTool">,
  providers: StandardOsProviders,
): void {
  if (providers.files !== undefined) {
    for (const handler of createFileTools(providers.files)) {
      kernel.registerTool(handler);
    }
  }
}

/**
 * Portable file tools over one host-owned provider.
 *
 * A host may expose roots such as Raw, Memory, Workspace, and Wiki, but they
 * remain paths in this one resource plane. Search indexes and context mounts
 * must preserve the same file grants; they are not independent authority.
 */
export function createFileTools(provider: ResourceProvider): readonly ToolHandler[] {
  requireProviderNamespace(provider, FILES_NAMESPACE);
  return [
    pathOnlyTool(provider, "files.list", "List entries inside a granted file path.", "list"),
    pathOnlyTool(provider, "files.stat", "Read metadata for a granted file path.", "stat"),
    pathOnlyTool(provider, "files.read", "Read content from a granted file path.", "read"),
    resourceTool(provider, {
      definition: definition({
        name: "files.search",
        description: "Semantically search files inside an explicitly granted path.",
        action: "search",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          required: ["path", "query"],
          properties: {
            path: pathJsonSchema(),
            query: { type: "string" },
            limit: { type: "integer", minimum: 1, maximum: 100 },
          },
        },
        readOnly: true,
      }),
      parse: (arguments_) => {
        const args = FilesSearchArgumentsSchema.parse(arguments_);
        return {
          path: args.path,
          input: compactObject({ query: args.query, limit: args.limit }),
        };
      },
    }),
    resourceTool(provider, {
      definition: definition({
        name: "files.grep",
        description: "Run deterministic literal or regex search with line context.",
        action: "grep",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          required: ["path", "pattern"],
          properties: {
            path: pathJsonSchema(),
            pattern: { type: "string" },
            mode: { enum: ["literal", "regex"] },
            caseSensitive: { type: "boolean" },
            contextBefore: { type: "integer", minimum: 0, maximum: 100 },
            contextAfter: { type: "integer", minimum: 0, maximum: 100 },
          },
        },
        readOnly: true,
      }),
      parse: (arguments_) => {
        const { path, ...input } = FilesGrepArgumentsSchema.parse(arguments_);
        return { path, input };
      },
    }),
    resourceTool(provider, {
      definition: definition({
        name: "files.create",
        description: "Create a file at an explicitly granted, previously absent path.",
        action: "create",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          required: ["path", "content"],
          properties: {
            path: pathJsonSchema(1),
            content: {},
            metadata: { type: "object" },
          },
        },
      }),
      parse: (arguments_) => {
        const { path, content, metadata } = FilesCreateArgumentsSchema.parse(arguments_);
        return { path, input: compactObject({ content, metadata }) };
      },
    }),
    resourceTool(provider, {
      definition: definition({
        name: "files.replace",
        description: "Replace a file's complete content, optionally at an expected version.",
        action: "replace",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          required: ["path", "content"],
          properties: {
            path: pathJsonSchema(1),
            content: {},
            expectedVersion: { type: "string" },
          },
        },
        destructive: true,
      }),
      parse: (arguments_) => {
        const { path, content, expectedVersion } = FilesReplaceArgumentsSchema.parse(arguments_);
        return { path, input: compactObject({ content, expectedVersion }) };
      },
    }),
    resourceTool(provider, {
      definition: definition({
        name: "files.append",
        description: "Append content to a file at an explicitly granted path.",
        action: "append",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          required: ["path", "content"],
          properties: {
            path: pathJsonSchema(1),
            content: {},
            expectedVersion: { type: "string" },
            metadata: { type: "object" },
          },
        },
      }),
      parse: (arguments_) => {
        const { path, content, expectedVersion, metadata } =
          FilesAppendArgumentsSchema.parse(arguments_);
        return { path, input: compactObject({ content, expectedVersion, metadata }) };
      },
    }),
    resourceTool(provider, {
      definition: definition({
        name: "files.delete",
        description: "Delete a file path; recursive deletion must be requested explicitly.",
        action: "delete",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          required: ["path"],
          properties: {
            path: pathJsonSchema(1),
            expectedVersion: { type: "string" },
            recursive: { type: "boolean", default: false },
          },
        },
        destructive: true,
      }),
      parse: (arguments_) => {
        const { path, expectedVersion, recursive } = FilesDeleteArgumentsSchema.parse(arguments_);
        return { path, input: compactObject({ expectedVersion, recursive }) };
      },
    }),
    resourceTool(provider, {
      definition: definition({
        name: "files.snapshot.create",
        description: "Create a restorable snapshot of a granted file path.",
        action: "snapshot:create",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          required: ["path"],
          properties: { path: pathJsonSchema(), label: { type: "string" } },
        },
      }),
      parse: (arguments_) => {
        const { path, label } = FilesSnapshotCreateArgumentsSchema.parse(arguments_);
        return label === undefined ? { path } : { path, input: { label } };
      },
    }),
    resourceTool(provider, {
      definition: definition({
        name: "files.snapshot.list",
        description: "List snapshots for a granted file path.",
        action: "snapshot:list",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          required: ["path"],
          properties: {
            path: pathJsonSchema(),
            limit: { type: "integer", minimum: 1, maximum: 100 },
          },
        },
        readOnly: true,
      }),
      parse: (arguments_) => {
        const { path, limit } = FilesSnapshotListArgumentsSchema.parse(arguments_);
        return limit === undefined ? { path } : { path, input: { limit } };
      },
    }),
    resourceTool(provider, {
      definition: definition({
        name: "files.snapshot.restore",
        description: "Restore a granted file path from a named snapshot.",
        action: "snapshot:restore",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          required: ["path", "snapshotId"],
          properties: {
            path: pathJsonSchema(1),
            snapshotId: { type: "string" },
            expectedVersion: { type: "string" },
          },
        },
        destructive: true,
      }),
      parse: (arguments_) => {
        const { path, snapshotId, expectedVersion } =
          FilesSnapshotRestoreArgumentsSchema.parse(arguments_);
        return { path, input: compactObject({ snapshotId, expectedVersion }) };
      },
    }),
  ];
}

function pathOnlyTool(
  provider: ResourceProvider,
  name: string,
  description: string,
  action: string,
): ToolHandler {
  return resourceTool(provider, {
    definition: definition({
      name,
      description,
      action,
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["path"],
        properties: { path: pathJsonSchema() },
      },
      readOnly: true,
    }),
    parse: (arguments_) => ({ path: FilesPathArgumentsSchema.parse(arguments_).path }),
  });
}

function resourceTool(provider: ResourceProvider, spec: ResourceToolSpec): ToolHandler {
  return {
    definition: spec.definition,
    parseArguments: (arguments_) => {
      spec.parse(arguments_);
      return arguments_;
    },
    resolveRequirement: (context, call) => ({
      resource: {
        namespace: provider.namespace,
        path: spec.parse(call.arguments).path,
        owner: context.owner,
      },
      action: spec.definition.requiredCapability.action,
    }),
    invoke: async (context, call, signal) => {
      const parsed = spec.parse(call.arguments);
      const operation: ResourceOperation = {
        operationId: call.id,
        context,
        resource: { namespace: provider.namespace, path: parsed.path, owner: context.owner },
        action: spec.definition.requiredCapability.action,
        ...(parsed.input === undefined ? {} : { input: parsed.input }),
      };
      return toToolResult(call, context, await provider.invoke(operation, signal));
    },
  };
}

function toToolResult(
  call: ToolCall,
  context: AccessContext,
  candidate: ResourceResult,
): ToolResult {
  const parsed = ResourceResultSchema.safeParse(candidate);
  if (!parsed.success || parsed.data.operationId !== call.id) {
    return {
      callId: call.id,
      tool: call.tool,
      status: "failed",
      completedAt: context.now,
      error: {
        code: "invalid_resource_result",
        message: "The OS file provider returned an invalid result.",
      },
    };
  }

  const result = parsed.data;
  if (result.status === "succeeded") {
    return {
      callId: call.id,
      tool: call.tool,
      status: "succeeded",
      output: result.output,
      completedAt: result.completedAt,
      ...(result.metadata === undefined ? {} : { metadata: result.metadata }),
    };
  }

  return {
    callId: call.id,
    tool: call.tool,
    status: result.status,
    error: result.error,
    completedAt: result.completedAt,
    ...(result.metadata === undefined ? {} : { metadata: result.metadata }),
  };
}

function definition(args: {
  name: string;
  description: string;
  action: string;
  inputSchema: JsonObject;
  readOnly?: boolean;
  destructive?: boolean;
}): ToolDefinition {
  return {
    name: args.name,
    description: args.description,
    namespace: FILES_NAMESPACE,
    source: SHAREDOS_TOOL_SOURCE,
    readWrite: args.readOnly === true ? "read" : "write",
    inputSchema: args.inputSchema,
    requiredCapability: {
      resource: { namespace: FILES_NAMESPACE, path: [] },
      action: args.action,
    },
    annotations: {
      ...(args.readOnly === undefined ? {} : { readOnly: args.readOnly }),
      ...(args.destructive === undefined ? {} : { destructive: args.destructive }),
    },
  };
}

function pathJsonSchema(minItems = 0): JsonObject {
  return {
    type: "array",
    items: { type: "string" },
    minItems,
    maxItems: 64,
  };
}

function compactObject(values: Record<string, JsonValue | undefined>): JsonObject {
  return Object.fromEntries(
    Object.entries(values).filter((entry): entry is [string, JsonValue] => entry[1] !== undefined),
  );
}

function requireProviderNamespace(provider: ResourceProvider, expected: string): void {
  if (provider.namespace !== expected) {
    throw new TypeError(`Expected a ${expected} provider, received ${provider.namespace}`);
  }
}
