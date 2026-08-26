import { describe, expect, it } from "vitest";

import type {
  AccessContext,
  CapabilityGrant,
  ExecutionRequest,
  ResourceOperation,
  ResourceResult,
  ToolDefinition,
} from "@aicoo/sharedos-contracts";
import {
  SharedOSKernel,
  ToolRegistry,
  agentExecutionCapability,
  type GrantSource,
  type ResourceProvider,
} from "@aicoo/sharedos-core";
import { SharedOSExecutor } from "@aicoo/sharedos-runtime";

import { createMcpHarnessRuntime, type McpHarnessSpec } from "./mcp-runtime.js";
import { claudeCodeProtocol } from "./claude-code/protocol.js";

/**
 * The MCP toolshare path, end to end, with a stand-in for the vendor CLI.
 *
 * Everything except the harness's model is real: a real kernel with real grants,
 * the real execution envelope, the real bridge, the real HTTP transport, and a
 * real subprocess speaking MCP over it. What the fake harness replaces is only
 * the part a test cannot own -- a model deciding which tool to call -- so it
 * makes the calls a live run's prompt asks for, and nothing else.
 *
 * That leaves the interesting question testable without an API key: does a call
 * that arrives over MCP get authorized by the kernel like any other, and is a
 * refusal delivered as a result the harness can read and continue past?
 */

const NOW = "2026-08-23T00:00:00.000Z";
const AGENT = { kind: "agent", agentId: "agent-bob" } as const;
const DELEGATE = { kind: "agent", agentId: "agent-alice" } as const;
const OWNER = { kind: "human", userId: "user-alice" } as const;
const GRANTED = ["Work", "Public"];
const UNGRANTED = ["Work", "Private"];

const READ_TOOL: ToolDefinition = {
  name: "files.read",
  description: "Read content from a granted file path.",
  namespace: "files",
  source: "sharedos",
  readWrite: "read",
  inputSchema: {
    type: "object",
    required: ["path"],
    properties: { path: { type: "array", items: { type: "string" } } },
  },
  requiredCapability: {
    resource: { namespace: "files", path: [], owner: OWNER },
    action: "read",
  },
  annotations: { readOnly: true },
};

const CONTEXT: AccessContext = {
  actor: DELEGATE,
  authority: OWNER,
  owner: OWNER,
  namespaceId: "world-1",
  enabledToolNamespaces: ["files"],
  purpose: "mcp-toolshare",
  traceId: "trace-1",
  now: NOW,
};

function grants(): readonly CapabilityGrant[] {
  return [
    {
      id: "grant-public",
      namespaceId: "world-1",
      subject: DELEGATE,
      issuer: OWNER,
      capabilities: [
        {
          resource: { namespace: "files", path: GRANTED, owner: OWNER },
          actions: ["read"],
          scope: "descendants",
        },
        agentExecutionCapability(DELEGATE, OWNER),
      ],
      constraints: { purposes: ["mcp-toolshare"] },
      issuedAt: "2020-01-01T00:00:00.000Z",
    },
  ];
}

const grantSource: GrantSource = {
  async load() {
    await Promise.resolve();
    return grants();
  },
};

const provider: ResourceProvider = {
  namespace: "files",
  async invoke(operation: ResourceOperation, _signal: AbortSignal): Promise<ResourceResult> {
    await Promise.resolve();
    return {
      operationId: operation.operationId,
      status: "succeeded",
      output: { content: `contents of ${operation.resource.path.join("/")}` },
      completedAt: NOW,
    };
  },
};

function kernel(): SharedOSKernel {
  const tools = new ToolRegistry();
  tools.register({
    definition: READ_TOOL,
    parseArguments: (arguments_) => arguments_,
    resolveRequirement: (_context, call) => ({
      resource: {
        namespace: "files",
        path: (call.arguments["path"] as string[] | undefined) ?? [],
        owner: OWNER,
      },
      action: "read",
    }),
    invoke: async (accessContext, call, signal) => {
      const result = await provider.invoke(
        {
          operationId: call.id,
          resource: {
            namespace: "files",
            path: (call.arguments["path"] as string[] | undefined) ?? [],
            owner: OWNER,
          },
          action: "read",
          context: accessContext,
        },
        signal,
      );
      return result.status === "succeeded"
        ? {
            callId: call.id,
            tool: call.tool,
            status: "succeeded",
            output: result.output,
            completedAt: NOW,
          }
        : {
            callId: call.id,
            tool: call.tool,
            status: "failed",
            error: { code: "provider_failed", message: "provider failed" },
            completedAt: NOW,
          };
    },
  });
  return new SharedOSKernel({ grantSource, tools });
}

function executionRequest(): ExecutionRequest {
  return {
    version: "1",
    executionId: "execution-1",
    agent: DELEGATE,
    context: CONTEXT,
    message: {
      version: "1",
      id: "message-1",
      sender: AGENT,
      receiver: DELEGATE,
      purpose: CONTEXT.purpose,
      payload: { text: "read both files" },
      traceId: CONTEXT.traceId,
      createdAt: NOW,
    },
    tools: [READ_TOOL],
  };
}

/**
 * A subprocess that behaves like an MCP-connected harness and nothing else.
 *
 * It reads its endpoint from the generated `.mcp.json`, exactly as a real CLI
 * does, then speaks the protocol over the same HTTP transport. Its output is
 * Claude Code's `stream-json` framing, so the adapter's real protocol translation
 * reads the turn's outcome rather than a shape invented for the test.
 */
const FAKE_HARNESS = `
import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync(process.argv[2], "utf8"));
const url = config.mcpServers.sharedos.url;
const calls = JSON.parse(process.argv[3]);

async function rpc(id, method, params) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  return response.json();
}

const initialized = await rpc(1, "initialize", { protocolVersion: "2025-06-18" });
const listed = await rpc(2, "tools/list", {});
const seen = [];
let next = 3;
for (const call of calls) {
  const answered = await rpc(next++, "tools/call", call);
  seen.push(answered.result ?? answered.error);
}

process.stdout.write(
  JSON.stringify({
    type: "result",
    subtype: "success",
    is_error: false,
    result: JSON.stringify({
      url,
      protocolVersion: initialized.result.protocolVersion,
      serverInfo: initialized.result.serverInfo,
      discovered: listed.result.tools.map((tool) => tool.name),
      catalogHash: listed.result._meta["sharedos/catalogHash"],
      calls: seen,
    }),
  }) + "\\n",
);
`;

function fakeHarness(calls: readonly unknown[]): McpHarnessSpec {
  return {
    id: "fake",
    manifest: {
      id: "sharedos.test.fake-mcp",
      version: "0.0.0",
      protocolVersion: "1",
      metadata: { harness: "fake", toolshare: "mcp" },
    },
    protocol: claudeCodeProtocol,
    serverName: "sharedos",
    configFiles: (connection) => [
      {
        harness: "fake",
        filename: ".mcp.json",
        contents: JSON.stringify({
          mcpServers: { sharedos: { type: "http", url: connection.url } },
        }),
      },
      { harness: "fake", filename: "harness.mjs", contents: FAKE_HARNESS },
    ],
    launch: ({ configPaths }) => ({
      command: process.execPath,
      args: [
        configPaths["harness.mjs"] as string,
        configPaths[".mcp.json"] as string,
        JSON.stringify(calls),
      ],
    }),
  };
}

async function runTurn(calls: readonly unknown[]): Promise<{
  status: string;
  output: Record<string, unknown>;
  metadata: Record<string, unknown>;
  events: readonly { type: string; data: unknown }[];
}> {
  const executor = new SharedOSExecutor(kernel(), createMcpHarnessRuntime(fakeHarness(calls)));
  const result = await executor.execute(executionRequest());
  const text =
    result.status === "succeeded" && typeof result.output === "object" && result.output !== null
      ? ((result.output as { text?: string }).text ?? "{}")
      : "{}";
  return {
    status: result.status,
    output: JSON.parse(text) as Record<string, unknown>,
    metadata: (result.metadata ?? {}) as Record<string, unknown>,
    events: result.events.map(({ type, data }) => ({ type, data })),
  };
}

describe("a harness connected over MCP toolshare", () => {
  it("discovers only the permission-filtered catalogue", async () => {
    const turn = await runTurn([]);

    expect(turn.status).toBe("succeeded");
    expect(turn.output["discovered"]).toEqual(["files.read"]);
    expect(turn.output["serverInfo"]).toMatchObject({ name: "sharedos" });
    expect(turn.output["catalogHash"]).toMatch(/^[0-9a-f]{64}$/u);
  }, 30_000);

  it("has an authorized call executed and a violation refused, in one turn", async () => {
    const turn = await runTurn([
      { name: "files.read", arguments: { path: GRANTED } },
      { name: "files.read", arguments: { path: UNGRANTED } },
    ]);

    const [allowed, denied] = turn.output["calls"] as Record<string, unknown>[];

    expect(allowed?.["isError"]).toBe(false);
    expect(JSON.stringify(allowed?.["content"])).toContain("Work/Public");

    // The refusal reached the harness as a readable result rather than as a
    // transport error, which is what let it make the second call and finish.
    expect(denied?.["isError"]).toBe(true);
    expect((denied?.["_meta"] as Record<string, unknown>)["sharedos/status"]).toBe("denied");
    expect(turn.status).toBe("succeeded");
  }, 30_000);

  it("routes every call through the execution envelope", async () => {
    const turn = await runTurn([
      { name: "files.read", arguments: { path: GRANTED } },
      { name: "files.read", arguments: { path: UNGRANTED } },
    ]);

    const requested = turn.events.filter(({ type }) => type === "tool.requested");
    const completed = turn.events.filter(({ type }) => type === "tool.completed");

    expect(requested).toHaveLength(2);
    expect(completed.map(({ data }) => (data as { status: string }).status)).toEqual([
      "succeeded",
      "denied",
    ]);
  }, 30_000);

  it("records the catalogue it served and the harness it served it to", async () => {
    const turn = await runTurn([]);

    expect(turn.metadata["toolshare"]).toBe("mcp");
    expect(turn.metadata["harness"]).toBe("fake");
    expect(turn.metadata["catalogHash"]).toBe(turn.output["catalogHash"]);
  }, 30_000);

  it("refuses a guess at a tool that was never published, and records the attempt", async () => {
    const turn = await runTurn([{ name: "files.delete", arguments: { path: GRANTED } }]);
    const [guessed] = turn.output["calls"] as Record<string, unknown>[];

    expect(guessed?.["isError"]).toBe(true);
    expect((guessed?.["_meta"] as Record<string, unknown>)["sharedos/code"]).toBe(
      "tool_unavailable",
    );
    expect(turn.events.filter(({ type }) => type === "tool.requested")).toHaveLength(1);
  }, 30_000);

  it("closes the bridge with the turn, so nothing survives to be called again", async () => {
    const turn = await runTurn([]);
    const url = turn.output["url"] as string;

    expect(turn.status).toBe("succeeded");
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/mcp$/u);

    // A harness process outliving its turn -- which happens on cancellation and
    // on timeout -- must not still reach a catalogue resolved for a turn that
    // has ended. The port is released, so the connection is refused outright.
    await expect(
      fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      }),
    ).rejects.toThrow();
  }, 30_000);
});

/**
 * A harness whose stdin is a command channel rather than a prompt, like Pi's
 * `--mode rpc`.
 *
 * It exits the moment stdin ends, which is what makes the difference observable:
 * a runner that closes the channel at the write kills the session while the tool
 * call is still in flight, and the turn comes back with the catalogue listed and
 * nothing called. That is indistinguishable, from the manifest, from a harness
 * that looked at the catalogue and declined -- so it is worth a test rather than
 * a comment.
 */
const SESSION_HARNESS = `
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";

const config = JSON.parse(readFileSync(process.argv[2], "utf8"));
const url = config.mcpServers.sharedos.url;

// EOF ends the session, whatever else is in flight.
process.stdin.on("end", () => process.exit(0));

const rpc = async (id, method, params) => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  return response.json();
};

for await (const line of createInterface({ input: process.stdin })) {
  const command = JSON.parse(line);
  const answered = await rpc(2, "tools/call", command.call);
  process.stdout.write(
    JSON.stringify({
      type: "result",
      subtype: "success",
      is_error: false,
      result: JSON.stringify({ calls: [answered.result ?? answered.error] }),
    }) + "\\n",
  );
}
`;

function sessionHarness(keepStdinOpen: boolean): McpHarnessSpec {
  return {
    id: "session",
    manifest: {
      id: "sharedos.test.session-mcp",
      version: "0.0.0",
      protocolVersion: "1",
      metadata: { harness: "session", toolshare: "mcp" },
    },
    protocol: claudeCodeProtocol,
    serverName: "sharedos",
    configFiles: (connection) => [
      {
        harness: "session",
        filename: ".mcp.json",
        contents: JSON.stringify({
          mcpServers: { sharedos: { type: "http", url: connection.url } },
        }),
      },
      { harness: "session", filename: "harness.mjs", contents: SESSION_HARNESS },
    ],
    launch: ({ configPaths }) => ({
      command: process.execPath,
      args: [configPaths["harness.mjs"] as string, configPaths[".mcp.json"] as string],
      stdin: `${JSON.stringify({ call: { name: "files.read", arguments: { path: GRANTED } } })}\n`,
      keepStdinOpen,
      idleTimeoutMs: 10_000,
    }),
  };
}

describe("a harness whose stdin is a session", () => {
  it("is given time to answer, and is closed once its turn ends", async () => {
    const executor = new SharedOSExecutor(kernel(), createMcpHarnessRuntime(sessionHarness(true)));
    const result = await executor.execute(executionRequest());

    expect(result.status).toBe("succeeded");
    expect(result.events.filter(({ type }) => type === "tool.requested")).toHaveLength(1);
    // The turn ended, so the channel was closed rather than left open: a session
    // held past its terminal frame would hang the run instead of finishing it.
  }, 30_000);

  it("makes no call at all when the channel is closed at the write", async () => {
    const executor = new SharedOSExecutor(kernel(), createMcpHarnessRuntime(sessionHarness(false)));
    const result = await executor.execute(executionRequest());

    expect(result.events.filter(({ type }) => type === "tool.requested")).toHaveLength(0);
  }, 30_000);
});
