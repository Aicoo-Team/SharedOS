import { describe, expect, it } from "vitest";

import type {
  AccessContext,
  Address,
  CapabilityGrant,
  ResourceRef,
} from "@aicoo/sharedos-contracts";

import type { ResolvedAuthority } from "./authority.js";
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

function accessContext(namespaceId = "world-alpha"): AccessContext {
  return {
    namespaceId,
    enabledToolNamespaces: [],
    actor: ACTOR,
    authority: AUTHORITY,
    owner: OWNER,
    purpose: "prepare-update",
    traceId: "trace-1",
    now: NOW,
  };
}

/** Authority as the kernel would have resolved it from a trusted source. */
function context(grants: CapabilityGrant[]): ResolvedAuthority {
  return authorityFor(accessContext(), grants);
}

function authorityFor(access: AccessContext, grants: CapabilityGrant[]): ResolvedAuthority {
  return {
    context: access,
    grants,
    snapshot: {
      hash: `snapshot-${grants.map(({ id }) => id).join("+")}`,
      grantIds: grants.map(({ id }) => id),
      grantCount: grants.length,
      loadedAt: access.now,
    },
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
    const betaContext = authorityFor(accessContext("world-beta"), [betaGrant]);

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

  describe("the operation instant", () => {
    const LATER = "2026-08-03T10:00:00.000Z";
    const EXPIRES_AT = "2026-08-03T09:30:00.000Z";
    const READ = { resource: RESOURCE, action: "read" } as const;

    it("decides expiry at the operation instant rather than the turn's", async () => {
      const authorizer = new CapabilityAuthorizer();
      const expiring = grant({
        constraints: { purposes: ["prepare-update"], expiresAt: EXPIRES_AT },
      });
      const authority = context([expiring]);

      await expect(authorizer.authorize(authority, READ)).resolves.toMatchObject({
        allowed: true,
      });
      await expect(authorizer.authorize(authority, READ, { now: LATER })).resolves.toEqual({
        allowed: false,
        reasonCode: "no_matching_grant",
      });
    });

    it("keeps revocation at the turn's instant, where the store edit was not seen", async () => {
      const authorizer = new CapabilityAuthorizer();
      // Recorded in the store after this turn was admitted. The turn holds the
      // grant as it was loaded, so a later operation is still authorized.
      const revoked = grant({ revokedAt: EXPIRES_AT });

      await expect(
        authorizer.authorize(context([revoked]), READ, { now: LATER }),
      ).resolves.toMatchObject({ allowed: true });
    });

    it("keeps a validity window from opening at the operation instant", async () => {
      const authorizer = new CapabilityAuthorizer();
      const pending = grant({
        constraints: { purposes: ["prepare-update"], notBefore: EXPIRES_AT },
      });

      await expect(authorizer.authorize(context([pending]), READ, { now: LATER })).resolves.toEqual(
        { allowed: false, reasonCode: "no_matching_grant" },
      );
    });

    it("filters discovery at the operation instant too", async () => {
      const authorizer = new CapabilityAuthorizer();
      const expiring = grant({
        constraints: { purposes: ["prepare-update"], expiresAt: EXPIRES_AT },
      });
      const ceiling = {
        resource: { namespace: "files", path: ["Workspace"], owner: OWNER },
        action: "read",
      };

      await expect(authorizer.canDiscover(context([expiring]), ceiling)).resolves.toMatchObject({
        allowed: true,
      });
      await expect(
        authorizer.canDiscover(context([expiring]), ceiling, { now: LATER }),
      ).resolves.toEqual({ allowed: false, reasonCode: "no_matching_grant" });
    });

    it("invalidates a descendant when its ancestor expires mid-turn", async () => {
      const parent = grant({
        id: "grant-root",
        subject: AUTHORITY,
        constraints: {
          purposes: ["prepare-update"],
          delegationDepth: 1,
          expiresAt: EXPIRES_AT,
        },
      });
      const child = grant({
        id: "grant-derived",
        parentGrantId: "grant-root",
        constraints: { purposes: ["prepare-update"], expiresAt: EXPIRES_AT },
      });
      const authorizer = new CapabilityAuthorizer({
        delegationResolver: { resolve: async () => parent },
      });

      await expect(authorizer.authorize(context([child]), READ)).resolves.toMatchObject({
        allowed: true,
      });
      // The child is refused on its own expiry before the chain is walked, so
      // widen its window and leave the ancestor's closed: the denial is then
      // attributable to the ancestor.
      const outlivingChild = { ...child, constraints: { purposes: ["prepare-update"] } };
      await expect(
        authorizer.authorize(context([outlivingChild]), READ, { now: LATER }),
      ).resolves.toMatchObject({
        allowed: false,
        reasonCode: "delegation_chain_invalid",
        metadata: { delegation: { code: "parent_inactive", grantId: "grant-root" } },
      });
    });

    it("refuses an unparsable operation instant rather than deciding at the turn's", async () => {
      const authorizer = new CapabilityAuthorizer();

      await expect(
        authorizer.authorize(context([grant()]), READ, { now: "not-an-instant" }),
      ).resolves.toEqual({ allowed: false, reasonCode: "invalid_context" });
    });
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

describe('the "*" action', () => {
  const everything = grant({
    id: "grant-files-everything",
    capabilities: [{ resource: RESOURCE, actions: ["*"], scope: "exact" }],
  });

  it("is a granted literal that covers every action on its resource", async () => {
    const authorizer = new CapabilityAuthorizer();
    for (const action of ["read", "delete", "snapshot:restore"]) {
      await expect(
        authorizer.authorize(context([everything]), { resource: RESOURCE, action }),
      ).resolves.toEqual({
        allowed: true,
        reasonCode: "allowed",
        matchedGrantId: "grant-files-everything",
      });
    }
  });

  it("widens the action test only: path, scope, and purpose still have to match", async () => {
    const authorizer = new CapabilityAuthorizer();
    await expect(
      authorizer.authorize(context([everything]), {
        resource: { ...RESOURCE, path: [...RESOURCE.path, "notes.md"] },
        action: "read",
      }),
    ).resolves.toEqual({ allowed: false, reasonCode: "no_matching_grant" });
    await expect(
      authorizer.authorize(
        authorityFor({ ...accessContext(), purpose: "publish-summary" }, [everything]),
        { resource: RESOURCE, action: "read" },
      ),
    ).resolves.toEqual({ allowed: false, reasonCode: "no_matching_grant" });
  });

  it('is not a request pattern: asking for "*" against named actions is denied', async () => {
    const authorizer = new CapabilityAuthorizer();
    await expect(
      authorizer.authorize(context([grant()]), { resource: RESOURCE, action: "*" }),
    ).resolves.toEqual({ allowed: false, reasonCode: "no_matching_grant" });
  });

  it("makes every tool over the resource discoverable, and nothing outside it", async () => {
    const authorizer = new CapabilityAuthorizer();
    await expect(
      authorizer.canDiscover(context([everything]), {
        resource: { namespace: "files", path: [] },
        action: "delete",
      }),
    ).resolves.toMatchObject({ allowed: true, matchedGrantId: "grant-files-everything" });
    await expect(
      authorizer.canDiscover(context([everything]), {
        resource: { namespace: "calendar", path: [] },
        action: "read",
      }),
    ).resolves.toEqual({ allowed: false, reasonCode: "no_matching_grant" });
  });
});
