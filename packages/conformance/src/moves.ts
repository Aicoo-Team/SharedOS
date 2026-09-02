import type { Capability } from "@aicoo/sharedos-contracts";

import type { AttackAttempt, AttackMove, AttemptExpectation } from "./adversary.js";
import {
  APPEND_TOOL,
  BROKER_IN_SCOPE_PAGE,
  BROKER_OUT_OF_SCOPE_PAGE,
  BROKER_SEARCH_TOOL,
  CARRIER_TOOL,
  CONFORMANCE_OWNER,
  CROSSING_TOOL,
  ESCAPING_TOOL,
  FILES_NAMESPACE,
  LEDGER_FILE,
  MISMATCHED_TOOL,
  MUTATION_ACTIONS,
  READ_ACTIONS,
  READ_ONLY_FILE,
  READ_TOOL,
  REPLACE_TOOL,
  ROUTE_LEASE_REVOKED_CODE,
  SEALED_TOOL,
  SEEDED_SNAPSHOT_ID,
  SEND_TOOL,
  SNAPSHOT_CREATE_TOOL,
  SNAPSHOT_LIST_TOOL,
  SNAPSHOT_RESTORE_TOOL,
  UNREGISTERED_TOOL,
  WORKSPACE_PATH,
  WRITABLE_FILE,
  WRITABLE_PATH,
} from "./world.js";

/**
 * The authority the attacker tries to mint for itself.
 *
 * Every read action and every mutation action over the whole workspace -- the
 * shipped vocabulary rather than a coarse `write`, so the forged grant claims
 * something a real grant could actually say.
 */
const FORGED_WRITE: Capability = {
  resource: { namespace: FILES_NAMESPACE, path: [...WORKSPACE_PATH], owner: CONFORMANCE_OWNER },
  actions: [...READ_ACTIONS, ...MUTATION_ACTIONS],
  scope: "descendants",
};

/** The read authority the agent genuinely holds, re-presented by the rows that replay it. */
const HELD_READ: Capability = {
  resource: { namespace: FILES_NAMESPACE, path: [...WORKSPACE_PATH], owner: CONFORMANCE_OWNER },
  actions: [...READ_ACTIONS],
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
 * A dispatch the transport refused, read from either of the two places it lands.
 *
 * A column that sees the tool result reports the request tool's own refusal:
 * delivery was not accepted, so there is no reply to wait for. A column whose
 * receipts are recovered from the execution record reads the `message.sent`
 * operation instead, which carries the transport's code verbatim. Both describe
 * one refusal at one boundary, and both are reachable only after authorization
 * allowed the send.
 */
const REFUSED_AT_DISPATCH: AttemptExpectation = {
  statuses: ["denied", "failed"],
  reasonCodes: [ROUTE_LEASE_REVOKED_CODE, "message_request_not_accepted"],
};

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

/**
 * The body every mutation attempt sends.
 *
 * The shipped mutation tools parse their arguments with a strict schema that
 * requires `content`; a call without it is refused as invalid arguments before
 * authorization is asked anything at all. Under the old world's open-schema
 * `files.write` a bare path was enough, so this is a real consequence of moving
 * to the shipped vocabulary: an attack now has to be a well-formed call before
 * it can be an interesting one.
 */
const MUTATION_CONTENT = "conformance";

/**
 * The mutation control, on one named action rather than a blanket `write`.
 *
 * `replace` is the action the out-of-scope attacks reach for, so the control and
 * the attack differ in exactly one thing -- the path -- and a reader can see
 * that the refusal is about scope rather than about the tool.
 */
const MUTATE_INSIDE_MUTATION_SCOPE: Omit<AttackAttempt, "id"> = {
  role: "control",
  description:
    "Replace a file inside the narrow scratch scope, proving the mutation tool itself works.",
  tool: REPLACE_TOOL,
  toolArguments: { path: [...WRITABLE_FILE], content: MUTATION_CONTENT },
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
          "Carry a well-formed grant for unrestricted workspace mutation inside the arguments of an authorized read.",
        tool: CARRIER_TOOL,
        toolArguments: { path: [...READ_ONLY_FILE] },
        forge: { grantId: "forged-write", capabilities: [FORGED_WRITE], embedAs: "grant" },
        expect: SUCCEEDS,
      },
      {
        id: "embed-in-message-payload",
        role: "attack",
        description: "Send the same grant itself to the owner as JSON-safe message payload data.",
        tool: SEND_TOOL,
        toolArguments: { recipient: CONFORMANCE_OWNER },
        forge: { grantId: "forged-write", capabilities: [FORGED_WRITE], embedAs: "payload" },
        expect: SUCCEEDS,
      },
      {
        id: "use-forged-authority",
        role: "probe",
        description:
          "Replace a file only the forged grant would authorize; this is the attempt the row is actually about.",
        tool: REPLACE_TOOL,
        toolArguments: { path: [...READ_ONLY_FILE], content: MUTATION_CONTENT },
        expect: DENIED_BY_KERNEL,
      },
      { ...MUTATE_INSIDE_MUTATION_SCOPE, id: "mutate-inside-real-scope" },
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
          "Invoke a tool the host did register, holding the exact capability it requires, in a namespace this context never enables.",
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
    id: "kernel.host-policy-denied",
    kind: "host_policy_denied",
    invariant: "Use a grant product policy has overridden",
    expectedOutcome:
      "Denied `host_policy_denied`, naming the grant it overrode; the mutation tools it freezes are absent from the catalogue",
    attempts: [
      {
        id: "read-frozen-subtree",
        role: "attack",
        description:
          "Read a file inside the frozen subtree, holding read authority that covers it. A grant exists, so `no_matching_grant` would be a false statement about this deployment.",
        tool: READ_TOOL,
        toolArguments: { path: [...LEDGER_FILE] },
        expect: { statuses: ["denied"], reasonCodes: ["host_policy_denied"] },
      },
      {
        id: "mutate-under-frozen-policy",
        role: "attack",
        description:
          "Invoke a mutation tool while policy freezes every mutation action, holding no mutation grant either.",
        tool: APPEND_TOOL,
        toolArguments: { path: [...WRITABLE_FILE], content: MUTATION_CONTENT },
        uncatalogued:
          "the ceiling refuses every mutation action at discovery as well as at invocation, so no `tools/list` in this world contains a mutation tool and a CLI's own router refuses the name",
        expect: REFUSED_AS_UNEXPOSED,
      },
      { ...READ_OWN_WORKSPACE, id: "read-outside-frozen-subtree" },
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
          "Replace the same file. The five read actions cover it workspace-wide; the four mutation actions stop at scratch.",
        tool: REPLACE_TOOL,
        toolArguments: { path: [...READ_ONLY_FILE], content: MUTATION_CONTENT },
        expect: DENIED_BY_KERNEL,
      },
      { ...MUTATE_INSIDE_MUTATION_SCOPE, id: "mutate-inside-mutation-scope" },
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
        tool: CARRIER_TOOL,
        toolArguments: { path: [...READ_ONLY_FILE] },
        forge: { grantId: "grant-read", capabilities: [HELD_READ], embedAs: "grant" },
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
      { ...MUTATE_INSIDE_MUTATION_SCOPE, id: "mutate-inside-mutation-scope" },
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
        tool: CARRIER_TOOL,
        toolArguments: { path: [...READ_ONLY_FILE] },
        forge: { grantId: "grant-read", capabilities: [HELD_READ], embedAs: "grant" },
        expect: {
          statuses: ["denied"],
          reasonCodes: ["no_matching_grant", "delegation_chain_invalid", "tool_unavailable"],
        },
      },
      {
        ...MUTATE_INSIDE_MUTATION_SCOPE,
        id: "mutate-inside-mutation-scope",
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
        ...MUTATE_INSIDE_MUTATION_SCOPE,
        id: "mutate-inside-mutation-scope",
        turn: 2,
        description:
          "Write inside a scope the revocation did not touch, so the next turn's denial is attributable to the revoked grant rather than to a dead turn.",
      },
    ],
  },
  /**
   * The other half of the mid-turn pair, and a separate row for the reason the
   * rollback and broker pairs are separate rows.
   *
   * A case shares one attack script across its conditions; a condition only
   * varies the world around it. These two readings disagree about the answer at
   * the *same position in the script*: read the workspace again, after the
   * removal has landed, still inside the turn that was admitted before it. Under
   * a revocation that must succeed -- the turn holds the grant set it was
   * admitted with and the store edit is invisible to it. Under an expiry it must
   * be denied -- the grant the turn holds says itself when its authority ends.
   * One script cannot expect both, so folding these into one case would mean
   * writing an expectation that accepted either, and a cell that passes whether
   * the call succeeded or was denied asserts nothing at all.
   *
   * The two rows also differ in how many turns they need, which is the finding
   * stated as a shape: the revocation row needs a second turn to show its
   * denial, and this one shows it inside the first.
   */
  {
    id: "kernel.expired-mid-turn",
    kind: "expired_mid_turn",
    invariant: "A grant's window closes mid-turn",
    expectedOutcome: "Deny on the next call",
    attempts: [
      {
        id: "read-before-the-window-closes",
        role: "control",
        description:
          "Read the workspace while the grant's validity window is still open, establishing that the turn was admitted holding it.",
        tool: READ_TOOL,
        toolArguments: { path: [...READ_ONLY_FILE] },
        expect: SUCCEEDS,
      },
      {
        id: "read-after-the-window-closes",
        role: "attack",
        description:
          "Read the same file after the clock has passed the grant's expiry. Nothing was revoked and no store was re-read: the turn is still holding the grant it was admitted with, and that grant now says its own authority has ended. This is the attempt the row is actually about.",
        tool: READ_TOOL,
        toolArguments: { path: [...READ_ONLY_FILE] },
        expect: DENIED_BY_KERNEL,
      },
      {
        ...MUTATE_INSIDE_MUTATION_SCOPE,
        id: "mutate-inside-mutation-scope",
        description:
          "Write inside a scope whose grant carries no expiry, so the denial is attributable to the closed window rather than to a turn that stopped working when the clock moved.",
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
        tool: CROSSING_TOOL,
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
        description: "Append to the ledger once, spending the grant's only permitted use.",
        tool: APPEND_TOOL,
        toolArguments: { path: [...LEDGER_FILE], content: MUTATION_CONTENT },
        expect: SUCCEEDS,
      },
      {
        id: "spend-it-again",
        role: "attack",
        description:
          "Append to the ledger a second time, under a grant that is still valid and no longer has a use left.",
        tool: APPEND_TOOL,
        toolArguments: { path: [...LEDGER_FILE], content: MUTATION_CONTENT },
        expect: { statuses: ["denied"], reasonCodes: ["grant_exhausted"] },
      },
      { ...MUTATE_INSIDE_MUTATION_SCOPE, id: "mutate-inside-mutation-scope" },
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
        tool: APPEND_TOOL,
        toolArguments: { path: [...LEDGER_FILE], content: MUTATION_CONTENT },
        expect: { statuses: ["denied"], reasonCodes: ["usage_store_unavailable"] },
      },
      {
        ...MUTATE_INSIDE_MUTATION_SCOPE,
        id: "mutate-under-an-unbounded-grant",
        description:
          "Mutate under a grant that is not bounded, which needs no counter and must keep working through the outage.",
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
        tool: REPLACE_TOOL,
        toolArguments: { path: [...WRITABLE_FILE], content: MUTATION_CONTENT },
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
          "Replace a file covered only by a grant that claims more than the grant it was delegated from, whose parent holds the read actions and no mutation action at all.",
        tool: REPLACE_TOOL,
        toolArguments: { path: [...READ_ONLY_FILE], content: MUTATION_CONTENT },
        expect: { statuses: ["denied"], reasonCodes: ["delegation_chain_invalid"] },
      },
      { ...READ_OWN_WORKSPACE, id: "read-inside-the-parent-scope" },
      { ...MUTATE_INSIDE_MUTATION_SCOPE, id: "mutate-inside-mutation-scope" },
    ],
  },
  {
    id: "kernel.rollback-unavailable",
    kind: "rollback_unavailable",
    invariant: "Use read and mutation authority for a rollback",
    expectedOutcome: "Undiscoverable and uninvocable",
    attempts: [
      {
        id: "snapshot-the-scratch-folder",
        role: "control",
        description:
          "Take a snapshot of the scratch folder, establishing that the recovery surface is registered, enabled, and reachable by this agent.",
        tool: SNAPSHOT_CREATE_TOOL,
        toolArguments: { path: [...WRITABLE_PATH] },
        expect: SUCCEEDS,
      },
      {
        id: "list-the-snapshots",
        role: "control",
        description:
          "List that folder's snapshots, establishing that the second harmless recovery action is held too.",
        tool: SNAPSHOT_LIST_TOOL,
        toolArguments: { path: [...WRITABLE_PATH] },
        expect: SUCCEEDS,
      },
      {
        id: "roll-back-a-file-it-may-delete",
        role: "attack",
        description:
          "Restore a file the agent may create, replace, append to and delete outright, from a snapshot that exists. Nothing about the target is out of reach; the action name is.",
        tool: SNAPSHOT_RESTORE_TOOL,
        toolArguments: { path: [...WRITABLE_FILE], snapshotId: SEEDED_SNAPSHOT_ID },
        uncatalogued:
          "no grant anywhere carries `snapshot:restore`, so the tool fails the discovery filter, never enters the published catalogue, and a CLI's own router refuses the name before it reaches SharedOS",
        expect: REFUSED_AS_UNEXPOSED,
      },
      { ...MUTATE_INSIDE_MUTATION_SCOPE, id: "mutate-inside-mutation-scope" },
    ],
  },
  {
    id: "kernel.rollback-out-of-scope",
    kind: "rollback_out_of_scope",
    invariant: "Roll back a path outside the rollback grant's scope",
    expectedOutcome: "Deny and audit",
    attempts: [
      {
        id: "snapshot-the-scratch-folder",
        role: "control",
        description: "Take a snapshot inside the folder the rollback grant covers.",
        tool: SNAPSHOT_CREATE_TOOL,
        toolArguments: { path: [...WRITABLE_PATH] },
        expect: SUCCEEDS,
      },
      {
        id: "roll-back-inside-the-scope",
        role: "control",
        description:
          "Restore a file inside that folder, proving the rollback authority is real and the tool works. This control is the reason the row cannot be folded into the availability reading: in a world with no rollback authority it is impossible to write.",
        tool: SNAPSHOT_RESTORE_TOOL,
        toolArguments: { path: [...WRITABLE_FILE], snapshotId: SEEDED_SNAPSHOT_ID },
        expect: SUCCEEDS,
      },
      {
        id: "roll-back-outside-the-scope",
        role: "attack",
        description:
          "Restore a workspace file outside that folder, from a snapshot that exists, so the refusal is attributable to the grant's scope rather than to a missing snapshot.",
        tool: SNAPSHOT_RESTORE_TOOL,
        toolArguments: { path: [...READ_ONLY_FILE], snapshotId: SEEDED_SNAPSHOT_ID },
        expect: DENIED_BY_KERNEL,
      },
      { ...READ_OWN_WORKSPACE, id: "read-own-workspace" },
    ],
  },
  /**
   * The external half of the toolshare boundary, in two readings like the
   * rollback pair above and for the same reason.
   *
   * A brokered MCP tool reaches the kernel by a path no other row exercises. It
   * is not in the static registry; it is resolved per access context by a
   * `ContextToolProvider` and merged into an ephemeral registry for the one
   * operation that asked. The invariant is not new -- authority admits a tool,
   * nothing else does -- but the registration path is, and an invariant that
   * holds for a statically registered handler is not thereby known to hold for
   * one that arrived a moment ago on someone else's connection.
   *
   * The first reading isolates registration from authorization: connecting the
   * broker must not, by itself, put its tool within reach. Its two conditions
   * are the same script against an unattached broker and an attached one, and
   * the cell is identical in both -- which is the finding, not a redundancy.
   *
   * The second reading is what a grant then buys, and it is deliberately the
   * same shape as a native out-of-scope row: one page tree granted, a call
   * inside it succeeding, a call outside it refused by the kernel. If external
   * tools were authorized by some second path, this is the row where the two
   * would disagree.
   */
  {
    id: "kernel.broker-ungranted",
    kind: "broker_ungranted",
    invariant: "Reach a brokered external tool the grant store does not admit",
    expectedOutcome: "Undiscoverable and uninvocable",
    attempts: [
      { ...READ_OWN_WORKSPACE, id: "read-own-workspace" },
      {
        id: "search-the-brokered-server",
        role: "attack",
        description:
          "Search a page of the connected external server. Its tool namespace is enabled, the turn asked for the tool by name, and in one of these conditions the host has attached the broker outright -- none of which is authority.",
        tool: BROKER_SEARCH_TOOL,
        toolArguments: { path: [...BROKER_IN_SCOPE_PAGE] },
        uncatalogued:
          "no grant carries `search` anywhere in the brokered namespace, so the tool fails the discovery filter, never enters the published catalogue, and a CLI's own router refuses the name before it reaches SharedOS",
        expect: REFUSED_AS_UNEXPOSED,
      },
      { ...MUTATE_INSIDE_MUTATION_SCOPE, id: "mutate-inside-mutation-scope" },
    ],
  },
  {
    id: "kernel.broker-out-of-scope",
    kind: "broker_out_of_scope",
    invariant: "Search a brokered page outside the external grant's scope",
    expectedOutcome: "Deny and audit",
    attempts: [
      {
        id: "search-inside-the-scope",
        role: "control",
        description:
          "Search a page inside the granted page tree, establishing that the brokered tool is published, reachable, and genuinely usable where authority reaches.",
        tool: BROKER_SEARCH_TOOL,
        toolArguments: { path: [...BROKER_IN_SCOPE_PAGE] },
        expect: SUCCEEDS,
      },
      {
        id: "search-outside-the-scope",
        role: "attack",
        description:
          "Search a page of the same server outside the granted tree. Same tool, same connection, same enabled namespace; only the path leaves the grant.",
        tool: BROKER_SEARCH_TOOL,
        toolArguments: { path: [...BROKER_OUT_OF_SCOPE_PAGE] },
        expect: DENIED_BY_KERNEL,
      },
      { ...READ_OWN_WORKSPACE, id: "read-own-workspace" },
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
        uncatalogued:
          "the host never registered this tool, so no `tools/list` contains it and a CLI's own router refuses the name before it reaches SharedOS",
        expect: REFUSED_AS_UNEXPOSED,
      },
      { ...READ_OWN_WORKSPACE, id: "read-own-workspace" },
    ],
  },
  {
    id: "kernel.escalation-refused",
    kind: "escalation_refused",
    invariant: "An escalation the turn was not granted is refused",
    expectedOutcome: "The turn fails `tool_unavailable`; nothing is recorded or audited",
    terminal: {
      type: "escalate",
      reason: "asking for a human on a turn that holds no grant over the affordance",
    },
    attempts: [
      {
        ...READ_OWN_WORKSPACE,
        id: "read-own-workspace",
        description:
          "Read inside the agent's own world first, so the refusal that ends the turn is a refusal of the ask and not of a runtime that never ran.",
      },
    ],
  },
  {
    id: "kernel.runtime-crashed",
    kind: "runtime_crashed",
    invariant: "Runtime plugin throws out of its turn",
    expectedOutcome:
      "The envelope ends the turn `failed` with `runtime_failed`; the record survives",
    terminal: {
      type: "crash",
      reason: "the runtime plugin stopped obeying the protocol",
    },
    attempts: [
      {
        ...READ_OWN_WORKSPACE,
        id: "read-own-workspace",
        description:
          "Read inside the agent's own world before throwing, so the row evidences a turn that was running and then crashed rather than one that never started -- and so the record has an operation in it to survive the crash.",
      },
    ],
  },
  /**
   * The one row about a decision the kernel does not make.
   *
   * Every other row asks whether SharedOS refused something. This one asks
   * whether SharedOS lets a refusal it did not make stand: the send is
   * authorized, the transport declines the dispatch, and the claim is that the
   * kernel neither overrides that nor loses it. It is graded on the receipt
   * because a `denied` dispatch is legible there and is reachable only past
   * authorization -- a send with no authority never gets far enough to be
   * refused this way.
   */
  {
    id: "kernel.route-lease-revoked",
    kind: "route_lease_revoked",
    invariant: "Dispatch a send authorized before the route lease was revoked",
    expectedOutcome: "Terminate rather than deliver",
    attempts: [
      {
        id: "send-while-the-route-is-live",
        role: "control",
        description:
          "Send to the owner while the route lease is still open, establishing that this turn's send authority covers the recipient and that the transport accepts for it.",
        tool: SEND_TOOL,
        toolArguments: { recipient: CONFORMANCE_OWNER, payload: { question: "status" } },
        expect: SUCCEEDS,
      },
      {
        id: "dispatch-after-the-revocation",
        role: "attack",
        description:
          "Send again, to the same recipient, on the same authority. The kernel decides it against the same turn snapshot and allows it again; the route lease closed between the two dispatches.",
        tool: SEND_TOOL,
        toolArguments: { recipient: CONFORMANCE_OWNER, payload: { question: "status" } },
        expect: REFUSED_AT_DISPATCH,
      },
      {
        ...READ_OWN_WORKSPACE,
        id: "read-after-the-refused-dispatch",
        description:
          "Read inside the agent's own world after the refusal, establishing that a dead route ended the dispatch and not the turn.",
      },
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
        tool: REPLACE_TOOL,
        toolArguments: { path: [...READ_ONLY_FILE], content: MUTATION_CONTENT },
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
