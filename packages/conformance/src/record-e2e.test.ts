import { describe, expect, it } from "vitest";

import type {
  AccessContext,
  CapabilityGrant,
  ExecutionRequest,
  ToolDefinition,
} from "@aicoo/sharedos-contracts";
import {
  type AuditEvent,
  type AuditSink,
  type GrantSource,
  SharedOSKernel,
  type ToolHandler,
} from "@aicoo/sharedos-core";
import { SharedOSExecutor, type RuntimePlugin } from "@aicoo/sharedos-runtime";

import { assembleExecutionRecord } from "./assemble.js";
import { checkRecordCompleteness, checkRecordRedaction } from "./completeness.js";
import type { ExperimentIdentity, SystemIdentity } from "./record.js";

const NOW = "2026-08-03T09:00:00.000Z";
const AGENT = { kind: "agent", agentId: "agent-alice" } as const;
const OWNER = { kind: "human", userId: "user-alice" } as const;
const HASH = "d".repeat(64);

const READ_TOOL: ToolDefinition = {
  name: "files.read",
  description: "Read one authorized file",
  namespace: "files",
  source: "sharedos",
  readWrite: "read",
  inputSchema: { type: "object" },
  requiredCapability: {
    resource: { namespace: "files", path: ["Workspace"] },
    action: "read",
  },
  annotations: { readOnly: true },
};

function grant(id: string, path: string[], actions: string[]): CapabilityGrant {
  return {
    id,
    namespaceId: "world-alpha",
    subject: AGENT,
    issuer: OWNER,
    capabilities: [
      {
        resource: {
          namespace: path[0] === "Workspace" ? "files" : "sharedos.execution",
          path,
          owner: OWNER,
        },
        actions,
        scope: "descendants",
      },
    ],
    constraints: { purposes: ["prepare-update"] },
    issuedAt: "2026-08-03T08:00:00.000Z",
  };
}

function context(): AccessContext {
  return {
    namespaceId: "world-alpha",
    enabledToolNamespaces: ["files"],
    actor: AGENT,
    authority: OWNER,
    owner: OWNER,
    purpose: "prepare-update",
    traceId: "trace-1",
    now: NOW,
  };
}

function request(): ExecutionRequest {
  return {
    version: "1",
    executionId: "execution-1",
    agent: AGENT,
    context: context(),
    message: {
      version: "1",
      id: "message-1",
      sender: AGENT,
      receiver: AGENT,
      intent: "prepare",
      purpose: "prepare-update",
      payload: { secret: "do-not-record-me" },
      traceId: "trace-1",
      createdAt: NOW,
    },
    tools: [READ_TOOL],
  };
}

const readHandler: ToolHandler = {
  definition: READ_TOOL,
  parseArguments: (arguments_) => arguments_,
  invoke: async (_access, call) => ({
    callId: call.id,
    tool: call.tool,
    status: "succeeded",
    output: { text: "confidential file body" },
    completedAt: NOW,
  }),
};

/** A runtime that always calls the one exposed tool, then finishes. */
const runtime: RuntimePlugin = {
  manifest: { id: "test.deterministic", version: "0.0.1", protocolVersion: "1" },
  async run(turn, host) {
    const result = await host.invokeTool({
      id: "call-1",
      tool: "files.read",
      arguments: { path: ["Workspace", "notes.md"] },
      traceId: turn.context.traceId,
      requestedAt: NOW,
    });
    return { type: "complete", output: { toolStatus: result.status } };
  },
};

const experiment: ExperimentIdentity = {
  experimentId: "pact-pair",
  taskId: "files-qa-017",
  runId: "run-1",
  specHash: HASH,
  worldHash: HASH,
  evaluatorHash: HASH,
};

const system: Omit<SystemIdentity, "runtime"> = {
  protocolVersion: "1",
  sharedOsVersion: "0.1.0-alpha.0",
  adapterId: "sharedos-embedded",
  policyHash: HASH,
};

async function runTurn(grants: readonly CapabilityGrant[]): Promise<{
  record: ReturnType<typeof assembleExecutionRecord>;
  audit: AuditEvent[];
}> {
  const audit: AuditEvent[] = [];
  const sink: AuditSink = { record: async (event) => void audit.push(event) };
  const source: GrantSource = {
    async load() {
      await Promise.resolve();
      return grants;
    },
  };
  const kernel = new SharedOSKernel({ grantSource: source, audit: sink });
  kernel.registerTool(readHandler);

  const result = await new SharedOSExecutor(kernel, runtime, {
    clock: () => NOW,
    createId: (() => {
      let sequence = 0;
      return () => `event-${(sequence += 1)}`;
    })(),
  }).execute(request());

  return {
    record: assembleExecutionRecord({
      request: request(),
      result,
      auditEvents: audit,
      experiment,
      system,
    }),
    audit,
  };
}

describe("execution records from a real turn", () => {
  const allowed = [
    grant("grant-turn", ["agent", "agent-alice"], ["invoke"]),
    grant("grant-files", ["Workspace"], ["read"]),
  ];

  it("produces a usable record for an allowed turn", async () => {
    const { record } = await runTurn(allowed);

    expect(record.execution.status).toBe("succeeded");
    expect(record.execution.exposedTools).toEqual(["files.read"]);
    expect(record.execution.operations).toContainEqual(
      expect.objectContaining({ kind: "tool", tool: "files.read", outcome: "succeeded" }),
    );
    expect(record.authority.snapshots).toHaveLength(1);
    expect(
      record.execution.decisions.every(({ authorityHash }) => authorityHash !== undefined),
    ).toBe(true);
    expect(checkRecordCompleteness(record).usable).toBe(true);
  });

  it("produces a usable record for a denied turn", async () => {
    const { record } = await runTurn([]);

    expect(record.execution.status).toBe("denied");
    expect(record.execution.terminalReasonCode).toBe("no_matching_grant");
    expect(record.execution.exposedTools).toEqual([]);
    expect(record.execution.decisions).toContainEqual(
      expect.objectContaining({ outcome: "denied", failClosed: false }),
    );
    expect(checkRecordCompleteness(record).usable).toBe(true);
  });

  it("records the tool denial when a turn is admitted but the call is not", async () => {
    const { record } = await runTurn([grant("grant-turn", ["agent", "agent-alice"], ["invoke"])]);

    expect(record.execution.status).toBe("succeeded");
    expect(record.execution.exposedTools).toEqual([]);
    expect(record.execution.operations).toContainEqual(
      expect.objectContaining({ kind: "tool", source: "envelope", outcome: "denied" }),
    );
    // The envelope refuses an unexposed tool before the kernel is consulted, so
    // this attempt appears in no audit event at all.
    expect(record.execution.operations.every(({ source }) => source === "envelope")).toBe(true);
    // And it still says which refusal it was. Without the code the record could
    // report that an envelope refusal happened but not whether it was a guess at
    // an unexposed tool or a blown budget, and the distinction would have to be
    // taken on trust from whatever the runtime said about itself.
    expect(record.execution.operations).toContainEqual(
      expect.objectContaining({ source: "envelope", reasonCode: "tool_unavailable" }),
    );
  });

  it("fails closed and marks it, when authority cannot be loaded", async () => {
    const audit: AuditEvent[] = [];
    const kernel = new SharedOSKernel({
      grantSource: {
        async load() {
          throw new Error("grant store is unreachable");
        },
      },
      audit: { record: async (event) => void audit.push(event) },
    });
    kernel.registerTool(readHandler);

    const result = await new SharedOSExecutor(kernel, runtime, { clock: () => NOW }).execute(
      request(),
    );
    const record = assembleExecutionRecord({
      request: request(),
      result,
      auditEvents: audit,
      experiment,
      system,
    });

    expect(record.execution.status).toBe("denied");
    expect(record.execution.terminalReasonCode).toBe("authority_unavailable");
    expect(record.execution.decisions.some(({ failClosed }) => failClosed)).toBe(true);
    // And the record it produced is still usable evidence. A fail-closed turn
    // has no authority state to name, so demanding one would make the turns
    // SharedOS handles most decisively the ones it cannot report on.
    expect(checkRecordCompleteness(record).usable).toBe(true);
  });

  it("emits a usable record for a turn that stopped to ask a human", async () => {
    const escalating: RuntimePlugin = {
      manifest: runtime.manifest,
      async run() {
        return { type: "escalate", reason: "issuing a grant is outside this agent's authority" };
      },
    };
    const audit: AuditEvent[] = [];
    const kernel = new SharedOSKernel({
      grantSource: {
        async load() {
          return allowed;
        },
      },
      audit: { record: async (event) => void audit.push(event) },
    });
    kernel.registerTool(readHandler);

    const result = await new SharedOSExecutor(kernel, escalating, { clock: () => NOW }).execute(
      request(),
    );
    const record = assembleExecutionRecord({
      request: request(),
      result,
      auditEvents: audit,
      experiment,
      system,
    });

    // An escalated turn is neither a success nor a denial, and the record keeps
    // it separable from both so a denial rate is not inflated by the turns
    // where the system correctly asked for help.
    expect(record.execution.status).toBe("escalated");
    expect(record.execution.terminalReasonCode).toBe("escalation_requested");
    expect(record.execution.escalation).toMatchObject({ status: "pending" });
    expect(checkRecordCompleteness(record).usable).toBe(true);
    expect(checkRecordRedaction(record).clean).toBe(true);
  });

  it("carries no message payload, tool arguments, or tool output", async () => {
    const { record } = await runTurn(allowed);
    const serialized = JSON.stringify(record);

    expect(checkRecordRedaction(record)).toEqual({ clean: true, violations: [] });
    expect(serialized).not.toContain("do-not-record-me");
    expect(serialized).not.toContain("confidential file body");
    expect(serialized).not.toContain("notes.md");
  });
});
