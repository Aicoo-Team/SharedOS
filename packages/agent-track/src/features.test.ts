import { describe, expect, it } from "vitest";

import type { AuditEvent } from "@aicoo/sharedos-core";

import { analyzeTrackRecord } from "./analyzer.js";
import { checkAlerts, criticalAlerts, warningAlerts } from "./alerts.js";
import { compareTrackRecords } from "./compare.js";
import { exportCSV, exportCSVComparison, exportPrometheus } from "./export.js";
import { computeToolBreakdown } from "./tools.js";
import { StreamingTracker } from "./streaming.js";
import { computeWindowedTrackRecord } from "./windows.js";
import type { TrackRecordStore, TurnRecord } from "./collector.js";

function makeEvent(
  agentId: string,
  type: string,
  outcome: string,
  opts: Partial<AuditEvent> = {},
): AuditEvent {
  return {
    version: "1",
    type: type as AuditEvent["type"],
    outcome: outcome as AuditEvent["outcome"],
    at: opts.at ?? new Date().toISOString(),
    traceId: "trace-1",
    namespaceId: "ns-1",
    actor: { kind: "agent", agentId },
    authority: { kind: "human", userId: "owner" },
    owner: { kind: "human", userId: "owner" },
    purpose: "test",
    ...opts,
  } as AuditEvent;
}

function makeTurn(
  agentId: string,
  turnId: string,
  outcome: "complete" | "fail" | "escalate",
  toolCalls: number,
  denials: number,
  escalations: number,
  startedAt: string,
  completedAt: string,
): TurnRecord {
  return { turnId, agentId, startedAt, completedAt, outcome, toolCalls, denials, escalations };
}

function makeStore(events: AuditEvent[], turns: TurnRecord[]): TrackRecordStore {
  const eventsByAgent = new Map<string, AuditEvent[]>();
  const turnsByAgent = new Map<string, TurnRecord[]>();

  for (const e of events) {
    if (e.actor.kind === "agent" && e.actor.agentId !== undefined) {
      let bucket = eventsByAgent.get(e.actor.agentId);
      if (bucket === undefined) {
        bucket = [];
        eventsByAgent.set(e.actor.agentId, bucket);
      }
      bucket.push(e);
    }
  }

  for (const t of turns) {
    let bucket = turnsByAgent.get(t.agentId);
    if (bucket === undefined) {
      bucket = [];
      turnsByAgent.set(t.agentId, bucket);
    }
    bucket.push(t);
  }

  return { events: eventsByAgent, turns: turnsByAgent };
}

describe("compareTrackRecords", () => {
  const events: AuditEvent[] = [
    makeEvent("agent-a", "authorization.checked", "allowed", {
      tool: "t1",
      action: "a",
      at: "2025-01-01T00:00:00Z",
    }),
    makeEvent("agent-a", "authorization.checked", "allowed", {
      tool: "t1",
      action: "a",
      at: "2025-01-01T00:00:01Z",
    }),
    makeEvent("agent-b", "authorization.checked", "denied", {
      tool: "t2",
      action: "a",
      reason: "no_matching_grant",
      at: "2025-01-01T00:00:00Z",
    }),
    makeEvent("agent-b", "authorization.checked", "denied", {
      tool: "t2",
      action: "a",
      reason: "no_matching_grant",
      at: "2025-01-01T00:00:01Z",
    }),
  ];

  const turns: TurnRecord[] = [
    makeTurn("agent-a", "a1", "complete", 2, 0, 0, "2025-01-01T00:00:00Z", "2025-01-01T00:00:02Z"),
    makeTurn("agent-b", "b1", "escalate", 2, 2, 1, "2025-01-01T00:00:00Z", "2025-01-01T00:00:02Z"),
  ];

  it("computes pairwise diffs", () => {
    const store = makeStore(events, turns);
    const comparison = compareTrackRecords(store, ["agent-a", "agent-b"]);

    expect(comparison.agents).toHaveLength(2);
    expect(comparison.pairwise).toHaveLength(1);
    expect(comparison.pairwise[0]!.agentA).toBe("agent-a");
    expect(comparison.pairwise[0]!.agentB).toBe("agent-b");
    expect(comparison.pairwise[0]!.metrics.authorizationRate.delta).toBe(1);
  });

  it("ranks agents by authorization rate", () => {
    const store = makeStore(events, turns);
    const comparison = compareTrackRecords(store, ["agent-a", "agent-b"]);

    expect(comparison.rankings.byAuthorizationRate[0]!.agentId).toBe("agent-a");
    expect(comparison.rankings.byAuthorizationRate[1]!.agentId).toBe("agent-b");
  });

  it("ranks agents by edge probe score", () => {
    const store = makeStore(events, turns);
    const comparison = compareTrackRecords(store, ["agent-a", "agent-b"]);

    expect(comparison.rankings.byEdgeProbeScore[0]!.agentId).toBe("agent-b");
  });
});

describe("checkAlerts", () => {
  const events: AuditEvent[] = [
    makeEvent("agent-1", "authorization.checked", "denied", {
      tool: "t",
      action: "a",
      reason: "no_matching_grant",
      at: "2025-01-01T00:00:00Z",
    }),
    makeEvent("agent-1", "authorization.checked", "denied", {
      tool: "t",
      action: "a",
      reason: "no_matching_grant",
      at: "2025-01-01T00:00:01Z",
    }),
    makeEvent("agent-1", "authorization.checked", "denied", {
      tool: "t",
      action: "a",
      reason: "no_matching_grant",
      at: "2025-01-01T00:00:02Z",
    }),
    makeEvent("agent-1", "authorization.checked", "allowed", {
      tool: "t",
      action: "a",
      at: "2025-01-01T00:00:03Z",
    }),
  ];
  const turns: TurnRecord[] = [
    makeTurn("agent-1", "t1", "escalate", 2, 2, 1, "2025-01-01T00:00:00Z", "2025-01-01T00:00:02Z"),
  ];

  it("returns empty when within bounds", () => {
    const store = makeStore(events, turns);
    const record = analyzeTrackRecord(store, "agent-1");
    const alerts = checkAlerts(record, { minEdgeProbeScore: 0.99 });
    expect(alerts).toHaveLength(0);
  });

  it("triggers edge probe score alert", () => {
    const store = makeStore(events, turns);
    const record = analyzeTrackRecord(store, "agent-1");
    const alerts = checkAlerts(record, { minEdgeProbeScore: 0.1 });
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0]!.metric).toBe("edgeProbeScore");
  });

  it("triggers authorization rate alert", () => {
    const store = makeStore(events, turns);
    const record = analyzeTrackRecord(store, "agent-1");
    const alerts = checkAlerts(record, { maxAuthorizationRate: 0.5 });
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0]!.metric).toBe("authorizationRate");
  });

  it("criticalAlerts filters only critical", () => {
    const store = makeStore(events, turns);
    const record = analyzeTrackRecord(store, "agent-1");
    const critical = criticalAlerts(record, { maxTotalDenials: 0 });
    expect(critical.every((a) => a.severity === "critical")).toBe(true);
  });

  it("warningAlerts filters only warnings", () => {
    const store = makeStore(events, turns);
    const record = analyzeTrackRecord(store, "agent-1");
    const warnings = warningAlerts(record, { minEdgeProbeScore: 0.1 });
    expect(warnings.every((a) => a.severity === "warning")).toBe(true);
  });
});

describe("computeToolBreakdown", () => {
  const events: AuditEvent[] = [
    makeEvent("a", "authorization.checked", "allowed", {
      tool: "files.search",
      action: "search",
      at: "2025-01-01T00:00:00Z",
    }),
    makeEvent("a", "authorization.checked", "denied", {
      tool: "files.delete",
      action: "delete",
      reason: "no_matching_grant",
      at: "2025-01-01T00:00:01Z",
    }),
    makeEvent("a", "authorization.checked", "denied", {
      tool: "files.delete",
      action: "delete",
      reason: "no_matching_grant",
      at: "2025-01-01T00:00:02Z",
    }),
    makeEvent("a", "authorization.checked", "allowed", {
      tool: "files.search",
      action: "search",
      at: "2025-01-01T00:00:03Z",
    }),
  ];

  it("breaks down stats per tool", () => {
    const store = makeStore(events, []);
    const breakdown = computeToolBreakdown(store, "a");

    expect(breakdown.tools).toHaveLength(2);
    expect(breakdown.summary.uniqueToolsAttempted).toBe(2);
    expect(breakdown.summary.uniqueToolsDenied).toBe(1);
    expect(breakdown.summary.mostAttemptedTool).toBe("files.search");
  });

  it("detects retry-after-denial", () => {
    const store = makeStore(events, []);
    const breakdown = computeToolBreakdown(store, "a");

    const deleteStats = breakdown.tools.find((t) => t.tool === "files.delete");
    expect(deleteStats).toBeDefined();
    expect(deleteStats!.retriedAfterDenial).toBe(true);
  });

  it("filters by time window", () => {
    const store = makeStore(events, []);
    const breakdown = computeToolBreakdown(store, "a", {
      from: "2025-01-01T00:00:02Z",
      to: "2025-01-01T00:00:04Z",
    });
    // Only 2 events in window
    expect(breakdown.tools.reduce((sum, t) => sum + t.totalAttempts, 0)).toBe(2);
  });
});

describe("computeWindowedTrackRecord", () => {
  const events: AuditEvent[] = [
    makeEvent("a", "authorization.checked", "allowed", {
      tool: "t",
      action: "a",
      at: "2025-01-01T00:00:00Z",
    }),
    makeEvent("a", "authorization.checked", "denied", {
      tool: "t",
      action: "a",
      reason: "x",
      at: "2025-01-01T00:00:01Z",
    }),
  ];
  const turns: TurnRecord[] = [
    makeTurn("a", "t1", "complete", 1, 0, 0, "2025-01-01T00:00:00Z", "2025-01-01T00:00:01Z"),
  ];

  it("computes windowed records", () => {
    const store = makeStore(events, turns);
    const result = computeWindowedTrackRecord(store, "a", "2025-01-01T01:00:00Z");
    expect(result.windows.length).toBeGreaterThan(0);
    expect(result.latest).toBeDefined();
  });
});

describe("StreamingTracker", () => {
  it("tracks events incrementally", () => {
    const tracker = new StreamingTracker();
    tracker.pushEvent(
      makeEvent("a", "authorization.checked", "allowed", { tool: "t", action: "a" }),
    );
    tracker.pushEvent(
      makeEvent("a", "authorization.checked", "denied", { tool: "t", action: "a", reason: "x" }),
    );

    const snapshot = tracker.snapshot("a");
    expect(snapshot).toBeDefined();
    expect(snapshot!.totalAllowed).toBe(1);
    expect(snapshot!.totalDenied).toBe(1);
    expect(snapshot!.authorizationRate).toBe(0.5);
  });

  it("tracks turns incrementally", () => {
    const tracker = new StreamingTracker();
    tracker.pushEvent(
      makeEvent("a", "authorization.checked", "allowed", { tool: "t", action: "a" }),
    );
    tracker.pushTurn(makeTurn("a", "t1", "complete", 1, 0, 0, "", ""));

    const snapshot = tracker.snapshot("a");
    expect(snapshot!.totalTurns).toBe(1);
    expect(snapshot!.totalToolCalls).toBe(1);
  });

  it("returns all snapshots", () => {
    const tracker = new StreamingTracker();
    tracker.pushEvent(
      makeEvent("a", "authorization.checked", "allowed", { tool: "t", action: "a" }),
    );
    tracker.pushEvent(
      makeEvent("b", "authorization.checked", "denied", { tool: "t", action: "a", reason: "x" }),
    );

    expect(tracker.agents()).toEqual(["a", "b"]);
    expect(tracker.allSnapshots()).toHaveLength(2);
  });
});

describe("exportCSV", () => {
  it("exports single agent as CSV", () => {
    const events: AuditEvent[] = [
      makeEvent("a", "authorization.checked", "allowed", {
        tool: "t",
        action: "a",
        at: "2025-01-01T00:00:00Z",
      }),
    ];
    const store = makeStore(events, []);
    const record = analyzeTrackRecord(store, "a");

    const csv = exportCSV(record);
    expect(csv).toContain("agentId,metric,value");
    expect(csv).toContain('"a",totalTurns,0');
  });

  it("exports comparison CSV", () => {
    const events: AuditEvent[] = [
      makeEvent("a", "authorization.checked", "allowed", {
        tool: "t",
        action: "a",
        at: "2025-01-01T00:00:00Z",
      }),
      makeEvent("b", "authorization.checked", "denied", {
        tool: "t",
        action: "a",
        reason: "x",
        at: "2025-01-01T00:00:00Z",
      }),
    ];
    const store = makeStore(events, []);
    const records = ["a", "b"].map((id) => analyzeTrackRecord(store, id));

    const csv = exportCSVComparison(records);
    expect(csv).toContain("agentId,totalTurns");
    expect(csv).toContain('"a"');
    expect(csv).toContain('"b"');
  });
});

describe("exportPrometheus", () => {
  it("exports Prometheus format", () => {
    const events: AuditEvent[] = [
      makeEvent("a", "authorization.checked", "allowed", {
        tool: "t",
        action: "a",
        at: "2025-01-01T00:00:00Z",
      }),
    ];
    const store = makeStore(events, []);
    const record = analyzeTrackRecord(store, "a");

    const prom = exportPrometheus(record);
    expect(prom).toContain('sharedos_agent_track_authorization_rate{agent_id="a"}');
    expect(prom).toContain("# TYPE sharedos_agent_track_authorization_rate gauge");
  });
});
