import type { RuntimeManifest } from "@aicoo/sharedos-contracts";

import { HarnessDriver, type HarnessDriverOptions } from "../driver.js";
import { HarnessRuntime } from "../runtime.js";
import type { HarnessRequirements, HarnessTransport } from "../harness.js";
import type { StandardRuntimeOptions } from "@aicoo/sharedos-runtime";
import { PI_PROTOCOL_ID, piProtocol } from "./protocol.js";

export { PI_PROTOCOL_ID, piProtocol } from "./protocol.js";

export const PI_ADAPTER_VERSION = "0.1.0-alpha.3";

export const PI_RUNTIME_MANIFEST: RuntimeManifest = Object.freeze({
  id: "sharedos.pi",
  version: PI_ADAPTER_VERSION,
  protocolVersion: "1",
  metadata: {
    package: "@aicoo/sharedos-adapters",
    harness: "pi",
    wireProtocol: PI_PROTOCOL_ID,
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

/** What a live Pi session needs before it can run. */
export const PI_REQUIREMENTS: HarnessRequirements = Object.freeze({
  harness: "pi",
  executable: "pi",
  /**
   * Pi routes to whichever provider its model config names, so no single
   * variable is the credential. These are the ones its shipped providers read.
   */
  credentialVariables: ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "PI_API_KEY"],
  /** Pi can also authenticate from a stored `~/.pi/agent/auth.json`. */
  credentialsOptional: true,
});

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
