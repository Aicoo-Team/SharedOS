import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const summaryDirectory = join(root, "docs", "conformance");
const summaryMarkdown = join(summaryDirectory, "kernel-conformance.md");
const summaryJson = join(summaryDirectory, "kernel-conformance.json");
const evidenceDirectory = join(root, "artifacts", "conformance");
const evidenceJson = join(evidenceDirectory, "evidence.json");

const flags = new Set(process.argv.slice(2));
const check = flags.has("--check");
const strict = flags.has("--strict");
const skipBuild = flags.has("--no-build");

if (!skipBuild) {
  const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const build = spawnSync(command, ["build"], { cwd: root, stdio: "inherit" });
  if (build.error) {
    throw build.error;
  }
  if (build.status !== 0) {
    process.exit(build.status ?? 1);
  }
}

const { SHAREDOS_VERSION, renderConformanceSummary, runConformanceSuite, strictFailures } =
  await import(join(root, "packages", "conformance", "dist", "index.js"));

const { manifest, evidence } = await runConformanceSuite();
const markdown = renderConformanceSummary(manifest);
const json = `${JSON.stringify(manifest, undefined, 2)}\n`;

if (check) {
  const stale = [];
  for (const [path, expected] of [
    [summaryMarkdown, markdown],
    [summaryJson, json],
  ]) {
    const actual = await readFile(path, "utf8").catch(() => undefined);
    if (actual !== expected) {
      stale.push(path);
    }
  }
  if (stale.length > 0) {
    console.error("Conformance manifest is stale:");
    for (const path of stale) {
      console.error(`  - ${path}`);
    }
    console.error("Run `pnpm conformance` and commit the regenerated files.");
    process.exit(1);
  }
  console.log("Conformance manifest is up to date.");
} else {
  await mkdir(summaryDirectory, { recursive: true });
  await writeFile(summaryMarkdown, markdown, "utf8");
  await writeFile(summaryJson, json, "utf8");
  await mkdir(evidenceDirectory, { recursive: true });
  await writeFile(evidenceJson, `${JSON.stringify(evidence, undefined, 2)}\n`, "utf8");
  console.log(`Wrote ${summaryMarkdown}`);
  console.log(`Wrote ${summaryJson}`);
  console.log(`Wrote ${evidenceJson}`);
}

const counts = new Map();
for (const row of manifest.rows) {
  for (const cell of row.cells) {
    counts.set(cell.status, (counts.get(cell.status) ?? 0) + 1);
  }
}
console.log(
  [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([status, count]) => `${status}: ${count}`)
    .join("  "),
);
// Which build produced those cells. It stays out of the committed manifest on
// purpose -- a version bump would make every gated file stale without a single
// enforcement change -- so it is printed here and carried on every record in
// `evidence.json`, which is where a reader can check it.
console.log(
  `SharedOS ${SHAREDOS_VERSION}, runtime ${evidence[0]?.runtime.id ?? "none ran"} ` +
    `${evidence[0]?.runtime.version ?? ""}`.trimEnd(),
);

const failures = strictFailures(manifest);
if (failures.length > 0) {
  const label = strict ? "error" : "warning";
  console.error(`\n${failures.length} cell(s) did not pass:`);
  for (const failure of failures) {
    console.error(
      `  - [${label}] ${failure.caseId}/${failure.conditionId} on ${failure.columnId}: ${failure.status} — ${failure.detail}`,
    );
  }
  if (strict) {
    process.exit(1);
  }
}
