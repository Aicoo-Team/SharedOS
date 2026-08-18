import type { RuntimeManifest } from "@aicoo/sharedos-contracts";
import { SharedOSExecutor, type RuntimePlugin } from "@aicoo/sharedos-runtime";

import {
  HostileRuntime,
  readAdversarialReport,
  type AdversarialTurnReport,
  type AttackMove,
} from "./adversary.js";
import { assembleExecutionRecord } from "./assemble.js";
import { hashExperimentInputs, hashJson } from "./hashing.js";
import { judgeCase, type ConformanceStatus, type EnforcementPoint } from "./judge.js";
import type { ExecutionRecord } from "./record.js";
import {
  CANONICAL_CONFORMANCE_CASES,
  type ConformanceCase,
  type ConformanceCondition,
} from "./suite.js";
import {
  agentGrants,
  CONFORMANCE_NOW,
  createConformanceWorld,
  rootGrants,
  type ConformanceWorld,
} from "./world.js";

/** Version of the grading rules, so a manifest names what produced it. */
export const JUDGE_VERSION = "1";

/**
 * One column of the manifest: an adapter occupying the delegate seat.
 *
 * The attacker stays scripted across every column. What varies is the runtime
 * that mediates its calls, which is the whole point of the claim under test --
 * the kernel's guarantees should not depend on which driver is in the seat.
 */
export interface RuntimeColumn {
  readonly id: string;
  readonly label: string;
  create(moves: readonly AttackMove[]): RuntimePlugin;
}

/** The in-process column: the SharedOS executor driving the scripted adversary. */
export const EMBEDDED_COLUMN: RuntimeColumn = Object.freeze({
  id: "sharedos-embedded",
  label: "Standard",
  create: (moves: readonly AttackMove[]) => new HostileRuntime(moves),
});

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
  readonly record: ExecutionRecord;
  readonly report: AdversarialTurnReport | undefined;
}

export interface ConformanceRun {
  readonly manifest: ConformanceManifest;
  readonly evidence: readonly ConformanceEvidence[];
}

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
  const columns = options.columns ?? [EMBEDDED_COLUMN];
  const caseSetHash = await hashJson(cases);

  const rows: ConformanceRow[] = [];
  const evidence: ConformanceEvidence[] = [];

  for (const kase of cases) {
    for (const condition of kase.conditions) {
      const cells: ConformanceCell[] = [];
      for (const column of columns) {
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

async function runCell(
  kase: ConformanceCase,
  condition: ConformanceCondition,
  column: RuntimeColumn,
): Promise<{ cell: ConformanceCell; evidence: ConformanceEvidence }> {
  const world = createConformanceWorld(condition.world);
  const executionId = `${kase.id}.${condition.id}.${column.id}`;
  const request = world.request(executionId);
  const hashes = await hashExperimentInputs({
    spec: { case: kase.id, move: kase.move, condition: condition.id },
    world: worldDescription(world, condition),
    evaluator: { judge: "sharedos-conformance", version: JUDGE_VERSION },
    policy: {
      enabledToolNamespaces: world.context.enabledToolNamespaces,
      tools: world.tools,
    },
  });

  let sequence = 0;
  const result = await new SharedOSExecutor(world.kernel, column.create([kase.move]), {
    clock: () => CONFORMANCE_NOW,
    createId: () => `${executionId}.event-${(sequence += 1)}`,
  }).execute(request);

  const record = assembleExecutionRecord({
    request,
    result,
    auditEvents: world.auditEvents,
    experiment: {
      experimentId: "kernel-conformance",
      taskId: kase.id,
      runId: `${condition.id}.${column.id}`,
      specHash: hashes.specHash,
      worldHash: hashes.worldHash,
      evaluatorHash: hashes.evaluatorHash,
    },
    system: {
      protocolVersion: "1",
      sharedOsVersion: "0.1.0-alpha.0",
      adapterId: column.id,
      policyHash: hashes.policyHash,
    },
  });

  const report = readAdversarialReport(result);
  const judgement = judgeCase(kase.move, { receipts: report?.receipts ?? [], record });

  return {
    cell: {
      columnId: column.id,
      status: judgement.status,
      refusedBy: judgement.refusedBy,
      reasonCodes: judgement.reasonCodes,
      declared: judgement.declared,
      attempted: judgement.attempted,
      notApplicable: judgement.attempts.filter(({ status }) => status === "not_applicable").length,
      recordUsable: judgement.recordUsable,
      recordGaps: judgement.recordGaps,
      ...(judgement.detail === undefined ? {} : { detail: judgement.detail }),
    },
    evidence: {
      caseId: kase.id,
      conditionId: condition.id,
      columnId: column.id,
      runtime: record.system.runtime,
      record,
      report,
    },
  };
}

/** What the condition materialised, hashed separately from the specification. */
function worldDescription(world: ConformanceWorld, condition: ConformanceCondition): unknown {
  return {
    condition: condition.world,
    namespaceId: world.context.namespaceId,
    enabledToolNamespaces: world.context.enabledToolNamespaces,
    grants: [...rootGrants(), ...agentGrants()],
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
    `- Case set: \`${manifest.caseSetHash}\``,
    `- Grading rules: version \`${manifest.judgeVersion}\``,
    "",
    "A cell is `pass` only when every declared attempt met its expected outcome and",
    "every control attempt succeeded. `not exercised` means the attempt never reached",
    "SharedOS, and is never a pass. `not applicable` means a runtime structurally",
    "cannot make the attempt.",
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
      const column = columns.find(({ id }) => id === cell.columnId);
      lines.push(
        `- **${column?.label ?? cell.columnId}** — ${statusLabel(cell.status)}; ` +
          `${cell.attempted} of ${cell.declared} attempts issued` +
          `${cell.notApplicable === 0 ? "" : `, ${cell.notApplicable} structurally unreachable`}; ` +
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
  return status.replace("_", " ");
}

function list(values: readonly string[], empty: string): string {
  return values.length === 0 ? empty : values.map((value) => `\`${value}\``).join(", ");
}
