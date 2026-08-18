import { ExecutionRecordSchema, type ExecutionRecord } from "./record.js";

export type CompletenessSeverity = "required" | "expected";

export interface CompletenessGap {
  readonly field: string;
  readonly severity: CompletenessSeverity;
  readonly detail: string;
}

export interface RecordCompleteness {
  readonly complete: boolean;
  /** True when nothing required is missing, even if optional evidence is. */
  readonly usable: boolean;
  readonly gaps: readonly CompletenessGap[];
}

/**
 * Report what an execution record is missing, field by field.
 *
 * The kernel conformance manifest asks whether allowed, denied, and escalated
 * turns emit a *complete* execution record. A boolean cannot be acted on, so
 * this names every gap and separates evidence that must be present from
 * evidence that is only expected when the run produced it.
 */
export function checkRecordCompleteness(record: ExecutionRecord): RecordCompleteness {
  const parsed = ExecutionRecordSchema.safeParse(record);
  if (!parsed.success) {
    return {
      complete: false,
      usable: false,
      gaps: parsed.error.issues.map((issue) => ({
        field: issue.path.join("."),
        severity: "required" as const,
        detail: issue.message,
      })),
    };
  }

  const gaps: CompletenessGap[] = [];
  const value = parsed.data;

  if (value.authority.snapshots.length === 0) {
    gaps.push({
      field: "authority.snapshots",
      severity: "required",
      detail:
        "No authority snapshot was observed, so no decision can be tied to the grants behind it.",
    });
  }

  if (value.execution.decisions.length === 0 && value.execution.operations.length > 0) {
    gaps.push({
      field: "execution.decisions",
      severity: "required",
      detail: "Operations were mediated without a recorded authorization decision.",
    });
  }

  for (const [index, decision] of value.execution.decisions.entries()) {
    if (decision.authorityHash === undefined) {
      gaps.push({
        field: `execution.decisions.${index}.authorityHash`,
        severity: "required",
        detail: "A decision does not name the authority state it was made against.",
      });
      continue;
    }
    if (!value.authority.snapshots.some(({ hash }) => hash === decision.authorityHash)) {
      gaps.push({
        field: `execution.decisions.${index}.authorityHash`,
        severity: "required",
        detail: "A decision names an authority state with no recorded snapshot.",
      });
    }
  }

  if (value.execution.events.length === 0) {
    gaps.push({
      field: "execution.events",
      severity: "required",
      detail: "The turn produced no execution events, so its ordering cannot be reconstructed.",
    });
  }

  if (value.state.before === undefined || value.state.after === undefined) {
    gaps.push({
      field: "state",
      severity: "expected",
      detail: "Before and after state references are needed to attribute any world change.",
    });
  }

  if (value.cost.inputTokens === undefined && value.cost.outputTokens === undefined) {
    gaps.push({
      field: "cost.tokens",
      severity: "expected",
      detail: "Token cost is unavailable; deterministic runtimes legitimately report none.",
    });
  }

  if (value.cost.infrastructureMs === undefined) {
    gaps.push({
      field: "cost.infrastructureMs",
      severity: "expected",
      detail: "SharedOS-attributable time was not separated from total elapsed time.",
    });
  }

  return {
    complete: gaps.length === 0,
    usable: !gaps.some(({ severity }) => severity === "required"),
    gaps,
  };
}

/** Fields that must never appear in a record, checked against the whole tree. */
const FORBIDDEN_EVIDENCE_KEYS = ["arguments", "payload", "content", "goldFacts", "verdict"];

export interface RedactionCheck {
  readonly clean: boolean;
  readonly violations: readonly string[];
}

/**
 * Verify that a record carries no private call data or evaluator state.
 *
 * SharedOS audit deliberately excludes tool arguments, tool results, and
 * message payloads. A record is distributed further than an audit sink, so the
 * same rule is re-checked here rather than assumed.
 */
export function checkRecordRedaction(record: ExecutionRecord): RedactionCheck {
  const violations: string[] = [];
  walk(record, "", violations);
  return { clean: violations.length === 0, violations };
}

function walk(value: unknown, path: string, violations: string[]): void {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      walk(item, `${path}.${index}`, violations);
    }
    return;
  }
  if (typeof value !== "object" || value === null) {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    const childPath = path === "" ? key : `${path}.${key}`;
    // A runtime's own terminal output is the turn's answer, not private call data.
    if (FORBIDDEN_EVIDENCE_KEYS.includes(key) && !childPath.startsWith("execution.output")) {
      violations.push(childPath);
    }
    walk(child, childPath, violations);
  }
}
