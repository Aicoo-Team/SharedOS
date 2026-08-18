import type { RuntimeManifest } from "@aicoo/sharedos-contracts";

import { HarnessDriver, type HarnessDriverOptions } from "../driver.js";
import type { HarnessRequirements, HarnessTransport } from "../harness.js";
import { CLAUDE_CODE_PROTOCOL_ID, claudeCodeProtocol } from "./protocol.js";

export { CLAUDE_CODE_PROTOCOL_ID, claudeCodeProtocol } from "./protocol.js";

export const CLAUDE_CODE_ADAPTER_VERSION = "0.1.0-alpha.0";

export const CLAUDE_CODE_RUNTIME_MANIFEST: RuntimeManifest = Object.freeze({
  id: "sharedos.claude-code",
  version: CLAUDE_CODE_ADAPTER_VERSION,
  protocolVersion: "1",
  metadata: {
    package: "@aicoo/sharedos-adapters",
    harness: "claude-code",
    wireProtocol: CLAUDE_CODE_PROTOCOL_ID,
    executionModel: "bounded-driver-loop",
  },
});

/** What a live Claude Code session needs before it can run. */
export const CLAUDE_CODE_REQUIREMENTS: HarnessRequirements = Object.freeze({
  harness: "claude-code",
  executable: "claude",
  credentialVariables: ["ANTHROPIC_API_KEY", "CLAUDE_CODE_OAUTH_TOKEN"],
  /** Claude Code can also authenticate from a stored subscription login. */
  credentialsOptional: true,
});

export type ClaudeCodeDriverOptions = Omit<HarnessDriverOptions, "manifest" | "protocol"> & {
  readonly transport: HarnessTransport;
  readonly manifest?: RuntimeManifest;
};

/**
 * Claude Code as a SharedOS agent turn driver.
 *
 * As with Codex, the adapter translates and nothing else. Enforcement stays in
 * the execution envelope, so installing a second harness changes no kernel code
 * and adds no second permission path.
 */
export function createClaudeCodeDriver(options: ClaudeCodeDriverOptions): HarnessDriver {
  return new HarnessDriver({
    ...options,
    manifest: options.manifest ?? CLAUDE_CODE_RUNTIME_MANIFEST,
    protocol: claudeCodeProtocol,
  });
}
