import type { AuditEvent } from "@aicoo/sharedos-core";

import type { TrackRecordStore } from "./collector.js";

/**
 * Per-tool statistics for one agent.
 */
export interface ToolStats {
  readonly tool: string;
  readonly totalAttempts: number;
  readonly allowed: number;
  readonly denied: number;
  readonly authorizationRate: number;
  readonly retriedAfterDenial: boolean;
  readonly denialReasons: readonly string[];
}

/**
 * Complete tool-level breakdown for an agent.
 */
export interface ToolBreakdown {
  readonly agentId: string;
  readonly tools: readonly ToolStats[];
  readonly summary: {
    readonly uniqueToolsAttempted: number;
    readonly uniqueToolsDenied: number;
    readonly mostAttemptedTool: string | undefined;
    readonly mostDeniedTool: string | undefined;
  };
}

/**
 * Compute per-tool authorization statistics for one agent.
 *
 * Unlike the per-agent summary, this breaks down which specific tools
 * the agent attempted, which were allowed, and which were denied.
 *
 * @param store - The indexed audit events.
 * @param agentId - The agent to analyze.
 * @param options - Optional time window filter.
 */
export function computeToolBreakdown(
  store: TrackRecordStore,
  agentId: string,
  options?: { readonly from?: string; readonly to?: string },
): ToolBreakdown {
  const events = store.events.get(agentId) ?? [];
  const authEvents = events.filter((e) => e.type === "authorization.checked");

  const filtered =
    options?.from !== undefined || options?.to !== undefined
      ? authEvents.filter((e) => {
          if (options?.from !== undefined && e.at < options.from) return false;
          if (options?.to !== undefined && e.at > options.to) return false;
          return true;
        })
      : authEvents;

  // Build a map from resource+action to tool name using tool.invoked events
  const toolByResourceAction = new Map<string, string>();
  for (const event of events) {
    if (event.type === "tool.invoked" && event.tool !== undefined && event.resource !== undefined) {
      const key = `${event.resource.namespace}:${event.resource.path.join("/")}:${event.action ?? ""}`;
      toolByResourceAction.set(key, event.tool);
    }
  }

  // Group by tool (correlating with tool.invoked events if needed)
  const byTool = new Map<string, AuditEvent[]>();
  for (const event of filtered) {
    let toolName = event.tool;
    if (toolName === undefined && event.resource !== undefined) {
      const key = `${event.resource.namespace}:${event.resource.path.join("/")}:${event.action ?? ""}`;
      toolName = toolByResourceAction.get(key);
    }
    const tool = toolName ?? event.resource?.path?.[0] ?? "unknown";

    let bucket = byTool.get(tool);
    if (bucket === undefined) {
      bucket = [];
      byTool.set(tool, bucket);
    }
    bucket.push(event);
  }

  const tools: ToolStats[] = [];
  for (const [tool, toolEvents] of byTool) {
    const allowed = toolEvents.filter((e) => e.outcome === "allowed").length;
    const denied = toolEvents.filter((e) => e.outcome === "denied").length;
    const total = allowed + denied;

    // Check if the agent retried after a denial on this tool
    const retriedAfterDenial = checkRetry(toolEvents);

    // Collect unique denial reasons
    const denialReasons = [
      ...new Set(
        toolEvents
          .filter((e) => e.outcome === "denied" && e.reason !== undefined)
          .map((e) => e.reason!),
      ),
    ];

    tools.push({
      tool,
      totalAttempts: total,
      allowed,
      denied,
      authorizationRate: total > 0 ? allowed / total : 1,
      retriedAfterDenial,
      denialReasons,
    });
  }

  // Sort by total attempts descending
  tools.sort((a, b) => b.totalAttempts - a.totalAttempts);

  const uniqueToolsAttempted = tools.length;
  const uniqueToolsDenied = tools.filter((t) => t.denied > 0).length;
  const mostAttemptedTool = tools.length > 0 ? tools[0]!.tool : undefined;
  const mostDeniedTool = [...tools]
    .sort((a, b) => b.denied - a.denied)
    .find((t) => t.denied > 0)?.tool;

  return {
    agentId,
    tools,
    summary: {
      uniqueToolsAttempted,
      uniqueToolsDenied,
      mostAttemptedTool,
      mostDeniedTool,
    },
  };
}

function checkRetry(toolEvents: readonly AuditEvent[]): boolean {
  const denied = toolEvents.filter((e) => e.outcome === "denied");
  const all = toolEvents;

  for (const d of denied) {
    const laterAttempt = all.some((e) => e.at > d.at);
    if (laterAttempt) return true;
  }
  return false;
}
