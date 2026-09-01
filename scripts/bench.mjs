/**
 * Measure what SharedOS costs, and write the result where a paper can cite it.
 *
 * Deliberately not part of `pnpm check`. A latency figure is a figure about a
 * machine, and a gate that failed when a shared runner was busy would teach
 * everyone to ignore it. The conformance manifest is the thing that must not
 * drift; this is evidence, produced on a named machine and stamped with it.
 *
 * Usage:
 *   node scripts/bench.mjs [--runs 2] [--turns 200] [--warmup 60] [--no-build]
 *
 * Every run is written whole. The last one is what the rendered document
 * reports, and the spread between runs is printed so a reader can see whether
 * the machine was steady while it was measured.
 */
import { spawnSync } from "node:child_process";
import { cpus, totalmem } from "node:os";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const summaryDirectory = join(root, "docs", "conformance");
const summaryMarkdown = join(summaryDirectory, "systems-cost.md");
const artifactDirectory = join(root, "artifacts", "bench");
const artifactJson = join(artifactDirectory, "systems-cost.json");

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (argv[index + 1] ?? fallback);
};
const runs = Math.max(1, Number(flag("runs", "2")));
const measuredTurns = Number(flag("turns", "200"));
const warmupTurns = Number(flag("warmup", "60"));

if (!argv.includes("--no-build")) {
  const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const build = spawnSync(command, ["build"], { cwd: root, stdio: "inherit" });
  if (build.error) {
    throw build.error;
  }
  if (build.status !== 0) {
    process.exit(build.status ?? 1);
  }
}

const { renderSystemsCostReport, runSystemsCostBench } = await import(
  join(root, "packages", "conformance", "dist", "index.js")
);

/**
 * What the run was taken on.
 *
 * The conformance package cannot read any of this: it is host-neutral and has
 * no `process`. A latency number without it is a number nobody can say where it
 * came from, and two of them cannot be compared at all.
 */
const environment = {
  node: process.version,
  platform: `${process.platform}-${process.arch}`,
  cpu: cpus()[0]?.model ?? "unknown",
  cores: cpus().length,
  memoryGb: Math.round(totalmem() / 1024 ** 3),
};

const reports = [];
for (let run = 1; run <= runs; run += 1) {
  process.stderr.write(`run ${run} of ${runs}\n`);
  reports.push(await runSystemsCostBench({ warmupTurns, measuredTurns, environment }));
}

const published = reports[reports.length - 1];
await mkdir(summaryDirectory, { recursive: true });
await writeFile(summaryMarkdown, renderSystemsCostReport(published), "utf8");
await mkdir(artifactDirectory, { recursive: true });
await writeFile(
  artifactJson,
  `${JSON.stringify({ version: "1", runs: reports }, undefined, 2)}\n`,
  "utf8",
);

console.log(`Systems cost written to ${summaryMarkdown}`);
for (const measure of published.measures) {
  console.log(
    `  ${measure.component} (${measure.path}): p50 ${measure.latency.p50Ms.toFixed(4)} ms, ` +
      `p95 ${measure.latency.p95Ms.toFixed(4)} ms, ${Math.round(measure.latency.opsPerSecond)} ops/s, ` +
      `n=${measure.latency.n}`,
  );
}

if (reports.length > 1) {
  console.log("Run-to-run spread of the p50, per row:");
  for (const [index, measure] of published.measures.entries()) {
    const values = reports.map((report) => report.measures[index].latency.p50Ms);
    const low = Math.min(...values);
    const high = Math.max(...values);
    const spread = low === 0 ? 0 : ((high - low) / low) * 100;
    console.log(
      `  ${measure.component} (${measure.path}): ${low.toFixed(4)}–${high.toFixed(4)} ms, ` +
        `${spread.toFixed(0)}%`,
    );
  }
}
