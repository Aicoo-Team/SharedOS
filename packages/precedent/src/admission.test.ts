import type {
  AccessContext,
  AuthorizationDecision,
  Capability,
  CapabilityConstraints,
  CapabilityRequest,
} from "@aicoo/sharedos-contracts";
import { mintCapabilityRequest } from "@aicoo/sharedos-core";
import { beforeAll, describe, expect, it } from "vitest";

import {
  admitAutoDecision,
  AUTO_DECIDED_METADATA_KEY,
  type AutoDecisionProposal,
  readAutoDecided,
} from "./admission.js";
import { autoDecisionAuditEvent } from "./audit.js";
import { precedentKey } from "./key.js";
import { InMemoryPrecedentLookup, type Precedent } from "./lookup.js";

const OWNER = { kind: "human", userId: "owner-1" } as const;
const REQUESTER = { kind: "agent", agentId: "agent-a" } as const;

const Q3: Capability = {
  resource: { namespace: "files", path: ["projects", "q3"] },
  actions: ["read", "search"],
  scope: "descendants",
};
const Q3_LAUNCH_READ: Capability = {
  resource: { namespace: "files", path: ["projects", "q3", "launch"] },
  actions: ["read"],
  scope: "descendants",
};
const Q4: Capability = {
  resource: { namespace: "files", path: ["projects", "q4"] },
  actions: ["read"],
  scope: "descendants",
};

function context(overrides: Partial<AccessContext> = {}): AccessContext {
  return {
    namespaceId: "ns-1",
    actor: REQUESTER,
    authority: OWNER,
    owner: OWNER,
    purpose: "support triage",
    traceId: "trace-1",
    enabledToolNamespaces: [],
    now: "2026-09-02T09:00:00.000Z",
    ...overrides,
  };
}

async function requestFor(
  capabilities: readonly Capability[],
  overrides: Partial<AccessContext> = {},
): Promise<CapabilityRequest> {
  const request = await mintCapabilityRequest(context(overrides), {
    capabilities: [...capabilities],
    purpose: overrides.purpose ?? "support triage",
  });
  if (request === undefined) {
    throw new Error("fixture did not mint");
  }
  return request;
}

function approved(
  requestId: string,
  askedFor: CapabilityRequest,
  capabilities: readonly Capability[],
  constraints: CapabilityConstraints = {},
): Precedent {
  return {
    outcome: "approved",
    requestId,
    key: precedentKey(askedFor),
    capabilities,
    constraints,
    decidedAt: "2026-08-01T09:00:00.000Z",
  };
}

function refused(requestId: string, askedFor: CapabilityRequest): Precedent {
  return {
    outcome: "refused",
    requestId,
    key: precedentKey(askedFor),
    decidedAt: "2026-08-01T09:00:00.000Z",
  };
}

function proposal(
  request: CapabilityRequest,
  citedRequestIds: readonly string[],
  proposed: AutoDecisionProposal["proposed"],
): AutoDecisionProposal {
  return { request, citedRequestIds, proposed, marker: { matcher: "jaccard-v3" } };
}

/** The same ask, made earlier. Its key is identical; its request id is not. */
let sameQuestion: CapabilityRequest;
/** A different ask by the same requester, on the same owner. */
let similarQuestion: CapabilityRequest;
/** The escalation now in front of the control plane. */
let request: CapabilityRequest;

beforeAll(async () => {
  request = await requestFor([Q3]);
  sameQuestion = await requestFor([Q3], { now: "2026-08-01T08:00:00.000Z" });
  similarQuestion = await requestFor([Q4], { now: "2026-08-01T08:00:00.000Z" });
});

describe("R1: fuzzy evidence may only narrow", () => {
  it("admits exact + deny", async () => {
    const lookup = new InMemoryPrecedentLookup([refused("p-exact", sameQuestion)]);

    await expect(
      admitAutoDecision(proposal(request, ["p-exact"], { allowed: false }), lookup),
    ).resolves.toMatchObject({
      admitted: true,
      decision: { allowed: false, match: "exact", citedRequestIds: ["p-exact"] },
    });
  });

  it("admits fuzzy + deny, because a refusal takes away nothing already absent", async () => {
    const lookup = new InMemoryPrecedentLookup([refused("p-similar", similarQuestion)]);

    await expect(
      admitAutoDecision(proposal(request, ["p-similar"], { allowed: false }), lookup),
    ).resolves.toMatchObject({
      admitted: true,
      decision: { allowed: false, match: "fuzzy" },
    });
  });

  it("admits exact + allow at the full width a human approved", async () => {
    // The owner approved something wider than the ask. Only an identical
    // question may be answered at that width.
    const lookup = new InMemoryPrecedentLookup([approved("p-exact", sameQuestion, [Q3])]);

    await expect(
      admitAutoDecision(
        proposal(request, ["p-exact"], { allowed: true, capabilities: [Q3] }),
        lookup,
      ),
    ).resolves.toMatchObject({
      admitted: true,
      decision: { allowed: true, narrowed: false, match: "exact", capabilities: [Q3] },
    });
  });

  it("downgrades fuzzy + allow to a narrowed allow, never a refusal of the width itself", async () => {
    const lookup = new InMemoryPrecedentLookup([approved("p-similar", similarQuestion, [Q3])]);

    await expect(
      admitAutoDecision(
        proposal(request, ["p-similar"], { allowed: true, capabilities: [Q3_LAUNCH_READ] }),
        lookup,
      ),
    ).resolves.toMatchObject({
      admitted: true,
      decision: { allowed: true, narrowed: true, match: "fuzzy", capabilities: [Q3_LAUNCH_READ] },
    });
  });

  it("refuses a fuzzy allow at the precedent's full width, which is the widening R1 guards", async () => {
    const wide = await requestFor([Q3_LAUNCH_READ]);
    const lookup = new InMemoryPrecedentLookup([approved("p-similar", similarQuestion, [Q3])]);

    // Within the precedent, but wider than the question actually being asked.
    await expect(
      admitAutoDecision(
        proposal(wide, ["p-similar"], { allowed: true, capabilities: [Q3] }),
        lookup,
      ),
    ).resolves.toEqual({ admitted: false, reason: "wider_than_request" });
  });

  it("reads a citation mixing an identical and a similar precedent as fuzzy", async () => {
    const lookup = new InMemoryPrecedentLookup([
      approved("p-exact", sameQuestion, [Q3]),
      approved("p-similar", similarQuestion, [Q3]),
    ]);
    const cited = { allowed: true, capabilities: [Q3] } as const;

    // R1 is about what the whole citation supports, not about its best member:
    // the similar row is still evidence the proposal leans on. Citing the
    // identical precedent alone is exact and comes back at full width.
    await expect(
      admitAutoDecision(proposal(request, ["p-exact", "p-similar"], cited), lookup),
    ).resolves.toMatchObject({ admitted: true, decision: { match: "fuzzy", narrowed: true } });
    await expect(
      admitAutoDecision(proposal(request, ["p-exact"], cited), lookup),
    ).resolves.toMatchObject({ admitted: true, decision: { match: "exact", narrowed: false } });
  });
});

describe("propose versus permit", () => {
  it("cannot read a width off a refusal", async () => {
    const lookup = new InMemoryPrecedentLookup([refused("p-exact", sameQuestion)]);

    await expect(
      admitAutoDecision(
        proposal(request, ["p-exact"], { allowed: true, capabilities: [Q3] }),
        lookup,
      ),
    ).resolves.toEqual({ admitted: false, reason: "allow_cites_refusal" });
  });

  it("has no width on a refusal to read in the first place", () => {
    const refusal = refused("p-exact", sameQuestion);

    // @ts-expect-error a refusal has no capabilities, which is why a denial can
    // never be turned into an allow: there is nothing to bound one by.
    expect(refusal.capabilities).toBeUndefined();
  });

  it("is not an AuthorizationDecision and cannot be returned as one", async () => {
    const lookup = new InMemoryPrecedentLookup([approved("p-exact", sameQuestion, [Q3])]);
    const admission = await admitAutoDecision(
      proposal(request, ["p-exact"], { allowed: true, capabilities: [Q3] }),
      lookup,
    );
    if (!admission.admitted) {
      throw new Error("fixture did not admit");
    }

    // @ts-expect-error an admitted auto-decision describes a grant for the host
    // to issue; it is not a decision any authorizer made and no port takes one.
    const decision: AuthorizationDecision = admission.decision;
    expect(decision.allowed).toBe(true);
  });
});

describe("R2: never wider than the precedents cited", () => {
  it("refuses a capability outside the one precedent cited", async () => {
    const lookup = new InMemoryPrecedentLookup([
      approved("p-exact", sameQuestion, [Q3_LAUNCH_READ]),
    ]);

    await expect(
      admitAutoDecision(
        proposal(request, ["p-exact"], { allowed: true, capabilities: [Q3] }),
        lookup,
      ),
    ).resolves.toEqual({ admitted: false, reason: "wider_than_precedent" });
  });

  it("refuses an action the precedent never carried", async () => {
    const lookup = new InMemoryPrecedentLookup([approved("p-exact", sameQuestion, [Q3])]);

    await expect(
      admitAutoDecision(
        proposal(request, ["p-exact"], {
          allowed: true,
          capabilities: [{ ...Q3, actions: ["read", "write"] }],
        }),
        lookup,
      ),
    ).resolves.toEqual({ admitted: false, reason: "wider_than_precedent" });
  });

  it("makes every proposal inadmissible when the cited precedents are disjoint", async () => {
    const lookup = new InMemoryPrecedentLookup([
      approved("p-one", sameQuestion, [Q3]),
      approved("p-two", sameQuestion, [Q4]),
    ]);

    for (const capabilities of [[Q3], [Q4], [Q3, Q4]]) {
      await expect(
        admitAutoDecision(
          proposal(request, ["p-one", "p-two"], { allowed: true, capabilities }),
          lookup,
        ),
      ).resolves.toEqual({ admitted: false, reason: "wider_than_precedent" });
    }
  });

  it("refuses an allow leaning on another requester's precedent", async () => {
    const otherAgent = await requestFor([Q3], {
      actor: { kind: "agent", agentId: "agent-b" },
      now: "2026-08-01T08:00:00.000Z",
    });
    const lookup = new InMemoryPrecedentLookup([approved("p-other", otherAgent, [Q3])]);

    await expect(
      admitAutoDecision(
        proposal(request, ["p-other"], { allowed: true, capabilities: [Q3] }),
        lookup,
      ),
    ).resolves.toEqual({ admitted: false, reason: "precedent_not_this_requester" });
  });

  it("refuses either outcome on another owner's precedent", async () => {
    const otherOwner = await requestFor([Q3], {
      owner: { kind: "human", userId: "owner-2" },
      authority: { kind: "human", userId: "owner-2" },
      now: "2026-08-01T08:00:00.000Z",
    });
    const lookup = new InMemoryPrecedentLookup([approved("p-other", otherOwner, [Q3])]);
    lookup.record(refused("p-other-refusal", otherOwner));

    for (const cited of [
      proposal(request, ["p-other"], { allowed: true, capabilities: [Q3] }),
      proposal(request, ["p-other-refusal"], { allowed: false }),
    ]) {
      await expect(admitAutoDecision(cited, lookup)).resolves.toEqual({
        admitted: false,
        reason: "precedent_not_this_owner",
      });
    }
  });
});

describe("R3: the tightest envelope", () => {
  it("takes the minimum expiry, latest start, minimum uses, and purpose intersection", async () => {
    const lookup = new InMemoryPrecedentLookup([
      approved("p-one", sameQuestion, [Q3], {
        expiresAt: "2026-12-31T00:00:00.000Z",
        notBefore: "2026-01-01T00:00:00.000Z",
        maxUses: 10,
        purposes: ["support triage", "billing"],
        delegationDepth: 4,
      }),
      approved("p-two", sameQuestion, [Q3], {
        expiresAt: "2026-10-01T00:00:00.000Z",
        notBefore: "2026-02-01T00:00:00.000Z",
        maxUses: 3,
        purposes: ["support triage", "audit"],
      }),
    ]);

    await expect(
      admitAutoDecision(
        proposal(request, ["p-one", "p-two"], { allowed: true, capabilities: [Q3] }),
        lookup,
      ),
    ).resolves.toMatchObject({
      admitted: true,
      decision: {
        constraints: {
          expiresAt: "2026-10-01T00:00:00.000Z",
          notBefore: "2026-02-01T00:00:00.000Z",
          maxUses: 3,
          purposes: ["support triage"],
          delegationDepth: 0,
        },
      },
    });
  });

  it("makes an auto-issued grant undelegable even from a delegable precedent", async () => {
    const lookup = new InMemoryPrecedentLookup([
      approved("p-exact", sameQuestion, [Q3], { delegationDepth: 3 }),
    ]);

    await expect(
      admitAutoDecision(
        proposal(request, ["p-exact"], { allowed: true, capabilities: [Q3] }),
        lookup,
      ),
    ).resolves.toMatchObject({
      admitted: true,
      decision: { constraints: { delegationDepth: 0 } },
    });
  });

  it("cites a bounded precedent, which delegation would have refused", async () => {
    const lookup = new InMemoryPrecedentLookup([
      approved("p-exact", sameQuestion, [Q3], { maxUses: 1 }),
    ]);

    await expect(
      admitAutoDecision(
        proposal(request, ["p-exact"], { allowed: true, capabilities: [Q3] }),
        lookup,
      ),
    ).resolves.toMatchObject({
      admitted: true,
      decision: { constraints: { maxUses: 1 } },
    });
  });

  it("refuses an envelope no cited decision supports", async () => {
    const disjointPurposes = new InMemoryPrecedentLookup([
      approved("p-one", sameQuestion, [Q3], { purposes: ["billing"] }),
      approved("p-two", sameQuestion, [Q3], { purposes: ["audit"] }),
    ]);
    const emptyWindow = new InMemoryPrecedentLookup([
      approved("p-one", sameQuestion, [Q3], { expiresAt: "2026-03-01T00:00:00.000Z" }),
      approved("p-two", sameQuestion, [Q3], { notBefore: "2026-06-01T00:00:00.000Z" }),
    ]);

    for (const lookup of [disjointPurposes, emptyWindow]) {
      await expect(
        admitAutoDecision(
          proposal(request, ["p-one", "p-two"], { allowed: true, capabilities: [Q3] }),
          lookup,
        ),
      ).resolves.toEqual({ admitted: false, reason: "envelope_unsatisfiable" });
    }
  });
});

describe("R4: every auto-decision is marked", () => {
  it("refuses a proposal that declares no matcher", async () => {
    const lookup = new InMemoryPrecedentLookup([approved("p-exact", sameQuestion, [Q3])]);

    for (const marker of [{ matcher: "" }, { matcher: "   " }, undefined]) {
      await expect(
        admitAutoDecision(
          {
            ...proposal(request, ["p-exact"], { allowed: true, capabilities: [Q3] }),
            marker: marker as { matcher: string },
          },
          lookup,
        ),
      ).resolves.toEqual({ admitted: false, reason: "auto_decision_unmarked" });
    }
  });

  it("marks a deny as well as an allow, so a whole class is selectable", async () => {
    const lookup = new InMemoryPrecedentLookup([
      refused("p-refusal", sameQuestion),
      approved("p-approval", sameQuestion, [Q3]),
    ]);

    for (const proposed of [
      { allowed: false } as const,
      { allowed: true, capabilities: [Q3] } as const,
    ]) {
      const cited = proposed.allowed ? "p-approval" : "p-refusal";
      const admission = await admitAutoDecision(proposal(request, [cited], proposed), lookup);
      if (!admission.admitted) {
        throw new Error(`expected ${cited} to be admitted`);
      }
      expect(readAutoDecided(admission.decision.metadata)).toEqual({
        matcher: "jaccard-v3",
        citedRequestIds: [cited],
        match: "exact",
      });
    }
  });

  it("reads no marker off a grant a person decided", () => {
    expect(readAutoDecided(undefined)).toBeUndefined();
    expect(readAutoDecided({ note: "approved in review" })).toBeUndefined();
    expect(readAutoDecided({ [AUTO_DECIDED_METADATA_KEY]: "jaccard-v3" })).toBeUndefined();
    expect(
      readAutoDecided({ [AUTO_DECIDED_METADATA_KEY]: { matcher: "m", citedRequestIds: [1] } }),
    ).toBeUndefined();
  });

  it("audits an admitted decision as its own event naming what it cited", async () => {
    const lookup = new InMemoryPrecedentLookup([approved("p-similar", similarQuestion, [Q3])]);
    const admission = await admitAutoDecision(
      proposal(request, ["p-similar"], { allowed: true, capabilities: [Q3_LAUNCH_READ] }),
      lookup,
    );
    if (!admission.admitted) {
      throw new Error("fixture did not admit");
    }

    expect(autoDecisionAuditEvent(context(), admission.decision)).toMatchObject({
      type: "escalation.auto_decided",
      outcome: "allowed",
      reason: "auto_allow_narrowed",
      metadata: {
        [AUTO_DECIDED_METADATA_KEY]: { matcher: "jaccard-v3", citedRequestIds: ["p-similar"] },
      },
    });
  });
});

describe("a proposal the lookup cannot answer", () => {
  it("fails closed on a throw, a missing row, or a row nobody cited", async () => {
    const throwing = {
      async load(): Promise<readonly Precedent[]> {
        throw new Error("store unavailable");
      },
    };
    const extra = {
      async load(): Promise<readonly Precedent[]> {
        return [approved("p-exact", sameQuestion, [Q3]), approved("p-other", sameQuestion, [Q3])];
      },
    };

    for (const lookup of [throwing, extra, new InMemoryPrecedentLookup()]) {
      await expect(
        admitAutoDecision(proposal(request, ["p-exact"], { allowed: false }), lookup),
      ).resolves.toEqual({ admitted: false, reason: "precedent_unavailable" });
    }
  });

  it("refuses a proposal that cites nothing, or an allow with no capability", async () => {
    const lookup = new InMemoryPrecedentLookup([approved("p-exact", sameQuestion, [Q3])]);

    await expect(
      admitAutoDecision(proposal(request, [], { allowed: false }), lookup),
    ).resolves.toEqual({ admitted: false, reason: "no_precedent_cited" });
    await expect(
      admitAutoDecision(
        proposal(request, ["p-exact"], { allowed: true, capabilities: [] }),
        lookup,
      ),
    ).resolves.toEqual({ admitted: false, reason: "empty_proposed_capability" });
  });

  it("treats one precedent cited twice as one citation", async () => {
    const lookup = new InMemoryPrecedentLookup([approved("p-exact", sameQuestion, [Q3])]);

    await expect(
      admitAutoDecision(
        proposal(request, ["p-exact", "p-exact"], { allowed: true, capabilities: [Q3] }),
        lookup,
      ),
    ).resolves.toMatchObject({
      admitted: true,
      decision: { allowed: true, citedRequestIds: ["p-exact"] },
    });
  });
});
