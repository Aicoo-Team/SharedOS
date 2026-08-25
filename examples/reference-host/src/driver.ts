/**
 * The model side of the integration: an `AgentTurnDriver` that speaks the
 * Anthropic Messages API. SharedOS hands the driver a filtered tool catalog
 * and re-authorises every call it makes, so the driver never sees grants.
 *
 * Set ANTHROPIC_API_KEY to run against a live model; otherwise a deterministic
 * planner drives the same interface so the demo stays reproducible.
 */
import { randomUUID } from "node:crypto";

import type { JsonObject, ToolDefinition } from "@aicoo/sharedos-contracts";
import type {
  AgentTurnDecision,
  AgentTurnDriver,
  AgentTurnInput,
  AgentTurnRequest,
  AgentTurnSession,
} from "@aicoo/sharedos-runtime";

const SYSTEM = [
  "You answer using ONLY what the provided tools return.",
  "Search before answering. Never answer from memory.",
  "If a tool is denied, say what you could not reach; do not guess around it.",
].join(" ");

export class AnthropicTurnDriver implements AgentTurnDriver {
  constructor(
    private readonly apiKey: string,
    private readonly model = "claude-sonnet-5",
  ) {}

  async open(request: AgentTurnRequest): Promise<AgentTurnSession> {
    const tools = request.tools.map(toAnthropicTool);
    const messages: Array<Record<string, unknown>> = [
      { role: "user", content: JSON.stringify(request.message.payload) },
    ];
    let pendingCallId: string | undefined;

    return {
      next: async (input: AgentTurnInput, signal: AbortSignal): Promise<AgentTurnDecision> => {
        if (input.type === "tool_result") {
          messages.push({
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: pendingCallId,
                is_error: input.result.status !== "succeeded",
                content: JSON.stringify(
                  input.result.status === "succeeded" ? input.result.output : input.result.error,
                ),
              },
            ],
          });
        }

        const response = await fetch(
          `${process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com"}/v1/messages`,
          {
            method: "POST",
            signal,
            headers: {
              "content-type": "application/json",
              "x-api-key": this.apiKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: this.model,
              max_tokens: 1024,
              system: SYSTEM,
              tools,
              messages,
            }),
          },
        );

        if (!response.ok) {
          return {
            type: "fail",
            error: { code: "model_error", message: `HTTP ${response.status}` },
          };
        }

        const payload = (await response.json()) as {
          content: Array<{
            type: string;
            text?: string;
            id?: string;
            name?: string;
            input?: JsonObject;
          }>;
        };
        messages.push({ role: "assistant", content: payload.content });

        const use = payload.content.find((block) => block.type === "tool_use");
        if (use?.name !== undefined) {
          pendingCallId = use.id;
          return {
            type: "tool_call",
            call: {
              id: use.id ?? randomUUID(),
              tool: use.name,
              arguments: use.input ?? {},
              traceId: request.context.traceId,
              requestedAt: new Date().toISOString(),
            },
          };
        }

        const text = payload.content
          .filter((block) => block.type === "text")
          .map((block) => block.text ?? "")
          .join("");
        return { type: "complete", output: { answer: text } };
      },
    };
  }
}

/** A scripted stand-in with the same decision surface, for runs without a key. */
export class ScriptedTurnDriver implements AgentTurnDriver {
  constructor(private readonly plan: ReadonlyArray<{ tool: string; arguments: JsonObject }>) {}

  async open(request: AgentTurnRequest): Promise<AgentTurnSession> {
    const visible = new Set(request.tools.map((tool) => tool.name));
    const observations: unknown[] = [];
    let index = 0;

    return {
      next: async (input: AgentTurnInput): Promise<AgentTurnDecision> => {
        if (input.type === "tool_result") {
          observations.push(
            input.result.status === "succeeded"
              ? { tool: input.result.tool, output: input.result.output }
              : { tool: input.result.tool, denied: input.result.error.code },
          );
        }

        while (index < this.plan.length) {
          const step = this.plan[index];
          index += 1;
          if (step === undefined) break;
          if (!visible.has(step.tool)) {
            observations.push({ tool: step.tool, notVisible: true });
            continue;
          }
          return {
            type: "tool_call",
            call: {
              id: randomUUID(),
              tool: step.tool,
              arguments: step.arguments,
              traceId: request.context.traceId,
              requestedAt: new Date().toISOString(),
            },
          };
        }

        return { type: "complete", output: { observations: observations as never } };
      },
    };
  }
}

function toAnthropicTool(tool: ToolDefinition): Record<string, unknown> {
  return { name: tool.name, description: tool.description, input_schema: tool.inputSchema };
}
