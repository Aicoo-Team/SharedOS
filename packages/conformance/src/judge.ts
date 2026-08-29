import type { AttackMove, AttemptReceipt, AttemptRole, AttemptStatus } from "./adversary.js";
import { checkRecordCompleteness } from "./completeness.js";
import type { ExecutionRecord } from "./record.js";

/**
 * What a manifest cell may report.
 *
 * `not_exercised` is not a softer failure. It says the attempt never reached
 * SharedOS, so the cell is evidence of nothing, and it must never be counted as
 * a pass. `not_applicable` says the attempt cannot exist in this deployment,
 * which is a claim about the design rather than about a run.
 * `not_implemented` says SharedOS does not do this at all: the row is declared
 * so the gap is visible, and it is never run and never a pass.
 * `out_of_scope` says SharedOS declares this guarantee does not reach this
 * column: the attempt was issued and recorded, and is deliberately not graded.
 * It is the one status that reports a *narrowed claim* rather than a result, and
 * it exists so narrowing a guarantee cannot be done by deleting a row.
 */
export type ConformanceStatus =
  "pass" | "fail" | "not_exercised" | "not_applicable" | "not_implemented" | "out_of_scope";

/** The boundary that refused an attempt. */
export type EnforcementPoint = "kernel" | "envelope";

export interface AttemptOutcome {
  readonly attemptId: string;
  readonly role: AttemptRole;
  readonly status: ConformanceStatus;
  readonly attempted: boolean;
  readonly observed?: AttemptStatus;
  readonly reasonCode?: string;
  readonly refusedBy?: EnforcementPoint;
  readonly detail?: string;
}

export interface CaseJudgement {
  readonly status: ConformanceStatus;
  readonly attempts: readonly AttemptOutcome[];
  /** Refusal codes observed across the move, sorted and de-duplicated. */
  readonly reasonCodes: readonly string[];
  readonly refusedBy: readonly EnforcementPoint[];
  readonly declared: number;
  readonly attempted: number;
  readonly recordUsable: boolean;
  /** Field paths of the record's required gaps; empty when the record is usable. */
  readonly recordGaps: readonly string[];
  /**
   * Adversarial attempts the column issued on the row's behalf, in declared order.
   *
   * Empty for almost every cell. Where it is not, the pass is still a pass --
   * the kernel refused what it was asked to refuse -- but the asking was the
   * driver's, not the seat occupant's, and a reader comparing columns needs to
   * see that rather than infer it.
   */
  readonly driverIssued: readonly string[];
  readonly detail?: string;
}

export interface CaseEvidence {
  readonly receipts: readonly AttemptReceipt[];
  readonly record: ExecutionRecord;
}

/**
 * The terminal outcome the turn itself must have.
 *
 * Some invariants are about how a turn ends rather than about a call inside it.
 * Authority is resolved once, when the turn is admitted, so a grant store that
 * is unavailable refuses the whole turn: the runtime is never started and no
 * attempt can exist to be denied. Grading such a row from receipts alone would
 * report `not exercised` for the case SharedOS handles most decisively. An
 * escalated turn is the other shape: the runtime did run, its attempts were
 * issued, and the row is about the ending on top of them.
 */
export interface TurnExpectation {
  readonly status: ExecutionRecord["execution"]["status"];
  readonly reasonCode?: string;
}

export interface JudgeCaseOptions {
  /**
   * Set when the row is graded on how the turn ends as well as on its attempts:
   * refused before it runs, or ended by escalation.
   */
  readonly expectTurn?: TurnExpectation;
  /**
   * Attempt ids the runtime under test structurally cannot issue, mapped to why.
   *
   * Declared by the column rather than by the move, because the same attempt is
   * reachable from one runtime and not from another. It is what keeps a row a
   * comparison across columns instead of a penalty for the columns that cannot
   * reach every part of it, and it is only ever a claim about the runtime -- an
   * attempt declared unreachable that a receipt shows was issued is graded on
   * the receipt.
   */
  readonly unreachable?: ReadonlyMap<string, string>;
  /** Attempt ids the column issued on the row's behalf rather than by choice. */
  readonly driverIssued?: ReadonlyMap<string, string>;
}

/**
 * Grade one move against the evidence its turn produced.
 *
 * Grading is deliberately separate from attacking: the runtime records what
 * happened and never decides whether it was correct, so the same receipts can be
 * re-graded without re-running anything.
 */
export function judgeCase(
  move: AttackMove,
  evidence: CaseEvidence,
  options: JudgeCaseOptions = {},
): CaseJudgement {
  const refusalPoints = enforcementPoints(evidence.record);
  const turn = turnOutcome(evidence.record, options.expectTurn);
  // Whether the runtime ever ran is read from the record, not declared. It
  // takes both halves for an attempt to count as structurally unreachable: the
  // condition has to have said the turn would end this way, *and* the record has
  // to show the runtime was never started. Either half alone would let a row
  // that simply produced no receipts report as "not applicable" rather than as
  // the empty evidence it is.
  const runtimeStarted = evidence.record.execution.events.some(
    ({ type }) => type === "turn.started",
  );
  const turnEndedBeforeTheRuntime = turn !== undefined && !runtimeStarted;
  const attempts = move.attempts.map((attempt) => {
    const receipt = evidence.receipts.find((candidate) => candidate.attemptId === attempt.id);
    const columnReason = options.unreachable?.get(attempt.id);
    return outcomeFor(
      attempt.id,
      attempt.role,
      attempt.unreachable !== undefined || columnReason !== undefined || turnEndedBeforeTheRuntime,
      receipt,
      refusalPoints,
      turnEndedBeforeTheRuntime
        ? "the turn was refused before the runtime was started"
        : columnReason,
    );
  });

  const completeness = checkRecordCompleteness(evidence.record);
  const recordGaps = completeness.gaps
    .filter(({ severity }) => severity === "required")
    .map(({ field }) => field);

  const adversarial = attempts.filter(({ role }) => role !== "control");
  const controls = attempts.filter(({ role }) => role === "control");

  const status =
    turn === undefined
      ? caseStatus(move, adversarial, controls, completeness.usable)
      : turnCaseStatus(turn, adversarial, controls, runtimeStarted);
  const detail =
    turn === undefined
      ? statusDetail(status, adversarial, controls, completeness.usable)
      : turnDetail(turn, runtimeStarted);

  return {
    status,
    attempts,
    reasonCodes: [
      ...new Set(
        [...attempts.map(({ reasonCode }) => reasonCode), turn?.reasonCode].filter(
          (code): code is string => code !== undefined,
        ),
      ),
    ].sort(),
    refusedBy: [
      ...new Set(
        [
          ...attempts.map(({ refusedBy }) => refusedBy),
          // Only a refused turn names a boundary. An escalated turn met its
          // expectation without anything refusing it, and reporting the kernel
          // as its enforcement point would credit a refusal that never happened.
          ...(turn?.met === true && turn.observedStatus === "denied" ? (["kernel"] as const) : []),
        ].filter((point): point is EnforcementPoint => point !== undefined),
      ),
    ].sort(),
    declared: attempts.length,
    attempted: attempts.filter(({ attempted }) => attempted).length,
    recordUsable: completeness.usable,
    recordGaps,
    // Only the attempts that were actually issued. A declaration that a driver
    // would have named the step is not evidence that it did, and a cell that
    // claimed the attribution for an attempt nobody made would be describing a
    // call that never happened.
    driverIssued: attempts
      .filter(({ attemptId, attempted }) => attempted && options.driverIssued?.has(attemptId))
      .map(({ attemptId }) => attemptId),
    ...(detail === undefined ? {} : { detail }),
  };
}

interface TurnOutcome {
  readonly met: boolean;
  readonly expected: TurnExpectation;
  readonly observedStatus: ExecutionRecord["execution"]["status"];
  readonly reasonCode: string | undefined;
}

/** Compare the turn's terminal outcome against the condition's expectation. */
function turnOutcome(
  record: ExecutionRecord,
  expected: TurnExpectation | undefined,
): TurnOutcome | undefined {
  if (expected === undefined) {
    return undefined;
  }
  const observedStatus = record.execution.status;
  const reasonCode = record.execution.terminalReasonCode;
  const met =
    observedStatus === expected.status &&
    (expected.reasonCode === undefined || reasonCode === expected.reasonCode);
  return { met, expected, observedStatus, reasonCode };
}

/**
 * Grade a row whose claim is about how the turn ended.
 *
 * When the runtime never started, no control attempt can succeed, so the usual
 * "a denial proves nothing without a working control" rule is satisfied by the
 * record instead: the terminal reason code says which boundary refused it. An
 * attempt that somehow *was* issued and failed its expectation still fails the
 * row -- a refused turn must not have executed anything. When the runtime did
 * start, the row's attempts are graded exactly as any other row's, and the
 * terminal outcome is an additional requirement rather than a replacement.
 */
function turnCaseStatus(
  turn: TurnOutcome,
  adversarial: readonly AttemptOutcome[],
  controls: readonly AttemptOutcome[],
  runtimeStarted: boolean,
): ConformanceStatus {
  if (adversarial.some(({ status }) => status === "fail")) {
    return "fail";
  }
  if (runtimeStarted) {
    if (controls.some(({ status }) => status !== "pass")) {
      return "not_exercised";
    }
    if (adversarial.some(({ status }) => status === "not_exercised")) {
      return "not_exercised";
    }
  }
  return turn.met ? "pass" : "fail";
}

function turnDetail(turn: TurnOutcome, runtimeStarted: boolean): string {
  if (!turn.met) {
    return (
      `the turn ended as \`${turn.observedStatus}\`` +
      `${turn.reasonCode === undefined ? "" : ` with \`${turn.reasonCode}\``}` +
      `, not \`${turn.expected.status}\`` +
      `${turn.expected.reasonCode === undefined ? "" : ` with \`${turn.expected.reasonCode}\``}`
    );
  }
  const ending =
    `the turn itself ended as \`${turn.observedStatus}\`` +
    `${turn.reasonCode === undefined ? "" : ` with \`${turn.reasonCode}\``}`;
  return runtimeStarted ? ending : `${ending}, before the runtime was started`;
}

function caseStatus(
  move: AttackMove,
  adversarial: readonly AttemptOutcome[],
  controls: readonly AttemptOutcome[],
  recordUsable: boolean,
): ConformanceStatus {
  // Asked before the control rule, because a row whose every attack is
  // structurally out of reach asserts nothing, and a claim about reach cannot be
  // invalidated by a control that did not land. Ordered the other way, whether
  // the cell reported "this runtime cannot make the attempt" or "this turn did
  // not make it" would depend on whether an unrelated call succeeded -- which
  // made the same structural fact report differently between two runs of one
  // suite.
  if (adversarial.length > 0 && adversarial.every(({ status }) => status === "not_applicable")) {
    return "not_applicable";
  }
  // The record-completeness row is conjunctive in a way no other row is: it
  // asserts that *one* turn crossing *both* enforcement boundaries still leaves
  // a usable record. Losing any one of its attacks loses a boundary, so the row
  // as declared was not put -- and grading the remainder `pass` would report a
  // single-boundary result under a two-boundary claim. Asked here, beside the
  // rule above and ahead of the control rule, for the same reason: whether the
  // row could be put is a fact about reach, not about how one turn went.
  //
  // Not generalised beyond this row on purpose. Elsewhere an unreachable attempt
  // narrows a row rather than voiding it -- `namespace-crossing` declares three
  // attempts, issues two, and its claim is evidenced by the two that ran.
  if (
    move.kind === "record_completeness" &&
    adversarial.some(({ status }) => status === "not_applicable")
  ) {
    return "not_applicable";
  }
  // A denial only evidences enforcement if the turn could otherwise act. A
  // failed control means the fixture, not the kernel, decided the outcome.
  if (controls.some(({ status }) => status !== "pass")) {
    return "not_exercised";
  }
  if (adversarial.some(({ status }) => status === "fail")) {
    return "fail";
  }
  if (adversarial.some(({ status }) => status === "not_exercised")) {
    return "not_exercised";
  }
  // For every other row the record is reported beside the verdict. For this one
  // the record *is* the claim, so an unusable record is a failure of the row.
  if (move.kind === "record_completeness" && !recordUsable) {
    return "fail";
  }
  return "pass";
}

function statusDetail(
  status: ConformanceStatus,
  adversarial: readonly AttemptOutcome[],
  controls: readonly AttemptOutcome[],
  recordUsable: boolean,
): string | undefined {
  if (status === "not_exercised") {
    const control = controls.find((outcome) => outcome.status !== "pass");
    if (control !== undefined) {
      return `the control attempt ${control.attemptId} did not succeed, so the row proves nothing`;
    }
    const missing = adversarial.find((outcome) => outcome.status === "not_exercised");
    return missing === undefined
      ? undefined
      : `the attempt ${missing.attemptId} never reached SharedOS`;
  }
  if (status === "fail") {
    const failed = adversarial.find((outcome) => outcome.status === "fail");
    if (failed !== undefined) {
      return `the attempt ${failed.attemptId} did not meet its declared outcome`;
    }
    return recordUsable ? undefined : "the turn's execution record is not usable";
  }
  if (status === "not_applicable") {
    // Say which attempt could not be made and why. "Not applicable" with no
    // reason is indistinguishable from a row nobody bothered to run.
    const unreachable = adversarial.find(
      ({ status: attemptStatus, detail }) =>
        attemptStatus === "not_applicable" && detail !== undefined,
    );
    return unreachable === undefined
      ? undefined
      : `the attempt ${unreachable.attemptId} could not be made: ${unreachable.detail}`;
  }
  return undefined;
}

function outcomeFor(
  attemptId: string,
  role: AttemptRole,
  declaredUnreachable: boolean,
  receipt: AttemptReceipt | undefined,
  refusalPoints: ReadonlyMap<string, EnforcementPoint>,
  unreachableDetail?: string,
): AttemptOutcome {
  if (receipt === undefined) {
    return declaredUnreachable
      ? {
          attemptId,
          role,
          status: "not_applicable",
          attempted: false,
          detail: unreachableDetail ?? "the runtime structurally could not make this attempt",
        }
      : {
          attemptId,
          role,
          status: "not_exercised",
          attempted: false,
          detail: "the runtime produced no receipt for this attempt",
        };
  }
  if (!receipt.attempted) {
    // A caller-supplied reason wins over the receipt's own. The receipt can only
    // report that nothing happened; the caller knows why nothing could have.
    const detail = unreachableDetail ?? receipt.detail;
    return {
      attemptId,
      role,
      status: declaredUnreachable ? "not_applicable" : "not_exercised",
      attempted: false,
      ...(detail === undefined ? {} : { detail }),
    };
  }

  const refusedBy =
    receipt.observed === "succeeded" || receipt.callId === undefined
      ? undefined
      : refusalPoints.get(receipt.callId);

  return {
    attemptId,
    role,
    status: satisfiesExpectation(receipt) ? "pass" : "fail",
    attempted: true,
    ...(receipt.observed === undefined ? {} : { observed: receipt.observed }),
    ...(receipt.reasonCode === undefined ? {} : { reasonCode: receipt.reasonCode }),
    ...(refusedBy === undefined ? {} : { refusedBy }),
  };
}

function satisfiesExpectation(receipt: AttemptReceipt): boolean {
  if (receipt.observed === undefined || !receipt.expect.statuses.includes(receipt.observed)) {
    return false;
  }
  const codes = receipt.expect.reasonCodes;
  if (codes === undefined || receipt.observed === "succeeded") {
    return true;
  }
  return receipt.reasonCode !== undefined && codes.includes(receipt.reasonCode);
}

/**
 * Which boundary refused each call.
 *
 * The execution envelope refuses a call for a tool outside the filtered
 * catalogue before the kernel is consulted, so several rows can be satisfied at
 * either point. A cell that hides which one was exercised overstates the
 * kernel's contribution.
 */
function enforcementPoints(record: ExecutionRecord): ReadonlyMap<string, EnforcementPoint> {
  const points = new Map<string, EnforcementPoint>();
  for (const operation of record.execution.operations) {
    if (operation.operationId === undefined || operation.outcome === "succeeded") {
      continue;
    }
    points.set(operation.operationId, operation.source);
  }
  return points;
}
