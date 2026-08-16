import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import { packageContentDigest } from "./package-archive.mjs";

test("package content digest ignores JSON object key order", () => {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), "sharedos-package-digest-"));
  try {
    const first = createArchive(temporaryDirectory, "first", {
      name: "@aicoo/sharedos-example",
      version: "0.1.0-alpha.0",
      dependencies: { alpha: "1.0.0", beta: "2.0.0" },
    });
    const second = createArchive(temporaryDirectory, "second", {
      dependencies: { beta: "2.0.0", alpha: "1.0.0" },
      version: "0.1.0-alpha.0",
      name: "@aicoo/sharedos-example",
    });

    assert.equal(
      packageContentDigest(first, temporaryDirectory),
      packageContentDigest(second, temporaryDirectory),
    );
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test("package content digest detects file changes", () => {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), "sharedos-package-digest-"));
  try {
    const first = createArchive(
      temporaryDirectory,
      "first",
      { name: "@aicoo/sharedos-example" },
      "a",
    );
    const second = createArchive(
      temporaryDirectory,
      "second",
      { name: "@aicoo/sharedos-example" },
      "b",
    );

    assert.notEqual(
      packageContentDigest(first, temporaryDirectory),
      packageContentDigest(second, temporaryDirectory),
    );
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test("package content digest rejects unsafe archive paths", () => {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), "sharedos-package-digest-"));
  try {
    writeFileSync(join(temporaryDirectory, "outside.js"), "export {};\n");
    const archive = join(temporaryDirectory, "unsafe.tgz");
    execFileSync("tar", ["-czf", archive, "outside.js"], { cwd: temporaryDirectory });

    assert.throws(() => packageContentDigest(archive, temporaryDirectory), /unsafe archive path/);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

function createArchive(root, name, manifest, source = "export {};\n") {
  const fixtureRoot = join(root, name);
  const packageRoot = join(fixtureRoot, "package");
  mkdirSync(packageRoot, { recursive: true });
  writeFileSync(join(packageRoot, "package.json"), JSON.stringify(manifest));
  writeFileSync(join(packageRoot, "index.js"), source);

  const archive = join(root, `${name}.tgz`);
  execFileSync("tar", ["-czf", archive, "package"], { cwd: fixtureRoot });
  return archive;
}
