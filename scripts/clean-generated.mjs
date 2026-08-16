import { rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { generatedOutputDirectories } from "./generated-paths.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

for (const directory of generatedOutputDirectories(repositoryRoot)) {
  rmSync(directory, { recursive: true, force: true });
}
