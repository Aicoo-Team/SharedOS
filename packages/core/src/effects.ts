import type { AuditEvent, ReplayKey } from "@aicoo/sharedos-contracts";
import type { AuditSink } from "./audit.js";
import type { GrantUsageStore } from "./authorization.js";
import type { ReplayClaim, ReplayStore } from "./replay.js";

/**
 * Recovery extends ReplayStore, not a second operation ledger. Each mutation is
 * a host transaction fenced by the original claim token. Timeouts are ambiguous.
 */
export interface EffectStore extends ReplayStore, Pick<GrantUsageStore, "getUsage"> {
  readonly effectAccounting: "1";
  /** Reserve capacity and attach it to the pending operation atomically. */
  reserveUsage(claim: ReplayClaim, grantId: string, maximumUses: number): Promise<boolean>;
  /** Commit capacity and mark possible effect BEFORE dispatch; append decision audit. */
  admitEffect(claim: ReplayClaim, audit: readonly AuditEvent[]): Promise<boolean>;
  /** Release ONLY a not-admitted reservation. Also fence future admission. */
  releaseUsage(claim: ReplayClaim, audit?: readonly AuditEvent[]): Promise<boolean>;
  /** Retain late outcomes even after cancellation settled the replay tombstone. */
  appendAudit(claim: ReplayClaim, event: AuditEvent): Promise<void>;
  /** Host recovery worker enumerates undelivered events, including terminal records. */
  pendingAudit(limit: number): Promise<readonly { key: ReplayKey; event: AuditEvent }[]>;
  acknowledgeAudit(key: ReplayKey, eventId: string): Promise<void>;
}

export function isEffectStore(store: ReplayStore | undefined): store is EffectStore {
  const candidate = store as Partial<EffectStore> | undefined;
  return (
    candidate?.effectAccounting === "1" &&
    [
      candidate.getUsage,
      candidate.reserveUsage,
      candidate.admitEffect,
      candidate.releaseUsage,
      candidate.appendAudit,
      candidate.pendingAudit,
      candidate.acknowledgeAudit,
    ].every((port) => typeof port === "function")
  );
}

/** At-least-once delivery: sinks must deduplicate by event.id. Never modifies usage. */
export async function reconcileAuditOutbox(
  store: EffectStore,
  sink: AuditSink,
  limit = 100,
): Promise<number> {
  if (!Number.isInteger(limit) || limit < 1) throw new TypeError("Invalid outbox batch size");
  let delivered = 0;
  for (const { key, event } of await store.pendingAudit(limit)) {
    await sink.record(event);
    await store.acknowledgeAudit(key, event.id);
    delivered++;
  }
  return delivered;
}
