import { existsSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { generatedOutputDirectories } from "./generated-paths.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const invalidPaths = [];

for (const directory of generatedOutputDirectories(repositoryRoot)) {
  if (existsSync(directory)) collectInvalidPaths(directory);
}

if (invalidPaths.length > 0) {
  throw new Error(
    `Generated output contains conflict-copy paths:\n${invalidPaths
      .sort()
      .map((entry) => `- ${entry}`)
      .join("\n")}`,
  );
}

function collectInvalidPaths(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = join(directory, entry.name);
    if (/\s/.test(entry.name)) invalidPaths.push(relative(repositoryRoot, absolutePath));
    if (entry.isDirectory()) collectInvalidPaths(absolutePath);
  }
}
