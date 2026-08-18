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
  ToolNamespace,
  ToolNamespaceUpdate,
} from "@aicoo/sharedos-contracts";
import {
  CapabilityAuthorizer,
  InMemoryGrantUsageStore,
  SharedOSKernel,
  applyToolNamespaceUpdate,
  type AuditEvent,
  type AuditSink,
  type DelegationChainResolver,
  type GrantSource,
  type MessageTransport,
  type ResourceProvider,
  type ToolNamespaceSettingsStore,
} from "@aicoo/sharedos-core";

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

/** Namespace settings fixture keyed by the access-context namespace/world. */
export class InMemoryToolNamespaceSettingsStore implements ToolNamespaceSettingsStore {
  readonly #enabledByNamespace = new Map<string, ToolNamespace[]>();

  constructor(initial: Readonly<Record<string, readonly ToolNamespace[]>> = {}) {
    for (const [namespaceId, enabled] of Object.entries(initial)) {
      this.#enabledByNamespace.set(namespaceId, [...enabled]);
    }
  }

  async applyUpdate(
    context: AccessContext,
    update: ToolNamespaceUpdate,
  ): Promise<readonly ToolNamespace[]> {
    await Promise.resolve();
    const current =
      this.#enabledByNamespace.get(context.namespaceId) ?? context.enabledToolNamespaces;
    const next = applyToolNamespaceUpdate(current, update);
    this.#enabledByNamespace.set(context.namespaceId, next);
    return [...next];
  }

  get(namespaceId: string): readonly ToolNamespace[] {
    return [...(this.#enabledByNamespace.get(namespaceId) ?? [])];
  }
}

/**
 * A host grant store fixture.
 *
 * `load` answers only with grants issued to the context's actor by its
 * authority inside its namespace, which is the contract every production
 * `GrantSource` must satisfy.
 */
export class InMemoryGrantSource implements GrantSource {
  readonly #grants: CapabilityGrant[] = [];

  constructor(grants: readonly CapabilityGrant[] = []) {
    for (const grant of grants) {
      this.add(grant);
    }
  }

  add(...grants: readonly CapabilityGrant[]): this {
    for (const grant of grants) {
      this.#grants.push(structuredClone(grant));
    }
    return this;
  }

  /** Record a revocation the way a host store would, without deleting history. */
  revoke(grantId: string, revokedAt: string): this {
    const index = this.#grants.findIndex((grant) => grant.id === grantId);
    const grant = this.#grants[index];
    if (grant === undefined) {
      throw new Error(`grant is not registered: ${grantId}`);
    }
    this.#grants[index] = { ...grant, revokedAt };
    return this;
  }

  async load(context: AccessContext): Promise<readonly CapabilityGrant[]> {
    await Promise.resolve();
    return this.#grants
      .filter(
        (grant) =>
          grant.namespaceId === context.namespaceId &&
          sameAddress(grant.subject, context.actor) &&
          sameAddress(grant.issuer, context.authority),
      )
      .map((grant) => structuredClone(grant));
  }
}

/** A grant store that is down; every decision made against it must fail closed. */
export class UnavailableGrantSource implements GrantSource {
  async load(): Promise<readonly CapabilityGrant[]> {
    await Promise.resolve();
    throw new Error("grant source is unavailable");
  }
}

/** Namespace-scoped ancestor lookup for delegated-grant fixtures. */
export class InMemoryGrantChainResolver implements DelegationChainResolver {
  readonly #grantsByNamespace = new Map<string, Map<string, CapabilityGrant>>();

  constructor(grants: readonly CapabilityGrant[] = []) {
    for (const grant of grants) {
      this.add(grant);
    }
  }

  add(grant: CapabilityGrant): this {
    let namespaceGrants = this.#grantsByNamespace.get(grant.namespaceId);
    if (namespaceGrants === undefined) {
      namespaceGrants = new Map<string, CapabilityGrant>();
      this.#grantsByNamespace.set(grant.namespaceId, namespaceGrants);
    }
    namespaceGrants.set(grant.id, structuredClone(grant));
    return this;
  }

  /** Record a revocation the way a host grant store would, in place. */
  revoke(namespaceId: string, grantId: string, revokedAt: string): this {
    const grant = this.#grantsByNamespace.get(namespaceId)?.get(grantId);
    if (grant === undefined) {
      throw new Error(`grant is not registered: ${grantId}`);
    }
    this.#grantsByNamespace.get(namespaceId)?.set(grantId, { ...grant, revokedAt });
    return this;
  }

  async resolve(namespaceId: string, grantId: string): Promise<CapabilityGrant | undefined> {
    await Promise.resolve();
    const grant = this.#grantsByNamespace.get(namespaceId)?.get(grantId);
    return grant === undefined ? undefined : structuredClone(grant);
  }
}

/** A resolver whose authoritative source is down; every lookup must fail closed. */
export class UnavailableGrantChainResolver implements DelegationChainResolver {
  async resolve(): Promise<CapabilityGrant | undefined> {
    await Promise.resolve();
    throw new Error("delegation chain resolver is unavailable");
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
  /** The trusted store the kernel loads authority from; mutate it to grant or revoke. */
  readonly grants: InMemoryGrantSource;
}

export interface TestKernelOptions {
  /** Seed authority for the kernel's trusted grant source. */
  readonly grants?: readonly CapabilityGrant[];
  /** Replaces the trusted grant source, for example to exercise an outage. */
  readonly grantSource?: GrantSource;
  /** Installs ancestor validation so delegated grants can be exercised. */
  readonly delegationResolver?: DelegationChainResolver;
}

export function createTestKernel(options: TestKernelOptions = {}): TestKernel {
  const audit = new InMemoryAuditSink();
  const messages = new InMemoryMessageTransport();
  const grants = new InMemoryGrantSource(options.grants ?? []);
  return {
    kernel: new SharedOSKernel({
      grantSource: options.grantSource ?? grants,
      audit,
      authorizer: new CapabilityAuthorizer({
        usageStore: new InMemoryGrantUsageStore(),
        ...(options.delegationResolver === undefined
          ? {}
          : { delegationResolver: options.delegationResolver }),
      }),
      messageTransport: messages,
    }),
    audit,
    messages,
    grants,
  };
}

export interface TestContextOptions {
  readonly actor?: Address;
  readonly authority?: Address;
  readonly owner?: Address;
  readonly namespaceId?: string;
  readonly enabledToolNamespaces?: readonly string[];
  readonly purpose?: string;
  readonly traceId?: string;
  readonly now?: string;
}

export function createTestContext(options: TestContextOptions = {}): AccessContext {
  const owner = options.owner ?? { kind: "human", userId: "owner-1" };
  return {
    actor: options.actor ?? { kind: "agent", agentId: "agent-1" },
    authority: options.authority ?? owner,
    owner,
    namespaceId: options.namespaceId ?? "namespace-1",
    enabledToolNamespaces: [...(options.enabledToolNamespaces ?? [])],
    purpose: options.purpose ?? "test",
    traceId: options.traceId ?? "trace-1",
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
  readonly notBefore?: string;
  readonly expiresAt?: string;
  readonly revokedAt?: string;
  readonly maxUses?: number;
  readonly delegationDepth?: number;
  readonly parentGrantId?: string;
}

export function createTestGrant(options: TestGrantOptions): CapabilityGrant {
  const constraints = {
    ...(options.purposes === undefined ? {} : { purposes: [...options.purposes] }),
    ...(options.notBefore === undefined ? {} : { notBefore: options.notBefore }),
    ...(options.expiresAt === undefined ? {} : { expiresAt: options.expiresAt }),
    ...(options.maxUses === undefined ? {} : { maxUses: options.maxUses }),
    ...(options.delegationDepth === undefined ? {} : { delegationDepth: options.delegationDepth }),
  };
  return {
    id: options.id ?? "grant-1",
    namespaceId: options.namespaceId ?? "namespace-1",
    subject: options.subject ?? { kind: "agent", agentId: "agent-1" },
    issuer: options.issuer ?? { kind: "human", userId: "owner-1" },
    capabilities: [...options.capabilities],
    constraints,
    issuedAt: options.issuedAt ?? "2026-01-01T00:00:00.000Z",
    ...(options.revokedAt === undefined ? {} : { revokedAt: options.revokedAt }),
    ...(options.parentGrantId === undefined ? {} : { parentGrantId: options.parentGrantId }),
  };
}

function sameAddress(left: Address, right: Address): boolean {
  return canonicalAddress(left) === canonicalAddress(right);
}

function canonicalAddress(address: Address): string {
  switch (address.kind) {
    case "human":
      return `human:${address.userId}`;
    case "agent":
      return `agent:${address.agentId}`;
    case "group":
      return `group:${address.conversationId}`;
    case "service":
      return `service:${address.serviceId}`;
  }
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
