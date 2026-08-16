import type { AccessContext, Address, JsonObject, ResourceRef } from "@aicoo/sharedos-contracts";

export type AuditEventType =
  | "authorization.checked"
  | "resource.invoked"
  | "tool.catalog.listed"
  | "tool.namespace.catalog.listed"
  | "tool.namespace.selection.updated"
  | "tool.invoked"
  | "message.sent";

export type AuditOutcome = "allowed" | "denied" | "succeeded" | "failed";

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
  readonly operationId?: string;
  readonly tool?: string;
  readonly messageId?: string;
  readonly receiver?: Address;
  readonly reason?: string;
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
      await sink.record(event);
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
  return {
    version: "1",
    at: context.now,
    traceId: context.traceId,
    namespaceId: context.namespaceId,
    actor: context.actor,
    authority: context.authority,
    owner: context.owner,
    purpose: context.purpose,
    ...event,
  };
}
