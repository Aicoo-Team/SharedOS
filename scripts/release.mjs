import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { packageContentDigest, registryPackageContentDigest } from "./package-archive.mjs";
import {
  npmRegistry,
  packageDirectories,
  prereleaseTag,
  publishOrderViolations,
} from "./package-set.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Registry propagation is eventual; a red verify on a successful publish is worse than waiting. */
const VERIFY_TIMEOUT_MS = 300_000;
const VERIFY_BASE_DELAY_MS = 3_000;
const VERIFY_MAX_DELAY_MS = 30_000;
const command = process.argv[2] ?? "check";
const isPublish = command === "publish";

if (!new Set(["check", "publish"]).has(command)) {
  throw new Error("Usage: node scripts/release.mjs check | publish");
}

const packages = packageDirectories.map(readPackage);
const orderViolations = publishOrderViolations(packages.map(({ manifest }) => manifest));
if (orderViolations.length > 0) {
  throw new Error(`The package set is not in publish order:\n  ${orderViolations.join("\n  ")}`);
}

const versions = new Set(packages.map(({ manifest }) => manifest.version));

if (versions.size !== 1) {
  throw new Error(
    `All SharedOS packages must share one version; found ${[...versions].join(", ")}.`,
  );
}

const version = packages[0]?.manifest.version;
if (typeof version !== "string" || !/^0\.\d+\.\d+-[0-9A-Za-z.-]+$/.test(version)) {
  throw new Error(`Expected a 0.x prerelease version, received ${String(version)}.`);
}

verifyReleaseMetadata(packages);
verifyEmbeddedVersions(version);

run("pnpm", ["check"], repositoryRoot);
run("pnpm", ["pack:preview"], repositoryRoot);
run("node", ["scripts/package-lint.mjs"], repositoryRoot);

const archives = readArchives(packages);
const registryState = await inspectRegistryState(packages, archives);
for (const { manifest } of packages) {
  const archive = archiveFor(manifest, archives);
  run(
    "npm",
    [
      "publish",
      archive,
      "--dry-run",
      "--ignore-scripts",
      "--access",
      "public",
      "--tag",
      prereleaseTag,
    ],
    repositoryRoot,
  );
}

if (!isPublish) {
  console.log(`\nRelease check passed for ${packages.length} packages at ${version}.`);
  console.log(
    `Registry state: ${registryState.filter(({ state }) => state === "matching").length} matching, ${registryState.filter(({ state }) => state === "missing").length} unpublished.`,
  );
  console.log(`Dry-run dist-tag: ${prereleaseTag}`);
  process.exit(0);
}

verifyPublishContext(version);

for (const { manifest } of packages) {
  const archive = archiveFor(manifest, archives);
  const state = registryState.find((entry) => entry.name === manifest.name);
  if (state?.state === "matching") {
    console.log(
      `Skipping ${manifest.name}@${manifest.version}; identical package contents are already published.`,
    );
    continue;
  }
  run(
    "npm",
    [
      "publish",
      archive,
      "--ignore-scripts",
      "--access",
      "public",
      "--tag",
      prereleaseTag,
      "--registry",
      npmRegistry,
    ],
    repositoryRoot,
  );
}

await verifyPublished(packages, archives);
console.log(`\nPublished SharedOS ${version} under the ${prereleaseTag} dist-tag.`);

function readPackage(directory) {
  const packageDirectory = join(repositoryRoot, "packages", directory);
  const manifest = JSON.parse(readFileSync(join(packageDirectory, "package.json"), "utf8"));
  return { directory, packageDirectory, manifest };
}

function verifyReleaseMetadata(packageEntries) {
  const rootLicense = join(repositoryRoot, "LICENSE");
  if (!existsSync(rootLicense)) {
    throw new Error("A repository LICENSE is required before publishing.");
  }

  const expectedLicense = readFileSync(rootLicense, "utf8");
  for (const { directory, packageDirectory, manifest } of packageEntries) {
    if (manifest.private === true) {
      throw new Error(`${manifest.name} is still private.`);
    }
    if (!manifest.license || manifest.license === "UNLICENSED") {
      throw new Error(`${manifest.name} has no distributable license.`);
    }
    if (manifest.publishConfig?.access !== "public") {
      throw new Error(`${manifest.name} must publish with public access.`);
    }
    if (manifest.publishConfig?.tag !== prereleaseTag) {
      throw new Error(`${manifest.name} must publish prereleases under the ${prereleaseTag} tag.`);
    }
    if (manifest.publishConfig?.registry !== npmRegistry) {
      throw new Error(`${manifest.name} must be pinned to ${npmRegistry}.`);
    }

    const packageLicense = join(packageDirectory, "LICENSE");
    if (!existsSync(packageLicense)) {
      throw new Error(`${manifest.name} is missing packages/${directory}/LICENSE.`);
    }
    if (readFileSync(packageLicense, "utf8") !== expectedLicense) {
      throw new Error(`${manifest.name} does not contain the canonical repository license.`);
    }
  }
}

/**
 * Pin every version constant that is compiled into a published artifact.
 *
 * Each of these ends up in a runtime manifest or an execution record, where it
 * identifies which build produced a piece of evidence. A stale one is worse
 * than a missing one, so they are checked here rather than trusted to be
 * updated by hand.
 */
function verifyEmbeddedVersions(version_) {
  const embedded = [
    {
      path: ["packages", "runtime", "src", "standard-runtime.ts"],
      name: "STANDARD_RUNTIME_VERSION",
    },
    { path: ["packages", "adapters", "src", "codex", "index.ts"], name: "CODEX_ADAPTER_VERSION" },
    {
      path: ["packages", "adapters", "src", "claude-code", "index.ts"],
      name: "CLAUDE_CODE_ADAPTER_VERSION",
    },
    {
      path: ["packages", "adapters", "src", "deepseek", "index.ts"],
      name: "DEEPSEEK_ADAPTER_VERSION",
    },
    { path: ["packages", "adapters", "src", "pi", "index.ts"], name: "PI_ADAPTER_VERSION" },
    { path: ["packages", "adapters", "src", "mcp-runtime.ts"], name: "MCP_ADAPTER_VERSION" },
    { path: ["packages", "mcp", "src", "server.ts"], name: "MCP_SERVER_VERSION" },
    { path: ["packages", "conformance", "src", "runner.ts"], name: "SHAREDOS_VERSION" },
  ];

  for (const { path, name } of embedded) {
    const source = readFileSync(join(repositoryRoot, ...path), "utf8");
    const declared = source.match(new RegExp(`export const ${name} = "([^"]+)";`))?.[1];
    if (declared !== version_) {
      throw new Error(
        `${name} must match the synchronized package version ${version_}; found ${String(declared)}.`,
      );
    }
  }
}

async function inspectRegistryState(packageEntries, archives) {
  const states = [];
  for (const { manifest } of packageEntries) {
    const archive = archiveFor(manifest, archives);
    const localDigest = packageContentDigest(archive, repositoryRoot);
    const response = await fetch(
      `${npmRegistry}/${encodeURIComponent(manifest.name)}/${encodeURIComponent(manifest.version)}`,
    );
    if (response.status === 404) {
      states.push({ name: manifest.name, state: "missing" });
      continue;
    }
    if (!response.ok) {
      throw new Error(
        `npm registry preflight failed for ${manifest.name}: HTTP ${response.status}.`,
      );
    }

    const metadata = await response.json();
    const remoteDigest = await registryPackageContentDigest(metadata, repositoryRoot);
    if (remoteDigest !== localDigest) {
      throw new Error(
        `${manifest.name}@${manifest.version} already exists with different package contents. Bump the version.`,
      );
    }
    states.push({ name: manifest.name, state: "matching" });
  }
  return states;
}

function readArchives(packageEntries) {
  const outputDirectory = join(repositoryRoot, "artifacts", "npm");
  const archives = readdirSync(outputDirectory)
    .filter((entry) => entry.endsWith(".tgz"))
    .map((entry) => join(outputDirectory, entry));
  if (archives.length !== packageEntries.length) {
    throw new Error(
      `Expected exactly ${packageEntries.length} release archives, found ${archives.length}.`,
    );
  }
  return archives;
}

function archiveFor(manifest, archives) {
  const expectedName = `${manifest.name.replace(/^@/, "").replace("/", "-")}-${manifest.version}.tgz`;
  const archive = archives.find((candidate) => candidate.endsWith(expectedName));
  if (!archive) throw new Error(`Missing packed archive for ${manifest.name}: ${expectedName}.`);
  return archive;
}

function verifyPublishContext(version_) {
  const expectedConfirmation = `v${version_}`;
  if (process.env.SHAREDOS_RELEASE_CONFIRM !== expectedConfirmation) {
    throw new Error(`Set SHAREDOS_RELEASE_CONFIRM=${expectedConfirmation} to publish.`);
  }

  const status = capture("git", ["status", "--porcelain"], repositoryRoot).trim();
  if (status) throw new Error("Publishing requires a clean Git worktree.");

  const tags = capture("git", ["tag", "--points-at", "HEAD"], repositoryRoot).trim().split("\n");
  if (!tags.includes(expectedConfirmation)) {
    throw new Error(`Publishing requires tag ${expectedConfirmation} on HEAD.`);
  }

  try {
    execFileSync("git", ["merge-base", "--is-ancestor", "HEAD", "origin/main"], {
      cwd: repositoryRoot,
      stdio: "ignore",
    });
  } catch {
    throw new Error("Publishing requires the tagged commit to be contained in origin/main.");
  }
}

async function verifyPublished(packageEntries, archives) {
  for (const { manifest } of packageEntries) {
    const expectedDigest = packageContentDigest(archiveFor(manifest, archives), repositoryRoot);
    let published = false;
    let attempts = 0;
    const deadline = Date.now() + VERIFY_TIMEOUT_MS;

    // The registry is read-after-write eventual, and a CDN edge that served a
    // 404 before the publish landed will keep serving it. Retrying the same
    // URL with default caching can therefore never succeed, which is why this
    // waits with backoff *and* asks for an uncached response every time.
    while (Date.now() < deadline) {
      attempts += 1;
      const response = await fetch(
        `${npmRegistry}/${encodeURIComponent(manifest.name)}/${encodeURIComponent(manifest.version)}`,
        { cache: "no-store", headers: { "cache-control": "no-cache", pragma: "no-cache" } },
      );

      if (response.ok) {
        const metadata = await response.json();
        const publishedDigest = await registryPackageContentDigest(metadata, repositoryRoot);
        if (publishedDigest !== expectedDigest) {
          throw new Error(
            `${manifest.name}@${manifest.version} has unexpected published contents.`,
          );
        }
        published = true;
        break;
      }

      if (response.status !== 404) {
        console.log(
          `Waiting for ${manifest.name}@${manifest.version}: registry returned ${response.status}.`,
        );
      }

      const wait = Math.min(VERIFY_MAX_DELAY_MS, VERIFY_BASE_DELAY_MS * 2 ** (attempts - 1));
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      console.log(
        `${manifest.name}@${manifest.version} not visible yet (attempt ${attempts}); retrying in ${Math.round(Math.min(wait, remaining) / 1000)}s.`,
      );
      await new Promise((resolve_) => setTimeout(resolve_, Math.min(wait, remaining)));
    }

    if (!published) {
      throw new Error(
        `Could not verify ${manifest.name}@${manifest.version} on npm after ${attempts} attempts over ` +
          `${Math.round(VERIFY_TIMEOUT_MS / 1000)}s. The publish may still have succeeded — check ` +
          `\`npm view ${manifest.name} versions\` before republishing.`,
      );
    }
  }
}

function run(command_, arguments_, cwd) {
  execFileSync(command_, arguments_, { cwd, stdio: "inherit" });
}

function capture(command_, arguments_, cwd) {
  return execFileSync(command_, arguments_, { cwd, encoding: "utf8" });
}
