import { describe, expect, it, vi } from "vitest";

import type {
  AccessContext,
  CapabilityGrant,
  MessageEnvelope,
  ResourceRef,
  ToolCall,
  ToolDefinition,
} from "@sharedos/contracts";

import type { AuditEvent, AuditSink } from "./audit.js";
import { CapabilityAuthorizer, InMemoryGrantUsageStore } from "./authorization.js";
import { SharedOSKernel } from "./kernel.js";
import { addressPath, type MessageTransport } from "./message-service.js";
import type { ResourceInvocationRequest, ResourceProvider } from "./resource-registry.js";
import {
  applyToolNamespaceUpdate,
  type ToolNamespaceSettingsStore,
} from "./tool-namespace-control.js";
import type { ContextToolProvider, ToolHandler } from "./tool-registry.js";

const NOW = "2026-08-03T09:00:00.000Z";
const ACTOR = { kind: "agent", agentId: "agent-bob" } as const;
const AUTHORITY = { kind: "human", userId: "user-alice" } as const;
const OWNER = { kind: "human", userId: "user-alice" } as const;
const RECEIVER = { kind: "agent", agentId: "agent-tina" } as const;

function grant(
  id: string,
  resource: ResourceRef,
  actions: string[],
  constraints: CapabilityGrant["constraints"] = {},
): CapabilityGrant {
  return {
    id,
    namespaceId: "world-alpha",
    subject: ACTOR,
    issuer: AUTHORITY,
    capabilities: [{ resource, actions, scope: "exact" }],
    constraints,
    issuedAt: "2026-08-03T08:00:00.000Z",
  };
}

function context(
  grants: CapabilityGrant[],
  enabledToolNamespaces: readonly string[] = ["files", "calendar"],
): AccessContext {
  return {
    namespaceId: "world-alpha",
    enabledToolNamespaces: [...enabledToolNamespaces],
    actor: ACTOR,
    authority: AUTHORITY,
    owner: OWNER,
    purpose: "prepare-update",
    traceId: "trace-1",
    grants,
    now: NOW,
  };
}

const FILE_RESOURCE: ResourceRef = {
  namespace: "files",
  path: ["Workspace", "project-sharedos"],
};

const FILE_TOOL: ToolDefinition = {
  name: "files.search",
  description: "Search files visible to the current agent",
  namespace: "files",
  source: "sharedos",
  readWrite: "read",
  inputSchema: { type: "object" },
  requiredCapability: { resource: FILE_RESOURCE, action: "search" },
  annotations: { readOnly: true },
};

const CALENDAR_TOOL: ToolDefinition = {
  name: "calendar.create",
  description: "Create a calendar event",
  namespace: "calendar",
  source: "native",
  readWrite: "write",
  inputSchema: { type: "object" },
  requiredCapability: {
    resource: { namespace: "calendar", path: ["primary"] },
    action: "create",
  },
  annotations: { destructive: true },
};

const NOTION_TOOL: ToolDefinition = {
  name: "mcp.notion.search",
  description: "Search one Notion workspace",
  namespace: "notion",
  source: "mcp",
  readWrite: "read",
  inputSchema: { type: "object" },
  requiredCapability: {
    resource: { namespace: "notion", path: ["workspace-a"] },
    action: "read",
  },
  annotations: { readOnly: true },
};

function toolCall(overrides: Partial<ToolCall> = {}): ToolCall {
  return {
    id: "call-1",
    tool: FILE_TOOL.name,
    arguments: { query: "architecture" },
    traceId: "trace-1",
    requestedAt: NOW,
    ...overrides,
  };
}

function successfulTool(definition = FILE_TOOL): ToolHandler {
  return {
    definition,
    parseArguments: (arguments_) => arguments_,
    async invoke(_context, call) {
      return {
        callId: call.id,
        tool: call.tool,
        status: "succeeded",
        output: { hits: ["memory-1"] },
        completedAt: NOW,
      };
    },
  };
}

describe("SharedOSKernel tools", () => {
  it("requires namespace enablement and capability authority independently", async () => {
    const invoke = vi.fn(successfulTool().invoke);
    const kernel = new SharedOSKernel();
    kernel.registerTool({
      definition: FILE_TOOL,
      parseArguments: (arguments_) => arguments_,
      invoke,
    });
    const fileGrant = grant("grant-search", FILE_RESOURCE, ["search"]);

    const namespaceDisabled = context([fileGrant], []);
    await expect(kernel.listTools(namespaceDisabled)).resolves.toEqual([]);
    await expect(kernel.invokeTool(namespaceDisabled, toolCall())).resolves.toMatchObject({
      status: "denied",
      error: { code: "tool_unavailable" },
    });

    const capabilityMissing = context([], ["files"]);
    await expect(kernel.listTools(capabilityMissing)).resolves.toEqual([]);
    await expect(kernel.invokeTool(capabilityMissing, toolCall())).resolves.toMatchObject({
      status: "denied",
      error: { code: "tool_unavailable" },
    });

    const fullyEnabled = context([fileGrant], ["files"]);
    await expect(kernel.listTools(fullyEnabled)).resolves.toEqual([FILE_TOOL]);
    await expect(kernel.invokeTool(fullyEnabled, toolCall())).resolves.toMatchObject({
      status: "succeeded",
    });
    expect(invoke).toHaveBeenCalledOnce();
  });

  it("lists namespace availability without treating it as authority", async () => {
    const kernel = new SharedOSKernel();
    kernel.registerTool(successfulTool(FILE_TOOL));
    kernel.registerTool(successfulTool(CALENDAR_TOOL));

    await expect(kernel.listToolNamespaces(context([], ["calendar"]))).resolves.toEqual({
      namespaces: [
        { namespace: "calendar", sources: ["native"], toolCount: 1, enabled: true },
        { namespace: "files", sources: ["sharedos"], toolCount: 1, enabled: false },
      ],
      summary: { total: 2, enabled: 1, disabled: 1 },
    });
    await expect(kernel.listTools(context([], ["calendar"]))).resolves.toEqual([]);
  });

  it("applies namespace updates through host-owned settings and returns the effective catalog", async () => {
    const events: AuditEvent[] = [];
    const applyUpdate = vi.fn<ToolNamespaceSettingsStore["applyUpdate"]>(async (access, update) =>
      applyToolNamespaceUpdate(access.enabledToolNamespaces, update),
    );
    const kernel = new SharedOSKernel({
      toolNamespaceSettings: { applyUpdate },
      audit: { record: async (event) => void events.push(event) },
    });
    kernel.registerTool(successfulTool(FILE_TOOL));
    kernel.registerTool(successfulTool(CALENDAR_TOOL));
    const access = context([], ["files"]);

    await expect(
      kernel.updateToolNamespaces(access, {
        enable: ["calendar"],
        disable: ["files"],
      }),
    ).resolves.toEqual({
      namespaces: [
        { namespace: "calendar", sources: ["native"], toolCount: 1, enabled: true },
        { namespace: "files", sources: ["sharedos"], toolCount: 1, enabled: false },
      ],
      summary: { total: 2, enabled: 1, disabled: 1 },
    });

    expect(access.enabledToolNamespaces).toEqual(["files"]);
    expect(applyUpdate).toHaveBeenCalledWith(
      access,
      { enable: ["calendar"], disable: ["files"] },
      expect.any(AbortSignal),
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "tool.namespace.selection.updated",
        outcome: "succeeded",
        metadata: { enabledNamespaces: ["calendar"] },
      }),
    );
  });

  it("fails namespace updates closed without a valid host settings store", async () => {
    await expect(
      new SharedOSKernel().updateToolNamespaces(context([], []), { enable: ["calendar"] }),
    ).rejects.toThrow("tool namespace settings is not registered");

    const kernel = new SharedOSKernel({
      toolNamespaceSettings: {
        async applyUpdate() {
          return ["calendar", "calendar"];
        },
      },
    });
    await expect(
      kernel.updateToolNamespaces(context([], []), { enable: ["calendar"] }),
    ).rejects.toThrow("tool namespace settings returned an invalid selection");
  });

  it("resolves user-specific MCP namespaces without mutating a global catalog", async () => {
    const githubTool: ToolDefinition = {
      ...NOTION_TOOL,
      name: "mcp.github.search",
      description: "Search one GitHub organization",
      namespace: "github",
      requiredCapability: {
        resource: { namespace: "github", path: ["org-a"] },
        action: "read",
      },
    };
    const provider: ContextToolProvider = {
      id: "user-mcp",
      async listTools(access) {
        await Promise.resolve();
        return access.namespaceId === "world-alpha"
          ? [successfulTool(NOTION_TOOL)]
          : [successfulTool(githubTool)];
      },
    };
    const kernel = new SharedOSKernel({ toolProviders: [provider] });
    const alpha = context([], ["notion"]);
    const beta = { ...context([], ["github"]), namespaceId: "world-beta" };

    const [alphaCatalog, betaCatalog] = await Promise.all([
      kernel.listToolNamespaces(alpha),
      kernel.listToolNamespaces(beta),
    ]);

    expect(alphaCatalog.namespaces).toEqual([
      { namespace: "notion", sources: ["mcp"], toolCount: 1, enabled: true },
    ]);
    expect(betaCatalog.namespaces).toEqual([
      { namespace: "github", sources: ["mcp"], toolCount: 1, enabled: true },
    ]);
  });

  it("fails closed when a context provider returns an ambiguous catalog", async () => {
    const staticInvoke = vi.fn(successfulTool(NOTION_TOOL).invoke);
    const dynamicInvoke = vi.fn(successfulTool(NOTION_TOOL).invoke);
    const kernel = new SharedOSKernel({
      toolProviders: [
        {
          id: "user-mcp",
          async listTools() {
            return [
              {
                definition: NOTION_TOOL,
                parseArguments: (arguments_) => arguments_,
                invoke: dynamicInvoke,
              },
            ];
          },
        },
      ],
    });
    kernel.registerTool({
      definition: NOTION_TOOL,
      parseArguments: (arguments_) => arguments_,
      invoke: staticInvoke,
    });
    const access = context(
      [grant("grant-notion", { namespace: "notion", path: ["workspace-a"] }, ["read"])],
      ["notion"],
    );

    await expect(kernel.listTools(access)).rejects.toThrow("tool is already registered");
    await expect(
      kernel.invokeTool(access, toolCall({ tool: NOTION_TOOL.name })),
    ).resolves.toMatchObject({
      status: "failed",
      error: { code: "tool_catalog_unavailable" },
    });
    expect(staticInvoke).not.toHaveBeenCalled();
    expect(dynamicInvoke).not.toHaveBeenCalled();
  });

  it("filters discovery and re-authorizes every invocation", async () => {
    const invoke = vi.fn(successfulTool().invoke);
    const kernel = new SharedOSKernel({
      authorizer: new CapabilityAuthorizer({ usageStore: new InMemoryGrantUsageStore() }),
    });
    kernel.registerTool({
      definition: FILE_TOOL,
      parseArguments: (arguments_) => arguments_,
      invoke,
    });
    kernel.registerTool(successfulTool(CALENDAR_TOOL));
    const access = context([grant("grant-search-once", FILE_RESOURCE, ["search"], { maxUses: 1 })]);

    await expect(kernel.listTools(access)).resolves.toEqual([FILE_TOOL]);
    await expect(kernel.listTools(access)).resolves.toEqual([FILE_TOOL]);

    await expect(kernel.invokeTool(access, toolCall())).resolves.toMatchObject({
      status: "succeeded",
    });
    await expect(kernel.invokeTool(access, toolCall({ id: "call-2" }))).resolves.toMatchObject({
      status: "denied",
      error: { code: "tool_unavailable" },
    });
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("rejects trace substitution before spending or calling a tool", async () => {
    const invoke = vi.fn(successfulTool().invoke);
    const kernel = new SharedOSKernel({
      authorizer: new CapabilityAuthorizer({ usageStore: new InMemoryGrantUsageStore() }),
    });
    kernel.registerTool({
      definition: FILE_TOOL,
      parseArguments: (arguments_) => arguments_,
      invoke,
    });
    const access = context([grant("grant-search", FILE_RESOURCE, ["search"], { maxUses: 1 })]);

    await expect(
      kernel.invokeTool(access, toolCall({ traceId: "trace-other" })),
    ).resolves.toMatchObject({
      status: "denied",
      error: { code: "trace_mismatch" },
    });
    await expect(kernel.invokeTool(access, toolCall())).resolves.toMatchObject({
      status: "succeeded",
    });
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("discovers a generic OS tool from a narrow grant and gates its exact arguments", async () => {
    const dynamicTool: ToolDefinition = {
      name: "files.read",
      description: "Read one selected file path",
      namespace: "files",
      source: "sharedos",
      readWrite: "read",
      inputSchema: { type: "object" },
      requiredCapability: {
        resource: { namespace: "files", path: [] },
        action: "read",
      },
    };
    const invoke = vi.fn<ToolHandler["invoke"]>(async (_access, call) => ({
      callId: call.id,
      tool: call.tool,
      status: "succeeded",
      output: { value: "permitted memory" },
      completedAt: NOW,
    }));
    const kernel = new SharedOSKernel();
    kernel.registerTool({
      definition: dynamicTool,
      parseArguments: (arguments_) => arguments_,
      resolveRequirement(_access, call) {
        const project = call.arguments["project"];
        if (typeof project !== "string") {
          throw new TypeError("project is required");
        }
        return {
          resource: { namespace: "files", path: ["Workspace", project] },
          action: "read",
        };
      },
      invoke,
    });
    const access = context([
      grant("grant-project-x", { namespace: "files", path: ["Workspace", "project-x"] }, ["read"]),
    ]);

    await expect(kernel.listTools(access)).resolves.toEqual([dynamicTool]);
    await expect(
      kernel.invokeTool(
        access,
        toolCall({
          id: "read-x",
          tool: "files.read",
          arguments: { project: "project-x" },
        }),
      ),
    ).resolves.toMatchObject({ status: "succeeded" });
    await expect(
      kernel.invokeTool(
        access,
        toolCall({
          id: "read-y",
          tool: "files.read",
          arguments: { project: "project-y" },
        }),
      ),
    ).resolves.toMatchObject({
      status: "denied",
      error: { code: "no_matching_grant" },
    });
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("rejects a dynamic requirement outside the tool declaration ceiling", async () => {
    const invoke = vi.fn(successfulTool().invoke);
    const kernel = new SharedOSKernel();
    kernel.registerTool({
      definition: FILE_TOOL,
      parseArguments: (arguments_) => arguments_,
      resolveRequirement() {
        return {
          resource: { namespace: "calendar", path: ["primary"] },
          action: "create",
        };
      },
      invoke,
    });
    const access = context([
      grant("grant-files-discovery", FILE_RESOURCE, ["search"]),
      grant("grant-calendar", { namespace: "calendar", path: ["primary"] }, ["create"]),
    ]);

    await expect(kernel.invokeTool(access, toolCall())).resolves.toMatchObject({
      status: "failed",
      error: { code: "invalid_tool_requirement" },
    });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("does not expose provider exceptions or invalid protocol responses", async () => {
    const kernel = new SharedOSKernel();
    kernel.registerTool({
      definition: FILE_TOOL,
      parseArguments: (arguments_) => arguments_,
      async invoke() {
        throw new Error("secret provider credential");
      },
    });
    const access = context([grant("grant-search", FILE_RESOURCE, ["search"])]);

    const result = await kernel.invokeTool(access, toolCall());
    expect(result).toMatchObject({
      status: "failed",
      error: { code: "tool_execution_failed" },
    });
    expect(JSON.stringify(result)).not.toContain("secret provider credential");
  });

  it("validates arguments before authorization and execution", async () => {
    const invoke = vi.fn(successfulTool().invoke);
    const kernel = new SharedOSKernel();
    kernel.registerTool({
      definition: FILE_TOOL,
      parseArguments(arguments_) {
        if (typeof arguments_["query"] !== "string") {
          throw new TypeError("query is required");
        }
        return arguments_;
      },
      invoke,
    });
    const access = context([grant("grant-search", FILE_RESOURCE, ["search"])]);

    await expect(
      kernel.invokeTool(access, toolCall({ arguments: { query: 42 } })),
    ).resolves.toMatchObject({
      status: "failed",
      error: { code: "invalid_tool_arguments" },
    });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("does not reveal whether an undiscoverable tool is registered", async () => {
    const events: AuditEvent[] = [];
    const kernel = new SharedOSKernel({
      audit: { record: async (event) => void events.push(event) },
    });
    kernel.registerTool(successfulTool());

    const registered = await kernel.invokeTool(context([]), toolCall());
    const missing = await kernel.invokeTool(context([]), toolCall({ tool: "private.connector" }));

    expect(registered).toMatchObject({
      status: "denied",
      error: { code: "tool_unavailable" },
    });
    expect(missing).toMatchObject({
      status: "denied",
      error: { code: "tool_unavailable" },
    });
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "authorization.checked",
          outcome: "denied",
          reason: "no_matching_grant",
        }),
      ]),
    );
  });
});

describe("SharedOSKernel turn admission", () => {
  it("requires a recipient-scoped execution grant", async () => {
    const kernel = new SharedOSKernel();
    const resource: ResourceRef = {
      namespace: "sharedos.execution",
      path: addressPath(RECEIVER),
      owner: OWNER,
    };

    await expect(kernel.admitTurn(context([]), RECEIVER)).resolves.toEqual({
      allowed: false,
      reasonCode: "no_matching_grant",
    });
    await expect(
      kernel.admitTurn(context([grant("grant-turn", resource, ["invoke"])]), RECEIVER),
    ).resolves.toMatchObject({ allowed: true, matchedGrantId: "grant-turn" });
    await expect(
      kernel.admitTurn(context([grant("grant-turn", resource, ["invoke"])]), {
        kind: "agent",
        agentId: "agent-other",
      }),
    ).resolves.toEqual({
      allowed: false,
      reasonCode: "no_matching_grant",
    });
  });
});

describe("SharedOSKernel resources", () => {
  it("never calls a resource provider without an explicit capability", async () => {
    const invoke = vi.fn<ResourceProvider["invoke"]>(async (operation) => ({
      operationId: operation.operationId,
      status: "succeeded",
      output: { matches: ["README.md"] },
      completedAt: NOW,
    }));
    const kernel = new SharedOSKernel();
    kernel.registerResourceProvider({ namespace: "files", invoke });
    const request: ResourceInvocationRequest = {
      operationId: "operation-1",
      resource: { namespace: "files", path: ["Workspace", "project", "README.md"] },
      action: "grep",
      input: { pattern: "SharedOS" },
    };

    await expect(kernel.invokeResource(context([]), request)).resolves.toMatchObject({
      status: "denied",
      error: { code: "no_matching_grant" },
    });
    expect(invoke).not.toHaveBeenCalled();

    const access = context([grant("grant-grep", request.resource, ["grep"])]);
    await expect(kernel.invokeResource(access, request)).resolves.toMatchObject({
      status: "succeeded",
      output: { matches: ["README.md"] },
    });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke.mock.calls[0]?.[0].context).toEqual(access);
    expect(invoke.mock.calls[0]?.[0].resource.owner).toEqual(OWNER);
  });

  it("rejects duplicate resource and tool registrations", () => {
    const kernel = new SharedOSKernel();
    const provider: ResourceProvider = {
      namespace: "files",
      async invoke(operation) {
        return {
          operationId: operation.operationId,
          status: "succeeded",
          output: null,
          completedAt: NOW,
        };
      },
    };
    kernel.registerResourceProvider(provider);
    kernel.registerTool(successfulTool());

    expect(() => kernel.registerResourceProvider(provider)).toThrow(
      "resource namespace is already registered",
    );
    expect(() => kernel.registerTool(successfulTool())).toThrow("tool is already registered");

    const toolProvider: ContextToolProvider = {
      id: "user-mcp",
      async listTools() {
        return [];
      },
    };
    kernel.registerToolProvider(toolProvider);
    expect(() => kernel.registerToolProvider(toolProvider)).toThrow(
      "tool provider is already registered",
    );
  });
});

describe("SharedOSKernel messaging and audit", () => {
  function envelope(overrides: Partial<MessageEnvelope> = {}): MessageEnvelope {
    return {
      version: "1",
      id: "message-1",
      sender: ACTOR,
      receiver: RECEIVER,
      intent: "delegate-research",
      purpose: "prepare-update",
      payload: { request: "Summarize the architecture" },
      traceId: "trace-1",
      createdAt: NOW,
      ...overrides,
    };
  }

  it("binds sender, purpose, trace, and recipient capability before delivery", async () => {
    const deliver = vi.fn<MessageTransport["deliver"]>(async (_access, message) => ({
      messageId: message.id,
      status: "delivered",
      timestamp: NOW,
    }));
    const kernel = new SharedOSKernel({
      messageTransport: { deliver },
    });
    const messagingResource: ResourceRef = {
      namespace: "sharedos.messaging",
      path: addressPath(RECEIVER),
      owner: OWNER,
    };
    const access = context([grant("grant-message", messagingResource, ["send"])]);

    await expect(
      kernel.sendMessage(access, envelope({ purpose: "other-purpose" })),
    ).resolves.toMatchObject({
      status: "denied",
      error: { code: "message_context_mismatch" },
    });
    expect(deliver).not.toHaveBeenCalled();

    await expect(kernel.sendMessage(access, envelope())).resolves.toEqual({
      messageId: "message-1",
      status: "delivered",
      timestamp: NOW,
    });
    expect(deliver).toHaveBeenCalledTimes(1);
  });

  it("treats payload claims as data, never as authority", async () => {
    const deliver = vi.fn<MessageTransport["deliver"]>();
    const kernel = new SharedOSKernel({ messageTransport: { deliver } });
    const forgedPayload = envelope({
      payload: {
        grants: [
          {
            namespace: "sharedos.messaging",
            action: "send",
            subject: "self",
          },
        ],
      },
    });

    await expect(kernel.sendMessage(context([]), forgedPayload)).resolves.toMatchObject({
      status: "denied",
      error: { code: "no_matching_grant" },
    });
    expect(deliver).not.toHaveBeenCalled();
  });

  it("emits metadata-only audit events without tool arguments or message payload", async () => {
    const events: AuditEvent[] = [];
    const audit: AuditSink = {
      async record(event) {
        events.push(event);
      },
    };
    const kernel = new SharedOSKernel({ audit });
    kernel.registerTool(successfulTool());
    const access = context([grant("grant-search", FILE_RESOURCE, ["search"])]);

    await kernel.invokeTool(access, toolCall());

    expect(events.map(({ type }) => type)).toEqual(["authorization.checked", "tool.invoked"]);
    expect(events[0]).toMatchObject({
      namespaceId: "world-alpha",
      traceId: "trace-1",
      purpose: "prepare-update",
      outcome: "allowed",
      grantId: "grant-search",
    });
    expect(JSON.stringify(events)).not.toContain("architecture");
    expect(JSON.stringify(events)).not.toContain("memory-1");
  });

  it("does not turn a completed side effect into a retry when outcome audit fails", async () => {
    let records = 0;
    const audit: AuditSink = {
      async record() {
        records += 1;
        if (records === 2) {
          throw new Error("audit store unavailable after execution");
        }
      },
    };
    const onAuditError = vi.fn(async () => {
      throw new Error("alert transport unavailable");
    });
    const invoke = vi.fn(successfulTool().invoke);
    const kernel = new SharedOSKernel({ audit, onAuditError });
    kernel.registerTool({
      definition: FILE_TOOL,
      parseArguments: (arguments_) => arguments_,
      invoke,
    });

    await expect(
      kernel.invokeTool(context([grant("grant-search", FILE_RESOURCE, ["search"])]), toolCall()),
    ).resolves.toMatchObject({ status: "succeeded" });
    expect(invoke).toHaveBeenCalledOnce();
    expect(onAuditError).toHaveBeenCalledOnce();
  });
});
