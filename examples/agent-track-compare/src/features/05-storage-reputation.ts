/**
 * Persistent Storage Adapter
 *
 * Shows how to use the adapter interface for production storage backends.
 */

import type { AuditEvent } from "@aicoo/sharedos-core";
import {
  InMemoryTrackRecordAdapter,
  loadStoreFromAdapter,
  analyzeTrackRecord,
  createSignedSnapshot,
  verifySignedSnapshot,
  importSignedSnapshot,
  createTrackRecordStore,
  addEvent,
} from "@aicoo/sharedos-agent-track";

function makeEvent(tool: string, outcome: string): AuditEvent {
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
    action: "use",
  } as AuditEvent;
}

async function main() {
  console.log("  PERSISTENT STORAGE ADAPTER");
  console.log("  " + "-".repeat(50));

  // 1. Use the adapter
  const adapter = new InMemoryTrackRecordAdapter();
  await adapter.appendEvent("agent-1", makeEvent("files.search", "allowed"));
  await adapter.appendEvent("agent-1", makeEvent("files.search", "allowed"));
  await adapter.appendEvent("agent-1", makeEvent("files.delete", "denied"));

  const agents = await adapter.listAgents();
  console.log(`  Agents stored: ${agents.join(", ")}`);

  // 2. Load into analyzer
  const store = await loadStoreFromAdapter(adapter);
  const record = analyzeTrackRecord(store, "agent-1");
  console.log(`  Auth rate: ${(record.summary.authorizationRate * 100).toFixed(0)}%`);

  // 3. Export full snapshot
  const snapshot = await adapter.exportAll();
  console.log(`  Snapshot: ${snapshot.version}, ${Object.keys(snapshot.events).length} agents`);

  // 4. Import into another adapter
  const adapter2 = new InMemoryTrackRecordAdapter();
  await adapter2.replaceAll(snapshot);
  const agents2 = await adapter2.listAgents();
  console.log(`  After import: ${agents2.join(", ")}`);
  console.log();
}

async function reputationDemo() {
  console.log("  REPUTATION PROTOCOL");
  console.log("  " + "-".repeat(50));

  const store = createTrackRecordStore();
  addEvent(store, makeEvent("files.search", "allowed"));
  addEvent(store, makeEvent("files.search", "allowed"));

  const secretKey = "my-secret-key-123";

  // Sign
  const signed = createSignedSnapshot(store, "agent-1", secretKey, "host-1");
  console.log(`  Signed by: ${signed.signedBy}`);
  console.log(`  Signature: ${signed.signature.slice(0, 16)}...`);

  // Verify
  const valid = verifySignedSnapshot(signed, secretKey);
  console.log(`  Valid: ${valid}`);

  // Tamper check — modify the snapshot (which is signed)
  const tampered = {
    ...signed,
    snapshot: {
      ...signed.snapshot,
      events: { "hacker-agent": [] },
    },
  };
  const tamperedValid = verifySignedSnapshot(tampered, secretKey);
  console.log(`  Tampered:  ${tamperedValid} (expected false)`);

  // Import
  const otherStore = createTrackRecordStore();
  const imported = importSignedSnapshot(otherStore, signed, secretKey);
  console.log(`  Imported: ${imported}`);
  console.log();
}

main().then(reputationDemo);
