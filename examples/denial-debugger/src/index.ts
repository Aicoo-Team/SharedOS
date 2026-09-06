/**
 * The "why was I denied" debugger.
 *
 * Four failures that look identical — all return `tool_unavailable` or a
 * denial — four completely different diagnoses, each pointing at a next
 * step you can actually take.
 *
 * Show it to anyone who has written permission code and watch them want it.
 *
 * Run: pnpm example:denial-debugger
 */
import type { AccessContext, CapabilityGrant, ToolCall } from "@aicoo/sharedos";
import { CapabilityAuthorizer, SharedOSKernel, diagnoseDenial, type DenialDiagnosis } from "@aicoo/sharedos";
import type { AuditSink, AuditEvent, ResourceProvider } from "@aicoo/sharedos";
import {
  InMemoryGrantSource,
  InMemoryToolNamespaceSettingsStore,
} from "@aicoo/sharedos-testkit";

// ============================================================
// Actors
// ============================================================

const OWNER = { kind: "human", userId: "owner" } as const;
const AGENT = { kind: "agent", agentId: "agent-1" } as const;

// ============================================================
// Audit collector
// ============================================================

class CollectorAuditSink implements AuditSink {
  readonly events: AuditEvent[] = [];
  async record(event: AuditEvent): Promise<void> {
    this.events.push(event);
  }
}

// ============================================================
// Minimal resource provider (never actually invoked — denials happen before)
// ============================================================

const noopProvider: ResourceProvider = {
  namespace: "files",
  async invoke(operation) {
    return {
      operationId: operation.operationId,
      completedAt: new Date().toISOString(),
      status: "succeeded" as const,
      output: { ok: true },
    };
  },
};

// ============================================================
// Tool definition
// ============================================================

function filesSearchTool() {
  return {
    definition: {
      name: "files.search",
      namespace: "files",
      source: "sharedos",
      description: "Search files.",
      inputSchema: {
        type: "object" as const,
        additionalProperties: false as const,
        required: ["query"],
        properties: { query: { type: "string" } },
      },
      requiredCapability: {
        resource: { namespace: "files", path: [], owner: OWNER },
        action: "search",
      },
      readWrite: "read" as const,
    },
    parseArguments: (args: unknown) => args,
    resolveRequirement: (context: AccessContext) => ({
      resource: { namespace: "files", path: [], owner: context.owner },
      action: "search",
    }),
    invoke: async () => ({
      callId: "x",
      tool: "files.search",
      status: "succeeded" as const,
      output: { hits: [] },
      completedAt: new Date().toISOString(),
    }),
  };
}

// ============================================================
// Build a kernel that denies for a specific reason
// ============================================================

interface Scenario {
  label: string;
  description: string;
  build: () => { kernel: SharedOSKernel; audit: CollectorAuditSink };
}

function buildScenario1_notRegistered(): { kernel: SharedOSKernel; audit: CollectorAuditSink } {
  // Gate: Registration — tool is NOT registered
  const audit = new CollectorAuditSink();
  const kernel = new SharedOSKernel({
    grantSource: new InMemoryGrantSource([]),
    audit,
  });
  // Deliberately do NOT register any tool
  return { kernel, audit };
}

function buildScenario2_noGrant(): { kernel: SharedOSKernel; audit: CollectorAuditSink } {
  // Gate: Capability Grant — tool registered, but no grant covers it
  const audit = new CollectorAuditSink();
  const kernel = new SharedOSKernel({
    grantSource: new InMemoryGrantSource([]), // empty grants
    authorizer: new CapabilityAuthorizer(),
    toolNamespaceSettings: new InMemoryToolNamespaceSettingsStore({ acme: ["files"] }),
    audit,
  });
  kernel.registerResourceProvider(noopProvider);
  kernel.registerTool(filesSearchTool());
  return { kernel, audit };
}

function buildScenario3_hostCeiling(): { kernel: SharedOSKernel; audit: CollectorAuditSink } {
  // Gate: Product Ceiling — grant exists, but host ceiling blocks it
  const grant: CapabilityGrant = {
    id: "grant-search",
    namespaceId: "acme",
    subject: AGENT,
    issuer: OWNER,
    capabilities: [
      {
        resource: { namespace: "files", path: [], owner: OWNER },
        actions: ["search"],
        scope: "descendants",
      },
    ],
    constraints: { purposes: ["search"] },
    issuedAt: "2026-01-01T00:00:00.000Z",
  };

  const audit = new CollectorAuditSink();
  const kernel = new SharedOSKernel({
    grantSource: new InMemoryGrantSource([grant]),
    authorizer: new CapabilityAuthorizer({
      hostCeiling: {
        narrow() {
          // Block everything — the host said no
          return { allowed: false, reasonCode: "host_policy_denied" };
        },
      },
    }),
    toolNamespaceSettings: new InMemoryToolNamespaceSettingsStore({ acme: ["files"] }),
    audit,
  });
  kernel.registerResourceProvider(noopProvider);
  kernel.registerTool(filesSearchTool());
  return { kernel, audit };
}

function buildScenario4_usageStoreMissing(): { kernel: SharedOSKernel; audit: CollectorAuditSink } {
  // Gate: Infrastructure — grant has maxUses, but no usageStore wired
  const grant: CapabilityGrant = {
    id: "grant-once",
    namespaceId: "acme",
    subject: AGENT,
    issuer: OWNER,
    capabilities: [
      {
        resource: { namespace: "files", path: [], owner: OWNER },
        actions: ["search"],
        scope: "descendants",
      },
    ],
    constraints: { purposes: ["search"], maxUses: 1 },
    issuedAt: "2026-01-01T00:00:00.000Z",
  };

  const audit = new CollectorAuditSink();
  const kernel = new SharedOSKernel({
    grantSource: new InMemoryGrantSource([grant]),
    authorizer: new CapabilityAuthorizer(), // no usageStore!
    toolNamespaceSettings: new InMemoryToolNamespaceSettingsStore({ acme: ["files"] }),
    audit,
  });
  kernel.registerResourceProvider(noopProvider);
  kernel.registerTool(filesSearchTool());
  return { kernel, audit };
}

// ============================================================
// Scenarios
// ============================================================

const SCENARIOS: Scenario[] = [
  {
    label: "1. Tool not registered",
    description: "The kernel has no idea this tool exists.",
    build: buildScenario1_notRegistered,
  },
  {
    label: "2. No grant covers it",
    description: "The tool exists, but nobody gave you permission.",
    build: buildScenario2_noGrant,
  },
  {
    label: "3. Host ceiling blocked it",
    description: "A grant existed, but product policy overrode it.",
    build: buildScenario3_hostCeiling,
  },
  {
    label: "4. Missing wiring (usageStore)",
    description: "The grant needs maxUses but the store isn't there.",
    build: buildScenario4_usageStoreMissing,
  },
];

// ============================================================
// Run
// ============================================================

function makeContext(): AccessContext {
  return {
    namespaceId: "acme",
    actor: AGENT,
    authority: OWNER,
    owner: OWNER,
    purpose: "search",
    traceId: crypto.randomUUID(),
    enabledToolNamespaces: ["files"],
    now: "2026-01-01T00:00:00.000Z",
  };
}

function makeCall(context: AccessContext): ToolCall {
  return {
    id: crypto.randomUUID(),
    tool: "files.search",
    arguments: { query: "hello" },
    traceId: context.traceId,
    requestedAt: context.now,
  };
}

function formatDiagnosis(d: DenialDiagnosis): string {
  const lines = [
    `  Gate:      ${gateIcon(d.gate)} ${d.gate}`,
    `  Code:      ${d.code}`,
    `  Message:   ${d.message}`,
    `  Next step: ${d.nextStep}`,
  ];
  if (d.metadata?.summary !== undefined) {
    lines.push(`  Detail:    ${String(d.metadata.summary)}`);
  }
  if (d.metadata?.missingDependency !== undefined) {
    lines.push(`  Wiring:    missing ${String(d.metadata.missingDependency)}`);
  }
  return lines.join("\n");
}

function gateIcon(gate: string): string {
  switch (gate) {
    case "registration":
      return "📋";
    case "capability_grant":
      return "🔑";
    case "product_ceiling":
      return "🏗️";
    case "infrastructure":
      return "⚙️";
    default:
      return "❓";
  }
}

async function main(): Promise<void> {
  console.log("\nSharedOS — the 'why was I denied' debugger\n");
  console.log("Four failures. All look the same. None have the same cause.\n");

  for (const scenario of SCENARIOS) {
    console.log(`── ${scenario.label} ──`);
    console.log(`  ${scenario.description}\n`);

    const { kernel, audit } = scenario.build();
    const context = makeContext();
    const call = makeCall(context);

    const result = await kernel.invokeTool(context, call);
    const diagnosis = diagnoseDenial(result, audit.events);

    console.log(
      `  Result:    ${result.status} (${result.status === "denied" ? result.error.code : "ok"})`,
    );
    console.log(formatDiagnosis(diagnosis));
    console.log("");
  }

  console.log("── Summary ──\n");
  console.log("  Every denial is a code. Every code maps to a gate.");
  console.log("  diagnoseDenial() reads the audit trail and tells you which one.\n");
  console.log("  Gate 1: Registration  — Is the tool registered and its namespace enabled?");
  console.log("  Gate 2: Capability    — Does a grant cover this actor, resource, action?");
  console.log("  Gate 3: Ceiling       — Does host policy override the grant?");
  console.log("  Gate 4: Infrastructure — Did a wiring dependency fail?\n");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
