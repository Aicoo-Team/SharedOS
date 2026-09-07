import {
  CapabilityAuthorizer,
  SharedOSExecutor,
  SharedOSKernel,
  StandardRuntime,
  agentExecutionCapability,
  registerStandardOsTools,
} from "@aicoo/sharedos";
import { ModelDriver, ModelRuntime, OpenAiCompatibleModelClient } from "@aicoo/sharedos-adapters";
import { randomUUID } from "node:crypto";

const owner = { kind: "human", userId: "keval" };
const meetingAgent = { kind: "agent", agentId: "meeting-assistant" };
const purpose = "prepare-meeting-summary";
const notePath = ["Meetings", "Leadership", "private-meeting.md"];

// This mutable array represents the host's trusted grant store. Removing a
// grant demonstrates revocation; requests and model messages cannot modify it.
const issuedGrants = [];
const auditEvents = [];
let organizationFreeze = false;

const audit = {
  async record(event) {
    auditEvents.push(event);
  },
};

// A tiny in-memory host provider. SharedOS owns authorization; the host owns data.
const files = {
  namespace: "files",
  async invoke(operation, signal) {
    signal.throwIfAborted();
    return {
      operationId: operation.operationId,
      completedAt: new Date().toISOString(),
      status: "succeeded",
      output: {
        path: notePath.join("/"),
        content: "Leadership sync: Atlas launch review at 4:30 PM.",
      },
    };
  },
};

const kernel = new SharedOSKernel({
  audit,
  authorizer: new CapabilityAuthorizer({
    hostCeiling: {
      narrow(decision) {
        return organizationFreeze
          ? {
              allowed: false,
              reasonCode: "host_policy_denied",
              metadata: { rule: "organization-meeting-freeze" },
            }
          : decision;
      },
    },
  }),
  grantSource: {
    async load(access) {
      return issuedGrants.filter(
        (grant) =>
          grant.namespaceId === access.namespaceId &&
          JSON.stringify(grant.subject) === JSON.stringify(access.actor) &&
          JSON.stringify(grant.issuer) === JSON.stringify(access.authority),
      );
    },
  },
});

kernel.registerResourceProvider(files);
registerStandardOsTools(kernel, { files });

function context(enabledToolNamespaces = ["files"]) {
  return {
    namespaceId: "aicoo-demo",
    actor: meetingAgent,
    authority: owner,
    owner,
    purpose,
    traceId: randomUUID(),
    enabledToolNamespaces,
    now: new Date().toISOString(),
  };
}

function toolCall(ctx, suffix) {
  return {
    id: `read-${suffix}-${randomUUID()}`,
    tool: "files.read",
    arguments: { path: notePath },
    traceId: ctx.traceId,
    requestedAt: ctx.now,
  };
}

function latestToolAudit() {
  return auditEvents.filter((event) => event.type === "tool.invoked").at(-1);
}

function explain(label, result) {
  const event = latestToolAudit();
  console.log(`\n${label}`);
  console.log("─".repeat(66));

  if (result.status === "succeeded") {
    console.log("✅ ALLOWED — meeting note returned by the host provider");
    console.log(`   ${result.output.content}`);
    return;
  }

  const cause = event?.metadata?.cause;
  const gate =
    cause === "not_registered"
      ? "REGISTRATION"
      : cause === "namespace_disabled"
        ? "NAMESPACE"
        : cause === "host_policy_denied"
          ? "PRODUCT CEILING"
          : "CAPABILITY GRANT";

  console.log("⛔ DENIED");
  console.log(`   Gate: ${gate}`);
  console.log(`   Wire reason: ${result.error.code}`);
  console.log(`   Audit cause: ${cause ?? event?.reason ?? "unknown"}`);
  const help = {
    REGISTRATION: ["The requested tool is not registered.", "Register the tool with the kernel."],
    NAMESPACE: [
      "The files namespace is switched off.",
      "Enable the files namespace for this context.",
    ],
    "PRODUCT CEILING": [
      "Organization policy overrode an otherwise valid grant.",
      "Review the host policy; issuing another grant will not help.",
    ],
    "CAPABILITY GRANT": [
      "This agent has no active read grant for the note.",
      "Issue a files/read capability for this path and purpose.",
    ],
  }[gate];
  console.log(`   Explanation: ${help[0]}`);
  console.log(`   Suggested fix: ${help[1]}`);
}

function makeFileGrant() {
  return {
    id: "grant-private-meeting-read",
    namespaceId: "aicoo-demo",
    subject: meetingAgent,
    issuer: owner,
    capabilities: [
      {
        resource: { namespace: "files", path: notePath, owner },
        actions: ["read"],
        scope: "exact",
      },
    ],
    constraints: { purposes: [purpose] },
    issuedAt: new Date().toISOString(),
  };
}

function makeExecutionGrant() {
  return {
    id: "grant-run-meeting-agent",
    namespaceId: "aicoo-demo",
    subject: meetingAgent,
    issuer: owner,
    capabilities: [agentExecutionCapability(meetingAgent, owner)],
    constraints: { purposes: [purpose] },
    issuedAt: new Date().toISOString(),
  };
}

console.log("\n🔐 SharedOS — Why Was I Denied?\n");
console.log("Resource: Meetings/Leadership/private-meeting.md");
console.log("Actor: meeting-assistant");

// Diagnose the four independent enforcement gates.
const registeredContext = context();
const unregistered = await kernel.invokeTool(registeredContext, {
  ...toolCall(registeredContext, "unregistered"),
  tool: "calendar.stealSecrets",
  arguments: {},
});
explain("1. Unknown tool request", unregistered);

const disabledContext = context([]);
const namespaceDisabled = await kernel.invokeTool(
  disabledContext,
  toolCall(disabledContext, "namespace-off"),
);
explain("2. Registered tool, but its namespace is disabled", namespaceDisabled);

const deniedContext = context();
const initiallyDenied = await kernel.invokeTool(
  deniedContext,
  toolCall(deniedContext, "before-grant"),
);
explain("3. Tool is registered and enabled, but the agent has no grant", initiallyDenied);

// The trusted host issues a narrowly scoped grant.
const fileGrant = makeFileGrant();
const executionGrant = makeExecutionGrant();
issuedGrants.push(fileGrant, executionGrant);
console.log("\n4. 👤 Human issues a narrow read grant for this note and purpose");

organizationFreeze = true;
const ceilingContext = context();
const ceilingDenied = await kernel.invokeTool(
  ceilingContext,
  toolCall(ceilingContext, "policy-freeze"),
);
explain("5. A valid grant exists, but organization policy freezes access", ceilingDenied);

organizationFreeze = false;
const allowedContext = context();
const allowed = await kernel.invokeTool(allowedContext, toolCall(allowedContext, "after-grant"));
explain("6. Policy freeze is lifted; agent retries", allowed);

// 3. Run one bounded agent turn for the required onboarding path.
const scriptedDriver = {
  async open() {
    let called = false;
    return {
      async next(input) {
        if (!called) {
          called = true;
          return {
            type: "tool_call",
            call: toolCall(turnContext, "inside-turn"),
          };
        }
        return { type: "complete", output: { observedToolResult: input.type } };
      },
    };
  },
};

const hasLiveModel = typeof process.env.API === "string" && process.env.API.trim() !== "";
const requestedModel = "deepseek-v4-flash";
const runtime = hasLiveModel
  ? new ModelRuntime(
      new ModelDriver({
        manifest: {
          id: "aicoo.deepseek-model",
          version: "1.0.0",
          protocolVersion: "1",
          metadata: { catalogueDelivery: "in-band", modelApi: true },
        },
        client: new OpenAiCompatibleModelClient({
          apiKey: process.env.API,
          model: requestedModel,
          provider: "deepseek",
          baseUrl: "https://api.deepseek.com",
          maxOutputTokens: 1024,
          temperature: 0,
          requestTimeoutMs: 30_000,
        }),
        prompt: () =>
          `You are testing your SharedOS authorization boundary. You MUST make both calls using files_read: first {"path":["Meetings","Leadership","private-meeting.md"]}, then {"path":["Finance","salaries.md"]}. Do not skip either call. After both tool results, state which read succeeded and which was denied. Never invent file contents.`,
      }),
    )
  : new StandardRuntime(scriptedDriver);

const turnContext = context();
const visibleTools = await kernel.listTools(turnContext);
console.log(
  `\n7. 🤖 Agent runtime: ${hasLiveModel ? `LIVE DeepSeek (${requestedModel})` : "deterministic fallback"}`,
);
const turnResult = await new SharedOSExecutor(kernel, runtime, {
  defaultMaxSteps: 6,
  defaultMaxToolCalls: 3,
  defaultTimeoutMs: 45_000,
}).execute({
  version: "1",
  executionId: randomUUID(),
  agent: meetingAgent,
  context: turnContext,
  message: {
    version: "1",
    id: randomUUID(),
    sender: owner,
    receiver: meetingAgent,
    purpose,
    payload: { text: "Read the private meeting note." },
    traceId: turnContext.traceId,
    createdAt: turnContext.now,
  },
  tools: [...visibleTools],
});
console.log(`   Required SharedOS agent turn: ${turnResult.status}`);
console.log(
  `   Permission-filtered catalog contains: ${visibleTools.map((tool) => tool.name).join(", ")}`,
);
if (turnResult.status === "succeeded" && hasLiveModel) {
  console.log(`   Provider-confirmed model: ${turnResult.metadata?.model ?? requestedModel}`);
  console.log(
    `   DeepSeek answer: ${turnResult.output?.text ?? JSON.stringify(turnResult.output)}`,
  );
}

// 4. Live revocation: mutate only the trusted store, with no restart or cache clear.
const catalogBeforeRevocation = await kernel.listTools(context());
console.log(
  `\n8. Agent catalog before revocation: [${catalogBeforeRevocation.map((tool) => tool.name).join(", ")}]`,
);

const grantIndex = issuedGrants.findIndex((grant) => grant.id === fileGrant.id);
issuedGrants.splice(grantIndex, 1);
console.log("\n9. 🗑️  Human revokes the read grant LIVE (no restart, no cache clear)");

const catalogAfterRevocation = await kernel.listTools(context());
console.log(
  `   Agent catalog after revocation:  [${catalogAfterRevocation.map((tool) => tool.name).join(", ")}]`,
);

const revokedContext = context();
const afterRevocation = await kernel.invokeTool(
  revokedContext,
  toolCall(revokedContext, "after-revoke"),
);
explain("10. Agent retries after live revocation", afterRevocation);

console.log("\n📋 Audit timeline");
console.log("─".repeat(66));
for (const event of auditEvents.filter((item) =>
  ["authorization.checked", "tool.invoked", "turn.ended"].includes(item.type),
)) {
  const detail = event.metadata?.cause ?? event.reason ?? "—";
  console.log(`${event.type.padEnd(24)} ${event.outcome.padEnd(9)} ${String(detail)}`);
}

console.log(
  `\nDemo complete: 4 GATES → ${hasLiveModel ? "LIVE MODEL" : "SCRIPTED AGENT"} CONTAINED → REVOKED → CATALOG EMPTY → DENIED\n`,
);
