import type { JsonObject, JsonValue, ToolDefinition, ToolResult } from "@aicoo/sharedos-contracts";
import { z } from "zod";

import type { HarnessFrame, HarnessProtocol, HarnessStep } from "../harness.js";

/**
 * Codex speaks the OpenAI Responses function-calling shape.
 *
 * That is the layer this module targets: function tool declarations,
 * `function_call` items, and `function_call_output` results. It is deliberately
 * not the Codex CLI's own event envelope, which differs between releases. What
 * carries these frames -- the CLI in JSON mode, the Codex SDK, or a direct
 * Responses call -- is the transport's problem, not the protocol's.
 */
export const CODEX_PROTOCOL_ID = "openai.responses.function-calling";

const FunctionCallSchema = z
  .object({
    type: z.literal("function_call"),
    call_id: z.string().min(1),
    name: z.string().min(1),
    /** Responses sends arguments as a JSON-encoded string, not an object. */
    arguments: z.string(),
  })
  .passthrough();

const OutputTextSchema = z.object({ type: z.literal("output_text"), text: z.string() });

const MessageSchema = z
  .object({
    type: z.literal("message"),
    content: z.array(z.union([OutputTextSchema, z.object({ type: z.string() }).passthrough()])),
  })
  .passthrough();

const CompletedSchema = z
  .object({
    type: z.literal("response.completed"),
    response: z.object({ output_text: z.string().optional() }).passthrough().optional(),
  })
  .passthrough();

const ErrorSchema = z
  .object({
    type: z.enum(["error", "response.failed"]),
    error: z
      .object({ code: z.string().optional(), message: z.string().optional() })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const codexProtocol: HarnessProtocol = {
  id: CODEX_PROTOCOL_ID,

  describeTools(tools: readonly ToolDefinition[]): JsonValue {
    return tools.map((tool) => ({
      type: "function",
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    })) as unknown as JsonValue;
  },

  interpret(frame: HarnessFrame): readonly HarnessStep[] {
    const call = FunctionCallSchema.safeParse(frame);
    if (call.success) {
      const parsed = parseArguments(call.data.arguments);
      if (parsed === undefined) {
        return [
          {
            type: "failed",
            error: {
              code: "harness_arguments_unparseable",
              message: "Codex sent tool arguments that are not a JSON object.",
            },
          },
        ];
      }
      return [
        { type: "tool_call", callId: call.data.call_id, tool: call.data.name, arguments: parsed },
      ];
    }

    const failure = ErrorSchema.safeParse(frame);
    if (failure.success) {
      return [
        {
          type: "failed",
          error: {
            code: failure.data.error?.code ?? "harness_failed",
            message: failure.data.error?.message ?? "The Codex harness reported a failure.",
            retryable: true,
          },
        },
      ];
    }

    const completed = CompletedSchema.safeParse(frame);
    if (completed.success) {
      const text = completed.data.response?.output_text;
      return [text === undefined ? { type: "complete" } : { type: "complete", output: { text } }];
    }

    const message = MessageSchema.safeParse(frame);
    if (message.success) {
      return message.data.content
        .filter((block): block is { type: "output_text"; text: string } => {
          return (
            block.type === "output_text" && typeof (block as { text?: unknown }).text === "string"
          );
        })
        .map((block) => ({ type: "message", text: block.text }) as const);
    }

    return [];
  },

  encodeToolResult(result: ToolResult): HarnessFrame {
    return {
      type: "function_call_output",
      call_id: result.callId,
      output: JSON.stringify(toolResultBody(result)),
    };
  },
};

function parseArguments(raw: string): JsonObject | undefined {
  try {
    const parsed: unknown = JSON.parse(raw === "" ? "{}" : raw);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as JsonObject)
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * What the harness is told about a call it made.
 *
 * A denial is reported as an ordinary result, not as a transport error. The
 * harness needs to know it was refused and why, so it can choose differently;
 * hiding the refusal behind a crash would make it retry blindly.
 */
export function toolResultBody(result: ToolResult): JsonValue {
  return result.status === "succeeded"
    ? { status: result.status, output: result.output }
    : { status: result.status, error: { code: result.error.code, message: result.error.message } };
}
