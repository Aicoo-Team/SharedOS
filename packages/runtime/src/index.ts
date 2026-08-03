import {
  ExecutionRequestSchema,
  JsonObjectSchema,
  JsonValueSchema,
  MAX_EXECUTION_TIMEOUT_MS,
  ProtocolErrorSchema,
  ToolCallSchema,
  type AccessContext,
  type ExecutionEvent,
  type ExecutionRequest,
  type ExecutionResult,
  type JsonObject,
  type JsonValue,
  type ProtocolError,
  type ToolCall,
  type ToolDefinition,
  type ToolResult,
} from "@sharedos/contracts";
import type { SharedOSKernel } from "@sharedos/core";

export type AgentTurnInput =
  { readonly type: "start" } | { readonly type: "tool_result"; readonly result: ToolResult };

export type AgentTurnDecision =
  | { readonly type: "tool_call"; readonly call: ToolCall }
  | { readonly type: "complete"; readonly output: JsonValue; readonly metadata?: JsonObject }
  | { readonly type: "fail"; readonly error: ProtocolError };

export interface AgentVisibleContext {
  readonly actor: AccessContext["actor"];
  readonly owner: AccessContext["owner"];
  readonly namespaceId: string;
  readonly purpose: string;
  readonly traceId: string;
  readonly now: string;
}

/** The model-facing request deliberately excludes grants and issuing authority. */
export type AgentTurnRequest = Omit<ExecutionRequest, "context"> & {
  readonly context: AgentVisibleContext;
};

export interface AgentTurnSession {
  next(input: AgentTurnInput, signal: AbortSignal): Promise<AgentTurnDecision>;
  close?(outcome: ExecutionResult["status"], signal: AbortSignal): void | Promise<void>;
}

/** Model/provider-specific code implements this port; SharedOS owns the guarded loop around it. */
export interface AgentTurnDriver {
  open(request: AgentTurnRequest, signal: AbortSignal): Promise<AgentTurnSession>;
}

export interface TurnExecutorOptions {
  clock?: () => string;
  createId?: () => string;
  defaultMaxSteps?: number;
  defaultTimeoutMs?: number;
  closeTimeoutMs?: number;
}

export interface ExecuteTurnOptions {
  signal?: AbortSignal;
}

type TurnKernel = Pick<SharedOSKernel, "admitTurn" | "listTools" | "invokeTool">;

/**
 * Executes exactly one agent turn. Cadence, ticks, retries, experiments, and
 * production heartbeat policy remain responsibilities of the host.
 */
export class TurnExecutor {
  readonly #kernel: TurnKernel;
  readonly #driver: AgentTurnDriver;
  readonly #clock: () => string;
  readonly #createId: () => string;
  readonly #defaultMaxSteps: number;
  readonly #defaultTimeoutMs: number;
  readonly #closeTimeoutMs: number;

  constructor(kernel: TurnKernel, driver: AgentTurnDriver, options: TurnExecutorOptions = {}) {
    this.#kernel = kernel;
    this.#driver = driver;
    this.#clock = options.clock ?? (() => new Date().toISOString());
    this.#createId = options.createId ?? (() => crypto.randomUUID());
    this.#defaultMaxSteps = options.defaultMaxSteps ?? 16;
    this.#defaultTimeoutMs = options.defaultTimeoutMs ?? 120_000;
    this.#closeTimeoutMs = options.closeTimeoutMs ?? 1_000;

    if (!Number.isInteger(this.#defaultMaxSteps) || this.#defaultMaxSteps <= 0) {
      throw new TypeError("defaultMaxSteps must be a positive integer");
    }
    if (
      !Number.isInteger(this.#defaultTimeoutMs) ||
      this.#defaultTimeoutMs <= 0 ||
      this.#defaultTimeoutMs > MAX_EXECUTION_TIMEOUT_MS
    ) {
      throw new TypeError(`defaultTimeoutMs must be between 1 and ${MAX_EXECUTION_TIMEOUT_MS}`);
    }
    if (!Number.isInteger(this.#closeTimeoutMs) || this.#closeTimeoutMs <= 0) {
      throw new TypeError("closeTimeoutMs must be a positive integer");
    }
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
      events.push({
        version: "1",
        eventId: this.#createId(),
        executionId: request.executionId,
        traceId: request.context.traceId,
        sequence: events.length,
        type,
        data,
        occurredAt: this.#clock(),
      });
    };

    const contextError = validateTurnContext(request);
    if (contextError !== undefined) {
      emit("turn.denied", { code: contextError.code });
      return resultFor(request, events, startedAt, this.#clock(), "denied", contextError);
    }

    const abort = createTurnAbortController(
      options.signal,
      request.options?.timeoutMs ?? this.#defaultTimeoutMs,
    );
    let session: AgentTurnSession | undefined;
    let outcome: ExecutionResult["status"] = "failed";

    try {
      if (abort.signal.aborted) {
        outcome = "cancelled";
        return resultFor(
          request,
          events,
          startedAt,
          this.#clock(),
          "cancelled",
          protocolError("turn_cancelled", "The agent turn was cancelled.", true),
        );
      }

      const executionContext = contextAt(request.context, this.#clock());
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
        outcome = "denied";
        return resultFor(request, events, startedAt, this.#clock(), "denied", error);
      }

      const allowedTools = await raceWithAbort(
        this.#kernel.listTools(executionContext, { signal: abort.signal }),
        abort.signal,
      );
      const requestedNames = new Set(request.tools.map(({ name }) => name));
      const effectiveTools = allowedTools.filter(({ name }) => requestedNames.has(name));
      const effectiveToolNames = new Set(effectiveTools.map(({ name }) => name));
      const agentRequest = toAgentTurnRequest(request, executionContext, effectiveTools);

      emit("turn.started", {
        agent: request.agent,
        visibleTools: effectiveTools.map(({ name }) => name),
      });

      session = await raceWithAbort(this.#driver.open(agentRequest, abort.signal), abort.signal);
      let nextInput: AgentTurnInput = { type: "start" };
      const maxSteps = request.options?.maxSteps ?? this.#defaultMaxSteps;

      for (let step = 0; step < maxSteps; step += 1) {
        if (abort.signal.aborted) {
          outcome = "cancelled";
          emit("turn.cancelled", { step });
          return resultFor(
            request,
            events,
            startedAt,
            this.#clock(),
            "cancelled",
            protocolError("turn_cancelled", "The agent turn was cancelled.", true),
          );
        }

        const decisionCandidate: unknown = await raceWithAbort(
          session.next(nextInput, abort.signal),
          abort.signal,
        );
        const decision = parseAgentTurnDecision(decisionCandidate);
        if (decision === undefined) {
          const error = protocolError(
            "invalid_driver_decision",
            "The agent turn driver returned an invalid decision.",
          );
          emit("turn.failed", { code: error.code, step });
          outcome = "failed";
          return resultFor(request, events, startedAt, this.#clock(), "failed", error);
        }
        if (decision.type === "complete") {
          emit("turn.completed", { step });
          outcome = "succeeded";
          return {
            version: "1",
            executionId: request.executionId,
            traceId: request.context.traceId,
            status: "succeeded",
            output: decision.output,
            events,
            startedAt,
            completedAt: this.#clock(),
            ...(decision.metadata === undefined ? {} : { metadata: decision.metadata }),
          };
        }

        if (decision.type === "fail") {
          emit("turn.failed", { code: decision.error.code, step });
          outcome = "failed";
          return resultFor(request, events, startedAt, this.#clock(), "failed", decision.error);
        }

        emit("tool.requested", { callId: decision.call.id, tool: decision.call.tool, step });
        if (!effectiveToolNames.has(decision.call.tool)) {
          const result = unavailableToolResult(decision.call, this.#clock());
          emit("tool.completed", {
            callId: result.callId,
            status: result.status,
            tool: result.tool,
            step,
          });
          nextInput = { type: "tool_result", result };
          continue;
        }

        const result: ToolResult = await raceWithAbort(
          this.#kernel.invokeTool(contextAt(request.context, this.#clock()), decision.call, {
            signal: abort.signal,
          }),
          abort.signal,
        );
        emit("tool.completed", {
          callId: result.callId,
          status: result.status,
          tool: result.tool,
          step,
        });
        nextInput = { type: "tool_result", result };
      }

      const error = protocolError(
        "step_limit_exceeded",
        "The agent turn reached its maximum number of steps.",
      );
      emit("turn.failed", { code: error.code });
      outcome = "failed";
      return resultFor(request, events, startedAt, this.#clock(), "failed", error);
    } catch {
      if (abort.signal.aborted) {
        outcome = "cancelled";
        emit("turn.cancelled", {});
        return resultFor(
          request,
          events,
          startedAt,
          this.#clock(),
          "cancelled",
          protocolError("turn_cancelled", "The agent turn was cancelled.", true),
        );
      }

      outcome = "failed";
      emit("turn.failed", { code: "driver_failed" });
      return resultFor(
        request,
        events,
        startedAt,
        this.#clock(),
        "failed",
        protocolError("driver_failed", "The agent turn driver failed.", true),
      );
    } finally {
      abort.dispose();
      await closeSession(session, outcome, this.#closeTimeoutMs);
    }
  }
}

function toAgentTurnRequest(
  request: ExecutionRequest,
  context: AccessContext,
  tools: readonly ToolDefinition[],
): AgentTurnRequest {
  return {
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
    },
    ...(request.state === undefined ? {} : { state: request.state }),
    ...(request.options === undefined ? {} : { options: request.options }),
    ...(request.metadata === undefined ? {} : { metadata: request.metadata }),
  };
}

function contextAt(context: AccessContext, now: string): AccessContext {
  return { ...context, now };
}

function parseAgentTurnDecision(value: unknown): AgentTurnDecision | undefined {
  if (typeof value !== "object" || value === null || !("type" in value)) {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;
  if (candidate.type === "tool_call" && hasOnlyKeys(candidate, ["type", "call"])) {
    const call = ToolCallSchema.safeParse(candidate.call);
    return call.success ? { type: "tool_call", call: call.data } : undefined;
  }

  if (candidate.type === "fail" && hasOnlyKeys(candidate, ["type", "error"])) {
    const error = ProtocolErrorSchema.safeParse(candidate.error);
    return error.success ? { type: "fail", error: error.data } : undefined;
  }

  if (candidate.type === "complete" && hasOnlyKeys(candidate, ["type", "output", "metadata"])) {
    const output = JsonValueSchema.safeParse(candidate.output);
    const metadata =
      candidate.metadata === undefined
        ? { success: true as const, data: undefined }
        : JsonObjectSchema.safeParse(candidate.metadata);
    if (!output.success || !metadata.success) {
      return undefined;
    }

    return {
      type: "complete",
      output: output.data,
      ...(metadata.data === undefined ? {} : { metadata: metadata.data }),
    };
  }

  return undefined;
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const allowedKeys = new Set(allowed);
  return Object.keys(value).every((key) => allowedKeys.has(key));
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
): ExecutionResult {
  const base = {
    version: "1" as const,
    executionId: request.executionId,
    traceId: request.context.traceId,
    events: [...events],
    startedAt,
    completedAt,
  };

  return status === "cancelled" ? { ...base, status, error } : { ...base, status, error };
}

function protocolError(code: string, message: string, retryable = false): ProtocolError {
  return { code, message, retryable };
}

function unavailableToolResult(call: ToolCall, completedAt: string): ToolResult {
  return {
    callId: call.id,
    tool: call.tool,
    status: "denied",
    completedAt,
    error: protocolError(
      "tool_not_available",
      "The tool is not available in this permission-filtered turn.",
    ),
  };
}

async function closeSession(
  session: AgentTurnSession | undefined,
  outcome: ExecutionResult["status"],
  timeoutMs: number,
): Promise<void> {
  if (session?.close === undefined) {
    return;
  }

  const abort = createTurnAbortController(undefined, timeoutMs);
  try {
    await raceWithAbort(Promise.resolve(session.close(outcome, abort.signal)), abort.signal);
  } catch {
    // Closing a provider session must neither hang nor replace the protocol result.
  } finally {
    abort.dispose();
  }
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

function createTurnAbortController(
  parent: AbortSignal | undefined,
  timeoutMs: number | undefined,
): { signal: AbortSignal; dispose: () => void } {
  const controller = new AbortController();
  const abortFromParent = (): void => controller.abort(parent?.reason);
  parent?.addEventListener("abort", abortFromParent, { once: true });
  if (parent?.aborted) {
    abortFromParent();
  }

  const timeout =
    timeoutMs === undefined
      ? undefined
      : setTimeout(() => controller.abort(new Error("turn timeout")), timeoutMs);

  return {
    signal: controller.signal,
    dispose: () => {
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
      parent?.removeEventListener("abort", abortFromParent);
    },
  };
}

function raceWithAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(signal.reason ?? new Error("operation aborted"));
  }

  return new Promise<T>((resolve, reject) => {
    const abort = (): void => reject(signal.reason ?? new Error("operation aborted"));
    signal.addEventListener("abort", abort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
  });
}
