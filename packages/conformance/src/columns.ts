import type { JsonObject } from "@aicoo/sharedos-contracts";
import {
  claudeCodeFrameWriter,
  claudeCodeProtocol,
  codexFrameWriter,
  codexProtocol,
  HarnessDriver,
  HarnessRuntime,
  TranscriptTransport,
  type HarnessFrame,
  type HarnessFrameWriter,
  type HarnessProtocol,
  type HarnessTranscript,
} from "@aicoo/sharedos-adapters";
import type { RuntimePlugin, RuntimeVisibleContext } from "@aicoo/sharedos-runtime";

import {
  attemptArguments,
  attemptCallId,
  HostileRuntime,
  type AttackAttempt,
  type AttackMove,
  type AttemptReceipt,
} from "./adversary.js";
import type { ExecutionRecord } from "./record.js";
import type { ConformanceCondition } from "./suite.js";
import { conformanceRuntimeContext } from "./world.js";

/** What one column cannot do, so a cell reports it instead of failing on it. */
export interface ColumnLimits {
  /** Set when the column structurally cannot run this row at all. */
  readonly unsupported?: string;
  /** Attempt ids the column structurally cannot issue, mapped to why. */
  readonly unreachable?: ReadonlyMap<string, string>;
}

/** One turn a column ran, for a column that cannot report on itself. */
export interface ColumnTurn {
  readonly executionId: string;
  readonly turn: number;
  readonly record: ExecutionRecord;
}

export interface RuntimeColumnOptions {
  /** Which turn of the case this plugin instance is running. */
  readonly turn: number;
  /** The execution identifier of that turn. */
  readonly executionId: string;
}

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
  create(moves: readonly AttackMove[], options: RuntimeColumnOptions): RuntimePlugin;
  /**
   * Receipts for a turn, when the runtime in the seat cannot report on itself.
   *
   * The scripted adversary emits its own; a vendor harness replaying recorded
   * frames does not know it is in a conformance run, so its attempts are
   * recovered from the execution record instead.
   */
  receipts?(move: AttackMove, turn: ColumnTurn): readonly AttemptReceipt[];
  /** What this column structurally cannot do for one row under one condition. */
  limits?(move: AttackMove, condition: ConformanceCondition): ColumnLimits;
}

/** The in-process column: the SharedOS executor driving the scripted adversary. */
export const EMBEDDED_COLUMN: RuntimeColumn = Object.freeze({
  id: "sharedos-embedded",
  label: "Standard",
  create: (moves: readonly AttackMove[], options: RuntimeColumnOptions) =>
    new HostileRuntime(moves, { turn: options.turn }),
});

/**
 * Attempts a transcript-driven vendor harness cannot issue.
 *
 * Two shapes are out of reach, and both are properties of being a harness
 * rather than of being recorded:
 *
 * - An inspection attempt reads the surfaces the runtime was handed. A harness
 *   speaks tool calls over a wire and never sees a `RuntimeTurnRequest` or a
 *   `RuntimeHost`, so it has nothing to enumerate.
 * - A call past the step budget cannot be made from inside `StandardRuntime`,
 *   which is the loop every harness driver runs in and which stops at its own
 *   step ceiling. The envelope's ceiling is still there; this column simply
 *   never reaches it, and reporting the row as failed would blame the kernel
 *   for a limit the runtime honoured first.
 */
function harnessLimits(move: AttackMove, condition: ConformanceCondition): ColumnLimits {
  const unreachable = new Map<string, string>();

  for (const attempt of move.attempts) {
    if (attempt.inspect !== undefined) {
      unreachable.set(
        attempt.id,
        "a harness speaks tool calls over a wire and is never handed the runtime surfaces to enumerate",
      );
    }
    if (attempt.overBudget === true && condition.world.maxSteps !== undefined) {
      unreachable.set(
        attempt.id,
        "the standard turn loop this harness runs inside stops at its own step ceiling, so the call is never issued",
      );
    }
  }

  return {
    ...(move.terminal === undefined
      ? {}
      : {
          unsupported:
            "no vendor frame means 'ask a human to decide'; escalation is a host decision and a harness has no channel to declare one",
        }),
    ...(unreachable.size === 0 ? {} : { unreachable }),
  };
}

export interface TranscriptColumnOptions {
  readonly id: string;
  readonly label: string;
  readonly protocol: HarnessProtocol;
  readonly writer: HarnessFrameWriter;
}

/**
 * A vendor adapter driven by frames built from the move it is meant to attack.
 *
 * The frames are the vendor's own shapes, the parsing is the adapter's, and the
 * kernel and envelope are the real ones. What is left unexercised is the
 * transport that would have carried the frames: this column says nothing about
 * whether the live CLI is installed, authenticated, or emitting these shapes
 * today. A live column is a separate claim and is not yet made.
 */
export function transcriptColumn(options: TranscriptColumnOptions): RuntimeColumn {
  if (options.protocol.id !== options.writer.protocolId) {
    throw new TypeError(
      `Transcript column ${options.id} pairs protocol ${options.protocol.id} with frames for ${options.writer.protocolId}`,
    );
  }

  return Object.freeze({
    id: options.id,
    label: options.label,
    create: (moves: readonly AttackMove[], create: RuntimeColumnOptions): RuntimePlugin =>
      new HarnessRuntime(
        new HarnessDriver({
          manifest: {
            id: `sharedos.conformance.${options.id}`,
            version: "1.0.0",
            protocolVersion: "1",
            metadata: { transcript: true, protocol: options.protocol.id },
          },
          protocol: options.protocol,
          transport: new TranscriptTransport(
            movesToTranscript(options.writer, moves, {
              executionId: create.executionId,
              turn: create.turn,
              context: conformanceRuntimeContext(create.turn),
            }),
          ),
        }),
      ),
    receipts: (move: AttackMove, turn: ColumnTurn) => receiptsFromRecord(move, turn),
    limits: harnessLimits,
  });
}

export const CODEX_TRANSCRIPT_COLUMN: RuntimeColumn = transcriptColumn({
  id: "codex-transcript",
  label: "Codex",
  protocol: codexProtocol,
  writer: codexFrameWriter,
});

export const CLAUDE_CODE_TRANSCRIPT_COLUMN: RuntimeColumn = transcriptColumn({
  id: "claude-code-transcript",
  label: "Claude Code",
  protocol: claudeCodeProtocol,
  writer: claudeCodeFrameWriter,
});

export interface MoveTranscriptOptions {
  readonly executionId: string;
  readonly turn: number;
  readonly context: RuntimeVisibleContext;
}

/**
 * Turn declared attempts into a recorded conversation.
 *
 * One batch per call, because a harness sends a call and waits for its result
 * before speaking again, and a terminal batch so the turn ends by completing
 * rather than by the recording running out. Attempts the harness cannot issue
 * -- another turn's, a declared-unreachable one, an inspection -- get no frame,
 * so they produce no receipt and are graded as unreached rather than as denied.
 */
export function movesToTranscript(
  writer: HarnessFrameWriter,
  moves: readonly AttackMove[],
  options: MoveTranscriptOptions,
): HarnessTranscript {
  const batches: HarnessFrame[][] = [];

  for (const move of moves) {
    for (const attempt of move.attempts) {
      if (!issuableByHarness(attempt, options.turn)) {
        continue;
      }
      batches.push([
        writer.toolCall(
          attemptCallId(options.executionId, move, attempt),
          attempt.tool as string,
          attemptArguments(options.context, attempt) as JsonObject,
        ),
      ]);
    }
  }

  batches.push([writer.complete({ transcript: options.executionId })]);
  return { batches };
}

function issuableByHarness(attempt: AttackAttempt, turn: number): boolean {
  return (
    (attempt.turn ?? 1) === turn &&
    attempt.unreachable === undefined &&
    attempt.inspect === undefined &&
    attempt.tool !== undefined
  );
}

/**
 * Recover what a turn attempted from its execution record alone.
 *
 * This is the path for a runtime that cannot report on itself. It reads the
 * record rather than anything the runtime said about its own behaviour, which
 * makes it the stricter source: a harness that quietly skipped a call cannot
 * claim it was denied, because there is no operation for it.
 *
 * A call that was refused before the kernel appears here only because the
 * envelope records its refusal code on the `tool.completed` event. Without that
 * the two boundaries would be indistinguishable in a record.
 */
export function receiptsFromRecord(move: AttackMove, turn: ColumnTurn): readonly AttemptReceipt[] {
  const operations = new Map(
    move.attempts.flatMap((attempt) => {
      const callId = attemptCallId(turn.executionId, move, attempt);
      const operation = turn.record.execution.operations.find(
        (candidate) => candidate.operationId === callId,
      );
      return operation === undefined ? [] : [[attempt.id, operation] as const];
    }),
  );

  return move.attempts
    .filter((attempt) => (attempt.turn ?? 1) === turn.turn)
    .map((attempt): AttemptReceipt => {
      const base = {
        moveId: move.id,
        kind: move.kind,
        attemptId: attempt.id,
        role: attempt.role,
        ...(attempt.tool === undefined ? {} : { tool: attempt.tool }),
        ...(attempt.turn === undefined ? {} : { turn: attempt.turn }),
        expect: attempt.expect,
        argumentKeys: Object.keys(attempt.toolArguments ?? {}).sort(),
      };
      const operation = operations.get(attempt.id);
      if (operation === undefined) {
        return {
          ...base,
          attempted: false,
          detail: "the record carries no operation for this attempt",
        };
      }
      return {
        ...base,
        attempted: true,
        callId: attemptCallId(turn.executionId, move, attempt),
        observed: operation.outcome,
        ...(operation.reasonCode === undefined ? {} : { reasonCode: operation.reasonCode }),
      };
    });
}
