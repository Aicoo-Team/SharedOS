import type { Address } from "@aicoo/sharedos-contracts";
import type { AuditEvent } from "@aicoo/sharedos-core";
import type { Precedent, PrecedentLookup } from "@aicoo/sharedos-precedent";
import type { PrecedentKey } from "@aicoo/sharedos-precedent";

import type { TrackRecordStore } from "./collector.js";

/**
 * A track record precedent entry: a past authorization decision derived
 * from audit events.
 *
 * This is the track record's own representation. To use it with the
 * precedent package, convert via {@link toPrecedent} or
 * {@link toPrecedentLookup}.
 */
export interface TrackRecordPrecedent {
  readonly requestId: string;
  readonly tool: string;
  readonly action: string;
  readonly outcome: "allowed" | "denied";
  readonly reasonCode: string;
  readonly at: string;
  readonly agentId: string;
  readonly grantId?: string;
}

/**
 * Convert track record precedents from the analyzer into the format
 * expected by `@aicoo/sharedos-precedent`.
 *
 * Allowed events become `ApprovedPrecedent` stubs; denied events become
 * `RefusedPrecedent` stubs. The key dimensions (owner, requester, purpose,
 * capabilities) are inferred from the audit event.
 */
export function toPrecedent(
  entry: TrackRecordPrecedent,
  namespaceId: string,
  owner: Address,
): Precedent | undefined {
  if (entry.outcome === "allowed") {
    return {
      outcome: "approved",
      requestId: entry.requestId,
      key: {
        namespaceId,
        owner,
        requester: { kind: "agent", agentId: entry.agentId },
        purpose: "auto",
        capabilities: [
          {
            resource: { namespace: "auto", path: [entry.tool], owner },
            actions: [entry.action],
            scope: "exact" as const,
          },
        ],
      },
      capabilities: [
        {
          resource: { namespace: "auto", path: [entry.tool], owner },
          actions: [entry.action],
          scope: "exact" as const,
        },
      ],
      constraints: {},
      decidedAt: entry.at,
    };
  }

  // Refused
  return {
    outcome: "refused",
    requestId: entry.requestId,
    key: {
      namespaceId,
      owner,
      requester: { kind: "agent", agentId: entry.agentId },
      purpose: "auto",
      capabilities: [
        {
          resource: { namespace: "auto", path: [entry.tool], owner },
          actions: [entry.action],
          scope: "exact" as const,
        },
      ],
    },
    decidedAt: entry.at,
  };
}

/**
 * A `PrecedentLookup` implementation backed by a track record store.
 *
 * This bridges the two packages: track record audit events become
 * precedents the precedent package can load.
 *
 * @example
 * ```ts
 * const lookup = new TrackRecordPrecedentLookup(store, owner);
 * const precedents = await lookup.load("ns-1", ["req-1", "req-2"]);
 * ```
 */
export class TrackRecordPrecedentLookup implements PrecedentLookup {
  readonly #store: TrackRecordStore;
  readonly #owner: Address;

  constructor(store: TrackRecordStore, owner: Address, _namespaceId?: string) {
    this.#store = store;
    this.#owner = owner;
  }

  async load(namespaceId: string, requestIds: readonly string[]): Promise<readonly Precedent[]> {
    const results: Precedent[] = [];

    // Collect all authorization events across all agents
    for (const [, events] of this.#store.events) {
      for (const event of events) {
        if (event.type !== "authorization.checked") continue;

        // Match by grantId or tool+action as a proxy for request ID
        const matchesId =
          (event.grantId !== undefined && requestIds.includes(event.grantId)) ||
          requestIds.includes(`${event.tool ?? "unknown"}:${event.action ?? "unknown"}`);

        if (!matchesId) continue;

        const precedent = this.eventToPrecedent(event, namespaceId);
        if (precedent !== undefined) {
          results.push(precedent);
        }
      }
    }

    return results;
  }

  private eventToPrecedent(event: AuditEvent, namespaceId: string): Precedent | undefined {
    if (event.outcome === "allowed") {
      return {
        outcome: "approved",
        requestId: event.grantId ?? `${event.tool}:${event.action}`,
        key: this.buildKey(event, namespaceId),
        capabilities: [
          {
            resource: {
              namespace: namespaceId,
              path: [event.tool ?? "unknown"],
              owner: this.#owner,
            },
            actions: [event.action ?? "unknown"],
            scope: "exact" as const,
          },
        ],
        constraints: {},
        decidedAt: event.at,
      };
    }

    return {
      outcome: "refused",
      requestId: event.grantId ?? `${event.tool}:${event.action}`,
      key: this.buildKey(event, namespaceId),
      decidedAt: event.at,
    };
  }

  private buildKey(event: AuditEvent, namespaceId: string): PrecedentKey {
    return {
      namespaceId,
      owner: this.#owner,
      requester: event.actor,
      purpose: event.purpose,
      capabilities: [
        {
          resource: { namespace: namespaceId, path: [event.tool ?? "unknown"], owner: this.#owner },
          actions: [event.action ?? "unknown"],
          scope: "exact" as const,
        },
      ],
    };
  }
}

/**
 * Contextual summary for an auto-decision proposal, enriched with
 * track record data.
 */
export interface TrackRecordContext {
  readonly agentId: string;
  readonly tool: string;
  readonly action: string;
  /** The agent's overall authorization rate for this tool. */
  readonly toolAuthorizationRate: number;
  /** The agent's edge-probe score. */
  readonly edgeProbeScore: number;
  /** Number of past denials for this tool. */
  readonly pastDenials: number;
  /** Number of past allowances for this tool. */
  readonly pastAllowances: number;
  /** Whether the agent has retried after denial on this tool. */
  readonly retriedAfterDenial: boolean;
}

/**
 * Enrich an auto-decision proposal with track record context.
 *
 * Use this before calling `admitAutoDecision` to give the precedent
 * package additional context about the requesting agent's history.
 *
 * @param store - The track record store.
 * @param agentId - The agent making the request.
 * @param tool - The tool being requested.
 * @param action - The action being requested.
 */
export function enrichWithContext(
  store: TrackRecordStore,
  agentId: string,
  tool: string,
  action: string,
): TrackRecordContext {
  const events = store.events.get(agentId) ?? [];
  const authEvents = events.filter(
    (e) => e.type === "authorization.checked" && e.tool === tool && e.action === action,
  );

  const allowed = authEvents.filter((e) => e.outcome === "allowed").length;
  const denied = authEvents.filter((e) => e.outcome === "denied").length;
  const total = allowed + denied;

  // Check for retry-after-denial
  const deniedEvents = authEvents.filter((e) => e.outcome === "denied");
  const retriedAfterDenial = deniedEvents.some((d) => authEvents.some((e) => e.at > d.at));

  // Overall edge probe score for the agent
  const allAuthEvents = events.filter((e) => e.type === "authorization.checked");
  const allAllowed = allAuthEvents.filter((e) => e.outcome === "allowed").length;
  const allDenied = allAuthEvents.filter((e) => e.outcome === "denied").length;
  const allTotal = allAllowed + allDenied;
  const denialRatio = allTotal > 0 ? allDenied / allTotal : 0;

  return {
    agentId,
    tool,
    action,
    toolAuthorizationRate: total > 0 ? allowed / total : 1,
    edgeProbeScore: Math.min(1, denialRatio * 0.5),
    pastDenials: denied,
    pastAllowances: allowed,
    retriedAfterDenial,
  };
}
