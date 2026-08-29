import { describe, expect, it } from "vitest";

import type {
  AccessContext,
  CapabilityGrant,
  Capability,
  ExecutionRequest,
  ExecutionResult,
  ResourceOperation,
  ResourceResult,
  ToolDefinition,
} from "@aicoo/sharedos-contracts";
import {
  SharedOSKernel,
  ToolRegistry,
  agentExecutionCapability,
  type AuditEvent,
  type AuditSink,
  type GrantSource,
  type ResourceProvider,
} from "@aicoo/sharedos-core";
import {
  ESCALATION_ACTION,
  ESCALATION_RESOURCE_PATH,
  ESCALATION_TOOL_DEFINITION,
  ESCALATION_TOOL_NAMESPACE,
  SharedOSExecutor,
  createEscalationTool,
  type RuntimeHost,
  type RuntimeTurnRequest,
} from "@aicoo/sharedos-runtime";
import { codexMcpConfig, codexMcpServerSettings } from "@aicoo/sharedos-mcp";
import { InMemoryAuditSink } from "@aicoo/sharedos-testkit";

import { CODEX_MCP_HARNESS, createMcpHarnessRuntime, type McpHarnessSpec } from "./mcp-runtime.js";
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

/** Authority to end a turn by asking a human, held only where a test says so. */
const ESCALATION_CAPABILITY: Capability = {
  resource: {
    namespace: ESCALATION_TOOL_NAMESPACE,
    path: [...ESCALATION_RESOURCE_PATH],
    owner: OWNER,
  },
  actions: [ESCALATION_ACTION],
  scope: "descendants",
};

function grants(escalation: boolean): readonly CapabilityGrant[] {
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
        ...(escalation ? [ESCALATION_CAPABILITY] : []),
      ],
      constraints: { purposes: ["mcp-toolshare"] },
      issuedAt: "2020-01-01T00:00:00.000Z",
    },
  ];
}

function grantSource(escalation: boolean): GrantSource {
  return {
    async load() {
      await Promise.resolve();
      return grants(escalation);
    },
  };
}

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

function kernel(
  options: {
    readonly escalation?: boolean;
    readonly audit?: AuditSink;
    /** Holds every read this long once admitted, so a later call can overtake it. */
    readonly readDelayMs?: number;
  } = {},
): SharedOSKernel {
  const escalation = options.escalation === true;
  const readDelayMs = options.readDelayMs ?? 0;
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
      if (readDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, readDelayMs));
      }
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
  if (escalation) {
    tools.register(createEscalationTool());
  }
  return new SharedOSKernel({
    grantSource: grantSource(escalation),
    tools,
    ...(options.audit === undefined ? {} : { audit: options.audit }),
  });
}

function executionRequest(escalation = false): ExecutionRequest {
  return {
    version: "1",
    executionId: "execution-1",
    agent: DELEGATE,
    context: escalation
      ? { ...CONTEXT, enabledToolNamespaces: ["files", ESCALATION_TOOL_NAMESPACE] }
      : CONTEXT,
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
    tools: escalation ? [READ_TOOL, ESCALATION_TOOL_DEFINITION] : [READ_TOOL],
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
const issue = async ({ afterMs, ...params }) => {
  if (afterMs) {
    await new Promise((resolve) => setTimeout(resolve, afterMs));
  }
  const answered = await rpc(next++, "tools/call", params);
  return answered.result ?? answered.error;
};
for (const call of calls) {
  // An array is a batch issued concurrently, answers kept in the batch's own
  // order; \`afterMs\` holds one call back so the race is a race in one direction.
  if (Array.isArray(call)) {
    seen.push(...(await Promise.all(call.map(issue))));
  } else {
    seen.push(await issue(call));
  }
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

// Repeated on stderr, which is the only copy that survives a turn ending as
// escalated: that outcome carries a reason rather than the harness's output.
process.stderr.write(JSON.stringify({ calls: seen }) + "\\n");
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

const ESCALATION_REASON = "issuing a control-plane grant is outside this agent's authority";
const ASK = { name: "sharedos.escalate", arguments: { reason: ESCALATION_REASON } };
const READ = { name: "files.read", arguments: { path: GRANTED } };

interface AffordanceTurn {
  readonly result: ExecutionResult;
  /** What the harness itself saw come back, in call order. */
  readonly seen: readonly Record<string, unknown>[];
  readonly audited: readonly AuditEvent[];
  readonly events: readonly string[];
}

async function runAffordance(
  calls: readonly unknown[],
  options: { readonly granted?: boolean; readonly readDelayMs?: number } = {},
): Promise<AffordanceTurn> {
  const granted = options.granted !== false;
  const audit = new InMemoryAuditSink();
  const diagnostics: string[] = [];
  const executor = new SharedOSExecutor(
    kernel({
      escalation: granted,
      audit,
      ...(options.readDelayMs === undefined ? {} : { readDelayMs: options.readDelayMs }),
    }),
    createMcpHarnessRuntime(fakeHarness(calls), {
      clock: () => NOW,
      onDiagnostic: (_harness, line) => diagnostics.push(line),
    }),
  );
  const result = await executor.execute(executionRequest(granted));

  let seen: Record<string, unknown>[] = [];
  for (const line of diagnostics.flatMap((chunk) => chunk.split("\n"))) {
    try {
      const frame = JSON.parse(line) as { calls?: Record<string, unknown>[] };
      if (Array.isArray(frame.calls)) {
        seen = frame.calls;
      }
    } catch {
      // Harness noise. The frame we want parses; nothing else has to.
    }
  }

  return {
    result,
    seen,
    audited: audit.events,
    events: result.events.map(({ type }) => type),
  };
}

function escalationOf(result: ExecutionResult): Extract<ExecutionResult, { status: "escalated" }> {
  if (result.status !== "escalated") {
    throw new Error(`the turn ended as ${result.status}, not escalated`);
  }
  return result;
}

function meta(call: Record<string, unknown> | undefined): Record<string, unknown> {
  return (call?.["_meta"] ?? {}) as Record<string, unknown>;
}

/**
 * The escalate affordance over MCP, where the harness owns the loop.
 *
 * A driver returns `escalate` and its loop stops. Here the ask arrives as a
 * `tools/call` that expects an answer, from a process SharedOS cannot stop, so
 * the claim under test is narrower and worth stating: the ask ends the turn as
 * escalated, it never reaches the kernel, and everything after it is refused in
 * a way the harness can read rather than one it would retry.
 */
describe("a harness that asks for a human over MCP", () => {
  it("ends the turn as escalated, recorded once and granting nothing", async () => {
    const turn = await runAffordance([READ, ASK]);
    const { escalation } = escalationOf(turn.result);

    expect(escalation.reason).toBe(ESCALATION_REASON);
    expect(escalation.status).toBe("pending");
    expect(escalation.reviewer).toEqual(OWNER);
    expect(turn.events).toContain("turn.escalated");

    const requested = turn.audited.filter(({ type }) => type === "escalation.requested");
    expect(requested).toHaveLength(1);
    expect(requested[0]?.outcome).toBe("escalated");
  }, 30_000);

  it("never puts the ask through the kernel", async () => {
    const turn = await runAffordance([READ, ASK]);

    // One `tool.requested`, for the read. An escalation is not an operation to
    // authorize, so the registered handler -- which fails on sight -- is never
    // reached, and the record carries no operation for the ask.
    expect(turn.events.filter((type) => type === "tool.requested")).toHaveLength(1);
    expect(turn.audited.some(({ reason }) => reason === "escalation_not_terminated")).toBe(false);
  }, 30_000);

  it("answers the ask in band, and says the turn is over", async () => {
    const turn = await runAffordance([READ, ASK]);
    const [, asked] = turn.seen;

    expect(asked?.["isError"]).toBe(false);
    expect(JSON.stringify(asked?.["content"])).toContain("make no further tool calls");
  }, 30_000);

  it("refuses a call made after the ask without failing the transport", async () => {
    const turn = await runAffordance([READ, ASK, READ]);
    const [, , afterwards] = turn.seen;

    // A tool error, not JSON-RPC -32603. Closing the bridge would produce the
    // latter, which carries nothing about authority and which harnesses retry.
    expect(afterwards?.["isError"]).toBe(true);
    expect(meta(afterwards)["sharedos/status"]).toBe("denied");
    expect(meta(afterwards)["sharedos/code"]).toBe("escalation_pending");

    // And it did not run: still one authorized call, the read before the ask.
    expect(turn.events.filter((type) => type === "tool.requested")).toHaveLength(1);
    expect(escalationOf(turn.result).metadata?.["callsAfterEscalation"]).toBe(1);
  }, 30_000);

  it("keeps what the harness itself reported the turn was", async () => {
    const turn = await runAffordance([ASK]);

    // The harness completed: it made its call, got an answer, and printed a
    // success frame. Recording that beside the escalation is what keeps "asked,
    // then finished cleanly" distinguishable from "asked, then crashed".
    expect(escalationOf(turn.result).metadata?.["harnessOutcome"]).toBe("complete");
  }, 30_000);

  it("escalates on an ask it cannot read rather than forwarding it to the kernel", async () => {
    const fallback = "the turn asked for a human decision without saying what needs deciding";
    const unreadable = await runAffordance([
      { name: "sharedos.escalate", arguments: { reason: 42 } },
    ]);
    const empty = await runAffordance([{ name: "sharedos.escalate", arguments: {} }]);

    // Same rule as the drivers: the harness asked for a human, and forwarding
    // a malformed ask to a handler that fails would record "the agent made a
    // malformed call" in place of "the turn asked". The ask is taken under a
    // reason saying it carried none, and the handler is never reached.
    for (const turn of [unreadable, empty]) {
      expect(escalationOf(turn.result).escalation.reason).toBe(fallback);
      expect(turn.seen[0]?.["isError"]).toBe(false);
      expect(turn.events.filter((type) => type === "tool.requested")).toHaveLength(0);
      expect(turn.audited.some(({ reason }) => reason === "escalation_not_terminated")).toBe(false);
    }
  }, 60_000);

  it("refuses a second ask after the first, and keeps the first reason", async () => {
    const turn = await runAffordance([ASK, { ...ASK, arguments: { reason: "asking again" } }]);
    const [, again] = turn.seen;

    // The latch is set once. A repeat is a call made after the ask like any
    // other: refused in band as `escalation_pending`, counted, and the reason
    // the turn ends on is the one it first asked with.
    expect(again?.["isError"]).toBe(true);
    expect(meta(again)["sharedos/code"]).toBe("escalation_pending");
    expect(escalationOf(turn.result).escalation.reason).toBe(ESCALATION_REASON);
    expect(escalationOf(turn.result).metadata?.["callsAfterEscalation"]).toBe(1);
    expect(turn.audited.filter(({ type }) => type === "escalation.requested")).toHaveLength(1);
  }, 30_000);

  it("lets a call admitted before the ask finish, and does not count it as after", async () => {
    // The read is issued first and held inside the kernel; the ask overtakes
    // it. The latch decides at entry, so a call already past it when the ask
    // lands was admitted on the turn's authority before anything was asked:
    // it runs to completion and is not one of the calls "after" the ask.
    const turn = await runAffordance([[READ, { ...ASK, afterMs: 60 }]], { readDelayMs: 400 });
    const [read, asked] = turn.seen;

    expect(read?.["isError"]).toBe(false);
    expect(JSON.stringify(read?.["content"])).toContain("Work/Public");
    expect(asked?.["isError"]).toBe(false);
    expect(turn.result.status).toBe("escalated");
    expect(escalationOf(turn.result).metadata?.["callsAfterEscalation"]).toBe(0);
    expect(turn.events.filter((type) => type === "tool.requested")).toHaveLength(1);
  }, 30_000);

  it("does not honour the affordance for a turn that was never granted it", async () => {
    const turn = await runAffordance([ASK], { granted: false });
    const [asked] = turn.seen;

    // Skipping the envelope would skip its catalogue check too, so the grant is
    // checked first: without it the name is passed through and refused like any
    // other unpublished tool, and the turn ends the way the harness ended it.
    expect(turn.result.status).toBe("succeeded");
    expect(asked?.["isError"]).toBe(true);
    expect(meta(asked)["sharedos/code"]).toBe("tool_unavailable");
    expect(turn.events.filter((type) => type === "tool.requested")).toHaveLength(1);
  }, 30_000);
});

/**
 * The plugin called outside `SharedOSExecutor`, the only way an aborted signal
 * reaches `run` at all: the executor checks the signal before it runs a plugin
 * and races the plugin against it after, so its own `cancelled` result always
 * wins. A direct caller gets the platform's answer, not a second shape of
 * `turn_cancelled`.
 */
describe("a harness runtime whose signal is aborted", () => {
  it("rejects with the signal's reason instead of returning an outcome", async () => {
    const controller = new AbortController();
    const reason = new Error("turn closed");
    controller.abort(reason);
    const { context, ...request } = executionRequest();
    const visible: RuntimeTurnRequest = {
      ...request,
      context: {
        actor: context.actor,
        owner: context.owner,
        namespaceId: context.namespaceId,
        purpose: context.purpose,
        traceId: context.traceId,
        now: context.now,
      },
    };
    const host: RuntimeHost = {
      limits: { maxSteps: 1, maxToolCalls: 1, timeoutMs: 1_000 },
      invokeTool: () => Promise.reject(new Error("not reached")),
      emit: () => undefined,
    };

    await expect(
      createMcpHarnessRuntime(fakeHarness([])).run(visible, host, controller.signal),
    ).rejects.toBe(reason);
  });
});

describe("the Codex spec", () => {
  it("passes the same server settings codexMcpConfig emits, as overrides", () => {
    const connection = { url: "http://127.0.0.1:41234/mcp", name: "sharedos" };
    const { context, ...request } = executionRequest();
    const launch = CODEX_MCP_HARNESS.launch({
      prompt: "read both files",
      connection,
      workspace: "/tmp/sharedos-test",
      configPaths: {},
      request: {
        ...request,
        context: {
          actor: context.actor,
          owner: context.owner,
          namespaceId: context.namespaceId,
          purpose: context.purpose,
          traceId: context.traceId,
          now: context.now,
        },
      },
    });
    const settings = codexMcpServerSettings(connection);
    const emitted = codexMcpConfig(connection);

    expect(settings.map(([key]) => key)).toEqual([
      "url",
      "required",
      "tool_timeout_sec",
      "default_tools_approval_mode",
    ]);
    for (const [key, value] of settings) {
      expect(launch.args).toContain(`mcp_servers.sharedos.${key}=${value}`);
      expect(emitted).toContain(`${key} = ${value}`);
    }
  });
});
