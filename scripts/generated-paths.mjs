import { join } from "node:path";

import { packageDirectories } from "./package-set.mjs";

export function generatedOutputDirectories(repositoryRoot) {
  return [
    ...packageDirectories.map((directory) => join(repositoryRoot, "packages", directory, "dist")),
    // Every example `tsc -b` emits, so `clean` removes and `check-generated`
    // scans all of them, not the one that happened to be listed first.
    join(repositoryRoot, "examples", "quickstart", "dist"),
    join(repositoryRoot, "examples", "fleet-delegation", "dist"),
    join(repositoryRoot, "examples", "reference-host", "dist"),
  ];
}
