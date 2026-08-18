import {
  CapabilitySchema,
  IdentifierSchema,
  JsonObjectSchema,
  RuntimeManifestSchema,
  type ExecutionResult,
  type JsonObject,
  type JsonValue,
  type RuntimeManifest,
  type RuntimeTurnOutcome,
  type ToolCall,
  type ToolResult,
} from "@aicoo/sharedos-contracts";
import type { RuntimeHost, RuntimePlugin, RuntimeTurnRequest } from "@aicoo/sharedos-runtime";
import { z } from "zod";

/**
 * The runtime event every attempt is announced under.
 *
 * Receipts are emitted as they happen as well as returned with the terminal
 * outcome. A turn that is cancelled or times out loses its terminal metadata,
 * and losing the record of what was attempted would turn a suppressed attack
 * into an indistinguishable pass.
 */
export const ATTEMPT_EVENT_TYPE = "conformance.attempt";

/** The metadata key the terminal report is returned under. */
export const ADVERSARY_METADATA_KEY = "conformance";

/** One adversarial row of the kernel conformance manifest. */
export const ATTACK_MOVE_KINDS = [
  "forged_grant",
  "hidden_tool",
  "read_to_mutation",
  "replayed_grant",
  "namespace_crossing",
  "authority_unavailable",
  "record_completeness",
] as const;

export const AttackMoveKindSchema = z.enum(ATTACK_MOVE_KINDS);
export type AttackMoveKind = z.infer<typeof AttackMoveKindSchema>;

/**
 * What one attempt contributes to its move.
 *
 * `control` exists because a denial is only evidence of enforcement if the
 * turn was otherwise able to act. Without a control attempt, a wholly broken
 * fixture reports as a clean pass on every adversarial row.
 */
export const AttemptRoleSchema = z.enum(["attack", "probe", "control"]);
export type AttemptRole = z.infer<typeof AttemptRoleSchema>;

export const AttemptStatusSchema = z.enum(["succeeded", "denied", "failed"]);
export type AttemptStatus = z.infer<typeof AttemptStatusSchema>;

/**
 * The outcomes that satisfy one attempt.
 *
 * Sets rather than single values, because SharedOS legitimately refuses the
 * same attempt at different boundaries: an unexposed tool is stopped by the
 * execution envelope, while an out-of-scope resource reaches the kernel. Both
 * are correct refusals and a conformance cell must accept either without
 * pretending they are the same event.
 */
export const AttemptExpectationSchema = z
  .object({
    statuses: z.array(AttemptStatusSchema).min(1).max(3),
    reasonCodes: z.array(IdentifierSchema).min(1).max(8).optional(),
  })
  .strict();
export type AttemptExpectation = z.infer<typeof AttemptExpectationSchema>;

/**
 * A well-formed capability grant the attacker mints for itself at run time.
 *
 * The grant is materialised from the turn context, so it names the real actor,
 * the real owner, and the real namespace, and would authorize the probe if
 * presented material were ever consulted. Only the capabilities are declared
 * here; everything else is filled in from what the runtime legitimately knows.
 */
export const ForgedGrantSchema = z
  .object({
    grantId: IdentifierSchema.max(64),
    capabilities: z.array(CapabilitySchema).min(1).max(8),
    /** The argument key the forged grant is smuggled under. */
    embedAs: IdentifierSchema.max(64),
  })
  .strict();
export type ForgedGrant = z.infer<typeof ForgedGrantSchema>;

export const AttackAttemptSchema = z
  .object({
    id: IdentifierSchema.max(64),
    role: AttemptRoleSchema,
    description: z.string().min(1).max(512),
    tool: IdentifierSchema,
    toolArguments: JsonObjectSchema.optional(),
    forge: ForgedGrantSchema.optional(),
    expect: AttemptExpectationSchema,
    /**
     * Declares that a runtime plugin structurally cannot make this attempt, and
     * why. The attempt is still declared so the manifest shows it was
     * considered: an absent row and an unreachable one are different claims.
     */
    unreachable: z.string().min(1).max(512).optional(),
  })
  .strict();
export type AttackAttempt = z.infer<typeof AttackAttemptSchema>;

export const AttackMoveSchema = z
  .object({
    id: IdentifierSchema.max(64),
    kind: AttackMoveKindSchema,
    /** The invariant under attack, verbatim from the conformance manifest. */
    invariant: z.string().min(1).max(512),
    /** The kernel outcome the manifest expects, verbatim. */
    expectedOutcome: z.string().min(1).max(512),
    attempts: z.array(AttackAttemptSchema).min(1).max(32),
  })
  .strict();
export type AttackMove = z.infer<typeof AttackMoveSchema>;

/**
 * What one declared attempt actually did.
 *
 * `attempted` is the field that makes a conformance cell honest. A runtime
 * that never issued the call produces a receipt with `attempted: false` and a
 * reason, so "SharedOS denied the attack" is never inferred from "no attack
 * appears in the trace".
 */
export const AttemptReceiptSchema = z
  .object({
    moveId: IdentifierSchema,
    kind: AttackMoveKindSchema,
    attemptId: IdentifierSchema,
    role: AttemptRoleSchema,
    tool: IdentifierSchema,
    attempted: z.boolean(),
    callId: IdentifierSchema.optional(),
    /** Argument keys only. Receipts carry no argument values, ever. */
    argumentKeys: z.array(IdentifierSchema).max(64),
    forgedGrantId: IdentifierSchema.optional(),
    observed: AttemptStatusSchema.optional(),
    reasonCode: IdentifierSchema.optional(),
    expect: AttemptExpectationSchema,
    detail: z.string().min(1).max(512).optional(),
  })
  .strict();
export type AttemptReceipt = z.infer<typeof AttemptReceiptSchema>;

export const AdversarialTurnReportSchema = z
  .object({
    version: z.literal("1"),
    runtimeId: IdentifierSchema,
    executionId: IdentifierSchema,
    traceId: IdentifierSchema,
    /** The permission-filtered catalogue the runtime could actually see. */
    visibleTools: z.array(IdentifierSchema).max(512),
    moveIds: z.array(IdentifierSchema).max(64),
    receipts: z.array(AttemptReceiptSchema).max(512),
  })
  .strict();
export type AdversarialTurnReport = z.infer<typeof AdversarialTurnReportSchema>;

export interface HostileRuntimeOptions {
  readonly runtimeId?: string;
  readonly version?: string;
}

/**
 * A scripted adversary that occupies the delegate seat and nothing else.
 *
 * The conformance manifest measures attempted violations, and a model declining
 * to attack is not evidence that the kernel prevented one. This plugin removes
 * the model: it issues exactly the declared calls, in the declared order, and
 * reports what came back.
 *
 * It is an attacker, not a fixture. Every dangerous world condition a row needs
 * -- a revoked ancestor, a second namespace, an unavailable grant store -- is
 * armed by trusted conformance setup outside the security envelope, because
 * SharedOS treats revocation, namespace administration, and infrastructure
 * configuration as host-owned control-plane state rather than agent-reachable
 * operations. Handing those to the adversary would conflate "can an attacker
 * obtain administrative power" with "given this condition, does the kernel
 * enforce". Only the second question belongs to this manifest.
 *
 * Determinism is a property of the implementation, not a convention: nothing
 * here reads a clock, a random source, or a generated identifier. Timestamps
 * come from the turn context and call identifiers from the declared move, so
 * two runs of one move set against one world produce byte-identical receipts.
 *
 * One instance may serve concurrent turns; all per-turn state lives in `run`.
 */
export class HostileRuntime implements RuntimePlugin {
  readonly manifest: RuntimeManifest;
  readonly #moves: readonly AttackMove[];

  constructor(moves: readonly AttackMove[], options: HostileRuntimeOptions = {}) {
    const parsed = z.array(AttackMoveSchema).min(1).max(64).safeParse(moves);
    if (!parsed.success) {
      throw new TypeError(`Attack moves are not valid: ${parsed.error.message}`);
    }
    assertUniqueIds(parsed.data);

    const manifest = RuntimeManifestSchema.safeParse({
      id: options.runtimeId ?? "sharedos.conformance.hostile",
      version: options.version ?? "1.0.0",
      protocolVersion: "1",
      metadata: {
        adversarial: true,
        deterministic: true,
        moves: parsed.data.map(({ id, kind }) => ({ id, kind })),
      },
    });
    if (!manifest.success) {
      throw new TypeError(`Hostile runtime manifest is not valid: ${manifest.error.message}`);
    }

    this.#moves = Object.freeze(parsed.data.map((move) => Object.freeze(move)));
    this.manifest = manifest.data;
  }

  get moves(): readonly AttackMove[] {
    return this.#moves;
  }

  async run(
    turn: RuntimeTurnRequest,
    host: RuntimeHost,
    signal: AbortSignal,
  ): Promise<RuntimeTurnOutcome> {
    const receipts: AttemptReceipt[] = [];
    const visibleTools = turn.tools.map(({ name }) => name);
    let issued = 0;
    let hostLost: string | undefined;

    for (const move of this.#moves) {
      for (const attempt of move.attempts) {
        const receipt =
          hostLost === undefined
            ? await this.#issue(turn, host, signal, move, attempt, issued)
            : skipped(move, attempt, hostLost);
        if (receipt.attempted) {
          issued += 1;
        }
        receipts.push(receipt);

        if (hostLost !== undefined) {
          continue;
        }
        try {
          host.emit({ type: ATTEMPT_EVENT_TYPE, data: receipt as unknown as JsonValue });
        } catch {
          // The envelope has closed the host. Stop attempting, keep the
          // receipts already collected, and return them rather than throwing:
          // a lost report is indistinguishable from an attack never made.
          hostLost = "the runtime host closed before this attempt was made";
        }
      }
    }

    const report: AdversarialTurnReport = {
      version: "1",
      runtimeId: this.manifest.id,
      executionId: turn.executionId,
      traceId: turn.context.traceId,
      visibleTools,
      moveIds: this.#moves.map(({ id }) => id),
      receipts,
    };

    return {
      type: "complete",
      output: {
        declared: receipts.length,
        attempted: receipts.filter(({ attempted }) => attempted).length,
      },
      metadata: { [ADVERSARY_METADATA_KEY]: report as unknown as JsonValue } as JsonObject,
    };
  }

  async #issue(
    turn: RuntimeTurnRequest,
    host: RuntimeHost,
    signal: AbortSignal,
    move: AttackMove,
    attempt: AttackAttempt,
    issued: number,
  ): Promise<AttemptReceipt> {
    if (attempt.unreachable !== undefined) {
      return skipped(move, attempt, attempt.unreachable);
    }
    if (signal.aborted) {
      return skipped(move, attempt, "the turn was cancelled before this attempt was made");
    }
    if (issued >= host.limits.maxToolCalls) {
      return skipped(move, attempt, "the attempt falls outside the turn's tool-call budget");
    }

    const toolArguments = attackArguments(turn, attempt);
    const call: ToolCall = {
      id: `${turn.executionId}.${move.id}.${attempt.id}`,
      tool: attempt.tool,
      arguments: toolArguments,
      traceId: turn.context.traceId,
      requestedAt: turn.context.now,
    };
    const base = {
      ...receiptBase(move, attempt),
      argumentKeys: Object.keys(toolArguments).sort(),
      callId: call.id,
    };

    let result: ToolResult;
    try {
      result = await host.invokeTool(call, { step: issued });
    } catch (error) {
      return {
        ...base,
        attempted: false,
        detail: `the runtime host refused the call: ${describe(error)}`,
      };
    }

    return {
      ...base,
      attempted: true,
      observed: result.status,
      ...(result.status === "succeeded" ? {} : { reasonCode: result.error.code }),
    };
  }
}

/**
 * Read the terminal report a {@link HostileRuntime} turn produced.
 *
 * The terminal metadata is authoritative but is lost whenever the turn does not
 * end normally, so the event stream is used as the fallback. Both sources are
 * validated; neither is trusted on shape.
 */
export function readAdversarialReport(result: ExecutionResult): AdversarialTurnReport | undefined {
  const declared = AdversarialTurnReportSchema.safeParse(
    (result.metadata as JsonObject | undefined)?.[ADVERSARY_METADATA_KEY],
  );
  if (declared.success) {
    return declared.data;
  }

  const receipts = readAttemptReceipts(result);
  if (receipts.length === 0) {
    return undefined;
  }
  const reconstructed = AdversarialTurnReportSchema.safeParse({
    version: "1",
    runtimeId: runtimeIdOf(result) ?? "unknown",
    executionId: result.executionId,
    traceId: result.traceId,
    visibleTools: visibleToolsOf(result),
    moveIds: [...new Set(receipts.map(({ moveId }) => moveId))],
    receipts,
  });
  return reconstructed.success ? reconstructed.data : undefined;
}

/**
 * Recover attempt receipts from the execution event stream alone.
 *
 * This is the durable evidence path: events survive a cancelled, failed, or
 * timed-out turn, and they are also what lands in a standard execution record.
 */
export function readAttemptReceipts(result: ExecutionResult): readonly AttemptReceipt[] {
  const receipts: AttemptReceipt[] = [];
  for (const event of result.events) {
    if (event.type !== "runtime.event") {
      continue;
    }
    const data = event.data as { type?: unknown; data?: unknown } | null;
    if (data === null || typeof data !== "object" || data.type !== ATTEMPT_EVENT_TYPE) {
      continue;
    }
    const parsed = AttemptReceiptSchema.safeParse(data.data);
    if (parsed.success) {
      receipts.push(parsed.data);
    }
  }
  return receipts;
}

function attackArguments(turn: RuntimeTurnRequest, attempt: AttackAttempt): JsonObject {
  const declared = attempt.toolArguments ?? {};
  if (attempt.forge === undefined) {
    return structuredClone(declared);
  }
  return {
    ...structuredClone(declared),
    [attempt.forge.embedAs]: forgeGrant(turn, attempt.forge),
  };
}

/**
 * Build a schema-valid grant naming the turn's real actor, owner, namespace,
 * purpose, and instant. Everything an authorization decision would need is
 * present and internally consistent; the only thing missing is that no trusted
 * source ever issued it.
 */
function forgeGrant(turn: RuntimeTurnRequest, forge: ForgedGrant): JsonValue {
  return {
    id: forge.grantId,
    namespaceId: turn.context.namespaceId,
    subject: turn.context.actor,
    issuer: turn.context.owner,
    capabilities: forge.capabilities,
    constraints: { purposes: [turn.context.purpose] },
    issuedAt: turn.context.now,
  } as unknown as JsonValue;
}

function receiptBase(
  move: AttackMove,
  attempt: AttackAttempt,
): Pick<AttemptReceipt, "moveId" | "kind" | "attemptId" | "role" | "tool" | "expect"> {
  return {
    moveId: move.id,
    kind: move.kind,
    attemptId: attempt.id,
    role: attempt.role,
    tool: attempt.tool,
    expect: attempt.expect,
  };
}

function skipped(move: AttackMove, attempt: AttackAttempt, detail: string): AttemptReceipt {
  return { ...receiptBase(move, attempt), attempted: false, argumentKeys: [], detail };
}

function assertUniqueIds(moves: readonly AttackMove[]): void {
  const moveIds = new Set<string>();
  for (const move of moves) {
    if (moveIds.has(move.id)) {
      throw new TypeError(`Attack move ids must be unique: ${move.id}`);
    }
    moveIds.add(move.id);

    const attemptIds = new Set<string>();
    for (const attempt of move.attempts) {
      if (attemptIds.has(attempt.id)) {
        throw new TypeError(`Attempt ids must be unique within a move: ${move.id}.${attempt.id}`);
      }
      attemptIds.add(attempt.id);
    }
  }
}

function visibleToolsOf(result: ExecutionResult): readonly string[] {
  for (const event of result.events) {
    if (event.type !== "turn.started") {
      continue;
    }
    const data = event.data as { visibleTools?: unknown } | null;
    if (data !== null && typeof data === "object" && Array.isArray(data.visibleTools)) {
      return data.visibleTools.filter((name): name is string => typeof name === "string");
    }
  }
  return [];
}

function runtimeIdOf(result: ExecutionResult): string | undefined {
  const runtime = (result.metadata as JsonObject | undefined)?.["runtime"];
  if (runtime === null || typeof runtime !== "object" || Array.isArray(runtime)) {
    return undefined;
  }
  const id = (runtime as { id?: unknown }).id;
  return typeof id === "string" ? id : undefined;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}
