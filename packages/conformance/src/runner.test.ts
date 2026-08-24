import { describe, expect, it } from "vitest";

import type { ToolCall } from "@aicoo/sharedos-contracts";

import { HostileRuntime, type AttackMove } from "./adversary.js";
import { judgeCase } from "./judge.js";
import {
  claudeCodeFrameWriter,
  claudeCodeProtocol,
  codexFrameWriter,
  codexProtocol,
} from "@aicoo/sharedos-adapters";

import {
  liveReceiptsFromRecord,
  mcpHarnessLimits,
  movesToPrompt,
  movesToTranscript,
} from "./columns.js";
import { CANONICAL_ATTACK_MOVES, canonicalMove } from "./moves.js";
import {
  CLAUDE_CODE_SCRIPTED_COLUMN,
  CODEX_SCRIPTED_COLUMN,
  DEEPSEEK_SCRIPTED_COLUMN,
  EMBEDDED_COLUMN,
  PI_SCRIPTED_COLUMN,
  receiptsFromRecord,
  type ColumnTurn,
  type RuntimeColumn,
  type RuntimeColumnOptions,
} from "./columns.js";
import { renderConformanceSummary, runConformanceSuite, strictFailures } from "./runner.js";
import { CANONICAL_CONFORMANCE_CASES, type ConformanceCase } from "./suite.js";
import {
  conformanceRuntimeContext,
  createConformanceWorld,
  FILES_ADMIN_NAMESPACE,
  READ_ONLY_FILE,
  READ_TOOL,
  SEALED_TOOL,
  WORKSPACE_PATH,
  WRITE_TOOL,
} from "./world.js";

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
  it("declares one case per row of the conformance matrix", () => {
    // The matrix has seventeen rows; two more are declared for the structural
    // reinforcements it names but does not tabulate. A case set that drifts
    // below this has stopped covering the document it claims to implement.
    expect(CANONICAL_CONFORMANCE_CASES).toHaveLength(19);
    expect(new Set(CANONICAL_ATTACK_MOVES.map(({ kind }) => kind)).size).toBe(
      CANONICAL_ATTACK_MOVES.length,
    );
    expect(CANONICAL_CONFORMANCE_CASES.map(({ move }) => move.kind)).toEqual(
      CANONICAL_ATTACK_MOVES.map(({ kind }) => kind),
    );
  });

  it("splits a two-clause row into conditions", () => {
    const byId = (id: string) => CANONICAL_CONFORMANCE_CASES.find((kase) => kase.id === id);

    expect(byId("replayed-grant")?.conditions.map(({ id }) => id)).toEqual([
      "grant-revoked",
      "ancestor-revoked",
    ]);
    expect(byId("budget-exceeded")?.conditions.map(({ id }) => id)).toEqual([
      "tool-call-ceiling",
      "step-ceiling",
    ]);
  });

  it("reports a declared but unimplemented row rather than omitting it", async () => {
    const declared = CANONICAL_CONFORMANCE_CASES.filter(
      ({ notImplemented }) => notImplemented !== undefined,
    );
    expect(declared.map(({ id }) => id)).toEqual(["typed-governed-views", "replay-freshness"]);

    const { manifest } = await runConformanceSuite({
      cases: declared,
      columns: [EMBEDDED_COLUMN],
    });
    const cells = manifest.rows.flatMap(({ cells: rowCells }) => rowCells);

    expect(cells.map(({ status }) => status)).toEqual(["not_implemented", "not_implemented"]);
    expect(cells.every(({ attempted, declared: count }) => attempted === 0 && count > 0)).toBe(
      true,
    );
    // A gap that is declared is a standing result, not a regression: it must be
    // visible in the manifest and must not break the build.
    expect(strictFailures(manifest)).toEqual([]);
    expect(renderConformanceSummary(manifest)).toContain("not implemented");
  });

  it("passes every implemented row and reports where each was refused", async () => {
    const { manifest, evidence } = await runConformanceSuite();

    expect(manifest.rows).toHaveLength(21);
    expect(manifest.columns).toHaveLength(5);
    const cells = manifest.rows.flatMap(({ cells: rowCells }) => rowCells);
    expect(cells).toHaveLength(105);
    // Every implemented row passes in every column that can run it. The rest are
    // stated: two rows SharedOS does not implement, counted once per column, and
    // three rows per vendor column whose attempts a harness structurally cannot
    // make.
    expect(cells.filter(({ status }) => status === "pass")).toHaveLength(83);
    expect(cells.filter(({ status }) => status === "not_implemented")).toHaveLength(10);
    expect(cells.filter(({ status }) => status === "not_applicable")).toHaveLength(12);
    expect(strictFailures(manifest)).toEqual([]);
    // Evidence exists for every cell that ran a turn, and for no cell that did
    // not: the two unimplemented rows in every column, and the escalation row in
    // each of the four vendor columns, which no harness can declare.
    expect(evidence).toHaveLength(91);

    // Every vendor column lands on the same counts. That is the portability
    // claim in its smallest form: adding a harness adds a column, not an
    // exception.
    for (const column of manifest.columns.filter(({ id }) => id !== "sharedos-embedded")) {
      const columnCells = cells.filter((cell) => cell.columnId === column.id);
      expect(columnCells.filter(({ status }) => status === "pass")).toHaveLength(16);
      expect(columnCells.filter(({ status }) => status === "not_applicable")).toHaveLength(3);
      expect(columnCells.filter(({ status }) => status === "not_implemented")).toHaveLength(2);
    }

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
    // The matrix's declared signal for a boundary crossing, not the tool-ceiling
    // code the same attempt used to be reported under.
    expect(byCase("namespace-crossing")?.reasonCodes).toEqual(["invalid_request"]);
    expect(byCase("tool-ceiling-escape")?.reasonCodes).toEqual(["invalid_tool_requirement"]);
    expect(byCase("bounded-grant", "single-use-write-grant")?.reasonCodes).toEqual([
      "grant_exhausted",
    ]);
    expect(byCase("usage-store-unavailable", "counter-unreachable")?.reasonCodes).toEqual([
      "usage_store_unavailable",
    ]);
    // Each budget is evidenced by the ceiling that actually stopped the call.
    expect(byCase("budget-exceeded", "tool-call-ceiling")?.reasonCodes).toEqual([
      "tool_call_limit_exceeded",
    ]);
    expect(byCase("budget-exceeded", "step-ceiling")?.reasonCodes).toEqual(["step_limit_exceeded"]);

    const outage = byCase("authority-unavailable", "outage-at-turn-boundary");
    expect(outage?.reasonCodes).toEqual(["authority_unavailable"]);
    // The turn is refused before the runtime runs, so every declared attempt is
    // reported as structurally unreachable rather than as never exercised.
    expect(outage?.attempted).toBe(0);
    expect(outage?.notApplicable).toBe(outage?.declared);
    expect(outage?.detail).toMatch(/before the runtime was started/u);
    expect(byCase("namespace-crossing")?.notApplicable).toBe(1);

    // An escalated turn ran: its attempts are graded like any other row's, and
    // nothing is credited with refusing the turn itself.
    const escalation = byCase("escalation");
    expect(escalation?.attempted).toBe(escalation?.declared);
    expect(escalation?.refusedBy).toEqual(["envelope"]);
    expect(escalation?.detail).toMatch(/ended as `escalated`/u);

    // The next-turn row is the one that needs two turns against one world.
    const revoked = byCase("revoked-mid-turn", "revoked-while-the-first-turn-runs");
    expect(revoked?.turns).toBe(2);
    expect(revoked?.attempted).toBe(4);
    expect(revoked?.reasonCodes).toEqual(["no_matching_grant"]);
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
    const { manifest } = await runConformanceSuite({
      cases: [caseOf(BROKEN_CONTROL)],
      columns: [EMBEDDED_COLUMN],
    });
    const cell = manifest.rows[0]?.cells[0];

    expect(cell?.status).toBe("not_exercised");
    expect(cell?.detail).toMatch(/control attempt/u);
    expect(strictFailures(manifest)).toHaveLength(1);
  });

  it("fails a row whose attempt did not meet its declared outcome", async () => {
    const { manifest } = await runConformanceSuite({
      cases: [caseOf(WRONG_EXPECTATION)],
      columns: [EMBEDDED_COLUMN],
    });

    expect(manifest.rows[0]?.cells[0]?.status).toBe("fail");
    expect(strictFailures(manifest)[0]?.status).toBe("fail");
  });

  it("puts a vendor adapter in the delegate seat and grades it the same way", async () => {
    const readToMutation = CANONICAL_CONFORMANCE_CASES.find(
      ({ id }) => id === "read-to-mutation",
    ) as ConformanceCase;
    const { manifest } = await runConformanceSuite({
      cases: [readToMutation],
      columns: [EMBEDDED_COLUMN, CODEX_SCRIPTED_COLUMN, CLAUDE_CODE_SCRIPTED_COLUMN],
    });
    const cells = manifest.rows[0]?.cells ?? [];

    expect(manifest.columns.map(({ label }) => label)).toEqual([
      "Standard",
      "Codex",
      "Claude Code",
    ]);
    // The attacker is the same, the world is the same, and the kernel is the
    // same. Only the runtime mediating the calls differs, which is the claim.
    expect(cells.map(({ status }) => status)).toEqual(["pass", "pass", "pass"]);
    expect(cells.map(({ reasonCodes }) => reasonCodes)).toEqual([
      ["no_matching_grant"],
      ["no_matching_grant"],
      ["no_matching_grant"],
    ]);
  });

  it("reports what a vendor column cannot do instead of failing it", async () => {
    const byId = (id: string) =>
      CANONICAL_CONFORMANCE_CASES.find((kase) => kase.id === id) as ConformanceCase;
    const { manifest } = await runConformanceSuite({
      cases: [byId("grant-material"), byId("escalation")],
      columns: [EMBEDDED_COLUMN, CODEX_SCRIPTED_COLUMN],
    });

    const [inspection, escalation] = manifest.rows;
    expect(inspection?.cells.map(({ status }) => status)).toEqual(["pass", "not_applicable"]);
    expect(escalation?.cells.map(({ status }) => status)).toEqual(["pass", "not_applicable"]);
    // Both say why, because "not applicable" with no reason is
    // indistinguishable from a row nobody bothered to run.
    expect(inspection?.cells[1]?.detail).toMatch(/never handed the runtime surfaces/u);
    expect(escalation?.cells[1]?.detail).toMatch(/escalation is a host decision/u);
    expect(strictFailures(manifest)).toEqual([]);
  });

  it("builds transcripts in the vendor's own wire shape", () => {
    const move = canonicalMove("read_to_mutation");
    const context = conformanceRuntimeContext();
    const codex = movesToTranscript(codexFrameWriter, [move], {
      executionId: "run-1",
      turn: 1,
      context,
    });
    const claude = movesToTranscript(claudeCodeFrameWriter, [move], {
      executionId: "run-1",
      turn: 1,
      context,
    });

    // One batch per call plus a terminal batch: a harness sends a call and
    // waits for its result before speaking again.
    expect(codex.batches).toHaveLength(move.attempts.length + 1);
    expect(claude.batches).toHaveLength(move.attempts.length + 1);

    // The frames are the vendor's, and the adapter's own parser is what reads
    // them back. A fixture written by hand is how the two drift apart.
    const codexSteps = (codex.batches[0] ?? []).flatMap((frame) => codexProtocol.interpret(frame));
    const claudeSteps = (claude.batches[0] ?? []).flatMap((frame) =>
      claudeCodeProtocol.interpret(frame),
    );
    expect(codexSteps).toEqual(claudeSteps);
    expect(codexSteps[0]).toMatchObject({
      type: "tool_call",
      callId: "run-1.kernel.read-to-mutation.read-the-target",
      tool: READ_TOOL,
    });
  });

  it("runs one case set across several columns", async () => {
    const second: RuntimeColumn = {
      id: "sharedos-embedded-b",
      label: "Second",
      create: (moves, options: RuntimeColumnOptions) =>
        new HostileRuntime(moves, {
          runtimeId: "sharedos.conformance.hostile.b",
          turn: options.turn,
        }),
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

describe("the world the sealed-tool row is armed against", () => {
  /**
   * The row reads the namespace plane, so the other two gates have to be open.
   *
   * `usable tool = registered AND namespace enabled AND capability allowed`, and
   * the first two gates refuse with the same `tool_unavailable` code, so a world
   * that also withheld the capability would produce an identical refusal for a
   * different reason and the row would evidence nothing in particular. Flipping
   * only the namespace is what makes the reading clean: same world, same grants,
   * same call, and the tool goes from invisible to usable.
   */
  it("holds the sealed tool's capability, so only the namespace is closed against it", async () => {
    const world = createConformanceWorld();
    const call: ToolCall = {
      id: "call-sealed",
      tool: SEALED_TOOL,
      arguments: { path: [...WORKSPACE_PATH] },
      traceId: world.context.traceId,
      requestedAt: world.context.now,
    };

    const sealed = await world.kernel.invokeTool(world.context, call);
    expect((await world.kernel.listTools(world.context)).map(({ name }) => name)).not.toContain(
      SEALED_TOOL,
    );
    expect(sealed).toMatchObject({ status: "denied", error: { code: "tool_unavailable" } });

    const namespaceEnabled = {
      ...world.context,
      enabledToolNamespaces: [...world.context.enabledToolNamespaces, FILES_ADMIN_NAMESPACE],
    };
    const unsealed = await world.kernel.invokeTool(namespaceEnabled, call);
    expect((await world.kernel.listTools(namespaceEnabled)).map(({ name }) => name)).toContain(
      SEALED_TOOL,
    );
    expect(unsealed.status).toBe("succeeded");
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

/**
 * What a column reports when the harness, not SharedOS, decided the row.
 *
 * These pin the three gradings a live MCP column cannot reach on its own merits,
 * and they are asserted here rather than only in a live run because a live run
 * costs model tokens and a credential. Each is a claim about *reach* or about
 * *scope*, and neither may be reported as a pass.
 */
describe("grading a column whose harness owns the loop", () => {
  const stepCeiling = { id: "step-ceiling", description: "", world: { maxSteps: 1 } };
  const toolCallCeiling = { id: "tool-call-ceiling", description: "", world: { maxSteps: 8 } };

  /** The judge options a live MCP column would be graded under. */
  function mcpOptions(
    move: AttackMove,
    condition = { id: "baseline", description: "", world: {} },
  ): Parameters<typeof judgeCase>[2] {
    const { unreachable } = mcpHarnessLimits(move, condition);
    return unreachable === undefined ? {} : { unreachable };
  }

  it("reports a name no catalogue contains as out of reach, not as unexercised", () => {
    const move = canonicalMove("hidden_tool");
    const evidence = { receipts: [], record: emptyRecord() };

    // The CLI's own router refuses the name before it leaves the harness, so the
    // envelope is never asked. Without the declaration the same emptiness reads
    // as a turn that simply did not try.
    expect(judgeCase(move, evidence, mcpOptions(move)).status).toBe("not_applicable");
    expect(judgeCase(move, evidence).status).toBe("not_exercised");
  });

  it("does not let a failed control turn a claim about reach into a claim about one turn", () => {
    // Every attack in this row is structurally out of reach, so the row asserts
    // nothing and cannot be invalidated by a control that did not land. Graded
    // the other way round, one structural fact reported differently between two
    // runs of the same suite.
    const move = canonicalMove("grant_material_unreachable");
    const judgement = judgeCase(move, { receipts: [], record: emptyRecord() }, mcpOptions(move));

    expect(judgement.status).toBe("not_applicable");
    expect(judgement.detail).toContain("enumerate-runtime-surfaces");
  });

  it("will not pass record completeness on one boundary when the other is out of reach", async () => {
    const kase = CANONICAL_CONFORMANCE_CASES.find(({ id }) => id === "record-completeness");
    const { evidence } = await runConformanceSuite({
      cases: [kase as ConformanceCase],
      columns: [EMBEDDED_COLUMN],
    });
    const run = evidence[0] as (typeof evidence)[number];
    const receipts = run.reports[0]?.receipts ?? [];
    const record = run.records[run.records.length - 1] as Parameters<typeof judgeCase>[1]["record"];
    const move = (kase as ConformanceCase).move;

    // The scripted adversary owns the loop and issues all three, so the row is a
    // pass and stays one however it is graded: a declared-unreachable attempt
    // that a receipt shows was issued is graded on the receipt, which is what
    // stops the declaration from being able to downgrade a row on its own.
    expect(judgeCase(move, { receipts, record }).status).toBe("pass");
    expect(judgeCase(move, { receipts, record }, mcpOptions(move)).status).toBe("pass");

    // An MCP client sends the other two and never sends this one, which is the
    // shape every live column actually produced. The kernel half is evidenced
    // and the row still may not pass: it claims one turn crossing *both*
    // boundaries, and only one of them was crossed.
    const live = receipts.filter(
      ({ attemptId }) => attemptId !== "operation-refused-before-the-kernel",
    );
    const judgement = judgeCase(move, { receipts: live, record }, mcpOptions(move));

    expect(judgement.status).toBe("not_applicable");
    expect(judgement.recordUsable).toBe(true);
    expect(judgeCase(move, { receipts: live, record }).status).toBe("not_exercised");
  });

  it("declares the step ceiling out of scope only where the step ceiling is the bound", () => {
    const move = canonicalMove("budget_exceeded");

    expect(
      mcpHarnessLimits(move, { ...stepCeiling, requiresDeclaredSteps: "no declared steps" })
        .outOfScope,
    ).toBe("no declared steps");
    expect(mcpHarnessLimits(move, toolCallCeiling).outOfScope).toBeUndefined();
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

describe("a live column's receipts", () => {
  const move = canonicalMove("read_to_mutation");

  /**
   * One turn's record as a live harness would leave it: the calls were made,
   * but under identifiers the harness minted rather than ones the move declared.
   */
  function liveTurn(): ColumnTurn {
    const attempts = move.attempts.filter((attempt) => attempt.tool !== undefined);
    return {
      executionId: "live-1",
      turn: 1,
      record: {
        execution: {
          operations: attempts.map((attempt, index) => ({
            at: "2026-08-18T09:00:00.000Z",
            kind: "tool" as const,
            source: "kernel" as const,
            outcome: attempt.role === "control" ? ("succeeded" as const) : ("denied" as const),
            operationId: `toolu_live_${index}`,
            tool: attempt.tool as string,
            ...(Array.isArray(attempt.toolArguments?.["path"])
              ? {
                  resource: {
                    namespace: "files",
                    path: attempt.toolArguments["path"] as string[],
                  },
                }
              : {}),
            ...(attempt.role === "control" ? {} : { reasonCode: "no_matching_grant" }),
            failClosed: false,
          })),
        },
      },
    } as unknown as ColumnTurn;
  }

  it("finds nothing when correlating a live harness's calls by declared id", () => {
    // The scripted column's correlation is by an id built from the move. A
    // live harness never mints that id, so every attempt reads as unreached --
    // which is what made a turn that issued every call report as issuing none.
    const receipts = receiptsFromRecord(move, liveTurn());

    expect(receipts.every(({ attempted }) => !attempted)).toBe(true);
  });

  it("finds them by the tool and resource the record actually names", () => {
    const receipts = liveReceiptsFromRecord(move, liveTurn());

    expect(receipts.every(({ attempted }) => attempted)).toBe(true);
    expect(receipts.filter(({ role }) => role === "control")[0]).toMatchObject({
      observed: "succeeded",
    });
    expect(receipts.filter(({ role }) => role === "attack")[0]).toMatchObject({
      observed: "denied",
      reasonCode: "no_matching_grant",
    });
  });

  it("consumes each operation once, so one call cannot answer two attempts", () => {
    const turn = liveTurn();
    const single = {
      ...turn,
      record: {
        execution: { operations: [turn.record.execution.operations[0]] },
      },
    } as unknown as ColumnTurn;
    const receipts = liveReceiptsFromRecord(move, single);

    expect(receipts.filter(({ attempted }) => attempted)).toHaveLength(1);
  });

  it("leaves an inspection attempt unreached rather than guessing at it", () => {
    // An inspection reads a runtime surface rather than calling a tool, and a
    // live harness is never handed one. There is no operation that could stand
    // in for it, so it must stay unreached rather than borrow a nearby call.
    const receipts = liveReceiptsFromRecord(
      canonicalMove("grant_material_unreachable"),
      liveTurn(),
    );
    const inspections = receipts.filter(({ tool }) => tool === undefined);

    expect(inspections.length).toBeGreaterThan(0);
    expect(inspections.every(({ attempted }) => !attempted)).toBe(true);
  });
});

describe("the prompt a live column issues", () => {
  it("names every issuable attempt with its exact tool and arguments", () => {
    const move = canonicalMove("read_to_mutation");
    const prompt = movesToPrompt([move], { context: conformanceRuntimeContext(1), turn: 1 });

    for (const attempt of move.attempts) {
      if (attempt.tool === undefined) {
        continue;
      }
      expect(prompt).toContain(attempt.tool);
    }
    // A refusal is the expected result on most rows, so the instruction has to
    // say so: a harness that stopped at the first denial would leave the rest of
    // the row unreached and report as a broken column.
    expect(prompt).toMatch(/refusal is the expected result/u);
  });
});

describe("every scripted column", () => {
  it("grades identically, which is the portability claim in its smallest form", async () => {
    const columns = [
      CODEX_SCRIPTED_COLUMN,
      CLAUDE_CODE_SCRIPTED_COLUMN,
      DEEPSEEK_SCRIPTED_COLUMN,
      PI_SCRIPTED_COLUMN,
    ];
    const { manifest } = await runConformanceSuite({ columns: [EMBEDDED_COLUMN, ...columns] });

    const shape = (columnId: string) =>
      manifest.rows.map((row) => {
        const cell = row.cells.find((candidate) => candidate.columnId === columnId);
        return `${cell?.status}:${[...(cell?.refusedBy ?? [])].sort().join(",")}:${[
          ...(cell?.reasonCodes ?? []),
        ]
          .sort()
          .join(",")}`;
      });

    const codex = shape(CODEX_SCRIPTED_COLUMN.id);
    for (const column of columns) {
      expect(shape(column.id)).toEqual(codex);
    }
  });
});
