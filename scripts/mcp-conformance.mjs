/**
 * Run the conformance case set against harnesses connected over MCP toolshare.
 *
 * This is the column the other two deliberately do not claim.
 *
 * `conformance.mjs` replays recorded frames: the frames are the vendor's, the
 * parsing is the adapter's, and the transport is left out. `live-conformance.mjs`
 * adds the transport but cannot add the catalogue, because no coding-agent CLI
 * accepts a host-supplied tool set on its own stdio protocol -- so a live harness
 * reaches for its own tools, every kernel row goes unexercised, and the column
 * verifies a binding rather than an invariant.
 *
 * Here SharedOS serves the permission-filtered catalogue over MCP, which is the
 * one interface all three ecosystems accept a host-supplied tool set on. The CLI
 * runs natively with its own model and its own loop, discovers the catalogue with
 * its own MCP client, and every call it makes returns through
 * `RuntimeHost.invokeTool` to be re-authorized.
 *
 * It is still allowed to prove nothing. A harness that is absent, unauthenticated,
 * or that declines to make a declared call leaves no operation in the record and
 * is graded `not exercised` -- never a pass, and never a kernel failure.
 *
 * Usage:
 *   node scripts/mcp-conformance.mjs [--harness claude-code] [--limit 1] [--full]
 *
 * Live runs cost model tokens, so the default is one case. `--full` runs the
 * whole set and is what a published result should be produced from.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = join(root, "artifacts", "conformance");
const outputJson = join(outputDirectory, "mcp-conformance.json");

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (argv[index + 1] ?? fallback);
};
const full = argv.includes("--full");
const limit = full ? Number.POSITIVE_INFINITY : Number(flag("limit", "1"));
const only = flag("harness", undefined);

/**
 * Which model each harness runs, and how it reaches it.
 *
 * Deliberately a file the operator supplies rather than anything this repository
 * knows. Provider names, base URLs, credentials, and per-vendor flags belong to
 * whoever is running the experiment; baking them in would put a second source of
 * truth next to the harness's own configuration, and would rot the first time a
 * provider changed one.
 *
 * SharedOS's interest in the model is exactly one string per column, recorded on
 * the execution record so a comparison can be checked. It does not select the
 * model and cannot confirm the provider served it.
 *
 * Shape:
 *
 *   {
 *     "model": { "id": "...", "provider": "..." },
 *     "harnesses": {
 *       "<harness id>": {
 *         "env": { "VAR": "value" },
 *         "args": ["--extra", "flag"],
 *         "credentialVariables": ["VAR"]
 *       }
 *     }
 *   }
 *
 * Absent, every harness runs on whatever it is already configured for, and the
 * records carry no model — which is honest, and not comparable across columns.
 */
const configPath = flag("config", process.env["SHAREDOS_MCP_CONFIG"]);
const hostConfig =
  configPath === undefined ? {} : JSON.parse(await readFile(resolve(configPath), "utf8"));
const model = hostConfig.model;

/**
 * `${VAR}` in a config value is read from the ambient environment.
 *
 * So a committed or shared configuration can name which variable holds a
 * credential without containing the credential. An unset variable expands to the
 * empty string rather than to the literal `${VAR}`, which fails at the harness
 * with an authentication error instead of silently sending a placeholder as a
 * key.
 */
const expand = (value) =>
  String(value).replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/gu, (_, name) => process.env[name] ?? "");
const harnessConfig = (id) => {
  const entry = hostConfig.harnesses?.[id] ?? {};
  return {
    ...entry,
    ...(entry.env === undefined
      ? {}
      : { env: Object.fromEntries(Object.entries(entry.env).map(([k, v]) => [k, expand(v)])) }),
    ...(entry.args === undefined ? {} : { args: entry.args.map((arg) => expand(arg)) }),
  };
};

const { CLAUDE_CODE_REQUIREMENTS, CODEX_REQUIREMENTS, DEEPSEEK_REQUIREMENTS, PI_REQUIREMENTS } =
  await import(join(root, "packages", "adapters", "dist", "index.js"));
const {
  CLAUDE_CODE_MCP_HARNESS,
  CODEX_MCP_HARNESS,
  DEEPSEEK_MCP_HARNESS,
  PI_MCP_HARNESS,
  createMcpHarnessRuntime,
  probeHarness,
} = await import(join(root, "packages", "adapters", "dist", "node.js"));
const { declareToolPolicy, toolPolicyHash } = await import(
  join(root, "packages", "mcp", "dist", "index.js")
);
const {
  CANONICAL_CONFORMANCE_CASES,
  EMBEDDED_COLUMN,
  mcpColumn,
  runConformanceSuite,
  strictFailures,
} = await import(join(root, "packages", "conformance", "dist", "index.js"));

/**
 * What each harness keeps for itself, declared rather than assumed.
 *
 * Every entry is `strict`: the launch flags drop the machine's own MCP servers,
 * so the only brokered tools in the run are the ones SharedOS published. The
 * `harnessLocal` list is what the CLI will not give up, and it is named because a
 * run that claimed an empty local surface would be misdeclaring itself.
 */
const HARNESSES = [
  {
    spec: CLAUDE_CODE_MCP_HARNESS,
    label: "Claude Code",
    requirements: CLAUDE_CODE_REQUIREMENTS,
    policy: declareToolPolicy({ harnessLocal: ["TodoWrite", "SlashCommand"] }),
    mcpSupport: "native",
  },
  {
    spec: CODEX_MCP_HARNESS,
    label: "Codex",
    requirements: CODEX_REQUIREMENTS,
    policy: declareToolPolicy({ harnessLocal: ["shell", "apply_patch"] }),
    mcpSupport: "native",
  },
  {
    spec: DEEPSEEK_MCP_HARNESS,
    label: "Deepseek",
    requirements: DEEPSEEK_REQUIREMENTS,
    policy: declareToolPolicy({ harnessLocal: ["shell", "apply_patch"] }),
    mcpSupport: "native",
  },
  {
    spec: PI_MCP_HARNESS,
    label: "pi",
    requirements: PI_REQUIREMENTS,
    /** `--no-builtin-tools` leaves the proxy tool the extension registers. */
    policy: declareToolPolicy({ harnessLocal: [] }),
    /**
     * Pi ships no MCP client, so this column's MCP support came from an
     * extension the host chose to install. Recorded per column: a reader should
     * not have to know which harnesses have native clients to read the table.
     */
    mcpSupport: "extension",
    mcpExtension: "pi-mcp-adapter",
  },
].filter((harness) => only === undefined || harness.spec.id === only);

const availability = [];
const columns = [EMBEDDED_COLUMN];
const diagnostics = new Map();

for (const harness of HARNESSES) {
  const host = harnessConfig(harness.spec.id);
  // A pinned model usually moves the credential to a different variable than the
  // harness's own default, so the host config may override what counts as one.
  // It also makes the credential required: every harness here can otherwise fall
  // back to a stored session login, and a stored session authenticates to the
  // provider the harness normally uses -- not to the one this run pinned. A
  // column reported available on that basis would run, fail at the harness, and
  // look like a harness that declined the catalogue.
  const requirements =
    host.credentialVariables === undefined
      ? harness.requirements
      : {
          ...harness.requirements,
          credentialVariables: host.credentialVariables,
          credentialsOptional: false,
        };
  const probe = await probeHarness(requirements);
  availability.push({
    columnId: `${harness.spec.id}-mcp`,
    label: harness.label,
    harness: harness.spec.id,
    mcpSupport: harness.mcpSupport,
    ...(harness.mcpExtension === undefined ? {} : { mcpExtension: harness.mcpExtension }),
    toolPolicy: harness.policy,
    policyHash: await toolPolicyHash(harness.policy),
    ...(model === undefined ? {} : { model }),
    ...probe,
  });
  if (!probe.available) {
    continue;
  }

  columns.push(
    mcpColumn({
      id: `${harness.spec.id}-mcp`,
      label: harness.label,
      createRuntime: ({ prompt, executionId, turn }) =>
        createMcpHarnessRuntime(harness.spec, {
          prompt,
          // Opaque, from the operator's configuration. SharedOS passes it to the
          // harness process and records the model string; it selects nothing.
          ...(host.env === undefined ? {} : { env: host.env }),
          ...(host.args === undefined ? {} : { args: host.args }),
          ...(model === undefined ? {} : { model }),
          manifest: {
            ...harness.spec.manifest,
            id: `sharedos.conformance.${harness.spec.id}-mcp`,
            metadata: { ...harness.spec.manifest.metadata, live: true, executionId, turn },
          },
          instructions:
            "SharedOS publishes the permission-filtered tool catalogue for this turn. " +
            "A refusal is an expected result, not an error: report it and continue.",
          onDiagnostic: (id, line) => {
            const kept = diagnostics.get(id) ?? [];
            kept.push(line);
            diagnostics.set(id, kept.slice(-40));
          },
        }),
    }),
  );
}

console.log("Harness availability");
for (const entry of availability) {
  console.log(
    `  ${entry.label.padEnd(12)} ${entry.available ? "available" : "not available"}` +
      `${entry.reason === undefined ? "" : ` — ${entry.reason}`}`,
  );
}

if (columns.length === 1) {
  console.log("\nNo MCP-capable harness is installed here. Nothing live was run.");
}

const cases = Number.isFinite(limit)
  ? CANONICAL_CONFORMANCE_CASES.slice(0, limit)
  : CANONICAL_CONFORMANCE_CASES;
if (cases.length < CANONICAL_CONFORMANCE_CASES.length) {
  console.log(
    `\nRunning ${cases.length} of ${CANONICAL_CONFORMANCE_CASES.length} cases ` +
      `(${CANONICAL_CONFORMANCE_CASES.length - cases.length} not run; pass --full for the whole set).`,
  );
}

console.log(`\nRunning against ${columns.length} column(s)...`);
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

console.log("\n| Harness | pass | not applicable | not implemented | not exercised | fail |");
console.log("| --- | --- | --- | --- | --- | --- |");
for (const column of manifest.columns) {
  const counts = tally.get(column.id) ?? new Map();
  const at = (status) => counts.get(status) ?? 0;
  console.log(
    `| ${column.label} | ${at("pass")} | ${at("not_applicable")} | ` +
      `${at("not_implemented")} | ${at("not_exercised")} | ${at("fail")} |`,
  );
}

/**
 * Whether the columns were actually comparable.
 *
 * This is what `catalogHash` is for and the reason it is printed before the
 * results are read. Columns whose hashes differ were served different tool sets,
 * and their refusal behaviour cannot be compared until that is explained.
 */
const perColumn = new Map();
for (const entry of evidence) {
  const seen = perColumn.get(entry.columnId) ?? {
    turns: 0,
    operations: 0,
    catalogHashes: new Set(),
    toolCounts: new Set(),
    models: new Set(),
    outcomes: new Map(),
    calls: [],
  };
  for (const record of entry.records) {
    seen.turns += 1;
    seen.operations += record.execution.operations.length;
    if (record.system.catalogHash !== undefined) {
      seen.catalogHashes.add(record.system.catalogHash);
      seen.toolCounts.add(record.system.toolCount);
    }
    if (record.system.model !== undefined) {
      seen.models.add(record.system.model);
    }
    seen.outcomes.set(
      record.execution.status,
      (seen.outcomes.get(record.execution.status) ?? 0) + 1,
    );
    // What the harness actually called, in order. A `not exercised` cell means a
    // declared attempt left no operation behind, and this is how to see which
    // call the harness made instead of the one the row asked for.
    for (const operation of record.execution.operations) {
      seen.calls.push({
        caseId: entry.caseId,
        source: operation.source,
        tool: operation.tool,
        path: operation.resource?.path,
        outcome: operation.outcome,
        reasonCode: operation.reasonCode,
      });
    }
  }
  perColumn.set(entry.columnId, seen);
}

console.log("\nWhat each column's turns actually did");
for (const column of manifest.columns) {
  const seen = perColumn.get(column.id);
  if (seen === undefined) {
    console.log(`  ${column.label.padEnd(12)} no turns ran`);
    continue;
  }
  const outcomes = [...seen.outcomes.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([status, count]) => `${status}×${count}`)
    .join(", ");
  const hashes = [...seen.catalogHashes];
  console.log(
    `  ${column.label.padEnd(12)} ${seen.turns} turns, ${seen.operations} mediated operations, ` +
      `outcomes: ${outcomes}`,
  );
  console.log(
    `  ${"".padEnd(12)} catalogue: ` +
      (hashes.length === 0
        ? "none published (this column serves no catalogue)"
        : `${hashes.map((hash) => `sha256:${hash.slice(0, 12)}…`).join(", ")} ` +
          `over ${[...seen.toolCounts].join("/")} tools`),
  );
  const models = [...seen.models];
  console.log(
    `  ${"".padEnd(12)} model:     ` + (models.length === 0 ? "not declared" : models.join(", ")),
  );
}

/**
 * The other half of comparability, and the reason the model string is recorded.
 *
 * Equal catalogues make two columns comparable on the tools they were given.
 * Equal models make them comparable on the harness, which is the variable the
 * suite is actually isolating. A run missing either is still evidence about each
 * column on its own, and is not evidence about the difference between them.
 */
const measuredColumns = [...perColumn.entries()].filter(([id]) => id !== EMBEDDED_COLUMN.id);
const declaredModels = new Set(measuredColumns.flatMap(([, seen]) => [...seen.models]));
if (declaredModels.size > 1) {
  console.error(
    `\nWARNING: columns declared ${declaredModels.size} different models ` +
      `(${[...declaredModels].join(", ")}). They are not comparable to each other.`,
  );
} else if (declaredModels.size === 0 && measuredColumns.length > 1) {
  console.error(
    "\nWARNING: no column declared a model. Pass --config with a `model` entry " +
      "if these columns are meant to be compared to each other.",
  );
}

const publishedHashes = new Set([...perColumn.values()].flatMap((seen) => [...seen.catalogHashes]));
if (publishedHashes.size > 1) {
  console.error(
    `\nWARNING: ${publishedHashes.size} distinct catalogue hashes were served. ` +
      "These columns were not given the same tool set and are not comparable.",
  );
}

const failures = strictFailures(manifest);
const liveColumns = manifest.columns.filter(({ id }) => id !== EMBEDDED_COLUMN.id);
await mkdir(outputDirectory, { recursive: true });
await writeFile(
  outputJson,
  `${JSON.stringify(
    {
      kind: "mcp-toolshare-conformance",
      note:
        "Vendor columns here ran the installed CLI natively, with its own model and " +
        "its own loop, against the SharedOS permission-filtered catalogue served over " +
        "MCP. Every tool call returned through RuntimeHost.invokeTool. A column absent " +
        "from `columns` was not installed and is not a result about SharedOS.",
      elapsedMs,
      casesRun: cases.map(({ id }) => id),
      casesDeclared: CANONICAL_CONFORMANCE_CASES.map(({ id }) => id),
      availability,
      model,
      configPath,
      catalogues: [...perColumn.entries()].map(([columnId, seen]) => ({
        columnId,
        catalogHashes: [...seen.catalogHashes].map((hash) => `sha256:${hash}`),
        toolCounts: [...seen.toolCounts],
        models: [...seen.models],
        calls: seen.calls,
      })),
      diagnostics: Object.fromEntries(diagnostics),
      manifest,
    },
    undefined,
    2,
  )}\n`,
  "utf8",
);

console.log(`\nWrote ${outputJson}`);
console.log(`\n${liveColumns.length} MCP column(s) ran; ${failures.length} cell(s) did not pass.`);
for (const failure of failures.slice(0, 12)) {
  console.error(
    `  - ${failure.caseId}/${failure.conditionId} on ${failure.columnId}: ` +
      `${failure.status} — ${failure.detail}`,
  );
}
if (failures.length > 12) {
  console.error(`  … and ${failures.length - 12} more (see ${outputJson}).`);
}
