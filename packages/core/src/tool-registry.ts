import type {
  AccessContext,
  JsonObject,
  ToolCall,
  ToolDefinition,
  ToolNamespaceCatalog,
  ToolResult,
} from "@sharedos/contracts";
import { ToolDefinitionSchema } from "@sharedos/contracts";

import type { AuthorizationRequest } from "./authorization.js";
import { DuplicateRegistrationError } from "./errors.js";

export interface ToolHandler {
  readonly definition: ToolDefinition;
  /** Parse and normalize untrusted arguments before authorization or execution. */
  readonly parseArguments: (arguments_: JsonObject) => unknown;
  /** Resolve argument-selected resources immediately before execution. */
  readonly resolveRequirement?: (context: AccessContext, call: ToolCall) => AuthorizationRequest;
  invoke(context: AccessContext, call: ToolCall, signal: AbortSignal): Promise<ToolResult>;
}

/**
 * Supplies tools for exactly one trusted access context.
 *
 * Hosts use this port for user-specific MCP servers and other dynamic catalogs
 * instead of mutating one global registry shared by concurrent users.
 */
export interface ContextToolProvider {
  readonly id: string;
  listTools(context: AccessContext, signal: AbortSignal): Promise<readonly ToolHandler[]>;
}

export class ToolRegistry {
  readonly #tools = new Map<string, ToolHandler>();

  register(handler: ToolHandler): void {
    const parsedDefinition = ToolDefinitionSchema.safeParse(handler.definition);
    if (!parsedDefinition.success) {
      throw new TypeError("tool definition does not match the SharedOS contract");
    }

    const name = parsedDefinition.data.name;
    if (name.length === 0) {
      throw new TypeError("tool name must not be empty");
    }
    if (this.#tools.has(name)) {
      throw new DuplicateRegistrationError("tool", name);
    }

    const definition = deepFreeze(cloneDefinition(parsedDefinition.data));
    const parseArguments = handler.parseArguments;
    const resolveRequirement = handler.resolveRequirement;
    const invoke = handler.invoke;
    const registered: ToolHandler = {
      definition,
      parseArguments: (arguments_) => parseArguments(arguments_),
      invoke: (context, call, signal) => invoke(context, call, signal),
      ...(resolveRequirement === undefined
        ? {}
        : {
            resolveRequirement: (context: AccessContext, call: ToolCall) =>
              resolveRequirement(context, call),
          }),
    };

    this.#tools.set(name, registered);
  }

  get(name: string): ToolHandler | undefined {
    return this.#tools.get(name);
  }

  has(name: string): boolean {
    return this.#tools.has(name);
  }

  definitions(): readonly ToolDefinition[] {
    return [...this.#tools.values()]
      .map(({ definition }) => definition)
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  handlers(): readonly ToolHandler[] {
    return [...this.#tools.values()].sort((left, right) =>
      left.definition.name.localeCompare(right.definition.name),
    );
  }

  namespaceCatalog(enabledToolNamespaces: readonly string[]): ToolNamespaceCatalog {
    const enabled = new Set(enabledToolNamespaces);
    const grouped = new Map<string, { sources: Set<string>; toolCount: number }>();

    for (const definition of this.definitions()) {
      const current = grouped.get(definition.namespace) ?? {
        sources: new Set<string>(),
        toolCount: 0,
      };
      current.sources.add(definition.source);
      current.toolCount += 1;
      grouped.set(definition.namespace, current);
    }

    const namespaces = [...grouped.entries()]
      .map(([namespace, value]) => ({
        namespace,
        sources: [...value.sources].sort(),
        toolCount: value.toolCount,
        enabled: enabled.has(namespace),
      }))
      .sort((left, right) => left.namespace.localeCompare(right.namespace));

    return {
      namespaces,
      summary: {
        total: namespaces.length,
        enabled: namespaces.filter((namespace) => namespace.enabled).length,
        disabled: namespaces.filter((namespace) => !namespace.enabled).length,
      },
    };
  }
}

function cloneDefinition(definition: ToolDefinition): ToolDefinition {
  return JSON.parse(JSON.stringify(definition)) as ToolDefinition;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }

  return value;
}
