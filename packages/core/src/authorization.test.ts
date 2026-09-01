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
  type HostCeiling,
  InMemoryGrantUsageStore,
  isInfrastructureDenial,
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

/**
 * The whole of a denial for want of a grant, description included.
 *
 * Every `no_matching_grant` denial now names the authority that would have
 * satisfied it (ADR 0019), so the assertions below stay exact rather than
 * becoming partial: what is asserted is still the complete decision. Only the
 * derived identifier is left open here, and it has a test of its own.
 */
function deniedForWantOfAGrant(
  resource: ResourceRef,
  action: string,
  access: AccessContext = accessContext(),
): unknown {
  return {
    allowed: false,
    reasonCode: "no_matching_grant",
    requiredCapability: {
      id: expect.any(String),
      namespaceId: access.namespaceId,
      requester: access.actor,
      owner: access.owner,
      capabilities: [{ resource, actions: [action], scope: "exact" }],
      purpose: access.purpose,
      requestedAt: access.now,
    },
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

    await expect(authorizer.authorize(context([]), request)).resolves.toEqual(
      deniedForWantOfAGrant(RESOURCE, "read"),
    );
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

      expect(decision).toEqual(deniedForWantOfAGrant(RESOURCE, "read"));
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
    ).resolves.toEqual(
      deniedForWantOfAGrant(
        { namespace: "files", path: ["Workspace", "projects", "sharedos-evil", "README.md"] },
        "grep",
      ),
    );
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
      // `requestedAt` is the turn's instant, not this operation's: the
      // description names the authority the turn asked for, and a turn asks
      // once.
      await expect(authorizer.authorize(authority, READ, { now: LATER })).resolves.toEqual(
        deniedForWantOfAGrant(READ.resource, READ.action),
      );
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
        deniedForWantOfAGrant(READ.resource, READ.action),
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
      ).resolves.toEqual(deniedForWantOfAGrant(ceiling.resource, ceiling.action));
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
    ).resolves.toEqual(deniedForWantOfAGrant(RESOURCE, "read"));
  });
});

describe("a denial that names the authority it needed", () => {
  const authorizer = new CapabilityAuthorizer({ usageStore: new InMemoryGrantUsageStore() });

  it("names the resource, action, owner and purpose the authorizer already held", async () => {
    const decision = await authorizer.authorize(context([]), {
      resource: RESOURCE,
      action: "read",
    });

    expect(decision.allowed).toBe(false);
    expect(decision.requiredCapability).toMatchObject({
      namespaceId: "world-alpha",
      requester: ACTOR,
      owner: OWNER,
      purpose: "prepare-update",
      requestedAt: NOW,
      capabilities: [{ resource: RESOURCE, actions: ["read"], scope: "exact" }],
    });
  });

  it("describes only the narrowest authority that would have matched", async () => {
    const decision = await authorizer.authorize(context([]), {
      resource: { ...RESOURCE, path: [...RESOURCE.path, "notes.md"] },
      action: "replace",
    });

    // Not the parent directory, and not the actions beside it: a denial
    // establishes that this one operation was refused and nothing wider.
    expect(decision.requiredCapability?.capabilities).toEqual([
      {
        resource: { ...RESOURCE, path: [...RESOURCE.path, "notes.md"] },
        actions: ["replace"],
        scope: "exact",
      },
    ]);
  });

  it("derives the identifier, so one ask describes itself the same way twice", async () => {
    const read = { resource: RESOURCE, action: "read" };
    const [first, second, other] = await Promise.all([
      authorizer.authorize(context([]), read),
      authorizer.authorize(context([]), read),
      authorizer.authorize(context([]), { resource: RESOURCE, action: "delete" }),
    ]);

    expect(first.requiredCapability?.id).toBe(second.requiredCapability?.id);
    // A different ask is a different request, not a re-run of the same one.
    expect(other.requiredCapability?.id).not.toBe(first.requiredCapability?.id);
  });

  it("does not describe one for a denial that issuing a grant would not remedy", async () => {
    const bounded = grant({ constraints: { purposes: ["prepare-update"], maxUses: 1 } });
    const spent = context([bounded]);
    const request = { resource: RESOURCE, action: "read" };
    await authorizer.authorize(spent, request, { consume: true });

    // A grant already exists and is spent; another one is not the answer.
    await expect(authorizer.authorize(spent, request, { consume: true })).resolves.toEqual({
      allowed: false,
      reasonCode: "grant_exhausted",
    });
    // SharedOS could not establish a fact. Describing a capability would say
    // the deployment is under-granted when it is broken.
    await expect(
      new CapabilityAuthorizer().authorize(context([bounded]), request),
    ).resolves.toEqual({ allowed: false, reasonCode: "usage_store_unavailable" });
    // The request names another world; no grant in this one satisfies it.
    await expect(
      authorizer.authorize(context([grant()]), {
        resource: { ...RESOURCE, owner: { kind: "human", userId: "user-eve" } },
        action: "read",
      }),
    ).resolves.toEqual({ allowed: false, reasonCode: "invalid_request" });
  });

  it("is a description and not an offer: the denial is still a denial", async () => {
    const decision = await authorizer.authorize(context([]), {
      resource: RESOURCE,
      action: "read",
    });

    expect(decision.allowed).toBe(false);
    expect(decision.matchedGrantId).toBeUndefined();
    // Nothing accepts one back. Handing the description to the authorizer as a
    // grant is not even expressible, and the same request stays denied.
    await expect(
      authorizer.authorize(context([]), { resource: RESOURCE, action: "read" }),
    ).resolves.toMatchObject({ allowed: false });
  });
});

describe("the host ceiling", () => {
  const READ = { resource: RESOURCE, action: "read" } as const;

  /** A ceiling that refuses, and records what it was shown. */
  function refusing(): HostCeiling & { seen: unknown[] } {
    const seen: unknown[] = [];
    return {
      seen,
      narrow(decision, request, context) {
        seen.push({ decision, request, context });
        return { allowed: false, reasonCode: "host_policy_denied" };
      },
    };
  }

  it("turns an allow into a refusal that says host policy refused it", async () => {
    const hostCeiling = refusing();
    const authorizer = new CapabilityAuthorizer({ hostCeiling });

    await expect(authorizer.authorize(context([grant()]), READ)).resolves.toEqual({
      allowed: false,
      reasonCode: "host_policy_denied",
    });
    // It was shown the decision the grants produced, with the grant that
    // produced it, plus the request and context it has to read to decide.
    expect(hostCeiling.seen).toEqual([
      {
        decision: { allowed: true, reasonCode: "allowed", matchedGrantId: "grant-files-read" },
        request: READ,
        context: accessContext(),
      },
    ]);
  });

  it("is never shown a denial, so it has nothing to turn into an allow", async () => {
    const hostCeiling = refusing();
    const authorizer = new CapabilityAuthorizer({ hostCeiling });

    // No grant matched. The ceiling does not run, and the denial the grants
    // produced is the denial returned.
    await expect(authorizer.authorize(context([]), READ)).resolves.toMatchObject({
      allowed: false,
      reasonCode: "no_matching_grant",
    });
    expect(hostCeiling.seen).toEqual([]);
  });

  it("cannot hand back an allow for a grant it was not given", async () => {
    const authorizer = new CapabilityAuthorizer({
      hostCeiling: {
        narrow: () => ({
          allowed: true,
          reasonCode: "allowed",
          matchedGrantId: "grant-the-ceiling-invented",
        }),
      },
    });

    // Not a wider decision -- a malfunctioning port. It fails closed under the
    // same code a throw does.
    await expect(authorizer.authorize(context([grant()]), READ)).resolves.toEqual({
      allowed: false,
      reasonCode: "host_policy_unavailable",
    });
  });

  it("keeps the decision it was handed when it agrees with it", async () => {
    const authorizer = new CapabilityAuthorizer({
      hostCeiling: { narrow: (decision) => decision },
    });

    await expect(authorizer.authorize(context([grant()]), READ)).resolves.toEqual({
      allowed: true,
      reasonCode: "allowed",
      matchedGrantId: "grant-files-read",
    });
  });

  it("fails closed when the port throws", async () => {
    const authorizer = new CapabilityAuthorizer({
      hostCeiling: {
        narrow: () => {
          throw new Error("the policy table is unreachable");
        },
      },
    });

    await expect(authorizer.authorize(context([grant()]), READ)).resolves.toEqual({
      allowed: false,
      reasonCode: "host_policy_unavailable",
    });
  });

  it("fails closed when the port answers with neither arm", async () => {
    const authorizer = new CapabilityAuthorizer({
      // A host outside TypeScript can answer with anything, including nothing.
      hostCeiling: { narrow: () => undefined } as unknown as HostCeiling,
    });

    await expect(authorizer.authorize(context([grant()]), READ)).resolves.toEqual({
      allowed: false,
      reasonCode: "host_policy_unavailable",
    });
  });

  it("separates the deliberate refusal from the broken port", () => {
    // A policy refusal is a decision the deployment made, and belongs in the
    // denial rate. A port that could not answer is SharedOS failing to
    // establish a fact, and must be excluded from it.
    expect(isInfrastructureDenial("host_policy_denied")).toBe(false);
    expect(isInfrastructureDenial("host_policy_unavailable")).toBe(true);
  });

  it("runs on discovery too, so a tool it refuses is absent from the catalogue", async () => {
    const hostCeiling = refusing();
    const authorizer = new CapabilityAuthorizer({ hostCeiling });
    const ceiling = { resource: { namespace: "files", path: ["Workspace"] }, action: "read" };

    await expect(authorizer.canDiscover(context([grant()]), ceiling)).resolves.toEqual({
      allowed: false,
      reasonCode: "host_policy_denied",
    });
    expect(hostCeiling.seen).toHaveLength(1);
  });

  it("changes nothing at all when there is none", async () => {
    const withNone = new CapabilityAuthorizer();
    const authority = context([grant()]);

    await expect(withNone.authorize(authority, READ)).resolves.toEqual({
      allowed: true,
      reasonCode: "allowed",
      matchedGrantId: "grant-files-read",
    });
    await expect(withNone.authorize(context([]), READ)).resolves.toEqual(
      deniedForWantOfAGrant(RESOURCE, "read"),
    );
    expect(withNone.hasHostCeiling).toBe(false);
  });

  it("cannot express widening in the type either", () => {
    const passthrough: HostCeiling = { narrow: (decision) => decision };
    const denial = { allowed: false, reasonCode: "no_matching_grant" } as const;

    // @ts-expect-error a ceiling is shown allowed decisions only, so there is
    // no denial in its hand to return as an allow.
    expect(passthrough.narrow(denial, READ, accessContext())).toBe(denial);

    const invented: HostCeiling = {
      // @ts-expect-error its denial arm is pinned to `host_policy_denied`, so a
      // ceiling cannot borrow a code that means something else happened.
      narrow: () => ({ allowed: false, reasonCode: "no_matching_grant" }),
    };
    expect(invented.narrow).toBeTypeOf("function");
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
    ).resolves.toEqual(
      deniedForWantOfAGrant({ ...RESOURCE, path: [...RESOURCE.path, "notes.md"] }, "read"),
    );
    await expect(
      authorizer.authorize(
        authorityFor({ ...accessContext(), purpose: "publish-summary" }, [everything]),
        { resource: RESOURCE, action: "read" },
      ),
    ).resolves.toEqual(
      deniedForWantOfAGrant(RESOURCE, "read", { ...accessContext(), purpose: "publish-summary" }),
    );
  });

  it('is not a request pattern: asking for "*" against named actions is denied', async () => {
    const authorizer = new CapabilityAuthorizer();
    await expect(
      authorizer.authorize(context([grant()]), { resource: RESOURCE, action: "*" }),
    ).resolves.toEqual(deniedForWantOfAGrant(RESOURCE, "*"));
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
    ).resolves.toEqual(deniedForWantOfAGrant({ namespace: "calendar", path: [] }, "read"));
  });
});
