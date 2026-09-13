import {
  ToolCallSchema,
  ToolResultSchema,
  ToolResultIngestionAckSchema,
  type ExecutionResult,
  type ExecutionSettlement,
  type OperationSettlement,
  type ToolCall,
  type ToolResult,
  type ToolResultIngestionAck,
  type ToolResultIngestionEnvelope,
} from "@aicoo/sharedos-contracts";
import { canonicalJson, sha256Hex } from "@aicoo/sharedos-core";
import { deepFreeze, raceWithAbort } from "./internal.js";
import type { AgentTurnDecision } from "./standard-runtime.js";

/** Opt-in separation of generation, durable result ingestion, and history publication. */
export interface AgentTurnSettlementSession {
  readonly version: "1";
  nextDecision(signal: AbortSignal): Promise<AgentTurnDecision>;
  ingestToolResult(
    envelope: ToolResultIngestionEnvelope,
    signal: AbortSignal,
  ): Promise<ToolResultIngestionAck>;
  finish(outcome: ExecutionResult["status"], signal: AbortSignal): Promise<void>;
  close(signal: AbortSignal): Promise<void>;
}

export interface RuntimeSettlementHost {
  readonly version: "1";
  readonly signal: AbortSignal;
  register(session: AgentTurnSettlementSession): void;
  trackWork<T>(promise: Promise<T>, label?: string): Promise<T>;
}

export interface SettlementToolObservation {
  readonly version: "1";
  readonly result: Promise<ToolResult>;
  readonly audit: Promise<"recorded" | "failed" | "unknown">;
  readonly completion: Promise<ToolResult>;
}

/** One aggregate, finite settlement budget. It never authorizes new work. */
export class TurnSettlement {
  readonly host: RuntimeSettlementHost;
  readonly #executionId: string;
  readonly #traceId: string;
  readonly #timeoutMs: number;
  readonly #abort = new AbortController();
  readonly #operations = new Map<string, OperationSettlement>();
  readonly #pending = new Map<Promise<unknown>, string>();
  #session: AgentTurnSettlementSession | undefined;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #started = false;
  #closed = false;
  #sequence = 0;
  #completionFailed = false;
  #settling: Promise<ExecutionSettlement> | undefined;
  #finish: ExecutionSettlement["history"]["finish"] = "unsupported";
  #cleanup: ExecutionSettlement["history"]["cleanup"] = "unsupported";

  constructor(executionId: string, traceId: string, timeoutMs: number) {
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) {
      throw new TypeError("settlement timeoutMs must be an integer between 1 and 60000");
    }
    this.#executionId = executionId;
    this.#traceId = traceId;
    this.#timeoutMs = timeoutMs;
    this.host = Object.freeze({
      version: "1" as const,
      signal: this.signal,
      register: (session: AgentTurnSettlementSession) => this.#register(session),
      trackWork: <T>(promise: Promise<T>, label?: string) => this.trackWork(promise, label),
    });
  }

  get signal(): AbortSignal {
    return this.#abort.signal;
  }

  start(): void {
    if (this.#started || this.#closed) return;
    this.#started = true;
    this.#timer = setTimeout(
      () => this.#abort.abort(new Error("Settlement deadline exceeded")),
      this.#timeoutMs,
    );
  }

  #register(session: AgentTurnSettlementSession): void {
    if (this.#session || this.#started || this.#closed)
      throw new Error("Settlement registration is closed");
    if (
      session?.version !== "1" ||
      [session.nextDecision, session.ingestToolResult, session.finish, session.close].some(
        (method) => typeof method !== "function",
      )
    ) {
      throw new TypeError("Runtime settlement version 1 is unsupported");
    }
    this.#session = {
      version: "1",
      nextDecision: session.nextDecision.bind(session),
      ingestToolResult: session.ingestToolResult.bind(session),
      finish: session.finish.bind(session),
      close: session.close.bind(session),
    };
    this.#finish = "pending";
    this.#cleanup = "pending";
  }

  trackWork<T>(promise: Promise<T>, label?: string): Promise<T> {
    const observed = Promise.resolve(promise);
    const id = typeof label === "string" && label.length > 0 ? label : `work-${++this.#sequence}`;
    if (!this.#closed && !this.signal.aborted) this.#pending.set(observed, id);
    void observed.then(
      () => {
        this.#pending.delete(observed);
      },
      () => {
        this.#pending.delete(observed);
      },
    );
    return observed;
  }

  async trackTool(call: ToolCall, factory: () => SettlementToolObservation): Promise<ToolResult> {
    const parsed = ToolCallSchema.parse(call);
    if (parsed.traceId !== this.#traceId) throw new Error("Tool call trace identity mismatch");
    if (this.#started || this.#closed || !this.#session)
      throw new Error("Runtime settlement is unavailable for new calls");
    if (this.#operations.has(parsed.id)) throw new Error("Duplicate settlement call identity");
    const entry: OperationSettlement = {
      callId: parsed.id,
      tool: parsed.tool,
      result: "pending",
      ingestion: "pending",
      audit: "pending",
    };
    this.#operations.set(parsed.id, entry);
    const update = (patch: Partial<OperationSettlement>) => {
      if (!this.#closed && !this.signal.aborted) Object.assign(entry, patch);
    };
    let observation: SettlementToolObservation;
    try {
      observation = factory();
    } catch (error) {
      update({ result: "failed", ingestion: "failed", audit: "unknown" });
      throw error;
    }
    if (observation?.version !== "1") {
      this.trackWork(
        Promise.allSettled([observation?.result, observation?.audit, observation?.completion]),
        `unsupported-observation:${parsed.id}`,
      );
      update({ result: "failed", ingestion: "failed", audit: "unknown" });
      throw new TypeError("Tool observation version is unsupported");
    }
    // Completion is observed independently; result-ready never waits for audit.
    this.trackWork(
      Promise.resolve(observation.completion).catch(() => {
        if (!this.#closed && !this.signal.aborted) this.#completionFailed = true;
      }),
      `completion:${parsed.id}`,
    );
    this.trackWork(
      Promise.resolve(observation.audit).then(
        (audit) => {
          update({ audit: ["recorded", "failed", "unknown"].includes(audit) ? audit : "unknown" });
        },
        () => {
          update({ audit: "failed" });
        },
      ),
      `audit:${parsed.id}`,
    );
    const ingestion = Promise.resolve(observation.result).then(
      async (candidate) => {
        let result: ToolResult;
        try {
          result = deepFreeze(ToolResultSchema.parse(candidate));
          if (result.callId !== parsed.id || result.tool !== parsed.tool)
            throw new Error("Tool result identity mismatch");
        } catch (error) {
          update({ result: "failed", ingestion: "failed" });
          throw error;
        }
        const resultDigest = await sha256Hex(canonicalJson(result));
        update({ result: "ready", resultDigest });
        if (this.signal.aborted || this.#closed) throw new Error("Settlement deadline exceeded");
        const envelope = deepFreeze({
          version: "1" as const,
          executionId: this.#executionId,
          traceId: this.#traceId,
          callId: parsed.id,
          tool: parsed.tool,
          resultDigest,
          result,
        });
        try {
          const ack = ToolResultIngestionAckSchema.parse(
            await this.#session!.ingestToolResult(envelope, this.signal),
          );
          const { result: _result, ...expected } = envelope;
          if (canonicalJson(ack) !== canonicalJson(expected))
            throw new Error("Tool result ingestion ACK mismatch");
          if (this.signal.aborted || this.#closed) throw new Error("Settlement deadline exceeded");
          update({ ingestion: "acknowledged" });
          return result;
        } catch (error) {
          update({ ingestion: "failed" });
          throw error;
        }
      },
      (error: unknown) => {
        update({ result: "failed", ingestion: "failed" });
        throw error;
      },
    );
    this.trackWork(ingestion, `ingestion:${parsed.id}`);
    return raceWithAbort(ingestion, this.signal);
  }

  settle(outcome: ExecutionResult["status"]): Promise<ExecutionSettlement> {
    this.#settling ??= this.#settle(outcome);
    return this.#settling;
  }

  async #settle(outcome: ExecutionResult["status"]): Promise<ExecutionSettlement> {
    this.start();
    try {
      await raceWithAbort(this.#drain(), this.signal);
      if (this.#session && this.#allOperationsComplete()) {
        try {
          await this.#bounded(
            Promise.resolve().then(() => this.#session!.finish(outcome, this.signal)),
          );
          if (!this.signal.aborted) this.#finish = "completed";
        } catch {
          if (!this.signal.aborted) this.#finish = "failed";
        }
      }
    } catch {
      /* Preserve known states when the aggregate budget expires. */
    }
    if (this.#session) {
      try {
        await this.#bounded(Promise.resolve().then(() => this.#session!.close(this.signal)));
        if (!this.signal.aborted) this.#cleanup = "completed";
      } catch {
        if (!this.signal.aborted) this.#cleanup = "failed";
      }
    }
    this.#closed = true;
    const operations = [...this.#operations.values()].map((entry) => ({ ...entry }));
    const status =
      !this.#session && this.#pending.size === 0
        ? "unsupported"
        : this.#allOperationsComplete() &&
            this.#pending.size === 0 &&
            this.#finish === "completed" &&
            this.#cleanup === "completed"
          ? "settled"
          : "incomplete";
    const report: ExecutionSettlement = {
      version: "1",
      status,
      operations,
      history: { finish: this.#finish, cleanup: this.#cleanup },
      pendingOperationIds: operations
        .filter(
          (entry) =>
            entry.result === "pending" ||
            entry.ingestion === "pending" ||
            entry.audit === "pending",
        )
        .map((entry) => entry.callId),
      pendingWorkIds: [...this.#pending.values()],
    };
    this.dispose();
    return deepFreeze(report);
  }

  async #drain(): Promise<void> {
    while (this.#pending.size > 0 && !this.signal.aborted) {
      await Promise.allSettled([...this.#pending.keys()]);
    }
  }

  #allOperationsComplete(): boolean {
    return (
      !this.#completionFailed &&
      [...this.#operations.values()].every(
        (entry) =>
          entry.result === "ready" &&
          entry.ingestion === "acknowledged" &&
          entry.audit === "recorded",
      )
    );
  }

  #bounded<T>(promise: Promise<T>): Promise<T> {
    // The signal may already be aborted, in which case raceWithAbort does not subscribe.
    void promise.catch(() => {});
    return raceWithAbort(promise, this.signal);
  }

  dispose(): void {
    if (this.#timer !== undefined) clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#abort.abort(new Error("Settlement closed"));
  }
}
