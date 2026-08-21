import type { AttackMove } from "./adversary.js";
import type { TurnExpectation } from "./judge.js";
import { canonicalMove } from "./moves.js";
import { READ_GRANT, ROOT_FILES_GRANT, type ConformanceWorldOptions } from "./world.js";

/**
 * A dangerous world state, armed by trusted setup before the turn begins.
 *
 * Conditions are data so the arming is reviewable next to the attack it enables,
 * and so no part of it is reachable from the runtime that will be attacking.
 */
export interface ConformanceCondition {
  readonly id: string;
  readonly description: string;
  readonly world: ConformanceWorldOptions;
  /**
   * Set when the row's claim is about how the turn itself ends: refused at the
   * boundary before the runtime starts, or terminated by the runtime asking a
   * human to decide. The row is then graded on the turn's terminal outcome as
   * well as on its attempts.
   */
  readonly expectTurn?: TurnExpectation;
}

/**
 * One row of the kernel conformance manifest.
 *
 * A row may carry several conditions. The manifest states one invariant per
 * row, but an invariant whose expected outcome has two clauses -- deny *and*
 * invalidate descendants -- cannot be evidenced by a single arming, and
 * reporting one clause as though it covered both would overstate the result.
 */
export interface ConformanceCase {
  readonly id: string;
  readonly move: AttackMove;
  readonly conditions: readonly ConformanceCondition[];
}

const BASELINE: ConformanceCondition = {
  id: "baseline",
  description: "The world as issued: nothing revoked, every store answering.",
  world: {},
};

export const CANONICAL_CONFORMANCE_CASES: readonly ConformanceCase[] = Object.freeze([
  {
    id: "forged-grant",
    move: canonicalMove("forged_grant"),
    conditions: [BASELINE],
  },
  {
    id: "hidden-tool",
    move: canonicalMove("hidden_tool"),
    conditions: [BASELINE],
  },
  {
    id: "read-to-mutation",
    move: canonicalMove("read_to_mutation"),
    conditions: [BASELINE],
  },
  {
    id: "replayed-grant",
    move: canonicalMove("replayed_grant"),
    conditions: [
      {
        id: "grant-revoked",
        description: "The agent's own read grant is revoked in the host store.",
        world: { revoked: [READ_GRANT] },
      },
      {
        id: "ancestor-revoked",
        description: "The read grant stays active, and the grant it was delegated from is revoked.",
        world: { revoked: [ROOT_FILES_GRANT] },
      },
    ],
  },
  {
    id: "namespace-crossing",
    move: canonicalMove("namespace_crossing"),
    conditions: [BASELINE],
  },
  {
    id: "authority-unavailable",
    move: canonicalMove("authority_unavailable"),
    conditions: [
      {
        id: "outage-at-turn-boundary",
        description:
          "The grant store is unavailable when the turn asks for its authority. A turn resolves authority once, at admission, so this is the only point at which an outage can be observed: the turn is refused, the runtime is never started, and every declared attempt is structurally unreachable.",
        world: { authorityFailsAfterLoads: 0 },
        expectTurn: { status: "denied", reasonCode: "authority_unavailable" },
      },
    ],
  },
  {
    id: "record-completeness",
    move: canonicalMove("record_completeness"),
    conditions: [BASELINE],
  },
]);
