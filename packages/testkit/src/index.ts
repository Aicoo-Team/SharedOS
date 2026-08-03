import type {
  AccessContext,
  Address,
  Capability,
  CapabilityGrant,
  JsonValue,
  MessageDeliveryResult,
  MessageEnvelope,
  ResourceOperation,
  ResourceResult,
} from "@sharedos/contracts";
import {
  CapabilityAuthorizer,
  InMemoryGrantUsageStore,
  SharedOSKernel,
  type AuditEvent,
  type AuditSink,
  type MessageTransport,
  type ResourceProvider,
} from "@sharedos/core";

export class InMemoryAuditSink implements AuditSink {
  readonly events: AuditEvent[] = [];

  async record(event: AuditEvent): Promise<void> {
    this.events.push(structuredClone(event));
  }
}

export class InMemoryMessageTransport implements MessageTransport {
  readonly deliveries: Array<{ context: AccessContext; envelope: MessageEnvelope }> = [];

  async deliver(context: AccessContext, envelope: MessageEnvelope): Promise<MessageDeliveryResult> {
    this.deliveries.push({
      context: structuredClone(context),
      envelope: structuredClone(envelope),
    });
    return {
      messageId: envelope.id,
      status: "accepted",
      timestamp: context.now,
    };
  }
}

export type ResourceHandler = (operation: ResourceOperation) => Promise<ResourceResult>;

/** A host-neutral recording provider for examples, conformance tests, and PACT worlds. */
export class InMemoryResourceProvider implements ResourceProvider {
  readonly namespace: string;
  readonly operations: ResourceOperation[] = [];
  readonly #handler: ResourceHandler;

  constructor(namespace: string, handler: ResourceHandler = echoResourceOperation) {
    this.namespace = namespace;
    this.#handler = handler;
  }

  async invoke(operation: ResourceOperation): Promise<ResourceResult> {
    this.operations.push(structuredClone(operation));
    return this.#handler(operation);
  }
}

export interface TestKernel {
  readonly kernel: SharedOSKernel;
  readonly audit: InMemoryAuditSink;
  readonly messages: InMemoryMessageTransport;
}

export function createTestKernel(): TestKernel {
  const audit = new InMemoryAuditSink();
  const messages = new InMemoryMessageTransport();
  return {
    kernel: new SharedOSKernel({
      audit,
      authorizer: new CapabilityAuthorizer({ usageStore: new InMemoryGrantUsageStore() }),
      messageTransport: messages,
    }),
    audit,
    messages,
  };
}

export interface TestContextOptions {
  readonly actor?: Address;
  readonly authority?: Address;
  readonly owner?: Address;
  readonly namespaceId?: string;
  readonly purpose?: string;
  readonly traceId?: string;
  readonly grants?: readonly CapabilityGrant[];
  readonly now?: string;
}

export function createTestContext(options: TestContextOptions = {}): AccessContext {
  const owner = options.owner ?? { kind: "human", userId: "owner-1" };
  return {
    actor: options.actor ?? { kind: "agent", agentId: "agent-1" },
    authority: options.authority ?? owner,
    owner,
    namespaceId: options.namespaceId ?? "namespace-1",
    purpose: options.purpose ?? "test",
    traceId: options.traceId ?? "trace-1",
    grants: [...(options.grants ?? [])],
    now: options.now ?? "2026-01-01T00:00:00.000Z",
  };
}

export interface TestGrantOptions {
  readonly id?: string;
  readonly namespaceId?: string;
  readonly subject?: Address;
  readonly issuer?: Address;
  readonly capabilities: readonly Capability[];
  readonly purposes?: readonly string[];
  readonly issuedAt?: string;
  readonly expiresAt?: string;
}

export function createTestGrant(options: TestGrantOptions): CapabilityGrant {
  const constraints = {
    ...(options.purposes === undefined ? {} : { purposes: [...options.purposes] }),
    ...(options.expiresAt === undefined ? {} : { expiresAt: options.expiresAt }),
  };
  return {
    id: options.id ?? "grant-1",
    namespaceId: options.namespaceId ?? "namespace-1",
    subject: options.subject ?? { kind: "agent", agentId: "agent-1" },
    issuer: options.issuer ?? { kind: "human", userId: "owner-1" },
    capabilities: [...options.capabilities],
    constraints,
    issuedAt: options.issuedAt ?? "2026-01-01T00:00:00.000Z",
  };
}

async function echoResourceOperation(operation: ResourceOperation): Promise<ResourceResult> {
  const output: JsonValue = {
    namespaceId: operation.context.namespaceId,
    resource: {
      namespace: operation.resource.namespace,
      path: operation.resource.path,
      ...(operation.resource.owner === undefined ? {} : { owner: operation.resource.owner }),
    },
    action: operation.action,
    ...(operation.input === undefined ? {} : { input: operation.input }),
  };
  return {
    operationId: operation.operationId,
    status: "succeeded",
    output,
    completedAt: operation.context.now,
  };
}
