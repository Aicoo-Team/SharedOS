import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { packageDirectories } from "./package-set.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publint = join(repositoryRoot, "node_modules", ".bin", "publint");

for (const directory of packageDirectories) {
  execFileSync(publint, [join(repositoryRoot, "packages", directory)], {
    cwd: repositoryRoot,
    stdio: "inherit",
  });
}
