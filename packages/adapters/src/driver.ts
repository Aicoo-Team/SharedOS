import type {
  JsonObject,
  JsonValue,
  ProtocolError,
  RuntimeManifest,
  ToolCall,
} from "@aicoo/sharedos-contracts";
import {
  ESCALATION_TOOL_NAME,
  escalationRequest,
  type AgentTurnDecision,
  type AgentTurnDriver,
  type AgentTurnInput,
  type AgentTurnRequest,
  type AgentTurnSession,
} from "@aicoo/sharedos-runtime";

import type {
  HarnessChannel,
  HarnessProtocol,
  HarnessStep,
  HarnessTransport,
  HarnessTurnRequest,
} from "./harness.js";

export interface HarnessDriverOptions {
  readonly manifest: RuntimeManifest;
  readonly protocol: HarnessProtocol;
  readonly transport: HarnessTransport;
  /** Overrides how the turn message becomes the harness prompt. */
  readonly prompt?: (request: AgentTurnRequest) => string;
  /** Guard against a harness that streams unrelated frames without end. */
  readonly maxIgnoredFrames?: number;
  /**
   * The step to declare for the nth call this turn releases, if any.
   *
   * `undefined` -- the default for every call -- leaves the step to the loop.
   * It exists for the one thing a driven harness cannot otherwise express:
   * reaching past its own budget. The loop's index stops at `maxSteps`, so a
   * call at or past the ceiling can only be made by a driver that names the
   * step itself, which makes the driver the attacker for that call.
   */
  readonly declareStep?: (index: number, request: AgentTurnRequest) => number | undefined;
}

const DEFAULT_MAX_IGNORED_FRAMES = 512;

/**
 * One vendor harness, driven as a SharedOS agent turn.
 *
 * A driver is only translation. The turn loop, the permission-filtered
 * catalogue, per-call re-authorization, and audit all belong to the SharedOS
 * execution envelope, which is why adding a harness requires no kernel change
 * and no second enforcement path.
 *
 * Tool calls are passed through exactly as the harness emitted them, including
 * names that are not in the catalogue. Filtering those here would be the
 * adapter quietly enforcing policy, and worse, it would erase the attempt: a
 * guess at an unexposed tool has to reach the envelope to be refused and
 * recorded.
 */
export class HarnessDriver implements AgentTurnDriver {
  readonly manifest: RuntimeManifest;
  readonly #protocol: HarnessProtocol;
  readonly #transport: HarnessTransport;
  readonly #prompt: (request: AgentTurnRequest) => string;
  readonly #maxIgnoredFrames: number;
  readonly #declareStep: HarnessDriverOptions["declareStep"];

  constructor(options: HarnessDriverOptions) {
    this.manifest = options.manifest;
    this.#protocol = options.protocol;
    this.#transport = options.transport;
    this.#prompt = options.prompt ?? defaultPrompt;
    this.#maxIgnoredFrames = options.maxIgnoredFrames ?? DEFAULT_MAX_IGNORED_FRAMES;
    this.#declareStep = options.declareStep;
    if (!Number.isInteger(this.#maxIgnoredFrames) || this.#maxIgnoredFrames <= 0) {
      throw new TypeError("maxIgnoredFrames must be a positive integer");
    }
  }

  async open(request: AgentTurnRequest, signal: AbortSignal): Promise<AgentTurnSession> {
    const turn: HarnessTurnRequest = {
      executionId: request.executionId,
      prompt: this.#prompt(request),
      tools: this.#protocol.describeTools(request.tools),
      context: request.context,
      ...(request.metadata === undefined ? {} : { metadata: request.metadata }),
    };
    const channel = await this.#transport.open(turn, signal);
    return new HarnessSession(channel, this.#protocol, request, this.#maxIgnoredFrames, {
      ...(this.#declareStep === undefined ? {} : { declareStep: this.#declareStep }),
    });
  }
}

class HarnessSession implements AgentTurnSession {
  readonly #channel: HarnessChannel;
  readonly #protocol: HarnessProtocol;
  readonly #request: AgentTurnRequest;
  readonly #maxIgnoredFrames: number;
  /**
   * Steps a single frame produced but the turn has not consumed yet.
   *
   * A harness may ask for several tools in one frame. SharedOS re-authorizes
   * every call separately, so they are executed one at a time rather than
   * batched: the conservative order, and the one whose audit trail matches what
   * actually happened.
   */
  readonly #pending: HarnessStep[] = [];
  readonly #messages: string[] = [];
  readonly #declareStep: HarnessDriverOptions["declareStep"];
  /** Whether this turn's catalogue offers the escalate affordance at all. */
  readonly #offered: boolean;
  /** Calls released to the loop this turn, which is what a step policy indexes. */
  #released = 0;

  constructor(
    channel: HarnessChannel,
    protocol: HarnessProtocol,
    request: AgentTurnRequest,
    maxIgnoredFrames: number,
    options: Pick<HarnessDriverOptions, "declareStep"> = {},
  ) {
    this.#channel = channel;
    this.#protocol = protocol;
    this.#request = request;
    this.#maxIgnoredFrames = maxIgnoredFrames;
    this.#declareStep = options.declareStep;
    this.#offered = request.tools.some((tool) => tool.name === ESCALATION_TOOL_NAME);
  }

  async next(input: AgentTurnInput, signal: AbortSignal): Promise<AgentTurnDecision> {
    if (input.type === "tool_result") {
      await this.#channel.write(this.#protocol.encodeToolResult(input.result), signal);
    }

    for (let frames = 0; frames <= this.#maxIgnoredFrames; frames += 1) {
      const decision = this.#drainPending();
      if (decision !== undefined) {
        return decision;
      }

      const frame = await this.#channel.read(signal);
      if (frame === undefined) {
        return fail(
          "harness_ended_without_outcome",
          "The harness stopped speaking without completing the turn.",
        );
      }
      this.#pending.push(...this.#protocol.interpret(frame));
    }

    return fail(
      "harness_frame_limit_exceeded",
      "The harness emitted too many frames without producing an outcome.",
    );
  }

  #drainPending(): AgentTurnDecision | undefined {
    while (this.#pending.length > 0) {
      const step = this.#pending.shift() as HarnessStep;
      if (step.type === "message") {
        this.#messages.push(step.text);
        continue;
      }
      if (step.type === "failed") {
        return { type: "fail", error: step.error };
      }
      if (step.type === "complete") {
        return {
          type: "complete",
          output: step.output ?? { text: this.#messages.join("\n") },
          ...(step.metadata === undefined ? {} : { metadata: step.metadata }),
        };
      }
      // The escalate affordance ends the turn here rather than becoming a
      // `ToolCall`. It is published in the catalogue like any other tool and is
      // permission-filtered like one, but there is nothing for the kernel to
      // authorize: the harness is saying the turn is over and a human has to
      // decide. Recognised by name, so escalation is a tool the harness chose --
      // and only when this turn's catalogue offers it. Ending the turn here
      // skips the envelope, and with it the envelope's check that the tool was
      // published to this agent, so the catalogue is read first: a harness that
      // names the affordance without holding it has its call passed through to
      // be refused `tool_unavailable` like any other unpublished name. Anything
      // less would hand every harness a channel to the owner that no host
      // granted, on the strength of a string.
      const escalation = this.#offered ? escalationRequest(step.tool, step.arguments) : undefined;
      if (escalation !== undefined) {
        return { type: "escalate", reason: escalation };
      }
      const index = this.#released;
      this.#released += 1;
      const declared = this.#declareStep?.(index, this.#request);
      return {
        type: "tool_call",
        call: this.#toolCall(step.callId, step.tool, step.arguments),
        ...(declared === undefined ? {} : { step: declared }),
      };
    }
    return undefined;
  }

  async close(): Promise<void> {
    await this.#channel.close();
  }

  #toolCall(callId: string, tool: string, arguments_: JsonObject): ToolCall {
    return {
      id: callId,
      tool,
      arguments: arguments_,
      traceId: this.#request.context.traceId,
      requestedAt: this.#request.context.now,
    };
  }
}

function fail(code: string, message: string): AgentTurnDecision {
  const error: ProtocolError = { code, message };
  return { type: "fail", error };
}

/**
 * The message payload as a prompt.
 *
 * Payloads are JSON, and a harness wants text. A plain string is used as-is and
 * a `text` field is preferred when present; anything else is serialised rather
 * than dropped, so no instruction is silently lost in translation.
 */
function defaultPrompt(request: AgentTurnRequest): string {
  const payload: JsonValue = request.message.payload;
  if (typeof payload === "string") {
    return payload;
  }
  if (payload !== null && typeof payload === "object" && !Array.isArray(payload)) {
    const text = (payload as JsonObject)["text"];
    if (typeof text === "string") {
      return text;
    }
  }
  return JSON.stringify(payload);
}
