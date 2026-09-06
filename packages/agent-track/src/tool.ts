import type { AccessContext, JsonObject, ToolCall, ToolResult } from "@aicoo/sharedos-contracts";
import type { ToolHandler } from "@aicoo/sharedos-core";

import { analyzeTrackRecord, type AgentTrackRecord } from "./analyzer.js";
import type { TrackRecordCollector } from "./collector.js";

/**
 * The tool definition for `agent.trackRecord`.
 *
 * This is a read-only tool that returns an agent's full track record.
 * It requires the caller to hold a grant over `agent / trackRecord / read`.
 */
export const AGENT_TRACK_RECORD_DEFINITION = {
  name: "agent.trackRecord",
  description:
    "Query an agent's track record — authorization history, escalation patterns, gate refusals, and edge-probing score. Derived entirely from kernel-recorded facts, not self-reported.",
  namespace: "agent",
  source: "sharedos",
  readWrite: "read",
  inputSchema: {
    type: "object",
    properties: {
      agentId: {
        type: "string",
        description: "The agent ID to query",
      },
      from: {
        type: "string",
        description: "Start of time window (ISO 8601)",
      },
      to: {
        type: "string",
        description: "End of time window (ISO 8601)",
      },
    },
    required: ["agentId"],
  } as JsonObject,
  requiredCapability: {
    resource: { namespace: "agent", path: ["trackRecord"] },
    action: "read",
  },
};

interface TrackRecordArgs {
  agentId: string;
  from?: string;
  to?: string;
}

/**
 * Create a {@link ToolHandler} for `agent.trackRecord`.
 *
 * The handler reads from the collector's store and runs the analyzer.
 * It is a factory because the handler needs a reference to the collector,
 * which is wired externally.
 */
export function agentTrackRecordTool(collector: TrackRecordCollector): ToolHandler {
  return {
    definition: AGENT_TRACK_RECORD_DEFINITION as ToolHandler["definition"],

    parseArguments(args: JsonObject): TrackRecordArgs {
      return {
        agentId: args.agentId as string,
        ...(args.from !== undefined ? { from: args.from as string } : {}),
        ...(args.to !== undefined ? { to: args.to as string } : {}),
      };
    },

    async invoke(
      _context: AccessContext,
      call: ToolCall,
      _signal: AbortSignal,
    ): Promise<ToolResult> {
      const parsed = JSON.parse(JSON.stringify(call.arguments)) as Record<string, unknown>;
      const agentId = parsed.agentId as string;
      const from = typeof parsed.from === "string" ? parsed.from : undefined;
      const to = typeof parsed.to === "string" ? parsed.to : undefined;

      const options: { from?: string; to?: string } = {};
      if (from !== undefined) {
        options.from = from;
      }
      if (to !== undefined) {
        options.to = to;
      }

      const record: AgentTrackRecord = analyzeTrackRecord(collector.getStore(), agentId, options);

      return {
        callId: call.id,
        tool: call.tool,
        status: "succeeded",
        output: record as unknown as JsonObject,
        completedAt: new Date().toISOString(),
      };
    },
  };
}
