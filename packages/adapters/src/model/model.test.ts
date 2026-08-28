import { describe, expect, it, vi } from "vitest";

import type { ExecutionRequest, ExecutionResult, ToolDefinition } from "@aicoo/sharedos-contracts";
import { agentExecutionCapability } from "@aicoo/sharedos-core";
import { SharedOSExecutor } from "@aicoo/sharedos-runtime";
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
      enabledToolNamespaces: ["files"],
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
    tools: [READ_TOOL],
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

async function runWith(client: ModelClient) {
  const { kernel, audit } = createTestKernel({
    grants: [
      createTestGrant({
        id: "grant-turn",
        capabilities: [agentExecutionCapability(AGENT, OWNER)],
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
  const runtime = new ModelRuntime(new ModelDriver({ manifest: MANIFEST, client }));
  const result = await new SharedOSExecutor(kernel, runtime, { clock: () => NOW }).execute(
    request(),
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
