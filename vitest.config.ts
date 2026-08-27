import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
    },
    include: ["packages/**/src/**/*.test.ts"],
    // The conformance suite runs every row against every column, and each call
    // re-resolves the published catalogue. Registering the shipped file tools
    // took that catalogue from five entries to sixteen, so the whole-suite tests
    // no longer fit in the 5s default.
    testTimeout: 120_000,
  },
});
