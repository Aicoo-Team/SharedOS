import type { JsonObject } from "@aicoo/sharedos-contracts";

import { SHAREDOS_MCP_SERVER_NAME } from "./server.js";

/**
 * Harness configuration, which declares a CONNECTION and nothing else.
 *
 * This is the architectural rule the whole boundary rests on, and it is worth
 * stating where the files are generated:
 *
 *     Harness configuration declares a CONNECTION.
 *     SharedOS declares the TOOLS.
 *     SharedOS capabilities declare the AUTHORITY.
 *     RuntimeHost is the only EXECUTION path.
 *
 * So every emitter here produces a few lines naming a URL. None of them enumerate
 * tools, and none of them can: the catalogue is resolved per turn from the access
 * context, and a file on disk cannot know who is asking. A harness setting that
 * looks like authorization -- Codex's `enabled_tools`, Claude's `allowedTools` --
 * is defense in depth and UX policy over a catalogue SharedOS already filtered,
 * never the thing that decides.
 */

export interface HarnessMcpConnection {
  /** The Streamable HTTP endpoint the turn-scoped bridge is serving. */
  readonly url: string;
  /** The server name the harness will namespace its aliases under. */
  readonly name?: string;
  readonly timeoutSec?: number;
  /** Bearer token for a sandboxed or remote harness. */
  readonly token?: string;
}

/** One generated file: what to write, and what a harness expects it to be called. */
export interface HarnessMcpConfigFile {
  readonly harness: string;
  readonly filename: string;
  readonly contents: string;
}

const DEFAULT_TIMEOUT_SEC = 120;

/**
 * Codex's `config.toml` fragment.
 *
 * `required = true` is deliberate. A Codex run whose SharedOS server failed to
 * start should not quietly continue with only its own tools -- that run would
 * look like a harness that declined to use the catalogue, which is a different
 * finding entirely.
 */
export function codexMcpConfig(connection: HarnessMcpConnection): string {
  const name = connection.name ?? SHAREDOS_MCP_SERVER_NAME;
  const lines = [
    `[mcp_servers.${name}]`,
    `url = ${JSON.stringify(connection.url)}`,
    "required = true",
    `tool_timeout_sec = ${connection.timeoutSec ?? DEFAULT_TIMEOUT_SEC}`,
  ];
  if (connection.token !== undefined) {
    lines.push(`bearer_token = ${JSON.stringify(connection.token)}`);
  }
  return `${lines.join("\n")}\n`;
}

/** Claude Code's `.mcp.json`. */
export function claudeCodeMcpConfig(connection: HarnessMcpConnection): JsonObject {
  const name = connection.name ?? SHAREDOS_MCP_SERVER_NAME;
  return {
    mcpServers: {
      [name]: {
        type: "http",
        url: connection.url,
        ...(connection.token === undefined
          ? {}
          : { headers: { Authorization: `Bearer ${connection.token}` } }),
      },
    },
  };
}

/**
 * Claude Agent SDK options for a non-interactive evaluation.
 *
 * `allowedTools` auto-approves the SharedOS server, which is the correct setting
 * precisely because it is not an authorization decision: Claude separates tool
 * availability from permission prompting, and prompting a human for a run with no
 * human in it would stall the eval rather than secure it. What secures it is that
 * every one of those calls is re-authorized by the kernel.
 */
export function claudeAgentSdkMcpOptions(connection: HarnessMcpConnection): JsonObject {
  const name = connection.name ?? SHAREDOS_MCP_SERVER_NAME;
  const servers = claudeCodeMcpConfig(connection)["mcpServers"] as JsonObject;
  return {
    mcpServers: servers,
    allowedTools: [`mcp__${name}__*`],
  };
}

/**
 * DeepSeek Harness's plugin patch overlay.
 *
 * A dsh profile composes an ordered stack of plugin-bundle patch layers, and a
 * `--patch` overlay is a bare list of plugin entries applied last. One entry per
 * MCP server; `@deepseek-ai/dsh-mcp-client` performs `tools/list`, converts the
 * schemas, and registers each result through `ctx.tools.register()`. Nothing in
 * this file describes a tool, for the same reason as the others.
 *
 * `failOnStartupError` is set for the same reason Codex's server is `required`:
 * a run that quietly continued with only the harness's own tools would look like
 * a harness that declined to use the catalogue, which is a different finding.
 */
export function deepseekMcpConfig(connection: HarnessMcpConnection): string {
  const name = connection.name ?? SHAREDOS_MCP_SERVER_NAME;
  const lines = [
    `- id: mcp-${name}`,
    "  name: '@deepseek-ai/dsh-mcp-client'",
    "  config:",
    `    serverName: ${name}`,
    "    transport: streamable-http",
    `    url: ${JSON.stringify(connection.url)}`,
    "    failOnStartupError: true",
    `    toolCallTimeoutMs: ${(connection.timeoutSec ?? DEFAULT_TIMEOUT_SEC) * 1_000}`,
  ];
  if (connection.token !== undefined) {
    lines.push(
      "    headers:",
      `      Authorization: ${JSON.stringify(`Bearer ${connection.token}`)}`,
    );
  }
  return `${lines.join("\n")}\n`;
}

/** Every emitter above, addressed by harness id. */
export function harnessMcpConfigFile(
  harness: "codex" | "claude-code" | "deepseek",
  connection: HarnessMcpConnection,
): HarnessMcpConfigFile {
  switch (harness) {
    case "codex":
      return { harness, filename: "config.toml", contents: codexMcpConfig(connection) };
    case "claude-code":
      return {
        harness,
        filename: ".mcp.json",
        contents: `${JSON.stringify(claudeCodeMcpConfig(connection), undefined, 2)}\n`,
      };
    case "deepseek":
      // `cordis.patch.yml`, not `cordis.yml`: this is an overlay applied over the
      // profile's composed tree, which is what `dsh --patch` takes.
      return { harness, filename: "cordis.patch.yml", contents: deepseekMcpConfig(connection) };
  }
}

/**
 * The harness-facing alias a tool is likely to appear under.
 *
 * `mcp__<serverName>__<rawName>` is the shape Claude Code, Codex, and DeepSeek
 * Harness all use, so it is the one assumed here. It is still only an
 * approximation: DeepSeek normalises the raw name to `[A-Za-z0-9_-]` and, when
 * that changes the name -- which it does for every dotted SharedOS name --
 * appends a deterministic hash so two tools can never collapse into one alias.
 *
 * Which is exactly why nothing may authorize against this. The alias is recorded
 * so a vendor transcript can be read back to a canonical name, and SharedOS maps
 * a name it receives back to the catalogue rather than trusting a reconstruction.
 */
export function harnessToolAlias(serverName: string, tool: string): string {
  return `mcp__${serverName}__${tool.replace(/[^A-Za-z0-9_]/gu, "_")}`;
}
