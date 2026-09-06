/**
 * Precedent Integration
 *
 * Bridges track records into @aicoo/sharedos-precedent for richer context.
 */

import type { AuditEvent } from "@aicoo/sharedos-core";
import {
  TrackRecordPrecedentLookup,
  enrichWithContext,
  createTrackRecordStore,
  addEvent,
} from "@aicoo/sharedos-agent-track";

function makeEvent(tool: string, action: string, outcome: string, grantId?: string): AuditEvent {
  return {
    version: "1",
    type: "authorization.checked",
    outcome: outcome as AuditEvent["outcome"],
    at: "2025-01-01T00:00:00Z",
    traceId: "t",
    namespaceId: "ns",
    actor: { kind: "agent", agentId: "agent-1" },
    authority: { kind: "human", userId: "owner" },
    owner: { kind: "human", userId: "owner" },
    purpose: "demo",
    tool,
    action,
    ...(grantId !== undefined ? { grantId } : {}),
  } as AuditEvent;
}

async function main() {
  console.log("  PRECEDENT INTEGRATION");
  console.log("  " + "-".repeat(50));

  const store = createTrackRecordStore();
  addEvent(store, makeEvent("files.search", "search", "allowed", "g1"));
  addEvent(store, makeEvent("files.search", "search", "allowed", "g2"));
  addEvent(store, makeEvent("files.delete", "delete", "denied", "g3"));
  addEvent(store, makeEvent("files.delete", "delete", "denied", "g4"));
  addEvent(store, makeEvent("files.delete", "delete", "denied", "g5"));

  const owner = { kind: "human" as const, userId: "owner" };

  // 1. Use as PrecedentLookup
  const lookup = new TrackRecordPrecedentLookup(store, owner, "ns");
  const precedents = await lookup.load("ns", ["g3", "g4"]);
  console.log(`  Loaded ${precedents.length} precedents for grant IDs g3, g4`);
  for (const p of precedents) {
    console.log(`    ${p.outcome}: ${p.requestId} at ${p.decidedAt}`);
  }
  console.log();

  // 2. Enrich with context
  const context = enrichWithContext(store, "agent-1", "files.delete", "delete");
  console.log("  Track record context for files.delete:");
  console.log(`    Tool auth rate: ${(context.toolAuthorizationRate * 100).toFixed(0)}%`);
  console.log(`    Past denials:   ${context.pastDenials}`);
  console.log(`    Past allowances: ${context.pastAllowances}`);
  console.log(`    Retried:        ${context.retriedAfterDenial}`);
  console.log(`    Edge probe:     ${context.edgeProbeScore.toFixed(2)}`);
  console.log();
}

main();
