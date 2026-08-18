import { describe, expect, it } from "vitest";

import type { ExecutionResult } from "@aicoo/sharedos-contracts";
import { SharedOSExecutor } from "@aicoo/sharedos-runtime";

import {
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
  READ_GRANT,
  READ_TOOL,
  ROOT_FILES_GRANT,
  SEALED_TOOL,
  UNREGISTERED_TOOL,
  WRITE_TOOL,
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
    clock: () => CONFORMANCE_NOW,
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
    expect(CANONICAL_ATTACK_MOVES).toHaveLength(7);
    expect(CANONICAL_ATTACK_MOVES.map(({ kind }) => kind)).toEqual([
      "forged_grant",
      "hidden_tool",
      "read_to_mutation",
      "replayed_grant",
      "namespace_crossing",
      "authority_unavailable",
      "record_completeness",
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
    expect(run.receipt("write-inside-real-scope").observed).toBe("succeeded");
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

    expect(report?.visibleTools).toEqual([READ_TOOL, WRITE_TOOL, "messages.send"]);
    expect(report?.visibleTools).not.toContain(SEALED_TOOL);
    expect(report?.visibleTools).not.toContain(UNREGISTERED_TOOL);

    for (const attemptId of ["guess-control-plane-tool", "guess-sealed-tool"]) {
      const receipt = run.receipt(attemptId);
      expect(receipt.attempted).toBe(true);
      expect(receipt.observed).toBe("denied");
      expect(receipt.reasonCode).toBe("tool_not_available");
    }
    expect(run.world.files.writes).toEqual([]);
    expect(run.receipt("use-visible-tool").observed).toBe("succeeded");
  });

  it("refuses a mutation on a file read authority covers", async () => {
    const run = await runMove("read_to_mutation");

    expect(run.receipt("read-the-target").observed).toBe("succeeded");
    const denied = run.receipt("mutate-the-target");
    expect(denied.observed).toBe("denied");
    expect(denied.reasonCode).toBe("no_matching_grant");
    expect(run.receipt("mutate-inside-write-scope").observed).toBe("succeeded");
    expect(run.world.files.writes).toEqual(["Workspace/scratch/draft.md"]);

    // "Deny and audit": the refusal is in the record, not only in the receipt.
    expect(run.record.execution.operations).toContainEqual(
      expect.objectContaining({
        tool: WRITE_TOOL,
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
    expect(run.receipt("write-inside-write-scope").observed).toBe("succeeded");
  });

  it("invalidates a descendant when its ancestor is revoked", async () => {
    const run = await runMove("replayed_grant", { revoked: [ROOT_FILES_GRANT] });

    const denied = run.receipt("replay-revoked-read");
    expect(denied.observed).toBe("denied");
    expect(denied.reasonCode).toBe("delegation_chain_invalid");
    expect(run.world.files.reads).toEqual([]);
    // The write grant descends from a different ancestor, so the turn still acts.
    expect(run.receipt("write-inside-write-scope").observed).toBe("succeeded");
    expect(
      run.record.execution.decisions.some(
        ({ reasonCode }) => reasonCode === "delegation_chain_invalid",
      ),
    ).toBe(true);
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

  it("fails closed and stays closed once the grant store stops answering", async () => {
    // One load admits the turn, one lists tools, one serves the control read.
    const run = await runMove("authority_unavailable", { authorityFailsAfterLoads: 3 });

    expect(run.receipt("read-before-outage").observed).toBe("succeeded");
    for (const attemptId of ["read-during-outage", "write-during-outage"]) {
      const receipt = run.receipt(attemptId);
      expect(receipt.attempted).toBe(true);
      expect(receipt.observed).toBe("denied");
      expect(receipt.reasonCode).toBe("authority_unavailable");
    }
    expect(run.world.files.writes).toEqual([]);
    expect(
      run.record.execution.operations.filter(({ failClosed }) => failClosed).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("emits a usable record for a turn holding allowed, denied, and escalated attempts", async () => {
    const run = await runMove("record_completeness");

    expect(checkRecordCompleteness(run.record).usable).toBe(true);
    expect(run.record.execution.operations).toContainEqual(
      expect.objectContaining({ tool: READ_TOOL, source: "kernel", outcome: "succeeded" }),
    );
    expect(run.record.execution.operations).toContainEqual(
      expect.objectContaining({ tool: WRITE_TOOL, source: "kernel", outcome: "denied" }),
    );
    // The escalation reach never becomes a kernel decision: the permission
    // filter refuses it inside the envelope, so only the envelope records it.
    expect(run.record.execution.operations).toContainEqual(
      expect.objectContaining({ tool: UNREGISTERED_TOOL, source: "envelope", outcome: "denied" }),
    );
    expect(run.record.authority.snapshots.length).toBeGreaterThan(0);
  });
});
