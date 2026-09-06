import { createHash } from "node:crypto";

import type { TrackRecordSummary } from "./analyzer.js";
import { serializeStore, type SerializedTrackRecordStore } from "./collector.js";
import type { TrackRecordStore } from "./collector.js";

/**
 * A signed track record snapshot for cross-host reputation transfer.
 *
 * The snapshot is a self-contained, tamper-evident record of an agent's
 * track record at a point in time. The signature is a SHA-256 hash of
 * the serialized snapshot plus a secret key.
 */
export interface SignedTrackRecordSnapshot {
  readonly version: "1";
  readonly snapshot: SerializedTrackRecordStore;
  readonly summary: TrackRecordSummary;
  readonly agentId: string;
  readonly signedAt: string;
  readonly signedBy: string;
  readonly signature: string;
}

/**
 * Create a signed snapshot from a track record store.
 *
 * The signature binds the snapshot to a signing identity (a host, a
 * namespace, or a key). A recipient can verify the signature by
 * recomputing it with the same secret.
 *
 * @param store - The track record store.
 * @param agentId - The agent whose record to snapshot.
 * @param signingKey - A secret key for signing (not transmitted).
 * @param signedBy - The identity of the signer (e.g., host ID).
 */
export function createSignedSnapshot(
  store: TrackRecordStore,
  agentId: string,
  signingKey: string,
  signedBy: string,
): SignedTrackRecordSnapshot {
  const snapshot = serializeStore(store);

  // Extract summary from the store
  const events = store.events.get(agentId) ?? [];
  const turns = store.turns.get(agentId) ?? [];
  const authEvents = events.filter((e) => e.type === "authorization.checked");

  const allowed = authEvents.filter((e) => e.outcome === "allowed").length;
  const denied = authEvents.filter((e) => e.outcome === "denied").length;
  const totalAuth = allowed + denied;

  const totalDenials = turns.reduce((sum, t) => sum + t.denials, 0);
  const totalEscalations = turns.reduce((sum, t) => sum + t.escalations, 0);
  const totalToolCalls = turns.reduce((sum, t) => sum + t.toolCalls, 0);

  // Compute denial breakdown
  let registration = 0;
  let capabilityGrant = 0;
  let infrastructure = 0;
  let productCeiling = 0;
  for (const event of authEvents) {
    if (event.outcome !== "denied") continue;
    const reason = event.reason ?? "";
    if (reason.includes("tool_unavailable") || reason.includes("namespace_disabled"))
      registration++;
    else if (reason.includes("host_policy")) productCeiling++;
    else if (reason.includes("usage_store") || reason.includes("authority")) infrastructure++;
    else capabilityGrant++;
  }

  const summary: TrackRecordSummary = {
    totalTurns: turns.length,
    totalToolCalls,
    authorizationRate: totalAuth > 0 ? allowed / totalAuth : 1,
    escalationRate: turns.length > 0 ? totalEscalations / turns.length : 0,
    denialBreakdown: { registration, capabilityGrant, infrastructure, productCeiling },
    edgeProbeScore: 0,
  };

  // Compute edge probe score
  const denialRatio = totalAuth > 0 ? totalDenials / totalAuth : 0;
  const escRate = turns.length > 0 ? totalEscalations / turns.length : 0;
  const edgeProbeScore = Math.min(1, denialRatio * 0.5 + escRate * 0.2);

  const summaryWithScore = { ...summary, edgeProbeScore };

  // Sign the snapshot
  const signedAt = new Date().toISOString();
  const payload = JSON.stringify({ snapshot, agentId, signedAt });
  const signature = createHash("sha256")
    .update(payload + signingKey)
    .digest("hex");

  return {
    version: "1",
    snapshot,
    summary: summaryWithScore,
    agentId,
    signedAt,
    signedBy,
    signature,
  };
}

/**
 * Verify a signed snapshot's signature.
 *
 * Returns true if the signature is valid for the given signing key.
 *
 * @param signed - The signed snapshot to verify.
 * @param signingKey - The secret key used to sign.
 */
export function verifySignedSnapshot(
  signed: SignedTrackRecordSnapshot,
  signingKey: string,
): boolean {
  const payload = JSON.stringify({
    snapshot: signed.snapshot,
    agentId: signed.agentId,
    signedAt: signed.signedAt,
  });
  const expected = createHash("sha256")
    .update(payload + signingKey)
    .digest("hex");
  return signed.signature === expected;
}

/**
 * Import a signed snapshot into a track record store.
 *
 * Verifies the signature before importing. Returns false if the
 * signature is invalid.
 *
 * @param store - The store to import into.
 * @param signed - The signed snapshot.
 * @param signingKey - The key to verify against.
 */
export function importSignedSnapshot(
  store: TrackRecordStore,
  signed: SignedTrackRecordSnapshot,
  signingKey: string,
): boolean {
  if (!verifySignedSnapshot(signed, signingKey)) {
    return false;
  }

  // Merge events
  for (const [agentId, events] of Object.entries(signed.snapshot.events)) {
    let bucket = store.events.get(agentId);
    if (bucket === undefined) {
      bucket = [];
      store.events.set(agentId, bucket);
    }
    for (const event of events) {
      // Avoid duplicates by checking traceId + at + tool
      const isDuplicate = bucket.some(
        (e) => e.traceId === event.traceId && e.at === event.at && e.tool === event.tool,
      );
      if (!isDuplicate) {
        (bucket as AuditEvent[]).push(event);
      }
    }
  }

  // Merge turns
  for (const [agentId, turns] of Object.entries(signed.snapshot.turns)) {
    let bucket = store.turns.get(agentId);
    if (bucket === undefined) {
      bucket = [];
      store.turns.set(agentId, bucket);
    }
    for (const turn of turns) {
      const isDuplicate = bucket.some((t) => t.turnId === turn.turnId);
      if (!isDuplicate) {
        (bucket as TurnRecord[]).push(turn);
      }
    }
  }

  return true;
}

import type { AuditEvent } from "@aicoo/sharedos-core";
import type { TurnRecord } from "./collector.js";
