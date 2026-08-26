import type { RuntimeManifest } from "@aicoo/sharedos-contracts";

import { HarnessDriver, type HarnessDriverOptions } from "../driver.js";
import { HarnessRuntime } from "../runtime.js";
import type { HarnessRequirements, HarnessTransport } from "../harness.js";
import type { StandardRuntimeOptions } from "@aicoo/sharedos-runtime";
import { DEEPSEEK_PROTOCOL_ID, deepseekProtocol } from "./protocol.js";

export { DEEPSEEK_PROTOCOL_ID, deepseekProtocol } from "./protocol.js";

export const DEEPSEEK_ADAPTER_VERSION = "0.1.0-alpha.3";

export const DEEPSEEK_RUNTIME_MANIFEST: RuntimeManifest = Object.freeze({
  id: "sharedos.deepseek",
  version: DEEPSEEK_ADAPTER_VERSION,
  protocolVersion: "1",
  metadata: {
    package: "@aicoo/sharedos-adapters",
    harness: "deepseek",
    wireProtocol: DEEPSEEK_PROTOCOL_ID,
    executionModel: "bounded-driver-loop",
    /**
     * The harness runs its own tools, so the permission-filtered catalogue
     * cannot be declared in a frame. Stamped on every record this driver
     * produces, because a column whose catalogue arrived out of band is making
     * a narrower claim than one whose catalogue was on the wire.
     */
    catalogueDelivery: "out-of-band",
  },
});

/** What a live DeepSeek Harness session needs before it can run. */
export const DEEPSEEK_REQUIREMENTS: HarnessRequirements = Object.freeze({
  harness: "deepseek",
  executable: "dsh",
  credentialVariables: ["DEEPSEEK_API_KEY", "DSH_API_KEY"],
  /** `dsh` can also authenticate from a stored credentials file. */
  credentialsOptional: true,
});

export type DeepseekDriverOptions = Omit<HarnessDriverOptions, "manifest" | "protocol"> & {
  readonly transport: HarnessTransport;
  readonly manifest?: RuntimeManifest;
};

/**
 * DeepSeek Harness as a SharedOS agent turn driver.
 *
 * As with Codex and Claude Code, the adapter translates and nothing else.
 * Enforcement stays in the execution envelope, so installing a third harness
 * changes no kernel code and adds no second permission path.
 */
export function createDeepseekDriver(options: DeepseekDriverOptions): HarnessDriver {
  return new HarnessDriver({
    ...options,
    manifest: options.manifest ?? DEEPSEEK_RUNTIME_MANIFEST,
    protocol: deepseekProtocol,
  });
}

/**
 * DeepSeek Harness as an installable runtime, reporting its own manifest.
 *
 * Prefer this over wrapping the driver in `StandardRuntime` directly: the
 * executor stamps the plugin's manifest onto every execution record, so only
 * this form files a turn's evidence under the harness that produced it.
 */
export function createDeepseekRuntime(
  options: DeepseekDriverOptions,
  runtimeOptions: StandardRuntimeOptions = {},
): HarnessRuntime {
  return new HarnessRuntime(createDeepseekDriver(options), runtimeOptions);
}
