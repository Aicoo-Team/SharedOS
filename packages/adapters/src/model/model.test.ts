import { describe, expect, it, vi } from "vitest";

import type { ExecutionRequest, ExecutionResult, ToolDefinition } from "@aicoo/sharedos-contracts";
import { agentExecutionCapability } from "@aicoo/sharedos-core";
import {
  ESCALATION_ACTION,
  ESCALATION_RESOURCE_PATH,
  ESCALATION_TOOL_DEFINITION,
  ESCALATION_TOOL_NAMESPACE,
  SharedOSExecutor,
} from "@aicoo/sharedos-runtime";
import { createTestGrant, createTestKernel } from "@aicoo/sharedos-testkit";

import {
  ModelDriver,
  ModelRuntime,
  ToolNameCodec,
  type ModelClient,
  type ModelCompletionRequest,
  type ModelReply,
} from "./index.js";

const NOW = "2026-08-18T09:00:00.000Z";
const AGENT = { kind: "agent", agentId: "agent-1" } as const;
const OWNER = { kind: "human", userId: "owner-1" } as const;

const READ_TOOL: ToolDefinition = {
  name: "files.read",
  description: "Read one authorized file",
  namespace: "files",
  source: "sharedos",
  readWrite: "read",
  inputSchema: { type: "object", properties: { path: { type: "array" } } },
  requiredCapability: { resource: { namespace: "files", path: ["Workspace"] }, action: "read" },
  annotations: { readOnly: true },
};

const SNAPSHOT_TOOL: ToolDefinition = {
  ...READ_TOOL,
  name: "files.snapshot.list",
  description: "List snapshots",
};

const MANIFEST = {
  id: "sharedos.test.model",
  version: "1.0.0",
  protocolVersion: "1",
} as const;

function request(): ExecutionRequest {
  return {
    version: "1",
    executionId: "execution-1",
    agent: AGENT,
    context: {
      namespaceId: "namespace-1",
      enabledToolNamespaces: ["files", ESCALATION_TOOL_NAMESPACE],
      actor: AGENT,
      authority: OWNER,
      owner: OWNER,
      purpose: "test",
      traceId: "trace-1",
      now: NOW,
    },
    message: {
      version: "1",
      id: "message-1",
      sender: AGENT,
      receiver: AGENT,
      purpose: "test",
      payload: { text: "read the workspace" },
      traceId: "trace-1",
      createdAt: NOW,
    },
    tools: [READ_TOOL, ESCALATION_TOOL_DEFINITION],
  };
}

/** A model that answers with a scripted sequence, recording what it was asked. */
function scriptedClient(replies: readonly ModelReply[]): ModelClient & {
  readonly seen: ModelCompletionRequest[];
} {
  const seen: ModelCompletionRequest[] = [];
  let index = 0;
  return {
    model: "test-model",
    provider: "test-provider",
    seen,
    complete: async (completion: ModelCompletionRequest): Promise<ModelReply> => {
      seen.push(structuredClone(completion) as ModelCompletionRequest);
      const reply = replies[index] ?? { text: "done", toolCalls: [] };
      index += 1;
      return reply;
    },
  };
}

function testKernel() {
  const { kernel, audit } = createTestKernel({
    grants: [
      createTestGrant({
        id: "grant-turn",
        capabilities: [agentExecutionCapability(AGENT, OWNER)],
        purposes: ["test"],
      }),
      createTestGrant({
        id: "grant-escalation",
        capabilities: [
          {
            resource: {
              namespace: ESCALATION_TOOL_NAMESPACE,
              path: [...ESCALATION_RESOURCE_PATH],
              owner: OWNER,
            },
            actions: [ESCALATION_ACTION],
            scope: "descendants",
          },
        ],
        purposes: ["test"],
      }),
      createTestGrant({
        id: "grant-files",
        capabilities: [
          {
            resource: { namespace: "files", path: ["Workspace"], owner: OWNER },
            actions: ["read"],
            scope: "descendants",
          },
        ],
        purposes: ["test"],
      }),
    ],
  });
  kernel.registerTool({
    definition: ESCALATION_TOOL_DEFINITION,
    parseArguments: (arguments_) => arguments_,
    invoke: async (context, call) => ({
      callId: call.id,
      tool: call.tool,
      status: "failed",
      error: { code: "escalation_not_terminated", message: "should never be invoked" },
      completedAt: context.now,
    }),
  });
  kernel.registerTool({
    definition: READ_TOOL,
    parseArguments: (arguments_) => arguments_,
    invoke: async (context, call) => ({
      callId: call.id,
      tool: call.tool,
      status: "succeeded",
      output: { text: "file body" },
      completedAt: context.now,
    }),
  });
  return { kernel, audit };
}

async function runWith(client: ModelClient, options: { maxSteps?: number } = {}) {
  const { kernel, audit } = testKernel();
  const runtime = new ModelRuntime(new ModelDriver({ manifest: MANIFEST, client }));
  const result = await new SharedOSExecutor(kernel, runtime, { clock: () => NOW }).execute(
    // Lowered per test rather than by arming a world, so a ceiling this narrow
    // truncates exactly the turn that wants it and no other.
    options.maxSteps === undefined
      ? request()
      : { ...request(), options: { maxSteps: options.maxSteps } },
  );
  return { result, audit, calls: completedCalls(result) };
}

/** What the envelope recorded about each call, which is the stricter source. */
function completedCalls(
  result: ExecutionResult,
): { callId: string; tool: string; status: string; step?: number }[] {
  return result.events
    .filter((event) => event.type === "tool.completed")
    .map(
      (event) =>
        event.data as unknown as { callId: string; tool: string; status: string; step?: number },
    );
}

describe("the model tool-name codec", () => {
  it("round-trips a catalogued dotted name through the provider alphabet", () => {
    const codec = new ToolNameCodec([READ_TOOL, SNAPSHOT_TOOL]);
    expect(codec.toWire("files.read")).toBe("files_read");
    expect(codec.toWire("files.snapshot.list")).toBe("files_snapshot_list");
    expect(codec.fromWire("files_read")).toBe("files.read");
    expect(codec.fromWire("files_snapshot_list")).toBe("files.snapshot.list");
  });

  it("decodes a name outside the catalogue rather than dropping it", () => {
    // The uncatalogued attempt has to reach the envelope to be refused. A codec
    // that returned undefined here would erase the attempt instead.
    const codec = new ToolNameCodec([READ_TOOL]);
    expect(codec.fromWire("admin_grant_issue")).toBe("admin.grant.issue");
  });

  it("refuses a catalogue two of whose names collapse onto one wire name", () => {
    const underscored: ToolDefinition = { ...READ_TOOL, name: "files_read" };
    expect(() => new ToolNameCodec([READ_TOOL, underscored])).toThrow(/ambiguous/u);
  });
});

describe("a model driving a SharedOS turn", () => {
  it("offers the permission-filtered catalogue in the model's own tool shape", async () => {
    const client = scriptedClient([{ text: "done", toolCalls: [] }]);
    await runWith(client);

    expect(client.seen[0]?.tools).toEqual([
      {
        name: "files_read",
        description: READ_TOOL.description,
        parameters: READ_TOOL.inputSchema,
      },
      {
        name: "sharedos_escalate",
        description: ESCALATION_TOOL_DEFINITION.description,
        parameters: ESCALATION_TOOL_DEFINITION.inputSchema,
      },
    ]);
  });

  it("records the model the provider served, not the one that was asked for", async () => {
    const client = scriptedClient([{ text: "done", toolCalls: [], model: "substituted-model" }]);
    const { result } = await runWith(client);

    expect(result.metadata?.["model"]).toBe("substituted-model");
    expect(result.metadata?.["modelProvider"]).toBe("test-provider");
    expect(result.metadata?.["requestedModel"]).toBe("test-model");
  });

  it("re-authorizes each call and mediates it through the kernel", async () => {
    const client = scriptedClient([
      {
        text: "",
        toolCalls: [{ id: "call-1", name: "files_read", arguments: '{"path":["Workspace","a"]}' }],
      },
      { text: "done", toolCalls: [] },
    ]);
    const { result, calls } = await runWith(client);

    expect(result.status).toBe("succeeded");
    expect(calls).toEqual([{ callId: "call-1", tool: "files.read", status: "succeeded", step: 0 }]);
  });

  it("declares the step each call was made at, because it owns the loop", async () => {
    // The property that separates this column from one where a vendor CLI owns
    // the loop: SharedOS can still bound the turn by steps it declared itself.
    const client = scriptedClient([
      {
        text: "",
        toolCalls: [{ id: "call-1", name: "files_read", arguments: '{"path":["Workspace","a"]}' }],
      },
      {
        text: "",
        toolCalls: [{ id: "call-2", name: "files_read", arguments: '{"path":["Workspace","b"]}' }],
      },
      { text: "done", toolCalls: [] },
    ]);
    const { calls } = await runWith(client);

    expect(calls.map(({ step }) => step)).toEqual([0, 1]);
  });

  it("releases several calls from one reply one at a time, then speaks again", async () => {
    const client = scriptedClient([
      {
        text: "",
        toolCalls: [
          { id: "call-1", name: "files_read", arguments: '{"path":["Workspace","a"]}' },
          { id: "call-2", name: "files_read", arguments: '{"path":["Workspace","b"]}' },
        ],
      },
      { text: "done", toolCalls: [] },
    ]);
    const { calls } = await runWith(client);

    expect(calls).toHaveLength(2);
    // Two calls, two results, and only then a second model call: the wire format
    // requires every call in an assistant message to be answered first.
    expect(client.seen).toHaveLength(2);
    expect(client.seen[1]?.messages.filter(({ role }) => role === "tool")).toHaveLength(2);
  });

  it("passes an uncatalogued name through so the envelope can refuse it", async () => {
    const client = scriptedClient([
      { text: "", toolCalls: [{ id: "call-1", name: "admin_grant_issue", arguments: "{}" }] },
      { text: "done", toolCalls: [] },
    ]);
    const { calls } = await runWith(client);

    const [call] = calls;
    expect(call?.tool).toBe("admin.grant.issue");
    expect(call?.status).not.toBe("succeeded");
  });

  it("issues a call whose arguments did not parse rather than withholding it", async () => {
    const client = scriptedClient([
      { text: "", toolCalls: [{ id: "call-1", name: "files_read", arguments: "not json" }] },
      { text: "done", toolCalls: [] },
    ]);
    const { calls } = await runWith(client);

    // The call was made and belongs in the record; the kernel refuses it on its
    // own terms. A withheld call would read as one the model never attempted.
    expect(calls).toHaveLength(1);
    expect(calls[0]?.tool).toBe("files.read");
  });

  it("ends the turn when the model chooses the escalate affordance", async () => {
    const client = scriptedClient([
      {
        text: "",
        toolCalls: [
          {
            id: "call-1",
            name: "sharedos_escalate",
            arguments: '{"reason":"this needs authority I do not hold"}',
          },
        ],
      },
    ]);
    const { result, calls } = await runWith(client);

    expect(result.status).toBe("escalated");
    expect(result.status === "escalated" ? result.escalation.reason : undefined).toBe(
      "this needs authority I do not hold",
    );
    // Intercepted before it became a ToolCall: the kernel is never asked, and
    // the registered handler -- which fails on purpose -- is never reached.
    expect(calls).toEqual([]);
  });

  it("offers the escalate affordance as a tool rather than inferring it from prose", async () => {
    const client = scriptedClient([{ text: "done", toolCalls: [] }]);
    await runWith(client);

    // Escalation is something the model picks off the catalogue. Reading intent
    // out of an assistant message would make the row measure a phrase.
    expect(client.seen[0]?.tools.map(({ name }) => name)).toContain("sharedos_escalate");
  });

  it("drops calls queued behind an escalation instead of running them after it", async () => {
    const client = scriptedClient([
      {
        text: "",
        toolCalls: [
          { id: "call-1", name: "sharedos_escalate", arguments: '{"reason":"ask a human"}' },
          { id: "call-2", name: "files_read", arguments: '{"path":["Workspace","a"]}' },
        ],
      },
    ]);
    const { result, calls } = await runWith(client);

    // The turn ends at the escalation. Running what followed would do work on
    // the far side of a decision nobody has made yet.
    expect(result.status).toBe("escalated");
    expect(calls).toEqual([]);
  });

  it("escalates on a malformed reason rather than forwarding the call to the kernel", async () => {
    const client = scriptedClient([
      { text: "", toolCalls: [{ id: "call-1", name: "sharedos_escalate", arguments: "not json" }] },
    ]);
    const { result, calls } = await runWith(client);

    // Forwarding it would turn "the driver asked for a human" into "the agent
    // made a malformed call", which is the wrong record of what happened.
    expect(result.status).toBe("escalated");
    expect(calls).toEqual([]);
  });

  it("survives a turn truncated at the step ceiling, with no close handler to run", async () => {
    // The abrupt-termination path: the loop exhausts its steps and returns
    // through the `finally` that closes the session. `ModelSession` has no
    // `close` -- there is no socket to release -- and `closeSession` guards
    // `session?.close === undefined`, so this asserts the guard rather than
    // assuming it.
    const client = scriptedClient([
      {
        text: "",
        toolCalls: [{ id: "call-1", name: "files_read", arguments: '{"path":["Workspace","a"]}' }],
      },
      {
        text: "",
        toolCalls: [{ id: "call-2", name: "files_read", arguments: '{"path":["Workspace","b"]}' }],
      },
    ]);
    const session = await new ModelDriver({ manifest: MANIFEST, client }).open(
      request() as never,
      new AbortController().signal,
    );
    expect(session.close).toBeUndefined();

    const { result, calls } = await runWith(client, { maxSteps: 1 });

    expect(result.status).toBe("failed");
    expect(result.status === "failed" ? result.error.code : undefined).toBe("step_limit_exceeded");
    // The work done before the ceiling is still recorded. A truncated turn that
    // lost its operations would be indistinguishable from one that made none.
    expect(calls).toEqual([{ callId: "call-1", tool: "files.read", status: "succeeded", step: 0 }]);
  });

  it("is refused by the envelope when it declares a step past the ceiling", async () => {
    // The loop's own index stops at the ceiling, so this is the only way a
    // driver inside it can reach the envelope's step bound. Declaring a step is
    // a claim, not a permission: the envelope still decides.
    const client = scriptedClient([
      {
        text: "",
        toolCalls: [{ id: "call-1", name: "files_read", arguments: '{"path":["Workspace","a"]}' }],
      },
      { text: "done", toolCalls: [] },
    ]);
    const runtime = new ModelRuntime(
      new ModelDriver({ manifest: MANIFEST, client, declareStep: () => 4 }),
    );
    const { kernel } = testKernel();
    const result = await new SharedOSExecutor(kernel, runtime, { clock: () => NOW }).execute({
      ...request(),
      options: { maxSteps: 2 },
    });

    expect(completedCalls(result)).toEqual([
      {
        callId: "call-1",
        tool: "files.read",
        status: "denied",
        code: "step_limit_exceeded",
        step: 4,
      },
    ]);
  });

  it("fails the turn when the provider cannot be reached", async () => {
    const client: ModelClient = {
      model: "test-model",
      provider: "test-provider",
      complete: vi.fn(async () => {
        throw new Error("connection reset");
      }),
    };
    const { result } = await runWith(client);

    expect(result.status).toBe("failed");
    expect(result.status === "failed" ? result.error.code : undefined).toBe("model_call_failed");
  });
});
