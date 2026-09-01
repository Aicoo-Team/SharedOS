import { describe, expect, it } from "vitest";

import { ESCALATION_TOOL_NAME } from "@aicoo/sharedos-runtime";

import type { ExecutionResult } from "@aicoo/sharedos-contracts";
import { SharedOSExecutor } from "@aicoo/sharedos-runtime";

import {
  ADVERSARY_METADATA_KEY,
  type AttemptReceipt,
  HostileRuntime,
  readAdversarialReport,
  readAttemptReceipts,
} from "./adversary.js";
import { assembleExecutionRecord } from "./assemble.js";
import { checkRecordCompleteness, checkRecordRedaction } from "./completeness.js";
import { CANONICAL_ATTACK_MOVES, canonicalMove } from "./moves.js";
import type { ExecutionRecord, ExperimentIdentity, SystemIdentity } from "./record.js";
import {
  CONFORMANCE_NOW,
  createConformanceWorld,
  type ConformanceWorld,
  type ConformanceWorldOptions,
  ESCAPING_TOOL,
  APPEND_TOOL,
  BROKER_IN_SCOPE_PAGE,
  BROKER_SEARCH_TOOL,
  CARRIER_TOOL,
  CREATE_TOOL,
  CROSSING_TOOL,
  DELETE_TOOL,
  GREP_TOOL,
  LIST_TOOL,
  MISMATCHED_TOOL,
  SEARCH_TOOL,
  SNAPSHOT_CREATE_TOOL,
  SNAPSHOT_LIST_TOOL,
  SNAPSHOT_RESTORE_TOOL,
  STAT_TOOL,
  READ_GRANT,
  READ_TOOL,
  ROOT_FILES_GRANT,
  SEALED_TOOL,
  SEND_TOOL,
  UNREGISTERED_TOOL,
  REPLACE_TOOL,
  WRITABLE_FILE,
  WRITABLE_PATH,
} from "./world.js";

const HASH = "e".repeat(64);

const experiment: ExperimentIdentity = {
  experimentId: "kernel-conformance",
  taskId: "adversarial-moves",
  runId: "run-1",
  specHash: HASH,
  worldHash: HASH,
  evaluatorHash: HASH,
};

const system: Omit<SystemIdentity, "runtime"> = {
  protocolVersion: "1",
  sharedOsVersion: "0.1.0-alpha.0",
  adapterId: "sharedos-embedded",
  policyHash: HASH,
};

interface MoveRun {
  readonly world: ConformanceWorld;
  readonly result: ExecutionResult;
  readonly receipts: readonly AttemptReceipt[];
  readonly record: ExecutionRecord;
  receipt(attemptId: string): AttemptReceipt;
}

async function runMove(
  kind: Parameters<typeof canonicalMove>[0],
  options: ConformanceWorldOptions = {},
): Promise<MoveRun> {
  const world = createConformanceWorld(options);
  const runtime = new HostileRuntime([canonicalMove(kind)]);
  let sequence = 0;
  const result = await new SharedOSExecutor(world.kernel, runtime, {
    // The world's own clock, which is frozen unless the condition armed one
    // that moves. Hard-coding the constant here would leave a row about a
    // window closing mid-turn unable to run at all.
    clock: world.clock,
    createId: () => `event-${(sequence += 1)}`,
  }).execute(world.request("execution-1"));

  const report = readAdversarialReport(result);
  const receipts = report?.receipts ?? [];
  return {
    world,
    result,
    receipts,
    record: assembleExecutionRecord({
      request: world.request("execution-1"),
      result,
      auditEvents: world.auditEvents,
      experiment,
      system,
    }),
    receipt(attemptId: string): AttemptReceipt {
      const found = receipts.find((candidate) => candidate.attemptId === attemptId);
      if (found === undefined) {
        throw new Error(`no receipt for attempt ${attemptId}`);
      }
      return found;
    },
  };
}

/** An attempt satisfies its row when what came back is in what the row declared. */
function satisfiesExpectation(receipt: AttemptReceipt): boolean {
  if (!receipt.attempted || receipt.observed === undefined) {
    return false;
  }
  if (!receipt.expect.statuses.includes(receipt.observed)) {
    return false;
  }
  const codes = receipt.expect.reasonCodes;
  if (codes === undefined || receipt.observed === "succeeded") {
    return true;
  }
  return receipt.reasonCode !== undefined && codes.includes(receipt.reasonCode);
}

describe("the hostile runtime", () => {
  it("declares one move per row of the kernel conformance manifest", () => {
    expect(CANONICAL_ATTACK_MOVES.map(({ kind }) => kind)).toEqual([
      "forged_grant",
      "hidden_tool",
      "host_policy_denied",
      "read_to_mutation",
      "expired_grant",
      "replayed_grant",
      "revoked_mid_turn",
      "expired_mid_turn",
      "namespace_crossing",
      "bounded_grant_exhausted",
      "usage_store_unavailable",
      "authority_unavailable",
      "tool_ceiling_escape",
      "invalid_tool_result",
      "budget_exceeded",
      "grant_material_unreachable",
      "over_broad_delegation",
      "rollback_unavailable",
      "rollback_out_of_scope",
      "broker_ungranted",
      "broker_out_of_scope",
      "escalation_recorded",
      "escalation_refused",
      "runtime_crashed",
      "record_completeness",
      "typed_governed_views",
      "replay_freshness",
    ]);
  });

  it("rejects move sets it cannot execute unambiguously", () => {
    const move = canonicalMove("hidden_tool");
    expect(() => new HostileRuntime([move, move])).toThrow(/unique/u);
    expect(() => new HostileRuntime([])).toThrow(/not valid/u);
  });

  it("issues every declared attempt and records what came back", async () => {
    const run = await runMove("read_to_mutation");

    expect(run.receipts).toHaveLength(3);
    expect(run.receipts.every(({ attempted }) => attempted)).toBe(true);
    expect(run.receipts.every((receipt) => satisfiesExpectation(receipt))).toBe(true);
  });

  it("produces byte-identical receipts across runs of one move", async () => {
    const first = await runMove("read_to_mutation");
    const second = await runMove("read_to_mutation");

    expect(JSON.stringify(second.receipts)).toBe(JSON.stringify(first.receipts));
    expect(second.result.events.map(({ type }) => type)).toEqual(
      first.result.events.map(({ type }) => type),
    );
  });

  it("carries no argument values into its receipts", async () => {
    const run = await runMove("forged_grant");

    expect(run.receipt("embed-in-tool-arguments").argumentKeys).toEqual(["grant", "path"]);
    expect(JSON.stringify(run.receipts)).not.toContain("policy.md");
    expect(checkRecordRedaction(run.record)).toEqual({ clean: true, violations: [] });
  });

  it("keeps receipts recoverable from the event stream alone", async () => {
    const run = await runMove("hidden_tool");
    const withoutMetadata: ExecutionResult = { ...run.result, metadata: {} };

    expect(readAttemptReceipts(run.result)).toEqual(run.receipts);
    expect(readAdversarialReport(withoutMetadata)?.receipts).toEqual(run.receipts);
  });

  it("throws out of the turn when the move declares a crash, and is contained", async () => {
    const run = await runMove("runtime_crashed");

    // The throw does not escape `execute`. A plugin that stops obeying the
    // protocol is a terminal outcome the envelope owns, not an exception the
    // host has to catch, and a caller that had to wrap this call would be
    // wrapping the security boundary in its own error handling.
    expect(run.result.status).toBe("failed");
    expect(run.result.status === "failed" ? run.result.error.code : undefined).toBe(
      "runtime_failed",
    );

    // `source` is what a record reader grades on: the envelope ended this turn,
    // as against a failure a runtime reported as its own. Version 3 of the
    // grading rules reads exactly this field.
    const failed = run.result.events.find(({ type }) => type === "turn.failed");
    expect(failed?.data).toMatchObject({ code: "runtime_failed", source: "envelope" });

    // The receipt for the call made before the throw survives, and only because
    // it left as it happened. There is no terminal outcome to carry a report on
    // a crash, so the metadata holds none and the report has to be rebuilt from
    // the event stream -- the fallback that exists for exactly this.
    expect(run.result.metadata?.[ADVERSARY_METADATA_KEY]).toBeUndefined();
    const recovered = readAttemptReceipts(run.result);
    expect(recovered.map(({ attemptId }) => attemptId)).toEqual(["read-own-workspace"]);
    expect(recovered[0]?.observed).toBe("succeeded");
    expect(readAdversarialReport(run.result)?.receipts).toEqual(recovered);

    // And the turn's own evidence is intact, which is the half of the claim a
    // receipt cannot make: a crash must not be the cheapest way to leave no
    // record of what the turn did before it.
    expect(run.world.files.reads).toHaveLength(1);
    expect(checkRecordCompleteness(run.record).usable).toBe(true);
    expect(run.record.execution.terminalReasonCode).toBe("runtime_failed");
    expect(run.record.execution.operations).toContainEqual(
      expect.objectContaining({ tool: READ_TOOL, source: "kernel", outcome: "succeeded" }),
    );

    // What the crash leaves in audit is nothing, and the row says so rather
    // than leaving a reader to assume the terminal outcome is in there with the
    // decisions. The envelope owns this ending and never calls the kernel for
    // it, so `runtime_failed` exists only in the execution event stream. A
    // record built from audit alone would show a turn that read a file and then
    // stopped, with no account of why.
    expect(run.world.auditEvents.map(({ type }) => type)).not.toContain("escalation.requested");
    expect(run.world.auditEvents.some(({ reason }) => reason === "runtime_failed")).toBe(false);
    expect(run.record.execution.decisions.every(({ outcome }) => outcome === "allowed")).toBe(true);
  });
});

describe("manifest rows under the canonical world", () => {
  it("mints no authority from a grant embedded in arguments or a message", async () => {
    const run = await runMove("forged_grant");

    expect(run.receipt("embed-in-tool-arguments").observed).toBe("succeeded");
    expect(run.receipt("embed-in-message-payload").observed).toBe("succeeded");
    expect(run.world.deliveredMessages).toHaveLength(1);

    const probe = run.receipt("use-forged-authority");
    expect(probe.observed).toBe("denied");
    expect(probe.reasonCode).toBe("no_matching_grant");
    expect(run.receipt("mutate-inside-real-scope").observed).toBe("succeeded");
    expect(run.world.files.writes).toEqual(["Workspace/scratch/draft.md"]);

    // The forged grant reached the kernel as an argument and a payload, and
    // never entered an authority state.
    for (const snapshot of run.record.authority.snapshots) {
      expect(snapshot.grantIds).not.toContain("forged-write");
    }
  });

  it("leaves an unexposed tool both undiscoverable and uninvocable", async () => {
    const run = await runMove("hidden_tool");
    const report = readAdversarialReport(run.result);

    // The whole shipped file vocabulary except the one recovery action no grant
    // carries, plus the fixtures, plus the message request tool, plus the
    // escalation affordance -- which is catalogued and permission-filtered like
    // any other tool and is visible here because the world grants it.
    // `files.purge` is registered and absent: its namespace is never enabled.
    expect(report?.visibleTools).toEqual([
      APPEND_TOOL,
      CREATE_TOOL,
      DELETE_TOOL,
      MISMATCHED_TOOL,
      CROSSING_TOOL,
      GREP_TOOL,
      ESCAPING_TOOL,
      LIST_TOOL,
      CARRIER_TOOL,
      READ_TOOL,
      REPLACE_TOOL,
      SEARCH_TOOL,
      SNAPSHOT_CREATE_TOOL,
      SNAPSHOT_LIST_TOOL,
      STAT_TOOL,
      SEND_TOOL,
      ESCALATION_TOOL_NAME,
    ]);
    expect(report?.visibleTools).not.toContain(SNAPSHOT_RESTORE_TOOL);
    expect(report?.visibleTools).not.toContain(SEALED_TOOL);
    expect(report?.visibleTools).not.toContain(UNREGISTERED_TOOL);

    for (const attemptId of ["guess-control-plane-tool", "guess-sealed-tool"]) {
      const receipt = run.receipt(attemptId);
      expect(receipt.attempted).toBe(true);
      expect(receipt.observed).toBe("denied");
      expect(receipt.reasonCode).toBe("tool_unavailable");
    }
    expect(run.world.files.writes).toEqual([]);
    expect(run.receipt("use-visible-tool").observed).toBe("succeeded");
  });

  it("keeps rollback out of reach of every other file action", async () => {
    const run = await runMove("rollback_unavailable");
    const report = readAdversarialReport(run.result);

    // The agent holds twelve of the thirteen file actions, including both
    // harmless snapshot actions over this exact folder.
    expect(run.receipt("snapshot-the-scratch-folder").observed).toBe("succeeded");
    expect(run.receipt("list-the-snapshots").observed).toBe("succeeded");
    expect(report?.visibleTools).toContain(SNAPSHOT_CREATE_TOOL);
    expect(report?.visibleTools).toContain(SNAPSHOT_LIST_TOOL);

    // The thirteenth is refused before the kernel is asked anything, because no
    // grant carries it and the tool therefore never enters the catalogue.
    expect(report?.visibleTools).not.toContain(SNAPSHOT_RESTORE_TOOL);
    const denied = run.receipt("roll-back-a-file-it-may-delete");
    expect(denied.observed).toBe("denied");
    expect(denied.reasonCode).toBe("tool_unavailable");
    expect(run.world.files.recoveries).not.toContain(`snapshot:restore:${WRITABLE_FILE.join("/")}`);
    expect(run.receipt("mutate-inside-mutation-scope").observed).toBe("succeeded");
  });

  it("holds rollback authority inside its own scope and no further", async () => {
    const run = await runMove("rollback_out_of_scope", { restorable: true });
    const report = readAdversarialReport(run.result);

    // Arming the grant publishes the tool, which is what makes this reading an
    // ordinary catalogued call a live CLI can attempt.
    expect(report?.visibleTools).toContain(SNAPSHOT_RESTORE_TOOL);
    expect(run.receipt("roll-back-inside-the-scope").observed).toBe("succeeded");

    // Outside it, the refusal comes from the kernel rather than the envelope --
    // a different gate from the one the availability row reads.
    const denied = run.receipt("roll-back-outside-the-scope");
    expect(denied.observed).toBe("denied");
    expect(denied.reasonCode).toBe("no_matching_grant");

    // The snapshot it named does exist, so nothing but authority refused it.
    expect(run.world.files.recoveries).toEqual([
      `snapshot:create:${WRITABLE_PATH.join("/")}`,
      `snapshot:restore:${WRITABLE_FILE.join("/")}`,
    ]);
    expect(run.receipt("read-own-workspace").observed).toBe("succeeded");
  });

  it("does not admit a brokered external tool merely by connecting its server", async () => {
    // Two worlds, one script. Unattached, no provider resolves the handler at
    // all; attached, the provider is consulted and hands the kernel a perfectly
    // valid handler in an enabled namespace. Neither publishes the tool, and
    // both refuse the call identically -- which is the row.
    for (const world of [{}, { broker: "registered" as const }]) {
      const run = await runMove("broker_ungranted", world);
      const report = readAdversarialReport(run.result);

      expect(report?.visibleTools).not.toContain(BROKER_SEARCH_TOOL);
      const denied = run.receipt("search-the-brokered-server");
      expect(denied.observed).toBe("denied");
      expect(denied.reasonCode).toBe("tool_unavailable");

      // The broker was never reached, so nothing but authority stopped the call.
      expect(run.world.broker.searches).toEqual([]);

      // The native surface is untouched in the same turn, which is what makes
      // this a statement about the external tool rather than about the world.
      expect(run.receipt("read-own-workspace").observed).toBe("succeeded");
      expect(run.receipt("mutate-inside-mutation-scope").observed).toBe("succeeded");
    }
  });

  it("consults the attached provider and still refuses what no grant carries", async () => {
    // The other half of the row above, and the reason it is not a false pass: a
    // provider that was silently never registered would produce the same cell.
    const attached = await runMove("broker_ungranted", { broker: "registered" });
    expect(attached.world.broker.listings.length).toBeGreaterThan(0);

    const unattached = await runMove("broker_ungranted", {});
    expect(unattached.world.broker.listings).toEqual([]);
  });

  it("holds brokered authority inside its own scope and no further", async () => {
    const run = await runMove("broker_out_of_scope", { broker: "granted" });
    const report = readAdversarialReport(run.result);

    // The grant is what publishes it -- the same grant that bounds it.
    expect(report?.visibleTools).toContain(BROKER_SEARCH_TOOL);
    expect(run.receipt("search-inside-the-scope").observed).toBe("succeeded");

    // Outside it, the kernel refuses on exactly the code a native out-of-scope
    // call earns. That equivalence is the point of the row.
    const denied = run.receipt("search-outside-the-scope");
    expect(denied.observed).toBe("denied");
    expect(denied.reasonCode).toBe("no_matching_grant");

    // The broker was asked for the in-scope page and never for the other one, so
    // the refusal landed before the external server was reached.
    expect(run.world.broker.searches).toEqual([BROKER_IN_SCOPE_PAGE.join("/")]);
    expect(run.receipt("read-own-workspace").observed).toBe("succeeded");
  });

  it("refuses a mutation on a file read authority covers", async () => {
    const run = await runMove("read_to_mutation");

    expect(run.receipt("read-the-target").observed).toBe("succeeded");
    const denied = run.receipt("mutate-the-target");
    expect(denied.observed).toBe("denied");
    expect(denied.reasonCode).toBe("no_matching_grant");
    expect(run.receipt("mutate-inside-mutation-scope").observed).toBe("succeeded");
    expect(run.world.files.writes).toEqual(["Workspace/scratch/draft.md"]);

    // "Deny and audit": the refusal is in the record, not only in the receipt.
    expect(run.record.execution.operations).toContainEqual(
      expect.objectContaining({
        tool: REPLACE_TOOL,
        source: "kernel",
        outcome: "denied",
        reasonCode: "no_matching_grant",
        failClosed: false,
      }),
    );
  });

  it("denies a replayed grant that was revoked directly", async () => {
    const run = await runMove("replayed_grant", { revoked: [READ_GRANT] });

    const denied = run.receipt("replay-revoked-read");
    expect(denied.attempted).toBe(true);
    expect(denied.observed).toBe("denied");
    // The tool stays discoverable through unrevoked scratch authority, so the
    // replay is refused by an authorization decision rather than by an empty
    // catalogue.
    expect(denied.reasonCode).toBe("no_matching_grant");
    expect(run.world.files.reads).toEqual([]);
    expect(run.receipt("mutate-inside-mutation-scope").observed).toBe("succeeded");
  });

  it("invalidates a descendant when its ancestor is revoked", async () => {
    const run = await runMove("replayed_grant", { revoked: [ROOT_FILES_GRANT] });

    const denied = run.receipt("replay-revoked-read");
    expect(denied.observed).toBe("denied");
    expect(denied.reasonCode).toBe("delegation_chain_invalid");
    expect(run.world.files.reads).toEqual([]);
    // The write grant descends from a different ancestor, so the turn still acts.
    expect(run.receipt("mutate-inside-mutation-scope").observed).toBe("succeeded");
    expect(
      run.record.execution.decisions.some(
        ({ reasonCode }) => reasonCode === "delegation_chain_invalid",
      ),
    ).toBe(true);
  });

  it("keeps the world's clock frozen unless a condition asked for one that moves", async () => {
    const run = await runMove("read_to_mutation");

    // Every instant a turn against an unarmed world produces is the same one.
    // If this ever stops holding, every committed artifact stops being
    // comparable to the one beside it.
    const instants = new Set(run.result.events.map(({ occurredAt }) => occurredAt));
    expect([...instants]).toEqual([CONFORMANCE_NOW]);
    expect(run.record.execution.decisions.map(({ at }) => at)).toEqual(
      run.record.execution.decisions.map(() => CONFORMANCE_NOW),
    );
  });

  it("closes a validity window inside the turn that was admitted holding it", async () => {
    const run = await runMove("expired_mid_turn", {
      expiresAfterOperations: { operations: 1, grantIds: [READ_GRANT] },
    });

    // The identical call, at the identical path, on either side of the expiry.
    expect(run.receipt("read-before-the-window-closes").observed).toBe("succeeded");
    const denied = run.receipt("read-after-the-window-closes");
    expect(denied.observed).toBe("denied");
    expect(denied.reasonCode).toBe("no_matching_grant");
    // The turn is alive: a grant carrying no expiry is untouched.
    expect(run.receipt("mutate-inside-mutation-scope").observed).toBe("succeeded");
    // The provider served the first read and never saw the second.
    expect(run.world.files.reads).toEqual([["Workspace", "policy.md"].join("/")]);
  });

  it("refuses the expired grant against the one authority state the turn holds", async () => {
    const run = await runMove("expired_mid_turn", {
      expiresAfterOperations: { operations: 1, grantIds: [READ_GRANT] },
    });

    // The distinction the row exists to draw. A revocation needs a second load
    // to be seen; this needed none, so the denial cannot be attributed to the
    // store being re-read behind the turn.
    expect(run.record.cost.authorityLoads).toBe(1);
    expect(run.record.authority.snapshots).toHaveLength(1);
    for (const decision of run.record.execution.decisions) {
      expect(decision.authorityHash).toBe(run.record.authority.stableAuthorityHash);
    }
  });

  it("advances one step per mediated operation, and only there", async () => {
    const run = await runMove("expired_mid_turn", {
      expiresAfterOperations: { operations: 1, grantIds: [READ_GRANT] },
    });

    // Pinned rather than implied. A condition arms an expiry in operations, so
    // what an operation *is* has to be a fact the suite states: the clock stands
    // still for the whole of a call and moves between calls. If the envelope
    // ever starts stamping instants somewhere else, this fails here rather than
    // silently moving where an armed row's window falls.
    expect(run.record.execution.decisions.map(({ at }) => at)).toEqual([
      "2026-08-18T09:00:00.000Z", // admitting the turn, before any operation
      "2026-08-18T09:00:00.000Z", // the first read, inside the window
      "2026-08-18T09:00:01.000Z", // the second read, after it closed
      "2026-08-18T09:00:02.000Z", // the mutation, on a grant with no window
    ]);
  });

  it("refuses a resource in another owner's world and records the unreachable crossing", async () => {
    const run = await runMove("namespace_crossing");

    expect(run.receipt("read-own-world").observed).toBe("succeeded");
    const crossing = run.receipt("read-another-owners-resource");
    expect(crossing.attempted).toBe(true);
    expect(["denied", "failed"]).toContain(crossing.observed);
    expect(run.world.files.reads).toEqual(["Workspace/policy.md"]);

    const structural = run.receipt("switch-namespace");
    expect(structural.attempted).toBe(false);
    expect(structural.detail).toMatch(/no channel to change it/u);
  });

  it("refuses the whole turn when the grant store cannot answer", async () => {
    // A turn resolves authority once, at admission, so an unavailable store is
    // observed at the turn boundary: the runtime is never started at all.
    const run = await runMove("authority_unavailable", { authorityFailsAfterLoads: 0 });

    expect(run.result.status).toBe("denied");
    expect(run.record.execution.terminalReasonCode).toBe("authority_unavailable");
    expect(run.record.execution.decisions).toContainEqual(
      expect.objectContaining({ reasonCode: "authority_unavailable", failClosed: true }),
    );
    expect(run.receipts).toEqual([]);
    expect(run.world.files.reads).toEqual([]);
    expect(run.world.files.writes).toEqual([]);
    // Nothing executed, so there is no authority state to name, and the record
    // must still be usable evidence of the refusal.
    expect(run.record.authority.snapshots).toEqual([]);
    expect(checkRecordCompleteness(run.record).usable).toBe(true);
  });

  it("keeps one authority state for a whole turn, and one load behind it", async () => {
    // This move also sends a message, which reaches the kernel a second time
    // from inside a tool handler. A nested call receives only an AccessContext,
    // so it would re-read the store if the turn's authority were not held.
    const run = await runMove("forged_grant");

    expect(run.record.authority.snapshots).toHaveLength(1);
    expect(run.record.authority.stableAuthorityHash).toBe(run.record.authority.snapshots[0]?.hash);
    expect(run.record.cost.authorityLoads).toBe(1);
    // Every decision the turn made names that one state.
    for (const decision of run.record.execution.decisions) {
      expect(decision.authorityHash).toBe(run.record.authority.stableAuthorityHash);
    }
  });

  it("emits a usable record for a turn holding allowed, denied, and escalated attempts", async () => {
    const run = await runMove("record_completeness");

    expect(checkRecordCompleteness(run.record).usable).toBe(true);
    expect(run.record.execution.operations).toContainEqual(
      expect.objectContaining({ tool: READ_TOOL, source: "kernel", outcome: "succeeded" }),
    );
    expect(run.record.execution.operations).toContainEqual(
      expect.objectContaining({ tool: REPLACE_TOOL, source: "kernel", outcome: "denied" }),
    );
    // The escalation reach never becomes a kernel decision: the permission
    // filter refuses it inside the envelope, so only the envelope records it.
    expect(run.record.execution.operations).toContainEqual(
      expect.objectContaining({ tool: UNREGISTERED_TOOL, source: "envelope", outcome: "denied" }),
    );
    expect(run.record.authority.snapshots.length).toBeGreaterThan(0);
  });
});
