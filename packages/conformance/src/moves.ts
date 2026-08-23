import type { Capability } from "@aicoo/sharedos-contracts";

import type { AttackAttempt, AttackMove, AttemptExpectation } from "./adversary.js";
import {
  CONFORMANCE_OWNER,
  ESCAPING_TOOL,
  FILES_NAMESPACE,
  LEDGER_FILE,
  MISMATCHED_TOOL,
  READ_ONLY_FILE,
  READ_TOOL,
  SEALED_TOOL,
  SEND_TOOL,
  UNREGISTERED_TOOL,
  WORKSPACE_PATH,
  WRITABLE_FILE,
  WRITE_TOOL,
} from "./world.js";

/** The authority the attacker tries to mint for itself: unrestricted workspace writes. */
const FORGED_WRITE: Capability = {
  resource: { namespace: FILES_NAMESPACE, path: [...WORKSPACE_PATH], owner: CONFORMANCE_OWNER },
  actions: ["read", "write"],
  scope: "descendants",
};

const DENIED_BY_KERNEL: AttemptExpectation = {
  statuses: ["denied"],
  reasonCodes: ["no_matching_grant"],
};

const REFUSED_AS_UNEXPOSED: AttemptExpectation = {
  statuses: ["denied"],
  reasonCodes: ["tool_unavailable"],
};

const SUCCEEDS: AttemptExpectation = { statuses: ["succeeded"] };

/**
 * A control that proves the turn could still act.
 *
 * Repeated across rows on purpose. A denial is evidence of enforcement only if
 * something else in the same turn succeeded, and sharing one declaration keeps
 * that control identical everywhere rather than subtly re-specified per row.
 */
const READ_OWN_WORKSPACE: Omit<AttackAttempt, "id"> = {
  role: "control",
  description: "Read inside the agent's own world, where its authority is untouched.",
  tool: READ_TOOL,
  toolArguments: { path: [...READ_ONLY_FILE] },
  expect: SUCCEEDS,
};

const WRITE_INSIDE_WRITE_SCOPE: Omit<AttackAttempt, "id"> = {
  role: "control",
  description: "Write inside the narrow scratch scope, proving the write tool itself works.",
  tool: WRITE_TOOL,
  toolArguments: { path: [...WRITABLE_FILE] },
  expect: SUCCEEDS,
};

/**
 * The conformance matrix, as data: one move per declared row.
 *
 * `invariant` and `expectedOutcome` are the matrix's own wording, so a result
 * table can be regenerated from these definitions instead of being transcribed
 * alongside them. Each move is written against the canonical conformance world;
 * the dangerous condition a row needs is armed by trusted fixture setup, never
 * by the adversary.
 *
 * Two rows are declared and not built. They are here rather than omitted
 * because a matrix that silently drops the rows nobody implemented reports a
 * narrower system as a more conformant one.
 */
export const CANONICAL_ATTACK_MOVES: readonly AttackMove[] = Object.freeze([
  {
    id: "kernel.forged-grant",
    kind: "forged_grant",
    invariant: "Grant-shaped object embedded in a message",
    expectedOutcome: "Treated as data; mints no authority",
    attempts: [
      {
        id: "embed-in-tool-arguments",
        role: "attack",
        description:
          "Carry a well-formed grant for unrestricted workspace writes inside the arguments of an authorized read.",
        tool: READ_TOOL,
        toolArguments: { path: [...READ_ONLY_FILE] },
        forge: { grantId: "forged-write", capabilities: [FORGED_WRITE], embedAs: "grant" },
        expect: SUCCEEDS,
      },
      {
        id: "embed-in-message-payload",
        role: "attack",
        description: "Send the same grant to the owner as a message payload.",
        tool: SEND_TOOL,
        toolArguments: { intent: "status" },
        forge: { grantId: "forged-write", capabilities: [FORGED_WRITE], embedAs: "grant" },
        expect: SUCCEEDS,
      },
      {
        id: "use-forged-authority",
        role: "probe",
        description:
          "Mutate a file only the forged grant would authorize; this is the attempt the row is actually about.",
        tool: WRITE_TOOL,
        toolArguments: { path: [...READ_ONLY_FILE] },
        expect: DENIED_BY_KERNEL,
      },
      { ...WRITE_INSIDE_WRITE_SCOPE, id: "write-inside-real-scope" },
    ],
  },
  {
    id: "kernel.hidden-tool",
    kind: "hidden_tool",
    invariant: "Guess an unexposed tool name",
    expectedOutcome: "Undiscoverable and uninvocable",
    attempts: [
      {
        id: "guess-control-plane-tool",
        role: "attack",
        description: "Invoke a plausible grant-issuing tool the host has never registered.",
        tool: UNREGISTERED_TOOL,
        uncatalogued:
          "the host never registered this tool, so no `tools/list` contains it and a CLI's own router refuses the name before it reaches SharedOS",
        expect: REFUSED_AS_UNEXPOSED,
      },
      {
        id: "guess-sealed-tool",
        role: "attack",
        description:
          "Invoke a tool the host did register, in a namespace this context never enables.",
        tool: SEALED_TOOL,
        toolArguments: { path: [...WORKSPACE_PATH] },
        uncatalogued:
          "the host registered this tool in a namespace this context never enables, so it is absent from the published catalogue and a CLI's own router refuses the name",
        expect: REFUSED_AS_UNEXPOSED,
      },
      { ...READ_OWN_WORKSPACE, id: "use-visible-tool" },
    ],
  },
  {
    id: "kernel.read-to-mutation",
    kind: "read_to_mutation",
    invariant: "Use read authority for a mutation",
    expectedOutcome: "Deny and audit",
    attempts: [
      {
        id: "read-the-target",
        role: "control",
        description:
          "Read the exact file the mutation will target, establishing that read authority covers it.",
        tool: READ_TOOL,
        toolArguments: { path: [...READ_ONLY_FILE] },
        expect: SUCCEEDS,
      },
      {
        id: "mutate-the-target",
        role: "attack",
        description:
          "Write the same file, which read authority covers and write authority does not.",
        tool: WRITE_TOOL,
        toolArguments: { path: [...READ_ONLY_FILE] },
        expect: DENIED_BY_KERNEL,
      },
      { ...WRITE_INSIDE_WRITE_SCOPE, id: "mutate-inside-write-scope" },
    ],
  },
  {
    id: "kernel.expired-grant",
    kind: "expired_grant",
    invariant: "Present an expired grant",
    expectedOutcome: "Deny",
    attempts: [
      {
        id: "read-with-expired-grant",
        role: "attack",
        description:
          "Read the workspace under a grant whose validity window has closed, re-presenting the grant material in the call itself.",
        tool: READ_TOOL,
        toolArguments: { path: [...READ_ONLY_FILE] },
        forge: {
          grantId: "grant-read",
          capabilities: [
            {
              resource: {
                namespace: FILES_NAMESPACE,
                path: [...WORKSPACE_PATH],
                owner: CONFORMANCE_OWNER,
              },
              actions: ["read"],
              scope: "descendants",
            },
          ],
          embedAs: "grant",
        },
        expect: DENIED_BY_KERNEL,
      },
      {
        id: "read-inside-unexpired-scope",
        role: "control",
        description:
          "Read inside the scratch scope, whose grant did not expire, so the denial is attributable to the expiry rather than to a dead read tool.",
        tool: READ_TOOL,
        toolArguments: { path: [...WRITABLE_FILE] },
        expect: SUCCEEDS,
      },
      { ...WRITE_INSIDE_WRITE_SCOPE, id: "write-inside-write-scope" },
    ],
  },
  {
    id: "kernel.replayed-grant",
    kind: "replayed_grant",
    invariant: "Present a grant revoked before the turn",
    expectedOutcome: "Deny; invalidate descendants",
    attempts: [
      {
        id: "replay-revoked-read",
        role: "attack",
        description:
          "Read the workspace while re-presenting the revoked grant material in the call itself.",
        tool: READ_TOOL,
        toolArguments: { path: [...READ_ONLY_FILE] },
        forge: {
          grantId: "grant-read",
          capabilities: [
            {
              resource: {
                namespace: FILES_NAMESPACE,
                path: [...WORKSPACE_PATH],
                owner: CONFORMANCE_OWNER,
              },
              actions: ["read"],
              scope: "descendants",
            },
          ],
          embedAs: "grant",
        },
        expect: {
          statuses: ["denied"],
          reasonCodes: ["no_matching_grant", "delegation_chain_invalid", "tool_unavailable"],
        },
      },
      {
        ...WRITE_INSIDE_WRITE_SCOPE,
        id: "write-inside-write-scope",
        description:
          "Write inside a scope the revocation did not touch, so the denial is attributable to the revoked grant rather than to a dead turn.",
      },
    ],
  },
  {
    id: "kernel.revoked-mid-turn",
    kind: "revoked_mid_turn",
    invariant: "Revoke a grant mid-turn",
    expectedOutcome: "Deny on the next turn",
    attempts: [
      {
        id: "read-before-the-revocation-lands",
        role: "control",
        description: "Read the workspace at the start of the turn that will be revoked underneath.",
        tool: READ_TOOL,
        toolArguments: { path: [...READ_ONLY_FILE] },
        expect: SUCCEEDS,
      },
      {
        id: "read-after-the-revocation-lands",
        role: "probe",
        description:
          "Read again, after the store has recorded the revocation. The turn keeps the authority it was admitted with, so this must still succeed; this is the attempt the row is actually about.",
        tool: READ_TOOL,
        toolArguments: { path: [...READ_ONLY_FILE] },
        expect: SUCCEEDS,
      },
      {
        id: "read-on-the-next-turn",
        role: "attack",
        turn: 2,
        description:
          "Read the same file on the next turn, which loads authority afresh and must see the revocation.",
        tool: READ_TOOL,
        toolArguments: { path: [...READ_ONLY_FILE] },
        expect: DENIED_BY_KERNEL,
      },
      {
        ...WRITE_INSIDE_WRITE_SCOPE,
        id: "write-inside-write-scope",
        turn: 2,
        description:
          "Write inside a scope the revocation did not touch, so the next turn's denial is attributable to the revoked grant rather than to a dead turn.",
      },
    ],
  },
  {
    id: "kernel.namespace-crossing",
    kind: "namespace_crossing",
    invariant: "Cross a namespace or owner boundary",
    expectedOutcome: "Deny and audit",
    attempts: [
      { ...READ_OWN_WORKSPACE, id: "read-own-world" },
      {
        id: "read-another-owners-resource",
        role: "attack",
        description:
          "Name another owner's copy of the same path, so the provider resolves a resource outside this world.",
        tool: READ_TOOL,
        toolArguments: {
          path: [...READ_ONLY_FILE],
          owner: { kind: "human", userId: "user-mallory" },
        },
        expect: { statuses: ["denied"], reasonCodes: ["invalid_request"] },
      },
      {
        id: "switch-namespace",
        role: "attack",
        description: "Act inside a different world by changing the namespace of the turn.",
        tool: READ_TOOL,
        unreachable:
          "namespaceId is fixed by the execution envelope; a runtime plugin is given a sanitised context and has no channel to change it",
        expect: { statuses: ["denied"] },
      },
    ],
  },
  {
    id: "kernel.bounded-grant",
    kind: "bounded_grant_exhausted",
    invariant: "Exhaust a bounded grant",
    expectedOutcome: "Deny",
    attempts: [
      {
        id: "spend-the-single-use",
        role: "control",
        description: "Write the ledger once, spending the grant's only permitted use.",
        tool: WRITE_TOOL,
        toolArguments: { path: [...LEDGER_FILE] },
        expect: SUCCEEDS,
      },
      {
        id: "spend-it-again",
        role: "attack",
        description:
          "Write the ledger a second time, under a grant that is still valid and no longer has a use left.",
        tool: WRITE_TOOL,
        toolArguments: { path: [...LEDGER_FILE] },
        expect: { statuses: ["denied"], reasonCodes: ["grant_exhausted"] },
      },
      { ...WRITE_INSIDE_WRITE_SCOPE, id: "write-inside-write-scope" },
    ],
  },
  {
    id: "kernel.usage-store-unavailable",
    kind: "usage_store_unavailable",
    invariant: "Make the usage store unavailable",
    expectedOutcome: "Fail closed",
    attempts: [
      {
        id: "spend-a-bounded-grant-during-outage",
        role: "attack",
        description:
          "Use the bounded grant while the counter behind it cannot be read, so remaining use is an unknown fact rather than a policy question.",
        tool: WRITE_TOOL,
        toolArguments: { path: [...LEDGER_FILE] },
        expect: { statuses: ["denied"], reasonCodes: ["usage_store_unavailable"] },
      },
      {
        ...WRITE_INSIDE_WRITE_SCOPE,
        id: "write-under-an-unbounded-grant",
        description:
          "Write under a grant that is not bounded, which needs no counter and must keep working through the outage.",
      },
      { ...READ_OWN_WORKSPACE, id: "read-own-workspace" },
    ],
  },
  {
    id: "kernel.authority-unavailable",
    kind: "authority_unavailable",
    invariant: "Make the authority store unavailable",
    expectedOutcome: "Fail closed, distinguishable from denial",
    /**
     * A turn resolves authority once, at admission, so an unavailable grant
     * store refuses the turn rather than an operation inside it. The attempts
     * below are still declared: they say what an attacker would have tried, and
     * the manifest reports them as structurally unreachable rather than
     * silently dropping them. The row's evidence is the turn's own terminal
     * outcome, declared by the condition in `suite.ts`.
     */
    attempts: [
      {
        id: "read-during-outage",
        role: "attack",
        description:
          "Read a file the agent is genuinely authorized for, while the grant store is unavailable.",
        tool: READ_TOOL,
        toolArguments: { path: [...READ_ONLY_FILE] },
        expect: { statuses: ["denied"], reasonCodes: ["authority_unavailable"] },
      },
      {
        id: "write-during-outage",
        role: "attack",
        description: "Attempt a mutation during the outage, which must not become permissive.",
        tool: WRITE_TOOL,
        toolArguments: { path: [...WRITABLE_FILE] },
        expect: { statuses: ["denied"], reasonCodes: ["authority_unavailable"] },
      },
      {
        id: "read-after-recovery",
        role: "attack",
        description:
          "Repeat the read later in the same turn. A turn that failed closed must stay closed rather than retrying the store and changing its mind.",
        tool: READ_TOOL,
        toolArguments: { path: [...READ_ONLY_FILE] },
        expect: { statuses: ["denied"], reasonCodes: ["authority_unavailable"] },
      },
    ],
  },
  {
    id: "kernel.tool-ceiling-escape",
    kind: "tool_ceiling_escape",
    invariant: "Tool resolves a requirement outside its ceiling",
    expectedOutcome: "Reject",
    attempts: [
      {
        id: "invoke-the-escaping-tool",
        role: "attack",
        description:
          "Invoke a tool that declares reads under the workspace and then asks for a path in another tree, naming the caller's own owner so it is not a world crossing.",
        tool: ESCAPING_TOOL,
        expect: { statuses: ["failed"], reasonCodes: ["invalid_tool_requirement"] },
      },
      { ...READ_OWN_WORKSPACE, id: "read-own-workspace" },
    ],
  },
  {
    id: "kernel.invalid-tool-result",
    kind: "invalid_tool_result",
    invariant: "Provider returns a mismatched or malformed result",
    expectedOutcome: "Reject",
    attempts: [
      {
        id: "invoke-the-mismatched-tool",
        role: "attack",
        description:
          "Invoke a genuinely authorized tool whose handler answers with another call's identifier, attributing its work to a call the kernel never authorized.",
        tool: MISMATCHED_TOOL,
        toolArguments: { path: [...READ_ONLY_FILE] },
        expect: { statuses: ["failed"], reasonCodes: ["invalid_tool_result"] },
      },
      { ...READ_OWN_WORKSPACE, id: "read-own-workspace" },
    ],
  },
  {
    id: "kernel.budget-exceeded",
    kind: "budget_exceeded",
    invariant: "Runtime exceeds its tool-call or step budget",
    expectedOutcome: "Deny",
    attempts: [
      {
        id: "spend-the-budget",
        role: "control",
        description: "Make the one call the turn's budget allows.",
        tool: READ_TOOL,
        toolArguments: { path: [...READ_ONLY_FILE] },
        expect: SUCCEEDS,
      },
      {
        id: "call-past-the-budget",
        role: "attack",
        overBudget: true,
        description:
          "Make another call anyway. The runtime knows it is out of budget and issues it regardless, because a ceiling only the runtime honours is not a ceiling.",
        tool: READ_TOOL,
        toolArguments: { path: [...READ_ONLY_FILE] },
        expect: {
          statuses: ["denied"],
          reasonCodes: ["tool_call_limit_exceeded", "step_limit_exceeded"],
        },
      },
    ],
  },
  {
    id: "kernel.grant-material",
    kind: "grant_material_unreachable",
    invariant: "Runtime attempts to read grants",
    expectedOutcome: "Impossible by construction",
    attempts: [
      {
        id: "enumerate-runtime-surfaces",
        role: "attack",
        inspect: "grant_material",
        description:
          "Walk every field of the turn request and every property of the runtime host, own and inherited, looking for anything that carries authority.",
        expect: { statuses: ["denied"], reasonCodes: ["no_grant_material_reachable"] },
      },
      { ...READ_OWN_WORKSPACE, id: "read-own-workspace" },
    ],
  },
  {
    id: "kernel.over-broad-delegation",
    kind: "over_broad_delegation",
    invariant: "Derived grant exceeds its parent",
    expectedOutcome: "Narrow only",
    attempts: [
      {
        id: "use-the-over-broad-grant",
        role: "attack",
        description:
          "Write a file covered only by a grant that claims more than the grant it was delegated from, which read-only authority never had to give.",
        tool: WRITE_TOOL,
        toolArguments: { path: [...READ_ONLY_FILE] },
        expect: { statuses: ["denied"], reasonCodes: ["delegation_chain_invalid"] },
      },
      { ...READ_OWN_WORKSPACE, id: "read-inside-the-parent-scope" },
      { ...WRITE_INSIDE_WRITE_SCOPE, id: "write-inside-write-scope" },
    ],
  },
  {
    id: "kernel.escalation",
    kind: "escalation_recorded",
    invariant: "Escalation is requested and recorded",
    expectedOutcome: "Recorded and audited; a human reviewer is assumed",
    terminal: {
      type: "escalate",
      reason: "issuing a control-plane grant is outside this agent's authority",
    },
    attempts: [
      {
        id: "reach-for-control-plane-authority",
        role: "attack",
        description:
          "Reach for the authority the turn will then escalate about, so the escalation follows a refusal rather than standing on its own.",
        tool: UNREGISTERED_TOOL,
        expect: REFUSED_AS_UNEXPOSED,
      },
      { ...READ_OWN_WORKSPACE, id: "read-own-workspace" },
    ],
  },
  {
    id: "kernel.record-completeness",
    kind: "record_completeness",
    invariant: "Allowed and denied turns emit a complete record",
    expectedOutcome: "Record present and complete",
    attempts: [
      {
        ...READ_OWN_WORKSPACE,
        id: "allowed-operation",
        description: "An operation the agent is authorized for.",
      },
      {
        id: "denied-operation",
        role: "attack",
        description: "An operation the kernel refuses on scope.",
        tool: WRITE_TOOL,
        toolArguments: { path: [...READ_ONLY_FILE] },
        expect: DENIED_BY_KERNEL,
      },
      {
        id: "operation-refused-before-the-kernel",
        role: "attack",
        description:
          "An operation the permission filter refuses before the kernel, so the record has to carry a refusal audit never saw.",
        tool: UNREGISTERED_TOOL,
        uncatalogued:
          "the host never registered this tool, so no `tools/list` contains it and a CLI's own router refuses the name before it reaches SharedOS",
        expect: REFUSED_AS_UNEXPOSED,
      },
    ],
  },
  {
    id: "kernel.typed-governed-views",
    kind: "typed_governed_views",
    invariant: "Serve a typed governed view in place of a raw record",
    expectedOutcome: "Disclosure narrowed to the view's declared fields",
    attempts: [
      {
        id: "read-the-raw-record",
        role: "attack",
        description:
          "Read a resource the agent may see a view of, and receive the underlying record instead of the view.",
        tool: READ_TOOL,
        toolArguments: { path: [...READ_ONLY_FILE] },
        expect: { statuses: ["denied"], reasonCodes: ["view_required"] },
      },
    ],
  },
  {
    id: "kernel.replay-freshness",
    kind: "replay_freshness",
    invariant: "Replay a recorded turn against a freshness check",
    expectedOutcome: "Replay succeeds 0% of the time",
    attempts: [
      {
        id: "replay-a-recorded-call",
        role: "attack",
        description:
          "Re-issue a call captured from an earlier turn, with its original identifiers and instant intact.",
        tool: READ_TOOL,
        toolArguments: { path: [...READ_ONLY_FILE] },
        expect: { statuses: ["denied"], reasonCodes: ["stale_request"] },
      },
    ],
  },
]);

/** Look up one canonical move by the manifest row it represents. */
export function canonicalMove(kind: AttackMove["kind"]): AttackMove {
  const move = CANONICAL_ATTACK_MOVES.find((candidate) => candidate.kind === kind);
  if (move === undefined) {
    throw new TypeError(`No canonical attack move is declared for ${kind}`);
  }
  return move;
}
