import type {
  AccessContext,
  JsonObject,
  ToolCall,
  ToolDefinition,
  ToolResult,
} from "@sharedos/contracts";

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

export class ToolRegistry {
  readonly #tools = new Map<string, ToolHandler>();

  register(handler: ToolHandler): void {
    const name = handler.definition.name;
    if (name.length === 0) {
      throw new TypeError("tool name must not be empty");
    }
    if (this.#tools.has(name)) {
      throw new DuplicateRegistrationError("tool", name);
    }

    const definition = deepFreeze(cloneDefinition(handler.definition));
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
