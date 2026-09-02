import { describe, expect, it } from "vitest";

import { reportContainedError, type ProviderErrorContext } from "./diagnostics.js";

const OPERATION: ProviderErrorContext = {
  kind: "tool",
  reasonCode: "tool_execution_failed",
  traceId: "trace-1",
  namespaceId: "world-alpha",
};

/**
 * The guard behind both diagnostic hooks, tested where it lives.
 *
 * It is reached through `SharedOSKernelOptions.onProviderError` and through the
 * runtime's `onTurnError`, and both of those are covered in their own packages.
 * Neither covers it as a unit: the kernel's tests can only observe it through a
 * call site, and the runtime's resolve `@aicoo/sharedos-core` to this package's
 * build output rather than to this file. A promise two packages depend on
 * should stand on its own.
 */
describe("reportContainedError", () => {
  it("is a no-op when no sink is installed", () => {
    expect(() => reportContainedError(undefined, new Error("failed"), OPERATION)).not.toThrow();
  });

  it("hands the sink the error and its context, unaltered", () => {
    const seen: { error: unknown; operation: ProviderErrorContext }[] = [];
    const error = new Error("failed");

    reportContainedError(
      (thrown, operation) => void seen.push({ error: thrown, operation }),
      error,
      OPERATION,
    );

    // Identity, not equality: an error copied or re-wrapped on the way through
    // would lose the stack that is the whole reason for handing it over.
    expect(seen).toHaveLength(1);
    expect(seen[0]?.error).toBe(error);
    expect(seen[0]?.operation).toBe(OPERATION);
  });

  it("swallows a sink that throws, so a diagnostic cannot become a second failure", () => {
    let called = false;

    expect(() =>
      reportContainedError(
        () => {
          called = true;
          throw new Error("the host's logger is down");
        },
        new Error("failed"),
        OPERATION,
      ),
    ).not.toThrow();
    expect(called).toBe(true);
  });

  it("swallows a sink that throws something that is not an Error", () => {
    // A bare `catch` catches any thrown value, and a host's logger throwing a
    // string or a rejected sentinel must not be the one shape that escapes.
    expect(() =>
      reportContainedError(
        () => {
          throw "logger offline";
        },
        new Error("failed"),
        OPERATION,
      ),
    ).not.toThrow();
  });
});
