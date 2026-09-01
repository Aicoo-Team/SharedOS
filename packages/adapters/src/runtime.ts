import type { RuntimeManifest, RuntimeTurnOutcome } from "@aicoo/sharedos-contracts";
import {
  StandardRuntime,
  type AgentTurnDriver,
  type RuntimeHost,
  type RuntimePlugin,
  type RuntimeTurnRequest,
  type StandardRuntimeOptions,
} from "@aicoo/sharedos-runtime";

import type { HarnessDriver } from "./driver.js";

/**
 * A driver installed as a runtime under its own identity.
 *
 * `StandardRuntime` is the reference turn loop and reports itself as
 * `sharedos.standard`, which is correct for the driver it was built for and
 * wrong for a vendor harness or a model: the executor stamps the *plugin's*
 * manifest onto every execution record, so a Codex turn wrapped in
 * `StandardRuntime` alone would file its evidence under the standard runtime.
 *
 * That matters beyond tidiness. Comparing harnesses depends on each column's
 * evidence naming the harness that produced it; a column that misattributes
 * itself is worse than a column that is absent, because it looks like data.
 *
 * This keeps the loop and replaces only the identity. `StandardRuntime` still
 * owns the steps, still stops at `maxSteps`, and still re-authorizes every
 * call -- which is the property that distinguishes a driven column from one
 * where a vendor CLI owns the loop.
 */
export class DriverRuntime<
  D extends AgentTurnDriver & { readonly manifest: RuntimeManifest },
> implements RuntimePlugin {
  readonly manifest: RuntimeManifest;
  readonly #runtime: StandardRuntime;

  constructor(driver: D, options: StandardRuntimeOptions = {}) {
    this.manifest = driver.manifest;
    this.#runtime = new StandardRuntime(driver, options);
  }

  run(
    request: RuntimeTurnRequest,
    host: RuntimeHost,
    signal: AbortSignal,
  ): Promise<RuntimeTurnOutcome> {
    return this.#runtime.run(request, host, signal);
  }
}

/** A harness driver installed as a runtime under its own identity; see {@link DriverRuntime}. */
export class HarnessRuntime extends DriverRuntime<HarnessDriver> {}
