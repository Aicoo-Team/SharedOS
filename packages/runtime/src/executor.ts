import {
  ExecutionRequestSchema,
  MAX_EXECUTION_TOOL_CALLS,
  MAX_EXECUTION_TIMEOUT_MS,
  RuntimeEventSchema,
  RuntimeManifestSchema,
  RuntimeTurnOutcomeSchema,
  ToolCallSchema,
  ToolResultSchema,
  type AccessContext,
  type ExecutionEvent,
  type ExecutionRequest,
  type ExecutionResult,
  type JsonObject,
  type JsonValue,
  type ProtocolError,
  type RuntimeEvent,
  type RuntimeManifest,
  type RuntimeTurnOutcome,
  type ToolCall,
  type ReachableResource,
  type ToolDefinition,
  type ToolResult,
} from "@aicoo/sharedos-contracts";
import type { SharedOSKernel } from "@aicoo/sharedos-core";

import { createAbortController, deepFreeze, protocolError, raceWithAbort } from "./internal.js";
import type {
  RuntimeHost,
  RuntimeLimits,
  RuntimePlugin,
  RuntimeToolInvocationOptions,
  RuntimeTurnRequest,
} from "./runtime-plugin.js";
import {
  StandardRuntime,
  type AgentTurnDriver,
  type StandardRuntimeOptions,
} from "./standard-runtime.js";

export interface SharedOSExecutorOptions {
  clock?: () => string;
  createId?: () => string;
  defaultMaxSteps?: number;
  defaultMaxToolCalls?: number;
  defaultTimeoutMs?: number;
}

export interface ExecuteTurnOptions {
  signal?: AbortSignal;
  /** Synchronous observation hook for streaming an immutable event snapshot. */
  onEvent?: (event: ExecutionEvent) => void;
}

export interface TurnExecutionPort {
  execute(input: ExecutionRequest, options?: ExecuteTurnOptions): Promise<ExecutionResult>;
}

export interface TurnExecutorOptions extends SharedOSExecutorOptions, StandardRuntimeOptions {}

/**
 * The minimal deny-by-default kernel surface required by a turn executor.
 *
 * Hosts normally pass a {@link SharedOSKernel}. Keeping this port explicit also
 * permits narrow test doubles without granting a runtime direct access to
 * registries, namespace settings, or other host policy state.
 */
export type TurnKernel = Pick<
  SharedOSKernel,
  "admitTurn" | "listTools" | "listReachable" | "invokeTool"
>;

/**
 * The non-replaceable security envelope around one replaceable RuntimePlugin.
 * Scheduling, retries, and network-level stopping remain host responsibilities.
 */
export class SharedOSExecutor implements TurnExecutionPort {
  readonly #kernel: TurnKernel;
  readonly #runtime: RuntimePlugin;
  readonly #manifest: RuntimeManifest;
  readonly #clock: () => string;
  readonly #createId: () => string;
  readonly #defaultMaxSteps: number;
  readonly #defaultMaxToolCalls: number | undefined;
  readonly #defaultTimeoutMs: number;

  constructor(kernel: TurnKernel, runtime: RuntimePlugin, options: SharedOSExecutorOptions = {}) {
    if (runtime === null || typeof runtime !== "object" || typeof runtime.run !== "function") {
      throw new TypeError("Runtime plugin must provide a run function");
    }
    const manifest = RuntimeManifestSchema.safeParse(runtime.manifest);
    if (!manifest.success) {
      throw new TypeError("Runtime manifest does not match the SharedOS v1 contract");
    }

    this.#kernel = kernel;
    this.#manifest = deepFreeze(structuredClone(manifest.data));
    this.#runtime = Object.freeze({
      manifest: this.#manifest,
      run: runtime.run.bind(runtime),
    });
    this.#clock = options.clock ?? (() => new Date().toISOString());
    this.#createId = options.createId ?? (() => crypto.randomUUID());
    this.#defaultMaxSteps = options.defaultMaxSteps ?? 16;
    this.#defaultMaxToolCalls = options.defaultMaxToolCalls;
    this.#defaultTimeoutMs = options.defaultTimeoutMs ?? 120_000;

    if (!Number.isInteger(this.#defaultMaxSteps) || this.#defaultMaxSteps <= 0) {
      throw new TypeError("defaultMaxSteps must be a positive integer");
    }
    if (
      this.#defaultMaxToolCalls !== undefined &&
      (!Number.isInteger(this.#defaultMaxToolCalls) ||
        this.#defaultMaxToolCalls <= 0 ||
        this.#defaultMaxToolCalls > MAX_EXECUTION_TOOL_CALLS)
    ) {
      throw new TypeError(`defaultMaxToolCalls must be between 1 and ${MAX_EXECUTION_TOOL_CALLS}`);
    }
    if (
      !Number.isInteger(this.#defaultTimeoutMs) ||
      this.#defaultTimeoutMs <= 0 ||
      this.#defaultTimeoutMs > MAX_EXECUTION_TIMEOUT_MS
    ) {
      throw new TypeError(`defaultTimeoutMs must be between 1 and ${MAX_EXECUTION_TIMEOUT_MS}`);
    }
  }

  get runtimeManifest(): RuntimeManifest {
    return structuredClone(this.#manifest);
  }

  async execute(
    input: ExecutionRequest,
    options: ExecuteTurnOptions = {},
  ): Promise<ExecutionResult> {
    const parsed = ExecutionRequestSchema.safeParse(input);
    if (!parsed.success) {
      throw new TypeError("ExecutionRequest does not match the SharedOS v1 contract");
    }

    const request = parsed.data;
    const startedAt = this.#clock();
    const events: ExecutionEvent[] = [];
    const emit = (type: string, data: JsonValue): void => {
      const event: ExecutionEvent = {
        version: "1",
        eventId: this.#createId(),
        executionId: request.executionId,
        traceId: request.context.traceId,
        sequence: events.length,
        type,
        data,
        occurredAt: this.#clock(),
      };
      events.push(event);
      try {
        options.onEvent?.(deepFreeze(structuredClone(event)));
      } catch {
        // An observational stream sink cannot replace the execution outcome.
      }
    };
    const metadata = runtimeResultMetadata(this.#manifest);

    const contextError = validateTurnContext(request);
    if (contextError !== undefined) {
      emit("turn.denied", { code: contextError.code });
      return resultFor(request, events, startedAt, this.#clock(), "denied", contextError, metadata);
    }

    const timeoutMs = request.options?.timeoutMs ?? this.#defaultTimeoutMs;
    const maxSteps = request.options?.maxSteps ?? this.#defaultMaxSteps;
    const limits: RuntimeLimits = deepFreeze({
      maxSteps,
      maxToolCalls: request.options?.maxToolCalls ?? this.#defaultMaxToolCalls ?? maxSteps,
      timeoutMs,
    });
    const abort = createAbortController(options.signal, timeoutMs);
    let runtimeHostActive = true;
    let toolCallCount = 0;

    try {
      if (abort.signal.aborted) {
        return cancelledResult(request, events, startedAt, this.#clock(), metadata);
      }

      const executionContext = structuredClone(contextAt(request.context, this.#clock()));
      const admission = await raceWithAbort(
        this.#kernel.admitTurn(executionContext, request.agent, { signal: abort.signal }),
        abort.signal,
      );
      if (!admission.allowed) {
        const error = protocolError(
          admission.reasonCode,
          "The access context does not grant permission to invoke this agent.",
        );
        emit("turn.denied", { code: error.code });
        return resultFor(request, events, startedAt, this.#clock(), "denied", error, metadata);
      }

      const allowedTools = await raceWithAbort(
        this.#kernel.listTools(executionContext, { signal: abort.signal }),
        abort.signal,
      );
      const requestedNames = new Set(request.tools.map(({ name }) => name));
      const effectiveTools = allowedTools.filter(({ name }) => requestedNames.has(name));
      const effectiveToolNames = new Set(effectiveTools.map(({ name }) => name));
      const reachable = await raceWithAbort(
        this.#kernel.listReachable(executionContext, { signal: abort.signal }),
        abort.signal,
      );
      const runtimeRequest = toRuntimeTurnRequest(
        request,
        executionContext,
        effectiveTools,
        reachable,
      );

      emit("turn.started", {
        agent: request.agent,
        visibleTools: effectiveTools.map(({ name }) => name),
        runtime: runtimeProvenance(this.#manifest),
      });

      const host: RuntimeHost = Object.freeze({
        limits,
        invokeTool: async (
          call: ToolCall,
          invocationOptions: RuntimeToolInvocationOptions = {},
        ): Promise<ToolResult> => {
          assertRuntimeHostActive(runtimeHostActive, abort.signal);
          const parsedCall = ToolCallSchema.safeParse(structuredClone(call));
          if (!parsedCall.success) {
            throw new TypeError("Runtime tool call does not match the SharedOS v1 contract");
          }
          const step = parseRuntimeStep(invocationOptions.step);
          const eventData = toolEventData(parsedCall.data, step);
          emit("tool.requested", eventData);

          if (toolCallCount >= limits.maxToolCalls) {
            const result = deniedToolResult(
              parsedCall.data,
              this.#clock(),
              "tool_call_limit_exceeded",
              "The runtime reached its maximum number of tool calls.",
            );
            emit("tool.completed", completedToolEventData(result, step));
            return result;
          }
          toolCallCount += 1;

          if (!effectiveToolNames.has(parsedCall.data.tool)) {
            const result = unavailableToolResult(parsedCall.data, this.#clock());
            emit("tool.completed", completedToolEventData(result, step));
            return result;
          }

          const resultCandidate = await raceWithAbort(
            this.#kernel.invokeTool(contextAt(executionContext, this.#clock()), parsedCall.data, {
              signal: abort.signal,
            }),
            abort.signal,
          );
          const result = ToolResultSchema.safeParse(resultCandidate);
          if (!result.success) {
            throw new TypeError("Kernel returned an invalid tool result");
          }
          assertRuntimeHostActive(runtimeHostActive, abort.signal);
          emit("tool.completed", completedToolEventData(result.data, step));
          return result.data;
        },
        emit: (event: RuntimeEvent): void => {
          assertRuntimeHostActive(runtimeHostActive, abort.signal);
          const parsedEvent = RuntimeEventSchema.safeParse(structuredClone(event));
          if (!parsedEvent.success) {
            throw new TypeError("Runtime event does not match the SharedOS v1 contract");
          }
          emit("runtime.event", {
            runtime: runtimeProvenance(this.#manifest),
            type: parsedEvent.data.type,
            data: parsedEvent.data.data,
          });
        },
      });

      const outcomeCandidate: unknown = await raceWithAbort(
        this.#runtime.run(runtimeRequest, host, abort.signal),
        abort.signal,
      );
      const outcome = RuntimeTurnOutcomeSchema.safeParse(outcomeCandidate);
      if (!outcome.success) {
        const error = protocolError(
          "invalid_runtime_outcome",
          "The runtime plugin returned an invalid terminal outcome.",
        );
        emit("turn.failed", { code: error.code });
        return resultFor(request, events, startedAt, this.#clock(), "failed", error, metadata);
      }

      if (outcome.data.type === "complete") {
        emit("turn.completed", {});
        return {
          version: "1",
          executionId: request.executionId,
          traceId: request.context.traceId,
          status: "succeeded",
          output: outcome.data.output,
          events,
          startedAt,
          completedAt: this.#clock(),
          metadata: runtimeResultMetadata(this.#manifest, outcome.data),
        };
      }

      emit("turn.failed", { code: outcome.data.error.code });
      return resultFor(
        request,
        events,
        startedAt,
        this.#clock(),
        "failed",
        outcome.data.error,
        runtimeResultMetadata(this.#manifest, outcome.data),
      );
    } catch {
      if (abort.signal.aborted) {
        emit("turn.cancelled", {});
        return cancelledResult(request, events, startedAt, this.#clock(), metadata);
      }

      const error = protocolError("runtime_failed", "The runtime plugin failed.", true);
      emit("turn.failed", { code: error.code });
      return resultFor(request, events, startedAt, this.#clock(), "failed", error, metadata);
    } finally {
      runtimeHostActive = false;
      abort.abort(new Error("turn closed"));
      abort.dispose();
    }
  }
}

/**
 * Compatibility facade for the original driver-based API. New harnesses should
 * implement RuntimePlugin and use SharedOSExecutor directly.
 */
export class TurnExecutor implements TurnExecutionPort {
  readonly #executor: SharedOSExecutor;

  constructor(kernel: TurnKernel, driver: AgentTurnDriver, options: TurnExecutorOptions = {}) {
    const runtimeOptions: StandardRuntimeOptions = {
      ...(options.closeTimeoutMs === undefined ? {} : { closeTimeoutMs: options.closeTimeoutMs }),
    };
    const executorOptions: SharedOSExecutorOptions = {
      ...(options.clock === undefined ? {} : { clock: options.clock }),
      ...(options.createId === undefined ? {} : { createId: options.createId }),
      ...(options.defaultMaxSteps === undefined
        ? {}
        : { defaultMaxSteps: options.defaultMaxSteps }),
      ...(options.defaultMaxToolCalls === undefined
        ? {}
        : { defaultMaxToolCalls: options.defaultMaxToolCalls }),
      ...(options.defaultTimeoutMs === undefined
        ? {}
        : { defaultTimeoutMs: options.defaultTimeoutMs }),
    };
    this.#executor = new SharedOSExecutor(
      kernel,
      new StandardRuntime(driver, runtimeOptions),
      executorOptions,
    );
  }

  get runtimeManifest(): RuntimeManifest {
    return this.#executor.runtimeManifest;
  }

  execute(input: ExecutionRequest, options: ExecuteTurnOptions = {}): Promise<ExecutionResult> {
    return this.#executor.execute(input, options);
  }
}

function toRuntimeTurnRequest(
  request: ExecutionRequest,
  context: AccessContext,
  tools: readonly ToolDefinition[],
  reachable: readonly ReachableResource[],
): RuntimeTurnRequest {
  return deepFreeze(
    structuredClone({
      version: request.version,
      executionId: request.executionId,
      agent: request.agent,
      message: request.message,
      tools: [...tools],
      context: {
        actor: context.actor,
        owner: context.owner,
        namespaceId: context.namespaceId,
        purpose: context.purpose,
        traceId: context.traceId,
        now: context.now,
        reachable,
      },
      ...(request.state === undefined ? {} : { state: request.state }),
      ...(request.options === undefined ? {} : { options: request.options }),
      ...(request.metadata === undefined ? {} : { metadata: request.metadata }),
    }),
  );
}

function parseRuntimeStep(step: number | undefined): number | undefined {
  if (step === undefined) {
    return undefined;
  }
  if (!Number.isInteger(step) || step < 0) {
    throw new TypeError("Runtime tool invocation step must be a non-negative integer");
  }
  return step;
}

function toolEventData(call: ToolCall, step: number | undefined): JsonObject {
  return {
    callId: call.id,
    tool: call.tool,
    ...(step === undefined ? {} : { step }),
  };
}

function completedToolEventData(result: ToolResult, step: number | undefined): JsonObject {
  return {
    callId: result.callId,
    status: result.status,
    tool: result.tool,
    ...(step === undefined ? {} : { step }),
  };
}

function assertRuntimeHostActive(active: boolean, signal: AbortSignal): void {
  if (!active || signal.aborted) {
    throw new Error("Runtime host is closed");
  }
}

function contextAt(context: AccessContext, now: string): AccessContext {
  return { ...context, now };
}

function validateTurnContext(request: ExecutionRequest): ProtocolError | undefined {
  if (canonicalJson(request.message.sender) !== canonicalJson(request.context.actor)) {
    return protocolError("actor_mismatch", "Message sender does not match the access actor.");
  }

  if (canonicalJson(request.message.receiver) !== canonicalJson(request.agent)) {
    return protocolError(
      "receiver_mismatch",
      "Message receiver does not match the executing agent.",
    );
  }

  if (
    request.message.traceId !== request.context.traceId ||
    request.message.purpose !== request.context.purpose
  ) {
    return protocolError(
      "message_context_mismatch",
      "Message trace or purpose does not match the access context.",
    );
  }

  return undefined;
}

function resultFor(
  request: ExecutionRequest,
  events: readonly ExecutionEvent[],
  startedAt: string,
  completedAt: string,
  status: "denied" | "failed" | "cancelled",
  error: ProtocolError,
  metadata: JsonObject,
): ExecutionResult {
  const base = {
    version: "1" as const,
    executionId: request.executionId,
    traceId: request.context.traceId,
    events: [...events],
    startedAt,
    completedAt,
    metadata,
  };

  return status === "cancelled" ? { ...base, status, error } : { ...base, status, error };
}

function cancelledResult(
  request: ExecutionRequest,
  events: readonly ExecutionEvent[],
  startedAt: string,
  completedAt: string,
  metadata: JsonObject,
): ExecutionResult {
  return resultFor(
    request,
    events,
    startedAt,
    completedAt,
    "cancelled",
    protocolError("turn_cancelled", "The agent turn was cancelled.", true),
    metadata,
  );
}

function unavailableToolResult(call: ToolCall, completedAt: string): ToolResult {
  return deniedToolResult(
    call,
    completedAt,
    "tool_not_available",
    "The tool is not available in this permission-filtered turn.",
  );
}

function deniedToolResult(
  call: ToolCall,
  completedAt: string,
  code: string,
  message: string,
): ToolResult {
  return {
    callId: call.id,
    tool: call.tool,
    status: "denied",
    completedAt,
    error: protocolError(code, message),
  };
}

function runtimeProvenance(manifest: RuntimeManifest): JsonObject {
  return {
    id: manifest.id,
    version: manifest.version,
    protocolVersion: manifest.protocolVersion,
  };
}

function runtimeResultMetadata(
  manifest: RuntimeManifest,
  outcome?: Pick<RuntimeTurnOutcome, "metadata">,
): JsonObject {
  return {
    ...(outcome?.metadata ?? {}),
    runtime: {
      ...runtimeProvenance(manifest),
      ...(manifest.metadata === undefined ? {} : { metadata: manifest.metadata }),
    },
  };
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}
