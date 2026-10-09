import type { JsonValue, ToolDefinition, ToolResult } from "@aicoo/sharedos-contracts";
import { parseToolArguments, toolResultBody } from "../internal.js";

import { z } from "zod";

import type { HarnessFrame, HarnessProtocol, HarnessStep } from "../harness.js";

/**
 * Codex is read in two shapes, for the two ways it is reached.
 *
 * The OpenAI Responses function-calling shape serves a transport that speaks
 * the API directly, and the scripted conformance column: function tool
 * declarations, `function_call` items, `function_call_output` results. The CLI
 * in JSON mode (`codex exec --json`), which `CODEX_MCP_HARNESS` (mcp-runtime)
 * launches, prints none of that on stdout: a turn there is `thread.started`,
 * `turn.started`, a series of `item.*` events and a `turn.completed` or
 * `turn.failed`, the model's prose is an `agent_message` item, and its tool
 * calls travel over MCP. A protocol that read only the Responses shape
 * completed a turn Codex answered in prose with nothing to show, and the host
 * heard silence.
 *
 * The CLI's envelope is the vendor's to change, so only the events a turn's
 * outcome turns on are read; the rest are progress and yield nothing. A frame
 * of neither shape yields nothing as well.
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

/**
 * A failure, in either of the two shapes Codex reports one in.
 *
 * The Responses protocol nests it under `error`. The CLI's JSON mode puts the
 * text at the top level instead, and an adapter that only read the nested form
 * would report every live CLI failure under a generic message -- turning "401
 * Unauthorized" into "the harness reported a failure", which is the one detail
 * an operator needs.
 */
const ErrorSchema = z
  .object({
    type: z.enum(["error", "response.failed"]),
    message: z.string().optional(),
    error: z
      .object({ code: z.string().optional(), message: z.string().optional() })
      .passthrough()
      .optional(),
  })
  .passthrough();

/**
 * The CLI's events, as `codex exec --json` prints them. An `item.completed`
 * whose item is an `agent_message` carries the model's prose; `turn.completed` ends the turn; `turn.failed` ends it with
 * the CLI's reason. `thread.started`, `turn.started`, `item.started`,
 * `item.updated` and every other item kind (reasoning, `mcp_tool_call`,
 * `command_execution`) are progress, and are left to the final `[]`.
 */
const AgentMessageItemSchema = z
  .object({
    type: z.literal("item.completed"),
    item: z.object({ type: z.literal("agent_message"), text: z.string() }).passthrough(),
  })
  .passthrough();

const TurnCompletedSchema = z.object({ type: z.literal("turn.completed") }).passthrough();

const TurnFailedSchema = z
  .object({
    type: z.literal("turn.failed"),
    error: z.object({ message: z.string().optional() }).passthrough().optional(),
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
      const parsed = parseToolArguments(call.data.arguments);
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
            message:
              failure.data.error?.message ??
              failure.data.message ??
              "The Codex harness reported a failure.",
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

    const prose = AgentMessageItemSchema.safeParse(frame);
    if (prose.success) {
      const text = prose.data.item.text;
      return text.trim() === "" ? [] : [{ type: "message", text }];
    }

    if (TurnCompletedSchema.safeParse(frame).success) {
      // No output here: the driver joins the messages read above into the
      // turn's output, so a turn answered in prose has that prose.
      return [{ type: "complete" }];
    }

    const failedTurn = TurnFailedSchema.safeParse(frame);
    if (failedTurn.success) {
      const reason = failedTurn.data.error?.message;
      return [
        {
          type: "failed",
          error: {
            code: "harness_failed",
            message:
              reason === undefined || reason.trim() === ""
                ? "The Codex CLI reported a failed turn."
                : reason,
            retryable: true,
          },
        },
      ];
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
