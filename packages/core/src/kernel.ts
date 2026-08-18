import type {
  AccessContext,
  Address,
  AuthorizationDecision,
  Capability,
  MessageDeliveryResult,
  MessageEnvelope,
  ProtocolError,
  ResourceResult,
  ToolCall,
  ToolDefinition,
  ToolNamespaceCatalog,
  ToolNamespaceUpdate,
  ToolResult,
} from "@aicoo/sharedos-contracts";
import {
  EnabledToolNamespacesSchema,
  JsonObjectSchema,
  MessageDeliveryResultSchema,
  ResourceResultSchema,
  ToolNamespaceUpdateSchema,
  ToolResultSchema,
} from "@aicoo/sharedos-contracts";

import { type AuditEvent, type AuditSink, NoopAuditSink, auditEvent } from "./audit.js";
import {
  type AuthorityResolution,
  type AuthorityUnavailableCode,
  type GrantSource,
  type ResolvedAuthority,
  TrustedAuthorityResolver,
} from "./authority.js";
import {
  type AuthorizationRequest,
  CapabilityAuthorizer,
  addressesEqual,
  isInfrastructureDenial,
} from "./authorization.js";
import {
  type MessageCapabilityResolver,
  type MessageTransport,
  RecipientScopedMessageCapabilityResolver,
  addressPath,
} from "./message-service.js";
import {
  type ResourceInvocationRequest,
  type ResourceProvider,
  ResourceProviderRegistry,
  toResourceOperation,
} from "./resource-registry.js";
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
  readonly messageCapabilityResolver?: MessageCapabilityResolver;
  readonly audit?: AuditSink;
  /** Notification for audit failures that occur after a side effect. */
  readonly onAuditError?: (error: unknown, event: AuditEvent) => void | Promise<void>;
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

/**
 * Host-neutral facade for every permission-controlled SharedOS operation.
 * AccessContext is a trusted host-created boundary; never construct it from an
 * unverified request body.
 */
export class SharedOSKernel {
  readonly #authority: TrustedAuthorityResolver;
  readonly #authorizer: CapabilityAuthorizer;
  readonly #resources: ResourceProviderRegistry;
  readonly #tools: ToolRegistry;
  readonly #toolProviders: Map<string, ContextToolProvider>;
  readonly #toolNamespaceSettings: ToolNamespaceSettingsStore | undefined;
  readonly #messageTransport: MessageTransport | undefined;
  readonly #messageCapabilityResolver: MessageCapabilityResolver;
  readonly #audit: AuditSink;
  readonly #onAuditError: ((error: unknown, event: AuditEvent) => void | Promise<void>) | undefined;

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
    this.#messageCapabilityResolver =
      options.messageCapabilityResolver ?? new RecipientScopedMessageCapabilityResolver();
    this.#audit = options.audit ?? new NoopAuditSink();
    this.#onAuditError = options.onAuditError;
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
    return this.#authorize(authority.authority, request, false);
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
    return this.#authorize(authority.authority, request, true);
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

  async invokeTool(
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
      tools = await this.#resolveToolRegistry(context, options.signal);
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

    const discoverable = await this.#authorizer.canDiscover(authority.authority, {
      resource: handler.definition.requiredCapability.resource,
      action: handler.definition.requiredCapability.action,
    });
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
      authority.authority,
      { resource: requirement.resource, action: requirement.action },
      true,
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
      const candidate = await handler.invoke(
        context,
        parsedCall,
        options.signal ?? neverAbortedSignal(),
      );
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
    context = structuredClone(context);
    envelope = structuredClone(envelope);
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
      requirement = this.#messageCapabilityResolver.resolve(context, envelope);
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

    const decision = await this.#authorize(authority.authority, requirement, true);
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

    if (this.#messageTransport === undefined) {
      const result = failedMessageResult(
        envelope,
        context.now,
        "message_transport_not_configured",
        "No message transport is configured",
      );
      await this.#recordMessageResult(context, envelope, result, decision.matchedGrantId);
      return result;
    }

    let result: MessageDeliveryResult;
    try {
      throwIfAborted(options.signal);
      const receipt = await this.#messageTransport.deliver(
        context,
        envelope,
        options.signal ?? neverAbortedSignal(),
      );
      const parsed = MessageDeliveryResultSchema.safeParse(receipt);
      result =
        parsed.success && parsed.data.messageId === envelope.id
          ? parsed.data
          : failedMessageResult(
              envelope,
              context.now,
              "invalid_message_receipt",
              "The message transport returned a mismatched receipt",
            );
    } catch (error) {
      if (options.signal?.aborted) {
        throw options.signal.reason ?? error;
      }
      result = failedMessageResult(
        envelope,
        context.now,
        "message_delivery_failed",
        "The message transport failed while delivering the message",
      );
    }

    await this.#recordMessageResult(context, envelope, result, decision.matchedGrantId);
    return result;
  }

  async #authorize(
    authority: ResolvedAuthority,
    request: AuthorizationRequest,
    consume: boolean,
  ): Promise<AuthorizationDecision> {
    const decision = await this.#authorizer.authorize(authority, request, {
      consume,
    });

    await this.#recordAuthorizationDecision(
      authority.context,
      request,
      decision,
      consume,
      authority.snapshot.hash,
    );

    return decision;
  }

  /**
   * Loads authority for one operation.
   *
   * Every kernel operation resolves separately, so revoking a grant takes
   * effect at the next decision inside a running turn rather than at the next
   * turn.
   */
  async #resolveAuthority(
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
  ): Promise<void> {
    await this.#audit.record(
      auditEvent(context, {
        type: "authorization.checked",
        outcome: decision.allowed ? "allowed" : "denied",
        resource: request.resource,
        action: request.action,
        ...(authorityHash === undefined ? {} : { authorityHash }),
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
