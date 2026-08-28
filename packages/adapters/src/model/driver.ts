import type {
  JsonObject,
  JsonValue,
  ProtocolError,
  RuntimeManifest,
  ToolCall,
  ToolDefinition,
  ToolResult,
} from "@aicoo/sharedos-contracts";
import type {
  AgentTurnDecision,
  AgentTurnDriver,
  AgentTurnInput,
  AgentTurnRequest,
  AgentTurnSession,
} from "@aicoo/sharedos-runtime";

import {
  parseToolArguments,
  type ModelClient,
  type ModelMessage,
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
}

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

  constructor(options: ModelDriverOptions) {
    this.manifest = options.manifest;
    this.#client = options.client;
    this.#prompt = options.prompt ?? defaultPrompt;
  }

  open(request: AgentTurnRequest, _signal: AbortSignal): Promise<AgentTurnSession> {
    const codec = new ToolNameCodec(request.tools);
    const tools: ModelTool[] = request.tools.map((tool) => ({
      name: codec.toWire(tool.name),
      description: tool.description,
      parameters: tool.inputSchema,
    }));
    return Promise.resolve(
      new ModelSession(this.#client, request, codec, tools, this.#prompt(request)),
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
  #servedModel: string | undefined;

  constructor(
    client: ModelClient,
    request: AgentTurnRequest,
    codec: ToolNameCodec,
    tools: readonly ModelTool[],
    prompt: string,
  ) {
    this.#client = client;
    this.#request = request;
    this.#codec = codec;
    this.#tools = tools;
    this.#messages = [{ role: "user", content: prompt }];
  }

  async next(input: AgentTurnInput, signal: AbortSignal): Promise<AgentTurnDecision> {
    if (input.type === "tool_result") {
      this.#messages.push({
        role: "tool",
        toolCallId: input.result.callId,
        content: describeResult(input.result),
      });
      const queued = this.#pending.shift();
      if (queued !== undefined) {
        return { type: "tool_call", call: this.#toolCall(queued) };
      }
    }

    let reply;
    try {
      reply = await this.#client.complete({ messages: this.#messages, tools: this.#tools }, signal);
    } catch (error) {
      if (signal.aborted) {
        throw error;
      }
      return fail("model_call_failed", `The model call failed: ${describe(error)}`);
    }

    this.#servedModel = reply.model ?? this.#servedModel;
    this.#messages.push({
      role: "assistant",
      content: reply.text,
      toolCalls: reply.toolCalls,
    });

    this.#pending.push(...reply.toolCalls);
    const next = this.#pending.shift();
    if (next === undefined) {
      return {
        type: "complete",
        output: { text: reply.text } satisfies JsonValue,
        metadata: this.#metadata(),
      };
    }
    return { type: "tool_call", call: this.#toolCall(next) };
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
    };
  }

  #toolCall(call: ModelToolCall): ToolCall {
    // Arguments that do not parse are sent as an empty object rather than
    // dropped. The call was made and belongs in the record; the kernel refuses
    // it on its own terms, which is a real outcome, whereas a call withheld
    // here would read as a call the model never attempted.
    const parsed = parseToolArguments(call.arguments);
    return {
      id: call.id,
      tool: this.#codec.fromWire(call.name),
      arguments: parsed ?? {},
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

function fail(code: string, message: string): AgentTurnDecision {
  const error: ProtocolError = { code, message };
  return { type: "fail", error };
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
