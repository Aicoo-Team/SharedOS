import { describe, expect, it } from "vitest";

import type {
  AccessContext,
  Capability,
  CapabilityGrant,
  ResourceRef,
} from "@aicoo/sharedos-contracts";

import { CapabilityAuthorizer, capabilityMatches } from "./authorization.js";
import { deriveGrant, type GrantChainResolver } from "./delegation.js";

/**
 * Generated coverage for the two properties the kernel is *for*. Handwritten
 * allow/deny pairs only ever check the cases someone thought of; these check
 * the shape of the rule over inputs nobody chose.
 *
 * The generator is a seeded PRNG rather than a dependency: a permission kernel
 * should not pull a package into its own proof, and a fixed seed means a
 * counterexample is reproducible from the failure message alone.
 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const OWNER = { kind: "human", userId: "operator" } as const;
const ACTOR = { kind: "agent", agentId: "robot-a" } as const;
const DELEGATE = { kind: "agent", agentId: "robot-b" } as const;
const NOW = "2026-08-20T09:00:00.000Z";

// Deliberately prefix-colliding: `cell-3` must never cover `cell-30`.
const SEGMENTS = ["cell-3", "cell-30", "arm-1", "arm-10", "gripper"];
const ACTIONS = ["move", "grip", "release", "weld"];
const PURPOSES = ["pick-and-place", "teardown"];

type Rng = () => number;

function pick<T>(rng: Rng, values: readonly T[]): T {
  return values[Math.floor(rng() * values.length)]!;
}

function pickSome<T>(rng: Rng, values: readonly T[], max = values.length): T[] {
  const count = 1 + Math.floor(rng() * Math.min(max, values.length));
  const pool = [...values];
  const chosen: T[] = [];
  for (let index = 0; index < count && pool.length > 0; index += 1) {
    chosen.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]!);
  }
  return chosen;
}

function path(rng: Rng, maxLength = 3): string[] {
  const length = Math.floor(rng() * (maxLength + 1));
  return Array.from({ length }, () => pick(rng, SEGMENTS));
}

function capability(rng: Rng): Capability {
  return {
    resource: { namespace: "fleet", path: path(rng), owner: OWNER },
    actions: pickSome(rng, ACTIONS, 3),
    scope: rng() < 0.5 ? "exact" : "descendants",
  };
}

function grant(rng: Rng, id: string): CapabilityGrant {
  return {
    id,
    namespaceId: "fleet",
    subject: ACTOR,
    issuer: OWNER,
    capabilities: Array.from({ length: 1 + Math.floor(rng() * 3) }, () => capability(rng)),
    constraints: { delegationDepth: 2, ...(rng() < 0.5 ? { purposes: [...PURPOSES] } : {}) },
    issuedAt: "2026-08-20T08:00:00.000Z",
  };
}

function request(rng: Rng): { resource: ResourceRef; action: string } {
  return {
    resource: { namespace: "fleet", path: path(rng), owner: OWNER },
    action: pick(rng, ACTIONS),
  };
}

function context(grants: CapabilityGrant[], overrides: Partial<AccessContext> = {}): AccessContext {
  return {
    namespaceId: "fleet",
    enabledToolNamespaces: [],
    actor: ACTOR,
    authority: OWNER,
    owner: OWNER,
    purpose: PURPOSES[0]!,
    traceId: "trace",
    grants,
    now: NOW,
    ...overrides,
  };
}

describe("invariant: authority never comes from a cross-product", () => {
  it("anything allowed is covered by one capability inside one grant", async () => {
    const authorizer = new CapabilityAuthorizer();

    for (let seed = 1; seed <= 400; seed += 1) {
      const rng = mulberry32(seed);
      const grants = Array.from({ length: 1 + Math.floor(rng() * 3) }, (_, index) =>
        grant(rng, `grant-${index}`),
      );
      const access = context(grants);
      const attempt = request(rng);

      const decision = await authorizer.authorize(access, attempt);
      if (!decision.allowed) continue;

      // The whole point of the kernel: an allow is always attributable to one
      // complete capability, never assembled from pieces of several.
      const covering = grants.flatMap((candidate) =>
        candidate.capabilities
          .filter((entry) => capabilityMatches(entry, attempt, access))
          .map(() => candidate.id),
      );
      expect(covering, `seed ${seed}`).not.toHaveLength(0);
      expect(covering, `seed ${seed}`).toContain(decision.matchedGrantId);
    }
  });

  it("splitting one capability across two grants authorizes nothing", async () => {
    const authorizer = new CapabilityAuthorizer();

    for (let seed = 1; seed <= 400; seed += 1) {
      const rng = mulberry32(seed + 10_000);
      const attempt = request(rng);
      // One grant carries the resource with the wrong action; another carries
      // the action on the wrong resource. Together they "cover" the request.
      const resourceOnly: CapabilityGrant = {
        ...grant(rng, "resource-only"),
        capabilities: [
          {
            resource: attempt.resource,
            actions: ACTIONS.filter((action) => action !== attempt.action).slice(0, 1),
            scope: "exact",
          },
        ],
      };
      const actionOnly: CapabilityGrant = {
        ...grant(rng, "action-only"),
        capabilities: [
          {
            resource: { namespace: "fleet", path: ["somewhere-else"], owner: OWNER },
            actions: [attempt.action],
            scope: "descendants",
          },
        ],
      };

      const decision = await authorizer.authorize(context([resourceOnly, actionOnly]), attempt);
      expect(decision.allowed, `seed ${seed}`).toBe(false);
    }
  });
});

describe("invariant: a derived grant never outreaches its parent", () => {
  it("everything the child allows, the parent also allows", async () => {
    let derivations = 0;

    for (let seed = 1; seed <= 600; seed += 1) {
      const rng = mulberry32(seed + 20_000);
      const parent = grant(rng, "parent");
      // Ask for a subset drawn from the parent's own capabilities, sometimes
      // narrowed further, sometimes not narrowed at all.
      const requested = pickSome(rng, parent.capabilities).map((entry) => ({
        ...entry,
        actions: pickSome(rng, entry.actions),
        ...(rng() < 0.4 && entry.scope === "descendants"
          ? { resource: { ...entry.resource, path: [...entry.resource.path, pick(rng, SEGMENTS)] } }
          : {}),
      }));

      const derivation = deriveGrant(parent, {
        id: "child",
        subject: DELEGATE,
        capabilities: requested,
        issuedAt: NOW,
      });
      if (!derivation.ok) continue;
      derivations += 1;

      const resolver: GrantChainResolver = {
        async get(_namespaceId, grantId) {
          return grantId === parent.id ? parent : undefined;
        },
      };
      const childAuthorizer = new CapabilityAuthorizer({ chainResolver: resolver });
      const parentAuthorizer = new CapabilityAuthorizer();

      for (let probe = 0; probe < 6; probe += 1) {
        const attempt = request(rng);
        const childDecision = await childAuthorizer.authorize(
          context([derivation.grant], { actor: DELEGATE, authority: ACTOR }),
          attempt,
        );
        if (!childDecision.allowed) continue;

        const parentDecision = await parentAuthorizer.authorize(context([parent]), attempt);
        expect(
          parentDecision.allowed,
          `seed ${seed} probe ${probe}: child allowed ${attempt.action} on ${attempt.resource.path.join("/")} but parent did not`,
        ).toBe(true);
      }
    }

    // A vacuous pass would be worse than a failure.
    expect(derivations).toBeGreaterThan(50);
  });

  it("revoking the root stops every descendant, at any depth", async () => {
    const rng = mulberry32(99);
    const root = grant(rng, "root");
    const first = deriveGrant(root, {
      id: "mid",
      subject: DELEGATE,
      capabilities: root.capabilities,
      issuedAt: NOW,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = deriveGrant(first.grant, {
      id: "leaf",
      subject: { kind: "agent", agentId: "robot-c" },
      capabilities: first.grant.capabilities,
      issuedAt: NOW,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.grant.delegation?.chain).toEqual(["root", "mid"]);

    const attempt = {
      resource: root.capabilities[0]!.resource,
      action: root.capabilities[0]!.actions[0]!,
    };
    const live = new Map([
      ["root", root],
      ["mid", first.grant],
    ]);
    const resolver: GrantChainResolver = {
      async get(_ns, id) {
        return live.get(id);
      },
    };
    const authorizer = new CapabilityAuthorizer({ chainResolver: resolver });
    const access = context([second.grant], {
      actor: { kind: "agent", agentId: "robot-c" },
      authority: DELEGATE,
    });

    await expect(authorizer.authorize(access, attempt)).resolves.toEqual(
      expect.objectContaining({ allowed: true }),
    );

    // Revoke the root only. Nothing about the leaf changes.
    live.set("root", { ...root, revokedAt: "2026-08-20T08:30:00.000Z" });
    await expect(authorizer.authorize(access, attempt)).resolves.toEqual(
      expect.objectContaining({ allowed: false }),
    );
  });
});
