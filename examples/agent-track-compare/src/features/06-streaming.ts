/**
 * Streaming Analysis
 *
 * Incremental metric updates as events arrive, without full recomputation.
 */

import type { AuditEvent } from "@aicoo/sharedos-core";
import { StreamingTracker } from "@aicoo/sharedos-agent-track";

function makeEvent(agentId: string, outcome: string, tool = "files.search"): AuditEvent {
  return {
    version: "1",
    type: "authorization.checked",
    outcome: outcome as AuditEvent["outcome"],
    at: new Date().toISOString(),
    traceId: "t",
    namespaceId: "ns",
    actor: { kind: "agent", agentId },
    authority: { kind: "human", userId: "owner" },
    owner: { kind: "human", userId: "owner" },
    purpose: "demo",
    tool,
    action: "use",
  } as AuditEvent;
}

const tracker = new StreamingTracker();

console.log("  STREAMING ANALYSIS");
console.log("  " + "-".repeat(50));

// Simulate events arriving one by one
const events = [
  makeEvent("good-agent", "allowed"),
  makeEvent("good-agent", "allowed"),
  makeEvent("good-agent", "allowed"),
  makeEvent("risky-agent", "allowed"),
  makeEvent("risky-agent", "denied", "files.delete"),
  makeEvent("risky-agent", "denied", "files.delete"),
  makeEvent("risky-agent", "denied", "files.write"),
  makeEvent("risky-agent", "denied", "admin.users"),
];

for (let i = 0; i < events.length; i++) {
  tracker.pushEvent(events[i]!);

  // Print snapshot after each event
  const goodSnap = tracker.snapshot("good-agent");
  const riskySnap = tracker.snapshot("risky-agent");

  if (i === 3 || i === 7) {
    console.log(`  After event ${i + 1}:`);
    if (goodSnap !== undefined) {
      console.log(
        `    good-agent:  auth ${(goodSnap.authorizationRate * 100).toFixed(0)}%  probe ${goodSnap.edgeProbeScore.toFixed(2)}  (${goodSnap.totalAllowed}A/${goodSnap.totalDenied}D)`,
      );
    }
    if (riskySnap !== undefined) {
      console.log(
        `    risky-agent: auth ${(riskySnap.authorizationRate * 100).toFixed(0)}%  probe ${riskySnap.edgeProbeScore.toFixed(2)}  (${riskySnap.totalAllowed}A/${riskySnap.totalDenied}D)`,
      );
    }
    console.log();
  }
}

console.log(`  Tracked agents: ${tracker.agents().join(", ")}`);
console.log();
