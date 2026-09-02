import { describe, expect, it } from "vitest";

import type { AccessContext } from "@aicoo/sharedos-contracts";

import { mintCapabilityRequest } from "./capability-request.js";

const ACTOR = { kind: "agent", agentId: "agent-bob" } as const;
const OWNER = { kind: "human", userId: "user-alice" } as const;

function context(overrides: Partial<AccessContext> = {}): AccessContext {
  return {
    namespaceId: "world-alpha",
    enabledToolNamespaces: ["files"],
    actor: ACTOR,
    authority: OWNER,
    owner: OWNER,
    purpose: "prepare-update",
    traceId: "trace-1",
    now: "2026-08-03T09:00:00.000Z",
    ...overrides,
  };
}

const ASK = {
  capabilities: [
    {
      resource: { namespace: "files", path: ["Memory"] },
      actions: ["read"],
      scope: "exact" as const,
    },
  ],
  purpose: "prepare-update",
};

describe("mintCapabilityRequest", () => {
  it("states identity from the context and derives the id from the ask", async () => {
    const minted = await mintCapabilityRequest(context(), ASK);

    expect(minted).toEqual({
      id: expect.stringMatching(/^capreq-[0-9a-f]{64}$/u) as unknown as string,
      namespaceId: "world-alpha",
      requester: ACTOR,
      owner: OWNER,
      capabilities: ASK.capabilities,
      purpose: "prepare-update",
      requestedAt: "2026-08-03T09:00:00.000Z",
    });
  });

  it("gives one ask one identifier across turns, and a different ask a different one", async () => {
    const first = await mintCapabilityRequest(context(), ASK);
    const later = await mintCapabilityRequest(context({ now: "2026-08-04T09:00:00.000Z" }), ASK);
    const annotated = await mintCapabilityRequest(context(), { ...ASK, metadata: { note: "x" } });
    const constrained = await mintCapabilityRequest(context(), {
      ...ASK,
      constraints: { maxUses: 1 },
    });
    const elsewhere = await mintCapabilityRequest(context({ namespaceId: "world-beta" }), ASK);

    // `requestedAt` and `metadata` are recorded but not part of what the ask is.
    expect(later?.id).toBe(first?.id);
    expect(later?.requestedAt).not.toBe(first?.requestedAt);
    expect(annotated?.id).toBe(first?.id);
    expect(annotated?.metadata).toEqual({ note: "x" });
    // A constraint and a namespace are.
    expect(constrained?.id).not.toBe(first?.id);
    expect(elsewhere?.id).not.toBe(first?.id);
  });

  it("discards what a caller wrote about identity rather than refusing it", async () => {
    const minted = await mintCapabilityRequest(context(), {
      ...ASK,
      id: "chosen-by-caller",
      namespaceId: "world-other",
      requester: { kind: "agent", agentId: "agent-mallory" },
      owner: { kind: "human", userId: "user-mallory" },
      requestedAt: "2000-01-01T00:00:00.000Z",
    } as typeof ASK);

    expect(minted).toMatchObject({
      namespaceId: "world-alpha",
      requester: ACTOR,
      owner: OWNER,
      requestedAt: "2026-08-03T09:00:00.000Z",
    });
    expect(minted?.id).toBe((await mintCapabilityRequest(context(), ASK))?.id);
  });

  it("does not let an explicit undefined split one ask into two identifiers", async () => {
    const omitted = await mintCapabilityRequest(context(), ASK);
    const explicit = await mintCapabilityRequest(context(), {
      ...ASK,
      capabilities: [
        {
          ...ASK.capabilities[0]!,
          resource: { ...ASK.capabilities[0]!.resource, owner: undefined },
        },
      ],
    });

    expect(explicit?.id).toBe(omitted?.id);
    expect(explicit?.capabilities[0]?.resource).not.toHaveProperty("owner");
  });

  it("answers undefined to an ask the contract refuses", async () => {
    await expect(
      mintCapabilityRequest(context(), { ...ASK, capabilities: [] }),
    ).resolves.toBeUndefined();
    await expect(
      mintCapabilityRequest(context(), { ...ASK, purpose: "" }),
    ).resolves.toBeUndefined();
  });
});
