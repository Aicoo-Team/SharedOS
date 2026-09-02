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
import type { GrantSource, LoadedPolicy, PolicySource } from "./authority.js";
import {
  CapabilityAuthorizer,
  type HostCeiling,
  InMemoryGrantUsageStore,
} from "./authorization.js";
import type { ProviderErrorContext, ProviderErrorReporter } from "./diagnostics.js";
import { SharedOSKernel, type SharedOSKernelOptions } from "./kernel.js";
import {
  addressPath,
  type MessageRequestRouter,
  type MessageTransport,
} from "./message-service.js";
import { MESSAGE_REQUEST_TOOL_DEFINITION, MESSAGE_REQUEST_TOOL_NAME } from "./message-tool.js";
import { catalogHash, publishToolCatalog } from "./published-tool.js";
import {
  ResourceProviderRegistry,
  type ResourceInvocationRequest,
  type ResourceProvider,
} from "./resource-registry.js";
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

  it("carries the capability a denial described into the escalation and its audit event", async () => {
    const events: AuditEvent[] = [];
    const kernel = kernelWith([], { audit: { record: async (event) => void events.push(event) } });
    const request = {
      resource: { namespace: "files", path: ["Memory", "project-x"], owner: OWNER },
      action: "read",
    };

    // The round trip ADR 0019 exists for: the authorizer says what was missing,
    // and the host hands that back verbatim when it escalates the denial. No
    // reconstruction from prose, and nothing here grants anything.
    const denial = await kernel.authorize(context(), request);
    expect(denial.reasonCode).toBe("no_matching_grant");

    const escalation = await kernel.recordEscalation(context(), "alice should decide this", {
      ...(denial.requiredCapability === undefined ? {} : { request: denial.requiredCapability }),
    });

    expect(escalation.request).toEqual(denial.requiredCapability);
    expect(escalation.status).toBe("pending");
    // A first-class audit field, so a reviewer's queue is built from audit alone
    // rather than from an untyped bag that happens to hold the right shape.
    expect(events.at(-1)).toMatchObject({
      type: "escalation.requested",
      outcome: "escalated",
      request: {
        capabilities: [{ resource: request.resource, actions: ["read"], scope: "exact" }],
      },
    });
  });

  it("copies the capability request, so a later edit cannot rewrite the record", async () => {
    const events: AuditEvent[] = [];
    const kernel = kernelWith([], { audit: { record: async (event) => void events.push(event) } });
    const request = {
      id: "capreq-1",
      namespaceId: "world-alpha",
      requester: ACTOR,
      owner: OWNER,
      capabilities: [
        {
          resource: { namespace: "files", path: ["Memory"], owner: OWNER },
          actions: ["read"],
          scope: "exact" as const,
        },
      ],
      purpose: "prepare-update",
      requestedAt: NOW,
    };

    const escalation = await kernel.recordEscalation(context(), "alice should decide", { request });
    request.capabilities[0]!.actions.push("delete");

    // A reviewer's queue is built from what was recorded, so the record cannot
    // be a live view of the caller's object. Guaranteed twice over today -- the
    // schema parse copies, and so does the explicit clone -- and this pins the
    // property rather than either mechanism, so removing one does not quietly
    // leave the other as the only guard. Verified by mutation: dropping the
    // clone alone does not fail this test, which is the point of saying so.
    expect(escalation.request?.capabilities[0]?.actions).toEqual(["read"]);
    expect(events.at(-1)).toMatchObject({
      request: { capabilities: [{ actions: ["read"] }] },
    });
  });

  it("records an escalation with no capability when nothing named one", async () => {
    const events: AuditEvent[] = [];
    const kernel = kernelWith([], { audit: { record: async (event) => void events.push(event) } });

    // A model-chosen escalation usually has only a sentence. The field stays
    // absent rather than being filled with a guess.
    const escalation = await kernel.recordEscalation(context(), "this needs a person");

    expect(escalation.request).toBeUndefined();
    expect(events.at(-1)).not.toHaveProperty("request");
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

    // An admission denial describes the execution capability, which is the one
    // a host would escalate: "this agent may not run for this owner" is exactly
    // the ask a reviewer can answer by issuing a grant (ADR 0019).
    await expect(kernel.admitTurn(context(), RECEIVER)).resolves.toMatchObject({
      allowed: false,
      reasonCode: "no_matching_grant",
      requiredCapability: {
        capabilities: [{ resource, actions: ["invoke"], scope: "exact" }],
      },
    });

    authority.serve([grant("grant-turn", resource, ["invoke"])]);
    await expect(kernel.admitTurn(context(), RECEIVER)).resolves.toMatchObject({
      allowed: true,
      matchedGrantId: "grant-turn",
    });
    // A different agent: the description names that agent's execution path, not
    // the one a grant was just served for. The field restates the request.
    await expect(
      kernel.admitTurn(context(), {
        kind: "agent",
        agentId: "agent-other",
      }),
    ).resolves.toMatchObject({
      allowed: false,
      reasonCode: "no_matching_grant",
      requiredCapability: {
        capabilities: [
          {
            resource: {
              namespace: "sharedos.execution",
              path: addressPath({ kind: "agent", agentId: "agent-other" }),
              owner: OWNER,
            },
            actions: ["invoke"],
            scope: "exact",
          },
        ],
      },
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

describe("SharedOSKernel provider diagnostics", () => {
  const SEARCH_GRANT = grant("grant-search", FILE_RESOURCE, ["search"]);

  function reporter(): {
    readonly onProviderError: ProviderErrorReporter;
    readonly seen: { error: unknown; operation: ProviderErrorContext }[];
  } {
    const seen: { error: unknown; operation: ProviderErrorContext }[] = [];
    return { onProviderError: (error, operation) => void seen.push({ error, operation }), seen };
  }

  it("hands a tool handler's throw to the host and puts none of it on the wire", async () => {
    const thrown = new Error('postgres: relation "notes" does not exist');
    const { onProviderError, seen } = reporter();
    const events: AuditEvent[] = [];
    const kernel = kernelWith([SEARCH_GRANT], {
      onProviderError,
      audit: { record: async (event) => void events.push(event) },
    });
    kernel.registerTool({
      definition: FILE_TOOL,
      parseArguments: (arguments_) => arguments_,
      invoke: async () => {
        throw thrown;
      },
    });

    const result = await kernel.invokeTool(context(), toolCall());

    // Whole and unwrapped: the stack is the only thing that says which provider
    // failed and where, and a code cannot carry it.
    expect(seen).toHaveLength(1);
    expect(seen[0]?.error).toBe(thrown);
    // `reasonCode` is what closes the loop -- it is exactly what the agent was
    // told and exactly what audit recorded, so a host joins all three without
    // correlating on timing.
    expect(seen[0]?.operation).toEqual({
      kind: "tool",
      reasonCode: "tool_execution_failed",
      traceId: "trace-1",
      namespaceId: "world-alpha",
      operationId: "call-1",
      tool: FILE_TOOL.name,
      resource: FILE_RESOURCE,
      action: "search",
    });
    expect(result).toMatchObject({ status: "failed" });
    expect(result.status === "failed" ? result.error.code : undefined).toBe(
      "tool_execution_failed",
    );
    // The join itself, which is the whole point of carrying `reasonCode`: the
    // audit event for this operation records the same string the hook was
    // given, so a host's log line and its audit trail meet without anyone
    // correlating on timestamps.
    expect(events.at(-1)).toMatchObject({
      type: "tool.invoked",
      reason: seen[0]?.operation.reasonCode,
    });

    // And nowhere else. Audit has never carried call data, and a thrown message
    // may hold arguments, rows, or credentials the provider had in scope.
    expect(JSON.stringify(result)).not.toContain("relation");
    expect(JSON.stringify(events)).not.toContain("relation");
  });

  it("names the kind of port that failed, so one hook can be routed", async () => {
    const { onProviderError, seen } = reporter();
    const messagingResource: ResourceRef = {
      namespace: "sharedos.messaging",
      path: addressPath(RECEIVER),
      owner: OWNER,
    };
    const resources = new ResourceProviderRegistry();
    resources.register({
      namespace: "files",
      async invoke() {
        throw new Error("blob store offline");
      },
    });
    const kernel = kernelWith(
      [
        grant("grant-read", { ...FILE_RESOURCE, owner: OWNER }, ["read"]),
        grant("grant-send", messagingResource, ["send"]),
      ],
      {
        onProviderError,
        resources,
        messageTransport: {
          async deliver() {
            throw new Error("device unreachable");
          },
        },
      },
    );

    await kernel.invokeResource(context(), {
      operationId: "operation-1",
      resource: { ...FILE_RESOURCE, owner: OWNER },
      action: "read",
    });
    await kernel.sendMessage(context(), {
      version: "1",
      id: "message-1",
      sender: ACTOR,
      receiver: RECEIVER,
      purpose: "prepare-update",
      payload: { request: "Summarize the architecture" },
      traceId: "trace-1",
      createdAt: NOW,
    });

    // One hook, two ports, and the difference is data rather than a second
    // option a host would have had to know to install. A fifth port added later
    // reaches every host that installed this one.
    expect(seen.map(({ operation }) => [operation.kind, operation.reasonCode])).toEqual([
      ["resource", "resource_execution_failed"],
      ["message", "message_delivery_failed"],
    ]);
    expect(seen[0]?.operation.operationId).toBe("operation-1");
  });

  it("carries a tool provider's own error under the catalogue failure it caused", async () => {
    const thrown = new Error("notion: 401 unauthorized");
    const { onProviderError, seen } = reporter();
    const provider: ContextToolProvider = {
      id: "notion",
      async listTools() {
        throw thrown;
      },
    };
    const kernel = kernelWith([SEARCH_GRANT], { onProviderError, toolProviders: [provider] });

    const result = await kernel.invokeTool(context(), toolCall());

    expect(result.status).toBe("failed");
    expect(seen[0]?.operation).toMatchObject({
      kind: "tool_catalog",
      reasonCode: "tool_catalog_unavailable",
    });
    // The kernel wraps a provider failure in one sentence every caller can read,
    // which would have destroyed the only account of what actually broke. It is
    // the `cause` instead, so the wrapper is what a caller matches on and the
    // provider's error is what an operator reads.
    expect((seen[0]?.error as Error).message).toMatch(/failed to resolve its catalog/u);
    expect((seen[0]?.error as Error).cause).toBe(thrown);
  });

  it("is observational: a sink that throws changes nothing", async () => {
    let called = false;
    const kernel = kernelWith([SEARCH_GRANT], {
      onProviderError: () => {
        called = true;
        throw new Error("the host's logger is down");
      },
    });
    kernel.registerTool({
      definition: FILE_TOOL,
      parseArguments: (arguments_) => arguments_,
      invoke: async () => {
        throw new Error("provider failed");
      },
    });

    // A diagnostic that can turn one failure into two is a liability, so the
    // guarantee is that installing it is free.
    await expect(kernel.invokeTool(context(), toolCall())).resolves.toMatchObject({
      status: "failed",
      error: { code: "tool_execution_failed" },
    });
    // Asserted, because without it this test passes with the hook entirely
    // dead -- it would be restating the plain tool-failure case under a name
    // that claims to be about the guard.
    expect(called).toBe(true);
  });

  it("reports the synchronous tool callbacks that run before execution", async () => {
    const parseThrow = new Error("argument parser blew up");
    const requirementThrow = new Error("requirement resolver blew up");
    const { onProviderError, seen } = reporter();
    const kernel = kernelWith(
      [
        SEARCH_GRANT,
        grant("grant-calendar", { namespace: "calendar", path: ["primary"] }, ["create"]),
      ],
      { onProviderError },
    );
    kernel.registerTool({
      definition: FILE_TOOL,
      parseArguments: () => {
        throw parseThrow;
      },
      invoke: successfulTool().invoke,
    });
    kernel.registerTool({
      definition: CALENDAR_TOOL,
      parseArguments: (arguments_) => arguments_,
      resolveRequirement: () => {
        throw requirementThrow;
      },
      invoke: successfulTool(CALENDAR_TOOL).invoke,
    });

    const parsed = await kernel.invokeTool(context(), toolCall());
    const resolved = await kernel.invokeTool(
      context(),
      toolCall({ id: "call-2", tool: CALENDAR_TOOL.name }),
    );

    // Both are the tool's own code, so both are `kind: "tool"`. Neither has a
    // requirement to name yet -- the parser runs before one is resolved, and
    // the resolver is what failed to produce one.
    expect(seen[0]).toEqual({
      error: parseThrow,
      operation: {
        kind: "tool",
        reasonCode: "invalid_tool_arguments",
        traceId: "trace-1",
        namespaceId: "world-alpha",
        operationId: "call-1",
        tool: FILE_TOOL.name,
      },
    });
    expect(seen[1]).toEqual({
      error: requirementThrow,
      operation: {
        kind: "tool",
        reasonCode: "tool_requirement_resolution_failed",
        traceId: "trace-1",
        namespaceId: "world-alpha",
        operationId: "call-2",
        tool: CALENDAR_TOOL.name,
      },
    });
    // Traced to the consumer, not just to the context object: each reported
    // code is the one the caller was actually answered with.
    expect(parsed.status === "failed" ? parsed.error.code : undefined).toBe(
      seen[0]?.operation.reasonCode,
    );
    expect(resolved.status === "failed" ? resolved.error.code : undefined).toBe(
      seen[1]?.operation.reasonCode,
    );
  });

  it("reports a message capability resolver that cannot decide, naming no call", async () => {
    const thrown = new Error("recipient directory unreachable");
    const { onProviderError, seen } = reporter();
    const kernel = kernelWith([], {
      onProviderError,
      messageCapabilityResolver: {
        resolve() {
          throw thrown;
        },
      },
    });

    const result = await kernel.sendMessage(context(), {
      version: "1",
      id: "message-1",
      sender: ACTOR,
      receiver: RECEIVER,
      purpose: "prepare-update",
      payload: { request: "Summarize the architecture" },
      traceId: "trace-1",
      createdAt: NOW,
    });

    // A send outside a tool call has no call id and no tool, so the context
    // carries only what the kernel actually knew.
    expect(seen).toEqual([
      {
        error: thrown,
        operation: {
          kind: "message",
          reasonCode: "message_requirement_resolution_failed",
          traceId: "trace-1",
          namespaceId: "world-alpha",
        },
      },
    ]);
    expect(result.status === "failed" ? result.error.code : undefined).toBe(
      "message_requirement_resolution_failed",
    );
  });

  it("reports a router that cannot resolve the reply it was asked for", async () => {
    const thrown = new Error("reply queue unreachable");
    const { onProviderError, seen } = reporter();
    const kernel = kernelWith(
      [
        grant(
          "grant-send",
          { namespace: "sharedos.messaging", path: addressPath(RECEIVER), owner: OWNER },
          ["send"],
        ),
      ],
      {
        onProviderError,
        messageTransport: {
          async deliver(_context, envelope) {
            return { messageId: envelope.id, status: "accepted" as const, timestamp: NOW };
          },
        },
        messageRequestRouter: {
          async resolveReply() {
            throw thrown;
          },
        },
      },
    );

    const result = await kernel.invokeTool(context(["messages"]), {
      id: "call-1",
      tool: MESSAGE_REQUEST_TOOL_NAME,
      arguments: { recipient: RECEIVER, payload: { question: "status" } },
      traceId: "trace-1",
      requestedAt: NOW,
    });

    // The router is a host port, reached only through the request tool, so the
    // report names the tool call it arrived under.
    expect(seen).toEqual([
      {
        error: thrown,
        operation: {
          kind: "message",
          reasonCode: "message_reply_resolution_failed",
          traceId: "trace-1",
          namespaceId: "world-alpha",
          operationId: "call-1",
          tool: MESSAGE_REQUEST_TOOL_NAME,
        },
      },
    ]);
    expect(result.status === "failed" ? result.error.code : undefined).toBe(
      "message_reply_resolution_failed",
    );
  });

  it("is not awaited, so a sink that never returns cannot stall the operation", async () => {
    const kernel = kernelWith([SEARCH_GRANT], {
      onProviderError: () => {
        // A host logger that hangs. If the kernel awaited this, the call below
        // would never settle and the test would time out rather than fail.
        void new Promise(() => undefined);
      },
    });
    kernel.registerTool({
      definition: FILE_TOOL,
      parseArguments: (arguments_) => arguments_,
      invoke: async () => {
        throw new Error("provider failed");
      },
    });

    await expect(kernel.invokeTool(context(), toolCall())).resolves.toMatchObject({
      status: "failed",
    });
  });

  it("leaves the authority ports it does not cover alone", async () => {
    const { onProviderError, seen } = reporter();
    const kernel = new SharedOSKernel({
      onProviderError,
      grantSource: {
        async load() {
          throw new Error("grant store unreachable");
        },
      },
    });
    kernel.registerTool(successfulTool());

    // The negative half of the documented boundary. `GrantSource` and the other
    // authority ports still discard their cause, and the docs say so; a later
    // change that wired them without saying so would show up here.
    await expect(kernel.invokeTool(context(), toolCall())).resolves.toMatchObject({
      status: "denied",
      error: { code: "authority_unavailable" },
    });
    expect(seen).toEqual([]);
  });

  it("does not report an operation the caller aborted", async () => {
    const { onProviderError, seen } = reporter();
    const controller = new AbortController();
    const kernel = kernelWith([SEARCH_GRANT], { onProviderError });
    kernel.registerTool({
      definition: FILE_TOOL,
      parseArguments: (arguments_) => arguments_,
      invoke: async () => {
        controller.abort(new Error("caller went away"));
        throw new Error("aborted mid-flight");
      },
    });

    // An abort is re-thrown ahead of the containment. A caller that stopped the
    // work is not a defect, and a hook that fired here would report every
    // cancelled call as a provider failure.
    await expect(
      kernel.invokeTool(context(), toolCall(), { signal: controller.signal }),
    ).rejects.toThrow(/caller went away/u);
    expect(seen).toEqual([]);
  });
});

describe("SharedOSKernel host ceiling", () => {
  const frozen: HostCeiling = {
    narrow: () => ({ allowed: false, reasonCode: "frozen", metadata: { rule: "hr-freeze" } }),
  };

  it("audits a policy refusal as its own reason, on a grant that existed", async () => {
    const events: AuditEvent[] = [];
    const kernel = kernelWith([grant("grant-files", FILE_RESOURCE, ["search"])], {
      audit: { record: async (event) => void events.push(event) },
      authorizer: new CapabilityAuthorizer({ hostCeiling: frozen }),
    });
    kernel.registerTool(successfulTool());

    const result = await kernel.invokeTool(context(), toolCall());

    // The wire stays coarse, deliberately: telling the model that policy
    // overrode a grant would confirm the grant exists.
    expect(result).toMatchObject({ status: "denied", error: { code: "tool_unavailable" } });

    // Audit is where the real reason lives, and it is not `no_matching_grant`.
    const decision = events.find(({ type }) => type === "authorization.checked");
    expect(decision).toMatchObject({
      outcome: "denied",
      reason: "host_policy_denied",
      grantId: "grant-files",
      metadata: { rule: "hr-freeze" },
    });
    // Not an infrastructure denial: a deliberate decision the deployment made.
    expect(decision?.metadata).not.toHaveProperty("failClosed");
  });

  it("says on every authority load whether a ceiling could refuse anything", async () => {
    const withCeiling: AuditEvent[] = [];
    const withoutCeiling: AuditEvent[] = [];

    await kernelWith([], {
      audit: { record: async (event) => void withCeiling.push(event) },
      authorizer: new CapabilityAuthorizer({ hostCeiling: frozen }),
    }).listTools(context());
    await kernelWith([], {
      audit: { record: async (event) => void withoutCeiling.push(event) },
    }).listTools(context());

    // Without this, an audit stream containing no policy denials cannot be told
    // apart from one produced by a deployment that has no policy port at all.
    expect(withCeiling.find(({ type }) => type === "authority.resolved")?.metadata).toMatchObject({
      hostCeiling: "installed",
    });
    expect(
      withoutCeiling.find(({ type }) => type === "authority.resolved")?.metadata,
    ).toMatchObject({ hostCeiling: "absent" });
  });

  it.each([false, true])(
    "does not let a ceiling stamp failClosed: %s onto its own refusal",
    async (forged) => {
      const events: AuditEvent[] = [];
      const forging: HostCeiling = {
        narrow: () => ({
          allowed: false,
          reasonCode: "frozen",
          metadata: { failClosed: forged, consumed: true, rule: "hr-freeze" },
        }),
      };
      const kernel = kernelWith([grant("grant-files", FILE_RESOURCE, ["search"])], {
        audit: { record: async (event) => void events.push(event) },
        authorizer: new CapabilityAuthorizer({ hostCeiling: forging }),
      });
      kernel.registerTool(successfulTool());

      await kernel.invokeTool(context(), toolCall());

      // `true` is the dangerous direction and the reason the key is stripped
      // rather than overwritten: the kernel only ever *sets* `failClosed` on an
      // infrastructure denial, so a ceiling could otherwise relabel a deliberate
      // refusal as an outage and move it out of the policy counts.
      expect(events.find(({ type }) => type === "authorization.checked")?.metadata).toEqual({
        rule: "hr-freeze",
        consumed: false,
      });
    },
  );

  it("fails an operation closed and audits it when the ceiling itself is broken", async () => {
    const events: AuditEvent[] = [];
    const broken: HostCeiling = {
      narrow: () => {
        throw new Error("policy table is malformed");
      },
    };
    const kernel = kernelWith([grant("grant-files", FILE_RESOURCE, ["search"])], {
      audit: { record: async (event) => void events.push(event) },
      authorizer: new CapabilityAuthorizer({ hostCeiling: broken }),
    });
    kernel.registerTool(successfulTool());

    const result = await kernel.invokeTool(context(), toolCall());

    // This is the path where one bad policy row denies every operation in the
    // deployment, so the record has to say it was an outage and not a decision.
    expect(result).toMatchObject({ status: "denied", error: { code: "tool_unavailable" } });
    expect(events.find(({ type }) => type === "authorization.checked")).toMatchObject({
      outcome: "denied",
      reason: "host_policy_unavailable",
      metadata: { failClosed: true },
    });
  });

  it("says a ceiling is installed even on the turn where authority could not load", async () => {
    const events: AuditEvent[] = [];
    const kernel = new SharedOSKernel({
      grantSource: {
        load: async () => {
          throw new Error("grant store is unreachable");
        },
      },
      audit: { record: async (event) => void events.push(event) },
      authorizer: new CapabilityAuthorizer({ hostCeiling: frozen }),
    });

    await kernel.listTools(context());

    // "Every authority load" includes the failed ones. A reader excluding
    // fail-closed turns would otherwise lose the flag exactly when a deployment
    // is misbehaving.
    expect(events.find(({ type }) => type === "authority.resolved")).toMatchObject({
      outcome: "failed",
      metadata: { failClosed: true, hostCeiling: "installed" },
    });
  });

  it("withholds a tool from the catalogue that the ceiling would refuse", async () => {
    const kernel = kernelWith([grant("grant-files", FILE_RESOURCE, ["search"])], {
      authorizer: new CapabilityAuthorizer({ hostCeiling: frozen }),
    });
    kernel.registerTool(successfulTool());

    // Discovery and invocation agree, which is the property ADR 0016 requires
    // and this ADR extends to policy.
    await expect(kernel.listTools(context())).resolves.toEqual([]);
  });
});

describe("SharedOSKernel host policy", () => {
  /** Freezes whichever namespaces the turn's loaded policy names. */
  const fromPolicy: HostCeiling<{ readonly frozen: readonly string[] }> = {
    narrow: (decision, request, _context, policy) =>
      policy !== undefined && policy.frozen.includes(request.resource.namespace)
        ? { allowed: false, reasonCode: "frozen", metadata: { rule: "loaded-freeze" } }
        : decision,
  };

  it("loads policy once at the turn boundary and decides every operation in the turn against it", async () => {
    const events: AuditEvent[] = [];
    let loads = 0;
    const kernel = kernelWith([grant("grant-files", FILE_RESOURCE, ["search"])], {
      audit: { record: async (event) => void events.push(event) },
      policySource: {
        load: async () => {
          loads += 1;
          return { policy: { frozen: ["files"] }, version: "freeze-7" };
        },
      },
      authorizer: new CapabilityAuthorizer({ hostCeiling: fromPolicy }),
    });
    kernel.registerTool(successfulTool());

    const turn = await kernel.openTurnAuthority(context());
    const listed = await kernel.listTools(context());
    const result = await kernel.invokeTool(context(), toolCall());
    turn.close();

    // One load, however many decisions: the rule the grant set is held to.
    expect(loads).toBe(1);
    expect(turn.status).toBe("resolved");
    expect(listed).toEqual([]);
    expect(result).toMatchObject({ status: "denied", error: { code: "tool_unavailable" } });
    expect(events.find(({ type }) => type === "authority.resolved")?.metadata).toMatchObject({
      hostCeiling: "installed",
      hostPolicy: "loaded",
    });
    // The listing names the policy state it was decided against, beside the
    // authority it was decided against, and counts what that cost: one tool,
    // by a decision rather than an outage.
    const listing = events.find(({ type }) => type === "tool.catalog.listed");
    expect(listing).toMatchObject({
      outcome: "succeeded",
      metadata: { hostPolicyVersion: "freeze-7", withheldCount: 1 },
    });
    expect(listing?.metadata).not.toHaveProperty("failClosed");
    expect(events.filter(({ type }) => type === "authorization.checked").at(-1)).toMatchObject({
      outcome: "denied",
      reason: "host_policy_denied",
      grantId: "grant-files",
      metadata: { rule: "loaded-freeze" },
    });
  });

  it("hands the source its own copy of the context, and the turn's signal", async () => {
    const seenByCeiling: string[] = [];
    let seenSignal: unknown;
    const kernel = kernelWith([grant("grant-files", FILE_RESOURCE, ["search"])], {
      policySource: {
        load: async (access, signal) => {
          seenSignal = signal;
          // A source that edits the context it was handed edits a copy.
          (access as { purpose: string }).purpose = "tampered";
          return { policy: {}, version: "empty-1" };
        },
      },
      authorizer: new CapabilityAuthorizer({
        hostCeiling: {
          narrow: (decision, _request, ceilingContext) => {
            seenByCeiling.push(ceilingContext.purpose);
            return decision;
          },
        },
      }),
    });

    const turn = await kernel.openTurnAuthority(context());
    await kernel.authorize(context(), { resource: FILE_RESOURCE, action: "search" });
    turn.close();

    expect(seenSignal).toBeInstanceOf(AbortSignal);
    expect(seenByCeiling).toEqual(["prepare-update"]);
  });

  it("fails every policy decision in the turn closed when the policy could not be loaded, and says so once", async () => {
    const events: AuditEvent[] = [];
    const reports: ProviderErrorContext[] = [];
    let loads = 0;
    let consulted = 0;
    const kernel = kernelWith([grant("grant-files", FILE_RESOURCE, ["search"])], {
      audit: { record: async (event) => void events.push(event) },
      onProviderError: (_error, operation) => void reports.push(operation),
      policySource: {
        load: async () => {
          loads += 1;
          throw new Error("policy table is unreachable");
        },
      },
      authorizer: new CapabilityAuthorizer({
        hostCeiling: {
          narrow: (decision) => {
            consulted += 1;
            return decision;
          },
        },
      }),
    });
    kernel.registerTool(successfulTool());

    const turn = await kernel.openTurnAuthority(context());
    const first = await kernel.invokeTool(context(), toolCall());
    const second = await kernel.invokeTool(context(), toolCall());
    const listed = await kernel.listTools(context());
    turn.close();

    // Authority itself loaded. It is the policy the turn cannot decide against.
    expect(turn.status).toBe("resolved");
    for (const result of [first, second]) {
      expect(result).toMatchObject({ status: "denied", error: { code: "tool_unavailable" } });
    }
    // Held for the turn like an unavailable grant source: not retried per
    // decision, reported once, and the ceiling is never asked to decide
    // without it.
    expect(loads).toBe(1);
    expect(consulted).toBe(0);
    expect(reports).toEqual([
      {
        kind: "policy",
        reasonCode: "host_policy_unavailable",
        traceId: "trace-1",
        namespaceId: "world-alpha",
      },
    ]);
    expect(events.find(({ type }) => type === "authority.resolved")?.metadata).toMatchObject({
      hostCeiling: "installed",
      hostPolicy: "unavailable",
    });
    const decisions = events.filter(({ type }) => type === "authorization.checked");
    expect(decisions.length).toBeGreaterThan(0);
    for (const decision of decisions) {
      // An outage, not a decision: the record says so, and the bucket is the
      // one a broken ceiling already uses.
      expect(decision).toMatchObject({
        outcome: "denied",
        reason: "host_policy_unavailable",
        metadata: { failClosed: true },
      });
    }
    // The catalogue was computed, and empty, and the record says why the
    // difference matters: what it withheld, it withheld by an outage, and it
    // has no policy version to name.
    expect(listed).toEqual([]);
    const listing = events.find(({ type }) => type === "tool.catalog.listed");
    expect(listing).toMatchObject({
      outcome: "succeeded",
      metadata: { withheldCount: 1, failClosed: true },
    });
    expect(listing?.metadata).not.toHaveProperty("hostPolicyVersion");
  });

  it("treats a source that answered without naming its version as an outage", async () => {
    const events: AuditEvent[] = [];
    const errors: unknown[] = [];
    const reports: ProviderErrorContext[] = [];
    const kernel = kernelWith([grant("grant-files", FILE_RESOURCE, ["search"])], {
      audit: { record: async (event) => void events.push(event) },
      onProviderError: (error, operation) => {
        errors.push(error);
        reports.push(operation);
      },
      // The pre-`LoadedPolicy` shape: a bare policy, nothing to record it by.
      policySource: { load: async () => ({ frozen: [] }) as unknown as LoadedPolicy },
      authorizer: new CapabilityAuthorizer({ hostCeiling: { narrow: (decision) => decision } }),
    });

    await expect(
      kernel.authorize(context(), { resource: FILE_RESOURCE, action: "search" }),
    ).resolves.toMatchObject({ allowed: false, reasonCode: "host_policy_unavailable" });

    // Nothing could pin a decision to the policy it was made against, so
    // nothing was decided against it -- and the host is told, once, in the
    // shape a throw would have been.
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(TypeError);
    expect(reports).toEqual([
      {
        kind: "policy",
        reasonCode: "host_policy_unavailable",
        traceId: "trace-1",
        namespaceId: "world-alpha",
      },
    ]);
    expect(events.find(({ type }) => type === "authority.resolved")?.metadata).toMatchObject({
      hostPolicy: "unavailable",
    });
  });

  it("records what the policy load came to even on a turn where authority could not load", async () => {
    const events: AuditEvent[] = [];
    const kernel = new SharedOSKernel({
      grantSource: {
        load: async () => {
          throw new Error("grant store is unreachable");
        },
      },
      policySource: { load: async () => ({ policy: { frozen: [] }, version: "freeze-0" }) },
      audit: { record: async (event) => void events.push(event) },
    });

    await kernel.listTools(context());

    // The two loads are independent, and the record says what each did.
    expect(events.find(({ type }) => type === "authority.resolved")).toMatchObject({
      outcome: "failed",
      metadata: { failClosed: true, hostCeiling: "absent", hostPolicy: "loaded" },
    });
  });

  it("says no policy was loaded when no source is installed", async () => {
    const events: AuditEvent[] = [];

    await kernelWith([], { audit: { record: async (event) => void events.push(event) } }).listTools(
      context(),
    );

    // `absent` is "no source", not "no policy": a ceiling may close over its
    // own, and the record beside it says whether one is installed.
    expect(events.find(({ type }) => type === "authority.resolved")?.metadata).toMatchObject({
      hostCeiling: "absent",
      hostPolicy: "absent",
    });
  });

  it("re-throws a cancelled load rather than reporting it as an outage", async () => {
    const reports: ProviderErrorContext[] = [];
    const controller = new AbortController();
    const kernel = kernelWith([], {
      onProviderError: (_error, operation) => void reports.push(operation),
      policySource: {
        load: async (_access, signal) => {
          controller.abort(new Error("caller went away"));
          throw signal.reason;
        },
      },
    });

    await expect(
      kernel.openTurnAuthority(context(), { signal: controller.signal }),
    ).rejects.toThrow(/caller went away/u);
    expect(reports).toEqual([]);
  });

  it("refuses a policy source that cannot load", () => {
    expect(
      () =>
        new SharedOSKernel({
          grantSource: new TestGrantSource(),
          policySource: {} as PolicySource,
        }),
    ).toThrow(TypeError);
  });
});

describe("SharedOSKernel audit routing", () => {
  it("names the boundary and the cause on every tool refusal it records", async () => {
    const events: AuditEvent[] = [];
    const kernel = kernelWith([], { audit: { record: async (e) => void events.push(e) } });
    kernel.registerTool(successfulTool());

    // Not registered, and the wire code cannot say which of the three this is.
    await kernel.invokeTool(context(), { ...toolCall(), tool: "files.invented" });
    // Registered, granted, but its namespace is off for this context.
    await kernel.invokeTool({ ...context(), enabledToolNamespaces: [] }, toolCall());
    // Registered and enabled, but no grant makes it discoverable.
    await kernel.invokeTool(context(), toolCall());

    const invoked = events.filter(({ type }) => type === "tool.invoked");
    expect(invoked.map(({ reason }) => reason)).toEqual([
      "tool_unavailable",
      "tool_unavailable",
      "tool_unavailable",
    ]);
    // One code on the wire, three situations in the trail. `errors.md` has
    // promised this disambiguation all along and delivered it for one of them.
    expect(invoked.map(({ metadata }) => metadata?.["cause"])).toEqual([
      "not_registered",
      "namespace_disabled",
      "no_matching_grant",
    ]);
    expect(invoked.every(({ metadata }) => metadata?.["source"] === "kernel")).toBe(true);
  });

  it("records a listing by what it was computed from, not by the names it returned or withheld", async () => {
    const events: AuditEvent[] = [];
    const kernel = kernelWith([grant("grant-search", FILE_RESOURCE, ["search"])], {
      audit: { record: async (e) => void events.push(e) },
    });
    kernel.registerTool(successfulTool(CALENDAR_TOOL));
    kernel.registerTool(successfulTool());

    const visible = await kernel.listTools(context(["files"]));

    // The file tool shown; the calendar tool withheld by the caller's own
    // filter. The record carries the catalogue as an identifier, the filter,
    // and a count -- and, above metadata, the authority it was decided against.
    expect(visible).toEqual([FILE_TOOL]);
    const listed = events.filter(({ type }) => type === "tool.catalog.listed");
    expect(listed).toHaveLength(1);
    expect(listed[0]?.authorityHash).toBe(
      events.find(({ type }) => type === "authority.resolved")?.authorityHash,
    );
    expect(listed[0]?.metadata).toEqual({
      catalogHash: await catalogHash(publishToolCatalog([FILE_TOOL])),
      enabledNamespaces: ["files"],
      withheldCount: 1,
      source: "kernel",
    });
  });

  it("records the catalogue under the identifier a harness is handed for it", async () => {
    const events: AuditEvent[] = [];
    const kernel = kernelWith(
      [
        grant("grant-search", FILE_RESOURCE, ["search"]),
        grant("grant-calendar", CALENDAR_TOOL.requiredCapability.resource, ["create"]),
      ],
      { audit: { record: async (e) => void events.push(e) } },
    );
    kernel.registerTool(successfulTool(CALENDAR_TOOL));
    kernel.registerTool(successfulTool());

    const published = await kernel.listPublishedTools(context(), { executionId: "exec-1" });

    // One catalogue, one identifier, wherever it is read: the manifest a
    // harness reports and the audit record the kernel wrote match on it, and
    // registration order is not part of it.
    expect(published.tools.map(({ name }) => name)).toEqual([CALENDAR_TOOL.name, FILE_TOOL.name]);
    expect(events.find(({ type }) => type === "tool.catalog.listed")?.metadata).toMatchObject({
      catalogHash: published.catalogHash,
      enabledNamespaces: ["files", "calendar"],
      withheldCount: 0,
    });
  });

  it("records a refused listing with the same identifiers and an empty catalogue", async () => {
    const events: AuditEvent[] = [];
    const kernel = new SharedOSKernel({
      grantSource: {
        load: async () => {
          throw new Error("grant store is unreachable");
        },
      },
      audit: { record: async (e) => void events.push(e) },
    });

    await expect(kernel.listTools(context(["files"]))).resolves.toEqual([]);

    expect(events.find(({ type }) => type === "tool.catalog.listed")).toMatchObject({
      outcome: "denied",
      reason: "authority_unavailable",
      metadata: {
        catalogHash: await catalogHash([]),
        enabledNamespaces: ["files"],
        withheldCount: 0,
        failClosed: true,
        authority: "grant_source_failed",
        source: "kernel",
      },
    });
  });

  it("records how a turn ended, once, from the boundary that ended it", async () => {
    const events: AuditEvent[] = [];
    const kernel = kernelWith([], { audit: { record: async (e) => void events.push(e) } });

    await kernel.recordTurnEnd(context(), {
      executionId: "exec-1",
      status: "failed",
      reasonCode: "runtime_failed",
      endedBy: "envelope",
    });

    expect(events).toEqual([
      expect.objectContaining({
        type: "turn.ended",
        outcome: "failed",
        reason: "runtime_failed",
        operationId: "exec-1",
        metadata: { source: "envelope", endedBy: "envelope" },
      }),
    ]);
  });

  it("records a cancelled turn as failed with its own reason, adding no outcome", async () => {
    const events: AuditEvent[] = [];
    const kernel = kernelWith([], { audit: { record: async (e) => void events.push(e) } });

    await kernel.recordTurnEnd(context(), {
      executionId: "exec-2",
      status: "cancelled",
      reasonCode: "turn_cancelled",
    });

    // `AuditOutcome` is a compatibility surface every host persists against, so
    // a deadline is `failed` with a reason rather than a sixth value.
    expect(events[0]).toMatchObject({ type: "turn.ended", outcome: "failed" });
    expect(events[0]?.reason).toBe("turn_cancelled");
  });

  it("records a call the envelope refused as the attempted call it was", async () => {
    const events: AuditEvent[] = [];
    const kernel = kernelWith([], { audit: { record: async (e) => void events.push(e) } });

    await kernel.recordRefusedCall(context(), {
      callId: "call-9",
      tool: "files.delete",
      reasonCode: "tool_unavailable",
      cause: "not_offered",
    });

    // An agent naming a tool it was never offered is the clearest attempted
    // violation the system produces, and it reached no audit sink at all.
    expect(events[0]).toMatchObject({
      type: "tool.invoked",
      outcome: "denied",
      reason: "tool_unavailable",
      operationId: "call-9",
      tool: "files.delete",
      metadata: { source: "envelope", cause: "not_offered" },
    });
  });
});
