import type { AuditEvent } from "@aicoo/sharedos-core";

import type { SerializedTrackRecordStore, TrackRecordStore, TurnRecord } from "./collector.js";

/**
 * Port for a persistent storage backend.
 *
 * Implement this interface to store agent track records in SQLite, Postgres,
 * Redis, or any durable storage. The package ships with
 * {@link InMemoryTrackRecordAdapter} for tests and single-process hosts.
 */
export interface TrackRecordStoreAdapter {
  /** Load all events for one agent. */
  loadEvents(agentId: string): Promise<readonly AuditEvent[]>;
  /** Load all turn records for one agent. */
  loadTurns(agentId: string): Promise<readonly TurnRecord[]>;
  /** Load all agent IDs that have events. */
  listAgents(): Promise<readonly string[]>;
  /** Store a single event for one agent. */
  appendEvent(agentId: string, event: AuditEvent): Promise<void>;
  /** Store a single turn record for one agent. */
  appendTurn(record: TurnRecord): Promise<void>;
  /** Replace all data with a snapshot (for migration / restore). */
  replaceAll(snapshot: SerializedTrackRecordStore): Promise<void>;
  /** Export the full store as a snapshot. */
  exportAll(): Promise<SerializedTrackRecordStore>;
}

/**
 * An in-memory adapter suitable for tests and single-process hosts.
 */
export class InMemoryTrackRecordAdapter implements TrackRecordStoreAdapter {
  readonly #events = new Map<string, AuditEvent[]>();
  readonly #turns = new Map<string, TurnRecord[]>();

  async loadEvents(agentId: string): Promise<readonly AuditEvent[]> {
    return this.#events.get(agentId) ?? [];
  }

  async loadTurns(agentId: string): Promise<readonly TurnRecord[]> {
    return this.#turns.get(agentId) ?? [];
  }

  async listAgents(): Promise<readonly string[]> {
    const agents = new Set<string>([...this.#events.keys(), ...this.#turns.keys()]);
    return [...agents].sort();
  }

  async appendEvent(agentId: string, event: AuditEvent): Promise<void> {
    let bucket = this.#events.get(agentId);
    if (bucket === undefined) {
      bucket = [];
      this.#events.set(agentId, bucket);
    }
    bucket.push(structuredClone(event));
  }

  async appendTurn(record: TurnRecord): Promise<void> {
    let bucket = this.#turns.get(record.agentId);
    if (bucket === undefined) {
      bucket = [];
      this.#turns.set(record.agentId, bucket);
    }
    bucket.push(structuredClone(record));
  }

  async replaceAll(snapshot: SerializedTrackRecordStore): Promise<void> {
    this.#events.clear();
    this.#turns.clear();

    for (const [agentId, events] of Object.entries(snapshot.events)) {
      this.#events.set(agentId, [...events]);
    }
    for (const [agentId, turns] of Object.entries(snapshot.turns)) {
      this.#turns.set(agentId, [...turns]);
    }
  }

  async exportAll(): Promise<SerializedTrackRecordStore> {
    const events: Record<string, readonly AuditEvent[]> = {};
    for (const [agentId, list] of this.#events) {
      events[agentId] = [...list];
    }

    const turns: Record<string, readonly TurnRecord[]> = {};
    for (const [agentId, list] of this.#turns) {
      turns[agentId] = [...list];
    }

    return { version: "1", events, turns };
  }
}

/**
 * Load an adapter's data into a {@link TrackRecordStore} for analysis.
 *
 * Useful for bridging a persistent adapter to the analyzer functions.
 */
export async function loadStoreFromAdapter(
  adapter: TrackRecordStoreAdapter,
): Promise<TrackRecordStore> {
  const agents = await adapter.listAgents();
  const events = new Map<string, AuditEvent[]>();
  const turns = new Map<string, TurnRecord[]>();

  for (const agentId of agents) {
    events.set(agentId, [...(await adapter.loadEvents(agentId))]);
    turns.set(agentId, [...(await adapter.loadTurns(agentId))]);
  }

  return { events, turns };
}
