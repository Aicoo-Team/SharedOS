import type { AccessContext } from "@aicoo/sharedos-contracts";
import { describe, expect, it } from "vitest";

import { auditEvent } from "./audit.js";
import { hashJson } from "./hashing.js";

const CONTEXT: AccessContext = {
  namespaceId: "world-alpha",
  enabledToolNamespaces: ["files"],
  actor: { kind: "agent", agentId: "agent-bob" },
  authority: { kind: "human", userId: "user-alice" },
  owner: { kind: "human", userId: "user-alice" },
  purpose: "prepare-update",
  traceId: "trace-1",
  now: "2026-08-03T09:00:00.000Z",
};

describe("auditEvent", () => {
  it("gives each record an identity of its own, so two that read the same are still two", async () => {
    const first = auditEvent(CONTEXT, { type: "authorization.checked", outcome: "allowed" });
    const second = auditEvent(CONTEXT, { type: "authorization.checked", outcome: "allowed" });

    // Everything but the id is the same record: same turn, same instant, same
    // question. That is the case a content-keyed store collapsed.
    const { id: firstId, ...firstContent } = first;
    const { id: secondId, ...secondContent } = second;
    expect(firstId).not.toBe(secondId);
    expect(await hashJson(firstContent)).toBe(await hashJson(secondContent));
    expect(await hashJson(first)).not.toBe(await hashJson(second));
  });

  it("takes its identity from the factory a host supplies", () => {
    let sequence = 0;
    const mint = () => `audit-${(sequence += 1)}`;

    expect(auditEvent(CONTEXT, { type: "turn.ended", outcome: "succeeded" }, mint).id).toBe(
      "audit-1",
    );
    expect(auditEvent(CONTEXT, { type: "turn.ended", outcome: "succeeded" }, mint).id).toBe(
      "audit-2",
    );
  });

  it("stamps the record from the trusted context and freezes it", () => {
    const event = auditEvent(CONTEXT, { type: "turn.ended", outcome: "succeeded" });

    expect(event).toMatchObject({
      version: "1",
      at: CONTEXT.now,
      traceId: CONTEXT.traceId,
      namespaceId: CONTEXT.namespaceId,
      actor: CONTEXT.actor,
      authority: CONTEXT.authority,
      owner: CONTEXT.owner,
      purpose: CONTEXT.purpose,
    });
    expect(typeof event.id).toBe("string");
    expect(Object.isFrozen(event)).toBe(true);
  });
});
