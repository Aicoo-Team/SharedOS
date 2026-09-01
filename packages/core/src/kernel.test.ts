import { describe, expect, it, vi } from "vitest";

import type {
  AccessContext,
  CapabilityGrant,
  MessageEnvelope,
  ResourceRef,
  ToolCall,
  ToolDefinition,
} from "@aicoo/sharedos-contracts";

import type { AuditEvent, AuditSink } from "./audit.js";
import type { GrantSource } from "./authority.js";
import { CapabilityAuthorizer, InMemoryGrantUsageStore } from "./authorization.js";
import { SharedOSKernel, type SharedOSKernelOptions } from "./kernel.js";
import {
  addressPath,
  type MessageRequestRouter,
  type MessageTransport,
} from "./message-service.js";
import { MESSAGE_REQUEST_TOOL_DEFINITION, MESSAGE_REQUEST_TOOL_NAME } from "./message-tool.js";
import type { ResourceInvocationRequest, ResourceProvider } from "./resource-registry.js";
import {
  applyToolNamespaceUpdate,
  type ToolNamespaceSettingsStore,
} from "./tool-namespace-control.js";
import { type ContextToolProvider, type ToolHandler, ToolRegistry } from "./tool-registry.js";

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

function context(enabledToolNamespaces: readonly string[] = ["files", "calendar"]): AccessContext {
  return {
    namespaceId: "world-alpha",
    enabledToolNamespaces: [...enabledToolNamespaces],
    actor: ACTOR,
    authority: AUTHORITY,
    owner: OWNER,
    purpose: "prepare-update",
    traceId: "trace-1",
    now: NOW,
  };
}

/** A host grant store under test control; authority never rides in the context. */
class TestGrantSource implements GrantSource {
  #grants: readonly CapabilityGrant[];

  constructor(grants: readonly CapabilityGrant[] = []) {
    this.#grants = grants;
  }

  serve(grants: readonly CapabilityGrant[]): this {
    this.#grants = grants;
    return this;
  }

  async load(access: AccessContext): Promise<readonly CapabilityGrant[]> {
    await Promise.resolve();
    return this.#grants.filter((entry) => entry.namespaceId === access.namespaceId);
  }
}

function kernelWith(
  grants: readonly CapabilityGrant[] = [],
  options: Omit<SharedOSKernelOptions, "grantSource"> = {},
): SharedOSKernel {
  return new SharedOSKernel({ ...options, grantSource: new TestGrantSource(grants) });
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

describe("SharedOSKernel escalation", () => {
  it("records an escalation as its own outcome and grants nothing", async () => {
    const events: AuditEvent[] = [];
    const kernel = kernelWith([], { audit: { record: async (event) => void events.push(event) } });

    const escalation = await kernel.recordEscalation(
      context(),
      "issuing a grant is outside this agent's authority",
    );

    expect(escalation).toEqual({
      reason: "issuing a grant is outside this agent's authority",
      // Assumed, not resolved: the owner the turn already runs on behalf of.
      reviewer: OWNER,
      requestedAt: NOW,
      status: "pending",
    });
    expect(events).toEqual([
      expect.objectContaining({
        type: "escalation.requested",
        // Not a denial. SharedOS did not decide this; it declined to.
        outcome: "escalated",
        reason: "escalation_requested",
        actor: ACTOR,
        metadata: expect.objectContaining({ reviewer: OWNER, reviewerAssumed: true }),
      }),
    ]);
  });

  it("does not let an escalation change what the actor may do", async () => {
    const kernel = kernelWith([]);
    kernel.registerTool(successfulTool());

    await kernel.recordEscalation(context(), "needs a human");

    // The store is the only thing that grants authority, and recording a
    // request against it changed nothing there.
    await expect(kernel.invokeTool(context(), toolCall())).resolves.toMatchObject({
      status: "denied",
      error: { code: "tool_unavailable" },
    });
  });

  it("refuses an escalation with no stated reason", async () => {
    const kernel = kernelWith([]);

    await expect(kernel.recordEscalation(context(), "   ")).rejects.toThrow(TypeError);
  });

  it("carries the capability a denial described into the escalation and its audit", async () => {
    const events: AuditEvent[] = [];
    const kernel = kernelWith([], { audit: { record: async (event) => void events.push(event) } });

    // The whole point of the pair: the host does not reconstruct a resource,
    // action, owner and purpose from the sentence a model wrote. It hands back
    // what the denial already named.
    const denial = await kernel.authorize(context(), {
      resource: FILE_RESOURCE,
      action: "search",
    });
    expect(denial).toMatchObject({ allowed: false, reasonCode: "no_matching_grant" });

    const escalation = await kernel.recordEscalation(context(), "this needs a grant", {
      ...(denial.requiredCapability === undefined ? {} : { request: denial.requiredCapability }),
    });

    expect(escalation.request).toEqual(denial.requiredCapability);
    expect(escalation.status).toBe("pending");
    expect(events.at(-1)).toMatchObject({
      type: "escalation.requested",
      outcome: "escalated",
      metadata: { request: denial.requiredCapability, resolution: "pending" },
    });
  });

  it("mints the request's identity from the trusted context, not from the caller", async () => {
    const kernel = kernelWith([]);
    const forged = {
      id: "correlation-the-caller-chose",
      namespaceId: "world-somewhere-else",
      requester: { kind: "agent", agentId: "agent-eve" } as const,
      owner: { kind: "human", userId: "user-mallory" } as const,
      capabilities: [{ resource: FILE_RESOURCE, actions: ["search"], scope: "exact" as const }],
      purpose: "prepare-update",
      requestedAt: "2019-01-01T00:00:00.000Z",
    };

    const escalation = await kernel.recordEscalation(context(), "needs a human", {
      request: forged,
    });

    // Who asked, on whose behalf, in which world, and when are the kernel's to
    // say. Only the payload -- which capabilities, for what purpose -- is the
    // caller's.
    expect(escalation.request).toMatchObject({
      namespaceId: "world-alpha",
      requester: ACTOR,
      owner: OWNER,
      requestedAt: NOW,
      capabilities: forged.capabilities,
      purpose: "prepare-update",
    });
    expect(escalation.request?.id).not.toBe(forged.id);
  });

  it("refuses a request that cannot be expressed as one", async () => {
    const kernel = kernelWith([]);

    await expect(
      kernel.recordEscalation(context(), "needs a human", {
        request: {
          id: "ignored",
          namespaceId: "world-alpha",
          requester: ACTOR,
          owner: OWNER,
          capabilities: [],
          purpose: "prepare-update",
          requestedAt: NOW,
        },
      }),
    ).rejects.toThrow(TypeError);
  });

  it("records the same escalation it always did when nothing is named", async () => {
    const events: AuditEvent[] = [];
    const kernel = kernelWith([], { audit: { record: async (event) => void events.push(event) } });

    const escalation = await kernel.recordEscalation(context(), "needs a human");

    expect(escalation).toEqual({
      reason: "needs a human",
      reviewer: OWNER,
      requestedAt: NOW,
      status: "pending",
    });
    expect(events[0]?.metadata).not.toHaveProperty("request");
  });
});

describe("SharedOSKernel tools", () => {
  it("requires namespace enablement and capability authority independently", async () => {
    const invoke = vi.fn(successfulTool().invoke);
    const authority = new TestGrantSource();
    const kernel = new SharedOSKernel({ grantSource: authority });
    kernel.registerTool({
      definition: FILE_TOOL,
      parseArguments: (arguments_) => arguments_,
      invoke,
    });
    const fileGrant = grant("grant-search", FILE_RESOURCE, ["search"]);

    authority.serve([fileGrant]);
    const namespaceDisabled = context([]);
    await expect(kernel.listTools(namespaceDisabled)).resolves.toEqual([]);
    await expect(kernel.invokeTool(namespaceDisabled, toolCall())).resolves.toMatchObject({
      status: "denied",
      error: { code: "tool_unavailable" },
    });

    authority.serve([]);
    const capabilityMissing = context(["files"]);
    await expect(kernel.listTools(capabilityMissing)).resolves.toEqual([]);
    await expect(kernel.invokeTool(capabilityMissing, toolCall())).resolves.toMatchObject({
      status: "denied",
      error: { code: "tool_unavailable" },
    });

    authority.serve([fileGrant]);
    const fullyEnabled = context(["files"]);
    await expect(kernel.listTools(fullyEnabled)).resolves.toEqual([FILE_TOOL]);
    await expect(kernel.invokeTool(fullyEnabled, toolCall())).resolves.toMatchObject({
      status: "succeeded",
    });
    expect(invoke).toHaveBeenCalledOnce();
  });

  it("lists namespace availability without treating it as authority", async () => {
    const kernel = kernelWith();
    kernel.registerTool(successfulTool(FILE_TOOL));
    kernel.registerTool(successfulTool(CALENDAR_TOOL));

    await expect(kernel.listToolNamespaces(context(["calendar"]))).resolves.toEqual({
      namespaces: [
        { namespace: "calendar", sources: ["native"], toolCount: 1, enabled: true },
        { namespace: "files", sources: ["sharedos"], toolCount: 1, enabled: false },
      ],
      summary: { total: 2, enabled: 1, disabled: 1 },
    });
    await expect(kernel.listTools(context(["calendar"]))).resolves.toEqual([]);
  });

  it("applies namespace updates through host-owned settings and returns the effective catalog", async () => {
    const events: AuditEvent[] = [];
    const applyUpdate = vi.fn<ToolNamespaceSettingsStore["applyUpdate"]>(async (access, update) =>
      applyToolNamespaceUpdate(access.enabledToolNamespaces, update),
    );
    const kernel = kernelWith([], {
      toolNamespaceSettings: { applyUpdate },
      audit: { record: async (event) => void events.push(event) },
    });
    kernel.registerTool(successfulTool(FILE_TOOL));
    kernel.registerTool(successfulTool(CALENDAR_TOOL));
    const access = context(["files"]);

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
      kernelWith().updateToolNamespaces(context([]), { enable: ["calendar"] }),
    ).rejects.toThrow("tool namespace settings is not registered");

    const kernel = kernelWith([], {
      toolNamespaceSettings: {
        async applyUpdate() {
          return ["calendar", "calendar"];
        },
      },
    });
    await expect(
      kernel.updateToolNamespaces(context([]), { enable: ["calendar"] }),
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
    const kernel = kernelWith([], { toolProviders: [provider] });
    const alpha = context(["notion"]);
    const beta = { ...context(["github"]), namespaceId: "world-beta" };

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
    const notionGrant = grant("grant-notion", { namespace: "notion", path: ["workspace-a"] }, [
      "read",
    ]);
    const kernel = kernelWith([notionGrant], {
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
    const access = context(["notion"]);

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
    const kernel = kernelWith(
      [grant("grant-search-once", FILE_RESOURCE, ["search"], { maxUses: 1 })],
      { authorizer: new CapabilityAuthorizer({ usageStore: new InMemoryGrantUsageStore() }) },
    );
    kernel.registerTool({
      definition: FILE_TOOL,
      parseArguments: (arguments_) => arguments_,
      invoke,
    });
    kernel.registerTool(successfulTool(CALENDAR_TOOL));
    const access = context();

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
    const kernel = kernelWith([grant("grant-search", FILE_RESOURCE, ["search"], { maxUses: 1 })], {
      authorizer: new CapabilityAuthorizer({ usageStore: new InMemoryGrantUsageStore() }),
    });
    kernel.registerTool({
      definition: FILE_TOOL,
      parseArguments: (arguments_) => arguments_,
      invoke,
    });
    const access = context();

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
    const kernel = kernelWith([
      grant("grant-project-x", { namespace: "files", path: ["Workspace", "project-x"] }, ["read"]),
    ]);
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
    const access = context();

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
    const kernel = kernelWith([
      grant("grant-files-discovery", FILE_RESOURCE, ["search"]),
      grant("grant-calendar", { namespace: "calendar", path: ["primary"] }, ["create"]),
    ]);
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
    const access = context();

    await expect(kernel.invokeTool(access, toolCall())).resolves.toMatchObject({
      status: "failed",
      error: { code: "invalid_tool_requirement" },
    });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("rejects a result that answers a call the kernel never made", async () => {
    const kernel = kernelWith([grant("grant-search", FILE_RESOURCE, ["search"])]);
    kernel.registerTool({
      definition: FILE_TOOL,
      parseArguments: (arguments_) => arguments_,
      async invoke(access, call) {
        // Everything up to here is correct: the requirement is inside the
        // declared ceiling and the caller genuinely holds the authority for it.
        // Only the identifier on the way back belongs to a different call.
        return {
          callId: `${call.id}-other`,
          tool: call.tool,
          status: "succeeded",
          output: { hits: [] },
          completedAt: access.now,
        };
      },
    });

    const result = await kernel.invokeTool(context(), toolCall());

    expect(result).toMatchObject({
      status: "failed",
      error: { code: "invalid_tool_result" },
    });
    // The refusal is attributed to the call that was actually authorized, so a
    // provider cannot detach its work from the decision that permitted it.
    expect(result.callId).toBe(toolCall().id);
  });

  it("rejects a result naming a tool other than the one that was invoked", async () => {
    const kernel = kernelWith([grant("grant-search", FILE_RESOURCE, ["search"])]);
    kernel.registerTool({
      definition: FILE_TOOL,
      parseArguments: (arguments_) => arguments_,
      async invoke(access, call) {
        return {
          callId: call.id,
          tool: "calendar.create",
          status: "succeeded",
          output: {},
          completedAt: access.now,
        };
      },
    });

    await expect(kernel.invokeTool(context(), toolCall())).resolves.toMatchObject({
      status: "failed",
      error: { code: "invalid_tool_result" },
    });
  });

  it("refuses another owner's resource as a denial, not as a tool defect", async () => {
    const events: AuditEvent[] = [];
    const invoke = vi.fn(successfulTool().invoke);
    const kernel = kernelWith([grant("grant-search", FILE_RESOURCE, ["search"])], {
      audit: { record: async (event) => void events.push(event) },
    });
    kernel.registerTool({
      definition: FILE_TOOL,
      parseArguments: (arguments_) => arguments_,
      // The provider resolves exactly what the caller named, including an owner
      // outside this world. Clamping it here would make the kernel look correct
      // while the provider did the enforcing.
      resolveRequirement: () => ({
        resource: { ...FILE_RESOURCE, owner: { kind: "human", userId: "user-mallory" } },
        action: "search",
      }),
      invoke,
    });

    const result = await kernel.invokeTool(context(), toolCall());

    // A world crossing is a denial the authorizer has a code for. Reporting it
    // as `invalid_tool_requirement` would say the tool misbehaved, when the tool
    // faithfully resolved a request that is simply not permitted.
    expect(result).toMatchObject({
      status: "denied",
      error: { code: "invalid_request" },
    });
    expect(invoke).not.toHaveBeenCalled();
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "authorization.checked",
          outcome: "denied",
          reason: "invalid_request",
        }),
      ]),
    );
  });

  it("does not expose provider exceptions or invalid protocol responses", async () => {
    const kernel = kernelWith([grant("grant-search", FILE_RESOURCE, ["search"])]);
    kernel.registerTool({
      definition: FILE_TOOL,
      parseArguments: (arguments_) => arguments_,
      async invoke() {
        throw new Error("secret provider credential");
      },
    });
    const access = context();

    const result = await kernel.invokeTool(access, toolCall());
    expect(result).toMatchObject({
      status: "failed",
      error: { code: "tool_execution_failed" },
    });
    expect(JSON.stringify(result)).not.toContain("secret provider credential");
  });

  it("validates arguments before authorization and execution", async () => {
    const invoke = vi.fn(successfulTool().invoke);
    const kernel = kernelWith([grant("grant-search", FILE_RESOURCE, ["search"])]);
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
    const access = context();

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
    const kernel = kernelWith([], {
      audit: { record: async (event) => void events.push(event) },
    });
    kernel.registerTool(successfulTool());

    const registered = await kernel.invokeTool(context(), toolCall());
    const missing = await kernel.invokeTool(context(), toolCall({ tool: "private.connector" }));

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
    const authority = new TestGrantSource();
    const kernel = new SharedOSKernel({ grantSource: authority });
    const resource: ResourceRef = {
      namespace: "sharedos.execution",
      path: addressPath(RECEIVER),
      owner: OWNER,
    };

    await expect(kernel.admitTurn(context(), RECEIVER)).resolves.toMatchObject({
      allowed: false,
      reasonCode: "no_matching_grant",
    });

    authority.serve([grant("grant-turn", resource, ["invoke"])]);
    await expect(kernel.admitTurn(context(), RECEIVER)).resolves.toMatchObject({
      allowed: true,
      matchedGrantId: "grant-turn",
    });
    await expect(
      kernel.admitTurn(context(), {
        kind: "agent",
        agentId: "agent-other",
      }),
    ).resolves.toMatchObject({
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
    const authority = new TestGrantSource();
    const kernel = new SharedOSKernel({ grantSource: authority });
    kernel.registerResourceProvider({ namespace: "files", invoke });
    const request: ResourceInvocationRequest = {
      operationId: "operation-1",
      resource: { namespace: "files", path: ["Workspace", "project", "README.md"] },
      action: "grep",
      input: { pattern: "SharedOS" },
    };

    await expect(kernel.invokeResource(context(), request)).resolves.toMatchObject({
      status: "denied",
      error: { code: "no_matching_grant" },
    });
    expect(invoke).not.toHaveBeenCalled();

    authority.serve([grant("grant-grep", request.resource, ["grep"])]);
    const access = context();
    await expect(kernel.invokeResource(access, request)).resolves.toMatchObject({
      status: "succeeded",
      output: { matches: ["README.md"] },
    });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke.mock.calls[0]?.[0].context).toEqual(access);
    expect(invoke.mock.calls[0]?.[0].resource.owner).toEqual(OWNER);
  });

  it("rejects duplicate resource and tool registrations", () => {
    const kernel = kernelWith();
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
      purpose: "prepare-update",
      payload: { request: "Summarize the architecture" },
      traceId: "trace-1",
      createdAt: NOW,
      ...overrides,
    };
  }

  function replyTo(request: MessageEnvelope, overrides: Partial<MessageEnvelope> = {}) {
    return envelope({
      id: "message-reply-1",
      sender: request.receiver,
      receiver: request.sender,
      payload: { answer: "Architecture summarized" },
      replyTo: request.id,
      ...overrides,
    });
  }

  function messageRequestCall(arguments_: ToolCall["arguments"] = {}): ToolCall {
    return toolCall({
      id: "untrusted-model-call-1",
      tool: MESSAGE_REQUEST_TOOL_NAME,
      arguments: { recipient: RECEIVER, payload: { request: "Summarize" }, ...arguments_ },
    });
  }

  function messageResource(receiver = RECEIVER): ResourceRef {
    return {
      namespace: "sharedos.messaging",
      path: addressPath(receiver),
      owner: OWNER,
    };
  }

  function authorityMutatingAudit(events: AuditEvent[], mutationResults: boolean[]): AuditSink {
    return {
      async record(event) {
        events.push(event);
        if (event.type !== "authorization.checked" || event.outcome !== "allowed") {
          return;
        }
        mutationResults.push(Reflect.set(event.actor, "agentId", "audit-poisoned-actor"));
        mutationResults.push(Reflect.set(event.owner, "userId", "audit-poisoned-owner"));
        if (event.resource !== undefined) {
          mutationResults.push(Reflect.set(event.resource, "namespace", "audit-poisoned-resource"));
        }
      },
    };
  }

  it("does not expose or execute the request tool without send authority", async () => {
    const deliver = vi.fn<MessageTransport["deliver"]>();
    const resolveReply = vi.fn<MessageRequestRouter["resolveReply"]>();
    const kernel = kernelWith([], {
      messageTransport: { deliver },
      messageRequestRouter: { resolveReply },
    });
    const access = context(["messages"]);

    await expect(kernel.listTools(access)).resolves.toEqual([]);
    await expect(kernel.invokeTool(access, messageRequestCall())).resolves.toMatchObject({
      status: "denied",
      error: { code: "tool_unavailable" },
    });
    expect(deliver).not.toHaveBeenCalled();
    expect(resolveReply).not.toHaveBeenCalled();
  });

  it("installs the request tool only when both host ports exist and never mutates the host registry", async () => {
    const messagingGrant = grant("grant-message", messageResource(), ["send"]);
    const hostTools = new ToolRegistry();
    const deliver = vi.fn<MessageTransport["deliver"]>();
    const resolveReply = vi.fn<MessageRequestRouter["resolveReply"]>();

    await expect(
      kernelWith([messagingGrant], { tools: hostTools, messageTransport: { deliver } }).listTools(
        context(["messages"]),
      ),
    ).resolves.toEqual([]);
    await expect(
      kernelWith([messagingGrant], {
        tools: hostTools,
        messageRequestRouter: { resolveReply },
      }).listTools(context(["messages"])),
    ).resolves.toEqual([]);
    await expect(
      kernelWith([messagingGrant], {
        tools: hostTools,
        messageTransport: { deliver },
        messageRequestRouter: { resolveReply },
      }).listTools(context(["messages"])),
    ).resolves.toEqual([MESSAGE_REQUEST_TOOL_DEFINITION]);

    expect(hostTools.definitions()).toEqual([]);
  });

  it("discovers the request tool without consuming its bounded recipient grant", async () => {
    const usage = new InMemoryGrantUsageStore();
    const messagingGrant = grant("grant-message", messageResource(), ["send"], { maxUses: 1 });
    const kernel = kernelWith([messagingGrant], {
      authorizer: new CapabilityAuthorizer({ usageStore: usage }),
      messageTransport: { deliver: vi.fn() },
      messageRequestRouter: { resolveReply: vi.fn() },
    });

    await expect(kernel.listTools(context(["messages"]))).resolves.toEqual([
      MESSAGE_REQUEST_TOOL_DEFINITION,
    ]);
    await expect(usage.getUsage("world-alpha", "grant-message")).resolves.toBe(0);
  });

  it("publishes every accepted recipient address as a closed, unambiguous schema", async () => {
    const kernel = kernelWith([grant("grant-message", messageResource(), ["send"])], {
      messageTransport: { deliver: vi.fn() },
      messageRequestRouter: { resolveReply: vi.fn() },
    });

    const catalog = await kernel.listPublishedTools(context(["messages"]), {
      executionId: "execution-message-schema",
    });

    expect(catalog.tools).toHaveLength(1);
    expect(catalog.tools[0]?.inputSchema).toEqual({
      type: "object",
      properties: {
        recipient: {
          oneOf: [
            {
              type: "object",
              properties: {
                kind: { const: "human" },
                userId: {
                  type: "string",
                  minLength: 1,
                  maxLength: 256,
                  pattern: "^(?!\\s)[\\s\\S]*\\S$",
                },
              },
              required: ["kind", "userId"],
              additionalProperties: false,
            },
            {
              type: "object",
              properties: {
                kind: { const: "agent" },
                agentId: {
                  type: "string",
                  minLength: 1,
                  maxLength: 256,
                  pattern: "^(?!\\s)[\\s\\S]*\\S$",
                },
              },
              required: ["kind", "agentId"],
              additionalProperties: false,
            },
            {
              type: "object",
              properties: {
                kind: { const: "group" },
                conversationId: {
                  type: "string",
                  minLength: 1,
                  maxLength: 256,
                  pattern: "^(?!\\s)[\\s\\S]*\\S$",
                },
              },
              required: ["kind", "conversationId"],
              additionalProperties: false,
            },
            {
              type: "object",
              properties: {
                kind: { const: "service" },
                serviceId: {
                  type: "string",
                  minLength: 1,
                  maxLength: 256,
                  pattern: "^(?!\\s)[\\s\\S]*\\S$",
                },
              },
              required: ["kind", "serviceId"],
              additionalProperties: false,
            },
          ],
        },
        payload: {},
      },
      required: ["recipient", "payload"],
      additionalProperties: false,
    });
  });

  it("constructs a trusted request, consumes once, and returns only the durable reply payload", async () => {
    const usage = new InMemoryGrantUsageStore();
    const events: AuditEvent[] = [];
    let acceptedRequest: MessageEnvelope | undefined;
    const deliver = vi.fn<MessageTransport["deliver"]>(async (_access, message) => {
      acceptedRequest = message;
      return { messageId: message.id, status: "accepted", timestamp: NOW };
    });
    const resolveReply = vi.fn<MessageRequestRouter["resolveReply"]>(
      async (_access, request, delivery) => {
        expect(delivery).toMatchObject({ status: "accepted", messageId: request.id });
        return replyTo(request);
      },
    );
    const messagingGrant = grant("grant-message", messageResource(), ["send"], { maxUses: 1 });
    const kernel = kernelWith([messagingGrant], {
      authorizer: new CapabilityAuthorizer({ usageStore: usage }),
      messageTransport: { deliver },
      messageRequestRouter: { resolveReply },
      createMessageId: () => "message-generated-1",
      audit: { record: async (event) => void events.push(event) },
    });

    await expect(kernel.invokeTool(context(["messages"]), messageRequestCall())).resolves.toEqual({
      callId: "untrusted-model-call-1",
      tool: MESSAGE_REQUEST_TOOL_NAME,
      status: "succeeded",
      output: { answer: "Architecture summarized" },
      completedAt: NOW,
    });
    expect(acceptedRequest).toEqual({
      version: "1",
      id: "message-generated-1",
      sender: ACTOR,
      receiver: RECEIVER,
      purpose: "prepare-update",
      payload: { request: "Summarize" },
      traceId: "trace-1",
      createdAt: NOW,
    });
    expect(acceptedRequest?.id).not.toBe("untrusted-model-call-1");
    expect(deliver).toHaveBeenCalledOnce();
    expect(resolveReply).toHaveBeenCalledOnce();
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "authorization.checked",
        outcome: "allowed",
        operationId: "untrusted-model-call-1",
        resource: messageResource(),
        action: "send",
      }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "message.sent",
        outcome: "succeeded",
        operationId: "untrusted-model-call-1",
        messageId: "message-generated-1",
        receiver: RECEIVER,
      }),
    );
    expect(JSON.stringify(events)).not.toContain("Summarize");
    expect(JSON.stringify(events)).not.toContain("Architecture summarized");
    await expect(usage.getUsage("world-alpha", "grant-message")).resolves.toBe(1);

    await expect(
      kernel.invokeTool(context(["messages"]), messageRequestCall()),
    ).resolves.toMatchObject({ status: "denied", error: { code: "tool_unavailable" } });
    expect(deliver).toHaveBeenCalledOnce();
  });

  it.each(["sender", "purpose", "traceId", "messageId", "intent", "replyTo"])(
    "rejects model-authored authority field %s before delivery",
    async (field) => {
      const deliver = vi.fn<MessageTransport["deliver"]>();
      const resolveReply = vi.fn<MessageRequestRouter["resolveReply"]>();
      const kernel = kernelWith([grant("grant-message", messageResource(), ["send"])], {
        messageTransport: { deliver },
        messageRequestRouter: { resolveReply },
      });

      await expect(
        kernel.invokeTool(context(["messages"]), messageRequestCall({ [field]: "forged" })),
      ).resolves.toMatchObject({
        status: "failed",
        error: { code: "invalid_tool_arguments" },
      });
      expect(deliver).not.toHaveBeenCalled();
      expect(resolveReply).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["replyTo", { replyTo: "wrong-request" }],
    ["sender", { sender: ACTOR }],
    ["receiver", { receiver: RECEIVER }],
    ["purpose", { purpose: "other-purpose" }],
    ["trace", { traceId: "other-trace" }],
  ] satisfies readonly [string, Partial<MessageEnvelope>][])(
    "fails closed on a mismatched durable reply %s",
    async (_field, mismatch) => {
      const deliver = vi.fn<MessageTransport["deliver"]>(async (_access, message) => ({
        messageId: message.id,
        status: "accepted",
        timestamp: NOW,
      }));
      const resolveReply = vi.fn<MessageRequestRouter["resolveReply"]>(async (_access, request) =>
        replyTo(request, mismatch),
      );
      const kernel = kernelWith([grant("grant-message", messageResource(), ["send"])], {
        messageTransport: { deliver },
        messageRequestRouter: { resolveReply },
        createMessageId: () => "message-generated-1",
      });

      const result = await kernel.invokeTool(context(["messages"]), messageRequestCall());

      expect(result).toMatchObject({
        status: "failed",
        error: {
          code: "invalid_message_reply",
          message: "The message router returned an invalid reply",
          retryable: false,
        },
      });
      expect(JSON.stringify(result)).not.toContain("Architecture summarized");
      expect(JSON.stringify(result)).not.toContain("other-purpose");
      expect(deliver).toHaveBeenCalledOnce();
      expect(resolveReply).toHaveBeenCalledOnce();
    },
  );

  it("rejects malformed durable replies and sanitizes router failures", async () => {
    const deliver = vi.fn<MessageTransport["deliver"]>(async (_access, message) => ({
      messageId: message.id,
      status: "accepted",
      timestamp: NOW,
    }));
    const malformedRouter: MessageRequestRouter = {
      async resolveReply(_access, request) {
        return { ...replyTo(request), intent: "legacy-authority-shape" } as MessageEnvelope;
      },
    };
    const failingRouter: MessageRequestRouter = {
      async resolveReply() {
        throw new Error("/private/reply-log/secret: database password leaked");
      },
    };
    const options = {
      messageTransport: { deliver },
      createMessageId: () => "message-generated-1",
    };
    const messagingGrant = grant("grant-message", messageResource(), ["send"]);

    await expect(
      kernelWith([messagingGrant], {
        ...options,
        messageRequestRouter: malformedRouter,
      }).invokeTool(context(["messages"]), messageRequestCall()),
    ).resolves.toMatchObject({
      status: "failed",
      error: { code: "invalid_message_reply" },
    });

    const failed = await kernelWith([messagingGrant], {
      ...options,
      messageRequestRouter: failingRouter,
    }).invokeTool(context(["messages"]), messageRequestCall());
    expect(failed).toMatchObject({
      status: "failed",
      error: {
        code: "message_reply_resolution_failed",
        message: "The message router could not resolve a reply",
      },
    });
    expect(JSON.stringify(failed)).not.toContain("secret");
    expect(JSON.stringify(failed)).not.toContain("password");
  });

  it("rejects a reply correlated only to router-mutated request authority", async () => {
    const deliver = vi.fn<MessageTransport["deliver"]>(async (_access, message) => ({
      messageId: message.id,
      status: "accepted",
      timestamp: NOW,
    }));
    const resolveReply = vi.fn<MessageRequestRouter["resolveReply"]>(
      async (_access, mutableRequest) => {
        mutableRequest.id = "router-forged-request";
        mutableRequest.sender = RECEIVER;
        mutableRequest.receiver = ACTOR;
        mutableRequest.purpose = "router-forged-purpose";
        mutableRequest.traceId = "router-forged-trace";
        return replyTo(mutableRequest, {
          purpose: mutableRequest.purpose,
          traceId: mutableRequest.traceId,
          payload: { secret: "router-forged-reply" },
        });
      },
    );
    const kernel = kernelWith([grant("grant-message", messageResource(), ["send"])], {
      messageTransport: { deliver },
      messageRequestRouter: { resolveReply },
      createMessageId: () => "message-generated-1",
    });

    const result = await kernel.invokeTool(context(["messages"]), messageRequestCall());

    expect(result).toMatchObject({
      status: "failed",
      error: { code: "invalid_message_reply" },
    });
    expect(JSON.stringify(result)).not.toContain("router-forged");
  });

  it("keeps transport mutation out of request correlation and router input", async () => {
    const deliver = vi.fn<MessageTransport["deliver"]>(async (_access, mutableMessage) => {
      const authorizedId = mutableMessage.id;
      mutableMessage.id = "transport-forged-request";
      mutableMessage.purpose = "transport-forged-purpose";
      mutableMessage.traceId = "transport-forged-trace";
      return { messageId: authorizedId, status: "accepted", timestamp: NOW };
    });
    const resolveReply = vi.fn<MessageRequestRouter["resolveReply"]>(
      async (_access, immutableRequest) => {
        expect(immutableRequest).toMatchObject({
          id: "message-generated-1",
          purpose: "prepare-update",
          traceId: "trace-1",
        });
        return replyTo(immutableRequest);
      },
    );
    const kernel = kernelWith([grant("grant-message", messageResource(), ["send"])], {
      messageTransport: { deliver },
      messageRequestRouter: { resolveReply },
      createMessageId: () => "message-generated-1",
    });

    await expect(
      kernel.invokeTool(context(["messages"]), messageRequestCall()),
    ).resolves.toMatchObject({
      status: "succeeded",
      output: { answer: "Architecture summarized" },
    });
  });

  it("keeps direct send sender-bound and consumes its recipient grant once", async () => {
    const usage = new InMemoryGrantUsageStore();
    const deliver = vi.fn<MessageTransport["deliver"]>(async (_access, message) => ({
      messageId: message.id,
      status: "delivered",
      timestamp: NOW,
    }));
    const kernel = kernelWith(
      [grant("grant-message", messageResource(), ["send"], { maxUses: 1 })],
      {
        authorizer: new CapabilityAuthorizer({ usageStore: usage }),
        messageTransport: { deliver },
      },
    );

    await expect(kernel.sendMessage(context(), envelope())).resolves.toMatchObject({
      status: "delivered",
    });
    await expect(usage.getUsage("world-alpha", "grant-message")).resolves.toBe(1);
    expect(deliver).toHaveBeenCalledOnce();

    await expect(
      kernel.sendMessage(context(), envelope({ id: "message-2" })),
    ).resolves.toMatchObject({ status: "denied", error: { code: "grant_exhausted" } });
    expect(deliver).toHaveBeenCalledOnce();
  });

  it("rejects invalid direct message envelopes before authority, audit, or transport", async () => {
    const messagingGrant = grant("grant-message", messageResource(), ["send"], { maxUses: 1 });
    const load = vi.fn<GrantSource["load"]>(async () => [messagingGrant]);
    const getUsage = vi.fn(async () => 0);
    const tryConsume = vi.fn(async () => true);
    const record = vi.fn<AuditSink["record"]>(async () => undefined);
    const deliver = vi.fn<MessageTransport["deliver"]>();
    const kernel = new SharedOSKernel({
      grantSource: { load },
      authorizer: new CapabilityAuthorizer({ usageStore: { getUsage, tryConsume } }),
      audit: { record },
      messageTransport: { deliver },
    });
    const legacy = { ...envelope(), intent: "removed-message-field" } as MessageEnvelope;
    const { id: _removedId, ...withoutId } = envelope();
    const malformed = withoutId as unknown as MessageEnvelope;

    for (const invalid of [legacy, malformed]) {
      await expect(kernel.sendMessage(context(), invalid)).rejects.toThrow(
        "message envelope does not match the SharedOS contract",
      );
    }

    expect(load).not.toHaveBeenCalled();
    expect(getUsage).not.toHaveBeenCalled();
    expect(tryConsume).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
    expect(deliver).not.toHaveBeenCalled();
  });

  it("propagates cancellation after delivery without retrying the request", async () => {
    const controller = new AbortController();
    const reason = new Error("cancel request wait");
    const deliver = vi.fn<MessageTransport["deliver"]>(async (_access, message) => ({
      messageId: message.id,
      status: "accepted",
      timestamp: NOW,
    }));
    const resolveReply = vi.fn<MessageRequestRouter["resolveReply"]>(
      async (_access, _request, _delivery, signal) => {
        controller.abort(reason);
        expect(signal.aborted).toBe(true);
        throw reason;
      },
    );
    const kernel = kernelWith([grant("grant-message", messageResource(), ["send"])], {
      messageTransport: { deliver },
      messageRequestRouter: { resolveReply },
      createMessageId: () => "message-generated-1",
    });

    await expect(
      kernel.invokeTool(context(["messages"]), messageRequestCall(), { signal: controller.signal }),
    ).rejects.toBe(reason);
    expect(deliver).toHaveBeenCalledOnce();
    expect(resolveReply).toHaveBeenCalledOnce();
  });

  it("binds sender, purpose, trace, and recipient capability before delivery", async () => {
    const deliver = vi.fn<MessageTransport["deliver"]>(async (_access, message) => ({
      messageId: message.id,
      status: "delivered",
      timestamp: NOW,
    }));
    const messagingResource: ResourceRef = {
      namespace: "sharedos.messaging",
      path: addressPath(RECEIVER),
      owner: OWNER,
    };
    const kernel = kernelWith([grant("grant-message", messagingResource, ["send"])], {
      messageTransport: { deliver },
    });
    const access = context();

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
    const kernel = kernelWith([], { messageTransport: { deliver } });
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

    await expect(kernel.sendMessage(context(), forgedPayload)).resolves.toMatchObject({
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
    const kernel = kernelWith([grant("grant-search", FILE_RESOURCE, ["search"])], { audit });
    kernel.registerTool(successfulTool());
    const access = context();

    await kernel.invokeTool(access, toolCall());

    expect(events.map(({ type }) => type)).toEqual([
      "authority.resolved",
      "authorization.checked",
      "tool.invoked",
    ]);
    expect(events[1]).toMatchObject({
      namespaceId: "world-alpha",
      traceId: "trace-1",
      purpose: "prepare-update",
      outcome: "allowed",
      grantId: "grant-search",
    });
    expect(JSON.stringify(events)).not.toContain("architecture");
    expect(JSON.stringify(events)).not.toContain("memory-1");
  });

  it("isolates message execution and later events from authorization audit mutation", async () => {
    const events: AuditEvent[] = [];
    const mutationResults: boolean[] = [];
    let deliveredContext: AccessContext | undefined;
    const deliver = vi.fn<MessageTransport["deliver"]>(async (access, message) => {
      deliveredContext = access;
      return { messageId: message.id, status: "accepted", timestamp: NOW };
    });
    const resolveReply = vi.fn<MessageRequestRouter["resolveReply"]>(async (_access, request) =>
      replyTo(request),
    );
    const kernel = kernelWith([grant("grant-message", messageResource(), ["send"])], {
      audit: authorityMutatingAudit(events, mutationResults),
      messageTransport: { deliver },
      messageRequestRouter: { resolveReply },
      createMessageId: () => "message-generated-1",
    });

    await expect(
      kernel.invokeTool(context(["messages"]), messageRequestCall()),
    ).resolves.toMatchObject({ status: "succeeded" });

    expect(mutationResults).toEqual([false, false, false]);
    expect(deliveredContext).toMatchObject({ actor: ACTOR, owner: OWNER });
    expect(events.every((event) => JSON.stringify(event.actor) === JSON.stringify(ACTOR))).toBe(
      true,
    );
    expect(events.every((event) => JSON.stringify(event.owner) === JSON.stringify(OWNER))).toBe(
      true,
    );
    expect(JSON.stringify(events)).not.toContain("audit-poisoned");
  });

  it("isolates generic tool execution and its requirement from authorization audit mutation", async () => {
    const events: AuditEvent[] = [];
    const mutationResults: boolean[] = [];
    let invokedContext: AccessContext | undefined;
    const kernel = kernelWith([grant("grant-search", FILE_RESOURCE, ["search"])], {
      audit: authorityMutatingAudit(events, mutationResults),
    });
    kernel.registerTool({
      definition: FILE_TOOL,
      parseArguments: (arguments_) => arguments_,
      async invoke(access, call) {
        invokedContext = access;
        return {
          callId: call.id,
          tool: call.tool,
          status: "succeeded",
          output: null,
          completedAt: NOW,
        };
      },
    });

    await expect(kernel.invokeTool(context(["files"]), toolCall())).resolves.toMatchObject({
      status: "succeeded",
    });

    expect(mutationResults).toEqual([false, false, false]);
    expect(invokedContext).toMatchObject({ actor: ACTOR, owner: OWNER });
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "tool.invoked",
        resource: FILE_RESOURCE,
        action: "search",
      }),
    );
    expect(JSON.stringify(events)).not.toContain("audit-poisoned");
  });

  it("does not turn a completed side effect into a retry when outcome audit fails", async () => {
    const audit: AuditSink = {
      async record(event) {
        if (event.type === "tool.invoked") {
          throw new Error("audit store unavailable after execution");
        }
      },
    };
    const onAuditError = vi.fn(async () => {
      throw new Error("alert transport unavailable");
    });
    const invoke = vi.fn(successfulTool().invoke);
    const kernel = kernelWith([grant("grant-search", FILE_RESOURCE, ["search"])], {
      audit,
      onAuditError,
    });
    kernel.registerTool({
      definition: FILE_TOOL,
      parseArguments: (arguments_) => arguments_,
      invoke,
    });

    await expect(kernel.invokeTool(context(), toolCall())).resolves.toMatchObject({
      status: "succeeded",
    });
    expect(invoke).toHaveBeenCalledOnce();
    expect(onAuditError).toHaveBeenCalledOnce();
  });
});
