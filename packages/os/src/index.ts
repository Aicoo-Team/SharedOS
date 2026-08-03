import { z } from "zod";

import {
  JsonValueSchema,
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

export const MEMORY_NAMESPACE = "memory";
export const WORKSPACE_NAMESPACE = "workspace";

const PathSchema = z.array(z.string().trim().min(1).max(256)).max(64);

export const MemorySearchArgumentsSchema = z
  .object({
    path: PathSchema,
    query: z.string().trim().min(1).max(8_192),
    limit: z.number().int().positive().max(100).optional(),
  })
  .strict();
export type MemorySearchArguments = z.infer<typeof MemorySearchArgumentsSchema>;

export const MemoryReadArgumentsSchema = z.object({ path: PathSchema.min(1) }).strict();
export type MemoryReadArguments = z.infer<typeof MemoryReadArgumentsSchema>;

export const MemoryAppendArgumentsSchema = z
  .object({
    path: PathSchema,
    value: JsonValueSchema,
    metadata: z.record(JsonValueSchema).optional(),
  })
  .strict();
export type MemoryAppendArguments = z.infer<typeof MemoryAppendArgumentsSchema>;

export const WorkspacePathArgumentsSchema = z.object({ path: PathSchema }).strict();
export type WorkspacePathArguments = z.infer<typeof WorkspacePathArgumentsSchema>;

export const WorkspaceSearchArgumentsSchema = z
  .object({
    path: PathSchema,
    query: z.string().trim().min(1).max(8_192),
    limit: z.number().int().positive().max(100).optional(),
  })
  .strict();
export type WorkspaceSearchArguments = z.infer<typeof WorkspaceSearchArgumentsSchema>;

export const WorkspaceGrepArgumentsSchema = z
  .object({
    path: PathSchema,
    pattern: z.string().min(1).max(8_192),
    mode: z.enum(["literal", "regex"]).default("literal"),
    caseSensitive: z.boolean().default(false),
    contextBefore: z.number().int().nonnegative().max(100).default(0),
    contextAfter: z.number().int().nonnegative().max(100).default(0),
  })
  .strict();
export type WorkspaceGrepArguments = z.infer<typeof WorkspaceGrepArgumentsSchema>;

export const WorkspaceWriteArgumentsSchema = z
  .object({
    path: PathSchema.min(1),
    content: JsonValueSchema,
    expectedVersion: z.string().trim().min(1).max(256).optional(),
  })
  .strict();
export type WorkspaceWriteArguments = z.infer<typeof WorkspaceWriteArgumentsSchema>;

export const WorkspaceSnapshotRestoreArgumentsSchema = z
  .object({
    path: PathSchema.min(1),
    snapshotId: z.string().trim().min(1).max(256),
  })
  .strict();
export type WorkspaceSnapshotRestoreArguments = z.infer<
  typeof WorkspaceSnapshotRestoreArgumentsSchema
>;

interface ParsedResourceCall {
  readonly path: string[];
  readonly input?: JsonValue;
}

interface ResourceToolSpec {
  readonly definition: ToolDefinition;
  parse(arguments_: JsonObject): ParsedResourceCall;
}

export interface StandardOsProviders {
  readonly memory?: ResourceProvider;
  readonly workspace?: ResourceProvider;
}

export function registerStandardOsTools(
  kernel: Pick<SharedOSKernel, "registerTool">,
  providers: StandardOsProviders,
): void {
  if (providers.memory !== undefined) {
    for (const handler of createMemoryTools(providers.memory)) {
      kernel.registerTool(handler);
    }
  }

  if (providers.workspace !== undefined) {
    for (const handler of createWorkspaceTools(providers.workspace)) {
      kernel.registerTool(handler);
    }
  }
}

export function createMemoryTools(provider: ResourceProvider): readonly ToolHandler[] {
  requireProviderNamespace(provider, MEMORY_NAMESPACE);
  return [
    resourceTool(provider, {
      definition: definition({
        name: "memory.read",
        description: "Read a memory at an explicitly granted path.",
        namespace: MEMORY_NAMESPACE,
        action: "read",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          required: ["path"],
          properties: { path: pathJsonSchema(1) },
        },
        readOnly: true,
      }),
      parse: (arguments_) => ({ path: MemoryReadArgumentsSchema.parse(arguments_).path }),
    }),
    resourceTool(provider, {
      definition: definition({
        name: "memory.search",
        description: "Search long-term memory inside an explicitly granted path.",
        namespace: MEMORY_NAMESPACE,
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
        const args = MemorySearchArgumentsSchema.parse(arguments_);
        return {
          path: args.path,
          input: compactObject({ query: args.query, limit: args.limit }),
        };
      },
    }),
    resourceTool(provider, {
      definition: definition({
        name: "memory.append",
        description: "Append a durable memory inside an explicitly granted path.",
        namespace: MEMORY_NAMESPACE,
        action: "append",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          required: ["path", "value"],
          properties: {
            path: pathJsonSchema(),
            value: {},
            metadata: { type: "object" },
          },
        },
      }),
      parse: (arguments_) => {
        const args = MemoryAppendArgumentsSchema.parse(arguments_);
        return {
          path: args.path,
          input: compactObject({ value: args.value, metadata: args.metadata }),
        };
      },
    }),
  ];
}

export function createWorkspaceTools(provider: ResourceProvider): readonly ToolHandler[] {
  requireProviderNamespace(provider, WORKSPACE_NAMESPACE);
  return [
    pathOnlyTool(
      provider,
      "workspace.list",
      "List entries inside a granted workspace path.",
      "list",
    ),
    pathOnlyTool(provider, "workspace.read", "Read content from a granted workspace path.", "read"),
    resourceTool(provider, {
      definition: definition({
        name: "workspace.search",
        description: "Semantically search content inside a granted workspace path.",
        namespace: WORKSPACE_NAMESPACE,
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
        const args = WorkspaceSearchArgumentsSchema.parse(arguments_);
        return {
          path: args.path,
          input: compactObject({ query: args.query, limit: args.limit }),
        };
      },
    }),
    resourceTool(provider, {
      definition: definition({
        name: "workspace.grep",
        description: "Run deterministic literal or regex search with line context.",
        namespace: WORKSPACE_NAMESPACE,
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
        const { path, ...input } = WorkspaceGrepArgumentsSchema.parse(arguments_);
        return { path, input };
      },
    }),
    resourceTool(provider, {
      definition: definition({
        name: "workspace.write",
        description: "Create or replace content at an explicitly granted workspace path.",
        namespace: WORKSPACE_NAMESPACE,
        action: "write",
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
        const { path, content, expectedVersion } = WorkspaceWriteArgumentsSchema.parse(arguments_);
        return {
          path,
          input: compactObject({ content, expectedVersion }),
        };
      },
    }),
    pathOnlyTool(
      provider,
      "workspace.snapshot.create",
      "Create a restorable snapshot of a granted workspace resource.",
      "snapshot:create",
    ),
    resourceTool(provider, {
      definition: definition({
        name: "workspace.snapshot.restore",
        description: "Restore a granted workspace resource from a named snapshot.",
        namespace: WORKSPACE_NAMESPACE,
        action: "snapshot:restore",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          required: ["path", "snapshotId"],
          properties: {
            path: pathJsonSchema(1),
            snapshotId: { type: "string" },
          },
        },
        destructive: true,
      }),
      parse: (arguments_) => {
        const { path, snapshotId } = WorkspaceSnapshotRestoreArgumentsSchema.parse(arguments_);
        return { path, input: { snapshotId } };
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
      namespace: WORKSPACE_NAMESPACE,
      action,
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["path"],
        properties: { path: pathJsonSchema() },
      },
      readOnly: action === "list" || action === "read",
    }),
    parse: (arguments_) => ({ path: WorkspacePathArgumentsSchema.parse(arguments_).path }),
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
        message: "The OS resource provider returned an invalid result.",
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
  namespace: string;
  action: string;
  inputSchema: JsonObject;
  readOnly?: boolean;
  destructive?: boolean;
}): ToolDefinition {
  return {
    name: args.name,
    description: args.description,
    inputSchema: args.inputSchema,
    requiredCapability: {
      resource: { namespace: args.namespace, path: [] },
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
