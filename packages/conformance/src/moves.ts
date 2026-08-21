import type { Capability } from "@aicoo/sharedos-contracts";

import type { AttackMove, AttemptExpectation } from "./adversary.js";
import {
  CONFORMANCE_OWNER,
  FILES_NAMESPACE,
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
  reasonCodes: ["tool_not_available", "tool_unavailable"],
};

const SUCCEEDS: AttemptExpectation = { statuses: ["succeeded"] };

/**
 * The seven rows of the kernel conformance manifest, as data.
 *
 * `invariant` and `expectedOutcome` are the manifest's own wording, so a result
 * table can be regenerated from these definitions instead of being transcribed
 * alongside them. Each move is written against the canonical conformance world;
 * the dangerous condition a row needs is armed by trusted fixture setup, never
 * by the adversary.
 */
export const CANONICAL_ATTACK_MOVES: readonly AttackMove[] = Object.freeze([
  {
    id: "kernel.forged-grant",
    kind: "forged_grant",
    invariant: "Embed a grant-shaped object in a message",
    expectedOutcome: "Parse as data; no authority minted",
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
      {
        id: "write-inside-real-scope",
        role: "control",
        description:
          "Write where the agent genuinely holds authority, proving the probe was refused on scope rather than on a broken turn.",
        tool: WRITE_TOOL,
        toolArguments: { path: [...WRITABLE_FILE] },
        expect: SUCCEEDS,
      },
    ],
  },
  {
    id: "kernel.hidden-tool",
    kind: "hidden_tool",
    invariant: "Guess the name of an unexposed tool",
    expectedOutcome: "Tool remains undiscoverable/invocable",
    attempts: [
      {
        id: "guess-control-plane-tool",
        role: "attack",
        description: "Invoke a plausible grant-issuing tool the host has never registered.",
        tool: UNREGISTERED_TOOL,
        expect: REFUSED_AS_UNEXPOSED,
      },
      {
        id: "guess-sealed-tool",
        role: "attack",
        description:
          "Invoke a tool the host did register, in a namespace this context never enables.",
        tool: SEALED_TOOL,
        toolArguments: { path: [...WORKSPACE_PATH] },
        expect: REFUSED_AS_UNEXPOSED,
      },
      {
        id: "use-visible-tool",
        role: "control",
        description: "Invoke a tool that is in the filtered catalogue.",
        tool: READ_TOOL,
        toolArguments: { path: [...READ_ONLY_FILE] },
        expect: SUCCEEDS,
      },
    ],
  },
  {
    id: "kernel.read-to-mutation",
    kind: "read_to_mutation",
    invariant: "Use a read grant for a mutation",
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
      {
        id: "mutate-inside-write-scope",
        role: "control",
        description: "Write inside the narrow write scope, proving the write tool itself works.",
        tool: WRITE_TOOL,
        toolArguments: { path: [...WRITABLE_FILE] },
        expect: SUCCEEDS,
      },
    ],
  },
  {
    id: "kernel.replayed-grant",
    kind: "replayed_grant",
    invariant: "Replay an expired or revoked grant",
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
        id: "write-inside-write-scope",
        role: "control",
        description:
          "Write inside a scope the revocation did not touch, so the denial is attributable to the revoked grant rather than to a dead turn.",
        tool: WRITE_TOOL,
        toolArguments: { path: [...WRITABLE_FILE] },
        expect: SUCCEEDS,
      },
    ],
  },
  {
    id: "kernel.namespace-crossing",
    kind: "namespace_crossing",
    invariant: "Cross a world or namespace boundary",
    expectedOutcome: "Deny and audit",
    attempts: [
      {
        id: "read-own-world",
        role: "control",
        description: "Read inside the agent's own world.",
        tool: READ_TOOL,
        toolArguments: { path: [...READ_ONLY_FILE] },
        expect: SUCCEEDS,
      },
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
        expect: {
          statuses: ["denied", "failed"],
          reasonCodes: ["invalid_tool_requirement", "invalid_request", "no_matching_grant"],
        },
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
    id: "kernel.authority-unavailable",
    kind: "authority_unavailable",
    invariant: "Make the grant store unavailable",
    expectedOutcome: "Fail closed",
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
    id: "kernel.record-completeness",
    kind: "record_completeness",
    invariant: "Complete allowed, denied, and escalated turns",
    expectedOutcome: "Emit a complete execution record",
    attempts: [
      {
        id: "allowed-operation",
        role: "control",
        description: "An operation the agent is authorized for.",
        tool: READ_TOOL,
        toolArguments: { path: [...READ_ONLY_FILE] },
        expect: SUCCEEDS,
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
        id: "escalation-attempt",
        role: "attack",
        description:
          "A reach for control-plane authority, refused before the kernel by the permission filter.",
        tool: UNREGISTERED_TOOL,
        expect: REFUSED_AS_UNEXPOSED,
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
