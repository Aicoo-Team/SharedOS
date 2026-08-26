import type { JsonObject, JsonValue, ToolDefinition, ToolResult } from "@aicoo/sharedos-contracts";
import { z } from "zod";

import { toolResultBody } from "../codex/protocol.js";
import type { HarnessFrame, HarnessProtocol, HarnessStep } from "../harness.js";

/**
 * Claude Code speaks Anthropic message content blocks inside a stream-json
 * envelope.
 *
 * The content blocks -- `tool_use`, `tool_result`, `text` -- are the stable
 * part and are what this module translates. The `{type:"assistant"|"user"|
 * "result"}` envelope is the CLI's `--output-format stream-json` framing.
 */
export const CLAUDE_CODE_PROTOCOL_ID = "anthropic.messages.stream-json";

const TextBlockSchema = z.object({ type: z.literal("text"), text: z.string() });

const ToolUseBlockSchema = z.object({
  type: z.literal("tool_use"),
  id: z.string().min(1),
  name: z.string().min(1),
  input: z.record(z.unknown()).optional(),
});

const UnknownBlockSchema = z.object({ type: z.string() }).passthrough();

const AssistantSchema = z
  .object({
    type: z.literal("assistant"),
    message: z
      .object({
        content: z.array(z.union([TextBlockSchema, ToolUseBlockSchema, UnknownBlockSchema])),
      })
      .passthrough(),
  })
  .passthrough();

const ResultSchema = z
  .object({
    type: z.literal("result"),
    subtype: z.string().optional(),
    is_error: z.boolean().optional(),
    result: z.string().optional(),
  })
  .passthrough();

export const claudeCodeProtocol: HarnessProtocol = {
  id: CLAUDE_CODE_PROTOCOL_ID,

  describeTools(tools: readonly ToolDefinition[]): JsonValue {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    })) as unknown as JsonValue;
  },

  interpret(frame: HarnessFrame): readonly HarnessStep[] {
    const assistant = AssistantSchema.safeParse(frame);
    if (assistant.success) {
      const steps: HarnessStep[] = [];
      for (const block of assistant.data.message.content) {
        if (block.type === "text" && typeof (block as { text?: unknown }).text === "string") {
          steps.push({ type: "message", text: (block as { text: string }).text });
          continue;
        }
        const toolUse = ToolUseBlockSchema.safeParse(block);
        if (toolUse.success) {
          steps.push({
            type: "tool_call",
            callId: toolUse.data.id,
            tool: toolUse.data.name,
            arguments: (toolUse.data.input ?? {}) as JsonObject,
          });
        }
      }
      return steps;
    }

    const result = ResultSchema.safeParse(frame);
    if (result.success) {
      if (result.data.is_error === true || result.data.subtype === "error") {
        return [
          {
            type: "failed",
            error: {
              code: result.data.subtype ?? "harness_failed",
              message: result.data.result ?? "The Claude Code harness reported a failure.",
              retryable: true,
            },
          },
        ];
      }
      const text = result.data.result;
      return [text === undefined ? { type: "complete" } : { type: "complete", output: { text } }];
    }

    return [];
  },

  /**
   * A tool result goes back as a user message, which is how the Messages
   * protocol carries one. A denial is reported with `is_error`, so the harness
   * learns it was refused rather than being told the call crashed.
   */
  encodeToolResult(result: ToolResult): HarnessFrame {
    return {
      type: "user",
      message: {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: result.callId,
            is_error: result.status !== "succeeded",
            content: [{ type: "text", text: JSON.stringify(toolResultBody(result)) }],
          },
        ],
      },
    };
  },
};
