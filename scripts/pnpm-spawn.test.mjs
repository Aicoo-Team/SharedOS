import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, delimiter, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

for (const script of ["check-api-docs.mjs", "bench.mjs", "conformance.mjs"]) {
  test(
    `${script} can launch the pnpm command shim on Windows`,
    { skip: process.platform !== "win32" },
    () => {
      const fixtureDirectory = mkdtempSync(join(tmpdir(), "sharedos-pnpm-spawn-"));
      const expectedStatus = 23;

      try {
        // Regression: spawning pnpm.cmd directly fails with EINVAL on Windows.
        writeFileSync(join(fixtureDirectory, "pnpm.cmd"), `@exit /b ${expectedStatus}\r\n`);
        const result = spawnSync(process.execPath, [join(repositoryRoot, "scripts", script)], {
          cwd: repositoryRoot,
          encoding: "utf8",
          env: {
            ...process.env,
            PATH: `${fixtureDirectory}${delimiter}${process.env.PATH ?? ""}`,
          },
        });

        assert.equal(
          result.status,
          expectedStatus,
          `expected the pnpm shim to run; stderr:\n${result.stderr}`,
        );
      } finally {
        rmSync(fixtureDirectory, { recursive: true, force: true });
      }
    },
  );
}
