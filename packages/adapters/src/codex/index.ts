import type { RuntimeManifest } from "@aicoo/sharedos-contracts";

import { HarnessDriver, type HarnessDriverOptions } from "../driver.js";
import type { HarnessRequirements, HarnessTransport } from "../harness.js";
import { CODEX_PROTOCOL_ID, codexProtocol } from "./protocol.js";

export { CODEX_PROTOCOL_ID, codexProtocol } from "./protocol.js";

export const CODEX_ADAPTER_VERSION = "0.1.0-alpha.0";

export const CODEX_RUNTIME_MANIFEST: RuntimeManifest = Object.freeze({
  id: "sharedos.codex",
  version: CODEX_ADAPTER_VERSION,
  protocolVersion: "1",
  metadata: {
    package: "@aicoo/sharedos-adapters",
    harness: "codex",
    wireProtocol: CODEX_PROTOCOL_ID,
    executionModel: "bounded-driver-loop",
  },
});

/** What a live Codex session needs before it can run. */
export const CODEX_REQUIREMENTS: HarnessRequirements = Object.freeze({
  harness: "codex",
  executable: "codex",
  credentialVariables: ["OPENAI_API_KEY", "CODEX_API_KEY"],
  /** Codex can also authenticate from a stored `codex login` session. */
  credentialsOptional: true,
});

export type CodexDriverOptions = Omit<HarnessDriverOptions, "manifest" | "protocol"> & {
  readonly transport: HarnessTransport;
  readonly manifest?: RuntimeManifest;
};

/**
 * Codex as a SharedOS agent turn driver.
 *
 * The adapter is translation only. Install it with `StandardRuntime`, and the
 * turn loop, the permission-filtered catalogue, per-call re-authorization, and
 * audit all come from the SharedOS execution envelope unchanged.
 */
export function createCodexDriver(options: CodexDriverOptions): HarnessDriver {
  return new HarnessDriver({
    ...options,
    manifest: options.manifest ?? CODEX_RUNTIME_MANIFEST,
    protocol: codexProtocol,
  });
}
