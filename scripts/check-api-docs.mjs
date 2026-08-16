import { spawnSync } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const expectedDirectory = join(root, "docs", "api");
const temporaryDirectory = await mkdtemp(join(tmpdir(), "sharedos-api-docs-"));
const generatedDirectory = join(temporaryDirectory, "api");

async function listFiles(directory, base = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(absolutePath, base)));
    } else if (entry.isFile()) {
      files.push(relative(base, absolutePath));
    }
  }

  return files.sort();
}

try {
  const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const build = spawnSync(command, ["build"], { cwd: root, stdio: "inherit" });

  if (build.error) {
    throw build.error;
  }

  const result =
    build.status === 0
      ? spawnSync(command, ["exec", "typedoc", "--out", generatedDirectory], {
          cwd: root,
          stdio: "inherit",
        })
      : undefined;

  if (result?.error) {
    throw result.error;
  }
  if (build.status !== 0 || result?.status !== 0) {
    process.exitCode = build.status || result?.status || 1;
  } else if (result) {
    let expectedFiles;
    try {
      expectedFiles = await listFiles(expectedDirectory);
    } catch (error) {
      if (error?.code === "ENOENT") {
        console.error("API reference is missing. Run `pnpm docs:api` and commit docs/api.");
        process.exitCode = 1;
      } else {
        throw error;
      }
    }

    if (expectedFiles) {
      const generatedFiles = await listFiles(generatedDirectory);
      const allFiles = [...new Set([...expectedFiles, ...generatedFiles])].sort();
      const differences = [];

      for (const file of allFiles) {
        if (!expectedFiles.includes(file)) {
          differences.push(`missing from docs/api: ${file}`);
          continue;
        }
        if (!generatedFiles.includes(file)) {
          differences.push(`unexpected in docs/api: ${file}`);
          continue;
        }

        const [expected, generated] = await Promise.all([
          readFile(join(expectedDirectory, file)),
          readFile(join(generatedDirectory, file)),
        ]);
        if (!expected.equals(generated)) {
          differences.push(`changed: ${file}`);
        }
      }

      if (differences.length > 0) {
        console.error("API reference is stale:");
        for (const difference of differences) {
          console.error(`  - ${difference}`);
        }
        console.error("Run `pnpm docs:api` and commit the regenerated files.");
        process.exitCode = 1;
      } else {
        console.log("API reference is up to date.");
      }
    }
  }
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
