import {
  JsonObjectSchema,
  JsonValueSchema,
  ProtocolErrorSchema,
  ToolCallSchema,
  type ExecutionResult,
  type JsonObject,
  type JsonValue,
  type ProtocolError,
  type RuntimeManifest,
  type RuntimeTurnOutcome,
  type ToolCall,
  type ToolResult,
} from "@aicoo/sharedos-contracts";

import { createAbortController, deepFreeze, protocolError, raceWithAbort } from "./internal.js";
import { escalationReason } from "./escalation.js";
import type {
  RuntimeHost,
  RuntimePlugin,
  RuntimeTurnRequest,
  RuntimeVisibleContext,
} from "./runtime-plugin.js";

export type AgentTurnInput =
  { readonly type: "start" } | { readonly type: "tool_result"; readonly result: ToolResult };

export type AgentTurnDecision =
  | { readonly type: "tool_call"; readonly call: ToolCall }
  | { readonly type: "complete"; readonly output: JsonValue; readonly metadata?: JsonObject }
  /**
   * `metadata` rides on a failure exactly as it does on a completion. A turn
   * that failed still ran: the model that answered, what it cost, and why it
   * stopped are facts about the turn rather than about its ending, and a record
   * that dropped them on failure would know least about the turns that most
   * need explaining.
   */
  | { readonly type: "fail"; readonly error: ProtocolError; readonly metadata?: JsonObject }
  /**
   * End the turn by asking a human to decide.
   *
   * `RuntimeTurnOutcome` has carried an escalate variant from the start, but
   * nothing running inside this loop could produce one: a driver could complete
   * or fail and that was all. Escalation was therefore reachable only by a
   * plugin that replaced the loop entirely, which is why every driven column
   * reported the escalation row as structurally unavailable -- a limit of this
   * type, not of any vendor.
   *
   * The reason is the driver's own words and is recorded verbatim. Nothing here
   * advances the escalation: SharedOS records that a decision was asked for and
   * grants nothing while it is pending.
   */
  | { readonly type: "escalate"; readonly reason: string; readonly metadata?: JsonObject };

/** Backwards-compatible name for the context visible to a standard driver. */
export type AgentVisibleContext = RuntimeVisibleContext;

/** Backwards-compatible name for the request visible to a standard driver. */
export type AgentTurnRequest = RuntimeTurnRequest;

export interface AgentTurnSession {
  next(input: AgentTurnInput, signal: AbortSignal): Promise<AgentTurnDecision>;
  close?(outcome: ExecutionResult["status"], signal: AbortSignal): void | Promise<void>;
}

/** Model/provider-specific code implements this port inside the standard runtime. */
export interface AgentTurnDriver {
  open(request: AgentTurnRequest, signal: AbortSignal): Promise<AgentTurnSession>;
}

export interface StandardRuntimeOptions {
  closeTimeoutMs?: number;
}

/** Kept equal to the synchronized package version by the release gate. */
export const STANDARD_RUNTIME_VERSION = "0.1.0-alpha.3";

export const STANDARD_RUNTIME_MANIFEST: RuntimeManifest = deepFreeze({
  id: "sharedos.standard",
  version: STANDARD_RUNTIME_VERSION,
  protocolVersion: "1",
  metadata: {
    package: "@aicoo/sharedos-runtime",
    executionModel: "bounded-driver-loop",
  },
});

/** The reference SharedOS loop. Hosts may replace it with another RuntimePlugin. */
export class StandardRuntime implements RuntimePlugin {
  readonly manifest = STANDARD_RUNTIME_MANIFEST;
  readonly #driver: AgentTurnDriver;
  readonly #closeTimeoutMs: number;

  constructor(driver: AgentTurnDriver, options: StandardRuntimeOptions = {}) {
    this.#driver = driver;
    this.#closeTimeoutMs = options.closeTimeoutMs ?? 1_000;
    if (!Number.isInteger(this.#closeTimeoutMs) || this.#closeTimeoutMs <= 0) {
      throw new TypeError("closeTimeoutMs must be a positive integer");
    }
  }

  async run(
    request: RuntimeTurnRequest,
    host: RuntimeHost,
    signal: AbortSignal,
  ): Promise<RuntimeTurnOutcome> {
    let session: AgentTurnSession | undefined;
    let closeOutcome: ExecutionResult["status"] = "failed";

    try {
      session = await raceWithAbort(this.#driver.open(request, signal), signal);
      let nextInput: AgentTurnInput = { type: "start" };

      for (let step = 0; step < host.limits.maxSteps; step += 1) {
        const decisionCandidate: unknown = await raceWithAbort(
          session.next(nextInput, signal),
          signal,
        );
        const decision = parseAgentTurnDecision(decisionCandidate);
        if (decision === undefined) {
          closeOutcome = "failed";
          return {
            type: "fail",
            error: protocolError(
              "invalid_driver_decision",
              "The agent turn driver returned an invalid decision.",
            ),
          };
        }

        if (decision.type === "complete") {
          closeOutcome = "succeeded";
          return decision;
        }
        if (decision.type === "fail") {
          closeOutcome = "failed";
          return decision;
        }
        if (decision.type === "escalate") {
          // Passed straight through, as `complete` and `fail` are. An escalated
          // turn is a terminal outcome the envelope records and audits; it is
          // not a failure, and reporting it as one would lose the distinction
          // between a turn that broke and a turn that asked.
          closeOutcome = "escalated";
          return decision;
        }

        const result = await host.invokeTool(decision.call, { step });
        nextInput = { type: "tool_result", result };
      }

      closeOutcome = "failed";
      return {
        type: "fail",
        error: protocolError(
          "step_limit_exceeded",
          "The agent turn reached its maximum number of steps.",
        ),
      };
    } catch (error) {
      if (signal.aborted) {
        closeOutcome = "cancelled";
        throw error;
      }
      closeOutcome = "failed";
      return {
        type: "fail",
        error: protocolError("driver_failed", "The agent turn driver failed.", true),
      };
    } finally {
      await closeSession(session, closeOutcome, this.#closeTimeoutMs);
    }
  }
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

  if (candidate.type === "fail" && hasOnlyKeys(candidate, ["type", "error", "metadata"])) {
    const error = ProtocolErrorSchema.safeParse(candidate.error);
    const metadata =
      candidate.metadata === undefined
        ? { success: true as const, data: undefined }
        : JsonObjectSchema.safeParse(candidate.metadata);
    if (!error.success || !metadata.success) {
      return undefined;
    }
    return {
      type: "fail",
      error: error.data,
      ...(metadata.data === undefined ? {} : { metadata: metadata.data }),
    };
  }

  if (candidate.type === "escalate" && hasOnlyKeys(candidate, ["type", "reason", "metadata"])) {
    const reason = escalationReason(candidate.reason);
    const metadata =
      candidate.metadata === undefined
        ? { success: true as const, data: undefined }
        : JsonObjectSchema.safeParse(candidate.metadata);
    if (reason === undefined || !metadata.success) {
      return undefined;
    }
    return {
      type: "escalate",
      reason,
      ...(metadata.data === undefined ? {} : { metadata: metadata.data }),
    };
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

async function closeSession(
  session: AgentTurnSession | undefined,
  outcome: ExecutionResult["status"],
  timeoutMs: number,
): Promise<void> {
  if (session?.close === undefined) {
    return;
  }

  const abort = createAbortController(undefined, timeoutMs);
  try {
    await raceWithAbort(Promise.resolve(session.close(outcome, abort.signal)), abort.signal);
  } catch {
    // Closing a provider session must neither hang nor replace the protocol result.
  } finally {
    abort.abort(new Error("session close finished"));
    abort.dispose();
  }
}
