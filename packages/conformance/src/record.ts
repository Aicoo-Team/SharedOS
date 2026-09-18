import {
  AddressSchema,
  EscalationSchema,
  ExecutionEventSchema,
  IdentifierSchema,
  JsonObjectSchema,
  JsonValueSchema,
  ProtocolVersionSchema,
  ResourceRefSchema,
  RuntimeManifestSchema,
  TimestampSchema,
  ToolPolicySchema,
} from "@aicoo/sharedos-contracts";
import { z } from "zod";

/** A SHA-256 content identifier, lowercase hex. */
export const ContentHashSchema = z.string().regex(/^[0-9a-f]{64}$/u);
export type ContentHash = z.infer<typeof ContentHashSchema>;

/**
 * What this run was an instance of.
 *
 * `specHash` covers the declarative seed and `worldHash` the state that seed
 * materialised. They are separate because world reproducibility and
 * model-output reproducibility are different claims: two runs of one spec must
 * produce one `worldHash` before their agent results are comparable at all.
 */
export const ExperimentIdentitySchema = z
  .object({
    experimentId: IdentifierSchema,
    taskId: IdentifierSchema,
    runId: IdentifierSchema,
    /** Hash of the frozen experiment specification, before materialisation. */
    specHash: ContentHashSchema,
    /** Hash of the world the specification materialised. */
    worldHash: ContentHashSchema,
    /** Hash of the evaluator that will score this run. */
    evaluatorHash: ContentHashSchema,
    seed: z.union([z.string(), z.number().int()]).optional(),
    metadata: JsonObjectSchema.optional(),
  })
  .strict();
export type ExperimentIdentity = z.infer<typeof ExperimentIdentitySchema>;

/** Everything that must match before two runs are comparable. */
export const SystemIdentitySchema = z
  .object({
    protocolVersion: ProtocolVersionSchema,
    sharedOsVersion: IdentifierSchema,
    runtime: RuntimeManifestSchema,
    /** Adapter identity, for example `sharedos-embedded` or `sharedos-http`. */
    adapterId: IdentifierSchema,
    adapterVersion: IdentifierSchema.optional(),
    model: IdentifierSchema.optional(),
    modelProvider: IdentifierSchema.optional(),
    /** Hash of the policy or configuration in force for this run. */
    policyHash: ContentHashSchema,
    /**
     * Hash of the effective, model-facing tool catalogue this turn was served.
     *
     * Present whenever the catalogue crossed a published boundary, which is what
     * makes cross-harness comparison a check rather than an assumption: two
     * columns whose `catalogHash` differs were not given the same tool set, and
     * comparing their refusal behaviour says nothing until that is fixed. It
     * also catches the quiet failures -- schema drift, a missing tool, a
     * rewritten name, a stale discovery cache -- that otherwise look like a
     * harness behaving differently.
     */
    catalogHash: ContentHashSchema.optional(),
    toolCount: z.number().int().nonnegative().optional(),
    /**
     * Hash of what the runtime told the seat before the turn: its instructions
     * and its prompt, as `{instructions, prompt}` in canonical JSON.
     *
     * Present when the runtime handed the seat text and said so, which both
     * shipped runtimes do: the model driver over its system message and
     * prompt, the MCP harness runtime over its initialize instructions and the
     * prompt the CLI was launched with. The same words carry the same hash
     * whichever said them. A reworded prompt is a different question, so two
     * runs of one column are comparable on the model's choices only while this
     * matches as well as `catalogHash`; a cell that moved under a changed
     * prompt is not the model changing its mind. It covers what SharedOS said
     * and not what a harness added of its own, which SharedOS never sees.
     */
    promptHash: ContentHashSchema.optional(),
    /**
     * The declared tool surface, so a result can be read for what it is.
     *
     * "The kernel refused every violation" means one thing when the managed
     * catalogue was the only way to have an effect and almost nothing when the
     * harness also had a shell.
     */
    toolPolicy: ToolPolicySchema.optional(),
    metadata: JsonObjectSchema.optional(),
  })
  .strict();
export type SystemIdentity = z.infer<typeof SystemIdentitySchema>;

/**
 * One authority state observed during the turn.
 *
 * A turn resolves authority once, when it is admitted, so a turn normally
 * records exactly one and `stableAuthorityHash` is always set. This stays a list
 * because a host may make kernel calls outside any turn, and because restoring
 * `MID_TURN_AUTHORITY_REFRESH` must not change the shape of the evidence.
 */
export const AuthoritySnapshotRecordSchema = z
  .object({
    hash: ContentHashSchema,
    grantIds: z.array(IdentifierSchema).max(256),
    grantCount: z.number().int().nonnegative(),
    firstSeenAt: TimestampSchema,
    lastSeenAt: TimestampSchema,
    observations: z.number().int().positive(),
  })
  .strict();
export type AuthoritySnapshotRecord = z.infer<typeof AuthoritySnapshotRecordSchema>;

export const AuthorityRecordSchema = z
  .object({
    principal: AddressSchema,
    actor: AddressSchema,
    owner: AddressSchema,
    namespaceId: IdentifierSchema,
    purpose: z.string().min(1).max(512),
    /** Every distinct authority state the turn observed, in first-seen order. */
    snapshots: z.array(AuthoritySnapshotRecordSchema).max(256),
    /** Set only when one authority state covered the whole turn. */
    stableAuthorityHash: ContentHashSchema.optional(),
  })
  .strict();
export type AuthorityRecord = z.infer<typeof AuthorityRecordSchema>;

/** One authorization decision, with the authority state it was made against. */
export const DecisionRecordSchema = z
  .object({
    at: TimestampSchema,
    outcome: z.enum(["allowed", "denied"]),
    reasonCode: IdentifierSchema,
    resource: ResourceRefSchema.optional(),
    action: IdentifierSchema.optional(),
    grantId: IdentifierSchema.optional(),
    authorityHash: ContentHashSchema.optional(),
    /**
     * True when SharedOS could not establish a fact rather than deciding a
     * policy question. These must be excluded before computing denial rates.
     */
    failClosed: z.boolean(),
  })
  .strict();
export type DecisionRecord = z.infer<typeof DecisionRecordSchema>;

/**
 * A mediated operation and its outcome. No arguments, results, or payloads.
 *
 * `source` matters for counting attempted violations. The execution envelope
 * refuses a call for a tool outside the permission-filtered catalog before the
 * kernel is consulted, so that attempt exists only in the execution event
 * stream. A record that read audit alone would under-report it.
 */
export const OperationRecordSchema = z
  .object({
    at: TimestampSchema,
    kind: z.enum(["tool", "resource", "message"]),
    source: z.enum(["kernel", "envelope"]),
    outcome: z.enum(["succeeded", "denied", "failed"]),
    operationId: IdentifierSchema.optional(),
    tool: IdentifierSchema.optional(),
    resource: ResourceRefSchema.optional(),
    action: IdentifierSchema.optional(),
    grantId: IdentifierSchema.optional(),
    reasonCode: IdentifierSchema.optional(),
    failClosed: z.boolean(),
  })
  .strict();
export type OperationRecord = z.infer<typeof OperationRecordSchema>;

/** What a delegate states when it recognises the escalation affordance. */
export const EscalationAskedSchema = z
  .object({ tool: IdentifierSchema, reason: z.string().max(512) })
  .strict();
export type EscalationAsked = z.infer<typeof EscalationAskedSchema>;

export const ExecutionRecordExecutionSchema = z
  .object({
    executionId: IdentifierSchema,
    traceId: IdentifierSchema,
    agent: AddressSchema,
    status: z.enum(["succeeded", "denied", "failed", "cancelled", "escalated"]),
    terminalReasonCode: IdentifierSchema.optional(),
    output: JsonValueSchema.optional(),
    /**
     * Set when the turn stopped and asked a human to decide. Carried in the
     * record as well as in audit, because a record is what leaves the host and
     * an escalation that only exists in the audit stream cannot be counted by
     * whoever is comparing runs.
     */
    escalation: EscalationSchema.optional(),
    /**
     * That the delegate asked for a human, in its own words, if it said so.
     *
     * Distinct from `escalation`, which the envelope sets when it honoured an
     * ask. This is the delegate's claim that it made one, stated through
     * `RuntimeHost.annotate` the moment the affordance was recognised and
     * lifted here from the turn's result, because a record carries none of the
     * result's metadata and the grading rules read a record. It is present on
     * a turn that asked and then ended some other way, which is the case it
     * exists to show. It can only make a row grade harder: a pass still needs
     * the turn to have ended `escalated`.
     */
    escalationAsked: EscalationAskedSchema.optional(),
    /**
     * Calls the seat went on to make after it asked for a human, on a path
     * where it could: a vendor CLI owns its loop, so its ask cannot stop it.
     *
     * Each was answered `escalation_pending` by the runtime and reached neither
     * the envelope nor the kernel, so none of them is an operation below and
     * this count is the only place "the harness kept going after it asked" can
     * be read (ADR 0018). Lifted from the result's metadata beside
     * `escalationAsked`. Reported, never graded: a driven seat's turn ends at
     * its ask, so it states none.
     */
    callsAfterEscalation: z.number().int().nonnegative().optional(),
    /** Tools the permission filter actually exposed to the runtime. */
    exposedTools: z.array(IdentifierSchema).max(512),
    requestedTools: z.array(IdentifierSchema).max(512),
    decisions: z.array(DecisionRecordSchema).max(4_096),
    operations: z.array(OperationRecordSchema).max(4_096),
    events: z.array(ExecutionEventSchema).max(8_192),
    /** Where the full audit stream lives; SharedOS does not own audit storage. */
    auditRef: z
      .object({
        sink: IdentifierSchema,
        traceId: IdentifierSchema,
        eventCount: z.number().int().nonnegative(),
      })
      .strict()
      .optional(),
  })
  .strict();
export type ExecutionRecordExecution = z.infer<typeof ExecutionRecordExecutionSchema>;

/**
 * References to world state, by identifier and hash only.
 *
 * SharedOS does not capture snapshots or define a diff format: what a world is,
 * and what changed inside it, belong to the experiment layer that seeded it.
 */
export const StateReferenceSchema = z
  .object({
    snapshotId: IdentifierSchema,
    hash: ContentHashSchema,
    capturedAt: TimestampSchema.optional(),
  })
  .strict();
export type StateReference = z.infer<typeof StateReferenceSchema>;

export const StateRecordSchema = z
  .object({
    before: StateReferenceSchema.optional(),
    after: StateReferenceSchema.optional(),
    /** An opaque handle to a diff the experiment layer produced. */
    diffRef: z
      .object({ diffId: IdentifierSchema, hash: ContentHashSchema.optional() })
      .strict()
      .optional(),
  })
  .strict();
export type StateRecord = z.infer<typeof StateRecordSchema>;

export const CostRecordSchema = z
  .object({
    startedAt: TimestampSchema,
    completedAt: TimestampSchema,
    elapsedMs: z.number().nonnegative(),
    /** SharedOS-attributable time, separated from model inference time. */
    infrastructureMs: z.number().nonnegative().optional(),
    toolCalls: z.number().int().nonnegative(),
    authorityLoads: z.number().int().nonnegative(),
    auditEvents: z.number().int().nonnegative(),
    inputTokens: z.number().int().nonnegative().optional(),
    outputTokens: z.number().int().nonnegative().optional(),
    metadata: JsonObjectSchema.optional(),
  })
  .strict();
export type CostRecord = z.infer<typeof CostRecordSchema>;

/**
 * The comparable unit of evidence for one SharedOS turn.
 *
 * SharedOS contributes system identity, authority, execution, and cost. The
 * experiment layer contributes experiment identity and state references. The
 * record deliberately holds no gold labels, evaluator verdicts, or scores:
 * SharedOS states what happened, and never whether it was correct.
 */
export const ExecutionRecordSchema = z
  .object({
    version: z.literal("1"),
    recordedAt: TimestampSchema,
    experiment: ExperimentIdentitySchema,
    system: SystemIdentitySchema,
    authority: AuthorityRecordSchema,
    execution: ExecutionRecordExecutionSchema,
    state: StateRecordSchema,
    cost: CostRecordSchema,
  })
  .strict();
export type ExecutionRecord = z.infer<typeof ExecutionRecordSchema>;

/** What one call left in the record; see {@link operationsUnder}. */
export interface CallOperations {
  /**
   * The `tool` operation under the call's id: what the caller was told.
   * Absent when the record shows no such call.
   */
  readonly attempt: OperationRecord | undefined;
  /**
   * The code a refused sibling operation carried under the same id, where
   * one did. Never present without an attempt to be the cause of.
   */
  readonly cause: string | undefined;
}

/**
 * Read what one call left in the record, by its id.
 *
 * Several operations can share a call's id. The kernel records a
 * `message.sent` for the dispatch a `messages.request` makes, and when the
 * transport refuses it that operation carries the transport's code while the
 * tool operation carries `message_request_not_accepted`, the code the caller
 * was told -- the same pairing `docs/errors.md` describes for
 * `message_delivery_failed`. The tool operation is the attempt; the sibling's
 * code is its cause, joined by id so a reader can say both what SharedOS said
 * and why without the two competing for one field.
 *
 * An id with no tool operation left no attempt, and so no cause either: a
 * `message` operation alone is a dispatch the record shows, not a call the
 * caller made, and handing it back as the attempt would grade the call on the
 * transport's code. Taking the first operation under the id, whatever its
 * kind, once made the scripted columns' reason code depend on audit order.
 * Every reader of a call's operations goes through here so that rule is
 * stated once.
 */
export function operationsUnder(record: ExecutionRecord, callId: string): CallOperations {
  const under = record.execution.operations.filter(({ operationId }) => operationId === callId);
  const attempt = under.find(({ kind }) => kind === "tool");
  const cause =
    attempt === undefined
      ? undefined
      : under.find(
          (operation) =>
            operation.kind !== "tool" &&
            operation.outcome !== "succeeded" &&
            operation.reasonCode !== undefined,
        )?.reasonCode;
  return { attempt, cause };
}
