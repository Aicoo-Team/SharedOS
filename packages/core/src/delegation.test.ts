import { describe, expect, it } from "vitest";

import type { AccessContext, CapabilityGrant } from "@aicoo/sharedos-contracts";

import { CapabilityAuthorizer } from "./authorization.js";
import { deriveGrant, type GrantChainResolver } from "./delegation.js";

const NOW = "2026-08-20T09:00:00.000Z";
const OWNER = { kind: "human", userId: "fleet-operator" } as const;
const ALICE = { kind: "agent", agentId: "robot-a" } as const;
const BOB = { kind: "agent", agentId: "robot-b" } as const;

/** Operator grants robot A the whole of cell 3, redelegable once. */
function parentGrant(overrides: Partial<CapabilityGrant> = {}): CapabilityGrant {
  return {
    id: "grant-a",
    namespaceId: "fleet",
    subject: ALICE,
    issuer: OWNER,
    capabilities: [
      {
        resource: { namespace: "fleet", path: ["cell-3"], owner: OWNER },
        actions: ["move", "grip", "release"],
        scope: "descendants",
      },
    ],
    constraints: { purposes: ["pick-and-place"], delegationDepth: 1 },
    issuedAt: "2026-08-20T08:00:00.000Z",
    ...overrides,
  };
}

function derive(
  parent: CapabilityGrant,
  capabilities: CapabilityGrant["capabilities"],
  constraints?: Parameters<typeof deriveGrant>[1]["constraints"],
) {
  return deriveGrant(parent, {
    id: "grant-b",
    subject: BOB,
    capabilities,
    issuedAt: NOW,
    ...(constraints ? { constraints } : {}),
  });
}

const armOnly = [
  {
    resource: { namespace: "fleet", path: ["cell-3", "arm-1"], owner: OWNER },
    actions: ["grip"],
    scope: "exact" as const,
  },
];

describe("deriveGrant", () => {
  it("passes on a strict subset and names the delegator as issuer", () => {
    const result = derive(parentGrant(), armOnly);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // The audit trail has to say who passed the authority on, not only who
    // owned the resource.
    expect(result.grant.issuer).toEqual(ALICE);
    expect(result.grant.subject).toEqual(BOB);
    expect(result.grant.delegation).toEqual({
      parentGrantId: "grant-a",
      depth: 0,
      chain: ["grant-a"],
    });
    // Purposes are inherited, not dropped.
    expect(result.grant.constraints.purposes).toEqual(["pick-and-place"]);
  });

  it("refuses a wider path", () => {
    const result = derive(parentGrant(), [
      {
        resource: { namespace: "fleet", path: [], owner: OWNER },
        actions: ["grip"],
        scope: "descendants",
      },
    ]);
    expect(result).toEqual({ ok: false, reason: "capability_not_within_parent" });
  });

  it("refuses a sibling path that shares a prefix", () => {
    // `cell-3` must not cover `cell-30`: matching has to be by segment.
    const result = derive(parentGrant(), [
      {
        resource: { namespace: "fleet", path: ["cell-30"], owner: OWNER },
        actions: ["grip"],
        scope: "exact",
      },
    ]);
    expect(result).toEqual({ ok: false, reason: "capability_not_within_parent" });
  });

  it("refuses an action the parent does not hold", () => {
    const result = derive(parentGrant(), [
      {
        resource: { namespace: "fleet", path: ["cell-3", "arm-1"], owner: OWNER },
        actions: ["weld"],
        scope: "exact",
      },
    ]);
    expect(result).toEqual({ ok: false, reason: "capability_not_within_parent" });
  });

  it("refuses a wildcard the parent does not hold", () => {
    const result = derive(parentGrant(), [
      {
        resource: { namespace: "fleet", path: ["cell-3", "arm-1"], owner: OWNER },
        actions: ["*"],
        scope: "exact",
      },
    ]);
    expect(result).toEqual({ ok: false, reason: "capability_not_within_parent" });
  });

  it("refuses to widen an exact parent into a subtree", () => {
    const exactParent = parentGrant({
      capabilities: [
        {
          resource: { namespace: "fleet", path: ["cell-3", "arm-1"], owner: OWNER },
          actions: ["grip"],
          scope: "exact",
        },
      ],
    });
    const result = derive(exactParent, [
      {
        resource: { namespace: "fleet", path: ["cell-3", "arm-1"], owner: OWNER },
        actions: ["grip"],
        scope: "descendants",
      },
    ]);
    expect(result).toEqual({ ok: false, reason: "capability_not_within_parent" });
  });

  it("refuses a purpose outside the parent's", () => {
    const result = derive(parentGrant(), armOnly, { purposes: ["teardown"] });
    expect(result).toEqual({ ok: false, reason: "purpose_not_within_parent" });
  });

  it("refuses to outlive the parent", () => {
    const bounded = parentGrant({
      constraints: { delegationDepth: 1, expiresAt: "2026-08-20T10:00:00.000Z" },
    });
    expect(derive(bounded, armOnly, { expiresAt: "2026-08-20T18:00:00.000Z" })).toEqual({
      ok: false,
      reason: "window_not_within_parent",
    });
    // An unbounded child of a bounded parent outlives it just as surely.
    expect(derive(bounded, armOnly)).toEqual({
      ok: true,
      grant: expect.objectContaining({
        constraints: expect.objectContaining({ expiresAt: "2026-08-20T10:00:00.000Z" }),
      }),
    });
  });

  it("refuses when the parent may not be redelegated", () => {
    expect(derive(parentGrant({ constraints: { delegationDepth: 0 } }), armOnly)).toEqual({
      ok: false,
      reason: "parent_not_delegable",
    });
    expect(derive(parentGrant({ constraints: {} }), armOnly)).toEqual({
      ok: false,
      reason: "parent_not_delegable",
    });
  });

  it("refuses to hand on a longer chain than it received", () => {
    expect(derive(parentGrant(), armOnly, { delegationDepth: 5 })).toEqual({
      ok: false,
      reason: "depth_exhausted",
    });
  });

  it("refuses to split a bounded-use parent", () => {
    // Two children of a 3-use parent would carry six uses between them.
    const bounded = parentGrant({ constraints: { delegationDepth: 1, maxUses: 3 } });
    expect(derive(bounded, armOnly)).toEqual({
      ok: false,
      reason: "bounded_parent_not_delegable",
    });
  });

  it("refuses to satisfy one child capability from parts of several parent ones", () => {
    const split = parentGrant({
      capabilities: [
        {
          resource: { namespace: "fleet", path: ["cell-3", "arm-1"], owner: OWNER },
          actions: ["grip"],
          scope: "exact",
        },
        {
          resource: { namespace: "fleet", path: ["cell-3", "arm-2"], owner: OWNER },
          actions: ["move"],
          scope: "exact",
        },
      ],
    });
    // "move arm-1" is covered by neither, though the pieces exist across both.
    const result = derive(split, [
      {
        resource: { namespace: "fleet", path: ["cell-3", "arm-1"], owner: OWNER },
        actions: ["move"],
        scope: "exact",
      },
    ]);
    expect(result).toEqual({ ok: false, reason: "capability_not_within_parent" });
  });
});

describe("using a derived grant", () => {
  function context(grants: CapabilityGrant[]): AccessContext {
    return {
      namespaceId: "fleet",
      enabledToolNamespaces: [],
      actor: BOB,
      // The delegator is the authority on a derived grant.
      authority: ALICE,
      owner: OWNER,
      purpose: "pick-and-place",
      traceId: "trace-1",
      grants,
      now: NOW,
    };
  }

  const request = {
    resource: { namespace: "fleet", path: ["cell-3", "arm-1"], owner: OWNER },
    action: "grip",
  };

  function resolver(...ancestors: CapabilityGrant[]): GrantChainResolver {
    const byId = new Map(ancestors.map((ancestor) => [ancestor.id, ancestor]));
    return {
      async get(_namespaceId, grantId) {
        return byId.get(grantId);
      },
    };
  }

  function derived(parent = parentGrant()): CapabilityGrant {
    const result = derive(parent, armOnly);
    if (!result.ok) throw new Error(`derivation failed: ${result.reason}`);
    return result.grant;
  }

  it("allows what the parent allowed", async () => {
    const parent = parentGrant();
    const authorizer = new CapabilityAuthorizer({ chainResolver: resolver(parent) });
    await expect(authorizer.authorize(context([derived(parent)]), request)).resolves.toEqual(
      expect.objectContaining({ allowed: true, matchedGrantId: "grant-b" }),
    );
  });

  it("stops the moment the parent is revoked, without touching the child", async () => {
    const parent = parentGrant();
    const child = derived(parent);
    const revoked = { ...parent, revokedAt: "2026-08-20T08:30:00.000Z" };
    const authorizer = new CapabilityAuthorizer({ chainResolver: resolver(revoked) });

    // The child grant is byte-identical to the allowed case above.
    await expect(authorizer.authorize(context([child]), request)).resolves.toEqual(
      expect.objectContaining({ allowed: false, reasonCode: "no_matching_grant" }),
    );
  });

  it("fails closed when ancestors cannot be resolved", async () => {
    const authorizer = new CapabilityAuthorizer();
    await expect(authorizer.authorize(context([derived()]), request)).resolves.toEqual(
      expect.objectContaining({ allowed: false }),
    );

    const missing = new CapabilityAuthorizer({ chainResolver: resolver() });
    await expect(authorizer.authorize(context([derived()]), request)).resolves.toEqual(
      expect.objectContaining({ allowed: false }),
    );
    await expect(missing.authorize(context([derived()]), request)).resolves.toEqual(
      expect.objectContaining({ allowed: false }),
    );
  });

  it("rejects a forged chain that does not lead to its declared parent", async () => {
    const parent = parentGrant();
    const child = derived(parent);
    const forged: CapabilityGrant = {
      ...child,
      delegation: { parentGrantId: "grant-a", depth: 0, chain: ["grant-somewhere-else"] },
    };
    const authorizer = new CapabilityAuthorizer({ chainResolver: resolver(parent) });
    await expect(authorizer.authorize(context([forged]), request)).resolves.toEqual(
      expect.objectContaining({ allowed: false }),
    );
  });
});
