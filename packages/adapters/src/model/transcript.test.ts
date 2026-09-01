import { describe, expect, it } from "vitest";

import type { ExecutionRequest, ToolDefinition } from "@aicoo/sharedos-contracts";
import { agentExecutionCapability } from "@aicoo/sharedos-core";
import { SharedOSExecutor } from "@aicoo/sharedos-runtime";
import { createTestGrant, createTestKernel } from "@aicoo/sharedos-testkit";

import { ModelDriver, ModelRuntime, TranscriptModelClient } from "./index.js";

const NOW = "2026-08-30T09:00:00.000Z";
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

async function runWith(client: TranscriptModelClient) {
  const { kernel } = createTestKernel({
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
  const runtime = new ModelRuntime(
    new ModelDriver({
      manifest: { id: "sharedos.test.model", version: "1.0.0", protocolVersion: "1" },
      client,
    }),
  );
  return new SharedOSExecutor(kernel, runtime, { clock: () => NOW }).execute(request());
}

describe("a transcript in the model seat", () => {
  it("replays supplied replies through the real driver, one reply per model call", async () => {
    const client = new TranscriptModelClient(
      {
        replies: [
          {
            text: "",
            toolCalls: [
              { id: "call-1", name: "files_read", arguments: '{"path":["Workspace","a"]}' },
            ],
            finishReason: "tool_calls",
          },
          { text: "done", toolCalls: [], finishReason: "stop" },
        ],
      },
      { provider: "test-suite" },
    );
    const result = await runWith(client);

    // The name came back through the driver's own codec and the call reached
    // the kernel under the transcript's id: nothing about the translation was
    // bypassed by the provider being a recording.
    expect(result.status).toBe("succeeded");
    const completed = result.events
      .filter((event) => event.type === "tool.completed")
      .map((event) => event.data as { callId: string; tool: string; status: string });
    expect(completed).toMatchObject([
      { callId: "call-1", tool: "files.read", status: "succeeded" },
    ]);
    // The second reply was released only after the first call was answered,
    // and the driver showed the answer to the "model" before asking again.
    expect(client.seen).toHaveLength(2);
    expect(client.seen[1]?.messages.map(({ role }) => role)).toEqual(["user", "assistant", "tool"]);
    // What the record names is the transcript, not a model that never ran.
    expect(result.metadata).toMatchObject({
      model: "transcript",
      modelProvider: "test-suite",
      finishReason: "stop",
    });
  });

  it("fails the turn when the transcript is spent rather than completing on its behalf", async () => {
    const client = new TranscriptModelClient({
      replies: [
        {
          text: "",
          toolCalls: [
            { id: "call-1", name: "files_read", arguments: '{"path":["Workspace","a"]}' },
          ],
        },
      ],
    });
    const result = await runWith(client);

    // A recording that ran out has nothing to say. Answering "done" for it
    // would grade a script that ended too early as the model choosing to stop.
    expect(result.status).toBe("failed");
    expect(result.status === "failed" ? result.error.code : undefined).toBe("model_call_failed");
    expect(result.status === "failed" ? result.error.message : undefined).toMatch(
      /transcript is spent: 1 replies were supplied and a 2nd was asked for/u,
    );
    expect(client.seen).toHaveLength(2);
  });

  it("refuses an empty transcript, and hands out copies rather than the supplied objects", async () => {
    expect(() => new TranscriptModelClient({ replies: [] })).toThrow(/at least one reply/u);

    const reply = { text: "done", toolCalls: [] };
    const client = new TranscriptModelClient({ replies: [reply] });
    const served = await client.complete({ messages: [], tools: [] }, new AbortController().signal);
    expect(served).toEqual(reply);
    expect(served).not.toBe(reply);
    expect(client.model).toBe("transcript");
    expect(client.provider).toBe("transcript");
  });

  it("refuses to answer once the turn's signal is aborted", async () => {
    const client = new TranscriptModelClient({ replies: [{ text: "done", toolCalls: [] }] });
    const controller = new AbortController();
    controller.abort(new Error("turn cancelled"));

    // Nothing is recorded and nothing is consumed: the recording did not
    // answer, exactly as a cancelled provider request would not have.
    await expect(client.complete({ messages: [], tools: [] }, controller.signal)).rejects.toThrow(
      "turn cancelled",
    );
    expect(client.seen).toHaveLength(0);
  });
});
