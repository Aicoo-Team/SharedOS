import { describe, expect, it, vi } from "vitest";

import type {
  AccessContext,
  Address,
  CapabilityGrant,
  ResourceOperation,
  ResourceResult,
} from "@aicoo/sharedos-contracts";
import {
  SharedOSKernel,
  addressesEqual,
  type GrantSource,
  type ResourceProvider,
} from "@aicoo/sharedos-core";

import { registerStandardOsTools } from "./index.js";

const NOW = "2026-09-05T09:00:00.000Z";
const NAMESPACE_ID = "permission-shaped-search";
const PURPOSE = "launch-review";
const OWNER = { kind: "human", userId: "team-owner" } as const satisfies Address;
const ROOTS = {
  company: ["Team", "Company"],
  product: ["Team", "Product"],
  finance: ["Team", "Finance"],
} as const;

const agents = [
  { id: "maya", address: { kind: "agent", agentId: "maya-agent" } },
  { id: "kenji", address: { kind: "agent", agentId: "kenji-agent" } },
  { id: "noor", address: { kind: "agent", agentId: "noor-agent" } },
] as const satisfies readonly { id: string; address: Address }[];

const documents: Record<string, { area: string; text: string }[]> = {
  "Team/Company": [{ area: "Company", text: "Partner messaging is still open." }],
  "Team/Product": [{ area: "Product", text: "Migration retries may add three days." }],
  "Team/Finance": [{ area: "Finance", text: "The vendor exception expires Friday." }],
};

function grant(id: string, subject: Address, path: readonly string[]): CapabilityGrant {
  return {
    id,
    namespaceId: NAMESPACE_ID,
    subject,
    issuer: OWNER,
    capabilities: [
      {
        resource: { namespace: "files", path: [...path], owner: OWNER },
        actions: ["search"],
        scope: "exact",
      },
    ],
    constraints: { purposes: [PURPOSE] },
    issuedAt: NOW,
  };
}

class MutableGrantSource implements GrantSource {
  readonly #grants: CapabilityGrant[];

  constructor(grants: CapabilityGrant[]) {
    this.#grants = grants;
  }

  issue(next: CapabilityGrant): void {
    this.#grants.push(next);
  }

  async load(context: AccessContext): Promise<readonly CapabilityGrant[]> {
    await Promise.resolve();
    return this.#grants.filter(
      (candidate) =>
        candidate.namespaceId === context.namespaceId &&
        addressesEqual(candidate.subject, context.actor) &&
        addressesEqual(candidate.issuer, context.authority),
    );
  }
}

function context(agent: (typeof agents)[number], turn: string): AccessContext {
  return {
    namespaceId: NAMESPACE_ID,
    actor: agent.address,
    authority: OWNER,
    owner: OWNER,
    purpose: PURPOSE,
    traceId: `${turn}-${agent.id}`,
    enabledToolNamespaces: ["files"],
    now: NOW,
  };
}

describe("permission-shaped search", () => {
  it("returns only reachable results and observes a new grant on the next turn", async () => {
    const source = new MutableGrantSource([
      grant("grant-maya-company", agents[0].address, ROOTS.company),
      grant("grant-kenji-company", agents[1].address, ROOTS.company),
      grant("grant-kenji-product", agents[1].address, ROOTS.product),
      grant("grant-noor-company", agents[2].address, ROOTS.company),
      grant("grant-noor-product", agents[2].address, ROOTS.product),
      grant("grant-noor-finance", agents[2].address, ROOTS.finance),
    ]);
    const invoke = vi.fn(async (operation: ResourceOperation): Promise<ResourceResult> => ({
      operationId: operation.operationId,
      status: "succeeded",
      output: { hits: documents[operation.resource.path.join("/")] ?? [] },
      completedAt: operation.context.now,
    }));
    const files: ResourceProvider = { namespace: "files", invoke };
    const kernel = new SharedOSKernel({ grantSource: source });
    registerStandardOsTools(kernel, { files });

    // One authority lease per turn, which is the shape `SharedOSExecutor` runs
    // every turn in; reach and the calls it produced then decide against one
    // authority state rather than re-reading the store between them.
    async function search(agent: (typeof agents)[number], turn: string) {
      const access = context(agent, turn);
      const scope = await kernel.openTurnAuthority(access);
      try {
        const reach = await kernel.reach(access);
        expect(reach.status).toBe("computed");
        if (reach.status !== "computed") throw new Error(`reach unavailable: ${reach.reasonCode}`);

        const roots = reach.reach.filter(
          (entry) => entry.namespace === "files" && entry.actions.includes("search"),
        );
        const results = await Promise.all(
          roots.map((root, index) =>
            kernel.invokeTool(access, {
              id: `${turn}-${agent.id}-${index}`,
              tool: "files.search",
              arguments: { path: root.path, query: "What could delay the Meridian launch?" },
              traceId: access.traceId,
              requestedAt: NOW,
            }),
          ),
        );
        const hits = results.flatMap((result) =>
          result.status === "succeeded" ? ((result.output as { hits: unknown[] }).hits ?? []) : [],
        );
        return { roots, hits };
      } finally {
        scope.close();
      }
    }

    const before = await Promise.all(agents.map((agent) => search(agent, "before")));
    expect(before.map(({ hits }) => hits.length)).toEqual([1, 2, 3]);
    expect(before.map(({ roots }) => roots.map(({ path }) => path.at(-1)).sort())).toEqual([
      ["Company"],
      ["Company", "Product"],
      ["Company", "Finance", "Product"],
    ]);

    const callsBeforeProbe = invoke.mock.calls.length;
    const probe = await kernel.invokeTool(context(agents[0], "probe"), {
      id: "probe-maya-finance",
      tool: "files.search",
      arguments: { path: [...ROOTS.finance], query: "What could delay the Meridian launch?" },
      traceId: "probe-maya",
      requestedAt: NOW,
    });
    expect(probe).toMatchObject({ status: "denied", error: { code: "no_matching_grant" } });
    expect(invoke).toHaveBeenCalledTimes(callsBeforeProbe);

    source.issue(grant("grant-maya-finance", agents[0].address, ROOTS.finance));
    const after = await search(agents[0], "after");
    expect(after.hits).toHaveLength(2);
    expect(after.roots.map(({ path }) => path.at(-1)).sort()).toEqual(["Company", "Finance"]);
  });
});
