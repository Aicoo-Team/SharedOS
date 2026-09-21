import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { moduleSpecifier } from "./module-specifier.mjs";

test("absolute paths produce importable ESM specifiers", async () => {
  const fixtureDirectory = await mkdtemp(join(tmpdir(), "sharedos-esm-import-"));
  const fixturePath = join(fixtureDirectory, "fixture.mjs");

  try {
    // Regression: Windows drive-letter paths are parsed as unsupported URL schemes.
    await writeFile(fixturePath, 'export const marker = "loaded";\n', "utf8");
    const fixture = await import(moduleSpecifier(fixturePath));

    assert.equal(fixture.marker, "loaded");
  } finally {
    await rm(fixtureDirectory, { recursive: true, force: true });
  }
});
