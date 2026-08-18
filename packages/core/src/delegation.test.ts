import { describe, expect, it } from "vitest";

import type {
  AccessContext,
  CapabilityGrant,
  CapabilityConstraints,
  ResourceRef,
} from "@aicoo/sharedos-contracts";
import { CapabilityGrantSchema } from "@aicoo/sharedos-contracts";

import type { ResolvedAuthority } from "./authority.js";
import { CapabilityAuthorizer } from "./authorization.js";
import { type DelegationChainResolver, validateDelegationChain } from "./delegation.js";

const NOW = "2026-08-03T09:00:00.000Z";
const OWNER = { kind: "human", userId: "user-alice" } as const;
const MANAGER = { kind: "agent", agentId: "agent-manager" } as const;
const WORKER = { kind: "agent", agentId: "agent-worker" } as const;
const PROJECT: ResourceRef = { namespace: "files", path: ["Workspace", "projects"], owner: OWNER };
const REPORT: ResourceRef = {
  namespace: "files",
  path: ["Workspace", "projects", "report"],
  owner: OWNER,
};

/** Root authority the owner issued directly to the manager. */
function parentGrant(overrides: Partial<CapabilityGrant> = {}): CapabilityGrant {
  return {
    id: "grant-parent",
    namespaceId: "world-alpha",
    subject: MANAGER,
    issuer: OWNER,
    capabilities: [{ resource: PROJECT, actions: ["read", "write"], scope: "descendants" }],
    constraints: {
      purposes: ["prepare-update", "review"],
      expiresAt: "2026-08-04T00:00:00.000Z",
      delegationDepth: 2,
    },
    issuedAt: "2026-08-03T08:00:00.000Z",
    ...overrides,
  };
}

/** Authority the manager re-issued to a worker, narrowed on every axis. */
function childGrant(
  overrides: Partial<CapabilityGrant> = {},
  constraints: Partial<CapabilityConstraints> = {},
): CapabilityGrant {
  return {
    id: "grant-child",
    namespaceId: "world-alpha",
    subject: WORKER,
    issuer: MANAGER,
    capabilities: [{ resource: REPORT, actions: ["read"], scope: "exact" }],
    constraints: {
      purposes: ["prepare-update"],
      expiresAt: "2026-08-03T18:00:00.000Z",
      delegationDepth: 1,
      ...constraints,
    },
    issuedAt: "2026-08-03T08:30:00.000Z",
    parentGrantId: "grant-parent",
    ...overrides,
  };
}

function context(): AccessContext {
  return {
    namespaceId: "world-alpha",
    enabledToolNamespaces: [],
    actor: WORKER,
    authority: MANAGER,
    owner: OWNER,
    purpose: "prepare-update",
    traceId: "trace-1",
    now: NOW,
  };
}

/** Authority as the kernel would have resolved it from a trusted source. */
function authorityOf(grants: readonly CapabilityGrant[]): ResolvedAuthority {
  return {
    context: context(),
    grants: [...grants],
    snapshot: {
      hash: `snapshot-${grants.map(({ id }) => id).join("+")}`,
      grantIds: grants.map(({ id }) => id),
      grantCount: grants.length,
      loadedAt: NOW,
    },
  };
}

function resolverFor(...grants: readonly CapabilityGrant[]): DelegationChainResolver {
  const byId = new Map(grants.map((grant) => [`${grant.namespaceId}/${grant.id}`, grant]));
  return {
    resolve: async (namespaceId, grantId) => byId.get(`${namespaceId}/${grantId}`),
  };
}

async function validate(
  child: CapabilityGrant,
  resolver: DelegationChainResolver | undefined,
): Promise<ReturnType<typeof validateDelegationChain>> {
  return validateDelegationChain(child, context(), Date.parse(NOW), {
    ...(resolver === undefined ? {} : { resolver }),
  });
}

describe("delegation chain validation", () => {
  it("accepts a root grant without consulting a resolver", async () => {
    await expect(validate(parentGrant(), undefined)).resolves.toEqual({
      status: "valid",
      chain: [],
    });
  });

  it("accepts a chain that narrows resource, action, purpose, time, and depth", async () => {
    const parent = parentGrant();
    await expect(validate(childGrant(), resolverFor(parent))).resolves.toEqual({
      status: "valid",
      chain: ["grant-parent"],
    });
  });

  it("invalidates a descendant once its ancestor is revoked", async () => {
    const revoked = parentGrant({ revokedAt: "2026-08-03T08:45:00.000Z" });

    await expect(validate(childGrant(), resolverFor(revoked))).resolves.toEqual({
      status: "invalid",
      chain: [],
      code: "parent_inactive",
      grantId: "grant-parent",
    });
  });

  it("invalidates a descendant once its ancestor expires", async () => {
    const expired = parentGrant({
      constraints: { ...parentGrant().constraints, expiresAt: "2026-08-03T08:50:00.000Z" },
    });

    await expect(validate(childGrant(), resolverFor(expired))).resolves.toMatchObject({
      status: "invalid",
      code: "parent_inactive",
    });
  });

  it("invalidates a grandchild when the root of the chain is revoked", async () => {
    const root = parentGrant({
      id: "grant-root",
      subject: OWNER,
      issuer: OWNER,
      revokedAt: "2026-08-03T08:40:00.000Z",
      constraints: { ...parentGrant().constraints, delegationDepth: 3 },
    });
    const middle = parentGrant({ parentGrantId: "grant-root", issuer: OWNER });
    const leaf = childGrant();

    await expect(validate(leaf, resolverFor(root, middle))).resolves.toEqual({
      status: "invalid",
      chain: ["grant-parent"],
      code: "parent_inactive",
      grantId: "grant-root",
    });
  });

  it("rejects a link whose issuer is not the parent's subject", async () => {
    const forged = childGrant({ issuer: OWNER });

    await expect(validate(forged, resolverFor(parentGrant()))).resolves.toMatchObject({
      status: "invalid",
      code: "issuer_not_parent_subject",
    });
  });

  it("rejects a child that widens the resource path", async () => {
    const widened = childGrant({
      capabilities: [
        {
          resource: { namespace: "files", path: ["Workspace"], owner: OWNER },
          actions: ["read"],
          scope: "descendants",
        },
      ],
    });

    await expect(validate(widened, resolverFor(parentGrant()))).resolves.toMatchObject({
      status: "invalid",
      code: "capability_widened",
    });
  });

  it("rejects a child that widens actions, including a wildcard", async () => {
    const widened = childGrant({
      capabilities: [{ resource: REPORT, actions: ["*"], scope: "exact" }],
    });

    await expect(validate(widened, resolverFor(parentGrant()))).resolves.toMatchObject({
      status: "invalid",
      code: "capability_widened",
    });
  });

  it("rejects a child that outlives, outlasts, or outspends its parent", async () => {
    const parent = parentGrant({
      constraints: { ...parentGrant().constraints, maxUses: 5 },
    });

    await expect(
      validate(childGrant({}, { expiresAt: "2026-08-05T00:00:00.000Z" }), resolverFor(parent)),
    ).resolves.toMatchObject({ status: "invalid", code: "constraints_widened" });

    await expect(
      validate(childGrant({}, { purposes: ["prepare-update", "exfiltrate"] }), resolverFor(parent)),
    ).resolves.toMatchObject({ status: "invalid", code: "constraints_widened" });

    await expect(
      validate(childGrant({}, { maxUses: 50 }), resolverFor(parent)),
    ).resolves.toMatchObject({ status: "invalid", code: "constraints_widened" });

    await expect(
      validate(childGrant({ issuedAt: "2026-08-03T07:00:00.000Z" }), resolverFor(parent)),
    ).resolves.toMatchObject({ status: "invalid", code: "constraints_widened" });
  });

  it("requires delegation budget that strictly decreases at each link", async () => {
    const exhausted = parentGrant({
      constraints: { ...parentGrant().constraints, delegationDepth: 0 },
    });
    await expect(validate(childGrant(), resolverFor(exhausted))).resolves.toMatchObject({
      status: "invalid",
      code: "delegation_not_permitted",
    });

    const undeclared = parentGrant({ constraints: { purposes: ["prepare-update"] } });
    await expect(validate(childGrant(), resolverFor(undeclared))).resolves.toMatchObject({
      status: "invalid",
      code: "delegation_not_permitted",
    });

    const parent = parentGrant({
      constraints: { ...parentGrant().constraints, delegationDepth: 1 },
    });
    await expect(validate(childGrant(), resolverFor(parent))).resolves.toMatchObject({
      status: "invalid",
      code: "delegation_depth_exceeded",
    });
  });

  it("rejects a chain that crosses namespaces", async () => {
    const foreign = parentGrant({ namespaceId: "world-beta" });

    await expect(validate(childGrant(), resolverFor(foreign))).resolves.toMatchObject({
      status: "unverified",
      code: "parent_not_found",
    });
  });

  it("rejects a cyclic chain instead of looping", async () => {
    const first = parentGrant({
      id: "grant-a",
      parentGrantId: "grant-b",
      subject: MANAGER,
      issuer: OWNER,
      constraints: { ...parentGrant().constraints, delegationDepth: 1 },
    });
    const second = parentGrant({ id: "grant-b", parentGrantId: "grant-a", subject: OWNER });

    await expect(validate(first, resolverFor(first, second))).resolves.toMatchObject({
      status: "invalid",
      code: "chain_cycle",
    });
  });

  it("fails closed when the chain cannot be established", async () => {
    await expect(validate(childGrant(), undefined)).resolves.toMatchObject({
      status: "unverified",
      code: "resolver_unavailable",
    });

    await expect(validate(childGrant(), resolverFor())).resolves.toMatchObject({
      status: "unverified",
      code: "parent_not_found",
    });

    const failing: DelegationChainResolver = {
      resolve: async () => {
        throw new Error("grant store is unreachable");
      },
    };
    await expect(validate(childGrant(), failing)).resolves.toMatchObject({
      status: "unverified",
      code: "resolver_failed",
    });
  });
});

describe("CapabilityAuthorizer delegation", () => {
  const request = { resource: REPORT, action: "read" } as const;

  it("authorizes a delegated grant only through a verified chain", async () => {
    const authorizer = new CapabilityAuthorizer({
      delegationResolver: resolverFor(parentGrant()),
    });

    await expect(authorizer.authorize(authorityOf([childGrant()]), request)).resolves.toEqual({
      allowed: true,
      reasonCode: "allowed",
      matchedGrantId: "grant-child",
    });
  });

  it("denies a delegated grant whose parent was revoked and reports the failing link", async () => {
    const authorizer = new CapabilityAuthorizer({
      delegationResolver: resolverFor(parentGrant({ revokedAt: "2026-08-03T08:45:00.000Z" })),
    });

    await expect(authorizer.authorize(authorityOf([childGrant()]), request)).resolves.toEqual({
      allowed: false,
      reasonCode: "delegation_chain_invalid",
      metadata: { delegation: { code: "parent_inactive", grantId: "grant-parent" } },
    });
  });

  it("denies a delegated grant when no resolver is installed", async () => {
    const authorizer = new CapabilityAuthorizer();

    await expect(authorizer.authorize(authorityOf([childGrant()]), request)).resolves.toMatchObject(
      {
        allowed: false,
        reasonCode: "delegation_chain_unverified",
      },
    );
  });

  it("keeps a directly issued grant usable while a delegated sibling is denied", async () => {
    const direct: CapabilityGrant = {
      id: "grant-direct",
      namespaceId: "world-alpha",
      subject: WORKER,
      issuer: MANAGER,
      capabilities: [{ resource: REPORT, actions: ["read"], scope: "exact" }],
      constraints: { purposes: ["prepare-update"] },
      issuedAt: "2026-08-03T08:30:00.000Z",
    };
    const authorizer = new CapabilityAuthorizer({ delegationResolver: resolverFor() });

    await expect(
      authorizer.authorize(authorityOf([childGrant(), direct]), request),
    ).resolves.toMatchObject({ allowed: true, matchedGrantId: "grant-direct" });
  });

  it("reports an unverifiable chain ahead of a merely invalid one", async () => {
    const invalid = childGrant({ id: "grant-invalid", issuer: OWNER });
    const unverifiable = childGrant({ id: "grant-missing", parentGrantId: "grant-absent" });
    const authorizer = new CapabilityAuthorizer({
      delegationResolver: resolverFor(parentGrant()),
    });

    await expect(
      authorizer.authorize(authorityOf([invalid, unverifiable]), request),
    ).resolves.toMatchObject({ allowed: false, reasonCode: "delegation_chain_unverified" });
  });
});

describe("delegated grant contract", () => {
  it("accepts a parent reference and rejects a self-referencing grant", () => {
    expect(CapabilityGrantSchema.safeParse(childGrant()).success).toBe(true);
    expect(
      CapabilityGrantSchema.safeParse(childGrant({ parentGrantId: "grant-child" })).success,
    ).toBe(false);
  });
});
