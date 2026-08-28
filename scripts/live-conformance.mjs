/**
 * Run the conformance case set against harnesses that are actually installed.
 *
 * The committed manifest's vendor columns are scripted: the frame shapes are
 * written in this repository, the parsing is the adapter's, and the transport is
 * the one part left out. This script runs that missing part. It spawns the real CLI, carries
 * real frames over real stdio, and parses whatever the binary actually emitted.
 *
 * It is deliberately allowed to prove nothing. A harness that is absent,
 * unauthenticated, or emitting shapes the adapter does not parse is reported as
 * `not exercised`, never as a pass and never as a kernel failure -- an absent
 * harness is not evidence about SharedOS.
 *
 * The harness's own tools are disabled where the CLI supports it. A conformance
 * probe must not be able to edit files or run commands on the machine it is
 * measuring, and a harness reaching for its own `bash` instead of the catalogue
 * would be answering a different question anyway.
 *
 * One column here is not a CLI. Given a model API key, the standard turn loop
 * runs with the model itself in the delegate seat -- no vendor binary, no stdio,
 * the permission-filtered catalogue rendered straight into the model's own
 * tool-call shape. It is live in the sense that matters (a real model really
 * chooses) and it is the only column that isolates the model from the vendor
 * scaffolding around it. It is an addition to the scripted column, never a
 * replacement: see `modelColumn`.
 *
 * Usage:
 *   node scripts/live-conformance.mjs
 *   node scripts/live-conformance.mjs --case expired-mid-turn
 *
 * Environment:
 *   SHAREDOS_MODEL_API_KEY   the model column's key (DEEPSEEK_API_KEY, DSH_API_KEY)
 *   SHAREDOS_MODEL           model name          (default deepseek-v4-flash)
 *   SHAREDOS_MODEL_BASE_URL  chat-completions root (default https://api.deepseek.com)
 *   SHAREDOS_MODEL_PROVIDER  provider label      (default deepseek)
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = join(root, "artifacts", "conformance");
const outputJson = join(outputDirectory, "live-conformance.json");

const {
  CLAUDE_CODE_REQUIREMENTS,
  CODEX_REQUIREMENTS,
  DEEPSEEK_REQUIREMENTS,
  PI_REQUIREMENTS,
  claudeCodeProtocol,
  codexProtocol,
  deepseekProtocol,
  piProtocol,
} = await import(join(root, "packages", "adapters", "dist", "index.js"));
const { ChildProcessTransport, probeHarness } = await import(
  join(root, "packages", "adapters", "dist", "node.js")
);
const { OpenAiCompatibleModelClient } = await import(
  join(root, "packages", "adapters", "dist", "index.js")
);
const {
  CANONICAL_CONFORMANCE_CASES,
  EMBEDDED_COLUMN,
  liveColumn,
  modelColumn,
  runConformanceSuite,
  strictFailures,
} = await import(join(root, "packages", "conformance", "dist", "index.js"));

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (argv[index + 1] ?? fallback);
};
/**
 * Run named cases instead of the whole set.
 *
 * A live turn costs model tokens and a live harness is slow, so exercising one
 * row should not oblige the twenty-three that precede it. Ids are comma
 * separated, and one that names no case stops the run before a harness is even
 * probed: quietly executing a smaller set than was asked for is how a green
 * result gets attributed to a row that never ran.
 *
 * The default stays the whole set, unlike `mcp-conformance.mjs`, which defaults
 * to one. This script's contract has always been "run the case set", and a
 * published live result is a whole-set one; narrowing the default would silently
 * change what an existing invocation produces.
 */
const selected = flag("case", undefined)
  ?.split(",")
  .map((id) => id.trim())
  .filter((id) => id.length > 0);

if (selected !== undefined) {
  const declared = new Set(CANONICAL_CONFORMANCE_CASES.map(({ id }) => id));
  const unknown = selected.filter((id) => !declared.has(id));
  if (unknown.length > 0) {
    console.error(`No such conformance case: ${unknown.join(", ")}`);
    process.exit(1);
  }
}
const cases =
  selected === undefined
    ? CANONICAL_CONFORMANCE_CASES
    : CANONICAL_CONFORMANCE_CASES.filter(({ id }) => selected.includes(id));

/**
 * How each harness is launched, and how the turn's prompt reaches it.
 *
 * Every entry carries the flags that keep the harness's own tools out of the
 * run. Where a CLI has no such flag the harness is still launched, because a
 * transport that cannot be exercised is a result worth recording too.
 */
const HARNESSES = [
  {
    id: "codex-live",
    label: "Codex",
    harness: "codex",
    protocol: codexProtocol,
    requirements: CODEX_REQUIREMENTS,
    launch: () => ({
      command: CODEX_REQUIREMENTS.executable,
      args: ["exec", "--json", "--skip-git-repo-check", "-"],
      openingFrame: (request) => ({ type: "user_input", text: request.prompt }),
    }),
  },
  {
    id: "claude-code-live",
    label: "Claude Code",
    harness: "claude-code",
    protocol: claudeCodeProtocol,
    requirements: CLAUDE_CODE_REQUIREMENTS,
    launch: () => ({
      command: CLAUDE_CODE_REQUIREMENTS.executable,
      args: [
        "-p",
        "--input-format",
        "stream-json",
        "--output-format",
        "stream-json",
        "--verbose",
        // The harness must not reach for its own tools: this run is about the
        // permission-filtered catalogue, and a probe that could run Bash on the
        // measuring machine is not a probe worth having.
        "--disallowedTools",
        "Bash,Edit,Write,Read,NotebookEdit,Task,WebFetch,WebSearch",
        "--max-turns",
        "6",
      ],
      openingFrame: (request) => ({
        type: "user",
        message: { role: "user", content: [{ type: "text", text: request.prompt }] },
      }),
    }),
  },
  {
    id: "deepseek-live",
    label: "Deepseek",
    harness: "deepseek",
    protocol: deepseekProtocol,
    requirements: DEEPSEEK_REQUIREMENTS,
    /**
     * The `dsh` CLI's shipped profiles are `web`, `headless`, and `tui`; none of
     * them speaks the JSON-RPC automation protocol this adapter targets. That
     * runtime is a separate bin over a plugin composition the host supplies, so
     * both are read from the environment rather than guessed at.
     */
    launch: () => ({
      command: process.env["DSH_RUNTIME_COMMAND"] ?? "dsh-jsonrpc-agent",
      args:
        process.env["DSH_RUNTIME_CONFIG"] === undefined ? [] : [process.env["DSH_RUNTIME_CONFIG"]],
      ...(process.env["DSH_RUNTIME_CWD"] === undefined
        ? {}
        : { cwd: process.env["DSH_RUNTIME_CWD"] }),
      // The runtime answers `initialize` before it will accept a prompt.
      openingFrame: (request) => [
        {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            cwd: process.env["DSH_RUNTIME_CWD"] ?? process.cwd(),
            provider: process.env["DSH_PROVIDER"] ?? "deepseek-official",
            model: process.env["DSH_MODEL"] ?? "deepseek-v4-flash",
          },
        },
        {
          jsonrpc: "2.0",
          id: 2,
          method: "session/prompt",
          params: {
            sessionId: request.executionId,
            contentBlocks: [{ type: "text", text: request.prompt }],
          },
        },
      ],
    }),
  },
  {
    id: "pi-live",
    label: "pi",
    harness: "pi",
    protocol: piProtocol,
    requirements: PI_REQUIREMENTS,
    launch: () => ({
      command: PI_REQUIREMENTS.executable,
      args: ["--mode", "rpc", "--no-session", "--no-tools"],
      openingFrame: (request) => ({
        id: request.executionId,
        type: "prompt",
        message: request.prompt,
      }),
    }),
  },
];

const availability = [];
const columns = [EMBEDDED_COLUMN];

for (const harness of HARNESSES) {
  const probe = await probeHarness(harness.requirements);
  availability.push({ ...harness.launch(), ...probe, columnId: harness.id, label: harness.label });
  if (!probe.available) {
    continue;
  }
  const launch = harness.launch();
  columns.push(
    liveColumn({
      id: harness.id,
      label: harness.label,
      protocol: harness.protocol,
      createTransport: () => new ChildProcessTransport(launch),
    }),
  );
}

/**
 * The model column, when a key is available to run it.
 *
 * Nothing is probed for: there is no executable and no session to authenticate,
 * so the only precondition is a credential. An absent key is reported exactly
 * as an absent binary is -- the column does not run, and its absence is not a
 * result about SharedOS.
 */
const modelApiKey =
  process.env["SHAREDOS_MODEL_API_KEY"] ??
  process.env["DEEPSEEK_API_KEY"] ??
  process.env["DSH_API_KEY"];
const modelName = process.env["SHAREDOS_MODEL"] ?? process.env["DSH_MODEL"] ?? "deepseek-v4-flash";
const modelBaseUrl = process.env["SHAREDOS_MODEL_BASE_URL"] ?? "https://api.deepseek.com";
const modelProvider = process.env["SHAREDOS_MODEL_PROVIDER"] ?? "deepseek";
const MODEL_COLUMN_ID = "model-live";

if (modelApiKey === undefined || modelApiKey.trim() === "") {
  availability.push({
    columnId: MODEL_COLUMN_ID,
    label: `Standard (${modelName})`,
    harness: "model",
    available: false,
    reason: "None of SHAREDOS_MODEL_API_KEY, DEEPSEEK_API_KEY, DSH_API_KEY is set.",
  });
} else {
  availability.push({
    columnId: MODEL_COLUMN_ID,
    label: `Standard (${modelName})`,
    harness: "model",
    available: true,
    detail: {
      endpoint: `${modelBaseUrl}/chat/completions`,
      model: modelName,
      provider: modelProvider,
    },
  });
  columns.push(
    modelColumn({
      id: MODEL_COLUMN_ID,
      label: `Standard (${modelName})`,
      client: new OpenAiCompatibleModelClient({
        apiKey: modelApiKey,
        model: modelName,
        provider: modelProvider,
        baseUrl: modelBaseUrl,
      }),
    }),
  );
}

console.log("Harness availability");
for (const entry of availability) {
  console.log(
    `  ${entry.label.padEnd(28)} ${entry.available ? "available" : "not available"}` +
      `${entry.reason === undefined ? "" : ` — ${entry.reason}`}`,
  );
}

if (columns.length === 1) {
  console.log("\nNo vendor harness is installed and no model key is set. Nothing live was run.");
}

if (cases.length < CANONICAL_CONFORMANCE_CASES.length) {
  console.log(
    `\nRunning ${cases.length} of ${CANONICAL_CONFORMANCE_CASES.length} cases ` +
      `(${cases.map(({ id }) => id).join(", ")}). A partial run is not a manifest.`,
  );
}

console.log(`\nRunning ${cases.length} case(s) against ${columns.length} column(s)...`);
const started = Date.now();
const { manifest, evidence } = await runConformanceSuite({ cases, columns });
const elapsedMs = Date.now() - started;

const tally = new Map();
for (const row of manifest.rows) {
  for (const cell of row.cells) {
    const counts = tally.get(cell.columnId) ?? new Map();
    counts.set(cell.status, (counts.get(cell.status) ?? 0) + 1);
    tally.set(cell.columnId, counts);
  }
}

console.log(
  "\n| Harness | pass | not applicable | not implemented | out of scope | not exercised | fail |",
);
console.log("| --- | --- | --- | --- | --- | --- | --- |");
for (const column of manifest.columns) {
  const counts = tally.get(column.id) ?? new Map();
  const at = (status) => counts.get(status) ?? 0;
  console.log(
    `| ${column.label} | ${at("pass")} | ${at("not_applicable")} | ` +
      `${at("not_implemented")} | ${at("out_of_scope")} | ${at("not_exercised")} | ${at("fail")} |`,
  );
}

/**
 * What the live transport actually carried.
 *
 * Counted from the execution records rather than from anything a harness said
 * about itself: a driver that quietly issued nothing leaves no operation behind
 * to be mistaken for one that was refused.
 */
const perColumn = new Map();
for (const entry of evidence) {
  const seen = perColumn.get(entry.columnId) ?? {
    turns: 0,
    operations: 0,
    outcomes: new Map(),
    models: new Set(),
  };
  for (const record of entry.records) {
    seen.turns += 1;
    seen.operations += record.execution.operations.length;
    const status = record.execution.status;
    seen.outcomes.set(status, (seen.outcomes.get(status) ?? 0) + 1);
    // Which model actually answered, as the record has it. A column that names
    // no model is not a failure -- the scripted one calls none -- but a column
    // that names a different one than was configured is a result attributed to
    // a model that never ran, and that has to be visible.
    if (record.system.model !== undefined) {
      seen.models.add(record.system.model);
    }
  }
  perColumn.set(entry.columnId, seen);
}

console.log("\nWhat each column's turns actually did");
for (const column of manifest.columns) {
  const seen = perColumn.get(column.id);
  if (seen === undefined) {
    console.log(`  ${column.label.padEnd(28)} no turns ran`);
    continue;
  }
  const outcomes = [...seen.outcomes.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([status, count]) => `${status}×${count}`)
    .join(", ");
  const models = [...seen.models];
  console.log(
    `  ${column.label.padEnd(28)} ${seen.turns} turns, ` +
      `${seen.operations} mediated operations, outcomes: ${outcomes}`,
  );
  console.log(
    `  ${"".padEnd(28)} model: ` + (models.length === 0 ? "not declared" : models.join(", ")),
  );
}

const failures = strictFailures(manifest);
const liveColumns = manifest.columns.filter(({ id }) => id !== EMBEDDED_COLUMN.id);
await mkdir(outputDirectory, { recursive: true });
await writeFile(
  outputJson,
  `${JSON.stringify(
    {
      kind: "live-transport-conformance",
      note:
        "Vendor columns here were driven by the installed CLI over its real stdio " +
        "transport. A column absent from `columns` was not installed and is not a " +
        "result about SharedOS.",
      elapsedMs,
      // Which rows this run actually put, beside every row it could have. A
      // partial run that recorded only its results would be read as a whole one.
      casesRun: cases.map(({ id }) => id),
      casesDeclared: CANONICAL_CONFORMANCE_CASES.map(({ id }) => id),
      availability: availability.map(
        ({ columnId, label, harness, available, reason, detail, command, args }) => ({
          columnId,
          label,
          harness,
          available,
          ...(reason === undefined ? {} : { reason }),
          ...(detail === undefined ? {} : { detail }),
          // The model column has no binary to name. Recording the keys as
          // absent rather than as `undefined` keeps a reader from concluding a
          // spawn was attempted and left unrecorded.
          ...(command === undefined ? {} : { command, args }),
        }),
      ),
      manifest,
    },
    undefined,
    2,
  )}\n`,
  "utf8",
);

console.log(`\nWrote ${outputJson}`);
console.log(`\n${liveColumns.length} live column(s) ran; ${failures.length} cell(s) did not pass.`);
for (const failure of failures.slice(0, 12)) {
  console.error(
    `  - ${failure.caseId}/${failure.conditionId} on ${failure.columnId}: ` +
      `${failure.status} — ${failure.detail}`,
  );
}
if (failures.length > 12) {
  console.error(`  … and ${failures.length - 12} more (see ${outputJson}).`);
}
