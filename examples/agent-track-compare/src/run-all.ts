/**
 * Run all feature examples.
 *
 * Execute: pnpm --filter @aicoo/sharedos-example-agent-track-compare start:all
 */

import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const featuresDir = join(__dirname, "features");
  const files = (await readdir(featuresDir)).filter((f) => f.endsWith(".ts")).sort();

  for (const file of files) {
    const module = await import(join(featuresDir, file));
    // Each module has a default export that is a function
    if (typeof module.default === "function") {
      await module.default();
    } else if (typeof module.run === "function") {
      await module.run();
    }
    // Modules with top-level code (no export) execute on import
  }
}

main().catch(console.error);
