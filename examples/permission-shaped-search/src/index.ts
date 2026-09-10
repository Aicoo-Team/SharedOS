/**
 * One query, three agents, three different correct answers.
 *
 * The same `files.search` question is asked on behalf of three agents holding
 * one, two, and three granted roots. Nothing filters results afterward: the
 * turn asks `kernel.reach` which roots are worth naming, and every exact call
 * is authorized again before the provider runs. A root nobody granted is not
 * searched, and the provider never sees the query for it.
 *
 * Run: pnpm example:permission-shaped-search
 */
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
import { registerStandardOsTools } from "@aicoo/sharedos-os";

const NOW = "2026-09-05T09:00:00.000Z";
const NAMESPACE_ID = "permission-shaped-search";
const PURPOSE = "launch-review";
const QUERY = "What could delay the Meridian launch?";
const OWNER = { kind: "human", userId: "team-owner" } as const satisfies Address;

const ROOTS = {
  company: ["Team", "Company"],
  finance: ["Team", "Finance"],
  product: ["Team", "Product"],
} as const;

/** The host's documents. SharedOS never sees these until a call is allowed. */
const documents: Record<string, { area: string; text: string }[]> = {
  "Team/Company": [{ area: "Company", text: "Partner messaging is still open." }],
  "Team/Finance": [{ area: "Finance", text: "The vendor exception expires Friday." }],
  "Team/Product": [{ area: "Product", text: "Migration retries may add three days." }],
};

const agents = [
  { id: "maya", address: { kind: "agent", agentId: "maya-agent" } },
  { id: "kenji", address: { kind: "agent", agentId: "kenji-agent" } },
  { id: "noor", address: { kind: "agent", agentId: "noor-agent" } },
] as const satisfies readonly { id: string; address: Address }[];

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

/**
 * The owner's store, standing in for a host's grant source. Issuing into it is
 * the only way authority enters: no message and no model output can add one.
 */
class OwnerGrantStore implements GrantSource {
  readonly #grants: CapabilityGrant[] = [];

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

const store = new OwnerGrantStore();
store.issue(grant("grant-maya-company", agents[0].address, ROOTS.company));
store.issue(grant("grant-kenji-company", agents[1].address, ROOTS.company));
store.issue(grant("grant-kenji-product", agents[1].address, ROOTS.product));
store.issue(grant("grant-noor-company", agents[2].address, ROOTS.company));
store.issue(grant("grant-noor-product", agents[2].address, ROOTS.product));
store.issue(grant("grant-noor-finance", agents[2].address, ROOTS.finance));

/**
 * The host's search provider, counting what it was actually asked. A denied
 * call must leave this number alone; that is the difference between refusing a
 * search and running one and discarding the rows.
 */
let searchesRun = 0;
const files: ResourceProvider = {
  namespace: "files",
  async invoke(operation: ResourceOperation): Promise<ResourceResult> {
    searchesRun += 1;
    return {
      operationId: operation.operationId,
      status: "succeeded",
      output: { hits: documents[operation.resource.path.join("/")] ?? [] },
      completedAt: operation.context.now,
    };
  },
};

const kernel = new SharedOSKernel({ grantSource: store });
registerStandardOsTools(kernel, { files });

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

/** One turn: ask where this actor may look, then search exactly there. */
async function search(agent: (typeof agents)[number], turn: string) {
  const access = context(agent, turn);
  const scope = await kernel.openTurnAuthority(access);
  try {
    const reach = await kernel.reach(access);
    if (reach.status !== "computed") {
      throw new Error(`reach unavailable: ${reach.reasonCode}`);
    }
    const roots = reach.reach.filter(
      (entry) => entry.namespace === "files" && entry.actions.includes("search"),
    );
    const results = await Promise.all(
      roots.map((root, index) =>
        kernel.invokeTool(access, {
          id: `${turn}-${agent.id}-${index}`,
          tool: "files.search",
          arguments: { path: root.path, query: QUERY },
          traceId: access.traceId,
          requestedAt: NOW,
        }),
      ),
    );
    const hits = results.flatMap((result) =>
      result.status === "succeeded"
        ? ((result.output as { hits: { area: string }[] }).hits ?? [])
        : [],
    );
    return { roots: roots.map(({ path }) => path.at(-1) ?? "").sort(), hits };
  } finally {
    scope.close();
  }
}

function report(agent: (typeof agents)[number], found: Awaited<ReturnType<typeof search>>): void {
  const roots = `${found.roots.length} root${found.roots.length === 1 ? " " : "s"}`;
  console.log(
    `  ${agent.id.padEnd(7)} ${roots.padEnd(9)} ${found.roots.join(" + ").padEnd(29)} ${found.hits.length} hit${found.hits.length === 1 ? "" : "s"}`,
  );
}

async function main(): Promise<void> {
  console.log("\nSharedOS — one query, permission-shaped answers\n");
  console.log(`  Query, identical for all three: "${QUERY}"\n`);

  console.log("1. what each agent's turn can reach, and what comes back\n");
  for (const agent of agents) {
    report(agent, await search(agent, "before"));
  }

  // The boundary, stated as a call rather than as a claim. Maya names Finance
  // directly, which no grant of hers covers.
  console.log("\n2. maya names Team/Finance directly, which no grant of hers covers\n");
  const before = searchesRun;
  const probe = await kernel.invokeTool(context(agents[0], "probe"), {
    id: "probe-maya-finance",
    tool: "files.search",
    arguments: { path: [...ROOTS.finance], query: QUERY },
    traceId: "probe-maya",
    requestedAt: NOW,
  });
  console.log(
    `  DENY   Team/Finance   reason ${probe.status === "denied" ? probe.error.code : "none"}   provider invoked ${searchesRun - before} more times`,
  );
  // Printed and also asserted: an example nobody reads the output of should
  // still fail loudly if a refused search ever reaches the provider.
  if (probe.status !== "denied" || searchesRun !== before) {
    throw new Error("a denied search reached the provider");
  }

  // Authority changes in the store, not in a cache. The next turn sees it.
  store.issue(grant("grant-maya-finance", agents[0].address, ROOTS.finance));
  console.log("\n3. the owner issues maya a Finance grant — no restart, no cache clear\n");
  report(agents[0], await search(agents[0], "after"));

  console.log(
    [
      "",
      "Nothing above filtered rows after fetching them. Maya's first turn never",
      "asked about Finance, and the turn that named it anyway was refused before",
      "the provider ran. Her next turn widened because her authority did.",
      "",
    ].join("\n"),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
