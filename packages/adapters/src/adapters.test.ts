import { describe, expect, it } from "vitest";

import type { ExecutionRequest, ToolDefinition, ToolResult } from "@aicoo/sharedos-contracts";
import { agentExecutionCapability } from "@aicoo/sharedos-core";
import { SharedOSExecutor, StandardRuntime } from "@aicoo/sharedos-runtime";
import { createTestGrant, createTestKernel } from "@aicoo/sharedos-testkit";

import {
  CLAUDE_CODE_REQUIREMENTS,
  claudeCodeProtocol,
  createClaudeCodeDriver,
} from "./claude-code/index.js";
import { CODEX_REQUIREMENTS, codexProtocol, createCodexDriver } from "./codex/index.js";
import { probeHarness } from "./node.js";
import { TranscriptTransport, type HarnessTranscript } from "./transcript.js";

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
  requiredCapability: {
    resource: { namespace: "files", path: ["Workspace"] },
    action: "read",
  },
  annotations: { readOnly: true },
};

function grants() {
  return [
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
  ];
}

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
      intent: "read",
      purpose: "test",
      payload: { text: "read the workspace" },
      traceId: "trace-1",
      createdAt: NOW,
    },
    tools: [READ_TOOL],
  };
}

async function runWith(driver: ConstructorParameters<typeof StandardRuntime>[0]) {
  const { kernel, audit } = createTestKernel({ grants: grants() });
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
  const result = await new SharedOSExecutor(kernel, new StandardRuntime(driver), {
    clock: () => NOW,
  }).execute(request());
  return { result, audit };
}

describe("the Codex protocol", () => {
  it("declares the permission-filtered catalogue as function tools", () => {
    expect(codexProtocol.describeTools([READ_TOOL])).toEqual([
      {
        type: "function",
        name: "files.read",
        description: READ_TOOL.description,
        parameters: READ_TOOL.inputSchema,
      },
    ]);
  });

  it("parses a function call, whose arguments arrive as a JSON string", () => {
    expect(
      codexProtocol.interpret({
        type: "function_call",
        call_id: "call-1",
        name: "files.read",
        arguments: '{"path":["Workspace"]}',
      }),
    ).toEqual([
      {
        type: "tool_call",
        callId: "call-1",
        tool: "files.read",
        arguments: { path: ["Workspace"] },
      },
    ]);
  });

  it("fails the turn rather than guessing when arguments will not parse", () => {
    const steps = codexProtocol.interpret({
      type: "function_call",
      call_id: "call-1",
      name: "files.read",
      arguments: "{not json",
    });

    expect(steps[0]).toMatchObject({ type: "failed" });
  });

  it("reports a refusal to the harness as a result, not as a crash", () => {
    const denied: ToolResult = {
      callId: "call-1",
      tool: "files.read",
      status: "denied",
      error: { code: "no_matching_grant", message: "denied" },
      completedAt: NOW,
    };
    const frame = codexProtocol.encodeToolResult(denied);

    expect(frame).toMatchObject({ type: "function_call_output", call_id: "call-1" });
    expect(JSON.parse(frame["output"] as string)).toEqual({
      status: "denied",
      error: { code: "no_matching_grant", message: "denied" },
    });
  });

  it("ignores frames that carry nothing relevant to the turn", () => {
    expect(codexProtocol.interpret({ type: "response.output_item.added" })).toEqual([]);
  });
});

describe("the Claude Code protocol", () => {
  it("declares the permission-filtered catalogue as message tools", () => {
    expect(claudeCodeProtocol.describeTools([READ_TOOL])).toEqual([
      {
        name: "files.read",
        description: READ_TOOL.description,
        input_schema: READ_TOOL.inputSchema,
      },
    ]);
  });

  it("reads every content block of one assistant message, in order", () => {
    expect(
      claudeCodeProtocol.interpret({
        type: "assistant",
        message: {
          content: [
            { type: "text", text: "looking" },
            { type: "tool_use", id: "t1", name: "files.read", input: { path: ["Workspace"] } },
            { type: "thinking", thinking: "hidden" },
            { type: "tool_use", id: "t2", name: "files.write", input: {} },
          ],
        },
      }),
    ).toEqual([
      { type: "message", text: "looking" },
      { type: "tool_call", callId: "t1", tool: "files.read", arguments: { path: ["Workspace"] } },
      { type: "tool_call", callId: "t2", tool: "files.write", arguments: {} },
    ]);
  });

  it("distinguishes a completed result from a failed one", () => {
    expect(
      claudeCodeProtocol.interpret({ type: "result", subtype: "success", result: "done" }),
    ).toEqual([{ type: "complete", output: { text: "done" } }]);
    expect(
      claudeCodeProtocol.interpret({ type: "result", is_error: true, result: "boom" })[0],
    ).toMatchObject({ type: "failed" });
  });

  it("marks a refused call so the harness knows it was refused", () => {
    const frame = claudeCodeProtocol.encodeToolResult({
      callId: "t1",
      tool: "files.read",
      status: "denied",
      error: { code: "no_matching_grant", message: "denied" },
      completedAt: NOW,
    });

    expect(frame).toMatchObject({
      type: "user",
      message: { content: [{ type: "tool_result", tool_use_id: "t1", is_error: true }] },
    });
  });
});

describe("a harness driven as a SharedOS turn", () => {
  const codexTranscript: HarnessTranscript = {
    batches: [
      [
        {
          type: "function_call",
          call_id: "call-1",
          name: "files.read",
          arguments: '{"path":["Workspace","notes.md"]}',
        },
      ],
      [{ type: "response.completed", response: { output_text: "read it" } }],
    ],
  };

  it("routes every harness tool call through the security envelope", async () => {
    const transport = new TranscriptTransport(codexTranscript);
    const { result, audit } = await runWith(createCodexDriver({ transport }));

    expect(result.status).toBe("succeeded");
    expect(result.status === "succeeded" ? result.output : undefined).toEqual({ text: "read it" });
    expect(audit.events.some(({ type }) => type === "tool.invoked")).toBe(true);
    expect(transport.written).toHaveLength(1);
    expect(transport.written[0]).toMatchObject({ type: "function_call_output" });
  });

  it("shows the harness the sanitised context and nothing else", async () => {
    const transport = new TranscriptTransport(codexTranscript);
    await runWith(createCodexDriver({ transport }));

    expect(Object.keys(transport.opened[0]?.context ?? {}).sort()).toEqual([
      "actor",
      "namespaceId",
      "now",
      "owner",
      "purpose",
      "traceId",
    ]);
    expect(JSON.stringify(transport.opened)).not.toContain("grant-files");
  });

  it("passes an unexposed tool name through instead of filtering it", async () => {
    // The adapter must not enforce. A guess at a tool outside the catalogue has
    // to reach the envelope, or the attempt is erased rather than refused.
    const transport = new TranscriptTransport({
      batches: [
        [{ type: "function_call", call_id: "call-1", name: "admin.grant.issue", arguments: "{}" }],
        [{ type: "response.completed", response: { output_text: "blocked" } }],
      ],
    });
    const { result } = await runWith(createCodexDriver({ transport }));

    expect(result.status).toBe("succeeded");
    const completed = result.events.filter(({ type }) => type === "tool.completed");
    expect(completed[0]?.data).toMatchObject({ status: "denied", tool: "admin.grant.issue" });
    const written = transport.written[0] as { output: string };
    expect(JSON.parse(written.output)).toMatchObject({ status: "denied" });
  });

  it("executes tool calls from one frame one at a time", async () => {
    const transport = new TranscriptTransport({
      batches: [
        [
          {
            type: "assistant",
            message: {
              content: [
                { type: "tool_use", id: "t1", name: "files.read", input: { path: ["Workspace"] } },
                { type: "tool_use", id: "t2", name: "files.read", input: { path: ["Workspace"] } },
              ],
            },
          },
        ],
        [{ type: "result", subtype: "success", result: "done" }],
      ],
    });
    const { result, audit } = await runWith(createClaudeCodeDriver({ transport }));

    expect(result.status).toBe("succeeded");
    // Two calls, two authorization decisions: SharedOS re-authorizes per call,
    // so parallel requests are serialised rather than admitted as a batch.
    expect(audit.events.filter(({ type }) => type === "tool.invoked")).toHaveLength(2);
    expect(transport.written).toHaveLength(2);
  });

  it("fails the turn when the harness stops without an outcome", async () => {
    const transport = new TranscriptTransport({ batches: [[{ type: "system", subtype: "init" }]] });
    const { result } = await runWith(createClaudeCodeDriver({ transport }));

    expect(result.status).toBe("failed");
  });
});

describe("harness availability", () => {
  it("reports a missing executable rather than failing a run", async () => {
    const availability = await probeHarness(CODEX_REQUIREMENTS, { PATH: "/nonexistent" });

    expect(availability).toMatchObject({ harness: "codex", available: false });
    expect(availability.reason).toMatch(/not on PATH/u);
  });

  it("finds an executable that is present", async () => {
    const availability = await probeHarness(
      { ...CLAUDE_CODE_REQUIREMENTS, executable: "node" },
      { PATH: process.env["PATH"] ?? "", ANTHROPIC_API_KEY: "test-key" },
    );

    expect(availability.available).toBe(true);
    expect(availability.detail).toMatchObject({ credential: "ANTHROPIC_API_KEY" });
  });

  it("requires a credential only when the harness cannot use a stored session", async () => {
    const strict = await probeHarness(
      { ...CODEX_REQUIREMENTS, executable: "node", credentialsOptional: false },
      { PATH: process.env["PATH"] ?? "" },
    );
    const lenient = await probeHarness(
      { ...CODEX_REQUIREMENTS, executable: "node" },
      { PATH: process.env["PATH"] ?? "" },
    );

    expect(strict.available).toBe(false);
    expect(lenient.available).toBe(true);
  });
});
