import {
  RuntimeManifestSchema,
  type AccessContext,
  type ReachableResource,
  type ExecutionRequest,
  type RuntimeEvent,
  type RuntimeManifest,
  type RuntimeTurnOutcome,
  type ToolCall,
  type ToolResult,
} from "@aicoo/sharedos-contracts";

import { deepFreeze } from "./internal.js";

export interface RuntimeVisibleContext {
  readonly actor: AccessContext["actor"];
  readonly owner: AccessContext["owner"];
  readonly namespaceId: string;
  readonly purpose: string;
  readonly traceId: string;
  readonly now: string;
  /**
   * Where this turn may operate. Derived from the same grants the kernel
   * enforces, with the authority stripped out, so a runtime can tell a model
   * where to look without a host describing the boundary in a prompt.
   */
  readonly reachable: readonly ReachableResource[];
}

/**
 * A runtime sees task input and the effective tool catalog, but never grants,
 * issuing authority, or namespace-management state.
 */
export type RuntimeTurnRequest = Omit<ExecutionRequest, "context"> & {
  readonly context: RuntimeVisibleContext;
};

export interface RuntimeLimits {
  readonly maxSteps: number;
  readonly maxToolCalls: number;
  readonly timeoutMs: number;
}

export interface RuntimeToolInvocationOptions {
  /** Optional diagnostic position within the runtime's own loop. */
  readonly step?: number;
}

/**
 * The only effectful surface supplied to a runtime plugin. Every tool call is
 * checked against the effective catalog and re-authorized by the kernel.
 */
export interface RuntimeHost {
  readonly limits: RuntimeLimits;
  invokeTool(call: ToolCall, options?: RuntimeToolInvocationOptions): Promise<ToolResult>;
  emit(event: RuntimeEvent): void;
}

/**
 * A replaceable one-turn harness running inside the SharedOS security envelope.
 * Implementations must keep per-turn state inside `run` and support concurrent
 * calls when one plugin instance is shared by a RuntimeRegistry.
 */
export interface RuntimePlugin {
  readonly manifest: RuntimeManifest;
  run(
    request: RuntimeTurnRequest,
    host: RuntimeHost,
    signal: AbortSignal,
  ): Promise<RuntimeTurnOutcome>;
}

export class RuntimeNotFoundError extends Error {
  constructor(runtimeId: string) {
    super(`Runtime is not registered: ${runtimeId}`);
    this.name = "RuntimeNotFoundError";
  }
}

/**
 * An instance-scoped registry populated by trusted host configuration. Runtime
 * selection is intentionally absent from model-visible execution requests.
 */
export class RuntimeRegistry {
  readonly #runtimes = new Map<string, RuntimePlugin>();

  constructor(runtimes: readonly RuntimePlugin[] = []) {
    for (const runtime of runtimes) {
      this.register(runtime);
    }
  }

  register(runtime: RuntimePlugin): void {
    if (runtime === null || typeof runtime !== "object" || typeof runtime.run !== "function") {
      throw new TypeError("Runtime plugin must provide a run function");
    }

    const parsed = RuntimeManifestSchema.safeParse(runtime.manifest);
    if (!parsed.success) {
      throw new TypeError("Runtime manifest does not match the SharedOS v1 contract");
    }
    if (this.#runtimes.has(parsed.data.id)) {
      throw new TypeError(`Runtime is already registered: ${parsed.data.id}`);
    }

    const manifest = deepFreeze(structuredClone(parsed.data));
    const registered: RuntimePlugin = Object.freeze({
      manifest,
      run: runtime.run.bind(runtime),
    });
    this.#runtimes.set(manifest.id, registered);
  }

  has(runtimeId: string): boolean {
    return this.#runtimes.has(runtimeId);
  }

  resolve(runtimeId: string): RuntimePlugin {
    const runtime = this.#runtimes.get(runtimeId);
    if (runtime === undefined) {
      throw new RuntimeNotFoundError(runtimeId);
    }
    return runtime;
  }

  list(): readonly RuntimeManifest[] {
    return [...this.#runtimes.values()].map(({ manifest }) => structuredClone(manifest));
  }
}
