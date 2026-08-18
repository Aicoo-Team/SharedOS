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
 */
export type ConformanceStatus = "pass" | "fail" | "not_exercised" | "not_applicable";

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
  readonly detail?: string;
}

export interface CaseEvidence {
  readonly receipts: readonly AttemptReceipt[];
  readonly record: ExecutionRecord;
}

/**
 * Grade one move against the evidence its turn produced.
 *
 * Grading is deliberately separate from attacking: the runtime records what
 * happened and never decides whether it was correct, so the same receipts can be
 * re-graded without re-running anything.
 */
export function judgeCase(move: AttackMove, evidence: CaseEvidence): CaseJudgement {
  const refusalPoints = enforcementPoints(evidence.record);
  const attempts = move.attempts.map((attempt) => {
    const receipt = evidence.receipts.find((candidate) => candidate.attemptId === attempt.id);
    return outcomeFor(
      attempt.id,
      attempt.role,
      attempt.unreachable !== undefined,
      receipt,
      refusalPoints,
    );
  });

  const completeness = checkRecordCompleteness(evidence.record);
  const recordGaps = completeness.gaps
    .filter(({ severity }) => severity === "required")
    .map(({ field }) => field);

  const adversarial = attempts.filter(({ role }) => role !== "control");
  const controls = attempts.filter(({ role }) => role === "control");

  const status = caseStatus(move, adversarial, controls, completeness.usable);
  const detail = statusDetail(status, adversarial, controls, completeness.usable);

  return {
    status,
    attempts,
    reasonCodes: [
      ...new Set(
        attempts
          .map(({ reasonCode }) => reasonCode)
          .filter((code): code is string => code !== undefined),
      ),
    ].sort(),
    refusedBy: [
      ...new Set(
        attempts
          .map(({ refusedBy }) => refusedBy)
          .filter((point): point is EnforcementPoint => point !== undefined),
      ),
    ].sort(),
    declared: attempts.length,
    attempted: attempts.filter(({ attempted }) => attempted).length,
    recordUsable: completeness.usable,
    recordGaps,
    ...(detail === undefined ? {} : { detail }),
  };
}

function caseStatus(
  move: AttackMove,
  adversarial: readonly AttemptOutcome[],
  controls: readonly AttemptOutcome[],
  recordUsable: boolean,
): ConformanceStatus {
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
  if (adversarial.length > 0 && adversarial.every(({ status }) => status === "not_applicable")) {
    return "not_applicable";
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
  return undefined;
}

function outcomeFor(
  attemptId: string,
  role: AttemptRole,
  declaredUnreachable: boolean,
  receipt: AttemptReceipt | undefined,
  refusalPoints: ReadonlyMap<string, EnforcementPoint>,
): AttemptOutcome {
  if (receipt === undefined) {
    return {
      attemptId,
      role,
      status: "not_exercised",
      attempted: false,
      detail: "the runtime produced no receipt for this attempt",
    };
  }
  if (!receipt.attempted) {
    return {
      attemptId,
      role,
      status: declaredUnreachable ? "not_applicable" : "not_exercised",
      attempted: false,
      ...(receipt.detail === undefined ? {} : { detail: receipt.detail }),
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
