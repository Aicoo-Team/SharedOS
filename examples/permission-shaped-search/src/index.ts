import type {
  AccessContext,
  Address,
  CapabilityGrant,
  ResourceOperation,
  ResourceResult,
  ToolResult,
} from "@aicoo/sharedos-contracts";
import { SharedOSKernel, type GrantSource, type ResourceProvider } from "@aicoo/sharedos-core";
import { registerStandardOsTools } from "@aicoo/sharedos-os";

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
  { id: "maya", name: "Maya", address: { kind: "agent", agentId: "maya-agent" } },
  { id: "kenji", name: "Kenji", address: { kind: "agent", agentId: "kenji-agent" } },
  { id: "noor", name: "Noor", address: { kind: "agent", agentId: "noor-agent" } },
] as const satisfies readonly { id: string; name: string; address: Address }[];

const documents: Record<string, { area: string; text: string }[]> = {
  "Team/Company": [{ area: "Company", text: "Partner messaging is still open." }],
  "Team/Product": [{ area: "Product", text: "Migration retries may add three days." }],
  "Team/Finance": [{ area: "Finance", text: "The vendor exception expires Friday." }],
};

function addressesEqual(left: Address, right: Address): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

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
    return this.#grants.filter(
      (candidate) =>
        candidate.namespaceId === context.namespaceId &&
        addressesEqual(candidate.subject, context.actor) &&
        addressesEqual(candidate.issuer, context.authority),
    );
  }
}

let providerInvocations = 0;
const files: ResourceProvider = {
  namespace: "files",
  async invoke(operation: ResourceOperation): Promise<ResourceResult> {
    providerInvocations += 1;
    const key = operation.resource.path.join("/");
    return {
      operationId: operation.operationId,
      status: "succeeded",
      output: { hits: documents[key] ?? [] },
      completedAt: operation.context.now,
    };
  },
};

const source = new MutableGrantSource([
  grant("grant-maya-company", agents[0].address, ROOTS.company),
  grant("grant-kenji-company", agents[1].address, ROOTS.company),
  grant("grant-kenji-product", agents[1].address, ROOTS.product),
  grant("grant-noor-company", agents[2].address, ROOTS.company),
  grant("grant-noor-product", agents[2].address, ROOTS.product),
  grant("grant-noor-finance", agents[2].address, ROOTS.finance),
]);
const kernel = new SharedOSKernel({ grantSource: source });
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

async function search(agent: (typeof agents)[number], turn: string) {
  const access = context(agent, turn);
  const reach = await kernel.reach(access);
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
}

for (const agent of agents) {
  const answer = await search(agent, "before");
  console.log(
    "BEFORE",
    agent.name.padEnd(6),
    `${answer.hits.length} ${answer.hits.length === 1 ? "row " : "rows"}`,
    answer.roots.map(({ path }) => path.at(-1)).join(" + "),
  );
}

const beforeProbeCount = providerInvocations;
const probe: ToolResult = await kernel.invokeTool(context(agents[0], "probe"), {
  id: "probe-maya-finance",
  tool: "files.search",
  arguments: { path: [...ROOTS.finance], query: "What could delay the Meridian launch?" },
  traceId: "probe-maya",
  requestedAt: NOW,
});
console.log(
  "DENY  ",
  "Maya → Finance",
  probe.status === "succeeded" ? "unexpectedly_allowed" : probe.error.code,
);
if (providerInvocations !== beforeProbeCount) throw new Error("denied call reached the provider");

source.issue(grant("grant-maya-finance", agents[0].address, ROOTS.finance));
const widened = await search(agents[0], "after");
console.log(
  "AFTER ",
  agents[0].name.padEnd(6),
  `${widened.hits.length} rows`,
  widened.roots.map(({ path }) => path.at(-1)).join(" + "),
);
