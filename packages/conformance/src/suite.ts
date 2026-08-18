import type { AttackMove } from "./adversary.js";
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
        id: "outage-mid-turn",
        description:
          "The grant store answers turn admission, tool discovery, and one call, then stops. An outage that begins before the turn denies admission, so the runtime never attempts anything.",
        world: { authorityFailsAfterLoads: 3 },
      },
    ],
  },
  {
    id: "record-completeness",
    move: canonicalMove("record_completeness"),
    conditions: [BASELINE],
  },
]);
