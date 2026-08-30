import type { JsonObject } from "@aicoo/sharedos-contracts";
import { z } from "zod";

import {
  ModelHttpClient,
  ModelRequestError,
  type ModelCompletionRequest,
  type ModelHttpClientOptions,
  type ModelMessage,
  type ModelReply,
} from "./client.js";

/**
 * The subset of a chat-completions response this driver reads.
 *
 * Parsed rather than cast. The response is remote input, and a driver that
 * trusted its shape would turn a provider's bad day into a kernel-looking
 * failure somewhere further in.
 */
const ChatCompletionSchema = z.object({
  model: z.string().min(1).optional(),
  choices: z
    .array(
      z.object({
        finish_reason: z.string().nullish(),
        message: z.object({
          content: z.string().nullish(),
          tool_calls: z
            .array(
              z.object({
                id: z.string().min(1),
                function: z.object({
                  name: z.string().min(1),
                  arguments: z.string(),
                }),
              }),
            )
            .nullish(),
        }),
      }),
    )
    .min(1),
  usage: z
    .object({
      prompt_tokens: z.number().int().nonnegative().optional(),
      completion_tokens: z.number().int().nonnegative().optional(),
    })
    .nullish(),
});

export interface OpenAiCompatibleModelClientOptions extends ModelHttpClientOptions {
  /** The chat-completions root, without a trailing slash. */
  readonly baseUrl: string;
  readonly maxOutputTokens?: number;
  /**
   * Left at zero by default, which reduces variation between runs but does not
   * remove it. This column is not deterministic and must not be described as if
   * it were: a temperature of zero is not a seed, and the same prompt can still
   * produce a different call sequence on a different day.
   */
  readonly temperature?: number;
}

/**
 * Room for a tool-heavy turn. A reply that hits this ceiling is not a decision
 * the model finished making, and the driver fails the turn on it rather than
 * grading the cut as a choice; the ceiling is set so that a turn issuing
 * several calls with JSON arguments does not reach it in ordinary use.
 */
const DEFAULT_MAX_OUTPUT_TOKENS = 4_096;

/**
 * A chat-completions client for any provider speaking the OpenAI wire shape.
 *
 * DeepSeek is the one this was built against, but nothing here is DeepSeek
 * specific: the endpoint, model, and provider label are all supplied, so
 * pointing the column at another compatible provider is configuration rather
 * than a second client.
 */
export class OpenAiCompatibleModelClient extends ModelHttpClient {
  protected readonly path = "/chat/completions";
  readonly #maxOutputTokens: number;
  readonly #temperature: number;

  constructor(options: OpenAiCompatibleModelClientOptions) {
    super(options);
    this.#maxOutputTokens = options.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;
    this.#temperature = options.temperature ?? 0;
  }

  protected encode(request: ModelCompletionRequest): JsonObject {
    return {
      model: this.model,
      messages: request.messages.map(encodeMessage),
      ...(request.tools.length === 0
        ? {}
        : {
            tools: request.tools.map((tool) => ({
              type: "function",
              function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters,
              },
            })),
            tool_choice: "auto",
          }),
      max_tokens: this.#maxOutputTokens,
      temperature: this.#temperature,
    };
  }

  protected async read(response: Response): Promise<ModelReply> {
    // The body is parsed, never thrown from. A `JSON.parse` failure quotes the
    // text it choked on, and a provider answering 200 with an error page would
    // put that text -- which can include the request it is complaining about --
    // into an error message that leaves this package.
    const parsed = ChatCompletionSchema.safeParse(await response.json().catch(() => undefined));
    if (!parsed.success) {
      throw new ModelRequestError("the model provider returned an unreadable completion");
    }

    const [choice] = parsed.data.choices;
    const message = choice?.message;
    const usage = parsed.data.usage;
    const finishReason = choice?.finish_reason;
    return {
      text: message?.content ?? "",
      toolCalls: (message?.tool_calls ?? []).map((call) => ({
        id: call.id,
        name: call.function.name,
        arguments: call.function.arguments,
      })),
      ...(parsed.data.model === undefined ? {} : { model: parsed.data.model }),
      ...(typeof finishReason === "string" ? { finishReason } : {}),
      // `length` is the provider ending the reply at the output ceiling, which
      // is the one finish reason that is not the model's decision.
      ...(finishReason === "length" ? { truncated: true } : {}),
      ...(usage === undefined || usage === null
        ? {}
        : {
            usage: {
              ...(usage.prompt_tokens === undefined ? {} : { inputTokens: usage.prompt_tokens }),
              ...(usage.completion_tokens === undefined
                ? {}
                : { outputTokens: usage.completion_tokens }),
            },
          }),
    };
  }
}

function encodeMessage(message: ModelMessage): JsonObject {
  if (message.role === "tool") {
    return { role: "tool", tool_call_id: message.toolCallId, content: message.content };
  }
  if (message.role === "assistant") {
    return {
      role: "assistant",
      content: message.content,
      ...(message.toolCalls.length === 0
        ? {}
        : {
            tool_calls: message.toolCalls.map((call) => ({
              id: call.id,
              type: "function",
              function: { name: call.name, arguments: call.arguments },
            })),
          }),
    };
  }
  return { role: message.role, content: message.content };
}
