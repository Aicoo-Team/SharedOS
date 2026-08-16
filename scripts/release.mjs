import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { packageContentDigest, registryPackageContentDigest } from "./package-archive.mjs";
import { npmRegistry, packageDirectories, prereleaseTag } from "./package-set.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const command = process.argv[2] ?? "check";
const isPublish = command === "publish";
const allowPrivate = process.argv.includes("--allow-private");

if (!new Set(["check", "publish"]).has(command) || (allowPrivate && isPublish)) {
  throw new Error("Usage: node scripts/release.mjs check [--allow-private] | publish");
}

const packages = packageDirectories.map(readPackage);
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

verifyReleaseMetadata(packages, allowPrivate);
verifyStandardRuntimeVersion(version);

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

function verifyReleaseMetadata(packageEntries, allowPrivatePackages) {
  const rootLicense = join(repositoryRoot, "LICENSE");
  if (!allowPrivatePackages && !existsSync(rootLicense)) {
    throw new Error("A repository LICENSE is required before publishing.");
  }

  const expectedLicense = existsSync(rootLicense) ? readFileSync(rootLicense, "utf8") : undefined;
  for (const { directory, packageDirectory, manifest } of packageEntries) {
    if (allowPrivatePackages) {
      if (manifest.private !== true || manifest.license !== "UNLICENSED") {
        throw new Error(`${manifest.name} is not in the expected private preparation state.`);
      }
    } else {
      if (manifest.private === true) {
        throw new Error(`${manifest.name} is still private.`);
      }
      if (!manifest.license || manifest.license === "UNLICENSED") {
        throw new Error(`${manifest.name} has no distributable license.`);
      }
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
    if (!allowPrivatePackages && !existsSync(packageLicense)) {
      throw new Error(`${manifest.name} is missing packages/${directory}/LICENSE.`);
    }
    if (!allowPrivatePackages && readFileSync(packageLicense, "utf8") !== expectedLicense) {
      throw new Error(`${manifest.name} does not contain the canonical repository license.`);
    }
  }
}

function verifyStandardRuntimeVersion(version_) {
  const source = readFileSync(
    join(repositoryRoot, "packages", "runtime", "src", "standard-runtime.ts"),
    "utf8",
  );
  const declared = source.match(/export const STANDARD_RUNTIME_VERSION = "([^"]+)";/)?.[1];
  if (declared !== version_) {
    throw new Error(
      `STANDARD_RUNTIME_VERSION must match the synchronized package version ${version_}; found ${String(declared)}.`,
    );
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
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await fetch(
        `${npmRegistry}/${encodeURIComponent(manifest.name)}/${encodeURIComponent(manifest.version)}`,
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
      await new Promise((resolve_) => setTimeout(resolve_, 5_000));
    }
    if (!published)
      throw new Error(`Could not verify ${manifest.name}@${manifest.version} on npm.`);
  }
}

function run(command_, arguments_, cwd) {
  execFileSync(command_, arguments_, { cwd, stdio: "inherit" });
}

function capture(command_, arguments_, cwd) {
  return execFileSync(command_, arguments_, { cwd, encoding: "utf8" });
}
