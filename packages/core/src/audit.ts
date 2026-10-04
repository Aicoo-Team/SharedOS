import { PROTOCOL_VERSION } from "@aicoo/sharedos-contracts";
import type { AccessContext, AuditEvent } from "@aicoo/sharedos-contracts";
import { deepFreeze } from "./internal.js";

export type {
  AuditEvent,
  AuditEventType,
  AuditOutcome,
  AuditSource,
} from "@aicoo/sharedos-contracts";

export interface AuditSink {
  /**
   * Resolve only after durable acceptance (possibly into a host outbox).
   * Delivery retries preserve the event ID and must deduplicate by that ID.
   * A rejection may be an ambiguous acknowledgement; it does not prove absence.
   */
  record(event: AuditEvent): Promise<void>;
}

/** Intentional test/development disposal; provides no durability or recovery. */
export class NoopAuditSink implements AuditSink {
  async record(_event: AuditEvent): Promise<void> {
    // Intentionally empty. Production hosts should install a durable sink.
  }
}

/** What an emitter states about one event; the kernel supplies the rest. */
export type AuditEventInput = Omit<
  AuditEvent,
  "version" | "id" | "at" | "traceId" | "namespaceId" | "actor" | "authority" | "owner" | "purpose"
>;

/**
 * One audit record, stamped from the trusted context.
 *
 * `createId` mints the record's identity. The default is a random UUID from
 * Web Crypto, so the kernel stays host-neutral; a host that needs a
 * deterministic trail -- a replayed fixture, a conformance run -- supplies its
 * own, and supplies one that never repeats, because two records with one id
 * are one record to every sink that deduplicates.
 */
export function auditEvent(
  context: AccessContext,
  event: AuditEventInput,
  createId: () => string = randomAuditEventId,
): AuditEvent {
  return immutableAuditEvent({
    version: PROTOCOL_VERSION,
    id: createId(),
    at: context.now,
    traceId: context.traceId,
    namespaceId: context.namespaceId,
    actor: context.actor,
    authority: context.authority,
    owner: context.owner,
    purpose: context.purpose,
    ...event,
  });
}

function randomAuditEventId(): string {
  return crypto.randomUUID();
}

function immutableAuditEvent(event: AuditEvent): AuditEvent {
  return deepFreeze(structuredClone(event));
}
