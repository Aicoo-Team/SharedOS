import type { RuntimeManifest } from "@aicoo/sharedos-contracts";

import { HarnessDriver, type HarnessDriverOptions } from "../driver.js";
import { HarnessRuntime } from "../runtime.js";
import type { HarnessRequirements, HarnessTransport } from "../harness.js";
import type { StandardRuntimeOptions } from "@aicoo/sharedos-runtime";
import { deepseekProtocol } from "./protocol.js";
import { defineHarnessVendor, type HarnessVendor } from "../vendors.js";

export { DEEPSEEK_PROTOCOL_ID, deepseekProtocol } from "./protocol.js";

/** DeepSeek Harness, stated once; see {@link HarnessVendor}. */
export const DEEPSEEK_VENDOR: HarnessVendor = defineHarnessVendor({
  id: "deepseek",
  protocol: deepseekProtocol,
  executable: "dsh",
  credentialVariables: ["DEEPSEEK_API_KEY", "DSH_API_KEY"],
  catalogueOutOfBand: true,
});

export const DEEPSEEK_HARNESS_ID = DEEPSEEK_VENDOR.id;
export const DEEPSEEK_RUNTIME_MANIFEST: RuntimeManifest = DEEPSEEK_VENDOR.manifest;
export const DEEPSEEK_REQUIREMENTS: HarnessRequirements = DEEPSEEK_VENDOR.requirements;

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
