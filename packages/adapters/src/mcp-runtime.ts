import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";

import type {
  JsonObject,
  ProtocolError,
  RuntimeManifest,
  RuntimeTurnOutcome,
} from "@aicoo/sharedos-contracts";
import {
  McpToolServer,
  claudeAgentSdkMcpOptions,
  harnessMcpConfigFile,
  openToolBridge,
  type HarnessMcpConfigFile,
  type HarnessMcpConnection,
  type SharedOSToolBridge,
} from "@aicoo/sharedos-mcp";
import { createStreamableHttpMcpServer } from "@aicoo/sharedos-mcp/node";
import type { RuntimeHost, RuntimePlugin, RuntimeTurnRequest } from "@aicoo/sharedos-runtime";

import type { HarnessProtocol } from "./harness.js";
import { claudeCodeProtocol } from "./claude-code/protocol.js";
import { codexProtocol } from "./codex/protocol.js";
import { deepseekProtocol } from "./deepseek/protocol.js";

/**
 * A vendor harness run natively, against the SharedOS catalogue over MCP.
 *
 * This is a different integration from `HarnessDriver`, and the difference is
 * the point. A driver puts SharedOS in the model provider's seat: it speaks the
 * vendor's API-layer tool-call shape and owns the loop. That is exact, and it
 * cannot be run against an installed CLI, because no coding-agent CLI exposes
 * its API layer or accepts a host-supplied tool catalogue on its own protocol.
 *
 * Here the harness keeps its own loop and its own model, and SharedOS is a tool
 * server it connects to. What that buys is the thing the driver path cannot
 * reach: a real CLI, making real decisions, against the real permission-filtered
 * catalogue, with every call re-authorized. What it costs is control of the
 * loop -- the harness decides how many calls to make and when to stop, so a row
 * it declines to attempt is `not exercised`, exactly as it should be.
 *
 * Enforcement is unchanged and unduplicated. Calls arrive through the bridge and
 * leave through `RuntimeHost.invokeTool`, which is the same envelope-and-kernel
 * path every other runtime uses.
 */

export interface McpHarnessLaunch {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string>>;
  /** Written to the child's stdin, for a CLI that takes its prompt that way. */
  readonly stdin?: string;
}

export interface McpLaunchContext {
  readonly prompt: string;
  readonly connection: HarnessMcpConnection;
  /** A scratch directory holding the generated configuration for this turn. */
  readonly workspace: string;
  /** Absolute path of each generated config file, by its filename. */
  readonly configPaths: Readonly<Record<string, string>>;
  readonly request: RuntimeTurnRequest;
}

/** One harness, described by how it is connected and how it is started. */
export interface McpHarnessSpec {
  readonly id: string;
  readonly manifest: RuntimeManifest;
  /** Reads the CLI's own transcript for the turn's terminal outcome. */
  readonly protocol: HarnessProtocol;
  /** The MCP server name this harness will namespace its aliases under. */
  readonly serverName?: string;
  readonly configFiles?: (connection: HarnessMcpConnection) => readonly HarnessMcpConfigFile[];
  readonly launch: (context: McpLaunchContext) => McpHarnessLaunch;
}

export interface McpHarnessRuntimeOptions {
  /** Overrides the manifest, so a conformance column can name itself. */
  readonly manifest?: RuntimeManifest;
  /** Guidance handed to the harness at MCP initialize time. */
  readonly instructions?: string;
  readonly prompt?: (request: RuntimeTurnRequest) => string;
  /** Where the per-turn scratch workspace is created. */
  readonly workspaceRoot?: string;
  /** Kept for diagnosis: the harness's stderr and unparsed stdout. */
  readonly onDiagnostic?: (harness: string, line: string) => void;
  /** Bearer token for a sandboxed harness that cannot be trusted by port alone. */
  readonly token?: string;
}

const MAX_DIAGNOSTIC_CHARS = 8_192;

/**
 * Install one MCP-connected harness as a SharedOS runtime.
 *
 * The lifecycle is the design note's, in order: the envelope has already
 * resolved the access context and computed the effective catalogue by the time
 * `run` is called, so this opens a turn-scoped bridge over it, serves it, runs
 * the harness, and closes the bridge when the turn closes. Nothing outlives the
 * turn -- not the catalogue, not the port, not the generated configuration.
 */
export function createMcpHarnessRuntime(
  spec: McpHarnessSpec,
  options: McpHarnessRuntimeOptions = {},
): RuntimePlugin {
  const manifest = options.manifest ?? spec.manifest;

  return {
    manifest,
    async run(
      request: RuntimeTurnRequest,
      host: RuntimeHost,
      signal: AbortSignal,
    ): Promise<RuntimeTurnOutcome> {
      const bridge: SharedOSToolBridge = openToolBridge({
        executionId: request.executionId,
        context: { traceId: request.context.traceId, now: request.context.now },
        tools: request.tools,
        host,
      });
      const server = new McpToolServer({
        invoker: bridge,
        serverInfo: { name: spec.serverName ?? "sharedos", version: manifest.version },
        ...(options.instructions === undefined ? {} : { instructions: options.instructions }),
      });

      const http = await createStreamableHttpMcpServer({
        server,
        ...(options.onDiagnostic === undefined
          ? {}
          : { onError: (error: unknown) => options.onDiagnostic?.(spec.id, String(error)) }),
        ...(options.token === undefined
          ? {}
          : { authorize: (token: string | undefined) => token === options.token }),
      });
      const connection: HarnessMcpConnection = {
        url: http.url,
        name: spec.serverName ?? "sharedos",
        ...(options.token === undefined ? {} : { token: options.token }),
      };

      const workspace = await mkdtemp(join(options.workspaceRoot ?? tmpdir(), `sharedos-mcp-`));
      try {
        const configPaths: Record<string, string> = {};
        for (const file of spec.configFiles?.(connection) ?? []) {
          const path = join(workspace, file.filename);
          await writeFile(path, file.contents, "utf8");
          configPaths[file.filename] = path;
        }

        const prompt = (options.prompt ?? defaultPrompt)(request);
        const launch = spec.launch({ prompt, connection, workspace, configPaths, request });
        const outcome = await runHarness(spec, launch, signal, options);
        const catalogHash = await bridgeCatalogHash(bridge, signal);
        return {
          ...outcome,
          metadata: {
            ...outcome.metadata,
            ...harnessMetadata(spec, connection, bridge, catalogHash),
          },
        };
      } finally {
        // Step 7 of the lifecycle. Order matters: the bridge is shut before the
        // port is, so a harness still mid-call is refused by a closed bridge
        // rather than by a connection that vanished.
        bridge.close();
        await http.close();
        await rm(workspace, { recursive: true, force: true });
      }
    },
  };
}

async function bridgeCatalogHash(
  bridge: SharedOSToolBridge,
  signal: AbortSignal,
): Promise<string | undefined> {
  try {
    return (await bridge.catalog(signal)).catalogHash;
  } catch {
    return undefined;
  }
}

/**
 * What the turn records about how the harness was connected.
 *
 * `catalogHash` is here so a run can prove which tool set the harness actually
 * received, and `toolAliases` so a transcript naming `mcp__sharedos__files_read`
 * can be read back to `files.read`. The alias is diagnostic: it is recorded
 * after the fact, from the bridge, and there is no path by which it could have
 * reached an authorization decision.
 */
function harnessMetadata(
  spec: McpHarnessSpec,
  connection: HarnessMcpConnection,
  bridge: SharedOSToolBridge,
  catalogHash: string | undefined,
): JsonObject {
  const aliases = bridge.aliases;
  return {
    harness: spec.id,
    toolshare: "mcp",
    mcpServer: connection.name ?? "sharedos",
    ...(catalogHash === undefined ? {} : { catalogHash }),
    ...(aliases.length === 0
      ? {}
      : { toolAliases: aliases.map(({ alias, tool }) => ({ alias, tool })) }),
  };
}

async function runHarness(
  spec: McpHarnessSpec,
  launch: McpHarnessLaunch,
  signal: AbortSignal,
  options: McpHarnessRuntimeOptions,
): Promise<RuntimeTurnOutcome> {
  if (signal.aborted) {
    return fail("turn_cancelled", "The turn was cancelled before the harness started.");
  }

  const child = spawn(launch.command, [...launch.args], {
    ...(launch.cwd === undefined ? {} : { cwd: launch.cwd }),
    env: { ...process.env, ...launch.env },
    stdio: ["pipe", "pipe", "pipe"],
  }) as ChildProcessWithoutNullStreams;

  const kill = (): void => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
    }
  };
  signal.addEventListener("abort", kill, { once: true });

  const messages: string[] = [];
  let terminal: RuntimeTurnOutcome | undefined;
  let diagnostics = "";

  const lines = createInterface({ input: child.stdout });
  lines.on("line", (line) => {
    const trimmed = line.trim();
    if (trimmed === "") {
      return;
    }
    let frame: unknown;
    try {
      frame = JSON.parse(trimmed);
    } catch {
      // Harnesses print banners next to their protocol. Keep it for diagnosis.
      diagnostics = `${diagnostics}${trimmed}\n`.slice(-MAX_DIAGNOSTIC_CHARS);
      options.onDiagnostic?.(spec.id, trimmed);
      return;
    }
    if (frame === null || typeof frame !== "object" || Array.isArray(frame)) {
      return;
    }
    for (const step of spec.protocol.interpret(frame as JsonObject)) {
      if (step.type === "message") {
        messages.push(step.text);
        continue;
      }
      if (step.type === "failed") {
        terminal ??= { type: "fail", error: step.error };
        continue;
      }
      if (step.type === "complete") {
        terminal ??= {
          type: "complete",
          output: step.output ?? { text: messages.join("\n") },
        };
      }
      // A `tool_call` step cannot occur here: tool calls left over MCP, not over
      // this channel. If a harness emits one anyway it is transcript noise, and
      // acting on it would be a second, unauthorized call path.
    }
  });

  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    diagnostics = `${diagnostics}${chunk}`.slice(-MAX_DIAGNOSTIC_CHARS);
    options.onDiagnostic?.(spec.id, chunk.trimEnd());
  });

  if (launch.stdin !== undefined) {
    child.stdin.write(launch.stdin);
  }
  child.stdin.end();

  const exit = await new Promise<{ code: number | null; error?: Error }>((resolve) => {
    child.once("error", (error: Error) => resolve({ code: null, error }));
    child.once("close", (code) => resolve({ code }));
  });
  lines.close();
  signal.removeEventListener("abort", kill);

  if (signal.aborted) {
    return fail("turn_cancelled", "The turn was cancelled while the harness was running.");
  }
  if (exit.error !== undefined) {
    return fail("harness_not_started", `The ${spec.id} CLI could not be started.`);
  }
  if (terminal !== undefined) {
    return terminal;
  }
  if (exit.code === 0) {
    // A clean exit with no terminal frame still completed a turn. Whatever prose
    // it produced is the output; an empty one is reported as empty rather than
    // as a failure the harness never declared.
    return { type: "complete", output: { text: messages.join("\n") } };
  }
  return fail(
    "harness_exited_without_outcome",
    `The ${spec.id} CLI exited with code ${String(exit.code)} without completing the turn.`,
  );
}

function fail(code: string, message: string): RuntimeTurnOutcome {
  const error: ProtocolError = { code, message, retryable: false };
  return { type: "fail", error };
}

function defaultPrompt(request: RuntimeTurnRequest): string {
  const payload = request.message.payload;
  if (typeof payload === "string") {
    return payload;
  }
  if (payload !== null && typeof payload === "object" && !Array.isArray(payload)) {
    const text = (payload as JsonObject)["text"];
    if (typeof text === "string") {
      return text;
    }
  }
  return JSON.stringify(payload);
}

export const MCP_ADAPTER_VERSION = "0.1.0-alpha.0";

/**
 * Claude Code, connected to the SharedOS bridge.
 *
 * `--strict-mcp-config` is what makes a `strict` tool policy checkable rather
 * than merely declared: it drops every MCP server configured on the machine, so
 * the only brokered tools in the run are the ones SharedOS published. The
 * `--disallowedTools` list then removes the harness's own file and shell tools,
 * because a probe that can edit files on the machine it is measuring is
 * answering a different question -- and because a harness that reaches for its
 * own `Read` instead of `files.read` produces no evidence about the kernel.
 *
 * `--allowedTools mcp__sharedos` auto-approves the server. That is a permission
 * *prompt* decision, not an authorization one: Claude separates the two, print
 * mode has no human to prompt, and what actually secures the run is that every
 * one of those calls is re-authorized by the kernel.
 */
export const CLAUDE_CODE_MCP_HARNESS: McpHarnessSpec = Object.freeze<McpHarnessSpec>({
  id: "claude-code",
  manifest: Object.freeze({
    id: "sharedos.claude-code.mcp",
    version: MCP_ADAPTER_VERSION,
    protocolVersion: "1",
    metadata: {
      package: "@aicoo/sharedos-adapters",
      harness: "claude-code",
      toolshare: "mcp",
      executionModel: "native-harness-loop",
    },
  }) as RuntimeManifest,
  protocol: claudeCodeProtocol,
  serverName: "sharedos",
  configFiles: (connection) => [harnessMcpConfigFile("claude-code", connection)],
  launch: ({ prompt, workspace, configPaths }) => ({
    command: "claude",
    args: [
      "-p",
      prompt,
      "--output-format",
      "stream-json",
      "--verbose",
      "--mcp-config",
      configPaths[".mcp.json"] ?? join(workspace, ".mcp.json"),
      "--strict-mcp-config",
      "--allowedTools",
      "mcp__sharedos",
      "--disallowedTools",
      "Bash,Edit,Write,Read,Glob,Grep,NotebookEdit,Task,WebFetch,WebSearch,TodoWrite",
      "--max-turns",
      "24",
    ],
    cwd: workspace,
  }),
});

/**
 * Codex, connected to the SharedOS bridge.
 *
 * Configuration is passed with `-c` overrides rather than by writing a
 * `config.toml`, so nothing on the machine's real Codex configuration is touched
 * by a conformance run. `required = true` means a run whose bridge failed to
 * start stops rather than continuing with only Codex's own tools, which would
 * look like a harness that declined to use the catalogue.
 */
export const CODEX_MCP_HARNESS: McpHarnessSpec = Object.freeze<McpHarnessSpec>({
  id: "codex",
  manifest: Object.freeze({
    id: "sharedos.codex.mcp",
    version: MCP_ADAPTER_VERSION,
    protocolVersion: "1",
    metadata: {
      package: "@aicoo/sharedos-adapters",
      harness: "codex",
      toolshare: "mcp",
      executionModel: "native-harness-loop",
    },
  }) as RuntimeManifest,
  protocol: codexProtocol,
  serverName: "sharedos",
  configFiles: (connection) => [harnessMcpConfigFile("codex", connection)],
  launch: ({ prompt, workspace, connection }) => ({
    command: "codex",
    args: [
      "exec",
      "--json",
      "--skip-git-repo-check",
      "-c",
      `mcp_servers.sharedos.url=${JSON.stringify(connection.url)}`,
      "-c",
      "mcp_servers.sharedos.required=true",
      "-c",
      "mcp_servers.sharedos.tool_timeout_sec=120",
      prompt,
    ],
    cwd: workspace,
  }),
});

/**
 * DeepSeek Harness, connected to the SharedOS bridge.
 *
 * Its official MCP plugin performs `tools/list`, converts the schemas, and
 * registers them through `ctx.tools.register()`, so the composition file names
 * the endpoint and nothing else. The runtime binary and plugin composition are
 * read from the environment because `dsh`'s shipped profiles do not include one
 * that speaks this protocol.
 */
export const DEEPSEEK_MCP_HARNESS: McpHarnessSpec = Object.freeze<McpHarnessSpec>({
  id: "deepseek",
  manifest: Object.freeze({
    id: "sharedos.deepseek.mcp",
    version: MCP_ADAPTER_VERSION,
    protocolVersion: "1",
    metadata: {
      package: "@aicoo/sharedos-adapters",
      harness: "deepseek",
      toolshare: "mcp",
      executionModel: "native-harness-loop",
    },
  }) as RuntimeManifest,
  protocol: deepseekProtocol,
  serverName: "sharedos",
  configFiles: (connection) => [harnessMcpConfigFile("deepseek", connection)],
  launch: ({ prompt, workspace, configPaths }) => ({
    command: process.env["DSH_COMMAND"] ?? "dsh",
    // Launcher flags first, then the profile's own arguments: the first token
    // dsh does not recognise starts the app's arguments, and the headless
    // profile's first argument is the job.
    args: [
      "--profile",
      process.env["DSH_PROFILE"] ?? "headless",
      "--patch",
      configPaths["cordis.patch.yml"] ?? join(workspace, "cordis.patch.yml"),
      prompt,
    ],
    cwd: workspace,
  }),
});

export const MCP_HARNESSES: readonly McpHarnessSpec[] = Object.freeze([
  CLAUDE_CODE_MCP_HARNESS,
  CODEX_MCP_HARNESS,
  DEEPSEEK_MCP_HARNESS,
]);

export { claudeAgentSdkMcpOptions };
