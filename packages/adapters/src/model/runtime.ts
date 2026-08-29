import type { RuntimeManifest, RuntimeTurnOutcome } from "@aicoo/sharedos-contracts";
import {
  StandardRuntime,
  type RuntimeHost,
  type RuntimePlugin,
  type RuntimeTurnRequest,
  type StandardRuntimeOptions,
} from "@aicoo/sharedos-runtime";

import type { ModelDriver } from "./driver.js";

/**
 * A model driver installed as a runtime under its own identity.
 *
 * The same arrangement {@link HarnessRuntime} makes, for the same reason: the
 * executor stamps the plugin's manifest onto every execution record, so a model
 * turn wrapped in `StandardRuntime` alone would file its evidence under the
 * standard runtime and a column comparing models would be unable to say which
 * one produced which record.
 *
 * The loop is unchanged. `StandardRuntime` still owns the steps, still stops at
 * `maxSteps`, and still re-authorizes every call -- which is the property that
 * distinguishes this column from one where a vendor CLI owns the loop.
 */
export class ModelRuntime implements RuntimePlugin {
  readonly manifest: RuntimeManifest;
  readonly #runtime: StandardRuntime;

  constructor(driver: ModelDriver, options: StandardRuntimeOptions = {}) {
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
