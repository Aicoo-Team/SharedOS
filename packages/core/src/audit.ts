import type { AccessContext, AuditEvent } from "@aicoo/sharedos-contracts";
import { deepFreeze } from "./internal.js";

export type {
  AuditEvent,
  AuditEventType,
  AuditOutcome,
  AuditSource,
} from "@aicoo/sharedos-contracts";

export interface AuditSink {
  record(event: AuditEvent): Promise<void>;
}

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
    version: "1",
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
