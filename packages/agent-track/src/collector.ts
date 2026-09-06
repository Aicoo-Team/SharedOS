import type { AuditEvent, AuditSink } from "@aicoo/sharedos-core";
import type { ExecutionResult } from "@aicoo/sharedos-contracts";

/**
 * A single turn's record, derived from execution events.
 */
export interface TurnRecord {
  readonly turnId: string;
  readonly agentId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly outcome: "complete" | "fail" | "escalate";
  readonly toolCalls: number;
  readonly denials: number;
  readonly escalations: number;
}

/**
 * In-memory store of audit events and turn records, keyed by agent ID.
 *
 * The store is a plain data structure with no logic. All analysis happens in
 * {@link analyzeTrackRecord}, keeping the collector a pure indexing layer.
 */
export interface TrackRecordStore {
  readonly events: Map<string, readonly AuditEvent[]>;
  readonly turns: Map<string, readonly TurnRecord[]>;
}

/**
 * An {@link AuditSink} wrapper that indexes events by the acting agent.
 *
 * Every event still reaches the inner sink. The collector adds an indexing
 * pass so the analyzer can read events per agent without scanning the full
 * stream.
 *
 * Turn records are ingested separately via {@link ingestTurnResult}, because
 * execution events live in `ExecutionResult.events[]` and not in the audit
 * stream.
 */
export class TrackRecordCollector implements AuditSink {
  readonly #inner: AuditSink;
  readonly #eventsByAgent = new Map<string, AuditEvent[]>();
  readonly #turnsByAgent = new Map<string, TurnRecord[]>();

  constructor(inner: AuditSink) {
    this.#inner = inner;
  }

  async record(event: AuditEvent): Promise<void> {
    await this.#inner.record(event);

    const agentId = extractAgentId(event.actor);
    if (agentId === undefined) {
      return;
    }

    let bucket = this.#eventsByAgent.get(agentId);
    if (bucket === undefined) {
      bucket = [];
      this.#eventsByAgent.set(agentId, bucket);
    }
    bucket.push(event);
  }

  /**
   * Ingest execution events from a completed turn.
   *
   * The executor writes `turn.started`, `tool.requested`, `tool.completed`,
   * and `turn.completed` into `ExecutionResult.events[]`. This method reads
   * those events and produces a {@link TurnRecord} for the analyzer.
   */
  ingestTurnResult(agentId: string, result: ExecutionResult): void {
    const events = result.events;
    let toolCalls = 0;
    let denials = 0;
    let escalations = 0;

    for (const event of events) {
      if (event.type === "tool.completed") {
        toolCalls += 1;
        const data = event.data as Record<string, unknown>;
        if (data.status === "denied") {
          denials += 1;
        }
      }
      if (event.type === "turn.escalated") {
        escalations += 1;
      }
    }

    let outcome: TurnRecord["outcome"];
    switch (result.status) {
      case "succeeded":
        outcome = "complete";
        break;
      case "escalated":
        outcome = "escalate";
        break;
      default:
        outcome = "fail";
        break;
    }

    const record: TurnRecord = {
      turnId: result.executionId,
      agentId,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      outcome,
      toolCalls,
      denials,
      escalations,
    };

    let bucket = this.#turnsByAgent.get(agentId);
    if (bucket === undefined) {
      bucket = [];
      this.#turnsByAgent.set(agentId, bucket);
    }
    bucket.push(record);
  }

  /**
   * Read-only access to the indexed store.
   */
  getStore(): TrackRecordStore {
    return {
      events: this.#eventsByAgent,
      turns: this.#turnsByAgent,
    };
  }
}

function extractAgentId(actor: {
  kind: string;
  userId?: string;
  agentId?: string;
  conversationId?: string;
  serviceId?: string;
}): string | undefined {
  if (actor.kind === "agent" && actor.agentId !== undefined) {
    return actor.agentId;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Standalone store — persistable independently of the collector
// ---------------------------------------------------------------------------

/**
 * JSON-serializable snapshot of a track record store.
 *
 * This is the wire format for persisting agent history to disk, a database,
 * or any host-owned storage. The store contains no logic — only facts the
 * kernel recorded.
 */
export interface SerializedTrackRecordStore {
  readonly version: "1";
  readonly events: Record<string, readonly AuditEvent[]>;
  readonly turns: Record<string, readonly TurnRecord[]>;
}

/**
 * Create an empty, standalone track record store.
 *
 * Use this when you want to accumulate events without wrapping an
 * `AuditSink` — for example, when building a store from a log file,
 * a database query, or a message queue.
 */
export function createTrackRecordStore(): TrackRecordStore {
  return {
    events: new Map(),
    turns: new Map(),
  };
}

/**
 * Add a single audit event to a standalone store, indexed by agent ID.
 */
export function addEvent(store: TrackRecordStore, event: AuditEvent): void {
  const agentId = extractAgentId(event.actor);
  if (agentId === undefined) {
    return;
  }

  let bucket = store.events.get(agentId);
  if (bucket === undefined) {
    bucket = [];
    store.events.set(agentId, bucket);
  }
  (bucket as AuditEvent[]).push(event);
}

/**
 * Add a turn record to a standalone store.
 */
export function addTurnRecord(store: TrackRecordStore, record: TurnRecord): void {
  let bucket = store.turns.get(record.agentId);
  if (bucket === undefined) {
    bucket = [];
    store.turns.set(record.agentId, bucket);
  }
  (bucket as TurnRecord[]).push(record);
}

/**
 * Serialize a track record store to a JSON-safe snapshot.
 *
 * The output can be written to disk with `JSON.stringify()` and restored
 * with {@link deserializeStore}.
 */
export function serializeStore(store: TrackRecordStore): SerializedTrackRecordStore {
  const events: Record<string, readonly AuditEvent[]> = {};
  for (const [agentId, list] of store.events) {
    events[agentId] = [...list];
  }

  const turns: Record<string, readonly TurnRecord[]> = {};
  for (const [agentId, list] of store.turns) {
    turns[agentId] = [...list];
  }

  return { version: "1", events, turns };
}

/**
 * Deserialize a JSON snapshot back into a track record store.
 *
 * Pairs with {@link serializeStore} for round-trip persistence.
 */
export function deserializeStore(snapshot: SerializedTrackRecordStore): TrackRecordStore {
  const events = new Map<string, AuditEvent[]>();
  for (const [agentId, list] of Object.entries(snapshot.events)) {
    events.set(agentId, [...list]);
  }

  const turns = new Map<string, TurnRecord[]>();
  for (const [agentId, list] of Object.entries(snapshot.turns)) {
    turns.set(agentId, [...list]);
  }

  return { events, turns };
}
