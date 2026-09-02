import type { AccessContext, Capability, CapabilityRequest } from "@aicoo/sharedos-contracts";
import { mintCapabilityRequest } from "@aicoo/sharedos-core";
import { describe, expect, it } from "vitest";

import { precedentKey, precedentKeyDigest } from "./key.js";

const OWNER = { kind: "human", userId: "owner-1" } as const;
const REQUESTER = { kind: "agent", agentId: "agent-a" } as const;

function context(now: string): AccessContext {
  return {
    namespaceId: "ns-1",
    actor: REQUESTER,
    authority: OWNER,
    owner: OWNER,
    purpose: "support triage",
    traceId: "trace-1",
    enabledToolNamespaces: [],
    now,
  };
}

const CAPABILITY: Capability = {
  resource: { namespace: "files", path: ["projects", "q3"] },
  actions: ["read", "search"],
  scope: "descendants",
};

async function requestAt(now: string): Promise<CapabilityRequest> {
  const request = await mintCapabilityRequest(context(now), {
    capabilities: [CAPABILITY],
    purpose: "support triage",
  });
  if (request === undefined) {
    throw new Error("fixture did not mint");
  }
  return request;
}

describe("the precedent key", () => {
  it("is the same question at a different instant, as the request id now is", async () => {
    const monday = await requestAt("2026-09-01T09:00:00.000Z");
    const tuesday = await requestAt("2026-09-02T09:00:00.000Z");

    // ADR 0019 keeps `requestedAt` out of the id, so one ask keeps one id
    // across turns. The key is still not the id: it also drops the requested
    // constraints, which R3 takes from the precedents rather than the ask.
    expect(monday.id).toEqual(tuesday.id);
    await expect(precedentKeyDigest(precedentKey(monday))).resolves.toEqual(
      await precedentKeyDigest(precedentKey(tuesday)),
    );
  });

  it("does not depend on the order a host lists actions or capabilities in", async () => {
    const request = await requestAt("2026-09-01T09:00:00.000Z");
    const second: Capability = {
      resource: { namespace: "files", path: ["projects", "q4"] },
      actions: ["read"],
      scope: "exact",
    };

    const forward = precedentKeyDigest({
      ...precedentKey(request),
      capabilities: [CAPABILITY, second],
    });
    const reversed = precedentKeyDigest({
      ...precedentKey(request),
      capabilities: [second, { ...CAPABILITY, actions: ["search", "read"] }],
    });

    await expect(forward).resolves.toEqual(await reversed);
  });

  it("reads an unowned resource as the key's own owner, because they denote one thing", async () => {
    const request = await requestAt("2026-09-01T09:00:00.000Z");
    const pinned = precedentKeyDigest({
      ...precedentKey(request),
      capabilities: [{ ...CAPABILITY, resource: { ...CAPABILITY.resource, owner: OWNER } }],
    });

    await expect(pinned).resolves.toEqual(await precedentKeyDigest(precedentKey(request)));
  });

  it("separates a different requester, purpose, namespace, or capability", async () => {
    const request = await requestAt("2026-09-01T09:00:00.000Z");
    const base = await precedentKeyDigest(precedentKey(request));
    const key = precedentKey(request);

    for (const variant of [
      { ...key, requester: { kind: "agent", agentId: "agent-b" } as const },
      { ...key, purpose: "marketing export" },
      { ...key, namespaceId: "ns-2" },
      { ...key, owner: { kind: "human", userId: "owner-2" } as const },
      { ...key, capabilities: [{ ...CAPABILITY, actions: ["read", "search", "write"] }] },
      { ...key, capabilities: [{ ...CAPABILITY, scope: "exact" as const }] },
    ]) {
      await expect(precedentKeyDigest(variant)).resolves.not.toEqual(base);
    }
  });
});
