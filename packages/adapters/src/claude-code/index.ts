import type { RuntimeManifest } from "@aicoo/sharedos-contracts";

import { HarnessDriver, type HarnessDriverOptions } from "../driver.js";
import { HarnessRuntime } from "../runtime.js";
import type { HarnessRequirements, HarnessTransport } from "../harness.js";
import type { StandardRuntimeOptions } from "@aicoo/sharedos-runtime";
import { claudeCodeProtocol } from "./protocol.js";
import { defineHarnessVendor, type HarnessVendor } from "../vendors.js";

export { CLAUDE_CODE_PROTOCOL_ID, claudeCodeProtocol } from "./protocol.js";

/** Claude Code, stated once; see {@link HarnessVendor}. */
export const CLAUDE_CODE_VENDOR: HarnessVendor = defineHarnessVendor({
  id: "claude-code",
  protocol: claudeCodeProtocol,
  executable: "claude",
  credentialVariables: ["ANTHROPIC_API_KEY", "CLAUDE_CODE_OAUTH_TOKEN"],
});

export const CLAUDE_CODE_HARNESS_ID = CLAUDE_CODE_VENDOR.id;
export const CLAUDE_CODE_RUNTIME_MANIFEST: RuntimeManifest = CLAUDE_CODE_VENDOR.manifest;
export const CLAUDE_CODE_REQUIREMENTS: HarnessRequirements = CLAUDE_CODE_VENDOR.requirements;

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

/**
 * Claude Code as an installable runtime, reporting its own manifest.
 *
 * Prefer this over wrapping the driver in `StandardRuntime` directly: the
 * executor stamps the plugin's manifest onto every execution record, so only
 * this form files a turn's evidence under the harness that produced it.
 */
export function createClaudeCodeRuntime(
  options: ClaudeCodeDriverOptions,
  runtimeOptions: StandardRuntimeOptions = {},
): HarnessRuntime {
  return new HarnessRuntime(createClaudeCodeDriver(options), runtimeOptions);
}
