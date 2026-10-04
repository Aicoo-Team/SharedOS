import type { AuditEvent, JsonValue, ReplayKey, ReplayRecord } from "@aicoo/sharedos-contracts";
import { AuditEventSchema, ReplayRecordSchema } from "@aicoo/sharedos-contracts";
import type { EffectStore } from "./effects.js";
import { canonicalReplayJson, type ReplayClaim } from "./replay.js";

/** @internal Shared process-local fixture implementation. Production storage belongs to hosts. */
export class MemoryEffectStore implements EffectStore {
  readonly effectAccounting = "1" as const;
  readonly #records = new Map<string, ReplayRecord>();

  async claim(
    key: ReplayKey,
    fingerprint: string,
  ): Promise<{ claimed: boolean; record: ReplayRecord }> {
    const identity = canonicalReplayJson(key);
    const existing = this.#records.get(identity);
    if (existing !== undefined) return { claimed: false, record: structuredClone(existing) };
    const record = ReplayRecordSchema.parse({
      key,
      fingerprint,
      token: crypto.randomUUID(),
      state: "pending",
    });
    this.#records.set(identity, record);
    return { claimed: true, record: structuredClone(record) };
  }

  async getUsage(namespaceId: string, grantId: string): Promise<number> {
    let count = 0;
    for (const record of this.#records.values()) {
      if (
        record.key.namespaceId === namespaceId &&
        record.effect?.grantId === grantId &&
        record.effect.state !== "released"
      )
        count++;
    }
    return count;
  }

  async reserveUsage(claim: ReplayClaim, grantId: string, maximumUses: number): Promise<boolean> {
    const record = this.#owned(claim);
    if (record === undefined || record.state !== "pending") return false;
    if (record.effect !== undefined)
      return (
        record.effect.state === "reserved" &&
        record.effect.grantId === grantId &&
        record.effect.maximumUses === maximumUses
      );
    if (!Number.isInteger(maximumUses) || maximumUses < 1)
      throw new TypeError("Invalid maximumUses");
    // No await between capacity check and reservation: one atomic fixture mutation.
    let count = 0;
    for (const candidate of this.#records.values()) {
      if (
        candidate.key.namespaceId === claim.key.namespaceId &&
        candidate.effect?.grantId === grantId &&
        candidate.effect.state !== "released"
      )
        count++;
    }
    if (count >= maximumUses) return false;
    const next = ReplayRecordSchema.parse({
      ...record,
      effect: { state: "reserved", grantId, maximumUses },
    });
    this.#records.set(canonicalReplayJson(claim.key), next);
    return true;
  }

  async admitEffect(claim: ReplayClaim, audit: readonly AuditEvent[]): Promise<boolean> {
    const record = this.#owned(claim);
    if (record === undefined || record.state !== "pending" || record.effect?.state === "released")
      return false;
    const next = ReplayRecordSchema.parse({
      ...record,
      effect: { ...record.effect, state: "admitted" },
    });
    this.#append(next, audit);
    this.#records.set(canonicalReplayJson(claim.key), next);
    return true;
  }

  async releaseUsage(claim: ReplayClaim, audit: readonly AuditEvent[] = []): Promise<boolean> {
    const record = this.#owned(claim);
    if (record === undefined || record.effect?.state === "admitted") return false;
    const next = ReplayRecordSchema.parse({
      ...record,
      effect: { ...record.effect, state: "released" },
    });
    this.#append(next, audit);
    this.#records.set(canonicalReplayJson(claim.key), next);
    return true;
  }

  async settle(
    key: ReplayKey,
    token: string,
    outcome: {
      readonly state: "completed" | "failed" | "interrupted";
      readonly result?: JsonValue;
      readonly audit?: readonly AuditEvent[];
    },
  ): Promise<boolean> {
    const record = this.#owned({ key, token, audit: [] });
    if (record === undefined || record.state !== "pending") return false;
    const { audit, ...terminal } = outcome;
    const next = ReplayRecordSchema.parse({ ...record, ...structuredClone(terminal) });
    this.#append(next, audit ?? []);
    this.#records.set(canonicalReplayJson(key), next);
    return true;
  }

  async appendAudit(claim: ReplayClaim, event: AuditEvent): Promise<void> {
    const record = this.#owned(claim);
    if (record === undefined) throw new Error("Lost operation claim");
    this.#append(record, [event]);
  }

  async pendingAudit(limit: number): Promise<readonly { key: ReplayKey; event: AuditEvent }[]> {
    const pending: { key: ReplayKey; event: AuditEvent }[] = [];
    for (const record of this.#records.values()) {
      for (const event of record.pendingAudit ?? []) {
        if (pending.length >= limit) return pending;
        pending.push(structuredClone({ key: record.key, event }));
      }
    }
    return pending;
  }

  async acknowledgeAudit(key: ReplayKey, eventId: string): Promise<void> {
    const record = this.#records.get(canonicalReplayJson(key));
    if (record !== undefined)
      record.pendingAudit = (record.pendingAudit ?? []).filter((event) => event.id !== eventId);
  }

  /** Only for fixtures and migration probes: an intentional legacy committed use. */
  async tryConsume(namespaceId: string, grantId: string, maximumUses: number): Promise<boolean> {
    const key: ReplayKey = {
      namespaceId,
      kind: "resource",
      scope: "legacy-usage-fixture",
      id: crypto.randomUUID(),
    };
    const { record } = await this.claim(key, "0".repeat(64));
    const claim: ReplayClaim = { key, token: record.token, audit: [] };
    if (!(await this.reserveUsage(claim, grantId, maximumUses))) return false;
    return this.admitEffect(claim, []);
  }

  /** Never drop an unresolved record or its pending outbox. */
  expire(key: ReplayKey): boolean {
    const record = this.#records.get(canonicalReplayJson(key));
    if (record === undefined || record.state === "pending") return false;
    const { result: _result, ...retained } = record;
    this.#records.set(canonicalReplayJson(key), { ...retained, state: "expired" });
    return true;
  }

  #owned(claim: ReplayClaim): ReplayRecord | undefined {
    const record = this.#records.get(canonicalReplayJson(claim.key));
    return record?.token === claim.token ? record : undefined;
  }

  #append(record: ReplayRecord, events: readonly AuditEvent[]): void {
    const validated = AuditEventSchema.array().parse(events);
    const pending = [...(record.pendingAudit ?? [])];
    const ids = new Set(pending.map((event) => event.id));
    for (const event of validated)
      if (!ids.has(event.id)) {
        pending.push(structuredClone(event));
        ids.add(event.id);
      }
    record.pendingAudit = pending;
  }
}
