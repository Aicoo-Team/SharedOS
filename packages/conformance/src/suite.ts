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
 * invalidate descendants, a tool-call ceiling *and* a step ceiling -- cannot be
 * evidenced by a single arming, and reporting one clause as though it covered
 * both would overstate the result.
 */
export interface ConformanceCase {
  readonly id: string;
  readonly move: AttackMove;
  readonly conditions: readonly ConformanceCondition[];
  /**
   * Why this row is declared but not built.
   *
   * Set on a row SharedOS does not implement. The row is reported, never run,
   * and never a pass. Omitting it instead would make the matrix describe a
   * narrower system as a more conformant one, which is the failure mode a
   * conformance manifest exists to prevent.
   */
  readonly notImplemented?: string;
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
    id: "expired-grant",
    move: canonicalMove("expired_grant"),
    conditions: [
      {
        id: "read-grant-expired",
        description:
          "The agent's workspace read grant carries an expiry the turn has already passed. Nothing about it is revoked, malformed, or out of scope.",
        world: { expired: [READ_GRANT] },
      },
    ],
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
    id: "revoked-mid-turn",
    move: canonicalMove("revoked_mid_turn"),
    conditions: [
      {
        id: "revoked-while-the-first-turn-runs",
        description:
          "The store revokes the agent's read grant immediately after the first turn has loaded its authority, so the revocation lands with that turn still running. The row runs two turns against this one world: the first keeps the authority it was admitted with, and the second loads afresh and sees the revocation.",
        world: { revokedAfterTurn: { turn: 1, grantIds: [READ_GRANT] } },
      },
    ],
  },
  {
    id: "namespace-crossing",
    move: canonicalMove("namespace_crossing"),
    conditions: [BASELINE],
  },
  {
    id: "bounded-grant",
    move: canonicalMove("bounded_grant_exhausted"),
    conditions: [
      {
        id: "single-use-write-grant",
        description:
          "The agent holds a single-use write grant over the ledger, and no other authority covers that path.",
        world: { bounded: true },
      },
    ],
  },
  {
    id: "usage-store-unavailable",
    move: canonicalMove("usage_store_unavailable"),
    conditions: [
      {
        id: "counter-unreachable",
        description:
          "The agent holds the same single-use write grant, and the store that counts its remaining uses answers neither reads nor writes.",
        world: { usageStoreUnavailable: true },
      },
    ],
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
    id: "tool-ceiling-escape",
    move: canonicalMove("tool_ceiling_escape"),
    conditions: [BASELINE],
  },
  {
    id: "invalid-tool-result",
    move: canonicalMove("invalid_tool_result"),
    conditions: [BASELINE],
  },
  {
    id: "budget-exceeded",
    move: canonicalMove("budget_exceeded"),
    conditions: [
      {
        id: "tool-call-ceiling",
        description: "The turn is admitted with a budget of one tool call and eight steps.",
        world: { maxToolCalls: 1, maxSteps: 8 },
      },
      {
        id: "step-ceiling",
        description: "The turn is admitted with a budget of one step and eight tool calls.",
        world: { maxToolCalls: 8, maxSteps: 1 },
      },
    ],
  },
  {
    id: "grant-material",
    move: canonicalMove("grant_material_unreachable"),
    conditions: [
      {
        id: "baseline",
        description:
          "The world as issued. The claim is structural rather than armed: the compiler hands a runtime plugin no type that carries authority, and this checks that nothing carries it at run time either.",
        world: {},
      },
    ],
  },
  {
    id: "over-broad-delegation",
    move: canonicalMove("over_broad_delegation"),
    conditions: [
      {
        id: "child-claims-more-than-its-parent",
        description:
          "The agent holds an extra grant claiming workspace writes, delegated from a parent that holds only workspace reads. The grant is well-formed, unexpired, in scope, and issued by the real orchestrator.",
        world: { overBroadDelegation: true },
      },
    ],
  },
  {
    id: "escalation",
    move: canonicalMove("escalation_recorded"),
    conditions: [
      {
        id: "baseline",
        description:
          "The world as issued. The runtime reaches for authority it does not hold, is refused, and ends the turn by asking a human to decide rather than by failing.",
        world: {},
        expectTurn: { status: "escalated", reasonCode: "escalation_requested" },
      },
    ],
  },
  {
    id: "record-completeness",
    move: canonicalMove("record_completeness"),
    conditions: [BASELINE],
  },
  {
    id: "typed-governed-views",
    move: canonicalMove("typed_governed_views"),
    notImplemented:
      "SharedOS has no view layer. Resources are served whole or refused, so there is nothing between a raw record and a denial for a row about narrowing disclosure to measure.",
    conditions: [
      {
        id: "declared",
        description:
          "Would arm a resource with a declared typed view and a grant naming the view rather than the record behind it.",
        world: {},
      },
    ],
  },
  {
    id: "replay-freshness",
    move: canonicalMove("replay_freshness"),
    notImplemented:
      "SharedOS has no freshness port. A call carries its own instant and identifiers and nothing rejects one for having been seen before, so a replay is indistinguishable from a repeat.",
    conditions: [
      {
        id: "declared",
        description:
          "Would arm a recorded turn, then re-issue its calls verbatim against a host that tracks what it has already accepted.",
        world: {},
      },
    ],
  },
]);
