import type {
  AccessContext,
  Address,
  AuthorizationDecision,
  Capability,
  Escalation,
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
  MID_TURN_AUTHORITY_REFRESH,
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
import { buildToolCatalog } from "./published-tool.js";
import { SPAN, measure, type SpanSink } from "./spans.js";
import { type ContextToolProvider, type ToolHandler, ToolRegistry } from "./tool-registry.js";
import type { ToolNamespaceSettingsStore } from "./tool-namespace-control.js";
import { DuplicateRegistrationError, MissingRegistrationError } from "./errors.js";

export interface SharedOSKernelOptions {
  /**
   * The trusted boundary that loads authority. It is required: a kernel with
   * no authoritative grant source can only fail closed.
   */
  readonly grantSource: GrantSource;
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
  readonly #spans: SpanSink | undefined;

  constructor(options: SharedOSKernelOptions) {
    this.#authority = new TrustedAuthorityResolver(options?.grantSource);
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
    options: KernelOperationOptions = {},
  ): Promise<Escalation> {
    throwIfAborted(options.signal);
    context = structuredClone(context);
    const parsed = EscalationSchema.safeParse({
      reason,
      reviewer: context.owner,
      requestedAt: context.now,
      status: "pending",
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
      }),
    );

    return parsed.data;
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
          metadata: { visibleTools: [], failClosed: true, authority: authority.code },
        }),
      );
      return [];
    }

    const allowed: ToolDefinition[] = [];
    const enabledNamespaces = new Set(context.enabledToolNamespaces);
    const tools = await this.#resolveToolRegistry(context, options.signal);

    for (const definition of tools.definitions()) {
      throwIfAborted(options.signal);
      if (!enabledNamespaces.has(definition.namespace)) {
        continue;
      }
      const decision = await this.#authorizer.canDiscover(authority.authority, {
        resource: definition.requiredCapability.resource,
        action: definition.requiredCapability.action,
      });
      if (decision.allowed) {
        allowed.push(definition);
      }
    }

    await this.#audit.record(
      auditEvent(context, {
        type: "tool.catalog.listed",
        outcome: "succeeded",
        authorityHash: authority.authority.snapshot.hash,
        metadata: { visibleTools: allowed.map(({ name }) => name) },
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
      await this.#recordToolResult(context, call, result);
      return result;
    }

    if (!context.enabledToolNamespaces.includes(handler.definition.namespace)) {
      const result = deniedToolResult(
        call,
        context.now,
        "tool_unavailable",
        "The requested tool is not available in this access context",
      );
      await this.#recordToolResult(context, call, result);
      return result;
    }

    const discoverable = await measure(
      this.#spans,
      SPAN.TOOL_DISCOVER,
      (span) => {
        span.set("callId", call.id);
        return this.#authorizer.canDiscover(authority.authority, {
          resource: handler.definition.requiredCapability.resource,
          action: handler.definition.requiredCapability.action,
        });
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
      await this.#recordToolResult(context, call, result);
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
    } catch {
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
    } catch {
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
      await this.#recordToolResult(context, call, result, undefined, requirement);
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
      await this.#recordToolResult(context, call, result, undefined, requirement);
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
      result = failedToolResult(
        call,
        context.now,
        "tool_execution_failed",
        "The tool failed while executing",
      );
    }

    await this.#recordToolResult(context, call, result, decision.matchedGrantId, requirement);
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
        throw new Error("A context tool provider failed to resolve its catalog");
      }
      if (!Array.isArray(handlers)) {
        throw new TypeError("A context tool provider returned an invalid catalog");
      }
      for (const handler of handlers) {
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
    } catch {
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
   * the turn's authority was resolved. The audit event is written against the
   * live `context`, so a record still states when each decision happened rather
   * than restamping every one of them with the turn's opening instant.
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
    const decision = await this.#authorizer.authorize(authority, request, { consume });

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
    const resolution = await this.#authority.resolve(context, signal ?? neverAbortedSignal());
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
              },
            }
          : {
              type: "authority.resolved",
              outcome: "failed",
              reason: "authority_unavailable",
              metadata: { failClosed: true, authority: resolution.code },
            },
      ),
    );
    return resolution;
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
    grantId?: string,
    requirement?: AuthorizationRequest,
  ): Promise<void> {
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
        ...(result.status !== "succeeded" && isInfrastructureDenial(result.error.code)
          ? { metadata: { failClosed: true } }
          : {}),
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
      }),
    );
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

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw signal.reason ?? new Error("operation aborted");
  }
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
}
