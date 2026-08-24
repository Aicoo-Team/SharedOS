import type { RuntimeManifest } from "@aicoo/sharedos-contracts";
import { SharedOSExecutor } from "@aicoo/sharedos-runtime";

import {
  moveTurnCount,
  readAdversarialReport,
  type AdversarialTurnReport,
  type AttackMove,
  type AttemptReceipt,
} from "./adversary.js";
import {
  CLAUDE_CODE_SCRIPTED_COLUMN,
  CODEX_SCRIPTED_COLUMN,
  DEEPSEEK_SCRIPTED_COLUMN,
  EMBEDDED_COLUMN,
  PI_SCRIPTED_COLUMN,
  type ColumnLimits,
  type RuntimeColumn,
} from "./columns.js";
import { assembleExecutionRecord } from "./assemble.js";
import { hashExperimentInputs, hashJson } from "./hashing.js";
import { judgeCase, type ConformanceStatus, type EnforcementPoint } from "./judge.js";
import type { ExecutionRecord } from "./record.js";
import {
  CANONICAL_CONFORMANCE_CASES,
  type ConformanceCase,
  type ConformanceCondition,
} from "./suite.js";
import { CONFORMANCE_NOW, createConformanceWorld, type ConformanceWorld } from "./world.js";

/** Version of the grading rules, so a manifest names what produced it. */
export const JUDGE_VERSION = "2";

/**
 * The SharedOS build an execution record was produced by.
 *
 * Pinned to the synchronized workspace version by the release gate, because a
 * record that names the wrong build is evidence attributed to code that never
 * ran.
 */
export const SHAREDOS_VERSION = "0.1.0-alpha.0";

/**
 * One cell of the manifest.
 *
 * Every field here is invariant-relevant and stable across runs. Model names,
 * adapter versions, timings, and event volumes belong to the evidence artifact,
 * so a committed manifest diffs only when enforcement behaviour changes.
 */
export interface ConformanceCell {
  readonly columnId: string;
  readonly status: ConformanceStatus;
  readonly refusedBy: readonly EnforcementPoint[];
  readonly reasonCodes: readonly string[];
  readonly declared: number;
  readonly attempted: number;
  /** Attempts a runtime structurally cannot make, declared rather than omitted. */
  readonly notApplicable: number;
  readonly recordUsable: boolean;
  readonly recordGaps: readonly string[];
  /** Turns run against one world for this cell. One unless the move spans more. */
  readonly turns: number;
  readonly detail?: string;
}

export interface ConformanceRow {
  readonly caseId: string;
  readonly conditionId: string;
  readonly kind: AttackMove["kind"];
  readonly invariant: string;
  readonly expectedOutcome: string;
  readonly condition: string;
  readonly cells: readonly ConformanceCell[];
}

export interface ConformanceManifest {
  readonly version: "1";
  readonly judgeVersion: string;
  /** Hash of the case definitions this manifest was produced from. */
  readonly caseSetHash: string;
  readonly columns: readonly { readonly id: string; readonly label: string }[];
  readonly rows: readonly ConformanceRow[];
}

/** Everything behind one cell. Large, and expected to churn on runtime metadata. */
export interface ConformanceEvidence {
  readonly caseId: string;
  readonly conditionId: string;
  readonly columnId: string;
  readonly runtime: RuntimeManifest;
  /**
   * One record per turn, in order. A row about what the next turn sees produces
   * two, and keeping both is what lets the claim be re-checked without re-running
   * anything.
   */
  readonly records: readonly ExecutionRecord[];
  readonly reports: readonly (AdversarialTurnReport | undefined)[];
}

export interface ConformanceRun {
  readonly manifest: ConformanceManifest;
  readonly evidence: readonly ConformanceEvidence[];
}

/**
 * The columns a committed manifest is produced from.
 *
 * The scripted adversary in the SharedOS executor, plus each vendor adapter
 * driven by scripted frames. The vendor columns exercise the adapter's own
 * protocol translation against the real kernel and envelope; the transport that
 * would carry the frames from a live CLI is the one part left out, so a live
 * column is a separate claim and is not made here.
 */
export const DEFAULT_COLUMNS: readonly RuntimeColumn[] = Object.freeze([
  EMBEDDED_COLUMN,
  CODEX_SCRIPTED_COLUMN,
  CLAUDE_CODE_SCRIPTED_COLUMN,
  DEEPSEEK_SCRIPTED_COLUMN,
  PI_SCRIPTED_COLUMN,
]);

export interface RunConformanceSuiteOptions {
  readonly cases?: readonly ConformanceCase[];
  readonly columns?: readonly RuntimeColumn[];
}

/**
 * Run every case under every column and grade the result.
 *
 * Cells are produced in declared order and nothing here reads a clock or a
 * random source, so one case set against one set of columns yields the same
 * manifest every time.
 */
export async function runConformanceSuite(
  options: RunConformanceSuiteOptions = {},
): Promise<ConformanceRun> {
  const cases = options.cases ?? CANONICAL_CONFORMANCE_CASES;
  const columns = options.columns ?? DEFAULT_COLUMNS;
  const caseSetHash = await hashJson(cases);

  const rows: ConformanceRow[] = [];
  const evidence: ConformanceEvidence[] = [];

  for (const kase of cases) {
    for (const condition of kase.conditions) {
      const cells: ConformanceCell[] = [];
      for (const column of columns) {
        if (kase.notImplemented !== undefined) {
          cells.push(declaredCell(column, kase.move, "not_implemented", kase.notImplemented));
          continue;
        }
        const unsupported = column.limits?.(kase.move, condition)?.unsupported;
        if (unsupported !== undefined) {
          cells.push(declaredCell(column, kase.move, "not_applicable", unsupported));
          continue;
        }
        const cell = await runCell(kase, condition, column);
        cells.push(cell.cell);
        evidence.push(cell.evidence);
      }
      rows.push({
        caseId: kase.id,
        conditionId: condition.id,
        kind: kase.move.kind,
        invariant: kase.move.invariant,
        expectedOutcome: kase.move.expectedOutcome,
        condition: condition.description,
        cells,
      });
    }
  }

  return {
    manifest: {
      version: "1",
      judgeVersion: JUDGE_VERSION,
      caseSetHash,
      columns: columns.map(({ id, label }) => ({ id, label })),
      rows,
    },
    evidence,
  };
}

/**
 * A cell that was decided without running anything.
 *
 * Two things are reported this way: a row SharedOS does not implement, and a
 * row this column structurally cannot run. Neither is a result about
 * enforcement, and running a turn to produce one would only manufacture
 * evidence for a claim nobody made. The cell still carries the move's declared
 * attempt count, so the manifest says how much of the row went unmeasured
 * rather than only that some of it did.
 */
function declaredCell(
  column: RuntimeColumn,
  move: AttackMove,
  status: "not_implemented" | "not_applicable",
  reason: string,
): ConformanceCell {
  return {
    columnId: column.id,
    status,
    refusedBy: [],
    reasonCodes: [],
    declared: move.attempts.length,
    attempted: 0,
    notApplicable: status === "not_applicable" ? move.attempts.length : 0,
    recordUsable: false,
    recordGaps: [],
    turns: 0,
    detail: reason,
  };
}

/**
 * Run one cell: the move, under one condition, against one column.
 *
 * A move whose attempts name more than one turn is run once per turn against a
 * single world, so a claim about what the *next* turn sees is evidenced by an
 * actual next turn rather than by a second fixture. Receipts are merged across
 * turns -- attempt ids are unique within a move -- and every turn's record is
 * kept. The last turn's record is what the row is graded against, because that
 * is the turn the claim is about.
 */
async function runCell(
  kase: ConformanceCase,
  condition: ConformanceCondition,
  column: RuntimeColumn,
): Promise<{ cell: ConformanceCell; evidence: ConformanceEvidence }> {
  const world = createConformanceWorld(condition.world);
  const executionId = `${kase.id}.${condition.id}.${column.id}`;
  const turns = moveTurnCount(kase.move);
  const limits: ColumnLimits = column.limits?.(kase.move, condition) ?? {};
  const hashes = await hashExperimentInputs({
    spec: { case: kase.id, move: kase.move, condition: condition.id },
    world: worldDescription(world, condition),
    evaluator: { judge: "sharedos-conformance", version: JUDGE_VERSION },
    policy: {
      enabledToolNamespaces: world.context.enabledToolNamespaces,
      tools: world.tools,
    },
  });

  const records: ExecutionRecord[] = [];
  const reports: (AdversarialTurnReport | undefined)[] = [];
  const receipts: AttemptReceipt[] = [];

  for (let turn = 1; turn <= turns; turn += 1) {
    const turnId = turns === 1 ? executionId : `${executionId}.turn-${turn}`;
    const request = world.request(turnId, turn);

    let sequence = 0;
    const result = await new SharedOSExecutor(
      world.kernel,
      column.create([kase.move], { turn, executionId: turnId }),
      {
        clock: () => CONFORMANCE_NOW,
        createId: () => `${turnId}.event-${(sequence += 1)}`,
      },
    ).execute(request);

    const record = assembleExecutionRecord({
      request,
      result,
      auditEvents: world.auditEvents,
      experiment: {
        experimentId: "kernel-conformance",
        taskId: kase.id,
        runId:
          turns === 1 ? `${condition.id}.${column.id}` : `${condition.id}.${column.id}.${turn}`,
        specHash: hashes.specHash,
        worldHash: hashes.worldHash,
        evaluatorHash: hashes.evaluatorHash,
      },
      system: {
        protocolVersion: "1",
        sharedOsVersion: SHAREDOS_VERSION,
        adapterId: column.id,
        policyHash: hashes.policyHash,
      },
    });

    const report = readAdversarialReport(result);
    records.push(record);
    reports.push(report);
    // A column that cannot report on itself has its attempts recovered from the
    // record, which is the stricter source: a runtime that quietly skipped a
    // call leaves no operation behind to be mistaken for a denial.
    receipts.push(
      ...(column.receipts === undefined
        ? (report?.receipts ?? [])
        : column.receipts(kase.move, { executionId: turnId, turn, record })),
    );
  }

  const record = records[records.length - 1] as ExecutionRecord;
  const judgement = judgeCase(
    kase.move,
    { receipts, record },
    {
      ...(condition.expectTurn === undefined ? {} : { expectTurn: condition.expectTurn }),
      ...(limits.unreachable === undefined ? {} : { unreachable: limits.unreachable }),
    },
  );

  // Applied after judging rather than instead of it, so the row is still run and
  // its receipts still kept. What the ungraded call actually did stays in the
  // evidence; only the verdict is withheld, because SharedOS declares no
  // guarantee here to hold it against.
  const status: ConformanceStatus =
    limits.outOfScope === undefined ? judgement.status : "out_of_scope";

  return {
    cell: {
      columnId: column.id,
      status,
      refusedBy: judgement.refusedBy,
      reasonCodes: judgement.reasonCodes,
      declared: judgement.declared,
      attempted: judgement.attempted,
      notApplicable: judgement.attempts.filter(({ status }) => status === "not_applicable").length,
      recordUsable: judgement.recordUsable,
      recordGaps: judgement.recordGaps,
      turns,
      ...(limits.outOfScope !== undefined
        ? { detail: limits.outOfScope }
        : judgement.detail === undefined
          ? {}
          : { detail: judgement.detail }),
    },
    evidence: {
      caseId: kase.id,
      conditionId: condition.id,
      columnId: column.id,
      runtime: record.system.runtime,
      records,
      reports,
    },
  };
}

/** What the condition materialised, hashed separately from the specification. */
function worldDescription(world: ConformanceWorld, condition: ConformanceCondition): unknown {
  return {
    condition: condition.world,
    namespaceId: world.context.namespaceId,
    enabledToolNamespaces: world.context.enabledToolNamespaces,
    // The grants the condition actually issued, not the ones the baseline
    // world would have. A condition that adds authority has a different world,
    // and a world hash that could not tell them apart would let two different
    // worlds claim to be reproductions of each other.
    grants: world.grants,
    tools: world.tools.map(({ name }) => name),
  };
}

export interface StrictFailure {
  readonly caseId: string;
  readonly conditionId: string;
  readonly columnId: string;
  readonly status: ConformanceStatus;
  readonly detail: string;
}

/**
 * Cells that must break a build.
 *
 * `not_exercised` is included on purpose: a row that proved nothing is a broken
 * suite, and treating it as a soft result is how a manifest ends up reporting
 * guarantees nobody tested.
 *
 * `not_implemented` is excluded, and is one of two statuses that are standing
 * results rather than regressions: the row is declared, its absence is stated
 * in the manifest, and a build that failed on it would only pressure someone
 * into deleting the row. It is counted and printed by the conformance script
 * so the gap stays in view.
 *
 * `out_of_scope` is excluded for the same reason and needs the same care. It
 * records a guarantee SharedOS has declared does not reach a column, which is a
 * narrowing of the claim rather than a defect -- but a narrowing is exactly the
 * thing that could be used to make a build go green, so the row stays printed,
 * stays out of every pass rate, and carries the reason it was narrowed.
 */
export function strictFailures(manifest: ConformanceManifest): readonly StrictFailure[] {
  const failures: StrictFailure[] = [];
  for (const row of manifest.rows) {
    for (const cell of row.cells) {
      if (cell.status === "fail" || cell.status === "not_exercised") {
        failures.push({
          caseId: row.caseId,
          conditionId: row.conditionId,
          columnId: cell.columnId,
          status: cell.status,
          detail: cell.detail ?? row.invariant,
        });
      }
    }
  }
  return failures;
}

/** Render the manifest as a stable Markdown document. */
export function renderConformanceSummary(manifest: ConformanceManifest): string {
  const columns = manifest.columns;
  const header = [
    "Invariant",
    "Expected outcome",
    "Condition",
    ...columns.map(({ label }) => label),
  ];
  const lines = [
    "# Kernel conformance manifest",
    "",
    "Generated by `pnpm conformance`. Every row is an attempted violation, run by a",
    "scripted adversary against a world armed by trusted setup.",
    "",
    "Vendor columns are scripted. Their frames are written here, from the declared",
    "attempt, in the wire shape that vendor's protocol is understood to use, and are",
    "parsed back by the adapter's real protocol translation against the real kernel",
    "and envelope. No vendor session was captured. Two things are left",
    "out — the transport that would carry the frames from a live CLI, and whether",
    "the vendor still emits these shapes — so these columns say nothing about a",
    "live session. Live-run columns are a separate claim and are not made here.",
    "",
    `- Case set: \`${manifest.caseSetHash}\``,
    `- Grading rules: version \`${manifest.judgeVersion}\``,
    `- Columns: ${manifest.columns.map(({ label }) => `\`${label}\``).join(", ")}`,
    "",
    "A cell is `pass` only when every declared attempt met its expected outcome and",
    "every control attempt succeeded. `not exercised` means the attempt never reached",
    "SharedOS, and is never a pass. `not applicable` means a runtime structurally",
    "cannot make the attempt. `not implemented` means SharedOS does not do this:",
    "the row is declared so the gap is stated rather than omitted, and it is never",
    "run and never a pass. `out of scope` means the attempt was made and recorded",
    "and SharedOS declares no guarantee over it on this path; it is not a pass, not",
    "a failure, and never averaged into either.",
    "",
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
  ];

  for (const row of manifest.rows) {
    const cells = columns.map(({ id }) => {
      const cell = row.cells.find((candidate) => candidate.columnId === id);
      return cell === undefined ? "—" : statusLabel(cell.status);
    });
    lines.push(
      `| ${[row.invariant, row.expectedOutcome, row.conditionId, ...cells].join(" | ")} |`,
    );
  }

  lines.push("", "## Evidence per row", "");
  for (const row of manifest.rows) {
    lines.push(`### ${row.invariant} — \`${row.conditionId}\``, "", row.condition, "");
    for (const cell of row.cells) {
      const label = columns.find(({ id }) => id === cell.columnId)?.label ?? cell.columnId;
      lines.push(
        cell.status === "not_implemented"
          ? `- **${label}** — ${statusLabel(cell.status)}; ${cell.declared} ` +
              `${cell.declared === 1 ? "attempt" : "attempts"} declared, none runnable; ` +
              `${cell.detail ?? "no reason given"}`
          : cell.turns === 0
            ? `- **${label}** — ${statusLabel(cell.status)}; ${cell.declared} ` +
              `${cell.declared === 1 ? "attempt" : "attempts"} declared, none issued; ` +
              `${cell.detail ?? "no reason given"}`
            : `- **${label}** — ${statusLabel(cell.status)}; ` +
              `${cell.attempted} of ${cell.declared} attempts issued` +
              `${cell.notApplicable === 0 ? "" : `, ${cell.notApplicable} structurally unreachable`}` +
              `${cell.turns <= 1 ? "" : ` over ${cell.turns} turns`}; ` +
              `refused by ${list(cell.refusedBy, "nothing")}; ` +
              `reason ${list(cell.reasonCodes, "none")}; ` +
              `record ${cell.recordUsable ? "usable" : `unusable (${list(cell.recordGaps, "unknown")})`}` +
              `${cell.detail === undefined ? "" : `; ${cell.detail}`}`,
      );
    }
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function statusLabel(status: ConformanceStatus): string {
  return status.replaceAll("_", " ");
}

function list(values: readonly string[], empty: string): string {
  return values.length === 0 ? empty : values.map((value) => `\`${value}\``).join(", ");
}
