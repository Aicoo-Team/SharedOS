import type {
  AccessContext,
  Address,
  AuthorizationDecision,
  Capability,
  Escalation,
  JsonObject,
  MessageDeliveryResult,
  MessageEnvelope,
  ProtocolError,
  ResourceResult,
  SharedOSToolCatalog,
  ToolCall,
  ToolDefinition,
  ToolNamespaceCatalog,
  ToolNamespaceUpdate,
  ToolResult,
} from "@aicoo/sharedos-contracts";
import {
  EnabledToolNamespacesSchema,
  EscalationSchema,
  JsonObjectSchema,
  MessageDeliveryResultSchema,
  MessageEnvelopeSchema,
  ResourceResultSchema,
  ToolNamespaceUpdateSchema,
  ToolResultSchema,
} from "@aicoo/sharedos-contracts";

import { type AuditEvent, type AuditSink, NoopAuditSink, auditEvent } from "./audit.js";
import {
  type AuthorityResolution,
  type AuthorityUnavailableCode,
  type GrantSource,
  type LoadedPolicy,
  MID_TURN_AUTHORITY_REFRESH,
  type PolicyResolution,
  type PolicySource,
  type ResolvedAuthority,
  TrustedAuthorityResolver,
  type TurnAuthorityScope,
  turnAuthorityKey,
} from "./authority.js";
import {
  type AuthorizationRequest,
  CapabilityAuthorizer,
  addressesEqual,
  isInfrastructureDenial,
} from "./authorization.js";
import {
  reportContainedError,
  type ProviderErrorContext,
  type ProviderErrorReporter,
} from "./diagnostics.js";
import { type CapabilityRequestPayload, mintCapabilityRequest } from "./capability-request.js";
import {
  type MessageCapabilityResolver,
  type MessageRequestRouter,
  type MessageTransport,
  RecipientScopedMessageCapabilityResolver,
  addressPath,
} from "./message-service.js";
import { createMessageRequestTool } from "./message-tool.js";
import {
  type ResourceInvocationRequest,
  type ResourceProvider,
  ResourceProviderRegistry,
  toResourceOperation,
} from "./resource-registry.js";
import { buildToolCatalog, catalogHash, publishToolCatalog } from "./published-tool.js";
import { SPAN, measure, type SpanSink } from "./spans.js";
import { type ContextToolProvider, type ToolHandler, ToolRegistry } from "./tool-registry.js";
import type { ToolNamespaceSettingsStore } from "./tool-namespace-control.js";
import { DuplicateRegistrationError, MissingRegistrationError } from "./errors.js";
import { deepFreeze, throwIfAborted } from "./internal.js";

export interface SharedOSKernelOptions {
  /**
   * The trusted boundary that loads authority. It is required: a kernel with
   * no authoritative grant source can only fail closed.
   */
  readonly grantSource: GrantSource;
  /**
   * The trusted boundary that loads host policy, once per turn, beside the
   * grant set. See {@link PolicySource}.
   *
   * Optional. Without one the ceiling installed on the authorizer, if any, is
   * handed `undefined` and decides over state it closes over. It is installed
   * here rather than beside the ceiling because the load is a turn-boundary
   * event and the kernel owns the turn boundary; a throw is reported to
   * {@link SharedOSKernelOptions.onProviderError} as `kind: "policy"`, and the
   * turn's policy fails closed.
   */
  readonly policySource?: PolicySource;
  readonly authorizer?: CapabilityAuthorizer;
  readonly resources?: ResourceProviderRegistry;
  readonly tools?: ToolRegistry;
  readonly toolProviders?: readonly ContextToolProvider[];
  readonly toolNamespaceSettings?: ToolNamespaceSettingsStore;
  readonly messageTransport?: MessageTransport;
  readonly messageRequestRouter?: MessageRequestRouter;
  readonly messageCapabilityResolver?: MessageCapabilityResolver;
  readonly createMessageId?: (context: AccessContext, call: ToolCall) => string;
  readonly audit?: AuditSink;
  /** Notification for audit failures that occur after a side effect. */
  readonly onAuditError?: (error: unknown, event: AuditEvent) => void | Promise<void>;
  /**
   * Notification for a throw the kernel contained rather than propagated.
   *
   * A provider, tool handler, transport, or router that throws is answered with
   * a fixed reason code, and until a host installs this the error itself is
   * gone: `tool_execution_failed` says an operation stopped and does not say
   * why. One hook covers every such port, and {@link ProviderErrorContext.kind}
   * is what a host branches on if it wants to treat them differently.
   *
   * Synchronous, unlike {@link SharedOSKernelOptions.onAuditError}, and see
   * {@link reportContainedError} for why the two differ.
   */
  readonly onProviderError?: ProviderErrorReporter;
  /**
   * Where the cost of enforcement is reported, when a host is measuring it.
   *
   * Absent by default and absent in every production path that does not ask for
   * it, which is what keeps a measured run and an unmeasured one the same run.
   * See {@link SpanSink}.
   */
  readonly spans?: SpanSink;
}

export interface KernelOperationOptions {
  readonly signal?: AbortSignal;
}

/** How a turn finished, as the boundary that finished it saw it. */
export interface TurnEndRecord {
  readonly executionId: string;
  readonly status: "succeeded" | "denied" | "failed" | "cancelled" | "escalated";
  /** The terminal code, where the ending had one. */
  readonly reasonCode?: string;
  /**
   * Who produced a failure: the envelope refusing, or the runtime reporting its
   * own. The same distinction `ExecutionEvent` carries, kept because a record
   * reader crediting enforcement must not credit a plugin's self-reported error.
   */
  readonly endedBy?: "envelope" | "runtime";
}

/** One call an enforcement boundary refused without invoking anything. */
export interface RefusedCall {
  readonly callId: string;
  readonly tool: string;
  readonly reasonCode: string;
  /** Which situation a coarse code was, where it covers several. */
  readonly cause?: string;
}

/** What a `tool.invoked` event carries beyond the call and its result. */
interface ToolResultAuditDetail {
  readonly grantId?: string;
  readonly requirement?: AuthorizationRequest;
  /**
   * Which situation a coarse refusal was, when the code covers several.
   *
   * `tool_unavailable` is deliberately one code over "not registered",
   * "namespace disabled", and "not discoverable to you" so the caller learns it
   * cannot use the tool and not which. An audit reader is not the caller.
   */
  readonly cause?: string;
}

export interface EscalationOptions extends KernelOperationOptions {
  /**
   * The authority this escalation is asking for.
   *
   * A host escalating a denial passes the `requiredAuthority` that denial
   * described; a model-chosen escalation usually has none, because a sentence
   * is all it produced. Either way nothing here advances the escalation --
   * resolution stays host-owned work that ends in a grant the next turn loads.
   *
   * The two names are one concept in two roles, and both end in the noun this
   * package uses for what grants confer: a denial says what was *required*, and
   * an escalation *requests* it. `{ requestedAuthority: denial.requiredAuthority }`
   * is the whole hop.
   *
   * What is recorded is minted, not copied. The ask -- capabilities, purpose,
   * constraints, metadata -- is the caller's; `id`, `namespaceId`, `requester`,
   * `owner`, and `requestedAt` come from the trusted context, whatever the
   * caller wrote, because a request the caller authored would be a
   * caller-chosen correlation for a decision the kernel made. The hop above
   * still round-trips: the denial's description was minted from the same ask,
   * so it comes back under the same identifier (ADR 0019).
   */
  readonly requestedAuthority?: CapabilityRequestPayload;
}

export const EXECUTION_NAMESPACE = "sharedos.execution";
export const AGENT_INVOKE_ACTION = "invoke";

export function agentExecutionCapability(agent: Address, owner: Address): Capability {
  return {
    resource: {
      namespace: EXECUTION_NAMESPACE,
      path: addressPath(agent),
      owner,
    },
    actions: [AGENT_INVOKE_ACTION],
    scope: "exact",
  };
}

/** One turn's frozen authority, and the number of open handles on it. */
interface AuthorityLease {
  refs: number;
  readonly resolution: AuthorityResolution;
}

/**
 * Host-neutral facade for every permission-controlled SharedOS operation.
 * AccessContext is a trusted host-created boundary; never construct it from an
 * unverified request body.
 */
export class SharedOSKernel {
  readonly #authority: TrustedAuthorityResolver;
  readonly #policySource: PolicySource | undefined;
  readonly #leases = new Map<string, AuthorityLease>();
  readonly #authorizer: CapabilityAuthorizer;
  readonly #resources: ResourceProviderRegistry;
  readonly #tools: ToolRegistry;
  readonly #toolProviders: Map<string, ContextToolProvider>;
  readonly #toolNamespaceSettings: ToolNamespaceSettingsStore | undefined;
  readonly #messageTransport: MessageTransport | undefined;
  readonly #messageRequestRouter: MessageRequestRouter | undefined;
  readonly #messageCapabilityResolver: MessageCapabilityResolver;
  readonly #createMessageId: (context: AccessContext, call: ToolCall) => string;
  readonly #audit: AuditSink;
  readonly #onAuditError: ((error: unknown, event: AuditEvent) => void | Promise<void>) | undefined;
  readonly #onProviderError: ProviderErrorReporter | undefined;
  readonly #spans: SpanSink | undefined;

  constructor(options: SharedOSKernelOptions) {
    this.#authority = new TrustedAuthorityResolver(options?.grantSource);
    if (options.policySource !== undefined && typeof options.policySource?.load !== "function") {
      throw new TypeError("SharedOS requires a policy source that provides a load function");
    }
    this.#policySource = options.policySource;
    this.#authorizer = options.authorizer ?? new CapabilityAuthorizer();
    this.#resources = options.resources ?? new ResourceProviderRegistry();
    this.#tools = options.tools ?? new ToolRegistry();
    this.#toolProviders = new Map();
    for (const provider of options.toolProviders ?? []) {
      this.registerToolProvider(provider);
    }
    this.#toolNamespaceSettings = options.toolNamespaceSettings;
    this.#messageTransport = options.messageTransport;
    this.#messageRequestRouter = options.messageRequestRouter;
    this.#messageCapabilityResolver =
      options.messageCapabilityResolver ?? new RecipientScopedMessageCapabilityResolver();
    this.#createMessageId = options.createMessageId ?? (() => crypto.randomUUID());
    this.#audit = options.audit ?? new NoopAuditSink();
    this.#onAuditError = options.onAuditError;
    this.#onProviderError = options.onProviderError;
    this.#spans = options.spans;
  }

  registerResourceProvider(provider: ResourceProvider): void {
    this.#resources.register(provider);
  }

  registerTool(handler: ToolHandler): void {
    this.#tools.register(handler);
  }

  registerToolProvider(provider: ContextToolProvider): void {
    const id = provider.id.trim();
    if (id.length === 0) {
      throw new TypeError("tool provider id must not be empty");
    }
    if (this.#toolProviders.has(id)) {
      throw new DuplicateRegistrationError("tool provider", id);
    }
    this.#toolProviders.set(id, provider);
  }

  /**
   * Resolve the authority one turn will be decided against, and hold it.
   *
   * A turn must decide against a single authority state. This loads that state
   * once, at the turn boundary, and every kernel operation presenting the same
   * turn identity is then answered from it -- including operations a tool
   * handler makes back into the kernel, which never receive a handle and would
   * otherwise re-read the store.
   *
   * An unavailable source is held too, so a turn that could not establish
   * authority stays fail-closed for its whole length instead of retrying the
   * store on every call and possibly changing its mind.
   *
   * Callers must `close` the returned scope on every exit path. Hosts that call
   * kernel operations outside any turn need not open one: an operation with no
   * lease resolves its own authority, which is a turn of one operation.
   */
  async openTurnAuthority(
    context: AccessContext,
    options: KernelOperationOptions = {},
  ): Promise<TurnAuthorityScope> {
    throwIfAborted(options.signal);
    context = structuredClone(context);

    if (MID_TURN_AUTHORITY_REFRESH) {
      // The fuse is in. Report the boundary outcome so admission is unchanged,
      // but hold nothing: every later operation resolves its own authority.
      return scopeFor(await this.#loadAuthority(context, options.signal), () => undefined);
    }

    const key = turnAuthorityKey(context);
    const existing = this.#leases.get(key);
    if (existing !== undefined) {
      existing.refs += 1;
      return scopeFor(existing.resolution, () => this.#releaseTurnAuthority(key));
    }

    const resolution = await this.#loadAuthority(context, options.signal);
    this.#leases.set(key, { refs: 1, resolution });
    return scopeFor(resolution, () => this.#releaseTurnAuthority(key));
  }

  #releaseTurnAuthority(key: string): void {
    const lease = this.#leases.get(key);
    if (lease === undefined) {
      return;
    }
    lease.refs -= 1;
    if (lease.refs <= 0) {
      this.#leases.delete(key);
    }
  }

  async authorize(
    context: AccessContext,
    request: AuthorizationRequest,
    options: KernelOperationOptions = {},
  ): Promise<AuthorizationDecision> {
    throwIfAborted(options.signal);
    context = structuredClone(context);
    request = structuredClone(request);
    const authority = await this.#resolveAuthority(context, options.signal);
    if (authority.status !== "resolved") {
      return this.#denyUnavailableAuthority(context, request, authority.code, false);
    }
    return this.#authorize(context, authority.authority, request, false);
  }

  /** Consume permission to invoke exactly one target agent turn. */
  async admitTurn(
    context: AccessContext,
    agent: Address,
    options: KernelOperationOptions = {},
  ): Promise<AuthorizationDecision> {
    throwIfAborted(options.signal);
    context = structuredClone(context);
    agent = structuredClone(agent);
    const request: AuthorizationRequest = {
      resource: {
        namespace: EXECUTION_NAMESPACE,
        path: addressPath(agent),
        owner: context.owner,
      },
      action: AGENT_INVOKE_ACTION,
    };
    const authority = await this.#resolveAuthority(context, options.signal);
    if (authority.status !== "resolved") {
      return this.#denyUnavailableAuthority(context, request, authority.code, true);
    }
    return this.#authorize(context, authority.authority, request, true);
  }

  /**
   * Record that a turn stopped and asked a human to decide.
   *
   * This mints nothing and unblocks nothing. It writes one audit event and
   * returns the stub the turn terminates with, so an escalation is visible in
   * the same stream as the decisions around it rather than surviving only as
   * runtime prose. The reviewer is the owner the turn already runs on behalf
   * of; SharedOS has no review roster and does not invent one.
   *
   * Resolving an escalation is host-owned control-plane work: it ends in a new
   * grant issued to the trusted store, which the *next* turn loads. There is
   * deliberately no path from here back into the running turn.
   */
  async recordEscalation(
    context: AccessContext,
    reason: string,
    options: EscalationOptions = {},
  ): Promise<Escalation> {
    throwIfAborted(options.signal);
    context = structuredClone(context);
    const requestedAuthority =
      options.requestedAuthority === undefined
        ? undefined
        : await mintCapabilityRequest(context, structuredClone(options.requestedAuthority));
    if (options.requestedAuthority !== undefined && requestedAuthority === undefined) {
      throw new TypeError("escalation requestedAuthority does not match the SharedOS v1 contract");
    }
    const parsed = EscalationSchema.safeParse({
      reason,
      reviewer: context.owner,
      requestedAt: context.now,
      status: "pending",
      ...(requestedAuthority === undefined ? {} : { requestedAuthority }),
    });
    if (!parsed.success) {
      throw new TypeError("escalation does not match the SharedOS v1 contract");
    }

    await this.#audit.record(
      auditEvent(context, {
        type: "escalation.requested",
        outcome: "escalated",
        reason: "escalation_requested",
        metadata: {
          detail: parsed.data.reason,
          reviewer: parsed.data.reviewer,
          reviewerAssumed: true,
          resolution: "pending",
        },
        // Recorded so a reviewer's queue can be built from audit alone. The
        // reason is what a model wrote; this is what can be turned into a grant
        // without reading it (ADR 0019).
        ...(parsed.data.requestedAuthority === undefined
          ? {}
          : { requestedAuthority: parsed.data.requestedAuthority }),
      }),
    );

    return parsed.data;
  }

  /**
   * Record how a turn ended, from the boundary that ended it.
   *
   * The envelope owns turn termination and, until this existed, owned no audit
   * at all: a turn that started, completed, failed, or was cancelled left
   * nothing in the trail, so a host reading audit could not bound a turn or
   * join a set of tool calls to the one that made them beyond `traceId`. It is
   * called through the kernel rather than from an `AuditSink` of the envelope's
   * own, because one sink passed in two places is one sink a host can forget to
   * pass twice -- and the failure mode of forgetting is a turn that enforces
   * correctly and records nothing (ADR 0023).
   *
   * One event, at the terminal. Not five: a lifecycle event per transition
   * would triple the audit volume of every successful turn to say nothing more,
   * and a `turn.denied` would double-count against the `authorization.checked`
   * {@link admitTurn} already produced for the same refusal.
   *
   * A cancelled turn is recorded `failed` with reason `turn_cancelled` rather
   * than gaining an `AuditOutcome` of its own. The outcome vocabulary is a
   * compatibility surface every host persists against, and `reason` already
   * separates a deadline from a defect.
   */
  async recordTurnEnd(
    context: AccessContext,
    turn: TurnEndRecord,
    options: KernelOperationOptions = {},
  ): Promise<void> {
    throwIfAborted(options.signal);
    context = structuredClone(context);
    await this.#recordOutcome(
      auditEvent(context, {
        type: "turn.ended",
        outcome: turn.status === "cancelled" ? "failed" : turn.status,
        operationId: turn.executionId,
        ...(turn.reasonCode === undefined ? {} : { reason: turn.reasonCode }),
        metadata: {
          source: "envelope",
          ...(turn.endedBy === undefined ? {} : { endedBy: turn.endedBy }),
          ...(turn.reasonCode !== undefined && isInfrastructureDenial(turn.reasonCode)
            ? { failClosed: true }
            : {}),
        },
      }),
    );
  }

  /**
   * Record a tool call the envelope refused before the kernel was asked.
   *
   * A name the turn's catalogue never offered, a spent step budget, a spent
   * tool-call budget. These are attempted violations -- the guessed tool name is
   * the clearest one the system produces -- and they reached no audit sink at
   * all, because the boundary that refused them does not own one.
   *
   * Recorded as `tool.invoked`, because that is what it is: a tool call that was
   * attempted and denied. `metadata.source` says `envelope`, which is the fact
   * that stops being inferable the moment this method exists (ADR 0023).
   */
  async recordRefusedCall(
    context: AccessContext,
    call: RefusedCall,
    options: KernelOperationOptions = {},
  ): Promise<void> {
    throwIfAborted(options.signal);
    context = structuredClone(context);
    await this.#recordOutcome(
      auditEvent(context, {
        type: "tool.invoked",
        outcome: "denied",
        operationId: call.callId,
        tool: call.tool,
        reason: call.reasonCode,
        metadata: {
          source: "envelope",
          ...(call.cause === undefined ? {} : { cause: call.cause }),
          ...(isInfrastructureDenial(call.reasonCode) ? { failClosed: true } : {}),
        },
      }),
    );
  }

  async listTools(
    context: AccessContext,
    options: KernelOperationOptions = {},
  ): Promise<readonly ToolDefinition[]> {
    throwIfAborted(options.signal);
    context = structuredClone(context);
    const authority = await this.#resolveAuthority(context, options.signal);
    if (authority.status !== "resolved") {
      await this.#audit.record(
        auditEvent(context, {
          type: "tool.catalog.listed",
          outcome: "denied",
          reason: "authority_unavailable",
          metadata: {
            catalogHash: await catalogHash([]),
            enabledNamespaces: [...context.enabledToolNamespaces],
            withheldCount: 0,
            failClosed: true,
            authority: authority.code,
            source: "kernel",
          },
        }),
      );
      return [];
    }

    const allowed: ToolDefinition[] = [];
    let withheldCount = 0;
    let withheldByOutage = false;
    const enabledNamespaces = new Set(context.enabledToolNamespaces);
    const tools = await this.#resolveToolRegistry(context, options.signal);

    for (const definition of tools.definitions()) {
      throwIfAborted(options.signal);
      if (!enabledNamespaces.has(definition.namespace)) {
        withheldCount += 1;
        continue;
      }
      const decision = await this.#authorizer.canDiscover(
        authority.authority,
        {
          resource: definition.requiredCapability.resource,
          action: definition.requiredCapability.action,
        },
        { now: context.now },
      );
      if (decision.allowed) {
        allowed.push(definition);
      } else {
        withheldCount += 1;
        withheldByOutage ||= isInfrastructureDenial(decision.reasonCode);
      }
    }

    const { hostPolicy } = authority.authority;
    await this.#audit.record(
      auditEvent(context, {
        type: "tool.catalog.listed",
        outcome: "succeeded",
        authorityHash: authority.authority.snapshot.hash,
        metadata: {
          // What the listing was computed from and what it came to, as
          // identifiers and a count rather than as names. `catalogHash` is the
          // catalogue the caller was shown -- the identifier `listPublishedTools`
          // hands a harness, so audit and an execution's manifest match on it;
          // `authorityHash` above and `hostPolicyVersion` are the two states it
          // was decided against; `enabledNamespaces` is the caller's own
          // filter. Equal values on two events mean the same catalogue for the
          // same reasons, and the record does not grow with the registry: a
          // two-hundred-tool registry would otherwise write its names to audit
          // on every turn to say what one digest says once. A tool name is a
          // registry constant, so what the names cost was volume, not secrecy.
          // What a count cannot carry is the per-tool cause, and `failClosed`
          // keeps the one distinction a reader cannot do without: whether
          // something was withheld by an outage rather than by a decision
          // (ADR 0023).
          catalogHash: await catalogHash(publishToolCatalog(allowed)),
          enabledNamespaces: [...context.enabledToolNamespaces],
          ...(hostPolicy?.status === "loaded" ? { hostPolicyVersion: hostPolicy.version } : {}),
          withheldCount,
          ...(withheldByOutage ? { failClosed: true } : {}),
          source: "kernel",
        },
      }),
    );

    return allowed;
  }

  /**
   * The effective catalogue as an external harness receives it.
   *
   * {@link listTools} answers with SharedOS registrations, which carry the
   * capability each tool would require. That is the right answer inside the host
   * and the wrong thing to put on a wire, so everything crossing the MCP
   * boundary goes through this instead: the same permission-filtered set,
   * projected to what a model is allowed to see, in canonical order, with the
   * hash that identifies it.
   *
   * A context whose authority could not be loaded receives an empty catalogue
   * and a hash over nothing, exactly as {@link listTools} returns no tools --
   * fail-closed, and still a well-formed catalogue rather than an error the
   * harness would have to interpret.
   */
  async listPublishedTools(
    context: AccessContext,
    options: KernelOperationOptions & { readonly executionId: string },
  ): Promise<SharedOSToolCatalog> {
    const definitions = await this.listTools(context, options);
    return buildToolCatalog(definitions, { executionId: options.executionId });
  }

  async listToolNamespaces(
    context: AccessContext,
    options: KernelOperationOptions = {},
  ): Promise<ToolNamespaceCatalog> {
    throwIfAborted(options.signal);
    context = structuredClone(context);
    const tools = await this.#resolveToolRegistry(context, options.signal);
    const catalog = tools.namespaceCatalog(context.enabledToolNamespaces);

    await this.#audit.record(
      auditEvent(context, {
        type: "tool.namespace.catalog.listed",
        outcome: "succeeded",
        metadata: {
          totalNamespaces: catalog.summary.total,
          enabledNamespaces: catalog.summary.enabled,
        },
      }),
    );

    return catalog;
  }

  async updateToolNamespaces(
    context: AccessContext,
    update: ToolNamespaceUpdate,
    options: KernelOperationOptions = {},
  ): Promise<ToolNamespaceCatalog> {
    throwIfAborted(options.signal);
    context = structuredClone(context);
    const parsedUpdate = ToolNamespaceUpdateSchema.safeParse(structuredClone(update));
    if (!parsedUpdate.success) {
      throw new TypeError("tool namespace update does not match the SharedOS contract");
    }
    if (this.#toolNamespaceSettings === undefined) {
      throw new MissingRegistrationError("tool namespace settings", "default");
    }

    const candidate = await this.#toolNamespaceSettings.applyUpdate(
      context,
      parsedUpdate.data,
      options.signal ?? neverAbortedSignal(),
    );
    throwIfAborted(options.signal);
    const parsedEnabled = EnabledToolNamespacesSchema.safeParse([...candidate]);
    if (!parsedEnabled.success) {
      throw new TypeError("tool namespace settings returned an invalid selection");
    }

    const updatedContext: AccessContext = {
      ...context,
      enabledToolNamespaces: parsedEnabled.data,
    };
    const tools = await this.#resolveToolRegistry(updatedContext, options.signal);
    const catalog = tools.namespaceCatalog(updatedContext.enabledToolNamespaces);

    await this.#recordOutcome(
      auditEvent(updatedContext, {
        type: "tool.namespace.selection.updated",
        outcome: "succeeded",
        metadata: {
          enabledNamespaces: catalog.namespaces
            .filter((namespace) => namespace.enabled)
            .map((namespace) => namespace.namespace),
        },
      }),
    );

    return catalog;
  }

  /**
   * Re-authorize and dispatch one tool call.
   *
   * The span around it is the kernel's whole share of one mediated call, and it
   * contains the provider's own work, which is not enforcement. That part is
   * named separately as `SPAN.TOOL_HANDLER` and carries the same call id,
   * so a report subtracts it rather than attributing the host's storage to
   * SharedOS. Both spans exist or neither does.
   */
  async invokeTool(
    context: AccessContext,
    call: ToolCall,
    options: KernelOperationOptions = {},
  ): Promise<ToolResult> {
    return measure(
      this.#spans,
      SPAN.TOOL_INVOKE,
      (span) => {
        span.set("callId", call.id);
        span.set("tool", call.tool);
        return this.#invokeTool(context, call, options);
      },
      (result, span) => span.set("outcome", result.status),
    );
  }

  async #invokeTool(
    context: AccessContext,
    call: ToolCall,
    options: KernelOperationOptions = {},
  ): Promise<ToolResult> {
    throwIfAborted(options.signal);
    context = structuredClone(context);
    call = structuredClone(call);
    if (call.traceId !== context.traceId) {
      const result = deniedToolResult(
        call,
        context.now,
        "trace_mismatch",
        "Tool call traceId does not match its access context",
      );
      await this.#recordToolResult(context, call, result);
      return result;
    }

    const authority = await this.#resolveAuthority(context, options.signal);
    if (authority.status !== "resolved") {
      const result = deniedToolResult(
        call,
        context.now,
        "authority_unavailable",
        "Authority could not be loaded from its trusted source",
      );
      await this.#recordToolResult(context, call, result);
      return result;
    }

    let tools: ToolRegistry;
    try {
      // Named separately because it is re-derived per call, and a number that
      // could not be attributed to it would read as the cost of authorizing.
      tools = await measure(this.#spans, SPAN.TOOL_CATALOGUE, (span) => {
        span.set("callId", call.id);
        return this.#resolveToolRegistry(context, options.signal);
      });
    } catch (error) {
      if (options.signal?.aborted) {
        throw options.signal.reason ?? error;
      }
      // What arrives here is the wrapper `#resolveToolRegistry` threw, with the
      // provider's own error as its `cause`. The wrapper is the sentence every
      // caller of the catalogue reads; the cause is the only account of what
      // actually broke, and it would have been destroyed without it. A host
      // logging this wants both, which is why neither is unwrapped here.
      this.#reportProviderError(error, context, {
        kind: "tool_catalog",
        reasonCode: "tool_catalog_unavailable",
        operationId: call.id,
        tool: call.tool,
      });
      const result = failedToolResult(
        call,
        context.now,
        "tool_catalog_unavailable",
        "The tool catalog could not be resolved",
      );
      await this.#recordToolResult(context, call, result);
      return result;
    }

    const handler = tools.get(call.tool);
    if (handler === undefined) {
      const result = deniedToolResult(
        call,
        context.now,
        "tool_unavailable",
        "The requested tool is not available in this access context",
      );
      await this.#recordToolResult(context, call, result, { cause: "not_registered" });
      return result;
    }

    if (!context.enabledToolNamespaces.includes(handler.definition.namespace)) {
      const result = deniedToolResult(
        call,
        context.now,
        "tool_unavailable",
        "The requested tool is not available in this access context",
      );
      await this.#recordToolResult(context, call, result, { cause: "namespace_disabled" });
      return result;
    }

    const discoverable = await measure(
      this.#spans,
      SPAN.TOOL_DISCOVER,
      (span) => {
        span.set("callId", call.id);
        return this.#authorizer.canDiscover(
          authority.authority,
          {
            resource: handler.definition.requiredCapability.resource,
            action: handler.definition.requiredCapability.action,
          },
          { now: context.now },
        );
      },
      (decision, span) => span.set("outcome", decision.allowed ? "visible" : "hidden"),
    );
    if (!discoverable.allowed) {
      await this.#recordAuthorizationDecision(
        context,
        {
          resource: handler.definition.requiredCapability.resource,
          action: handler.definition.requiredCapability.action,
        },
        discoverable,
        false,
        authority.authority.snapshot.hash,
      );
      const result = deniedToolResult(
        call,
        context.now,
        "tool_unavailable",
        "The requested tool is not available in this access context",
      );
      // The cause follows the decision rather than being hard-coded, so a
      // catalogue refusal a host ceiling made is nameable as one. Without it,
      // `host_policy_denied` could only ever appear on the decision event, and
      // a host counting policy refusals from the operation events would get
      // zero (ADR 0023).
      await this.#recordToolResult(context, call, result, {
        cause: discoverable.reasonCode,
        requirement: {
          resource: handler.definition.requiredCapability.resource,
          action: handler.definition.requiredCapability.action,
        },
      });
      return result;
    }

    let parsedCall: ToolCall;
    try {
      const parsedArguments = JsonObjectSchema.safeParse(handler.parseArguments(call.arguments));
      if (!parsedArguments.success) {
        throw new TypeError("tool argument parser returned a non-JSON object");
      }
      parsedCall = deepFreeze(
        structuredClone({
          ...call,
          arguments: parsedArguments.data,
        }),
      );
    } catch (error) {
      this.#reportProviderError(error, context, {
        kind: "tool",
        reasonCode: "invalid_tool_arguments",
        operationId: call.id,
        tool: call.tool,
      });
      const result = failedToolResult(
        call,
        context.now,
        "invalid_tool_arguments",
        "The requested tool arguments are invalid",
      );
      await this.#recordToolResult(context, call, result);
      return result;
    }

    let requirement: AuthorizationRequest;
    try {
      requirement =
        handler.resolveRequirement?.(context, parsedCall) ?? handler.definition.requiredCapability;
    } catch (error) {
      this.#reportProviderError(error, context, {
        kind: "tool",
        reasonCode: "tool_requirement_resolution_failed",
        operationId: call.id,
        tool: call.tool,
      });
      const result = failedToolResult(
        call,
        context.now,
        "tool_requirement_resolution_failed",
        "The tool could not resolve its required capability",
      );
      await this.#recordToolResult(context, call, result);
      return result;
    }

    // The world boundary is checked before the tool's own ceiling. A requirement
    // naming another owner is a request to act outside this world, which is a
    // denial the authorizer already has a code for -- `invalid_request` -- and
    // it is answered there so the refusal carries a recorded authorization
    // decision like every other denial. Deciding it here first would report a
    // boundary crossing as `invalid_tool_requirement`, which means something
    // else: a tool that resolved a capability outside the boundary it declared.
    if (!requirementBelongsToContext(requirement, context)) {
      const crossing = await this.#authorize(
        context,
        authority.authority,
        { resource: requirement.resource, action: requirement.action },
        false,
        call.id,
      );
      const result = deniedToolResult(
        call,
        context.now,
        crossing.reasonCode,
        "The requested resource lies outside this access context's world",
      );
      await this.#recordToolResult(context, call, result, { requirement });
      return result;
    }

    if (!requirementIsWithinDefinition(handler.definition, requirement, context)) {
      const result = failedToolResult(
        call,
        context.now,
        "invalid_tool_requirement",
        "The tool resolved a capability outside its declared boundary",
      );
      await this.#recordToolResult(context, call, result);
      return result;
    }

    const decision = await this.#authorize(
      context,
      authority.authority,
      { resource: requirement.resource, action: requirement.action },
      true,
      call.id,
    );
    if (!decision.allowed) {
      const result = deniedToolResult(
        call,
        context.now,
        decision.reasonCode,
        "The access context does not grant this tool capability",
      );
      await this.#recordToolResult(context, call, result, { requirement });
      return result;
    }

    let result: ToolResult;
    try {
      throwIfAborted(options.signal);
      const candidate = await measure(this.#spans, SPAN.TOOL_HANDLER, (span) => {
        span.set("callId", call.id);
        span.set("tool", call.tool);
        return handler.invoke(context, parsedCall, options.signal ?? neverAbortedSignal());
      });
      const parsed = ToolResultSchema.safeParse(candidate);
      result =
        parsed.success && parsed.data.callId === call.id && parsed.data.tool === call.tool
          ? parsed.data
          : failedToolResult(
              call,
              context.now,
              "invalid_tool_result",
              "The tool returned an invalid protocol result",
            );
    } catch (error) {
      if (options.signal?.aborted) {
        throw options.signal.reason ?? error;
      }
      this.#reportProviderError(error, context, {
        kind: "tool",
        reasonCode: "tool_execution_failed",
        operationId: call.id,
        tool: call.tool,
        resource: requirement.resource,
        action: requirement.action,
      });
      result = failedToolResult(
        call,
        context.now,
        "tool_execution_failed",
        "The tool failed while executing",
      );
    }

    await this.#recordToolResult(context, call, result, {
      ...(decision.matchedGrantId === undefined ? {} : { grantId: decision.matchedGrantId }),
      requirement,
    });
    return result;
  }

  async invokeResource(
    context: AccessContext,
    request: ResourceInvocationRequest,
    options: KernelOperationOptions = {},
  ): Promise<ResourceResult> {
    throwIfAborted(options.signal);
    context = structuredClone(context);
    request = structuredClone(request);
    request = {
      ...request,
      resource: {
        ...request.resource,
        owner: request.resource.owner ?? context.owner,
      },
    };
    const authority = await this.#resolveAuthority(context, options.signal);
    if (authority.status !== "resolved") {
      const result = deniedResourceResult(
        request,
        context.now,
        "authority_unavailable",
        "Authority could not be loaded from its trusted source",
      );
      await this.#recordResourceResult(context, request, result);
      return result;
    }

    const decision = await this.#authorize(
      context,
      authority.authority,
      { resource: request.resource, action: request.action },
      true,
    );
    if (!decision.allowed) {
      const result = deniedResourceResult(
        request,
        context.now,
        decision.reasonCode,
        "The access context does not grant this resource capability",
      );
      await this.#recordResourceResult(context, request, result);
      return result;
    }

    const provider = this.#resources.get(request.resource.namespace);
    let result: ResourceResult;
    if (provider === undefined) {
      result = failedResourceResult(
        request,
        context.now,
        "resource_provider_not_found",
        "No provider is registered for the requested resource namespace",
      );
    } else {
      try {
        throwIfAborted(options.signal);
        const candidate = await provider.invoke(
          toResourceOperation(context, request),
          options.signal ?? neverAbortedSignal(),
        );
        const parsed = ResourceResultSchema.safeParse(candidate);
        result =
          parsed.success && parsed.data.operationId === request.operationId
            ? parsed.data
            : failedResourceResult(
                request,
                context.now,
                "invalid_resource_result",
                "The resource provider returned an invalid protocol result",
              );
      } catch (error) {
        if (options.signal?.aborted) {
          throw options.signal.reason ?? error;
        }
        this.#reportProviderError(error, context, {
          kind: "resource",
          reasonCode: "resource_execution_failed",
          operationId: request.operationId,
          resource: request.resource,
          action: request.action,
        });
        result = failedResourceResult(
          request,
          context.now,
          "resource_execution_failed",
          "The resource provider failed while executing",
        );
      }
    }

    await this.#recordResourceResult(context, request, result, decision.matchedGrantId);
    return result;
  }

  async #resolveToolRegistry(
    context: AccessContext,
    signal: AbortSignal | undefined,
  ): Promise<ToolRegistry> {
    const resolved = new ToolRegistry();
    for (const handler of this.#tools.handlers()) {
      resolved.register(handler);
    }

    if (this.#messageTransport !== undefined && this.#messageRequestRouter !== undefined) {
      resolved.register(
        createMessageRequestTool({
          capabilityResolver: this.#messageCapabilityResolver,
          router: this.#messageRequestRouter,
          createMessageId: this.#createMessageId,
          reportProviderError: (error, access, operation) =>
            this.#reportProviderError(error, access, operation),
          deliverAuthorizedMessage: (access, envelope, operationSignal, operationId) =>
            this.#deliverAuthorizedMessage(
              access,
              envelope,
              operationSignal,
              undefined,
              operationId,
            ),
        }),
      );
    }

    for (const provider of [...this.#toolProviders.values()].sort((left, right) =>
      left.id.localeCompare(right.id),
    )) {
      throwIfAborted(signal);
      let handlers: readonly ToolHandler[];
      try {
        handlers = await provider.listTools(
          structuredClone(context),
          signal ?? neverAbortedSignal(),
        );
      } catch (error) {
        if (signal?.aborted) {
          throw signal.reason ?? error;
        }
        // Wrapped rather than re-thrown, so every caller sees one sentence for
        // "the catalogue could not be built" -- and `cause`d, so the provider's
        // own error survives to whoever ends up looking. `listTools` lets this
        // reach its caller; `invokeTool` contains it and reports it.
        throw new Error("A context tool provider failed to resolve its catalog", { cause: error });
      }
      if (!Array.isArray(handlers)) {
        throw new TypeError("A context tool provider returned an invalid catalog");
      }
      for (const handler of handlers) {
        // Deliberately not wrapped. A handler the registry refuses throws a
        // named error -- `DuplicateRegistrationError`, or a `TypeError` naming
        // what about the definition was wrong -- and a caller of `listTools`
        // both sees and matches on those today. Wrapping them to make the
        // diagnostic hook's `cause` unconditional would trade a typed error a
        // host can branch on for a sentence it cannot, which is the wrong way
        // round; the hook's contract says instead that it reports the error as
        // thrown, and names the one case that is wrapped.
        resolved.register(handler);
      }
    }

    return resolved;
  }

  async sendMessage(
    context: AccessContext,
    envelope: MessageEnvelope,
    options: KernelOperationOptions = {},
  ): Promise<MessageDeliveryResult> {
    throwIfAborted(options.signal);
    let parsedEnvelope: ReturnType<typeof MessageEnvelopeSchema.safeParse>;
    try {
      parsedEnvelope = MessageEnvelopeSchema.safeParse(structuredClone(envelope));
    } catch {
      throw new TypeError("message envelope does not match the SharedOS contract");
    }
    if (!parsedEnvelope.success) {
      throw new TypeError("message envelope does not match the SharedOS contract");
    }
    context = structuredClone(context);
    envelope = parsedEnvelope.data;
    if (
      !addressesEqual(context.actor, envelope.sender) ||
      context.purpose !== envelope.purpose ||
      context.traceId !== envelope.traceId
    ) {
      const result = deniedMessageResult(
        envelope,
        context.now,
        "message_context_mismatch",
        "Message sender, purpose, or trace does not match its access context",
      );
      await this.#recordMessageResult(context, envelope, result);
      return result;
    }

    let requirement: AuthorizationRequest;
    try {
      requirement = this.#messageCapabilityResolver.resolve(
        structuredClone(context),
        structuredClone(envelope),
      );
    } catch (error) {
      this.#reportProviderError(error, context, {
        kind: "message",
        reasonCode: "message_requirement_resolution_failed",
      });
      const result = failedMessageResult(
        envelope,
        context.now,
        "message_requirement_resolution_failed",
        "The message capability requirement could not be resolved",
      );
      await this.#recordMessageResult(context, envelope, result);
      return result;
    }
    const authority = await this.#resolveAuthority(context, options.signal);
    if (authority.status !== "resolved") {
      const result = deniedMessageResult(
        envelope,
        context.now,
        "authority_unavailable",
        "Authority could not be loaded from its trusted source",
      );
      await this.#recordMessageResult(context, envelope, result);
      return result;
    }

    const decision = await this.#authorize(context, authority.authority, requirement, true);
    if (!decision.allowed) {
      const result = deniedMessageResult(
        envelope,
        context.now,
        decision.reasonCode,
        "The access context does not grant permission to send this message",
      );
      await this.#recordMessageResult(context, envelope, result);
      return result;
    }

    return this.#deliverAuthorizedMessage(
      context,
      envelope,
      options.signal ?? neverAbortedSignal(),
      decision.matchedGrantId,
    );
  }

  /** Deliver and audit a message whose exact send requirement was already consumed. */
  async #deliverAuthorizedMessage(
    context: AccessContext,
    envelope: MessageEnvelope,
    signal: AbortSignal,
    grantId?: string,
    operationId?: string,
  ): Promise<MessageDeliveryResult> {
    const trustedContext = deepFreeze(structuredClone(context));
    const trustedEnvelope = deepFreeze(structuredClone(envelope));
    if (this.#messageTransport === undefined) {
      const result = failedMessageResult(
        trustedEnvelope,
        trustedContext.now,
        "message_transport_not_configured",
        "No message transport is configured",
      );
      await this.#recordMessageResult(
        trustedContext,
        trustedEnvelope,
        result,
        grantId,
        operationId,
      );
      return result;
    }

    let result: MessageDeliveryResult;
    try {
      throwIfAborted(signal);
      const receipt = await this.#messageTransport.deliver(
        structuredClone(trustedContext),
        structuredClone(trustedEnvelope),
        signal,
      );
      const parsed = MessageDeliveryResultSchema.safeParse(receipt);
      result =
        parsed.success && parsed.data.messageId === trustedEnvelope.id
          ? parsed.data
          : failedMessageResult(
              trustedEnvelope,
              trustedContext.now,
              "invalid_message_receipt",
              "The message transport returned a mismatched receipt",
            );
    } catch (error) {
      if (signal.aborted) {
        throw signal.reason ?? error;
      }
      this.#reportProviderError(error, trustedContext, {
        kind: "message",
        reasonCode: "message_delivery_failed",
        ...(operationId === undefined ? {} : { operationId }),
      });
      result = failedMessageResult(
        trustedEnvelope,
        trustedContext.now,
        "message_delivery_failed",
        "The message transport failed while delivering the message",
      );
    }

    await this.#recordMessageResult(trustedContext, trustedEnvelope, result, grantId, operationId);
    return result;
  }

  /**
   * Decide and audit one request.
   *
   * The decision is made against `authority`, whose context carries the instant
   * the turn's authority was resolved, and against the live `context`, which
   * carries the instant of this operation. The grant set is the turn's; the
   * clock is the operation's, so a grant whose validity window closed while the
   * turn was running is refused here rather than at the next turn. See
   * `grantIsActive` in `internal.ts` for which removals move with the operation
   * and which stay with the turn.
   *
   * The audit event is written against the live `context` too, so a record
   * states when each decision happened rather than restamping every one of them
   * with the turn's opening instant.
   */
  /**
   * One decision against authority the turn already holds.
   *
   * Measured as a unit, audit included. The write is not separable from the
   * decision in any way a host could act on: a decision that was not recorded
   * did not happen as far as the evidence is concerned, so a cost figure that
   * left the record out would be the cost of a decision SharedOS does not make.
   */
  async #authorize(
    context: AccessContext,
    authority: ResolvedAuthority,
    request: AuthorizationRequest,
    consume: boolean,
    /**
     * The operation this decision was made for, when there is one.
     *
     * Carried onto the span and audit event, never into the decision. Every
     * record produced for one call names that call, which is what lets a report
     * attribute the cost and outcome to the same operation. An operation that
     * is not a tool call -- a bare `authorize`, a turn admission -- has no id.
     */
    operationId?: string,
  ): Promise<AuthorizationDecision> {
    return measure(
      this.#spans,
      SPAN.AUTHORIZE,
      (span) => {
        if (operationId !== undefined) {
          span.set("callId", operationId);
        }
        span.set("consumed", consume);
        return this.#decideAndRecord(context, authority, request, consume, operationId);
      },
      (decision, span) => span.set("outcome", decision.allowed ? "allowed" : "denied"),
    );
  }

  async #decideAndRecord(
    context: AccessContext,
    authority: ResolvedAuthority,
    request: AuthorizationRequest,
    consume: boolean,
    operationId?: string,
  ): Promise<AuthorizationDecision> {
    const decision = await this.#authorizer.authorize(authority, request, {
      consume,
      now: context.now,
    });

    await this.#recordAuthorizationDecision(
      context,
      request,
      decision,
      consume,
      authority.snapshot.hash,
      operationId,
    );

    return decision;
  }

  /**
   * The authority one operation is decided against.
   *
   * A turn that opened a lease is answered from it, with no store read and no
   * second `authority.resolved` event: the turn loaded its authority once and
   * every decision in it names that one state. An operation outside any turn
   * resolves its own.
   *
   * Setting `MID_TURN_AUTHORITY_REFRESH` skips the lease entirely and restores
   * per-operation resolution, in which a grant removed from the store mid-turn
   * is refused at the next decision inside that turn. See the constant for why
   * that is off and what is still open about it.
   */
  async #resolveAuthority(
    context: AccessContext,
    signal: AbortSignal | undefined,
  ): Promise<AuthorityResolution> {
    if (!MID_TURN_AUTHORITY_REFRESH) {
      const lease = this.#leases.get(turnAuthorityKey(context));
      if (lease !== undefined) {
        return lease.resolution;
      }
    }
    return this.#loadAuthority(context, signal);
  }

  /** Read authority from the trusted source once, and audit the attempt. */
  async #loadAuthority(
    context: AccessContext,
    signal: AbortSignal | undefined,
  ): Promise<AuthorityResolution> {
    return measure(
      this.#spans,
      SPAN.AUTHORITY_LOAD,
      () => this.#loadAuthorityOnce(context, signal),
      (resolution, span) =>
        span.set("outcome", resolution.status === "resolved" ? "resolved" : "unavailable"),
    );
  }

  async #loadAuthorityOnce(
    context: AccessContext,
    signal: AbortSignal | undefined,
  ): Promise<AuthorityResolution> {
    const abort = signal ?? neverAbortedSignal();
    // A turn resolves one grant set and one policy set, and the two loads are
    // in flight together: neither reads the other's result, and the record of
    // the load says what each port did even on a turn where the other failed.
    const [resolved, hostPolicy] = await Promise.all([
      this.#authority.resolve(context, abort),
      this.#loadHostPolicy(context, abort),
    ]);
    const resolution: AuthorityResolution =
      resolved.status === "resolved" && hostPolicy !== undefined
        ? { status: "resolved", authority: { ...resolved.authority, hostPolicy } }
        : resolved;
    await this.#audit.record(
      auditEvent(
        context,
        resolution.status === "resolved"
          ? {
              type: "authority.resolved",
              outcome: "succeeded",
              authorityHash: resolution.authority.snapshot.hash,
              metadata: {
                grantIds: [...resolution.authority.snapshot.grantIds],
                grantCount: resolution.authority.snapshot.grantCount,
                hostCeiling: this.#hostCeilingState(),
                hostPolicy: hostPolicyState(hostPolicy),
              },
            }
          : {
              type: "authority.resolved",
              outcome: "failed",
              reason: "authority_unavailable",
              metadata: {
                failClosed: true,
                authority: resolution.code,
                hostCeiling: this.#hostCeilingState(),
                hostPolicy: hostPolicyState(hostPolicy),
              },
            },
      ),
    );
    return resolution;
  }

  /**
   * Read the turn's host policy from its source once, failing closed.
   *
   * `undefined` when no source is installed, which is a different fact from a
   * source that failed: the first hands the ceiling nothing and lets it decide
   * over its own state; the second refuses every decision the ceiling would
   * have made. The error is reported here, once per turn, rather than on each
   * decision it fails, because one outage is one report. A cancelled load is
   * re-thrown, not reported: a caller that stopped the work is not a defect.
   *
   * A source that answered without naming what it loaded is as broken as one
   * that threw. Nothing could pin a decision to the policy it was made against,
   * so nothing is decided against it: the same outage, the same report.
   */
  async #loadHostPolicy(
    context: AccessContext,
    signal: AbortSignal,
  ): Promise<PolicyResolution | undefined> {
    if (this.#policySource === undefined) {
      return undefined;
    }
    let loaded: unknown;
    try {
      loaded = await this.#policySource.load(structuredClone(context), signal);
    } catch (error) {
      if (signal.aborted) {
        throw signal.reason ?? error;
      }
      this.#reportPolicyOutage(context, error);
      return { status: "unavailable" };
    }
    if (!isLoadedPolicy(loaded)) {
      this.#reportPolicyOutage(
        context,
        new TypeError(
          "A policy source must resolve to { policy, version } with a non-empty version",
        ),
      );
      return { status: "unavailable" };
    }
    return { status: "loaded", policy: loaded.policy, version: loaded.version };
  }

  #reportPolicyOutage(context: AccessContext, error: unknown): void {
    reportContainedError(this.#onProviderError, error, {
      kind: "policy",
      reasonCode: "host_policy_unavailable",
      traceId: context.traceId,
      namespaceId: context.namespaceId,
    });
  }

  /**
   * Whether product policy can refuse anything in this deployment.
   *
   * Recorded on every turn's authority load so an audit stream is readable
   * without knowing how the kernel was constructed. A stream with no
   * `host_policy_denied` in it means one thing when no ceiling is installed and
   * something else entirely when one is, and nothing else in the record
   * separates them (ADR 0020).
   */
  #hostCeilingState(): "installed" | "absent" {
    return this.#authorizer.hasHostCeiling ? "installed" : "absent";
  }

  async #denyUnavailableAuthority(
    context: AccessContext,
    request: AuthorizationRequest,
    code: AuthorityUnavailableCode,
    consume: boolean,
  ): Promise<AuthorizationDecision> {
    const decision: AuthorizationDecision = {
      allowed: false,
      reasonCode: "authority_unavailable",
      metadata: { authority: { code } },
    };
    await this.#recordAuthorizationDecision(context, request, decision, consume);
    return decision;
  }

  async #recordAuthorizationDecision(
    context: AccessContext,
    request: AuthorizationRequest,
    decision: AuthorizationDecision,
    consume: boolean,
    authorityHash?: string,
    operationId?: string,
  ): Promise<void> {
    await this.#audit.record(
      auditEvent(context, {
        type: "authorization.checked",
        outcome: decision.allowed ? "allowed" : "denied",
        resource: request.resource,
        action: request.action,
        ...(authorityHash === undefined ? {} : { authorityHash }),
        ...(operationId === undefined ? {} : { operationId }),
        ...(decision.matchedGrantId === undefined ? {} : { grantId: decision.matchedGrantId }),
        ...(!decision.allowed ? { reason: decision.reasonCode } : {}),
        metadata: {
          // A decision may carry metadata of its own: a host ceiling's rule,
          // or the authorizer's delegation detail on a broken chain. The two
          // keys the kernel states are removed from it rather than overwritten.
          // Order alone would already win for `consumed`, but not for
          // `failClosed`, which is only ever *set* on an infrastructure denial:
          // a port's `failClosed: false` would stand on every other denial, and
          // a `failClosed: true` would move a deliberate refusal out of the
          // policy counts it belongs in. Both are stripped, so the rule is one
          // rule rather than one that happens to hold for one of the keys.
          ...decisionMetadata(decision.metadata),
          consumed: consume,
          ...(isInfrastructureDenial(decision.reasonCode) ? { failClosed: true } : {}),
        },
      }),
    );
  }

  async #recordToolResult(
    context: AccessContext,
    call: ToolCall,
    result: ToolResult,
    detail: ToolResultAuditDetail = {},
  ): Promise<void> {
    const { grantId, requirement, cause } = detail;
    await this.#recordOutcome(
      auditEvent(context, {
        type: "tool.invoked",
        outcome: result.status,
        operationId: call.id,
        tool: call.tool,
        ...(requirement === undefined
          ? {}
          : {
              resource: requirement.resource,
              action: requirement.action,
            }),
        ...(grantId === undefined ? {} : { grantId }),
        ...(result.status === "succeeded" ? {} : { reason: result.error.code }),
        metadata: {
          // Which boundary refused. Free to infer until the envelope started
          // recording too -- anything in audit was the kernel's -- and a fact
          // with nowhere to live the moment that stopped being true (ADR 0023).
          source: "kernel",
          // `tool_unavailable` is one code over several situations by design,
          // so the model cannot tell them apart. An audit reader is not the
          // model. `reason` stays the code the caller was given and this says
          // which one it was.
          ...(cause === undefined ? {} : { cause }),
          ...(result.status !== "succeeded" && isInfrastructureDenial(result.error.code)
            ? { failClosed: true }
            : {}),
        },
      }),
    );
  }

  async #recordResourceResult(
    context: AccessContext,
    request: ResourceInvocationRequest,
    result: ResourceResult,
    grantId?: string,
  ): Promise<void> {
    await this.#recordOutcome(
      auditEvent(context, {
        type: "resource.invoked",
        outcome: result.status,
        operationId: request.operationId,
        resource: request.resource,
        action: request.action,
        ...(grantId === undefined ? {} : { grantId }),
        ...(result.status === "succeeded" ? {} : { reason: result.error.code }),
        metadata: { source: "kernel" },
      }),
    );
  }

  async #recordMessageResult(
    context: AccessContext,
    envelope: MessageEnvelope,
    result: MessageDeliveryResult,
    grantId?: string,
    operationId?: string,
  ): Promise<void> {
    await this.#recordOutcome(
      auditEvent(context, {
        type: "message.sent",
        outcome:
          result.status === "accepted" || result.status === "delivered"
            ? "succeeded"
            : result.status,
        messageId: envelope.id,
        receiver: envelope.receiver,
        ...(operationId === undefined ? {} : { operationId }),
        ...(grantId === undefined ? {} : { grantId }),
        ...(result.status === "denied" || result.status === "failed"
          ? { reason: result.error.code }
          : {}),
        metadata: { source: "kernel" },
      }),
    );
  }

  /**
   * Hand one contained throw to the host's diagnostic sink.
   *
   * The context is assembled here rather than at each catch so every call site
   * contributes only what is specific to it -- what kind of port failed, the
   * code returned in its place, and whichever identifiers that path has -- and
   * the trace and namespace come from the one place that always knows them.
   */
  #reportProviderError(
    error: unknown,
    context: AccessContext,
    operation: Omit<ProviderErrorContext, "traceId" | "namespaceId">,
  ): void {
    reportContainedError(this.#onProviderError, error, {
      ...operation,
      traceId: context.traceId,
      namespaceId: context.namespaceId,
    });
  }

  async #recordOutcome(event: AuditEvent): Promise<void> {
    try {
      await this.#audit.record(event);
    } catch (error) {
      try {
        await this.#onAuditError?.(error, event);
      } catch {
        // A post-effect observability hook must not turn success into a retry.
      }
    }
  }
}

/**
 * Metadata the decision itself carried, less the two keys the kernel states.
 *
 * Two things produce it, and naming only the newer one would be misleading: a
 * `HostCeiling` saying which rule refused, and the authorizer's own delegation
 * detail on a broken chain. The latter is the reason this is a behaviour change
 * as well as a guard -- until now no decision metadata reached audit at all.
 */
function decisionMetadata(metadata: JsonObject | undefined): JsonObject {
  if (metadata === undefined) {
    return {};
  }
  const { consumed: _consumed, failClosed: _failClosed, ...rest } = metadata;
  return rest;
}

/**
 * Wrap one resolution as a turn handle whose `close` runs at most once.
 *
 * Double-closing would release a lease another turn still holds, so the guard
 * is here rather than in every caller's cleanup path.
 */
function scopeFor(resolution: AuthorityResolution, release: () => void): TurnAuthorityScope {
  let closed = false;
  return {
    status: resolution.status,
    ...(resolution.status === "resolved"
      ? { snapshot: resolution.authority.snapshot }
      : { code: resolution.code }),
    close: (): void => {
      if (closed) {
        return;
      }
      closed = true;
      release();
    },
  };
}

function deniedToolResult(
  call: ToolCall,
  completedAt: string,
  code: string,
  message: string,
): ToolResult {
  return {
    callId: call.id,
    tool: call.tool,
    status: "denied",
    completedAt,
    error: protocolError(code, message),
  };
}

function failedToolResult(
  call: ToolCall,
  completedAt: string,
  code: string,
  message: string,
): ToolResult {
  return {
    callId: call.id,
    tool: call.tool,
    status: "failed",
    completedAt,
    error: protocolError(code, message),
  };
}

function deniedResourceResult(
  request: ResourceInvocationRequest,
  completedAt: string,
  code: string,
  message: string,
): ResourceResult {
  return {
    operationId: request.operationId,
    status: "denied",
    completedAt,
    error: protocolError(code, message),
  };
}

function failedResourceResult(
  request: ResourceInvocationRequest,
  completedAt: string,
  code: string,
  message: string,
): ResourceResult {
  return {
    operationId: request.operationId,
    status: "failed",
    completedAt,
    error: protocolError(code, message),
  };
}

function deniedMessageResult(
  envelope: MessageEnvelope,
  completedAt: string,
  code: string,
  message: string,
): MessageDeliveryResult {
  return {
    messageId: envelope.id,
    status: "denied",
    timestamp: completedAt,
    error: protocolError(code, message),
  };
}

function failedMessageResult(
  envelope: MessageEnvelope,
  completedAt: string,
  code: string,
  message: string,
): MessageDeliveryResult {
  return {
    messageId: envelope.id,
    status: "failed",
    timestamp: completedAt,
    error: protocolError(code, message),
  };
}

function protocolError(code: string, message: string): ProtocolError {
  return { code, message, retryable: false };
}

/**
 * Whether a resolved requirement stays inside the caller's own world.
 *
 * An omitted owner is the context's own owner, so only an explicitly named
 * foreign owner crosses the boundary. This is the same rule
 * `CapabilityAuthorizer` applies; it is asked here only to decide *which*
 * refusal a crossing is, never to perform the refusal itself.
 */
function requirementBelongsToContext(
  requirement: AuthorizationRequest,
  context: AccessContext,
): boolean {
  return (
    requirement.resource.owner === undefined ||
    addressesEqual(requirement.resource.owner, context.owner)
  );
}

/**
 * Whether a resolved requirement stays inside the ceiling the tool declared.
 *
 * By the time this runs the requirement is known to name the context's own
 * owner, so the owner comparison here catches the remaining case: a tool whose
 * declared capability names some *other* owner outright.
 */
function requirementIsWithinDefinition(
  definition: ToolDefinition,
  requirement: AuthorizationRequest,
  context: AccessContext,
): boolean {
  const declared = definition.requiredCapability;
  const declaredOwner = declared.resource.owner ?? context.owner;
  const requestedOwner = requirement.resource.owner ?? context.owner;

  return (
    requirement.action === declared.action &&
    requirement.resource.namespace === declared.resource.namespace &&
    addressesEqual(declaredOwner, requestedOwner) &&
    declared.resource.path.length <= requirement.resource.path.length &&
    declared.resource.path.every((segment, index) => segment === requirement.resource.path[index])
  );
}

let fallbackSignal: AbortSignal | undefined;

function neverAbortedSignal(): AbortSignal {
  fallbackSignal ??= new AbortController().signal;
  return fallbackSignal;
}

/**
 * What one turn's policy load came to, for the `authority.resolved` record.
 *
 * `absent` says no `PolicySource` is installed, not that there is no policy: a
 * ceiling may close over its own. Beside `hostCeiling`, it lets a reader tell a
 * deployment whose ceiling decides over loaded state from one whose ceiling
 * decides over state it carries, and a turn that could not load its policy --
 * every policy decision in it fail-closed -- from one that could (ADR 0020).
 */
function isLoadedPolicy(value: unknown): value is LoadedPolicy {
  return (
    typeof value === "object" &&
    value !== null &&
    "policy" in value &&
    "version" in value &&
    typeof value.version === "string" &&
    value.version.length > 0
  );
}

function hostPolicyState(
  hostPolicy: PolicyResolution | undefined,
): "loaded" | "unavailable" | "absent" {
  return hostPolicy === undefined ? "absent" : hostPolicy.status;
}
