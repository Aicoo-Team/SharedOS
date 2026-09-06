import { describe, expect, it } from "vitest";

import type { AuditEvent } from "@aicoo/sharedos-core";

import { analyzeTrackRecord } from "./analyzer.js";
import type { TrackRecordStore } from "./collector.js";

function makeAuditEvent(
  overrides: Partial<AuditEvent> & { type: string; outcome: string },
): AuditEvent {
  return {
    version: "1",
    at: "2025-01-01T00:00:00.000Z",
    traceId: "trace-1",
    namespaceId: "ns-1",
    actor: { kind: "agent", agentId: "test-agent" },
    authority: { kind: "human", userId: "owner" },
    owner: { kind: "human", userId: "owner" },
    purpose: "test",
    ...overrides,
  } as AuditEvent;
}

function makeStore(
  agentId: string,
  events: AuditEvent[],
  turns: TrackRecordStore["turns"] extends Map<infer K, infer V> ? Map<K, V> : never = new Map(),
): TrackRecordStore {
  return {
    events: new Map([[agentId, events]]),
    turns,
  };
}

describe("analyzeTrackRecord", () => {
  it("returns zeroed summary for empty history", () => {
    const store = makeStore("agent-1", []);
    const record = analyzeTrackRecord(store, "agent-1");

    expect(record.agentId).toBe("agent-1");
    expect(record.summary.totalTurns).toBe(0);
    expect(record.summary.totalToolCalls).toBe(0);
    expect(record.summary.authorizationRate).toBe(1);
    expect(record.summary.escalationRate).toBe(0);
    expect(record.summary.edgeProbeScore).toBe(0);
    expect(record.precedents).toEqual([]);
    expect(record.turns).toEqual([]);
  });

  it("computes 100% authorization rate when all allowed", () => {
    const events = [
      makeAuditEvent({
        type: "authorization.checked",
        outcome: "allowed",
        tool: "files.search",
        action: "search",
      }),
      makeAuditEvent({
        type: "authorization.checked",
        outcome: "allowed",
        tool: "files.read",
        action: "read",
      }),
      makeAuditEvent({
        type: "authorization.checked",
        outcome: "allowed",
        tool: "files.search",
        action: "search",
      }),
    ];

    const store = makeStore("agent-1", events);
    const record = analyzeTrackRecord(store, "agent-1");

    expect(record.summary.authorizationRate).toBe(1);
    expect(record.summary.denialBreakdown.registration).toBe(0);
    expect(record.summary.denialBreakdown.capabilityGrant).toBe(0);
    expect(record.summary.denialBreakdown.infrastructure).toBe(0);
    expect(record.summary.denialBreakdown.productCeiling).toBe(0);
    expect(record.summary.edgeProbeScore).toBe(0);
  });

  it("computes low authorization rate when mostly denied", () => {
    const events = [
      makeAuditEvent({
        type: "authorization.checked",
        outcome: "allowed",
        tool: "files.search",
        action: "search",
      }),
      makeAuditEvent({
        type: "authorization.checked",
        outcome: "denied",
        reason: "no_matching_grant",
        tool: "files.delete",
        action: "delete",
      }),
      makeAuditEvent({
        type: "authorization.checked",
        outcome: "denied",
        reason: "no_matching_grant",
        tool: "files.delete",
        action: "delete",
      }),
      makeAuditEvent({
        type: "authorization.checked",
        outcome: "denied",
        reason: "no_matching_grant",
        tool: "files.delete",
        action: "delete",
      }),
    ];

    const store = makeStore("agent-1", events);
    const record = analyzeTrackRecord(store, "agent-1");

    expect(record.summary.authorizationRate).toBe(0.25);
    expect(record.summary.denialBreakdown.capabilityGrant).toBe(3);
    expect(record.summary.edgeProbeScore).toBeGreaterThan(0.3);
  });

  it("classifies registration denials", () => {
    const events = [
      makeAuditEvent({
        type: "authorization.checked",
        outcome: "denied",
        reason: "tool_unavailable",
        tool: "unknown.tool",
        action: "do",
      }),
      makeAuditEvent({
        type: "authorization.checked",
        outcome: "denied",
        reason: "namespace_disabled",
        tool: "disabled.tool",
        action: "do",
      }),
    ];

    const store = makeStore("agent-1", events);
    const record = analyzeTrackRecord(store, "agent-1");

    expect(record.summary.denialBreakdown.registration).toBe(2);
    expect(record.summary.denialBreakdown.capabilityGrant).toBe(0);
  });

  it("classifies infrastructure denials", () => {
    const events = [
      makeAuditEvent({
        type: "authorization.checked",
        outcome: "denied",
        reason: "usage_store_unavailable",
        tool: "t",
        action: "a",
      }),
      makeAuditEvent({
        type: "authorization.checked",
        outcome: "denied",
        reason: "authority_unavailable",
        tool: "t",
        action: "a",
      }),
      makeAuditEvent({
        type: "authorization.checked",
        outcome: "denied",
        reason: "delegation_chain_invalid",
        tool: "t",
        action: "a",
      }),
    ];

    const store = makeStore("agent-1", events);
    const record = analyzeTrackRecord(store, "agent-1");

    expect(record.summary.denialBreakdown.infrastructure).toBe(3);
  });

  it("classifies product ceiling denials", () => {
    const events = [
      makeAuditEvent({
        type: "authorization.checked",
        outcome: "denied",
        reason: "host_policy_denied",
        tool: "t",
        action: "a",
      }),
      makeAuditEvent({
        type: "authorization.checked",
        outcome: "denied",
        reason: "host_policy_unavailable",
        tool: "t",
        action: "a",
      }),
    ];

    const store = makeStore("agent-1", events);
    const record = analyzeTrackRecord(store, "agent-1");

    expect(record.summary.denialBreakdown.productCeiling).toBe(2);
  });

  it("detects retry-after-denial patterns (edge probing)", () => {
    const events = [
      makeAuditEvent({
        type: "authorization.checked",
        outcome: "denied",
        reason: "no_matching_grant",
        tool: "files.delete",
        action: "delete",
        at: "2025-01-01T00:00:00.000Z",
      }),
      makeAuditEvent({
        type: "authorization.checked",
        outcome: "denied",
        reason: "no_matching_grant",
        tool: "files.delete",
        action: "delete",
        at: "2025-01-01T00:00:01.000Z",
      }),
      makeAuditEvent({
        type: "authorization.checked",
        outcome: "denied",
        reason: "no_matching_grant",
        tool: "files.delete",
        action: "delete",
        at: "2025-01-01T00:00:02.000Z",
      }),
      makeAuditEvent({
        type: "authorization.checked",
        outcome: "allowed",
        tool: "files.search",
        action: "search",
        at: "2025-01-01T00:00:03.000Z",
      }),
    ];

    const store = makeStore("agent-1", events);
    const record = analyzeTrackRecord(store, "agent-1");

    // 3 denials, each retried after -> retry score = 1.0
    // denial ratio = 0.75
    // edge probe = 0.75 * 0.5 + 1.0 * 0.3 = 0.675
    expect(record.summary.edgeProbeScore).toBeGreaterThan(0.5);
    expect(record.summary.edgeProbeScore).toBeLessThanOrEqual(1);
  });

  it("builds precedents from authorization events", () => {
    const events = [
      makeAuditEvent({
        type: "authorization.checked",
        outcome: "allowed",
        tool: "files.search",
        action: "search",
        grantId: "g1",
        at: "2025-01-01T00:00:00.000Z",
      }),
      makeAuditEvent({
        type: "authorization.checked",
        outcome: "denied",
        reason: "no_matching_grant",
        tool: "files.delete",
        action: "delete",
        at: "2025-01-01T00:00:01.000Z",
      }),
    ];

    const store = makeStore("agent-1", events);
    const record = analyzeTrackRecord(store, "agent-1");

    expect(record.precedents).toHaveLength(2);
    expect(record.precedents[0]).toEqual({
      tool: "files.search",
      action: "search",
      outcome: "allowed",
      reasonCode: "unknown",
      at: "2025-01-01T00:00:00.000Z",
      grantId: "g1",
    });
    expect(record.precedents[1]).toEqual({
      tool: "files.delete",
      action: "delete",
      outcome: "denied",
      reasonCode: "no_matching_grant",
      at: "2025-01-01T00:00:01.000Z",
      grantId: undefined,
    });
  });

  it("summarizes turn records", () => {
    const turns = new Map([
      [
        "agent-1",
        [
          {
            turnId: "turn-1",
            agentId: "agent-1",
            startedAt: "2025-01-01T00:00:00.000Z",
            completedAt: "2025-01-01T00:00:05.000Z",
            outcome: "complete" as const,
            toolCalls: 5,
            denials: 0,
            escalations: 0,
          },
          {
            turnId: "turn-2",
            agentId: "agent-1",
            startedAt: "2025-01-01T00:01:00.000Z",
            completedAt: "2025-01-01T00:01:10.000Z",
            outcome: "escalate" as const,
            toolCalls: 3,
            denials: 2,
            escalations: 1,
          },
        ],
      ],
    ]);

    const store = makeStore("agent-1", [], turns);
    const record = analyzeTrackRecord(store, "agent-1");

    expect(record.summary.totalTurns).toBe(2);
    expect(record.summary.totalToolCalls).toBe(8);
    expect(record.summary.escalationRate).toBe(0.5);
    expect(record.turns).toHaveLength(2);
    expect(record.turns[0]!.outcome).toBe("complete");
    expect(record.turns[1]!.outcome).toBe("escalate");
  });

  it("filters by time window", () => {
    const events = [
      makeAuditEvent({
        type: "authorization.checked",
        outcome: "allowed",
        tool: "t",
        action: "a",
        at: "2025-01-01T00:00:00.000Z",
      }),
      makeAuditEvent({
        type: "authorization.checked",
        outcome: "denied",
        reason: "x",
        tool: "t",
        action: "a",
        at: "2025-01-02T00:00:00.000Z",
      }),
      makeAuditEvent({
        type: "authorization.checked",
        outcome: "allowed",
        tool: "t",
        action: "a",
        at: "2025-01-03T00:00:00.000Z",
      }),
    ];

    const store = makeStore("agent-1", events);
    const record = analyzeTrackRecord(store, "agent-1", {
      from: "2025-01-02T00:00:00.000Z",
      to: "2025-01-03T00:00:00.000Z",
    });

    // Only the middle and last events are in the window
    expect(record.precedents).toHaveLength(2);
    expect(record.summary.authorizationRate).toBe(0.5);
  });

  it("returns zeroed summary for unknown agent", () => {
    const store = makeStore("agent-1", []);
    const record = analyzeTrackRecord(store, "unknown-agent");

    expect(record.agentId).toBe("unknown-agent");
    expect(record.summary.totalTurns).toBe(0);
    expect(record.summary.authorizationRate).toBe(1);
  });

  it("handles mixed denial categories", () => {
    const events = [
      makeAuditEvent({
        type: "authorization.checked",
        outcome: "denied",
        reason: "tool_unavailable",
        tool: "a",
        action: "a",
      }),
      makeAuditEvent({
        type: "authorization.checked",
        outcome: "denied",
        reason: "no_matching_grant",
        tool: "b",
        action: "b",
      }),
      makeAuditEvent({
        type: "authorization.checked",
        outcome: "denied",
        reason: "usage_store_unavailable",
        tool: "c",
        action: "c",
      }),
      makeAuditEvent({
        type: "authorization.checked",
        outcome: "denied",
        reason: "host_policy_denied",
        tool: "d",
        action: "d",
      }),
      makeAuditEvent({ type: "authorization.checked", outcome: "allowed", tool: "e", action: "e" }),
    ];

    const store = makeStore("agent-1", events);
    const record = analyzeTrackRecord(store, "agent-1");

    expect(record.summary.denialBreakdown).toEqual({
      registration: 1,
      capabilityGrant: 1,
      infrastructure: 1,
      productCeiling: 1,
    });
    expect(record.summary.authorizationRate).toBe(0.2);
  });
});
