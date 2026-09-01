import { describe, expect, it } from "vitest";

import type {
  AccessContext,
  CapabilityGrant,
  ExecutionRequest,
  ToolCall,
  ToolResult,
} from "@aicoo/sharedos-contracts";
import { SharedOSKernel } from "@aicoo/sharedos-core";

import {
  ESCALATION_ACTION,
  ESCALATION_RESOURCE_PATH,
  ESCALATION_TOOL_DEFINITION,
  ESCALATION_TOOL_NAME,
  ESCALATION_TOOL_NAMESPACE,
  SharedOSExecutor,
  StandardRuntime,
  createEscalationTool,
  type AgentTurnDriver,
  type AgentTurnInput,
} from "./index.js";

const now = "2026-08-03T00:00:00.000Z";
const owner = { kind: "human", userId: "user-alice" } as const;
const agent = { kind: "agent", agentId: "agent-alice" } as const;

const context: AccessContext = {
  actor: agent,
  authority: owner,
  owner,
  namespaceId: "world-1",
  enabledToolNamespaces: [ESCALATION_TOOL_NAMESPACE],
  purpose: "prepare-report",
  traceId: "trace-1",
  now,
};

const escalationGrant: CapabilityGrant = {
  id: "grant-escalation",
  namespaceId: "world-1",
  subject: agent,
  issuer: owner,
  capabilities: [
    {
      resource: {
        namespace: ESCALATION_TOOL_NAMESPACE,
        path: [...ESCALATION_RESOURCE_PATH],
        owner,
      },
      actions: [ESCALATION_ACTION],
      scope: "exact",
    },
  ],
  constraints: {},
  issuedAt: "2026-08-02T00:00:00.000Z",
};

const executionGrant: CapabilityGrant = {
  id: "grant-turn",
  namespaceId: "world-1",
  subject: agent,
  issuer: owner,
  capabilities: [
    {
      resource: { namespace: "sharedos.execution", path: ["agent", "agent-alice"], owner },
      actions: ["invoke"],
      scope: "exact",
    },
  ],
  constraints: {},
  issuedAt: "2026-08-02T00:00:00.000Z",
};

const forwardedCall: ToolCall = {
  id: "call-1",
  tool: ESCALATION_TOOL_NAME,
  arguments: { reason: "issuing a grant is outside this agent's authority" },
  traceId: context.traceId,
  requestedAt: now,
};

function kernelWith(grants: readonly CapabilityGrant[]): SharedOSKernel {
  const kernel = new SharedOSKernel({ grantSource: { load: async () => grants } });
  kernel.registerTool(createEscalationTool());
  return kernel;
}

async function catalogue(grants: readonly CapabilityGrant[], access = context): Promise<string[]> {
  const tools = await kernelWith(grants).listTools(access);
  return tools.map(({ name }) => name);
}

describe("createEscalationTool", () => {
  it("registers the affordance's own definition and passes arguments through unparsed", () => {
    const tool = createEscalationTool();

    expect(tool.definition).toBe(ESCALATION_TOOL_DEFINITION);
    // A malformed forwarded call is still a forwarded call; parsing here would
    // report it as the wrong defect.
    expect(tool.parseArguments({ reason: 7 })).toEqual({ reason: 7 });
    expect(tool.resolveRequirement).toBeUndefined();
  });

  it("fails with escalation_not_terminated when it is invoked at all", async () => {
    const result = await createEscalationTool().invoke(
      context,
      forwardedCall,
      new AbortController().signal,
    );

    expect(result).toEqual({
      callId: "call-1",
      tool: ESCALATION_TOOL_NAME,
      status: "failed",
      error: { code: "escalation_not_terminated", message: expect.any(String) },
      completedAt: now,
    });
  });

  it("is catalogued only for an agent granted it, inside an enabled namespace", async () => {
    // The three gates, each on its own: the tool is registered in every case.
    await expect(catalogue([escalationGrant])).resolves.toEqual([ESCALATION_TOOL_NAME]);
    await expect(catalogue([])).resolves.toEqual([]);
    await expect(
      catalogue([escalationGrant], { ...context, enabledToolNamespaces: [] }),
    ).resolves.toEqual([]);
  });

  it("fails loudly, without ending the turn, when a driver forwards the call", async () => {
    // The affordance ends a turn only when the driver ends it; a driver that
    // forwards the call instead reaches the handler, and the record must then
    // show a failed call inside an ordinary turn -- not an escalation.
    let forwarded: ToolResult | undefined;
    const driver: AgentTurnDriver = {
      open: async () => ({
        next: async (input: AgentTurnInput) => {
          if (input.type === "start") {
            return { type: "tool_call", call: forwardedCall };
          }
          forwarded = input.result;
          return { type: "complete", output: { done: true } };
        },
      }),
    };
    let sequence = 0;
    const turns = new SharedOSExecutor(
      kernelWith([escalationGrant, executionGrant]),
      new StandardRuntime(driver),
      { clock: () => now, createId: () => `event-${(sequence += 1)}` },
    );
    const request: ExecutionRequest = {
      version: "1",
      executionId: "execution-1",
      agent,
      context,
      message: {
        version: "1",
        id: "message-1",
        sender: owner,
        receiver: agent,
        purpose: context.purpose,
        payload: { topic: "status" },
        traceId: context.traceId,
        createdAt: now,
      },
      tools: [ESCALATION_TOOL_DEFINITION],
    };

    const result = await turns.execute(request);

    expect(result.status).toBe("succeeded");
    expect(forwarded).toMatchObject({
      status: "failed",
      error: { code: "escalation_not_terminated" },
    });
    expect(result.events.map(({ type }) => type)).not.toContain("turn.escalated");
  });
});
