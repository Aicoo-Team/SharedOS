import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

import { packageDirectories, publishOrderViolations } from "./package-set.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifests = packageDirectories.map((directory) =>
  JSON.parse(readFileSync(join(repositoryRoot, "packages", directory, "package.json"), "utf8")),
);

test("the package set is in publish order", () => {
  assert.deepEqual(publishOrderViolations(manifests), []);
});

test("a package published before a dependency is reported by name", () => {
  const reordered = [...manifests];
  const mcp = reordered.findIndex(({ name }) => name === "@aicoo/sharedos-mcp");
  const conformance = reordered.findIndex(({ name }) => name === "@aicoo/sharedos-conformance");
  [reordered[mcp], reordered[conformance]] = [reordered[conformance], reordered[mcp]];

  assert.ok(
    publishOrderViolations(reordered).includes(
      "@aicoo/sharedos-conformance is published before its dependency @aicoo/sharedos-mcp",
    ),
  );
});

test("a workspace dependency outside the set is a violation", () => {
  assert.deepEqual(
    publishOrderViolations([
      { name: "@aicoo/sharedos-x", dependencies: { "@aicoo/sharedos-missing": "workspace:*" } },
    ]),
    ["@aicoo/sharedos-x depends on @aicoo/sharedos-missing, which is not in the package set"],
  );
});
