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
  type ReachResult,
  type RuntimeEvent,
  type RuntimeManifest,
  type RuntimeTurnOutcome,
  type ToolCall,
  type ToolDefinition,
  type ToolResult,
} from "@aicoo/sharedos-contracts";
import {
  SPAN,
  canonicalJson,
  measure,
  reachThroughTools,
  type SpanSink,
} from "@aicoo/sharedos-core";
import type { SharedOSKernel, TurnAuthorityScope } from "@aicoo/sharedos-core";

import { escalationOffered } from "./escalation.js";
import { createAbortController, deepFreeze, protocolError, raceWithAbort } from "./internal.js";
import {
  reportTurnError,
  type RuntimeHost,
  type RuntimeLimits,
  type RuntimePlugin,
  type RuntimeToolInvocationOptions,
  type RuntimeTurnRequest,
  type TurnErrorReporter,
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
  /**
   * Where the envelope reports what it cost, when a host is measuring.
   *
   * A second clock, and deliberately not the one `clock` supplies: that one
   * names instants for a record and a conformance run freezes it. See
   * {@link SpanSink}.
   */
  spans?: SpanSink;
  /**
   * Notification for a throw the turn body did not convert into an outcome.
   *
   * The envelope contains such a throw and ends the turn `failed` with
   * `runtime_failed`; the error itself comes here rather than being discarded.
   * See {@link TurnErrorReporter} for what it may and may not be used for.
   *
   * Not only the plugin's. The turn body also calls `openTurnAuthority`,
   * `admitTurn`, `reach`, and `listTools`, and a host port that throws arrives here too
   * under the same terminal code. That conflation is in the wire vocabulary and
   * is not fixed by this hook; the error's own stack is what separates them,
   * which is the reason for handing it over rather than classifying it here.
   */
  onTurnError?: TurnErrorReporter;
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
export type TurnKernel = Pick<SharedOSKernel, "admitTurn" | "reach" | "listTools" | "invokeTool"> &
  /**
   * Optional so a narrow test double stays viable. A kernel that does not offer
   * `openTurnAuthority` resolves authority per operation, which is the older and
   * stricter behaviour; one that does not offer `recordEscalation` still ends an
   * escalated turn as escalated, but without an audit trail for it.
   * `SharedOSKernel` offers both.
   */
  Partial<
    Pick<
      SharedOSKernel,
      "openTurnAuthority" | "recordEscalation" | "recordTurnEnd" | "recordRefusedCall"
    >
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
  readonly #spans: SpanSink | undefined;
  readonly #onTurnError: TurnErrorReporter | undefined;

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
    this.#spans = options.spans;
    this.#onTurnError = options.onTurnError;

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
    return measure(
      this.#spans,
      SPAN.TURN,
      () => this.#execute(input, options),
      (result, span) => {
        span.set("executionId", result.executionId);
        span.set("status", result.status);
      },
    );
  }

  async #execute(
    input: ExecutionRequest,
    options: ExecuteTurnOptions = {},
  ): Promise<ExecutionResult> {
    const parsed = ExecutionRequestSchema.safeParse(input);
    if (!parsed.success) {
      throw new TypeError("ExecutionRequest does not match the SharedOS v1 contract");
    }

    const request = parsed.data;
    const result = await this.#runTurn(request, options);
    await this.#recordTurnEnd(request, result);
    return result;
  }

  /**
   * Write how the turn ended into the trail the kernel owns.
   *
   * One site rather than one per terminal return, and derived from the result
   * instead of from each branch, so an ending added later cannot be the one
   * nobody remembered to record. The abort signal is deliberately not passed on:
   * a cancelled turn is the case that most needs recording, and handing the
   * recorder the signal that cancelled it would drop exactly that event.
   *
   * A failure here is swallowed. A dropped audit write matters -- that is what
   * `SharedOSKernelOptions.onAuditError` is for, and the kernel calls it -- but
   * it must not turn a turn that completed into one that threw.
   */
  async #recordTurnEnd(request: ExecutionRequest, result: ExecutionResult): Promise<void> {
    if (this.#kernel.recordTurnEnd === undefined) {
      return;
    }
    const reasonCode = terminalReasonCode(result);
    const endedBy = terminalSource(result.events);
    try {
      await this.#kernel.recordTurnEnd(contextAt(request.context, result.completedAt), {
        executionId: result.executionId,
        status: result.status,
        ...(reasonCode === undefined ? {} : { reasonCode }),
        ...(endedBy === undefined ? {} : { endedBy }),
      });
    } catch {
      // Deliberately empty; see the docblock above.
    }
  }

  /**
   * Write a call this boundary refused into the trail the kernel owns.
   *
   * Nothing reached the kernel, so nothing was audited -- a guessed tool name, a
   * spent step budget, a spent call budget were visible only in the execution
   * event stream, which no production consumer reads. Swallowed on failure for
   * the reason {@link SharedOSExecutor.execute} records terminals: an
   * observation must not change the outcome it observed (ADR 0023).
   */
  async #recordRefusedCall(
    context: AccessContext,
    result: ToolResult,
    cause?: string,
  ): Promise<void> {
    if (this.#kernel.recordRefusedCall === undefined || result.status === "succeeded") {
      return;
    }
    try {
      await this.#kernel.recordRefusedCall(contextAt(context, result.completedAt), {
        callId: result.callId,
        tool: result.tool,
        reasonCode: result.error.code,
        ...(cause === undefined ? {} : { cause }),
      });
    } catch {
      // Deliberately empty; see the docblock above.
    }
  }

  async #runTurn(
    request: ExecutionRequest,
    options: ExecuteTurnOptions = {},
  ): Promise<ExecutionResult> {
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
    const steps = new Set<number>();
    let authority: TurnAuthorityScope | undefined;
    let opening: Promise<TurnAuthorityScope> | undefined;

    try {
      if (abort.signal.aborted) {
        return cancelledResult(request, events, startedAt, this.#clock(), metadata);
      }

      const executionContext = structuredClone(contextAt(request.context, this.#clock()));

      // The turn boundary. Authority is resolved once here and held for every
      // decision the turn goes on to make, so a grant removed from the store
      // while this turn runs is observed by the next turn rather than part-way
      // through this one. The promise is kept as well as the handle, because a
      // turn cancelled while this is still in flight never receives the handle
      // and would leave the lease answering for a turn that has ended.
      opening = this.#kernel.openTurnAuthority?.(executionContext, { signal: abort.signal });
      authority = await raceWithAbort(opening ?? Promise.resolve(undefined), abort.signal);

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

      // Where the turn may operate, read from the same authority every decision
      // in it is made against. Handed to the runtime as answered: a reach that
      // could not be established says so, rather than becoming an empty list
      // that would read as "nothing" -- a true answer for a turn that reaches
      // nothing, and a false one here. The turn runs either way; a call that
      // depends on the unreadable budget fails closed on its own (ADR 0021).
      const reach = await raceWithAbort(
        this.#kernel.reach(executionContext, { signal: abort.signal }),
        abort.signal,
      );

      const allowedTools = await raceWithAbort(
        this.#kernel.listTools(executionContext, { signal: abort.signal }),
        abort.signal,
      );
      const requestedNames = new Set(request.tools.map(({ name }) => name));
      const effectiveTools = allowedTools.filter(({ name }) => requestedNames.has(name));
      const effectiveToolNames = new Set(effectiveTools.map(({ name }) => name));
      // Narrowed to what this turn's catalogue operates on: a runtime acts only
      // through the tools it was handed, so reach it cannot exercise is not
      // somewhere it can work.
      const runtimeRequest = toRuntimeTurnRequest(
        request,
        executionContext,
        effectiveTools,
        reach.status === "computed"
          ? { status: "computed", reach: [...reachThroughTools(reach.reach, effectiveTools)] }
          : reach,
      );

      emit("turn.started", {
        agent: request.agent,
        visibleTools: effectiveTools.map(({ name }) => name),
        runtime: runtimeProvenance(this.#manifest),
      });

      // The envelope's whole share of one mediated call: budget checks, the
      // effective-catalogue check, the kernel round trip, and the two events
      // the call leaves behind. Named separately from the kernel's own span
      // because they are different costs with different owners, and the
      // difference between them is what the envelope charges for existing.
      const mediateTool = async (
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

        if (step !== undefined && !stepIsWithinBudget(step, steps, limits.maxSteps)) {
          const result = deniedToolResult(
            parsedCall.data,
            this.#clock(),
            "step_limit_exceeded",
            "The runtime reached its maximum number of steps.",
          );
          emit("tool.completed", completedToolEventData(result, step));
          await this.#recordRefusedCall(executionContext, result);
          return result;
        }
        if (step !== undefined) {
          steps.add(step);
        }

        if (toolCallCount >= limits.maxToolCalls) {
          const result = deniedToolResult(
            parsedCall.data,
            this.#clock(),
            "tool_call_limit_exceeded",
            "The runtime reached its maximum number of tool calls.",
          );
          emit("tool.completed", completedToolEventData(result, step));
          await this.#recordRefusedCall(executionContext, result);
          return result;
        }
        toolCallCount += 1;

        if (!effectiveToolNames.has(parsedCall.data.tool)) {
          const result = unavailableToolResult(parsedCall.data, this.#clock());
          emit("tool.completed", completedToolEventData(result, step));
          // The clearest attempted violation the system produces, and until now
          // it reached no audit sink at all: the kernel never saw the call.
          await this.#recordRefusedCall(executionContext, result, "not_offered");
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
      };

      const host: RuntimeHost = Object.freeze({
        limits,
        invokeTool: (
          call: ToolCall,
          invocationOptions: RuntimeToolInvocationOptions = {},
        ): Promise<ToolResult> =>
          measure(
            this.#spans,
            SPAN.TOOL_MEDIATE,
            () => mediateTool(call, invocationOptions),
            (result, span) => {
              span.set("callId", result.callId);
              span.set("tool", result.tool);
              span.set("outcome", result.status);
            },
          ),
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
        emit("turn.failed", { code: error.code, source: "envelope" });
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

      if (outcome.data.type === "escalate") {
        // The ask is gated by the catalogue, and the envelope holds that gate
        // from outside the plugin. The standard loop's drivers and the MCP
        // latch each read their turn's catalogue before ending a turn on the
        // name, but a replacement plugin is a replacement for exactly that
        // check, and a limit only the reference implementations honour is not
        // a limit. So it is repeated here, against the catalogue this turn was
        // actually served: a plugin escalating on a turn that holds no grant
        // over the affordance is refused as any call outside the catalogue is,
        // under the same code from the same boundary, and the turn fails --
        // a runtime returning an outcome it was not allowed to return is a
        // runtime misbehaving, as with `invalid_runtime_outcome`. Nothing
        // reached the kernel, so nothing is audited; the event stream is where
        // an envelope refusal lives.
        if (!escalationOffered(effectiveTools)) {
          const error = protocolError(
            "tool_unavailable",
            "The runtime ended the turn by escalation, but this turn's catalogue does not offer the affordance.",
          );
          // `source` says who ended the turn. A record reader -- the conformance
          // judge is one -- can then credit the envelope with a refusal it made,
          // and credit nothing for a failure the runtime reported as its own.
          emit("turn.failed", { code: error.code, source: "envelope" });
          return resultFor(
            request,
            events,
            startedAt,
            this.#clock(),
            "failed",
            error,
            runtimeResultMetadata(this.#manifest, outcome.data),
          );
        }

        // The escalation is recorded through the kernel, which owns audit, and
        // then the turn ends. Nothing here waits for a reviewer: resolving an
        // escalation means issuing a grant to the trusted store, which the next
        // turn loads. A kernel that offers no escalation port still terminates
        // the turn as escalated -- the outcome is the runtime's to declare, and
        // dropping it because audit is unavailable would lose the one fact this
        // path exists to record.
        const escalation = (await raceWithAbort(
          this.#kernel.recordEscalation?.(
            contextAt(executionContext, this.#clock()),
            outcome.data.reason,
            { signal: abort.signal },
          ) ?? Promise.resolve(undefined),
          abort.signal,
        )) ?? {
          reason: outcome.data.reason,
          reviewer: request.context.owner,
          requestedAt: this.#clock(),
          status: "pending" as const,
        };
        emit("turn.escalated", { reason: escalation.reason, reviewer: escalation.reviewer });
        return {
          version: "1",
          executionId: request.executionId,
          traceId: request.context.traceId,
          status: "escalated",
          escalation,
          events,
          startedAt,
          completedAt: this.#clock(),
          metadata: runtimeResultMetadata(this.#manifest, outcome.data),
        };
      }

      emit("turn.failed", { code: outcome.data.error.code, source: "runtime" });
      return resultFor(
        request,
        events,
        startedAt,
        this.#clock(),
        "failed",
        outcome.data.error,
        runtimeResultMetadata(this.#manifest, outcome.data),
      );
    } catch (thrown) {
      if (abort.signal.aborted) {
        emit("turn.cancelled", {});
        return cancelledResult(request, events, startedAt, this.#clock(), metadata);
      }

      const error = protocolError("runtime_failed", "The runtime plugin failed.", true);
      emit("turn.failed", { code: error.code, source: "envelope" });
      // Reported here rather than from the `finally`, which also runs for a
      // turn that ended normally and would have to work out whether there was
      // anything to report. This is the one path that has an error in hand.
      reportTurnError(this.#onTurnError, thrown, {
        executionId: request.executionId,
        traceId: request.context.traceId,
      });
      return resultFor(request, events, startedAt, this.#clock(), "failed", error, metadata);
    } finally {
      runtimeHostActive = false;
      // Released on every path out, including cancellation: an unclosed lease
      // would keep answering for a turn that has already ended. Closing is
      // idempotent, so covering both the handle and the promise it came from is
      // safe and covers the abandoned-while-opening case too.
      authority?.close();
      void opening?.then(
        (scope) => scope.close(),
        () => undefined,
      );
      abort.abort(new Error("turn closed"));
      abort.dispose();
    }
  }
}

/**
 * Compatibility facade for the original driver-based API. New harnesses should
 * implement RuntimePlugin and use SharedOSExecutor directly.
 *
 * Retained pending a deprecation decision; see `docs/open-items.md`.
 */
export class TurnExecutor implements TurnExecutionPort {
  readonly #executor: SharedOSExecutor;

  constructor(kernel: TurnKernel, driver: AgentTurnDriver, options: TurnExecutorOptions = {}) {
    const runtimeOptions: StandardRuntimeOptions = {
      ...(options.closeTimeoutMs === undefined ? {} : { closeTimeoutMs: options.closeTimeoutMs }),
      // To both, because either can contain a throw and only one of them ever
      // does per turn: the loop catches its driver's, the envelope catches
      // everything else. A host installs one sink and hears about both.
      ...(options.onTurnError === undefined ? {} : { onTurnError: options.onTurnError }),
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
      ...(options.spans === undefined ? {} : { spans: options.spans }),
      ...(options.onTurnError === undefined ? {} : { onTurnError: options.onTurnError }),
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
  reach: ReachResult,
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
        reach,
      },
      ...(request.state === undefined ? {} : { state: request.state }),
      ...(request.options === undefined ? {} : { options: request.options }),
      ...(request.metadata === undefined ? {} : { metadata: request.metadata }),
    }),
  );
}

/**
 * Whether one declared step is inside the turn's step budget.
 *
 * `StandardRuntime` bounds its own loop, but a replacement plugin is a
 * replacement for exactly that loop, so a limit only the reference
 * implementation honours is not a limit. The envelope holds the ceiling from
 * outside: a step at or past `maxSteps` is refused, and so is a new step once
 * `maxSteps` distinct ones have been seen -- which is what stops a plugin from
 * renumbering its way around the first rule.
 *
 * A plugin that declares no step at all is not step-bounded, because the
 * envelope sees tool calls and cannot infer model turns from them. That plugin
 * is still bounded by `maxToolCalls`, which needs nothing from the runtime.
 */
function stepIsWithinBudget(step: number, seen: ReadonlySet<number>, maxSteps: number): boolean {
  return step < maxSteps && (seen.has(step) || seen.size < maxSteps);
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

/**
 * What a completed call contributes to the durable event stream.
 *
 * The refusal code is included because a call the envelope terminated never
 * reaches the kernel and so never reaches audit: the event stream is the only
 * place it is recorded at all. Without the code, an execution record could say
 * that an envelope refusal happened but not whether it was a guess at an
 * unexposed tool or a blown call budget, and the distinction had to be taken on
 * trust from whatever the runtime chose to report about itself.
 *
 * Arguments, results, and payloads stay out, exactly as they do in audit.
 */
function completedToolEventData(result: ToolResult, step: number | undefined): JsonObject {
  return {
    callId: result.callId,
    status: result.status,
    tool: result.tool,
    ...(step === undefined ? {} : { step }),
    ...(result.status === "succeeded" ? {} : { code: result.error.code }),
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
  if (canonicalJson(request.context.actor) !== canonicalJson(request.agent)) {
    return protocolError("actor_mismatch", "Access actor does not match the executing agent.");
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

  return { ...base, status, error };
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

/**
 * The envelope's refusal for a tool outside the permission-filtered catalogue.
 *
 * It carries `tool_unavailable`, the same code `SharedOSKernel` uses when the
 * tool is absent, sealed, or undiscoverable. The two boundaries refuse the same
 * attempt for the same reason, and emitting two codes for it made the
 * conformance matrix's declared signal depend on which boundary happened to get
 * there first. The boundary that refused is still distinguishable: it is
 * `OperationRecord.source`, which is where that distinction belongs.
 */
function unavailableToolResult(call: ToolCall, completedAt: string): ToolResult {
  return deniedToolResult(
    call,
    completedAt,
    "tool_unavailable",
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

/**
 * The code a terminal ending carried, where it had one.
 *
 * A cancelled turn may carry none -- the deadline path builds a result without
 * an error -- so it is named here rather than left absent, because "the turn
 * stopped" and "the turn stopped because it ran out of time" are different
 * facts and only the second is useful in a trail.
 */
function terminalReasonCode(result: ExecutionResult): string | undefined {
  switch (result.status) {
    case "denied":
    case "failed":
      return result.error.code;
    case "cancelled":
      return result.error?.code ?? "turn_cancelled";
    default:
      return undefined;
  }
}

/**
 * Whether the envelope refused the turn or the runtime reported its own failure.
 *
 * Read back from the event the envelope already emits rather than threaded
 * through every return, and it is the distinction a record reader needs before
 * crediting enforcement: a plugin that reports its own error is not the envelope
 * stopping it.
 */
function terminalSource(events: readonly ExecutionEvent[]): "envelope" | "runtime" | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event?.type !== "turn.failed" || typeof event.data !== "object" || event.data === null) {
      continue;
    }
    const source = (event.data as Record<string, unknown>)["source"];
    return source === "runtime" || source === "envelope" ? source : undefined;
  }
  return undefined;
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
