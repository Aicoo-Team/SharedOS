import type {
  AccessContext,
  Address,
  CapabilityRequest,
  JsonObject,
  ResourceRef,
} from "@aicoo/sharedos-contracts";
import { deepFreeze } from "./internal.js";

export type AuditEventType =
  | "authority.resolved"
  | "authorization.checked"
  | "escalation.requested"
  /**
   * An escalation answered from precedent instead of by a person.
   *
   * Written by the host's control plane through `@aicoo/sharedos-precedent`,
   * never by a turn: the turn that escalated ended when it escalated. Its
   * outcome is `allowed` or `denied` -- a decision that was made -- and its
   * metadata names the matcher and the precedents cited, which is how an
   * operator selects everything one matcher produced. See ADR 0022 R4.
   */
  | "escalation.auto_decided"
  | "resource.invoked"
  | "tool.catalog.listed"
  | "tool.namespace.catalog.listed"
  | "tool.namespace.selection.updated"
  | "tool.invoked"
  | "message.sent"
  | "turn.ended";

/**
 * `escalated` is its own outcome, not a denial.
 *
 * A denial is a decision SharedOS made. An escalation is a decision it declined
 * to make and handed to a human, and counting the two together would inflate
 * every denial rate by the cases where the system correctly asked for help.
 */
export type AuditOutcome = "allowed" | "denied" | "succeeded" | "failed" | "escalated";

/**
 * Which enforcement boundary produced an operation or terminal event.
 *
 * Recorded in `metadata` on every one of them. It was free to infer until the
 * execution envelope began recording as well -- anything in audit was the
 * kernel's, because the envelope wrote nothing -- and the moment that stopped
 * being true it became a fact with nowhere to live. ADR 0012 keeps one refusal
 * vocabulary across both boundaries on purpose: a code says what was refused,
 * and this says who refused it (ADR 0023).
 */
export type AuditSource = "kernel" | "envelope";

export interface AuditEvent {
  readonly version: "1";
  /**
   * The identity of this record, unique among every record a kernel emits.
   *
   * Minted when the event is made and never derived from its content. Two
   * records may agree on every other field: `at` is the turn's instant rather
   * than the emission's, and a bare `authorize` carries no `operationId`, so
   * the same question asked twice in one turn is two records that read the
   * same. A durable sink that needs an idempotency key -- for a retried batch,
   * a replayed outbox -- keys on this and on nothing else. Keying on a hash of
   * the content drops every repeat as a duplicate, and a repeat is not a
   * duplicate: an agent that asked twice is an agent that asked twice.
   */
  readonly id: string;
  readonly type: AuditEventType;
  readonly outcome: AuditOutcome;
  readonly at: string;
  readonly traceId: string;
  readonly namespaceId: string;
  readonly actor: Address;
  readonly authority: Address;
  readonly owner: Address;
  readonly purpose: string;
  readonly resource?: ResourceRef;
  readonly action?: string;
  readonly grantId?: string;
  /**
   * Content identifier of the exact authority set the decision was made
   * against. A turn resolves authority once, so every decision in it carries the
   * same value; the `authority.resolved` event that opened the turn carries the
   * grant ids behind it.
   */
  readonly authorityHash?: string;
  readonly operationId?: string;
  readonly tool?: string;
  readonly messageId?: string;
  readonly receiver?: Address;
  readonly reason?: string;
  /**
   * The authority an escalation is asking for, when it names one.
   *
   * A first-class field rather than something folded into `metadata`, for the
   * same reason `resource` is: it is a contract type with its own schema, and a
   * reviewer's queue built from audit reads it directly rather than trusting
   * that an untyped bag holds the right shape (ADR 0019).
   */
  readonly requestedAuthority?: CapabilityRequest;
  readonly metadata?: JsonObject;
}

export interface AuditSink {
  record(event: AuditEvent): Promise<void>;
}

export class NoopAuditSink implements AuditSink {
  async record(_event: AuditEvent): Promise<void> {
    // Intentionally empty. Production hosts should install a durable sink.
  }
}

export class CompositeAuditSink implements AuditSink {
  readonly #sinks: readonly AuditSink[];

  constructor(sinks: readonly AuditSink[]) {
    this.#sinks = [...sinks];
  }

  async record(event: AuditEvent): Promise<void> {
    for (const sink of this.#sinks) {
      await sink.record(immutableAuditEvent(event));
    }
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
