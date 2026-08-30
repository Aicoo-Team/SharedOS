import type { JsonObject, JsonValue } from "@aicoo/sharedos-contracts";
import { z } from "zod";

import {
  ModelHttpClient,
  ModelRequestError,
  type ModelCompletionRequest,
  type ModelHttpClientOptions,
  type ModelMessage,
  type ModelReply,
  type ModelToolCall,
} from "./client.js";

/**
 * One item in a Responses conversation, of the kinds this client writes.
 *
 * The shape is flatter than chat-completions and the difference matters here: a
 * model's tool call and the assistant text around it are separate items rather
 * than one message with a `tool_calls` array, and a tool result is an item of
 * its own rather than a message with a role. One `ModelMessage` therefore
 * becomes zero, one, or several of these.
 */
type ResponseInputItem = JsonObject;

/**
 * The subset of a Responses payload this client reads.
 *
 * Deliberately loose about the item kinds it does not use. A Responses endpoint
 * emits reasoning items, web-search items, and whatever it adds next; a schema
 * that rejected an unrecognised kind would turn a provider's new feature into
 * an unreadable completion, while one that guessed at its meaning would invent
 * a decision the model did not make. Unknown kinds are carried past and
 * ignored, and the two kinds that decide the turn -- assistant text and a
 * function call -- are read strictly.
 */
const ResponsePayloadSchema = z.object({
  model: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  incomplete_details: z.object({ reason: z.string().min(1).nullish() }).nullish(),
  output: z
    .array(
      z.object({
        type: z.string(),
        call_id: z.string().nullish(),
        name: z.string().nullish(),
        arguments: z.string().nullish(),
        content: z.array(z.object({ type: z.string(), text: z.string().nullish() })).nullish(),
      }),
    )
    // Required, though it may be null or empty. A payload with no output at all
    // is not a response this can read, and accepting one would turn any JSON
    // document -- an error page, a proxy's own reply -- into a model that
    // answered with nothing.
    .nullable(),
  usage: z
    .object({
      input_tokens: z.number().int().nonnegative().optional(),
      output_tokens: z.number().int().nonnegative().optional(),
    })
    .nullish(),
});
type ResponsePayload = z.infer<typeof ResponsePayloadSchema>;

/** A stream event, of which only the response it carries is read. */
const StreamEventSchema = z.object({ response: z.unknown().optional() });

export interface OpenAiResponsesModelClientOptions extends ModelHttpClientOptions {
  /** The Responses root, without a trailing slash and without `/responses`. */
  readonly baseUrl: string;
  readonly maxOutputTokens?: number;
  /**
   * Omitted unless a caller asks for one, unlike the chat-completions client.
   *
   * A reasoning model rejects the parameter outright, and those are the models
   * this endpoint mostly serves, so a default of zero would make the client
   * unusable against exactly the provider it exists for. A caller pointing it
   * at a model that accepts one can still say so.
   */
  readonly temperature?: number;
  /**
   * Whether to ask for the answer as a stream of events. Default true.
   *
   * Streaming is not a feature here; it is what the subscription endpoint
   * accepts. What arrives is decided by the response's own content type rather
   * than by this flag, so a provider that streams anyway, or that declines to,
   * is read correctly either way.
   */
  readonly stream?: boolean;
  /**
   * Whether the provider may retain the turn. Default false.
   *
   * The request carries the turn's prompt, the catalogue, and every tool
   * result. Asking a provider to keep that is a decision a host should make
   * deliberately, so the default is not to.
   */
  readonly store?: boolean;
}

/**
 * Reasoning tokens count against this ceiling, which is why it is not the
 * chat-completions client's 4,096. A reasoning model can spend more than that
 * before writing a single tool call, and a reply cut off mid-thought fails the
 * turn -- correctly, but for a reason that would be this client's doing rather
 * than the model's.
 */
const DEFAULT_MAX_OUTPUT_TOKENS = 32_768;

/**
 * A client for OpenAI's Responses API, including the endpoint a ChatGPT
 * subscription reaches.
 *
 * The second wire shape, not a second policy. Authentication, the retry rule,
 * the single re-authentication, the per-request deadline, and the rule that a
 * provider's error body never reaches a caller all come from
 * {@link ModelHttpClient}, so what is here is exactly the translation: how a
 * conversation is written as input items, how tools are declared, and how an
 * answer -- one JSON document, or a stream of events -- is read back into a
 * reply.
 *
 * It is what makes a Codex subscription usable in the model seat.
 * `SubscriptionOAuthCredential` authenticates against `chatgpt.com`, and this
 * speaks what that endpoint speaks; the chat-completions client authenticates
 * identically and would fail on the wire shape.
 */
export class OpenAiResponsesModelClient extends ModelHttpClient {
  protected readonly path = "/responses";
  readonly #maxOutputTokens: number;
  readonly #temperature: number | undefined;
  readonly #stream: boolean;
  readonly #store: boolean;

  constructor(options: OpenAiResponsesModelClientOptions) {
    const stream = options.stream ?? true;
    super({
      ...options,
      headers: {
        // Asked for, not assumed: what is actually read is the content type the
        // provider answers with.
        accept: stream ? "text/event-stream" : "application/json",
        ...options.headers,
      },
    });
    this.#maxOutputTokens = options.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;
    this.#temperature = options.temperature;
    this.#stream = stream;
    this.#store = options.store ?? false;
  }

  protected encode(request: ModelCompletionRequest): JsonObject {
    return {
      model: this.model,
      input: request.messages.flatMap(encodeMessage),
      ...(request.tools.length === 0
        ? {}
        : {
            tools: request.tools.map((tool) => ({
              type: "function",
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters,
              // A SharedOS tool schema is the host's, and strict mode requires
              // a shape it does not promise -- every property required, no
              // additional properties. Declaring strict would have the provider
              // refuse the catalogue rather than the model refuse a call.
              strict: false,
            })),
            tool_choice: "auto",
          }),
      max_output_tokens: this.#maxOutputTokens,
      ...(this.#temperature === undefined ? {} : { temperature: this.#temperature }),
      store: this.#store,
      stream: this.#stream,
    };
  }

  protected async read(response: Response): Promise<ModelReply> {
    const payload = isEventStream(response)
      ? await readEventStream(response)
      : await response.json().catch(() => undefined);
    const parsed = ResponsePayloadSchema.safeParse(payload);
    if (!parsed.success) {
      throw new ModelRequestError("the model provider returned an unreadable completion");
    }
    return toReply(parsed.data);
  }
}

/**
 * A response the provider considers finished, read into a reply.
 *
 * `incomplete` is the provider ending the reply rather than the model choosing
 * to -- at the output ceiling, or at a filter -- and is reported as truncated
 * under the reason the provider gave. Any other non-terminal status is refused:
 * a `failed` response arrives with a 200 and would otherwise be read as a model
 * that answered with nothing, which is a decision it never made.
 */
function toReply(payload: ResponsePayload): ModelReply {
  const status = payload.status;
  if (status !== undefined && status !== "completed" && status !== "incomplete") {
    throw new ModelRequestError(`the model provider ended the response as ${status}`);
  }

  const text: string[] = [];
  const toolCalls: ModelToolCall[] = [];
  for (const item of payload.output ?? []) {
    if (item.type === "function_call") {
      // A call that cannot be read is not skipped. Dropping it would erase an
      // attempt the model made, and an attempt that never reaches the envelope
      // is graded as a tool that was never tried rather than one that was
      // refused.
      if (
        typeof item.call_id !== "string" ||
        typeof item.name !== "string" ||
        typeof item.arguments !== "string"
      ) {
        throw new ModelRequestError("the model provider returned an unreadable tool call");
      }
      // The call id, not the item id: it is what a function-call output has to
      // name for the provider to pair the two.
      toolCalls.push({ id: item.call_id, name: item.name, arguments: item.arguments });
      continue;
    }
    if (item.type === "message") {
      const parts = (item.content ?? [])
        .filter((part) => part.type === "output_text" && typeof part.text === "string")
        .map((part) => part.text ?? "");
      if (parts.length > 0) {
        text.push(parts.join(""));
      }
    }
    // Everything else -- reasoning summaries, provider-run tools -- is not the
    // model deciding anything the envelope can act on, and is left out rather
    // than guessed at.
  }

  const reason = payload.incomplete_details?.reason ?? status;
  const usage = payload.usage;
  return {
    text: text.join("\n"),
    toolCalls,
    ...(payload.model === undefined ? {} : { model: payload.model }),
    ...(typeof reason === "string" ? { finishReason: reason } : {}),
    ...(status === "incomplete" ? { truncated: true } : {}),
    ...(usage === undefined || usage === null
      ? {}
      : {
          usage: {
            ...(usage.input_tokens === undefined ? {} : { inputTokens: usage.input_tokens }),
            ...(usage.output_tokens === undefined ? {} : { outputTokens: usage.output_tokens }),
          },
        }),
  };
}

function isEventStream(response: Response): boolean {
  return (response.headers.get("content-type") ?? "").toLowerCase().includes("text/event-stream");
}

/**
 * The response a stream ended on.
 *
 * Every event that carries a `response` replaces the one before it, so what is
 * left when the stream ends is the terminal one -- `response.completed`,
 * `response.incomplete`, or `response.failed` -- without this having to know
 * the event names. Deltas are ignored: each of those events carries the whole
 * response, so reassembling text and arguments from fragments would be a second
 * implementation of the same answer, and a worse one.
 *
 * A stream that ends without ever carrying a response is a failed call rather
 * than an empty reply. The distinction is the same one truncation makes: a
 * model that said nothing chose to, and a stream that was cut off did not.
 */
async function readEventStream(response: Response): Promise<JsonValue | undefined> {
  const body = response.body;
  if (body === null) {
    throw new ModelRequestError("the model provider returned an empty stream");
  }
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let latest: JsonValue | undefined;

  const take = (block: string): void => {
    // Several `data:` lines in one event are joined with a newline, as the
    // event-stream format says. Providers send one line of JSON, but a reader
    // that guessed at the separator would corrupt the one that does not.
    const data = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("\n");
    if (data === "" || data === "[DONE]") {
      return;
    }
    let event: unknown;
    try {
      event = JSON.parse(data);
    } catch {
      // A partial or non-JSON event is not the answer; the terminal event is.
      return;
    }
    const parsed = StreamEventSchema.safeParse(event);
    if (parsed.success && parsed.data.response !== undefined) {
      latest = parsed.data.response as JsonValue;
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer = `${buffer}${decoder.decode(value, { stream: true })}`.replaceAll("\r\n", "\n");
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      take(buffer.slice(0, boundary));
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");
    }
  }
  // A stream whose last event was not followed by a blank line still counts:
  // the provider ended it, and the event is complete.
  take(buffer);

  if (latest === undefined) {
    throw new ModelRequestError("the model provider's stream ended without a response");
  }
  return latest;
}

/**
 * One conversation turn as Responses input items.
 *
 * An assistant turn becomes its text and each of its calls, in that order,
 * because the provider pairs a `function_call_output` with the `function_call`
 * that preceded it; an assistant turn with no text contributes no message item,
 * since an empty one is a message the model never wrote.
 */
function encodeMessage(message: ModelMessage): readonly ResponseInputItem[] {
  if (message.role === "tool") {
    return [{ type: "function_call_output", call_id: message.toolCallId, output: message.content }];
  }
  if (message.role === "assistant") {
    return [
      ...(message.content === ""
        ? []
        : [
            {
              type: "message",
              role: "assistant",
              content: [{ type: "output_text", text: message.content }],
            },
          ]),
      ...message.toolCalls.map((call) => ({
        type: "function_call",
        call_id: call.id,
        name: call.name,
        arguments: call.arguments,
      })),
    ];
  }
  return [
    {
      type: "message",
      role: message.role,
      content: [{ type: "input_text", text: message.content }],
    },
  ];
}
