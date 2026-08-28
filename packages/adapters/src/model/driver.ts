import type {
  JsonObject,
  JsonValue,
  ProtocolError,
  RuntimeManifest,
  ToolCall,
  ToolDefinition,
  ToolResult,
} from "@aicoo/sharedos-contracts";
import {
  escalationRequest,
  type AgentTurnDecision,
  type AgentTurnDriver,
  type AgentTurnInput,
  type AgentTurnRequest,
  type AgentTurnSession,
} from "@aicoo/sharedos-runtime";

import {
  parseToolArguments,
  type ModelClient,
  type ModelMessage,
  type ModelReply,
  type ModelTool,
  type ModelToolCall,
} from "./client.js";

/**
 * The alphabet a chat-completions provider accepts for a function name.
 *
 * DeepSeek enforces `^[a-zA-Z0-9_-]+$` and rejects the request outright, and
 * OpenAI's is the same. SharedOS tool names are dotted -- `files.read`,
 * `files.snapshot.restore` -- so a catalogue cannot be offered to a model
 * unchanged.
 */
const WIRE_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/u;

/**
 * How a SharedOS tool name is spoken to a model, and read back.
 *
 * Dots become underscores on the way out and the catalogue's own map decides
 * the way back, so a catalogued tool round-trips exactly rather than through a
 * guess. The map is built per turn from the permission-filtered catalogue,
 * which means it contains precisely the tools this actor was allowed to see.
 *
 * A name the map does not contain is decoded by reversing the substitution and
 * then passed through unchanged. That path is best-effort and it exists for one
 * reason: a model that invents a tool outside its catalogue must still be able
 * to reach the envelope and be refused. Filtering it here, or failing to decode
 * it, would erase the attempt -- and an attempt that never arrives is graded as
 * a tool that was never tried, not as a tool that was refused.
 */
export class ToolNameCodec {
  readonly #toWire = new Map<string, string>();
  readonly #fromWire = new Map<string, string>();

  constructor(tools: readonly ToolDefinition[]) {
    for (const tool of tools) {
      const wire = tool.name.replaceAll(".", "_");
      if (!WIRE_NAME_PATTERN.test(wire)) {
        throw new TypeError(
          `Tool ${tool.name} cannot be offered to a model: no wire name matches ${String(WIRE_NAME_PATTERN)}`,
        );
      }
      const clash = this.#fromWire.get(wire);
      if (clash !== undefined && clash !== tool.name) {
        // Two catalogue names collapsing onto one wire name would silently
        // re-route calls between them. Refusing to publish the catalogue is the
        // only safe answer: a mis-routed call still produces a plausible record.
        throw new TypeError(
          `Tools ${clash} and ${tool.name} share the wire name ${wire}; the catalogue is ambiguous to a model`,
        );
      }
      this.#toWire.set(tool.name, wire);
      this.#fromWire.set(wire, tool.name);
    }
  }

  toWire(name: string): string {
    return this.#toWire.get(name) ?? name.replaceAll(".", "_");
  }

  fromWire(name: string): string {
    return this.#fromWire.get(name) ?? name.replaceAll("_", ".");
  }
}

export interface ModelDriverOptions {
  readonly manifest: RuntimeManifest;
  readonly client: ModelClient;
  /** Overrides how the turn message becomes the model's prompt. */
  readonly prompt?: (request: AgentTurnRequest) => string;
  /**
   * Guard against a model that never forms a readable call.
   *
   * A call whose arguments do not parse is refused by the driver and answered
   * back to the model, which costs the turn no step; a model that kept
   * producing them would otherwise be spoken to until the turn timed out. Past
   * this many in one turn, the turn fails instead.
   */
  readonly maxMalformedCalls?: number;
}

const DEFAULT_MAX_MALFORMED_CALLS = 8;

/**
 * A model API driven as a SharedOS agent turn.
 *
 * The same port a vendor harness occupies, with the vendor removed. A harness
 * driver translates frames from a CLI that has already decided what to call;
 * this one puts the model itself in the seat, so the catalogue it sees is the
 * permission-filtered one the kernel built and nothing between the two can add
 * a tool, drop a tool, or answer a call on its own.
 *
 * What that buys is an axis the other columns cannot separate. A scripted
 * column leaves out the transport; a live CLI column leaves out the catalogue;
 * an MCP column keeps both but hands the turn loop to the vendor's scaffolding.
 * This one keeps the loop inside `StandardRuntime` and drops the vendor
 * entirely, which is what makes "the model behaved this way" distinguishable
 * from "the vendor's scaffolding made the model behave this way".
 *
 * It is not a replacement for the scripted adversary and cannot be one. A model
 * chooses what to call, so an attempt it declines to issue leaves no operation
 * in the record and is graded as unexercised. That is the honest grading, and
 * the reason the deterministic column stays the reference.
 */
export class ModelDriver implements AgentTurnDriver {
  readonly manifest: RuntimeManifest;
  readonly #client: ModelClient;
  readonly #prompt: (request: AgentTurnRequest) => string;
  readonly #maxMalformedCalls: number;

  constructor(options: ModelDriverOptions) {
    this.manifest = options.manifest;
    this.#client = options.client;
    this.#prompt = options.prompt ?? defaultPrompt;
    this.#maxMalformedCalls = options.maxMalformedCalls ?? DEFAULT_MAX_MALFORMED_CALLS;
    if (!Number.isInteger(this.#maxMalformedCalls) || this.#maxMalformedCalls <= 0) {
      throw new TypeError("maxMalformedCalls must be a positive integer");
    }
  }

  open(request: AgentTurnRequest, _signal: AbortSignal): Promise<AgentTurnSession> {
    const codec = new ToolNameCodec(request.tools);
    const tools: ModelTool[] = request.tools.map((tool) => ({
      name: codec.toWire(tool.name),
      description: tool.description,
      parameters: tool.inputSchema,
    }));
    return Promise.resolve(
      new ModelSession(
        this.#client,
        request,
        codec,
        tools,
        this.#prompt(request),
        this.#maxMalformedCalls,
      ),
    );
  }
}

class ModelSession implements AgentTurnSession {
  readonly #client: ModelClient;
  readonly #request: AgentTurnRequest;
  readonly #codec: ToolNameCodec;
  readonly #tools: readonly ModelTool[];
  readonly #messages: ModelMessage[];
  /**
   * Calls the model asked for in one reply that the loop has not been handed yet.
   *
   * A provider may return several at once. SharedOS re-authorizes every call
   * separately, so they are released one at a time and the model is not spoken
   * to again until the last of them has been answered -- both because the wire
   * format requires every call in an assistant message to be answered before
   * the next assistant turn, and because batching would put a call into the
   * audit trail in an order that never happened.
   */
  readonly #pending: ModelToolCall[] = [];
  readonly #maxMalformedCalls: number;
  #servedModel: string | undefined;
  /** Why the last reply ended, in the provider's words, once one has. */
  #finishReason: string | undefined;
  /** Summed over every model call this turn; absent until a reply reports one. */
  #inputTokens: number | undefined;
  #outputTokens: number | undefined;
  /** Calls refused here for unreadable arguments this turn. */
  #malformed = 0;

  constructor(
    client: ModelClient,
    request: AgentTurnRequest,
    codec: ToolNameCodec,
    tools: readonly ModelTool[],
    prompt: string,
    maxMalformedCalls: number,
  ) {
    this.#client = client;
    this.#request = request;
    this.#codec = codec;
    this.#tools = tools;
    this.#messages = [{ role: "user", content: prompt }];
    this.#maxMalformedCalls = maxMalformedCalls;
  }

  async next(input: AgentTurnInput, signal: AbortSignal): Promise<AgentTurnDecision> {
    if (input.type === "tool_result") {
      this.#messages.push({
        role: "tool",
        toolCallId: input.result.callId,
        content: describeResult(input.result),
      });
    }

    for (;;) {
      const released = this.#release();
      if (released !== undefined) {
        return released;
      }

      // Every call the last reply asked for has been answered -- by the kernel,
      // or here for one that could not be made -- and only now is the model
      // spoken to again: the wire format requires each call in an assistant
      // message to be answered before the next assistant turn.
      let reply: ModelReply;
      try {
        reply = await this.#client.complete(
          { messages: this.#messages, tools: this.#tools },
          signal,
        );
      } catch (error) {
        if (signal.aborted) {
          throw error;
        }
        return fail(
          "model_call_failed",
          `The model call failed: ${describe(error)}`,
          this.#metadata(),
        );
      }

      this.#account(reply);
      if (reply.finishReason === "length") {
        // The provider stopped the model, not the model itself. Nothing in a
        // reply cut off at the token ceiling is a decision the model finished
        // making: its calls may be incomplete and its silence is not a choice
        // to stop. Releasing any of it would grade the cut as the model's
        // doing, and completing the turn would grade it as the model choosing
        // to end -- both are the wrong record. The turn fails, under a code
        // that says so.
        return fail(
          "model_output_truncated",
          "The model's reply was cut off at the output token limit before it finished deciding.",
          this.#metadata(),
        );
      }

      this.#messages.push({
        role: "assistant",
        content: reply.text,
        toolCalls: reply.toolCalls,
      });
      if (reply.toolCalls.length === 0) {
        return {
          type: "complete",
          output: { text: reply.text } satisfies JsonValue,
          metadata: this.#metadata(),
        };
      }
      this.#pending.push(...reply.toolCalls);
    }
  }

  /**
   * Hand the loop the next thing to do, escalation included, answering in place
   * any call that cannot be made.
   *
   * The escalate affordance is answered here rather than being turned into a
   * `ToolCall`, so it never reaches the kernel: it is not an operation to
   * authorize, it is the driver saying the turn is over and a human has to
   * decide. Recognised by name off the catalogue -- the model picked a tool it
   * was offered -- rather than read out of the prose around it, which would
   * make the row measure a phrase instead of a choice. Anything queued behind
   * it is dropped, and deliberately: the turn ends at an escalation, and
   * running the calls the model asked for after it would execute work on the
   * far side of a decision nobody has made yet.
   *
   * Arguments that do not parse are not sent as `{}`. An empty object is a call
   * the model never made, and a tool whose schema accepts one -- every parameter
   * optional -- would run it: the record would then show a call the model chose,
   * made with arguments the driver invented. So the call is refused here, under
   * the code the kernel uses for the same defect, and the refusal is answered
   * straight back to the model so it can try again. No `ToolCall` is built and
   * nothing reaches the envelope, so no operation appears in the record for it;
   * what does appear is `malformedToolCalls` on the turn's metadata, the way
   * `callsAfterEscalation` is carried on the MCP path.
   *
   * Refusing here costs the turn no step, so a model that never forms a
   * readable call is bounded separately: past `maxMalformedCalls` in one turn
   * the turn fails, rather than being spoken to until it times out.
   */
  #release(): AgentTurnDecision | undefined {
    for (;;) {
      const next = this.#pending.shift();
      if (next === undefined) {
        return undefined;
      }

      const parsed = parseToolArguments(next.arguments);
      const escalation = escalationRequest(this.#codec.fromWire(next.name), parsed);
      if (escalation !== undefined) {
        this.#pending.length = 0;
        return { type: "escalate", reason: escalation, metadata: this.#metadata() };
      }

      if (parsed !== undefined) {
        return { type: "tool_call", call: this.#toolCall(next, parsed) };
      }
      this.#malformed += 1;
      if (this.#malformed > this.#maxMalformedCalls) {
        this.#pending.length = 0;
        return fail(
          "model_malformed_call_limit_exceeded",
          "The model emitted too many calls whose arguments could not be read.",
          this.#metadata(),
        );
      }
      this.#messages.push({
        role: "tool",
        toolCallId: next.id,
        content: describeResult(this.#refuse(next)),
      });
    }
  }

  /**
   * What the record should say ran this turn.
   *
   * The served model rather than the configured one, because a provider may
   * substitute: DeepSeek answers an unrecognised name with a default instead of
   * rejecting it, and a record naming the model that was asked for would be
   * evidence attributed to a model that never ran.
   */
  #metadata(): JsonObject {
    return {
      model: this.#servedModel ?? this.#client.model,
      modelProvider: this.#client.provider,
      requestedModel: this.#client.model,
      malformedToolCalls: this.#malformed,
      ...(this.#finishReason === undefined ? {} : { finishReason: this.#finishReason }),
      ...(this.#inputTokens === undefined ? {} : { inputTokens: this.#inputTokens }),
      ...(this.#outputTokens === undefined ? {} : { outputTokens: this.#outputTokens }),
    };
  }

  /**
   * Keep what the provider said about a reply, beyond its content.
   *
   * The model it served, why it stopped, and what it billed. Token counts are
   * summed across the turn's calls so the record carries the turn's spend; a
   * provider that reports none leaves the fields absent rather than zero,
   * because a zero would be a claim and an absence is the truth.
   */
  #account(reply: ModelReply): void {
    this.#servedModel = reply.model ?? this.#servedModel;
    this.#finishReason = reply.finishReason ?? this.#finishReason;
    if (reply.usage?.inputTokens !== undefined) {
      this.#inputTokens = (this.#inputTokens ?? 0) + reply.usage.inputTokens;
    }
    if (reply.usage?.outputTokens !== undefined) {
      this.#outputTokens = (this.#outputTokens ?? 0) + reply.usage.outputTokens;
    }
  }

  /** The refusal the model is shown for a call it made with unreadable arguments. */
  #refuse(call: ModelToolCall): ToolResult {
    return {
      callId: call.id,
      tool: this.#codec.fromWire(call.name),
      status: "failed",
      error: {
        code: "invalid_tool_arguments",
        message: "The tool arguments were not a JSON object, so the call was not made.",
      },
      completedAt: this.#request.context.now,
    };
  }

  #toolCall(call: ModelToolCall, arguments_: JsonObject): ToolCall {
    return {
      id: call.id,
      tool: this.#codec.fromWire(call.name),
      arguments: arguments_,
      traceId: this.#request.context.traceId,
      requestedAt: this.#request.context.now,
    };
  }
}

/** A tool result, rendered as the text a chat-completions provider expects. */
function describeResult(result: ToolResult): string {
  if (result.status === "succeeded") {
    return JSON.stringify({ status: result.status, output: result.output });
  }
  return JSON.stringify({
    status: result.status,
    error: { code: result.error.code, message: result.error.message },
  });
}

function fail(code: string, message: string, metadata: JsonObject): AgentTurnDecision {
  const error: ProtocolError = { code, message };
  return { type: "fail", error, metadata };
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** The message payload as a prompt, matching what a harness driver does with it. */
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
