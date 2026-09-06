import { analyzeTrackRecord, type AgentTrackRecord } from "./analyzer.js";
import type { TrackRecordStore } from "./collector.js";

/**
 * A structured diff between two agents' track records.
 */
export interface AgentDiff {
  readonly agentA: string;
  readonly agentB: string;
  readonly metrics: {
    readonly authorizationRate: { readonly a: number; readonly b: number; readonly delta: number };
    readonly escalationRate: { readonly a: number; readonly b: number; readonly delta: number };
    readonly edgeProbeScore: { readonly a: number; readonly b: number; readonly delta: number };
    readonly totalTurns: { readonly a: number; readonly b: number };
    readonly totalToolCalls: { readonly a: number; readonly b: number };
    readonly denialBreakdown: {
      readonly registration: { readonly a: number; readonly b: number };
      readonly capabilityGrant: { readonly a: number; readonly b: number };
      readonly infrastructure: { readonly a: number; readonly b: number };
      readonly productCeiling: { readonly a: number; readonly b: number };
    };
  };
  readonly precedents: {
    readonly a: { readonly allowed: number; readonly denied: number };
    readonly b: { readonly allowed: number; readonly denied: number };
  };
}

/**
 * Comparison result for multiple agents.
 */
export interface MultiAgentComparison {
  readonly agents: readonly AgentTrackRecord[];
  readonly pairwise: readonly AgentDiff[];
  readonly rankings: {
    readonly byAuthorizationRate: readonly { readonly agentId: string; readonly value: number }[];
    readonly byEdgeProbeScore: readonly { readonly agentId: string; readonly value: number }[];
    readonly byEscalationRate: readonly { readonly agentId: string; readonly value: number }[];
  };
}

/**
 * Compare multiple agents' track records side by side.
 *
 * Returns structured diffs between every pair of agents, plus rankings
 * on each key metric. Use this instead of printing side-by-side tables.
 *
 * @param store - The indexed audit events and turn records.
 * @param agentIds - At least two agent IDs to compare.
 * @param options - Optional time window filter.
 */
export function compareTrackRecords(
  store: TrackRecordStore,
  agentIds: readonly [string, string, ...string[]],
  options?: { readonly from?: string; readonly to?: string },
): MultiAgentComparison {
  const agents = agentIds.map((id) => analyzeTrackRecord(store, id, options));

  // Pairwise diffs
  const pairwise: AgentDiff[] = [];
  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      pairwise.push(diffTwo(agents[i]!, agents[j]!));
    }
  }

  // Rankings
  const byAuthorizationRate = [...agents]
    .map((a) => ({ agentId: a.agentId, value: a.summary.authorizationRate }))
    .sort((a, b) => b.value - a.value);

  const byEdgeProbeScore = [...agents]
    .map((a) => ({ agentId: a.agentId, value: a.summary.edgeProbeScore }))
    .sort((a, b) => b.value - a.value);

  const byEscalationRate = [...agents]
    .map((a) => ({ agentId: a.agentId, value: a.summary.escalationRate }))
    .sort((a, b) => b.value - a.value);

  return {
    agents,
    pairwise,
    rankings: { byAuthorizationRate, byEdgeProbeScore, byEscalationRate },
  };
}

function diffTwo(a: AgentTrackRecord, b: AgentTrackRecord): AgentDiff {
  return {
    agentA: a.agentId,
    agentB: b.agentId,
    metrics: {
      authorizationRate: {
        a: a.summary.authorizationRate,
        b: b.summary.authorizationRate,
        delta: a.summary.authorizationRate - b.summary.authorizationRate,
      },
      escalationRate: {
        a: a.summary.escalationRate,
        b: b.summary.escalationRate,
        delta: a.summary.escalationRate - b.summary.escalationRate,
      },
      edgeProbeScore: {
        a: a.summary.edgeProbeScore,
        b: b.summary.edgeProbeScore,
        delta: a.summary.edgeProbeScore - b.summary.edgeProbeScore,
      },
      totalTurns: { a: a.summary.totalTurns, b: b.summary.totalTurns },
      totalToolCalls: { a: a.summary.totalToolCalls, b: b.summary.totalToolCalls },
      denialBreakdown: {
        registration: {
          a: a.summary.denialBreakdown.registration,
          b: b.summary.denialBreakdown.registration,
        },
        capabilityGrant: {
          a: a.summary.denialBreakdown.capabilityGrant,
          b: b.summary.denialBreakdown.capabilityGrant,
        },
        infrastructure: {
          a: a.summary.denialBreakdown.infrastructure,
          b: b.summary.denialBreakdown.infrastructure,
        },
        productCeiling: {
          a: a.summary.denialBreakdown.productCeiling,
          b: b.summary.denialBreakdown.productCeiling,
        },
      },
    },
    precedents: {
      a: countPrecedents(a),
      b: countPrecedents(b),
    },
  };
}

function countPrecedents(record: AgentTrackRecord): {
  allowed: number;
  denied: number;
} {
  let allowed = 0;
  let denied = 0;
  for (const p of record.precedents) {
    if (p.outcome === "allowed") allowed++;
    else denied++;
  }
  return { allowed, denied };
}
