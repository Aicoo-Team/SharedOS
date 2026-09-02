import { describe, expect, it } from "vitest";

import type { AccessContext, CapabilityGrant, ResourceRef } from "@aicoo/sharedos-contracts";

import type { AuditEvent } from "./audit.js";
import type { GrantSource } from "./authority.js";
import type { ResolvedAuthority } from "./authority.js";
import { SharedOSKernel } from "./kernel.js";
import {
  type AuthorizationExplanation,
  type AuthorizationInstantOptions,
  CapabilityAuthorizer,
  InMemoryGrantUsageStore,
} from "./authorization.js";

const NOW = "2026-08-03T09:00:00.000Z";
const ACTOR = { kind: "agent", agentId: "agent-bob" } as const;
const ALICE = { kind: "human", userId: "user-alice" } as const;
const CAROL = { kind: "human", userId: "user-carol" } as const;
const RESOURCE: ResourceRef = {
  namespace: "files",
  path: ["Workspace", "projects", "sharedos"],
  owner: ALICE,
};

function grant(overrides: Partial<CapabilityGrant> = {}): CapabilityGrant {
  return {
    id: "grant-files-read",
    namespaceId: "world-alpha",
    subject: ACTOR,
    issuer: ALICE,
    capabilities: [{ resource: RESOURCE, actions: ["read"], scope: "exact" }],
    constraints: { purposes: ["prepare-update"] },
    issuedAt: "2026-08-03T08:00:00.000Z",
    ...overrides,
  };
}

function accessContext(overrides: Partial<AccessContext> = {}): AccessContext {
  return {
    namespaceId: "world-alpha",
    enabledToolNamespaces: [],
    actor: ACTOR,
    authority: ALICE,
    owner: ALICE,
    purpose: "prepare-update",
    traceId: "trace-1",
    now: NOW,
    ...overrides,
  };
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

/** Authorize once and return both halves: what the caller sees, and what the host sees. */
async function decide(
  authorizer: CapabilityAuthorizer,
  authority: ResolvedAuthority,
  action = "read",
  consume = false,
) {
  let explanation: AuthorizationExplanation | undefined;
  const decision = await authorizer.authorize(
    authority,
    { resource: RESOURCE, action },
    { consume, onExplain: (received) => (explanation = received) },
  );
  return { decision, explanation };
}

describe("the host-facing account of a denial", () => {
  it("names the authority mismatch that no_matching_grant hides", async () => {
    // The grant is Alice's; the context claims to be exercising Carol's. This
    // is the first entry on the checklist and the reason code cannot say so.
    const authority = authorityFor(accessContext({ authority: CAROL }), [grant()]);

    const { decision, explanation } = await decide(new CapabilityAuthorizer(), authority);

    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe("no_matching_grant");
    expect(explanation?.grantsResolved).toBe(1);
    expect(explanation?.rejections).toEqual([{ grantId: "grant-files-read", reason: "issuer" }]);
  });

  it("keeps the account out of the decision the caller receives", async () => {
    const authority = authorityFor(accessContext({ authority: CAROL }), [grant()]);

    const { decision, explanation } = await decide(new CapabilityAuthorizer(), authority);

    // Both halves matter: the account has to carry the detail, and the
    // decision has to not. Asserting only the second passes when nothing is
    // explained at all.
    expect(JSON.stringify(explanation)).toContain("grant-files-read");
    expect(JSON.stringify(decision)).not.toContain("grant-files-read");
    expect(JSON.stringify(decision)).not.toContain("issuer");
  });

  it("separates a store that returned nothing from grants that were all rejected", async () => {
    const empty = authorityFor(accessContext(), []);

    const { decision, explanation } = await decide(new CapabilityAuthorizer(), empty);

    expect(decision.reasonCode).toBe("no_matching_grant");
    expect(explanation).toEqual({
      reasonCode: "no_matching_grant",
      grantsResolved: 0,
      rejections: [],
    });
  });

  it.each([
    ["subject", { actor: { kind: "agent", agentId: "agent-mallory" } as const }],
    ["purpose", { purpose: "something-else" }],
    ["namespace", { namespaceId: "world-beta" }],
  ])("names %s when that is the dimension that failed", async (reason, overrides) => {
    const authority = authorityFor(accessContext(overrides), [grant()]);

    const { explanation } = await decide(new CapabilityAuthorizer(), authority);

    expect(explanation?.rejections).toEqual([{ grantId: "grant-files-read", reason }]);
  });

  it("names an expired grant as a window failure, not a missing one", async () => {
    const authority = authorityFor(accessContext(), [
      grant({
        constraints: { purposes: ["prepare-update"], expiresAt: "2026-08-03T08:30:00.000Z" },
      }),
    ]);

    const { explanation } = await decide(new CapabilityAuthorizer(), authority);

    expect(explanation?.rejections).toEqual([{ grantId: "grant-files-read", reason: "window" }]);
  });

  it("names the capability when the grant was eligible but covered another action", async () => {
    const authority = authorityFor(accessContext(), [grant()]);

    const { explanation } = await decide(new CapabilityAuthorizer(), authority, "delete");

    expect(explanation?.rejections).toEqual([
      { grantId: "grant-files-read", reason: "capability" },
    ]);
  });

  it("reports a missing usage store as configuration, not as policy", async () => {
    const bounded = grant({ constraints: { purposes: ["prepare-update"], maxUses: 1 } });
    const authority = authorityFor(accessContext(), [bounded]);

    // No usageStore: the grant matched in every other respect.
    const { decision, explanation } = await decide(new CapabilityAuthorizer(), authority);

    expect(decision.reasonCode).toBe("usage_store_unavailable");
    expect(explanation?.missingDependency).toBe("usageStore");
  });

  it("stops reporting the missing store once one is supplied", async () => {
    const bounded = grant({ constraints: { purposes: ["prepare-update"], maxUses: 1 } });
    const authority = authorityFor(accessContext(), [bounded]);
    const authorizer = new CapabilityAuthorizer({ usageStore: new InMemoryGrantUsageStore() });

    const first = await decide(authorizer, authority, "read", true);
    expect(first.decision.allowed).toBe(true);
    expect(first.explanation).toBeUndefined();

    const second = await decide(authorizer, authority, "read", true);
    expect(second.decision.reasonCode).toBe("grant_exhausted");
    expect(second.explanation?.missingDependency).toBeUndefined();
    expect(second.explanation?.rejections).toEqual([
      { grantId: "grant-files-read", reason: "exhausted" },
    ]);
  });

  it("reports a missing delegation resolver as configuration, not as policy", async () => {
    const derived = grant({ id: "grant-derived", parentGrantId: "grant-root" });
    const authority = authorityFor(accessContext(), [derived]);

    const { decision, explanation } = await decide(new CapabilityAuthorizer(), authority);

    expect(decision.reasonCode).toBe("delegation_chain_unverified");
    expect(explanation?.missingDependency).toBe("delegationResolver");
    expect(explanation?.rejections).toEqual([{ grantId: "grant-derived", reason: "delegation" }]);
  });

  it("is never called for an allow", async () => {
    const authority = authorityFor(accessContext(), [grant()]);

    const { decision, explanation } = await decide(new CapabilityAuthorizer(), authority);

    expect(decision.allowed).toBe(true);
    expect(explanation).toBeUndefined();
  });

  it("is not called for discovery, which denies constantly by design", async () => {
    const authority = authorityFor(accessContext({ authority: CAROL }), [grant()]);
    let called = false;

    // `canDiscover` does not take the callback in its type. Force one past the
    // type to prove the discovery path ignores it rather than merely not
    // offering it: catalog filtering denies on nearly every tool, and routing
    // that through the account would bury the denial somebody was looking for.
    const decision = await new CapabilityAuthorizer().canDiscover(
      authority,
      { resource: RESOURCE, action: "read" },
      { onExplain: () => (called = true) } as AuthorizationInstantOptions,
    );

    expect(decision.allowed).toBe(false);
    expect(called).toBe(false);
  });

  it("hands back a frozen account so a diagnostic cannot become a decision", async () => {
    const authority = authorityFor(accessContext({ authority: CAROL }), [grant()]);

    const { explanation } = await decide(new CapabilityAuthorizer(), authority);

    // `Object.isFrozen(undefined)` is true, so an unexplained denial would
    // pass this without the assertion above it.
    expect(explanation?.rejections).toHaveLength(1);
    expect(Object.isFrozen(explanation)).toBe(true);
    expect(Object.isFrozen(explanation?.rejections)).toBe(true);
  });
});

describe("the account on the audit record", () => {
  class OneGrantSource implements GrantSource {
    constructor(private readonly grants: readonly CapabilityGrant[]) {}
    async load(): Promise<readonly CapabilityGrant[]> {
      await Promise.resolve();
      return this.grants;
    }
  }

  async function denyThroughKernel(
    grants: readonly CapabilityGrant[],
    access: AccessContext,
    type: AuditEvent["type"] = "authorization.checked",
  ): Promise<AuditEvent> {
    const events: AuditEvent[] = [];
    const kernel = new SharedOSKernel({
      grantSource: new OneGrantSource(grants),
      audit: { record: async (event) => void events.push(event) },
    });

    const decision = await kernel.authorize(access, { resource: RESOURCE, action: "read" });
    expect(decision.allowed).toBe(false);

    const recorded = events.find((event) => event.type === type);
    expect(recorded).toBeDefined();
    return recorded as AuditEvent;
  }

  it("names the mismatched dimension on a scope rejection the caller sees as unavailable", async () => {
    // The kernel pre-filters to (namespace, actor, authority) before the
    // authorizer runs, so an authority mismatch never reaches the grant loop:
    // it is refused at resolution and collapses into `authority_unavailable`,
    // the code that hides four different faults. This is the real path, and
    // the reason the account has to exist at both stages.
    const resolved = await denyThroughKernel(
      [grant()],
      accessContext({ authority: CAROL }),
      "authority.resolved",
    );

    expect(resolved.outcome).toBe("failed");
    expect(resolved.metadata).toMatchObject({
      failClosed: true,
      authority: "grant_scope_mismatch",
      rejectedGrants: [{ grantId: "grant-files-read", reason: "issuer" }],
    });
  });

  it("keeps the grant out of the decision the caller receives", async () => {
    const kernel = new SharedOSKernel({ grantSource: new OneGrantSource([grant()]) });

    const decision = await kernel.authorize(accessContext({ authority: CAROL }), {
      resource: RESOURCE,
      action: "read",
    });

    // Which grant, and which dimension, stay on the audit record.
    //
    // The four-way `AuthorityUnavailableCode` itself is a separate question:
    // `errors.md` says the collapse exists so that "no caller can tell a broken
    // store from a rejected one", but the decision carries the internal code in
    // `metadata.authority.code` and `authority.test.ts` asserts it. Docs and
    // behaviour disagree; this change does not settle it either way.
    expect(decision.reasonCode).toBe("authority_unavailable");
    expect(JSON.stringify(decision)).not.toContain("grant-files-read");
  });

  it("puts the rejected grant and its dimension where the operator can query it", async () => {
    // Past the scope filter: an in-scope grant that covers another action.
    const wrongAction = grant({
      capabilities: [{ resource: RESOURCE, actions: ["delete"], scope: "exact" }],
    });

    const checked = await denyThroughKernel([wrongAction], accessContext());

    expect(checked.outcome).toBe("denied");
    expect(checked.reason).toBe("no_matching_grant");
    expect(checked.metadata).toMatchObject({
      grantsResolved: 1,
      rejectedGrants: [{ grantId: "grant-files-read", reason: "capability" }],
    });
  });

  it("marks a missing store as a dependency fault beside the failClosed flag", async () => {
    const bounded = grant({ constraints: { purposes: ["prepare-update"], maxUses: 1 } });

    const checked = await denyThroughKernel([bounded], accessContext());

    expect(checked.reason).toBe("usage_store_unavailable");
    expect(checked.metadata).toMatchObject({
      failClosed: true,
      missingDependency: "usageStore",
    });
  });

  it("says nothing extra on an allow", async () => {
    const events: AuditEvent[] = [];
    const kernel = new SharedOSKernel({
      grantSource: new OneGrantSource([grant()]),
      audit: { record: async (event) => void events.push(event) },
    });

    await kernel.authorize(accessContext(), { resource: RESOURCE, action: "read" });

    const checked = events.find((event) => event.type === "authorization.checked");
    expect(checked?.outcome).toBe("allowed");
    expect(checked?.metadata).toEqual({ consumed: false });
  });
});
