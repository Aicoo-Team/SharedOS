import type { AuditEvent } from "@aicoo/sharedos-core";

import type { GateDenialBreakdown } from "./analyzer.js";
import type { TurnRecord } from "./collector.js";

/**
 * Incrementally updated metrics for one agent.
 *
 * Unlike {@link analyzeTrackRecord} which recomputes from scratch on every
 * call, a streaming tracker updates its counters as events arrive. This is
 * more efficient for high-throughput deployments where events arrive
 * continuously.
 */
export class StreamingAgentTracker {
  readonly #agentId: string;
  #totalAllowed = 0;
  #totalDenied = 0;
  #totalToolCalls = 0;
  #totalEscalations = 0;
  #totalTurns = 0;
  #denialRegistration = 0;
  #denialCapabilityGrant = 0;
  #denialInfrastructure = 0;
  #denialProductCeiling = 0;
  #recentEvents: Array<{ tool: string; outcome: string; at: string }> = [];
  readonly #maxRecentEvents: number;

  constructor(agentId: string, options?: { readonly maxRecentEvents?: number }) {
    this.#agentId = agentId;
    this.#maxRecentEvents = options?.maxRecentEvents ?? 100;
  }

  get agentId(): string {
    return this.#agentId;
  }

  /**
   * Process an audit event. Call this for every event that belongs to this agent.
   */
  pushEvent(event: AuditEvent): void {
    if (event.type === "authorization.checked") {
      if (event.outcome === "allowed") {
        this.#totalAllowed += 1;
      } else if (event.outcome === "denied") {
        this.#totalDenied += 1;
        const category = classifyDenial(event.reason ?? "");
        if (category === "registration") this.#denialRegistration += 1;
        else if (category === "capabilityGrant") this.#denialCapabilityGrant += 1;
        else if (category === "infrastructure") this.#denialInfrastructure += 1;
        else this.#denialProductCeiling += 1;
      }

      // Track recent events for retry detection
      if (event.tool !== undefined) {
        this.#recentEvents.push({
          tool: event.tool,
          outcome: event.outcome,
          at: event.at,
        });
        if (this.#recentEvents.length > this.#maxRecentEvents) {
          this.#recentEvents.shift();
        }
      }
    }
  }

  /**
   * Process a turn record. Call this when a turn completes.
   */
  pushTurn(turn: TurnRecord): void {
    this.#totalTurns += 1;
    this.#totalToolCalls += turn.toolCalls;
    this.#totalEscalations += turn.escalations;
  }

  /**
   * Get a snapshot of the current metrics.
   */
  snapshot(): StreamingSnapshot {
    const totalAuth = this.#totalAllowed + this.#totalDenied;
    const authorizationRate = totalAuth > 0 ? this.#totalAllowed / totalAuth : 1;
    const escalationRate = this.#totalTurns > 0 ? this.#totalEscalations / this.#totalTurns : 0;

    const denialRatio = totalAuth > 0 ? this.#totalDenied / totalAuth : 0;
    const retryScore = this.#computeRetryScore();
    const edgeProbeScore = Math.min(1, denialRatio * 0.5 + retryScore * 0.3 + escalationRate * 0.2);

    return {
      agentId: this.#agentId,
      authorizationRate,
      escalationRate,
      edgeProbeScore,
      totalAllowed: this.#totalAllowed,
      totalDenied: this.#totalDenied,
      totalToolCalls: this.#totalToolCalls,
      totalTurns: this.#totalTurns,
      denialBreakdown: {
        registration: this.#denialRegistration,
        capabilityGrant: this.#denialCapabilityGrant,
        infrastructure: this.#denialInfrastructure,
        productCeiling: this.#denialProductCeiling,
      },
    };
  }

  #computeRetryScore(): number {
    const recent = this.#recentEvents;
    const denied = recent.filter((e) => e.outcome === "denied");
    if (denied.length === 0) return 0;

    let retries = 0;
    for (const d of denied) {
      const laterAttempt = recent.some((e) => e.tool === d.tool && e.at > d.at);
      if (laterAttempt) retries += 1;
    }
    return Math.min(1, retries / denied.length);
  }
}

/**
 * Snapshot of streaming metrics at a point in time.
 */
export interface StreamingSnapshot {
  readonly agentId: string;
  readonly authorizationRate: number;
  readonly escalationRate: number;
  readonly edgeProbeScore: number;
  readonly totalAllowed: number;
  readonly totalDenied: number;
  readonly totalToolCalls: number;
  readonly totalTurns: number;
  readonly denialBreakdown: GateDenialBreakdown;
}

/**
 * Multi-agent streaming tracker.
 *
 * Tracks multiple agents incrementally, producing updated snapshots
 * on demand without full recomputation.
 */
export class StreamingTracker {
  readonly #trackers = new Map<string, StreamingAgentTracker>();

  /**
   * Process an audit event, routing it to the correct agent's tracker.
   */
  pushEvent(event: AuditEvent): void {
    const agentId = extractAgentId(event);
    if (agentId === undefined) return;

    let tracker = this.#trackers.get(agentId);
    if (tracker === undefined) {
      tracker = new StreamingAgentTracker(agentId);
      this.#trackers.set(agentId, tracker);
    }
    tracker.pushEvent(event);
  }

  /**
   * Process a turn record.
   */
  pushTurn(turn: TurnRecord): void {
    let tracker = this.#trackers.get(turn.agentId);
    if (tracker === undefined) {
      tracker = new StreamingAgentTracker(turn.agentId);
      this.#trackers.set(turn.agentId, tracker);
    }
    tracker.pushTurn(turn);
  }

  /**
   * Get a snapshot for one agent.
   */
  snapshot(agentId: string): StreamingSnapshot | undefined {
    return this.#trackers.get(agentId)?.snapshot();
  }

  /**
   * Get snapshots for all tracked agents.
   */
  allSnapshots(): readonly StreamingSnapshot[] {
    return [...this.#trackers.values()].map((t) => t.snapshot());
  }

  /**
   * List all tracked agent IDs.
   */
  agents(): readonly string[] {
    return [...this.#trackers.keys()].sort();
  }
}

function extractAgentId(event: AuditEvent): string | undefined {
  if (event.actor.kind === "agent" && event.actor.agentId !== undefined) {
    return event.actor.agentId;
  }
  return undefined;
}

function classifyDenial(
  reason: string,
): "registration" | "productCeiling" | "infrastructure" | "capabilityGrant" {
  if (reason.includes("tool_unavailable") || reason.includes("namespace_disabled")) {
    return "registration";
  }
  if (reason.includes("host_policy_denied") || reason.includes("host_policy_unavailable")) {
    return "productCeiling";
  }
  if (
    reason.includes("usage_store_unavailable") ||
    reason.includes("authority_unavailable") ||
    reason.includes("delegation_chain")
  ) {
    return "infrastructure";
  }
  return "capabilityGrant";
}
