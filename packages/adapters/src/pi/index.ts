import type { RuntimeManifest } from "@aicoo/sharedos-contracts";

import { HarnessDriver, type HarnessDriverOptions } from "../driver.js";
import { HarnessRuntime } from "../runtime.js";
import type { HarnessRequirements, HarnessTransport } from "../harness.js";
import type { StandardRuntimeOptions } from "@aicoo/sharedos-runtime";
import { piProtocol } from "./protocol.js";
import { defineHarnessVendor, type HarnessVendor } from "../vendors.js";

export { PI_PROTOCOL_ID, piProtocol } from "./protocol.js";

/** Pi, stated once; see {@link HarnessVendor}. */
export const PI_VENDOR: HarnessVendor = defineHarnessVendor({
  id: "pi",
  protocol: piProtocol,
  executable: "pi",
  /**
   * Pi routes to whichever provider its model config names, so no single
   * variable is the credential. These are the ones its shipped providers read.
   */
  credentialVariables: ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "PI_API_KEY"],
  catalogueOutOfBand: true,
  /** Named, not implied: Pi has no MCP client of its own. */
  mcpMetadata: { mcpSupport: "extension", mcpExtension: "pi-mcp-adapter" },
});

export const PI_HARNESS_ID = PI_VENDOR.id;
export const PI_RUNTIME_MANIFEST: RuntimeManifest = PI_VENDOR.manifest;
export const PI_REQUIREMENTS: HarnessRequirements = PI_VENDOR.requirements;

export type PiDriverOptions = Omit<HarnessDriverOptions, "manifest" | "protocol"> & {
  readonly transport: HarnessTransport;
  readonly manifest?: RuntimeManifest;
};

/**
 * Pi as a SharedOS agent turn driver.
 *
 * As with every other harness here, the adapter translates and nothing else.
 * Enforcement stays in the execution envelope, so installing a fourth harness
 * changes no kernel code and adds no second permission path.
 */
export function createPiDriver(options: PiDriverOptions): HarnessDriver {
  return new HarnessDriver({
    ...options,
    manifest: options.manifest ?? PI_RUNTIME_MANIFEST,
    protocol: piProtocol,
  });
}

/**
 * Pi as an installable runtime, reporting its own manifest.
 *
 * Prefer this over wrapping the driver in `StandardRuntime` directly: the
 * executor stamps the plugin's manifest onto every execution record, so only
 * this form files a turn's evidence under the harness that produced it.
 */
export function createPiRuntime(
  options: PiDriverOptions,
  runtimeOptions: StandardRuntimeOptions = {},
): HarnessRuntime {
  return new HarnessRuntime(createPiDriver(options), runtimeOptions);
}
