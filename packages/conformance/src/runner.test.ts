import { describe, expect, it } from "vitest";

import { HostileRuntime, type AttackMove } from "./adversary.js";
import { judgeCase } from "./judge.js";
import { canonicalMove } from "./moves.js";
import {
  EMBEDDED_COLUMN,
  renderConformanceSummary,
  runConformanceSuite,
  strictFailures,
  type RuntimeColumn,
} from "./runner.js";
import { CANONICAL_CONFORMANCE_CASES, type ConformanceCase } from "./suite.js";
import { READ_ONLY_FILE, READ_TOOL, WRITE_TOOL } from "./world.js";

/** A move whose control attempt cannot succeed, standing in for a broken fixture. */
const BROKEN_CONTROL: AttackMove = {
  id: "broken-control",
  kind: "read_to_mutation",
  invariant: "Use a read grant for a mutation",
  expectedOutcome: "Deny and audit",
  attempts: [
    {
      id: "impossible-control",
      role: "control",
      description: "A control that cannot succeed, because no write authority covers this path.",
      tool: WRITE_TOOL,
      toolArguments: { path: [...READ_ONLY_FILE] },
      expect: { statuses: ["succeeded"] },
    },
    {
      id: "the-attack",
      role: "attack",
      description: "The attack itself, which the kernel does refuse.",
      tool: WRITE_TOOL,
      toolArguments: { path: [...READ_ONLY_FILE] },
      expect: { statuses: ["denied"], reasonCodes: ["no_matching_grant"] },
    },
  ],
};

/** A move whose declared expectation is wrong, standing in for a real regression. */
const WRONG_EXPECTATION: AttackMove = {
  id: "wrong-expectation",
  kind: "read_to_mutation",
  invariant: "Use a read grant for a mutation",
  expectedOutcome: "Deny and audit",
  attempts: [
    {
      id: "should-have-been-denied",
      role: "attack",
      description: "An authorized read the row wrongly claims must be denied.",
      tool: READ_TOOL,
      toolArguments: { path: [...READ_ONLY_FILE] },
      expect: { statuses: ["denied"], reasonCodes: ["no_matching_grant"] },
    },
  ],
};

function caseOf(move: AttackMove): ConformanceCase {
  return {
    id: move.id,
    move,
    conditions: [{ id: "baseline", description: "Nothing armed.", world: {} }],
  };
}

describe("the conformance suite", () => {
  it("covers every canonical move, and splits a two-clause row into conditions", () => {
    expect(CANONICAL_CONFORMANCE_CASES).toHaveLength(7);
    const replay = CANONICAL_CONFORMANCE_CASES.find(({ id }) => id === "replayed-grant");
    expect(replay?.conditions.map(({ id }) => id)).toEqual(["grant-revoked", "ancestor-revoked"]);
  });

  it("passes every row and reports where each was refused", async () => {
    const { manifest, evidence } = await runConformanceSuite();

    expect(manifest.rows).toHaveLength(8);
    expect(
      manifest.rows.flatMap(({ cells }) => cells).every(({ status }) => status === "pass"),
    ).toBe(true);
    expect(strictFailures(manifest)).toEqual([]);
    expect(evidence).toHaveLength(8);

    const byCase = (caseId: string, conditionId = "baseline") =>
      manifest.rows.find((row) => row.caseId === caseId && row.conditionId === conditionId)
        ?.cells[0];

    // The unexposed-tool row never reaches the kernel; the mutation row does.
    expect(byCase("hidden-tool")?.refusedBy).toEqual(["envelope"]);
    expect(byCase("read-to-mutation")?.refusedBy).toEqual(["kernel"]);
    expect(byCase("replayed-grant", "grant-revoked")?.reasonCodes).toEqual(["no_matching_grant"]);
    expect(byCase("replayed-grant", "ancestor-revoked")?.reasonCodes).toEqual([
      "delegation_chain_invalid",
    ]);
    const outage = byCase("authority-unavailable", "outage-at-turn-boundary");
    expect(outage?.reasonCodes).toEqual(["authority_unavailable"]);
    // The turn is refused before the runtime runs, so every declared attempt is
    // reported as structurally unreachable rather than as never exercised.
    expect(outage?.attempted).toBe(0);
    expect(outage?.notApplicable).toBe(outage?.declared);
    expect(outage?.detail).toMatch(/before the runtime was started/u);
    expect(byCase("namespace-crossing")?.notApplicable).toBe(1);
  });

  it("produces the same manifest on every run", async () => {
    const first = await runConformanceSuite();
    const second = await runConformanceSuite();

    expect(JSON.stringify(second.manifest)).toBe(JSON.stringify(first.manifest));
    expect(renderConformanceSummary(second.manifest)).toBe(
      renderConformanceSummary(first.manifest),
    );
  });

  it("keeps volatile runtime identity out of the committed manifest", async () => {
    const { manifest, evidence } = await runConformanceSuite();
    const serialized = JSON.stringify(manifest);

    // Version, model, and timing live in the evidence artifact, so a manifest
    // diff means enforcement changed rather than metadata churned.
    expect(serialized).not.toContain(evidence[0]?.runtime.version);
    expect(serialized).not.toContain("startedAt");
    expect(serialized).not.toContain("elapsedMs");
    expect(evidence[0]?.runtime.id).toBe("sharedos.conformance.hostile");
  });

  it("reports a broken fixture as not exercised rather than as a pass", async () => {
    const { manifest } = await runConformanceSuite({ cases: [caseOf(BROKEN_CONTROL)] });
    const cell = manifest.rows[0]?.cells[0];

    expect(cell?.status).toBe("not_exercised");
    expect(cell?.detail).toMatch(/control attempt/u);
    expect(strictFailures(manifest)).toHaveLength(1);
  });

  it("fails a row whose attempt did not meet its declared outcome", async () => {
    const { manifest } = await runConformanceSuite({ cases: [caseOf(WRONG_EXPECTATION)] });

    expect(manifest.rows[0]?.cells[0]?.status).toBe("fail");
    expect(strictFailures(manifest)[0]?.status).toBe("fail");
  });

  it("runs one case set across several columns", async () => {
    const second: RuntimeColumn = {
      id: "sharedos-embedded-b",
      label: "Second",
      create: (moves) => new HostileRuntime(moves, { runtimeId: "sharedos.conformance.hostile.b" }),
    };
    const { manifest } = await runConformanceSuite({
      cases: [CANONICAL_CONFORMANCE_CASES[2] as ConformanceCase],
      columns: [EMBEDDED_COLUMN, second],
    });

    expect(manifest.columns.map(({ label }) => label)).toEqual(["Standard", "Second"]);
    expect(manifest.rows[0]?.cells.map(({ status }) => status)).toEqual(["pass", "pass"]);
  });

  it("names the case definitions the manifest came from", async () => {
    const full = await runConformanceSuite();
    const partial = await runConformanceSuite({
      cases: [CANONICAL_CONFORMANCE_CASES[0] as ConformanceCase],
    });

    expect(full.manifest.caseSetHash).toMatch(/^[0-9a-f]{64}$/u);
    expect(partial.manifest.caseSetHash).not.toBe(full.manifest.caseSetHash);
  });
});

describe("grading", () => {
  it("treats a missing receipt as not exercised, never as a pass", () => {
    const judgement = judgeCase(canonicalMove("hidden_tool"), {
      receipts: [],
      record: emptyRecord(),
    });

    expect(judgement.status).toBe("not_exercised");
    expect(judgement.attempts.every(({ status }) => status === "not_exercised")).toBe(true);
    expect(judgement.attempted).toBe(0);
  });
});

function emptyRecord(): Parameters<typeof judgeCase>[1]["record"] {
  const hash = "f".repeat(64);
  return {
    version: "1",
    recordedAt: "2026-08-18T09:00:00.000Z",
    experiment: {
      experimentId: "e",
      taskId: "t",
      runId: "r",
      specHash: hash,
      worldHash: hash,
      evaluatorHash: hash,
    },
    system: {
      protocolVersion: "1",
      sharedOsVersion: "0",
      runtime: { id: "none", version: "0", protocolVersion: "1" },
      adapterId: "none",
      policyHash: hash,
    },
    authority: {
      principal: { kind: "human", userId: "u" },
      actor: { kind: "agent", agentId: "a" },
      owner: { kind: "human", userId: "u" },
      namespaceId: "n",
      purpose: "p",
      snapshots: [],
    },
    execution: {
      executionId: "x",
      traceId: "t",
      agent: { kind: "agent", agentId: "a" },
      status: "denied",
      exposedTools: [],
      requestedTools: [],
      decisions: [],
      operations: [],
      events: [],
    },
    state: {},
    cost: {
      startedAt: "2026-08-18T09:00:00.000Z",
      completedAt: "2026-08-18T09:00:00.000Z",
      elapsedMs: 0,
      toolCalls: 0,
      authorityLoads: 0,
      auditEvents: 0,
    },
  };
}
