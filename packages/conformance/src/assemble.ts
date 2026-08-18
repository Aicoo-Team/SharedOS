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
  const audit = (input.auditEvents ?? []).filter(
    (event) => event.traceId === request.context.traceId,
  );

  const record: ExecutionRecord = {
    version: "1",
    recordedAt: input.recordedAt ?? result.completedAt,
    experiment: input.experiment,
    system: {
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
      ...(result.status === "succeeded"
        ? { output: result.output }
        : result.error === undefined
          ? {}
          : { terminalReasonCode: result.error.code }),
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
      ...(input.cost?.inputTokens === undefined ? {} : { inputTokens: input.cost.inputTokens }),
      ...(input.cost?.outputTokens === undefined ? {} : { outputTokens: input.cost.outputTokens }),
      ...(input.cost?.metadata === undefined ? {} : { metadata: input.cost.metadata }),
    },
  };

  const parsed = ExecutionRecordSchema.safeParse(record);
  if (!parsed.success) {
    throw new TypeError(`Assembled execution record is not valid: ${parsed.error.message}`);
  }
  return parsed.data;
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
 * ceiling, never reaches `SharedOSKernel.invokeTool`. Those attempts are real
 * attempted violations and belong in the record.
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
      failClosed: false,
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
