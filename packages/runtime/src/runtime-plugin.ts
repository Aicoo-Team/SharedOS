import {
  RuntimeManifestSchema,
  type AccessContext,
  type ExecutionRequest,
  type JsonValue,
  type ReachResult,
  type RuntimeEvent,
  type RuntimeManifest,
  type RuntimeTurnOutcome,
  type ToolCall,
  type ToolResult,
} from "@aicoo/sharedos-contracts";

import { reportContainedError } from "@aicoo/sharedos-core";

import { deepFreeze } from "@aicoo/sharedos-core/internal";

/** Which turn a {@link TurnErrorReporter} notification is about. */
export interface TurnErrorContext {
  readonly executionId: string;
  readonly traceId: string;
}

/**
 * A host's sink for a throw the turn contained rather than propagated.
 *
 * Both layers that contain one take it: `SharedOSExecutor`, whose catch ends
 * the turn `runtime_failed`, and `StandardRuntime`, whose catch ends it
 * `driver_failed`. A terminal code says a turn stopped and does not say why;
 * the thrown error is the only thing that does, so it is handed over whole and
 * unwrapped, because its stack is what names the origin.
 *
 * A record-only announcement the host refused reaches it too. `prompt.handed`
 * and `escalation.asked` are emitted for the record and decide nothing, so a
 * throw from `emit` there is contained where it happens and the turn goes on
 * -- the driver answers, the harness is served. The record is then short an
 * event, and the thrown error is the only thing that says so; see
 * {@link announceForRecord}. `StandardRuntime` and `createMcpHarnessRuntime`
 * both take the reporter for it.
 *
 * It reaches nothing else. A `ProtocolError.message` is read by the model, and
 * an `ExecutionEvent` becomes part of an `ExecutionRecord`, which travels
 * further than an audit sink; a thrown message may carry anything the thrower
 * had in scope. This is a host-side sink for host-side logs, in the position
 * `SharedOSKernel.onAuditError` occupies for the same reason.
 *
 * Observational. One that throws is ignored -- it cannot replace an outcome
 * already decided -- and a turn behaves identically with none installed.
 * Cancellation never reaches it: a turn stopped by the deadline or by the
 * caller's signal ends `cancelled`, which is a decision rather than a defect.
 *
 * The kernel makes the same promise about a provider's throw, under
 * `SharedOSKernelOptions.onProviderError`. A host wanting both installs both;
 * they are separate because they are about different things failing, and the
 * turn's identifiers are not the ones a mediated call has.
 */
export type TurnErrorReporter = (error: unknown, turn: TurnErrorContext) => void;

/**
 * Call one turn-error sink without letting it change what happened.
 *
 * The turn-shaped name for `reportContainedError`, which is where the guard
 * itself lives: a sink that throws is swallowed, because a diagnostic that can
 * turn one failure into two is a liability rather than a diagnostic.
 *
 * It delegates rather than repeating the rule. The kernel contains a provider's
 * throw and the runtime contains a plugin's, and the same promise is made to a
 * host about both; two implementations of one promise is how it stops being
 * true in one of them. Core owns it because the dependency runs runtime → core
 * and cannot run back.
 *
 * Exported deliberately, for a host writing its own {@link RuntimePlugin} that
 * offers the same hook.
 */
export function reportTurnError(
  reporter: TurnErrorReporter | undefined,
  error: unknown,
  turn: TurnErrorContext,
): void {
  reportContainedError(reporter, error, turn);
}

/** What a record-only announcement needs, to report a refused `emit`. */
export interface RecordAnnouncement {
  /** Which turn is announcing; what a refused `emit` is reported under. */
  readonly turn: TurnErrorContext;
  /** The turn's own signal: a host closed by cancellation is not a defect. */
  readonly signal: AbortSignal;
  /** Where a refused `emit` is reported. `undefined` reports it nowhere. */
  readonly onTurnError: TurnErrorReporter | undefined;
}

/**
 * Emit one event for the record, and only for the record.
 *
 * Some events say what happened without deciding anything: what the seat was
 * told, that a delegate asked for a human. A host whose `emit` refuses one --
 * closed, or holding the event to a stricter contract -- must not turn that
 * refusal into the turn's outcome, because the turn had not failed; it would
 * end as `driver_failed` before the driver decided anything, or answer a
 * harness with a transport fault for a call SharedOS accepted. So the throw is
 * contained here and the turn goes on.
 *
 * Contained is not lost. The record is now short an event, and a reader
 * holding only the record cannot tell that from a turn cancelled before the
 * announcement, which carries none either; so the throw goes to the host's
 * `onTurnError` sink, whole, under the turn's identifiers, and the host's log
 * is where the two cases part. It goes nowhere once the signal is aborted: a
 * host closed by cancellation refuses everything, and cancellation is a
 * decision the reporter never hears about.
 */
export function announceForRecord(
  host: Pick<RuntimeHost, "emit">,
  event: RuntimeEvent,
  announcement: RecordAnnouncement,
): void {
  try {
    host.emit(event);
  } catch (error) {
    if (announcement.signal.aborted) {
      return;
    }
    reportTurnError(announcement.onTurnError, error, announcement.turn);
  }
}

/**
 * The key a runtime states what it told the seat under: the content hash of the
 * instructions and prompt, stated through {@link RuntimeHost.annotate} before
 * the model or harness is sent anything.
 */
export const PROMPT_HASH_ANNOTATION = "promptHash";

export interface RuntimeVisibleContext {
  readonly actor: AccessContext["actor"];
  readonly owner: AccessContext["owner"];
  readonly namespaceId: string;
  readonly purpose: string;
  readonly traceId: string;
  readonly now: string;
  /**
   * Where this turn may operate, with the authority stripped out.
   *
   * The catalogue says which tools exist; this says which resources they are
   * worth pointing at. Without it a runtime can only guess paths and collect
   * denials, or the host reads raw grants to describe the boundary in a prompt
   * -- at exactly the seam designed to keep grants away from the model.
   *
   * `computed` is derived by `SharedOSKernel.reach` from the grants the turn's
   * decisions are made against, then narrowed to the namespaces this turn's
   * catalogue operates on. It carries no grant id, issuer, expiry, or budget,
   * and a bounded grant whose budget is spent does not appear. `unavailable`
   * means the reach could not be established, and `reasonCode` says why:
   * `usage_store_unavailable` when a bounded budget could not be read, or
   * `authority_unavailable` when the authority could not be loaded again
   * after admission. Either is handed over as such rather than as an empty
   * list that would read as "nothing", which is a true answer for some turns
   * and not for this one. The turn still runs: every call is decided on its
   * own, and a call that depends on what could not be read fails closed under
   * the same code.
   *
   * Descriptive, never permissive: every call is authorized independently, so
   * an entry here is not a permission and a stale one cannot open anything.
   */
  readonly reach: ReachResult;
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
  /**
   * Position within the runtime's own loop.
   *
   * Optional, and enforced when present: the execution envelope refuses a call
   * declaring a step at or past `RuntimeLimits.maxSteps`, and refuses a new
   * step once that many distinct ones have been seen. A plugin that omits it is
   * bounded by `maxToolCalls` alone.
   */
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
  /**
   * State one fact about the turn, for its record.
   *
   * `emit` is for something that happened at a moment, and lands among the
   * turn's events in order. This is for something that is true of the turn:
   * what the seat was told, that a delegate asked for a human. The envelope
   * holds the value and writes it into `ExecutionResult.metadata` under `key`
   * on every way out of the turn -- completed, failed, escalated, and the
   * ones that return no outcome at all: cancelled, a plugin that threw, an
   * outcome that did not parse. A plugin's own outcome metadata cannot do that,
   * because a turn stopped at its deadline never returns one.
   *
   * It throws a `TypeError` for a key that is empty, is `runtime`, which is the
   * envelope's own, or is `__proto__`, which no JSON object SharedOS reads
   * keeps; and for a value that is not JSON. All are plugin bugs.
   * It throws for nothing else, and in particular never for the state of the
   * host: a write made while the turn is aborted but still open is kept, and
   * one made after the turn has closed is dropped. So a call site needs no
   * guard, and stating a fact cannot become the turn's failure or a transport
   * fault in whatever was stating it.
   *
   * The last write to a key wins, and an annotation outranks the same key on
   * the outcome's own metadata. A value that does not exist yet cannot be
   * carried: a turn cancelled before its plugin had anything to state records
   * nothing, here or anywhere.
   *
   * Descriptive, never permissive. It is the plugin's own claim, read by
   * whoever reads the record; nothing SharedOS decides depends on it.
   */
  annotate(key: string, value: JsonValue): void;
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
