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
 * One column here is not a CLI. Given a model credential, the standard turn loop
 * runs with the model itself in the delegate seat -- no vendor binary, no stdio,
 * the permission-filtered catalogue rendered straight into the model's own
 * tool-call shape. It is live in the sense that matters (a real model really
 * chooses) and it is the only column that isolates the model from the vendor
 * scaffolding around it. It is an addition to the scripted column, never a
 * replacement: see `modelColumn`.
 *
 * Usage:
 *   node scripts/native-conformance.mjs
 *   node scripts/native-conformance.mjs --case expired-mid-turn
 *   node scripts/native-conformance.mjs --config host.json --harness codex
 *
 * Environment:
 *   SHAREDOS_MODEL_API_KEY   the model column's key (DEEPSEEK_API_KEY, DSH_API_KEY)
 *   SHAREDOS_MODEL_AUTH      `api-key` (default) or `codex-subscription`, which
 *                            authenticates from the login `codex login` stored
 *                            and needs no key
 *   SHAREDOS_MODEL_WIRE      `chat-completions`, or `responses` for OpenAI's
 *                            Responses API (the default under
 *                            `codex-subscription`, which is the only wire shape
 *                            that endpoint speaks)
 *   SHAREDOS_MODEL           model name          (default DSH_MODEL, else the config's model.id, else deepseek-v4-flash; on the Responses wire, the config's model.id, else gpt-5-codex)
 *   SHAREDOS_MODEL_BASE_URL  API root            (default https://api.deepseek.com; on the Responses wire, https://chatgpt.com/backend-api/codex under a subscription, else https://api.openai.com/v1)
 *   SHAREDOS_MODEL_PROVIDER  provider label      (default the config's model.provider, else deepseek; on the Responses wire, openai)
 *   SHAREDOS_NATIVE_CONFIG   default for --config
 *   DSH_RUNTIME_COMMAND      DeepSeek Harness JSON-RPC runtime (default dsh-jsonrpc-agent)
 *   DSH_RUNTIME_CONFIG       its plugin composition, passed as the first argument
 *   DSH_RUNTIME_CWD          its working directory, also the `initialize` cwd
 *   DSH_PROVIDER, DSH_MODEL  what `initialize` names (default deepseek-official, deepseek-v4-flash)
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = join(root, "artifacts", "conformance");
const outputJson = join(outputDirectory, "native-conformance.json");

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
const { ChildProcessTransport, createCodexSubscriptionCredential, probeHarness } = await import(
  join(root, "packages", "adapters", "dist", "node.js")
);
const { OpenAiCompatibleModelClient, OpenAiResponsesModelClient } = await import(
  join(root, "packages", "adapters", "dist", "index.js")
);
const {
  CANONICAL_CONFORMANCE_CASES,
  ADVERSARY_COLUMN,
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
 * Run one column instead of all of them. Same flag, same meaning, as
 * `mcp-conformance.mjs`.
 *
 * An id naming no column stops the run, for the reason `--case` does: quietly
 * falling back to an Adversary-only run would attribute a green result to columns
 * that never ran.
 */
const only = flag("harness", undefined);

/**
 * Which model each vendor CLI runs, and how it reaches it.
 *
 * The same operator-supplied file `mcp-conformance.mjs` takes, and for the same
 * reason: provider names, base URLs, credentials and per-vendor flags belong to
 * whoever is running the experiment, not to this repository.
 *
 * Without it every CLI here authenticates however it normally would -- which for
 * a comparison is the wrong default twice over. A stored session login reaches
 * the provider that harness usually uses rather than the one the run pinned, so
 * the columns are not comparable to each other; and on a machine where the
 * operator is themselves a subscriber, an unpinned column spends their own
 * subscription on a result that cannot be published beside the others.
 *
 * `credentialVariables` is what stops that quietly: it makes the named variable
 * *required* for the column, so a harness that cannot reach the pinned model
 * reports unavailable instead of running against a different one.
 */
const configPath = flag("config", process.env["SHAREDOS_NATIVE_CONFIG"]);
const hostConfig =
  configPath === undefined ? {} : JSON.parse(await readFile(resolve(configPath), "utf8"));
/** One string per column, recorded on the availability entry. SharedOS selects nothing. */
const model = hostConfig.model;
/** `${VAR}` is read from the ambient environment, so a config file holds no credential. */
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
    /**
     * `-` is positional and means "read the prompt from stdin", so the
     * operator's `-c` overrides have to be spliced in ahead of it rather than
     * appended. Codex needs no `codex login` for a non-OpenAI provider: the
     * provider block names the variable the key is read from.
     */
    launch: (extra = []) => ({
      command: CODEX_REQUIREMENTS.executable,
      args: ["exec", "--json", "--skip-git-repo-check", ...extra, "-"],
      openingFrame: (request) => ({ type: "user_input", text: request.prompt }),
    }),
  },
  {
    id: "claude-code-live",
    label: "Claude Code",
    harness: "claude-code",
    protocol: claudeCodeProtocol,
    requirements: CLAUDE_CODE_REQUIREMENTS,
    launch: (extra = []) => ({
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
        ...extra,
      ],
      openingFrame: (request) => ({
        type: "user",
        message: { role: "user", content: [{ type: "text", text: request.prompt }] },
      }),
    }),
  },
  {
    id: "deepseek-live",
    label: "DeepSeek",
    harness: "deepseek",
    protocol: deepseekProtocol,
    requirements: DEEPSEEK_REQUIREMENTS,
    /**
     * The `dsh` CLI's shipped profiles are `web`, `headless`, and `tui`; none of
     * them speaks the JSON-RPC automation protocol this adapter targets. That
     * runtime is a separate bin over a plugin composition the host supplies, so
     * both are read from the environment rather than guessed at.
     */
    launch: (extra = []) => ({
      command: process.env["DSH_RUNTIME_COMMAND"] ?? "dsh-jsonrpc-agent",
      args: [
        ...(process.env["DSH_RUNTIME_CONFIG"] === undefined
          ? []
          : [process.env["DSH_RUNTIME_CONFIG"]]),
        ...extra,
      ],
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
    label: "Pi",
    harness: "pi",
    protocol: piProtocol,
    requirements: PI_REQUIREMENTS,
    launch: (extra = []) => ({
      command: PI_REQUIREMENTS.executable,
      args: ["--mode", "rpc", "--no-session", "--no-tools", ...extra],
      openingFrame: (request) => ({
        id: request.executionId,
        type: "prompt",
        message: request.prompt,
      }),
    }),
  },
];

if (only !== undefined) {
  const declared = [...HARNESSES.map(({ harness }) => harness), "model"];
  if (!declared.includes(only)) {
    console.error(`No such harness: ${only}. Declared: ${declared.join(", ")}.`);
    process.exit(1);
  }
}

const availability = [];
const columns = [ADVERSARY_COLUMN];

for (const harness of HARNESSES.filter(({ harness: id }) => only === undefined || id === only)) {
  const host = harnessConfig(harness.harness);
  // A pinned model usually moves the credential to a different variable than the
  // harness's own default, so the host config may override what counts as one --
  // and declaring it makes it required, which is the point. See `harnessConfig`.
  const requirements =
    host.credentialVariables === undefined
      ? harness.requirements
      : {
          ...harness.requirements,
          credentialVariables: host.credentialVariables,
          credentialsOptional: false,
        };
  const probe = await probeHarness(requirements);
  const launch = harness.launch(host.args ?? []);
  availability.push({
    ...launch,
    ...probe,
    columnId: harness.id,
    label: harness.label,
    ...(model === undefined ? {} : { model }),
  });
  if (!probe.available) {
    continue;
  }
  columns.push(
    liveColumn({
      id: harness.id,
      label: harness.label,
      protocol: harness.protocol,
      createTransport: () =>
        new ChildProcessTransport({
          ...launch,
          // Opaque, from the operator's configuration. It reaches the child
          // process on top of the ambient environment and selects nothing here.
          ...(host.env === undefined ? {} : { env: host.env }),
        }),
    }),
  );
}

/**
 * The model column, when a credential is available to run it.
 *
 * Nothing is probed for: there is no executable to find, so the only
 * precondition is something to authenticate with. An absent credential is
 * reported exactly as an absent binary is -- the column does not run, and its
 * absence is not a result about SharedOS.
 *
 * Two kinds of credential reach the same seat. A metered key is a constant. A
 * subscription is a login some vendor CLI already performed, read off disk and
 * renewed against the provider's token endpoint; it is the same column either
 * way, and the record says which one answered.
 */
const modelAuth = process.env["SHAREDOS_MODEL_AUTH"] ?? "api-key";
const modelApiKey =
  process.env["SHAREDOS_MODEL_API_KEY"] ??
  process.env["DEEPSEEK_API_KEY"] ??
  process.env["DSH_API_KEY"];
const subscription =
  modelAuth === "codex-subscription" ? await createCodexSubscriptionCredential() : undefined;
const modelCredentialMissing =
  modelAuth === "codex-subscription"
    ? subscription === undefined
      ? "No Codex login was found. Run `codex login` first, or unset SHAREDOS_MODEL_AUTH."
      : undefined
    : modelApiKey === undefined || modelApiKey.trim() === ""
      ? "None of SHAREDOS_MODEL_API_KEY, DEEPSEEK_API_KEY, DSH_API_KEY is set."
      : undefined;
/**
 * Which wire shape the seat speaks, and what that changes.
 *
 * A subscription reaches OpenAI's Responses endpoint and nothing else, so it
 * selects the wire shape unless the operator says otherwise -- and with it the
 * endpoint, the model, and the provider label, none of whose chat-completions
 * defaults mean anything there. `DSH_MODEL` is deliberately not consulted on
 * the Responses wire: it names a DeepSeek Harness model, and carrying it across
 * would point an OpenAI endpoint at a model it has never heard of.
 */
const modelWire =
  process.env["SHAREDOS_MODEL_WIRE"] ??
  (modelAuth === "codex-subscription" ? "responses" : "chat-completions");
const responsesWire = modelWire === "responses";
const modelName = responsesWire
  ? (process.env["SHAREDOS_MODEL"] ?? model?.id ?? "gpt-5-codex")
  : (process.env["SHAREDOS_MODEL"] ?? process.env["DSH_MODEL"] ?? model?.id ?? "deepseek-v4-flash");
const modelBaseUrl =
  process.env["SHAREDOS_MODEL_BASE_URL"] ??
  (responsesWire
    ? // The two Responses endpoints are not interchangeable: a subscription is
      // recognised by the ChatGPT backend, and a metered key by the public API.
      // Defaulting both to one of them would fail on authentication and read as
      // a broken credential.
      subscription === undefined
      ? "https://api.openai.com/v1"
      : "https://chatgpt.com/backend-api/codex"
    : "https://api.deepseek.com");
const modelProvider =
  process.env["SHAREDOS_MODEL_PROVIDER"] ??
  model?.provider ??
  (responsesWire ? "openai" : "deepseek");
const MODEL_COLUMN_ID = "model-live";

if (only !== undefined && only !== "model") {
  // Filtered out by `--harness`. Nothing is pushed: a column that was not asked
  // for is not an absent one, and reporting it as unavailable would read as a
  // missing credential.
} else if (modelCredentialMissing !== undefined) {
  availability.push({
    columnId: MODEL_COLUMN_ID,
    label: `Standard (${modelName})`,
    harness: "model",
    available: false,
    reason: modelCredentialMissing,
  });
} else {
  availability.push({
    columnId: MODEL_COLUMN_ID,
    label: `Standard (${modelName})`,
    harness: "model",
    available: true,
    detail: {
      endpoint: `${modelBaseUrl}${responsesWire ? "/responses" : "/chat/completions"}`,
      model: modelName,
      provider: modelProvider,
      auth: modelAuth,
      wire: modelWire,
    },
  });
  const clientOptions = {
    ...(subscription === undefined ? { apiKey: modelApiKey } : { credential: subscription }),
    model: modelName,
    provider: modelProvider,
    baseUrl: modelBaseUrl,
  };
  columns.push(
    modelColumn({
      id: MODEL_COLUMN_ID,
      label: `Standard (${modelName})`,
      client: responsesWire
        ? new OpenAiResponsesModelClient(clientOptions)
        : new OpenAiCompatibleModelClient(clientOptions),
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
  console.log(
    "\nNo vendor harness is installed and no model credential is available. Nothing live was run.",
  );
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
const liveColumns = manifest.columns.filter(({ id }) => id !== ADVERSARY_COLUMN.id);
await mkdir(outputDirectory, { recursive: true });
await writeFile(
  outputJson,
  `${JSON.stringify(
    {
      kind: "native-transport-conformance",
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
