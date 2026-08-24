/**
 * A complete host: real storage, real durable stores, real agent turn.
 *
 * `examples/quickstart` shows the smallest call sequence and
 * `examples/fleet-delegation` shows the delegation rules on their own. This
 * example is the part SharedOS deliberately does not ship — the provider ports
 * a product has to implement before any of it is usable:
 *
 *   - `FilesystemResourceProvider`  all twelve `files` actions over one root,
 *                                   with the path safety a grant depends on
 *   - `SqliteHostStores`            durable bounded-use accounting, grant
 *                                   storage and revocation, namespace
 *                                   settings, and an audit trail
 *   - `AnthropicTurnDriver`         the model side of `AgentTurnDriver`
 *
 * The scenario: Alice owns a private file tree. Bob's assistant is allowed to
 * search and read exactly one project subtree, for one purpose, for one hour,
 * three times. Bob can pass a strictly narrower slice to a summariser, and
 * Alice revoking her grant kills the derived one at use time.
 *
 * Run: pnpm example:reference-host
 * Set ANTHROPIC_API_KEY to drive the same turn with a live model.
 */
import { randomUUID } from "node:crypto";
import { mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type {
  AccessContext,
  Address,
  CapabilityGrant,
  ExecutionRequest,
} from "@aicoo/sharedos-contracts";
import {
  CapabilityAuthorizer,
  SharedOSKernel,
  agentExecutionCapability,
  deriveGrant,
} from "@aicoo/sharedos-core";
import { registerStandardOsTools } from "@aicoo/sharedos-os";
import { SharedOSExecutor, StandardRuntime } from "@aicoo/sharedos-runtime";

import { AnthropicTurnDriver, ScriptedTurnDriver } from "./driver.js";
import { FilesystemResourceProvider } from "./filesystem-provider.js";
import { SqliteHostStores } from "./sqlite-stores.js";

const WORLD = "reference-host";
const ALICE = { kind: "human", userId: "alice" } as const;
const ALICE_AGENT = { kind: "agent", agentId: "alice-assistant" } as const;
const BOB_AGENT = { kind: "agent", agentId: "bob-assistant" } as const;
const SUMMARISER = { kind: "agent", agentId: "summariser" } as const;

const SECRET = "SECRET-PAYROLL-TOKEN";
const ATLAS = ["Work", "Projects", "atlas"];
const STATUS = [...ATLAS, "status.md"];
const PAYROLL = ["Work", "Finance", "payroll.md"];

const dataDirectory = join(tmpdir(), "sharedos-reference-host");
const filesRoot = join(dataDirectory, "files");
const tenantRoot = join(filesRoot, WORLD, "human-alice");

/**
 * `authority` is whose grants are being exercised, which is not always the
 * owner of the data: down a delegation chain it is the delegator.
 */
function accessContext(input: {
  actor: Address;
  authority?: Address;
  purpose: string;
  grants: readonly CapabilityGrant[];
  namespaces: readonly string[];
}): AccessContext {
  return {
    namespaceId: WORLD,
    actor: input.actor,
    authority: input.authority ?? ALICE,
    owner: ALICE,
    purpose: input.purpose,
    traceId: randomUUID(),
    enabledToolNamespaces: [...input.namespaces],
    grants: [...input.grants],
    now: new Date().toISOString(),
  };
}

function grant(input: {
  id: string;
  subject: Address;
  path: string[];
  actions: string[];
  purpose: string;
  scope?: "exact" | "descendants";
  maxUses?: number;
  delegationDepth?: number;
}): CapabilityGrant {
  return {
    id: input.id,
    namespaceId: WORLD,
    subject: input.subject,
    issuer: ALICE,
    capabilities: [
      {
        resource: { namespace: "files", path: input.path, owner: ALICE },
        actions: input.actions,
        scope: input.scope ?? "descendants",
      },
    ],
    constraints: {
      purposes: [input.purpose],
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      ...(input.maxUses === undefined ? {} : { maxUses: input.maxUses }),
      ...(input.delegationDepth === undefined ? {} : { delegationDepth: input.delegationDepth }),
    },
    issuedAt: new Date().toISOString(),
  };
}

async function seed(): Promise<void> {
  await rm(dataDirectory, { recursive: true, force: true });
  const tree: Record<string, string> = {
    "Work/Projects/atlas/status.md":
      "# Atlas status\nShip date locked for 2026-09-30. Blocking item: SSO review.",
    "Work/Projects/atlas/roadmap.md": "# Atlas roadmap\nQ3 SSO, Q4 audit log export.",
    "Work/Finance/payroll.md": `# Payroll\n${SECRET}\nAlice base 210000 USD.`,
    "Personal/diary.md": "# Diary\nInterviewing at a competitor next Tuesday.",
  };
  for (const [path, content] of Object.entries(tree)) {
    const absolute = join(tenantRoot, path);
    await mkdir(join(absolute, ".."), { recursive: true });
    await writeFile(absolute, content, "utf8");
  }
  // A link that stays inside the tenant but leaves the granted subtree.
  await symlink(join(tenantRoot, ...PAYROLL), join(tenantRoot, ...ATLAS, "shortcut.md"));
}

async function main(): Promise<void> {
  await seed();
  const stores = new SqliteHostStores(join(dataDirectory, "host.db"));
  const files = new FilesystemResourceProvider({ root: filesRoot });

  const kernel = new SharedOSKernel({
    authorizer: new CapabilityAuthorizer({
      usageStore: stores,
      grantVerifier: stores,
      // Without a chain resolver every derived grant fails closed.
      chainResolver: { get: (_namespaceId, grantId) => stores.resolveChain(WORLD, grantId) },
    }),
    audit: stores,
    toolNamespaceSettings: stores,
  });
  kernel.registerResourceProvider(files);
  registerStandardOsTools(kernel, { files });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  console.log(`\nreference host — ${apiKey === undefined ? "scripted driver" : "live model"}\n`);

  // Namespaces are off until the owner turns them on. That is availability,
  // not authority: a grant is still required for every call.
  const catalog = await kernel.updateToolNamespaces(
    accessContext({ actor: ALICE, purpose: "configure-workspace", grants: [], namespaces: [] }),
    { enable: ["files"] },
    { signal: AbortSignal.timeout(5_000) },
  );
  const namespaces = catalog.namespaces
    .filter((entry) => entry.enabled)
    .map((entry) => entry.namespace);
  console.log(`1. alice enables namespaces: ${JSON.stringify(namespaces)}`);

  const atlasRead = grant({
    id: "grant-atlas-read",
    subject: BOB_AGENT,
    path: ATLAS,
    actions: ["search", "read", "list"],
    purpose: "atlas-status",
    maxUses: 3,
  });
  const invokeAlice: CapabilityGrant = {
    ...atlasRead,
    id: "grant-invoke-alice",
    capabilities: [agentExecutionCapability(ALICE_AGENT, ALICE)],
    constraints: { purposes: ["atlas-status"] },
  };
  stores.storeGrant(WORLD, atlasRead);
  stores.storeGrant(WORLD, invokeAlice);

  const runtime = new StandardRuntime(
    apiKey === undefined
      ? new ScriptedTurnDriver([
          { tool: "files.search", arguments: { path: ATLAS, query: "ship date" } },
          { tool: "files.read", arguments: { path: STATUS } },
          { tool: "files.read", arguments: { path: PAYROLL } },
          { tool: "files.read", arguments: { path: ["Personal", "diary.md"] } },
        ])
      : new AnthropicTurnDriver(apiKey),
  );
  const turns = new SharedOSExecutor(kernel, runtime, {
    defaultMaxSteps: 8,
    defaultMaxToolCalls: 8,
    defaultTimeoutMs: 60_000,
  });

  const bob = accessContext({
    actor: BOB_AGENT,
    purpose: "atlas-status",
    grants: [atlasRead, invokeAlice],
    namespaces,
  });
  const visible = await kernel.listTools(bob);
  console.log(`2. bob's agent can see: ${visible.map(({ name }) => name).join(", ")}`);

  const request: ExecutionRequest = {
    version: "1",
    executionId: randomUUID(),
    agent: ALICE_AGENT,
    context: bob,
    message: {
      version: "1",
      id: randomUUID(),
      sender: BOB_AGENT,
      receiver: ALICE_AGENT,
      intent: "answer-question",
      purpose: bob.purpose,
      payload: { text: "When does Atlas ship, and what is blocking it?" },
      traceId: bob.traceId,
      createdAt: new Date().toISOString(),
    },
    tools: [...visible],
  };

  const result = await turns.execute(request);
  console.log(`3. one bounded turn: ${result.status}`);
  console.log(`   ${JSON.stringify(result.status === "succeeded" ? result.output : result.error)}`);

  console.log("\n4. the provider is the last line of defence on paths:\n");
  const auditor = grant({
    id: "grant-atlas-unbounded",
    subject: BOB_AGENT,
    path: ATLAS,
    actions: ["read", "list"],
    purpose: "path-probe",
  });
  stores.storeGrant(WORLD, auditor);
  const probeContext = accessContext({
    actor: BOB_AGENT,
    purpose: "path-probe",
    grants: [auditor],
    namespaces,
  });
  await probe(kernel, probeContext, "traversal markers in the path", [
    ...ATLAS,
    "..",
    "..",
    "Finance",
  ]);
  await probe(kernel, probeContext, "a separator smuggled into a segment", [
    ...ATLAS,
    "../../Finance",
  ]);
  await probe(kernel, probeContext, "a link out of the granted subtree", [...ATLAS, "shortcut.md"]);
  await probe(kernel, probeContext, "an out-of-scope path (control)", PAYROLL);
  await probe(kernel, probeContext, "the granted path (must succeed)", STATUS);

  const delegable = grant({
    id: "grant-atlas-delegable",
    subject: BOB_AGENT,
    path: ATLAS,
    actions: ["search", "read"],
    purpose: "atlas-status",
    delegationDepth: 1,
  });
  stores.storeGrant(WORLD, delegable);

  const narrower = deriveGrant(delegable, {
    id: "grant-summariser",
    subject: SUMMARISER,
    capabilities: [
      {
        resource: { namespace: "files", path: STATUS, owner: ALICE },
        actions: ["read"],
        scope: "exact",
      },
    ],
    constraints: { purposes: ["atlas-status"] },
    issuedAt: new Date().toISOString(),
  });
  const wider = deriveGrant(delegable, {
    id: "grant-summariser-wide",
    subject: SUMMARISER,
    capabilities: [
      {
        resource: { namespace: "files", path: ["Work"], owner: ALICE },
        actions: ["read"],
        scope: "descendants",
      },
    ],
    constraints: { purposes: ["atlas-status"] },
    issuedAt: new Date().toISOString(),
  });

  console.log("\n5. bob passes part of it on:\n");
  console.log(`   narrower slice  ${narrower.ok ? "derived" : `refused (${narrower.reason})`}`);
  console.log(`   wider slice     ${wider.ok ? "derived (BUG)" : `refused (${wider.reason})`}`);

  if (!narrower.ok) return;
  stores.storeGrant(WORLD, narrower.grant);
  const summariser = accessContext({
    actor: SUMMARISER,
    authority: BOB_AGENT,
    purpose: "atlas-status",
    grants: [narrower.grant],
    namespaces,
  });
  const read = {
    operationId: randomUUID(),
    resource: { namespace: "files", path: STATUS, owner: ALICE },
    action: "read",
  };
  const before = await kernel.invokeResource(summariser, read, {
    signal: AbortSignal.timeout(5_000),
  });
  stores.revokeGrant(WORLD, delegable.id);
  const after = await kernel.invokeResource(
    summariser,
    { ...read, operationId: randomUUID() },
    { signal: AbortSignal.timeout(5_000) },
  );

  console.log(`   summariser reads          ${before.status}`);
  console.log("   alice revokes her grant   (the derived grant is not rewritten)");
  console.log(
    `   summariser reads again    ${after.status}${
      after.status === "succeeded" ? "" : ` (${after.error.code})`
    }`,
  );

  console.log("\n6. what the owner can reconstruct afterwards:\n");
  for (const row of stores.auditTrail()) {
    const reason = row.reason === null ? "" : `  <- ${row.reason}`;
    console.log(
      `   ${row.type.padEnd(24)} ${row.outcome.padEnd(10)} ${row.target ?? "-"}${reason}`,
    );
  }
}

async function probe(
  kernel: SharedOSKernel,
  context: AccessContext,
  label: string,
  path: string[],
): Promise<void> {
  const result = await kernel.invokeTool(context, {
    id: randomUUID(),
    tool: "files.read",
    arguments: { path },
    traceId: context.traceId,
    requestedAt: new Date().toISOString(),
  });
  const leaked = result.status === "succeeded" && JSON.stringify(result.output).includes(SECRET);
  const verdict =
    result.status === "succeeded"
      ? leaked
        ? "*** LEAKED ***"
        : "allowed"
      : `blocked (${result.error.code})`;
  console.log(`   ${label.padEnd(38)} ${verdict}`);
}

await main();
