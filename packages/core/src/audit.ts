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
  | "resource.invoked"
  | "tool.catalog.listed"
  | "tool.namespace.catalog.listed"
  | "tool.namespace.selection.updated"
  | "tool.invoked"
  | "message.sent";

/**
 * `escalated` is its own outcome, not a denial.
 *
 * A denial is a decision SharedOS made. An escalation is a decision it declined
 * to make and handed to a human, and counting the two together would inflate
 * every denial rate by the cases where the system correctly asked for help.
 */
export type AuditOutcome = "allowed" | "denied" | "succeeded" | "failed" | "escalated";

export interface AuditEvent {
  readonly version: "1";
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
  readonly request?: CapabilityRequest;
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

export function auditEvent(
  context: AccessContext,
  event: Omit<
    AuditEvent,
    "version" | "at" | "traceId" | "namespaceId" | "actor" | "authority" | "owner" | "purpose"
  >,
): AuditEvent {
  return immutableAuditEvent({
    version: "1",
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

function immutableAuditEvent(event: AuditEvent): AuditEvent {
  return deepFreeze(structuredClone(event));
}
