import type {
  ExecutionEvent,
  ExecutionRequest,
  ExecutionResult,
  JsonObject,
  RuntimeManifest,
} from "@aicoo/sharedos-contracts";
import { RuntimeManifestSchema } from "@aicoo/sharedos-contracts";
import { type AuditEvent, isInfrastructureDenial } from "@aicoo/sharedos-core";

import {
  type AuthoritySnapshotRecord,
  type ContentHash,
  type DecisionRecord,
  type ExecutionRecord,
  type ExecutionRecordExecution,
  ExecutionRecordSchema,
  type ExperimentIdentity,
  type OperationRecord,
  type StateRecord,
  type SystemIdentity,
} from "./record.js";

/** Identity the experiment layer owns; SharedOS cannot derive any of it. */
export interface ExecutionRecordSystemInput extends Omit<SystemIdentity, "runtime"> {
  /** Overrides the manifest carried in the result's runtime provenance. */
  readonly runtime?: RuntimeManifest;
}

export interface ExecutionRecordCostInput {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly infrastructureMs?: number;
  readonly metadata?: JsonObject;
}

export interface AssembleExecutionRecordInput {
  readonly request: ExecutionRequest;
  readonly result: ExecutionResult;
  /** Audit events for this turn. Events from other traces are ignored. */
  readonly auditEvents?: readonly AuditEvent[];
  readonly experiment: ExperimentIdentity;
  readonly system: ExecutionRecordSystemInput;
  readonly state?: StateRecord;
  readonly cost?: ExecutionRecordCostInput;
  readonly auditRef?: { sink: string; traceId: string; eventCount: number };
  readonly recordedAt?: string;
}

/**
 * Build one comparable execution record from SharedOS evidence.
 *
 * SharedOS evidence is used as-is: nothing here re-derives an authorization
 * outcome, and nothing here judges whether the turn was correct. Fields the
 * kernel cannot know (experiment identity, state references, token cost) come
 * from the caller.
 */
export function assembleExecutionRecord(input: AssembleExecutionRecordInput): ExecutionRecord {
  const { request, result } = input;
  const reported = reportedTokens(result);
  const tokens = {
    inputTokens: input.cost?.inputTokens ?? reported.inputTokens,
    outputTokens: input.cost?.outputTokens ?? reported.outputTokens,
  };
  const audit = (input.auditEvents ?? []).filter(
    (event) => event.traceId === request.context.traceId,
  );

  const record: ExecutionRecord = {
    version: "1",
    recordedAt: input.recordedAt ?? result.completedAt,
    experiment: input.experiment,
    system: {
      ...publishedCatalogue(result),
      ...declaredModel(result),
      ...input.system,
      runtime: input.system.runtime ?? runtimeManifestOf(result),
    },
    authority: {
      principal: request.context.authority,
      actor: request.context.actor,
      owner: request.context.owner,
      namespaceId: request.context.namespaceId,
      purpose: request.context.purpose,
      snapshots: authoritySnapshots(audit),
      ...stableAuthorityHash(audit),
    },
    execution: {
      executionId: result.executionId,
      traceId: result.traceId,
      agent: request.agent,
      status: result.status,
      ...terminalOutcome(result),
      exposedTools: exposedTools(result.events),
      requestedTools: request.tools.map(({ name }) => name),
      decisions: decisions(audit),
      operations: operations(audit, result.events),
      events: [...result.events],
      ...(input.auditRef === undefined ? {} : { auditRef: input.auditRef }),
    },
    state: input.state ?? {},
    cost: {
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      elapsedMs: elapsedMs(result.startedAt, result.completedAt),
      toolCalls: result.events.filter(({ type }) => type === "tool.requested").length,
      authorityLoads: audit.filter(({ type }) => type === "authority.resolved").length,
      auditEvents: audit.length,
      ...(input.cost?.infrastructureMs === undefined
        ? {}
        : { infrastructureMs: input.cost.infrastructureMs }),
      ...(tokens.inputTokens === undefined ? {} : { inputTokens: tokens.inputTokens }),
      ...(tokens.outputTokens === undefined ? {} : { outputTokens: tokens.outputTokens }),
      ...(input.cost?.metadata === undefined ? {} : { metadata: input.cost.metadata }),
    },
  };

  const parsed = ExecutionRecordSchema.safeParse(record);
  if (!parsed.success) {
    throw new TypeError(`Assembled execution record is not valid: ${parsed.error.message}`);
  }
  return parsed.data;
}

/**
 * What the turn ended as, in the record's own vocabulary.
 *
 * An escalated turn has no protocol error, because nothing refused it: it
 * stopped and asked. It is given a terminal reason code anyway so a row can be
 * graded on it like any other terminal outcome, and the escalation stub is
 * carried through so the record names the reviewer as well as the fact.
 */
function terminalOutcome(result: ExecutionResult): Partial<ExecutionRecordExecution> {
  switch (result.status) {
    case "succeeded":
      return { output: result.output };
    case "escalated":
      return { terminalReasonCode: "escalation_requested", escalation: result.escalation };
    default:
      return result.error === undefined ? {} : { terminalReasonCode: result.error.code };
  }
}

/**
 * The catalogue identity a published boundary left behind, if there was one.
 *
 * Read from the turn's own result rather than asked of the caller, because the
 * caller is the experiment layer and this is a SharedOS fact. A turn whose
 * runtime never published a catalogue -- the embedded column, a transcript
 * column -- contributes nothing here, and the fields stay absent rather than
 * being filled with a hash over a catalogue no harness was ever served.
 *
 * The caller's own `system` still wins: a host that knows better about its own
 * run is not overridden by an inference from metadata.
 */
function publishedCatalogue(result: ExecutionResult): Partial<SystemIdentity> {
  const catalogHash = result.metadata?.["catalogHash"];
  if (typeof catalogHash !== "string" || !/^[0-9a-f]{64}$/u.test(catalogHash)) {
    return {};
  }
  return { catalogHash, toolCount: exposedTools(result.events).length };
}

/**
 * The model the runtime reported having launched with.
 *
 * Read from the turn's own result rather than from the run's configuration,
 * because those are different claims. A provider that silently substitutes an
 * unrecognised model name -- DeepSeek maps one to `deepseek-v4-flash` rather
 * than rejecting it -- would leave a configuration saying one thing and a run
 * having done another. This records what the harness was actually pointed at,
 * which is the weaker of the two claims and the honest one.
 *
 * The caller's own `system` still wins over it.
 */
function declaredModel(result: ExecutionResult): Partial<SystemIdentity> {
  const model = result.metadata?.["model"];
  const provider = result.metadata?.["modelProvider"];
  return {
    ...(typeof model === "string" ? { model } : {}),
    ...(typeof provider === "string" ? { modelProvider: provider } : {}),
  };
}

/**
 * The token cost the runtime itself reported, if it did.
 *
 * A model driver sums what the provider billed for each call onto the turn's
 * outcome, and nothing else in the record can know it: the kernel sees calls,
 * not tokens. Read under the same rule as the model and the catalogue -- a
 * SharedOS fact the turn left behind, taken unless the caller's own `cost`
 * says otherwise. A runtime that reported none leaves the fields absent, which
 * `checkRecordCompleteness` names as a gap rather than reading as zero.
 */
function reportedTokens(result: ExecutionResult): ExecutionRecordCostInput {
  const input = result.metadata?.["inputTokens"];
  const output = result.metadata?.["outputTokens"];
  return {
    ...(isTokenCount(input) ? { inputTokens: input } : {}),
    ...(isTokenCount(output) ? { outputTokens: output } : {}),
  };
}

function isTokenCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function runtimeManifestOf(result: ExecutionResult): RuntimeManifest {
  const parsed = RuntimeManifestSchema.safeParse(result.metadata?.["runtime"]);
  if (!parsed.success) {
    throw new TypeError(
      "ExecutionResult carries no runtime provenance; pass system.runtime explicitly",
    );
  }
  return parsed.data;
}

function exposedTools(events: readonly ExecutionEvent[]): string[] {
  const started = events.find(({ type }) => type === "turn.started");
  const visible = isJsonObject(started?.data) ? started.data["visibleTools"] : undefined;
  return Array.isArray(visible)
    ? visible.filter((name): name is string => typeof name === "string")
    : [];
}

function authoritySnapshots(audit: readonly AuditEvent[]): AuthoritySnapshotRecord[] {
  const byHash = new Map<string, AuthoritySnapshotRecord>();

  for (const event of audit) {
    if (event.type !== "authority.resolved" || event.authorityHash === undefined) {
      continue;
    }

    const existing = byHash.get(event.authorityHash);
    if (existing === undefined) {
      byHash.set(event.authorityHash, {
        hash: event.authorityHash,
        grantIds: stringArray(event.metadata?.["grantIds"]),
        grantCount:
          typeof event.metadata?.["grantCount"] === "number" ? event.metadata["grantCount"] : 0,
        firstSeenAt: event.at,
        lastSeenAt: event.at,
        observations: 1,
      });
      continue;
    }

    byHash.set(event.authorityHash, {
      ...existing,
      lastSeenAt: event.at,
      observations: existing.observations + 1,
    });
  }

  return [...byHash.values()];
}

function stableAuthorityHash(
  audit: readonly AuditEvent[],
): { stableAuthorityHash: ContentHash } | Record<string, never> {
  const snapshots = authoritySnapshots(audit);
  const only = snapshots[0];
  return snapshots.length === 1 && only !== undefined ? { stableAuthorityHash: only.hash } : {};
}

function decisions(audit: readonly AuditEvent[]): DecisionRecord[] {
  return audit
    .filter((event) => event.type === "authorization.checked")
    .map((event) => ({
      at: event.at,
      outcome: event.outcome === "allowed" ? ("allowed" as const) : ("denied" as const),
      reasonCode: event.reason ?? (event.outcome === "allowed" ? "allowed" : "denied"),
      ...(event.resource === undefined ? {} : { resource: event.resource }),
      ...(event.action === undefined ? {} : { action: event.action }),
      ...(event.grantId === undefined ? {} : { grantId: event.grantId }),
      ...(event.authorityHash === undefined ? {} : { authorityHash: event.authorityHash }),
      failClosed: event.reason !== undefined && isInfrastructureDenial(event.reason),
    }));
}

const OPERATION_KINDS: Readonly<Record<string, OperationRecord["kind"]>> = {
  "tool.invoked": "tool",
  "resource.invoked": "resource",
  "message.sent": "message",
};

function operations(
  audit: readonly AuditEvent[],
  events: readonly ExecutionEvent[],
): OperationRecord[] {
  const records: OperationRecord[] = [];

  for (const event of audit) {
    const kind = OPERATION_KINDS[event.type];
    if (kind === undefined) {
      continue;
    }

    records.push({
      at: event.at,
      kind,
      source: "kernel",
      outcome:
        event.outcome === "succeeded"
          ? "succeeded"
          : event.outcome === "failed"
            ? "failed"
            : "denied",
      ...(event.operationId === undefined ? {} : { operationId: event.operationId }),
      ...(event.tool === undefined ? {} : { tool: event.tool }),
      ...(event.resource === undefined ? {} : { resource: event.resource }),
      ...(event.action === undefined ? {} : { action: event.action }),
      ...(event.grantId === undefined ? {} : { grantId: event.grantId }),
      ...(event.reason === undefined ? {} : { reasonCode: event.reason }),
      failClosed: event.reason !== undefined && isInfrastructureDenial(event.reason),
    });
  }

  records.push(...envelopeOperations(records, events));
  return records.sort((left, right) => Date.parse(left.at) - Date.parse(right.at));
}

/**
 * Tool calls the envelope terminated before the kernel saw them.
 *
 * A runtime that guesses an unexposed tool name, or exceeds the hard tool-call
 * or step ceiling, never reaches `SharedOSKernel.invokeTool`. Those attempts are
 * real attempted violations and belong in the record.
 *
 * The refusal code comes from the `tool.completed` event, which is the only
 * record of a call audit never saw. It is read rather than inferred so the
 * record itself separates a guessed tool from a blown budget, without depending
 * on the runtime to report honestly about its own refusals.
 */
function envelopeOperations(
  mediated: readonly OperationRecord[],
  events: readonly ExecutionEvent[],
): OperationRecord[] {
  const mediatedCallIds = new Set(
    mediated.filter(({ kind }) => kind === "tool").map(({ operationId }) => operationId),
  );
  const records: OperationRecord[] = [];

  for (const event of events) {
    if (event.type !== "tool.completed" || !isJsonObject(event.data)) {
      continue;
    }

    const callId = event.data["callId"];
    const tool = event.data["tool"];
    const status = event.data["status"];
    const code = event.data["code"];
    if (typeof callId !== "string" || mediatedCallIds.has(callId) || status === "succeeded") {
      continue;
    }

    records.push({
      at: event.occurredAt,
      kind: "tool",
      source: "envelope",
      outcome: status === "failed" ? "failed" : "denied",
      operationId: callId,
      ...(typeof tool === "string" ? { tool } : {}),
      ...(typeof code === "string" ? { reasonCode: code } : {}),
      failClosed: typeof code === "string" && isInfrastructureDenial(code),
    });
  }

  return records;
}

function elapsedMs(startedAt: string, completedAt: string): number {
  const started = Date.parse(startedAt);
  const completed = Date.parse(completedAt);
  return Number.isFinite(started) && Number.isFinite(completed)
    ? Math.max(0, completed - started)
    : 0;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
