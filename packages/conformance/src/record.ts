import {
  AddressSchema,
  ExecutionEventSchema,
  IdentifierSchema,
  JsonObjectSchema,
  JsonValueSchema,
  ProtocolVersionSchema,
  ResourceRefSchema,
  RuntimeManifestSchema,
  TimestampSchema,
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
    metadata: JsonObjectSchema.optional(),
  })
  .strict();
export type SystemIdentity = z.infer<typeof SystemIdentitySchema>;

/**
 * One authority state observed during the turn.
 *
 * A turn can span several: SharedOS re-loads authority per kernel operation, so
 * a grant revoked mid-turn produces a second snapshot rather than silently
 * changing the first.
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

export const ExecutionRecordExecutionSchema = z
  .object({
    executionId: IdentifierSchema,
    traceId: IdentifierSchema,
    agent: AddressSchema,
    status: z.enum(["succeeded", "denied", "failed", "cancelled"]),
    terminalReasonCode: IdentifierSchema.optional(),
    output: JsonValueSchema.optional(),
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
