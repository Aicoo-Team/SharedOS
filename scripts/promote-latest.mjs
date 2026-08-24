/**
 * Point the `latest` dist-tag at one already-published version, for every
 * package in the set.
 *
 * Releases publish under `next` so a prerelease never becomes `latest` by
 * accident. That leaves `latest` wherever the first publication put it, and a
 * plain `npm install @aicoo/sharedos` then resolves to the oldest release. Until
 * a stable version exists, promoting deliberately is better than shipping the
 * oldest code to anyone who omits a tag.
 *
 * Usage:
 *   node scripts/promote-latest.mjs 0.1.0-alpha.2 [--dry-run]
 *
 * Every package is a separate registry write, and npm requires one
 * authentication per write when the account enforces 2FA. Use a granular access
 * token scoped to the @aicoo packages to do it in one step:
 *
 *   printf '//registry.npmjs.org/:_authToken=%s\n' "$NPM_TOKEN" > /tmp/npmrc
 *   npm_config_userconfig=/tmp/npmrc node scripts/promote-latest.mjs 0.1.0-alpha.2
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { npmRegistry, packageDirectories } from "./package-set.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const version = process.argv[2];
const dryRun = process.argv.includes("--dry-run");

if (version === undefined || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error("Usage: node scripts/promote-latest.mjs <version> [--dry-run]");
}

const names = packageDirectories.map((directory) => {
  const manifestPath = join(repositoryRoot, "packages", directory, "package.json");
  return JSON.parse(readFileSync(manifestPath, "utf8")).name;
});

// Refuse before writing anything if the version is not fully published. A
// partial promotion is worse than none: `latest` would then disagree across
// packages that are meant to move together.
const missing = [];
for (const name of names) {
  const response = await fetch(
    `${npmRegistry}/${encodeURIComponent(name)}/${encodeURIComponent(version)}`,
    { cache: "no-store", headers: { "cache-control": "no-cache" } },
  );
  if (!response.ok) missing.push(`${name}@${version} (${response.status})`);
}

if (missing.length > 0) {
  throw new Error(`Not published, refusing to promote a partial set:\n  ${missing.join("\n  ")}`);
}

const failures = [];
for (const name of names) {
  const target = `${name}@${version}`;
  if (dryRun) {
    console.log(`would promote ${target} to latest`);
    continue;
  }

  try {
    execFileSync("npm", ["dist-tag", "add", target, "latest"], { stdio: "inherit" });
  } catch {
    failures.push(target);
  }
}

if (failures.length > 0) {
  throw new Error(
    `Could not promote ${failures.length} of ${names.length} packages:\n  ${failures.join("\n  ")}\n` +
      "Re-run to retry only what is still behind; promoting an already-promoted package is a no-op.",
  );
}

if (!dryRun) console.log(`\nlatest now points at ${version} for ${names.length} packages.`);
