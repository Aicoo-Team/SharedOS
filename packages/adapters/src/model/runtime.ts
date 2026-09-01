import { DriverRuntime } from "../runtime.js";
import type { ModelDriver } from "./driver.js";

/**
 * A model driver installed as a runtime under its own identity.
 *
 * The same arrangement {@link HarnessRuntime} makes, for the same reason: a
 * column comparing models must be able to say which one produced which record.
 * See {@link DriverRuntime}.
 */
export class ModelRuntime extends DriverRuntime<ModelDriver> {}
