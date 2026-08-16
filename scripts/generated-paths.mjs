import { join } from "node:path";

import { packageDirectories } from "./package-set.mjs";

export function generatedOutputDirectories(repositoryRoot) {
  return [
    ...packageDirectories.map((directory) => join(repositoryRoot, "packages", directory, "dist")),
    join(repositoryRoot, "examples", "quickstart", "dist"),
  ];
}
