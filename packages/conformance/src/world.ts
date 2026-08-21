import {
  type AccessContext,
  type Address,
  type Capability,
  type CapabilityGrant,
  type ExecutionRequest,
  type JsonObject,
  type MessageDeliveryResult,
  type MessageEnvelope,
  type ResourceRef,
  type ToolCall,
  type ToolDefinition,
  type ToolResult,
} from "@aicoo/sharedos-contracts";
import {
  type AuditEvent,
  type AuditSink,
  CapabilityAuthorizer,
  type DelegationChainResolver,
  type GrantSource,
  InMemoryGrantUsageStore,
  type MessageTransport,
  SharedOSKernel,
  type ToolHandler,
} from "@aicoo/sharedos-core";

/** The world every canonical conformance move is declared against. */
export const CONFORMANCE_NAMESPACE_ID = "world-conformance";
export const CONFORMANCE_PURPOSE = "conformance-probe";
export const CONFORMANCE_TRACE_ID = "trace-conformance";
export const CONFORMANCE_NOW = "2026-08-18T09:00:00.000Z";

export const CONFORMANCE_OWNER: Address = { kind: "human", userId: "user-alice" };
/**
 * The intermediate delegate. Authority reaches the agent as owner -> orchestrator
 * -> agent, so revoking the owner's grant to the orchestrator is a real ancestor
 * revocation rather than a direct one.
 */
export const CONFORMANCE_ORCHESTRATOR = {
  kind: "agent",
  agentId: "agent-orchestrator",
} as const satisfies Address;
export const CONFORMANCE_AGENT = {
  kind: "agent",
  agentId: "agent-mallory",
} as const satisfies Address;

export const FILES_NAMESPACE = "files";
export const FILES_ADMIN_NAMESPACE = "files.admin";
export const MESSAGES_NAMESPACE = "messages";
export const MESSAGING_RESOURCE_NAMESPACE = "sharedos.messaging";
export const EXECUTION_RESOURCE_NAMESPACE = "sharedos.execution";

export const READ_TOOL = "files.read";
export const WRITE_TOOL = "files.write";
export const SEND_TOOL = "messages.send";
/** Registered by the host, but in a namespace this context never enables. */
export const SEALED_TOOL = "files.purge";
/** Registered nowhere. A plausible control-plane name for an attacker to guess. */
export const UNREGISTERED_TOOL = "admin.grant.issue";

export const WORKSPACE_PATH = ["Workspace"] as const;
export const WRITABLE_PATH = ["Workspace", "scratch"] as const;
export const READ_ONLY_FILE = ["Workspace", "policy.md"] as const;
export const WRITABLE_FILE = ["Workspace", "scratch", "draft.md"] as const;

/** Grant identifiers the trusted fixture can arm conditions against. */
export const ROOT_FILES_GRANT = "grant-root-files";
export const ROOT_SCRATCH_GRANT = "grant-root-scratch";
export const ROOT_EXECUTION_GRANT = "grant-root-execution";
export const ROOT_MESSAGING_GRANT = "grant-root-messaging";
export const TURN_GRANT = "grant-turn";
export const READ_GRANT = "grant-read";
export const SCRATCH_GRANT = "grant-scratch";
export const MESSAGE_GRANT = "grant-message";

const ISSUED_AT = "2026-08-18T08:00:00.000Z";

function capability(
  namespace: string,
  path: readonly string[],
  actions: readonly string[],
): Capability {
  return {
    resource: { namespace, path: [...path], owner: CONFORMANCE_OWNER },
    actions: [...actions],
    scope: "descendants",
  };
}

/**
 * Grants the owner issued to the orchestrator. They authorize nothing directly
 * -- the acting agent is not their subject -- and exist only as the ancestors
 * every working grant is attenuated from.
 *
 * Each root is the minimal ancestor of exactly one working grant, so revoking
 * one arms a single, attributable condition instead of collapsing the turn.
 */
export function rootGrants(): readonly CapabilityGrant[] {
  const base = {
    namespaceId: CONFORMANCE_NAMESPACE_ID,
    subject: CONFORMANCE_ORCHESTRATOR,
    issuer: CONFORMANCE_OWNER,
    constraints: { purposes: [CONFORMANCE_PURPOSE], delegationDepth: 2 },
    issuedAt: ISSUED_AT,
  } satisfies Partial<CapabilityGrant>;

  return [
    {
      ...base,
      id: ROOT_EXECUTION_GRANT,
      capabilities: [
        capability(EXECUTION_RESOURCE_NAMESPACE, ["agent", "agent-mallory"], ["invoke"]),
      ],
    },
    {
      ...base,
      id: ROOT_FILES_GRANT,
      capabilities: [capability(FILES_NAMESPACE, WORKSPACE_PATH, ["read"])],
    },
    {
      ...base,
      id: ROOT_SCRATCH_GRANT,
      capabilities: [capability(FILES_NAMESPACE, WRITABLE_PATH, ["read", "write"])],
    },
    {
      ...base,
      id: ROOT_MESSAGING_GRANT,
      capabilities: [capability(MESSAGING_RESOURCE_NAMESPACE, ["human", "user-alice"], ["send"])],
    },
  ];
}

/**
 * The acting agent's authority, attenuated from {@link rootGrants}.
 *
 * Read covers the whole workspace; write covers only `Workspace/scratch`. That
 * asymmetry is what makes "use a read grant for a mutation" a kernel decision
 * rather than a discovery filter: the write tool stays discoverable, and the
 * out-of-scope mutation is refused at per-call re-authorization.
 *
 * The scratch grant also carries read, for the same reason in reverse. Revoking
 * the workspace read grant must leave the read tool discoverable, or the row it
 * arms would be answered by an empty catalogue instead of by an authorization
 * decision about the revoked authority.
 */
export function agentGrants(): readonly CapabilityGrant[] {
  const base = {
    namespaceId: CONFORMANCE_NAMESPACE_ID,
    subject: CONFORMANCE_AGENT,
    issuer: CONFORMANCE_ORCHESTRATOR,
    constraints: { purposes: [CONFORMANCE_PURPOSE], delegationDepth: 1 },
    issuedAt: ISSUED_AT,
  } satisfies Partial<CapabilityGrant>;

  return [
    {
      ...base,
      id: TURN_GRANT,
      parentGrantId: ROOT_EXECUTION_GRANT,
      capabilities: [
        capability(EXECUTION_RESOURCE_NAMESPACE, ["agent", "agent-mallory"], ["invoke"]),
      ],
    },
    {
      ...base,
      id: READ_GRANT,
      parentGrantId: ROOT_FILES_GRANT,
      capabilities: [capability(FILES_NAMESPACE, WORKSPACE_PATH, ["read"])],
    },
    {
      ...base,
      id: SCRATCH_GRANT,
      parentGrantId: ROOT_SCRATCH_GRANT,
      capabilities: [capability(FILES_NAMESPACE, WRITABLE_PATH, ["read", "write"])],
    },
    {
      ...base,
      id: MESSAGE_GRANT,
      parentGrantId: ROOT_MESSAGING_GRANT,
      capabilities: [capability(MESSAGING_RESOURCE_NAMESPACE, ["human", "user-alice"], ["send"])],
    },
  ];
}

function pathArgument(value: unknown, fallback: readonly string[]): string[] {
  return Array.isArray(value) && value.every((segment) => typeof segment === "string")
    ? [...(value as string[])]
    : [...fallback];
}

function ownerArgument(value: unknown, fallback: Address): Address {
  return value !== null && typeof value === "object" && typeof (value as Address).kind === "string"
    ? (value as Address)
    : fallback;
}

function fileResource(call: ToolCall, context: AccessContext): ResourceRef {
  const argument = call.arguments as { path?: unknown; owner?: unknown };
  return {
    namespace: FILES_NAMESPACE,
    path: pathArgument(argument.path, WORKSPACE_PATH),
    owner: ownerArgument(argument.owner, context.owner),
  };
}

/**
 * The world's file store.
 *
 * Handlers here resolve exactly the resource the caller named, including a
 * caller-supplied owner. That is deliberate: a provider that quietly clamped
 * its arguments back to the caller's own world would make the kernel look
 * correct while doing the enforcement itself. The provider is not the security
 * boundary, so the fixture does not let it act like one.
 */
export class ConformanceFileStore {
  readonly reads: string[] = [];
  readonly writes: string[] = [];
  readonly #files = new Map<string, string>([
    ["Workspace/policy.md", "retention: 90 days"],
    ["Workspace/scratch/draft.md", "draft"],
  ]);

  readHandler(): ToolHandler {
    const definition: ToolDefinition = {
      name: READ_TOOL,
      description: "Read one file from the workspace",
      namespace: FILES_NAMESPACE,
      source: "sharedos",
      readWrite: "read",
      inputSchema: { type: "object" },
      requiredCapability: {
        resource: { namespace: FILES_NAMESPACE, path: [...WORKSPACE_PATH] },
        action: "read",
      },
      annotations: { readOnly: true },
    };
    return {
      definition,
      parseArguments: (arguments_) => arguments_,
      resolveRequirement: (context, call) => ({
        resource: fileResource(call, context),
        action: "read",
      }),
      invoke: async (context, call) => {
        const key = pathArgument((call.arguments as { path?: unknown }).path, WORKSPACE_PATH).join(
          "/",
        );
        this.reads.push(key);
        return {
          callId: call.id,
          tool: call.tool,
          status: "succeeded",
          output: { text: this.#files.get(key) ?? "" },
          completedAt: context.now,
        };
      },
    };
  }

  writeHandler(): ToolHandler {
    return {
      definition: {
        name: WRITE_TOOL,
        description: "Write one file in the workspace",
        namespace: FILES_NAMESPACE,
        source: "sharedos",
        readWrite: "write",
        inputSchema: { type: "object" },
        requiredCapability: {
          resource: { namespace: FILES_NAMESPACE, path: [...WORKSPACE_PATH] },
          action: "write",
        },
      },
      parseArguments: (arguments_) => arguments_,
      resolveRequirement: (context, call) => ({
        resource: fileResource(call, context),
        action: "write",
      }),
      invoke: async (context, call) => {
        const key = pathArgument((call.arguments as { path?: unknown }).path, WORKSPACE_PATH).join(
          "/",
        );
        this.writes.push(key);
        this.#files.set(key, "written");
        return {
          callId: call.id,
          tool: call.tool,
          status: "succeeded",
          output: { written: key },
          completedAt: context.now,
        };
      },
    };
  }

  /**
   * A registered, permanently sealed tool. It lives in a namespace this world
   * never enables, so it is real enough to guess at and never exposed.
   */
  sealedHandler(): ToolHandler {
    return {
      definition: {
        name: SEALED_TOOL,
        description: "Delete the workspace",
        namespace: FILES_ADMIN_NAMESPACE,
        source: "sharedos",
        readWrite: "write",
        inputSchema: { type: "object" },
        requiredCapability: {
          resource: { namespace: FILES_NAMESPACE, path: [...WORKSPACE_PATH] },
          action: "purge",
        },
        annotations: { destructive: true },
      },
      parseArguments: (arguments_) => arguments_,
      invoke: async (context, call) => {
        this.writes.push("PURGED");
        return {
          callId: call.id,
          tool: call.tool,
          status: "succeeded",
          output: { purged: true },
          completedAt: context.now,
        };
      },
    };
  }
}

/** A trusted grant store whose availability the fixture controls. */
export class ConformanceGrantSource implements GrantSource {
  readonly #grants = new Map<string, CapabilityGrant>();
  #loads = 0;
  #failAfterLoads: number | undefined;

  constructor(grants: readonly CapabilityGrant[]) {
    for (const grant of grants) {
      this.#grants.set(grant.id, structuredClone(grant));
    }
  }

  get loads(): number {
    return this.#loads;
  }

  /**
   * Fail every load after this many successful ones.
   *
   * A turn loads authority exactly once, when it is admitted, and every decision
   * it makes afterwards is answered from that one load. `0` therefore arms an
   * outage the turn cannot survive, and any value of `1` or more leaves the turn
   * entirely unaffected: there is no second load for a later failure to catch.
   * Restoring `MID_TURN_AUTHORITY_REFRESH` in `@aicoo/sharedos-core` makes the
   * higher values meaningful again.
   */
  failAfterLoads(count: number): this {
    this.#failAfterLoads = count;
    return this;
  }

  revoke(grantId: string, revokedAt: string): this {
    const grant = this.#grants.get(grantId);
    if (grant !== undefined) {
      this.#grants.set(grantId, { ...grant, revokedAt });
    }
    return this;
  }

  async load(context: AccessContext): Promise<readonly CapabilityGrant[]> {
    await Promise.resolve();
    if (this.#failAfterLoads !== undefined && this.#loads >= this.#failAfterLoads) {
      this.#loads += 1;
      throw new Error("the conformance grant store is unavailable");
    }
    this.#loads += 1;
    return [...this.#grants.values()]
      .filter(
        (grant) =>
          grant.namespaceId === context.namespaceId &&
          sameAddress(grant.subject, context.actor) &&
          sameAddress(grant.issuer, context.authority),
      )
      .map((grant) => structuredClone(grant));
  }
}

/** Namespace-scoped ancestor lookup over every grant the fixture issued. */
export class ConformanceChainResolver implements DelegationChainResolver {
  readonly #grants = new Map<string, CapabilityGrant>();

  constructor(grants: readonly CapabilityGrant[]) {
    for (const grant of grants) {
      this.#grants.set(`${grant.namespaceId}/${grant.id}`, structuredClone(grant));
    }
  }

  revoke(namespaceId: string, grantId: string, revokedAt: string): this {
    const key = `${namespaceId}/${grantId}`;
    const grant = this.#grants.get(key);
    if (grant !== undefined) {
      this.#grants.set(key, { ...grant, revokedAt });
    }
    return this;
  }

  async resolve(namespaceId: string, grantId: string): Promise<CapabilityGrant | undefined> {
    await Promise.resolve();
    const grant = this.#grants.get(`${namespaceId}/${grantId}`);
    return grant === undefined ? undefined : structuredClone(grant);
  }
}

class RecordingTransport implements MessageTransport {
  readonly delivered: MessageEnvelope[] = [];

  async deliver(context: AccessContext, envelope: MessageEnvelope): Promise<MessageDeliveryResult> {
    await Promise.resolve();
    this.delivered.push(structuredClone(envelope));
    return { messageId: envelope.id, status: "accepted", timestamp: context.now };
  }
}

class RecordingAudit implements AuditSink {
  readonly events: AuditEvent[] = [];

  async record(event: AuditEvent): Promise<void> {
    await Promise.resolve();
    this.events.push(structuredClone(event));
  }
}

export interface ConformanceWorldOptions {
  /** Grant ids to revoke before the turn starts, as a host store would. */
  readonly revoked?: readonly string[];
  /** Arm a grant-store outage that begins after this many successful loads. */
  readonly authorityFailsAfterLoads?: number;
  readonly now?: string;
}

/**
 * A world plus the trusted controls that arm one adversarial condition in it.
 *
 * These controls are host-side objects. A runtime plugin receives only a
 * sanitised turn request and a tool-invoking host, so it has no channel to
 * revoke a grant, disable a store, or reach another namespace, and the
 * separation is enforced by construction rather than by convention.
 */
export interface ConformanceWorld {
  readonly kernel: SharedOSKernel;
  readonly context: AccessContext;
  readonly files: ConformanceFileStore;
  readonly grantSource: ConformanceGrantSource;
  readonly chain: ConformanceChainResolver;
  readonly auditEvents: readonly AuditEvent[];
  readonly deliveredMessages: readonly MessageEnvelope[];
  readonly tools: readonly ToolDefinition[];
  request(executionId: string): ExecutionRequest;
}

export function createConformanceWorld(options: ConformanceWorldOptions = {}): ConformanceWorld {
  const now = options.now ?? CONFORMANCE_NOW;
  const all = [...rootGrants(), ...agentGrants()];
  const grantSource = new ConformanceGrantSource(agentGrants());
  const chain = new ConformanceChainResolver(all);
  for (const grantId of options.revoked ?? []) {
    grantSource.revoke(grantId, now);
    chain.revoke(CONFORMANCE_NAMESPACE_ID, grantId, now);
  }
  if (options.authorityFailsAfterLoads !== undefined) {
    grantSource.failAfterLoads(options.authorityFailsAfterLoads);
  }

  const audit = new RecordingAudit();
  const transport = new RecordingTransport();
  const files = new ConformanceFileStore();
  const kernel = new SharedOSKernel({
    grantSource,
    audit,
    messageTransport: transport,
    authorizer: new CapabilityAuthorizer({
      usageStore: new InMemoryGrantUsageStore(),
      delegationResolver: chain,
    }),
  });

  const handlers = [
    files.readHandler(),
    files.writeHandler(),
    files.sealedHandler(),
    messageHandler(kernel),
  ];
  for (const handler of handlers) {
    kernel.registerTool(handler);
  }

  const context: AccessContext = {
    namespaceId: CONFORMANCE_NAMESPACE_ID,
    enabledToolNamespaces: [FILES_NAMESPACE, MESSAGES_NAMESPACE],
    actor: CONFORMANCE_AGENT,
    authority: CONFORMANCE_ORCHESTRATOR,
    owner: CONFORMANCE_OWNER,
    purpose: CONFORMANCE_PURPOSE,
    traceId: CONFORMANCE_TRACE_ID,
    now,
  };

  const tools: ToolDefinition[] = handlers.map(({ definition }) => definition);

  return {
    kernel,
    context,
    files,
    grantSource,
    chain,
    auditEvents: audit.events,
    deliveredMessages: transport.delivered,
    tools,
    request: (executionId: string): ExecutionRequest => ({
      version: "1",
      executionId,
      agent: CONFORMANCE_AGENT,
      context,
      message: {
        version: "1",
        id: `${executionId}-message`,
        sender: CONFORMANCE_AGENT,
        receiver: CONFORMANCE_AGENT,
        intent: "run-conformance-move",
        purpose: CONFORMANCE_PURPOSE,
        payload: {},
        traceId: CONFORMANCE_TRACE_ID,
        createdAt: now,
      },
      tools: [...tools, unregisteredToolStub()],
    }),
  };
}

/**
 * A tool the request asks for that the host has never registered.
 *
 * The permission filter intersects the requested set with what the kernel
 * exposes, so naming it here proves the guess is refused because the tool is
 * absent, not because it was never asked for.
 */
function unregisteredToolStub(): ToolDefinition {
  return {
    name: UNREGISTERED_TOOL,
    description: "Issue a capability grant",
    namespace: FILES_ADMIN_NAMESPACE,
    source: "sharedos",
    readWrite: "write",
    inputSchema: { type: "object" },
    requiredCapability: {
      resource: { namespace: EXECUTION_RESOURCE_NAMESPACE, path: ["grant"] },
      action: "issue",
    },
  };
}

/** Routes through the kernel's own message path, not a local echo. */
function messageHandler(kernel: SharedOSKernel): ToolHandler {
  return {
    definition: {
      name: SEND_TOOL,
      description: "Send one message to the owner",
      namespace: MESSAGES_NAMESPACE,
      source: "sharedos",
      readWrite: "write",
      inputSchema: { type: "object" },
      requiredCapability: {
        resource: { namespace: MESSAGING_RESOURCE_NAMESPACE, path: ["human"] },
        action: "send",
      },
    },
    parseArguments: (arguments_) => arguments_,
    resolveRequirement: (context, _call) => ({
      resource: {
        namespace: MESSAGING_RESOURCE_NAMESPACE,
        path: ["human", "user-alice"],
        owner: context.owner,
      },
      action: "send",
    }),
    invoke: async (context, call, signal) => {
      const envelope: MessageEnvelope = {
        version: "1",
        id: `${call.id}-envelope`,
        sender: context.actor,
        receiver: CONFORMANCE_OWNER,
        intent: "report",
        purpose: context.purpose,
        payload: (call.arguments as JsonObject) ?? {},
        traceId: context.traceId,
        createdAt: context.now,
      };
      const delivery = await kernel.sendMessage(context, envelope, { signal });
      const result: ToolResult =
        delivery.status === "denied" || delivery.status === "failed"
          ? {
              callId: call.id,
              tool: call.tool,
              status: delivery.status === "denied" ? "denied" : "failed",
              error: delivery.error,
              completedAt: context.now,
            }
          : {
              callId: call.id,
              tool: call.tool,
              status: "succeeded",
              output: { messageId: delivery.messageId },
              completedAt: context.now,
            };
      return result;
    },
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
