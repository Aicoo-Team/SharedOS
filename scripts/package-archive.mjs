import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { npmRegistry } from "./package-set.mjs";

export async function registryPackageContentDigest(metadata, cwd) {
  if (typeof metadata.dist?.tarball !== "string" || typeof metadata.dist?.integrity !== "string") {
    throw new Error(`${metadata.name}@${metadata.version} has incomplete registry metadata.`);
  }

  const tarballUrl = new URL(metadata.dist.tarball);
  if (tarballUrl.protocol !== "https:" || tarballUrl.origin !== new URL(npmRegistry).origin) {
    throw new Error(`${metadata.name}@${metadata.version} has an unexpected npm tarball URL.`);
  }

  const response = await fetch(tarballUrl);
  if (!response.ok) {
    throw new Error(
      `Could not download ${metadata.name}@${metadata.version}: HTTP ${response.status}.`,
    );
  }

  const archiveBytes = Buffer.from(await response.arrayBuffer());
  const registryIntegrity = `sha512-${createHash("sha512").update(archiveBytes).digest("base64")}`;
  if (registryIntegrity !== metadata.dist.integrity) {
    throw new Error(`${metadata.name}@${metadata.version} failed its npm integrity check.`);
  }

  const temporaryDirectory = mkdtempSync(join(tmpdir(), "sharedos-registry-package-"));
  const archive = join(temporaryDirectory, "package.tgz");
  try {
    writeFileSync(archive, archiveBytes);
    return packageContentDigest(archive, cwd);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

export function packageContentDigest(archive, cwd) {
  const entries = capture("tar", ["-tf", archive], cwd)
    .trim()
    .split("\n")
    .filter((entry) => entry && !entry.endsWith("/"))
    .sort();
  assertSafePackageEntries(entries, archive);

  const digest = createHash("sha512");
  for (const entry of entries) {
    let contents = execFileSync("tar", ["-xOf", archive, entry], { cwd });
    if (entry === "package/package.json") {
      const manifest = JSON.parse(contents.toString("utf8"));
      contents = Buffer.from(JSON.stringify(sortJson(manifest)));
    }
    digest.update(entry);
    digest.update("\0");
    digest.update(contents);
    digest.update("\0");
  }

  return digest.digest("base64");
}

export function assertSafePackageEntries(entries, archive) {
  if (new Set(entries).size !== entries.length) {
    throw new Error(`${archive} contains duplicate archive entries.`);
  }
  if (
    entries.some(
      (entry) =>
        !entry.startsWith("package/") ||
        entry.includes("/../") ||
        entry.endsWith("/..") ||
        entry.includes("\\"),
    )
  ) {
    throw new Error(`${archive} contains an unsafe archive path.`);
  }
  if (entries.some((entry) => /\s/.test(entry))) {
    throw new Error(`${archive} contains a conflict-copy archive path.`);
  }
}

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortJson(child)]),
    );
  }
  return value;
}

function capture(command, arguments_, cwd) {
  return execFileSync(command, arguments_, { cwd, encoding: "utf8" });
}
