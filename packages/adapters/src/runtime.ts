import type { RuntimeManifest, RuntimeTurnOutcome } from "@aicoo/sharedos-contracts";
import {
  StandardRuntime,
  type RuntimeHost,
  type RuntimePlugin,
  type RuntimeTurnRequest,
  type StandardRuntimeOptions,
} from "@aicoo/sharedos-runtime";

import type { HarnessDriver } from "./driver.js";

/**
 * A harness driver installed as a runtime under its own identity.
 *
 * `StandardRuntime` is the reference turn loop and reports itself as
 * `sharedos.standard`, which is correct for the driver it was built for and
 * wrong for a vendor harness: the executor stamps the *plugin's* manifest onto
 * every execution record, so a Codex turn wrapped in `StandardRuntime` alone
 * would file its evidence under the standard runtime.
 *
 * That matters beyond tidiness. Comparing harnesses depends on each column's
 * evidence naming the harness that produced it; a column that misattributes
 * itself is worse than a column that is absent, because it looks like data.
 *
 * This keeps the loop and replaces only the identity.
 */
export class HarnessRuntime implements RuntimePlugin {
  readonly manifest: RuntimeManifest;
  readonly #runtime: StandardRuntime;

  constructor(driver: HarnessDriver, options: StandardRuntimeOptions = {}) {
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
