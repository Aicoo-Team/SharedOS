import { describe, expect, it } from "vitest";

import type {
  AccessContext,
  Address,
  CapabilityGrant,
  ResourceRef,
} from "@aicoo/sharedos-contracts";

import {
  type CapabilityGrantVerifier,
  CapabilityAuthorizer,
  type GrantUsageStore,
  InMemoryGrantUsageStore,
} from "./authorization.js";

const NOW = "2026-08-03T09:00:00.000Z";
const ACTOR = { kind: "agent", agentId: "agent-bob" } as const;
const AUTHORITY = { kind: "human", userId: "user-alice" } as const;
const OWNER = { kind: "human", userId: "user-alice" } as const;
const RESOURCE: ResourceRef = {
  namespace: "files",
  path: ["Workspace", "projects", "sharedos"],
  owner: OWNER,
};

function grant(overrides: Partial<CapabilityGrant> = {}): CapabilityGrant {
  return {
    id: "grant-files-read",
    namespaceId: "world-alpha",
    subject: ACTOR,
    issuer: AUTHORITY,
    capabilities: [{ resource: RESOURCE, actions: ["read"], scope: "exact" }],
    constraints: { purposes: ["prepare-update"] },
    issuedAt: "2026-08-03T08:00:00.000Z",
    ...overrides,
  };
}

function context(grants: CapabilityGrant[]): AccessContext {
  return {
    namespaceId: "world-alpha",
    enabledToolNamespaces: [],
    actor: ACTOR,
    authority: AUTHORITY,
    owner: OWNER,
    purpose: "prepare-update",
    traceId: "trace-1",
    grants,
    now: NOW,
  };
}

describe("CapabilityAuthorizer", () => {
  it("denies by default and allows only an explicit matching grant", async () => {
    const authorizer = new CapabilityAuthorizer();
    const request = { resource: RESOURCE, action: "read" };

    await expect(authorizer.authorize(context([]), request)).resolves.toEqual({
      allowed: false,
      reasonCode: "no_matching_grant",
    });
    await expect(authorizer.authorize(context([grant()]), request)).resolves.toEqual({
      allowed: true,
      reasonCode: "allowed",
      matchedGrantId: "grant-files-read",
    });
  });

  it.each([
    ["subject", { subject: { kind: "agent", agentId: "agent-eve" } }],
    ["issuer", { issuer: { kind: "human", userId: "user-mallory" } }],
    ["namespace", { namespaceId: "world-other" }],
    ["purpose", { constraints: { purposes: ["unrelated-purpose"] } }],
    ["not-before", { constraints: { notBefore: "2026-08-04T00:00:00Z" } }],
    ["expired", { constraints: { expiresAt: NOW } }],
    ["revoked", { revokedAt: NOW }],
  ] satisfies ReadonlyArray<readonly [string, Partial<CapabilityGrant>]>)(
    "rejects a grant with a mismatched %s boundary",
    async (_label, overrides) => {
      const decision = await new CapabilityAuthorizer().authorize(context([grant(overrides)]), {
        resource: RESOURCE,
        action: "read",
      });

      expect(decision).toEqual({
        allowed: false,
        reasonCode: "no_matching_grant",
      });
    },
  );

  it("binds resources to the context owner", async () => {
    const otherOwner: Address = { kind: "human", userId: "user-eve" };
    const decision = await new CapabilityAuthorizer().authorize(context([grant()]), {
      resource: { ...RESOURCE, owner: otherOwner },
      action: "read",
    });

    expect(decision).toEqual({
      allowed: false,
      reasonCode: "invalid_request",
    });
  });

  it("matches descendant paths by segment without matching siblings", async () => {
    const descendantGrant = grant({
      capabilities: [
        {
          resource: {
            namespace: "files",
            path: ["Workspace", "projects", "sharedos"],
          },
          actions: ["grep"],
          scope: "descendants",
        },
      ],
    });
    const authorizer = new CapabilityAuthorizer();
    const access = context([descendantGrant]);

    await expect(
      authorizer.authorize(access, {
        resource: {
          namespace: "files",
          path: ["Workspace", "projects", "sharedos", "README.md"],
        },
        action: "grep",
      }),
    ).resolves.toMatchObject({ allowed: true });

    await expect(
      authorizer.authorize(access, {
        resource: {
          namespace: "files",
          path: ["Workspace", "projects", "sharedos-evil", "README.md"],
        },
        action: "grep",
      }),
    ).resolves.toEqual({
      allowed: false,
      reasonCode: "no_matching_grant",
    });
  });

  it("does not consume maxUses during inspection and consumes atomically", async () => {
    const access = context([grant({ constraints: { purposes: ["prepare-update"], maxUses: 1 } })]);
    const authorizer = new CapabilityAuthorizer({ usageStore: new InMemoryGrantUsageStore() });
    const request = { resource: RESOURCE, action: "read" };

    await expect(authorizer.authorize(access, request)).resolves.toMatchObject({
      allowed: true,
    });
    await expect(authorizer.authorize(access, request)).resolves.toMatchObject({
      allowed: true,
    });
    await expect(authorizer.authorize(access, request, { consume: true })).resolves.toMatchObject({
      allowed: true,
    });
    await expect(authorizer.authorize(access, request, { consume: true })).resolves.toEqual({
      allowed: false,
      reasonCode: "grant_exhausted",
    });
  });

  it("accounts for maxUses independently inside each namespace", async () => {
    const authorizer = new CapabilityAuthorizer({ usageStore: new InMemoryGrantUsageStore() });
    const request = { resource: RESOURCE, action: "read" };
    const alphaGrant = grant({
      id: "locally-unique-grant",
      constraints: { maxUses: 1 },
    });
    const betaGrant = grant({
      id: "locally-unique-grant",
      namespaceId: "world-beta",
      constraints: { maxUses: 1 },
    });
    const betaContext: AccessContext = {
      ...context([betaGrant]),
      namespaceId: "world-beta",
    };

    await expect(
      authorizer.authorize(context([alphaGrant]), request, { consume: true }),
    ).resolves.toMatchObject({ allowed: true });
    await expect(
      authorizer.authorize(betaContext, request, { consume: true }),
    ).resolves.toMatchObject({ allowed: true });
  });

  it("fails closed when bounded usage cannot be checked", async () => {
    const unavailableStore: GrantUsageStore = {
      async getUsage() {
        throw new Error("offline");
      },
      async tryConsume() {
        throw new Error("offline");
      },
    };
    const authorizer = new CapabilityAuthorizer({
      usageStore: unavailableStore,
    });
    const access = context([grant({ constraints: { maxUses: 1 } })]);

    await expect(
      authorizer.authorize(access, { resource: RESOURCE, action: "read" }),
    ).resolves.toEqual({
      allowed: false,
      reasonCode: "usage_store_unavailable",
    });
  });

  it("requires an explicit usage store for bounded grants", async () => {
    const access = context([grant({ constraints: { maxUses: 1 } })]);

    await expect(
      new CapabilityAuthorizer().authorize(access, { resource: RESOURCE, action: "read" }),
    ).resolves.toEqual({
      allowed: false,
      reasonCode: "usage_store_unavailable",
    });
  });

  it("keeps adversarial namespace and grant IDs in separate counters", async () => {
    const store = new InMemoryGrantUsageStore();

    await expect(store.tryConsume("tenant-a", "grant\u0000victim", 1)).resolves.toBe(true);
    await expect(store.getUsage("tenant-a\u0000grant", "victim")).resolves.toBe(0);
  });

  it("supports host verification of trusted grant material", async () => {
    const rejectAll: CapabilityGrantVerifier = {
      async verify() {
        return false;
      },
    };
    const authorizer = new CapabilityAuthorizer({ grantVerifier: rejectAll });

    await expect(
      authorizer.authorize(context([grant()]), {
        resource: RESOURCE,
        action: "read",
      }),
    ).resolves.toEqual({
      allowed: false,
      reasonCode: "no_matching_grant",
    });
  });
});

describe("CapabilityAuthorizer.reach", () => {
  it("describes the reachable surface without the authority behind it", async () => {
    const reach = await new CapabilityAuthorizer().reach(context([grant()]));

    expect(reach).toEqual([
      {
        namespace: "files",
        path: ["Workspace", "projects", "sharedos"],
        actions: ["read"],
        scope: "exact",
      },
    ]);
    // The point of the type: nothing here says who allowed it or for how long.
    for (const entry of reach) {
      expect(Object.keys(entry).sort()).toEqual(["actions", "namespace", "path", "scope"]);
    }
  });

  it("omits a grant that would not authorize anything right now", async () => {
    const authorizer = new CapabilityAuthorizer();

    const expired = await authorizer.reach(
      context([
        grant({
          constraints: { purposes: ["prepare-update"], expiresAt: "2026-08-03T08:30:00.000Z" },
        }),
      ]),
    );
    const wrongPurpose = await authorizer.reach(
      context([grant({ constraints: { purposes: ["something-else"] } })]),
    );
    const wrongSubject = await authorizer.reach(
      context([grant({ subject: { kind: "agent", agentId: "agent-carol" } as Address })]),
    );

    expect(expired).toEqual([]);
    expect(wrongPurpose).toEqual([]);
    expect(wrongSubject).toEqual([]);
  });

  it("omits a grant a verifier rejects", async () => {
    const revoked: CapabilityGrantVerifier = { verify: async () => false };
    const reach = await new CapabilityAuthorizer({ grantVerifier: revoked }).reach(
      context([grant()]),
    );

    expect(reach).toEqual([]);
  });

  it("does not advertise a door that is already closed, and never spends one to look", async () => {
    const usageStore = new InMemoryGrantUsageStore();
    const authorizer = new CapabilityAuthorizer({ usageStore });
    const bounded = context([grant({ constraints: { purposes: ["prepare-update"], maxUses: 1 } })]);

    expect(await authorizer.reach(bounded)).toHaveLength(1);
    // Asking repeatedly must not consume the budget.
    expect(await authorizer.reach(bounded)).toHaveLength(1);
    expect(await usageStore.getUsage("world-alpha", "grant-files-read")).toBe(0);

    const spent = await authorizer.authorize(
      bounded,
      { resource: RESOURCE, action: "read" },
      { consume: true },
    );
    expect(spent.allowed).toBe(true);
    expect(await authorizer.reach(bounded)).toEqual([]);
  });

  it("reports nothing rather than guessing when the bounded budget cannot be read", async () => {
    const broken: GrantUsageStore = {
      getUsage: async () => {
        throw new Error("store down");
      },
      tryConsume: async () => false,
    };
    const reach = await new CapabilityAuthorizer({ usageStore: broken }).reach(
      context([grant({ constraints: { purposes: ["prepare-update"], maxUses: 5 } })]),
    );

    expect(reach).toEqual([]);
  });

  it("is empty for a context that could not authorize anything", async () => {
    const reach = await new CapabilityAuthorizer().reach({ ...context([grant()]), purpose: "" });

    expect(reach).toEqual([]);
  });
});
