import { describe, expect, it } from "vitest";

import type {
  AccessContext,
  CapabilityGrant,
  JsonObject,
  ResourceRef,
  ToolCall,
} from "@aicoo/sharedos-contracts";

import type { AuditEvent, AuditSink } from "./audit.js";
import type { GrantSource } from "./authority.js";
import { CapabilityAuthorizer, INFRASTRUCTURE_DENIAL_REASONS } from "./authorization.js";
import { SharedOSKernel } from "./kernel.js";
import { classifyRefusal, explainRefusal, type RefusalGate } from "./refusal.js";
import type { ToolHandler } from "./tool-registry.js";

const NOW = "2026-08-03T09:00:00.000Z";
const ACTOR = { kind: "agent", agentId: "agent-bob" } as const;
const OWNER = { kind: "human", userId: "user-alice" } as const;

function event(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    version: "1",
    id: "audit-1",
    type: "tool.invoked",
    outcome: "denied",
    at: NOW,
    traceId: "trace-1",
    namespaceId: "world-alpha",
    actor: ACTOR,
    authority: OWNER,
    owner: OWNER,
    purpose: "prepare-update",
    operationId: "call-1",
    tool: "files.search",
    reason: "tool_unavailable",
    metadata: { source: "kernel" },
    ...overrides,
  };
}

function denied(reason: string, metadata: JsonObject = {}): AuditEvent {
  return event({ reason, metadata: { source: "kernel", ...metadata } });
}

describe("classifyRefusal pins every code to one gate", () => {
  const byCode: ReadonlyArray<[string, RefusalGate]> = [
    ["no_matching_grant", "grant"],
    ["grant_exhausted", "grant"],
    ["delegation_chain_invalid", "grant"],
    ["host_policy_denied", "ceiling"],
    ["authority_unavailable", "infrastructure"],
    ["usage_store_unavailable", "infrastructure"],
    ["delegation_chain_unverified", "infrastructure"],
    ["host_policy_unavailable", "infrastructure"],
    ["invalid_context", "request"],
    ["invalid_request", "request"],
    ["trace_mismatch", "request"],
    ["actor_mismatch", "request"],
    ["receiver_mismatch", "request"],
    ["message_context_mismatch", "request"],
  ];

  it.each(byCode)("%s → %s", (code, gate) => {
    expect(classifyRefusal(denied(code))).toBe(gate);
  });

  it("covers every infrastructure reason the authorizer names", () => {
    for (const code of INFRASTRUCTURE_DENIAL_REASONS) {
      expect(classifyRefusal(denied(code))).toBe("infrastructure");
    }
  });

  it("honours failClosed on a code it would otherwise file elsewhere", () => {
    // The kernel marks an outage on the record as well as in the code. A
    // reader that trusted only one of them would disagree with the other.
    expect(classifyRefusal(denied("no_matching_grant", { failClosed: true }))).toBe(
      "infrastructure",
    );
  });

  it("names no gate for an allowed record or an unknown code", () => {
    expect(classifyRefusal(event({ outcome: "allowed", reason: "allowed" }))).toBeUndefined();
    expect(classifyRefusal(denied("host_invented_code"))).toBeUndefined();
  });
});

describe("classifyRefusal reads the cause behind tool_unavailable", () => {
  const byCause: ReadonlyArray<[string, RefusalGate]> = [
    ["not_registered", "registration"],
    ["namespace_disabled", "registration"],
    ["no_matching_grant", "grant"],
    ["host_policy_denied", "ceiling"],
    ["authority_unavailable", "infrastructure"],
    ["host_policy_unavailable", "infrastructure"],
  ];

  it.each(byCause)("cause %s → %s", (cause, gate) => {
    expect(classifyRefusal(denied("tool_unavailable", { cause }))).toBe(gate);
  });

  it("names no gate for a tool_unavailable that carries no cause", () => {
    expect(classifyRefusal(denied("tool_unavailable"))).toBeUndefined();
  });

  it("files every envelope refusal under the envelope, whatever the code", () => {
    for (const [reason, cause] of [
      ["tool_unavailable", "not_offered"],
      ["step_limit_exceeded", undefined],
      ["tool_call_limit_exceeded", undefined],
    ] as const) {
      const metadata: JsonObject = {
        source: "envelope",
        ...(cause === undefined ? {} : { cause }),
      };
      expect(classifyRefusal(event({ reason, metadata }))).toBe("envelope");
    }
  });

  it("does not read the envelope's authorship of a turn.ended as the envelope refusing", () => {
    // Every turn.ended is recorded by the envelope and says so in `source`.
    // A turn refused for want of an execution grant was refused by a decision.
    const ended = event({
      type: "turn.ended",
      operationId: "execution-1",
      reason: "no_matching_grant",
      metadata: { source: "envelope", endedBy: "envelope" },
    });
    expect(classifyRefusal(ended)).toBe("grant");
  });
});

describe("explainRefusal joins on the call id, never on recency", () => {
  it("explains the call that was asked about when another call's refusal is more recent", () => {
    const mine = event({
      id: "audit-1",
      operationId: "call-mine",
      reason: "tool_unavailable",
      metadata: { source: "kernel", cause: "not_registered" },
    });
    const mineDecision = event({
      id: "audit-2",
      type: "authorization.checked",
      operationId: "call-mine",
      reason: "no_matching_grant",
      metadata: { grantsResolved: 0 },
    });
    const theirs = event({
      id: "audit-3",
      operationId: "call-theirs",
      traceId: "trace-2",
      reason: "no_matching_grant",
      metadata: { source: "kernel", cause: "no_matching_grant" },
    });
    const theirsDecision = event({
      id: "audit-4",
      type: "authorization.checked",
      operationId: "call-theirs",
      traceId: "trace-2",
      reason: "no_matching_grant",
      metadata: { grantsResolved: 2 },
    });

    // The other turn's records are last on the sink. Recency says "grant".
    const explained = explainRefusal({ callId: "call-mine" }, [
      mine,
      mineDecision,
      theirsDecision,
      theirs,
    ]);

    expect(explained?.gate).toBe("registration");
    expect(explained?.refusal.id).toBe("audit-1");
    expect(explained?.decision?.id).toBe("audit-2");
  });

  it("returns undefined when no record carries the id, rather than the latest one", () => {
    expect(explainRefusal({ callId: "call-unseen" }, [event()])).toBeUndefined();
  });

  it("returns no prose", () => {
    const explained = explainRefusal({ callId: "call-1" }, [
      event({ metadata: { source: "kernel", cause: "not_registered" } }),
    ]);
    expect(Object.keys(explained ?? {}).sort()).toEqual([
      "cause",
      "code",
      "decision",
      "gate",
      "refusal",
      "source",
    ]);
  });
});

describe("the classifier reads the keys the kernel writes", () => {
  // The mapping tests above build records by hand. This one makes sure the
  // key names they assume -- `source`, `cause`, `operationId` -- are the ones
  // the kernel actually stamps, so a rename in the kernel fails here.
  const RESOURCE: ResourceRef = { namespace: "files", path: ["Workspace"] };
  const TOOL: ToolHandler = {
    definition: {
      name: "files.search",
      description: "Search files",
      namespace: "files",
      source: "sharedos",
      readWrite: "read",
      inputSchema: { type: "object" },
      requiredCapability: { resource: RESOURCE, action: "search" },
      annotations: { readOnly: true },
    },
    parseArguments: (arguments_) => arguments_,
    async invoke(_context, call) {
      return {
        callId: call.id,
        tool: call.tool,
        status: "succeeded",
        output: {},
        completedAt: NOW,
      };
    },
  };

  function accessContext(enabledToolNamespaces: readonly string[]): AccessContext {
    return {
      namespaceId: "world-alpha",
      enabledToolNamespaces: [...enabledToolNamespaces],
      actor: ACTOR,
      authority: OWNER,
      owner: OWNER,
      purpose: "prepare-update",
      traceId: "trace-1",
      now: NOW,
    };
  }

  function call(id: string, tool = TOOL.definition.name): ToolCall {
    return { id, tool, arguments: {}, traceId: "trace-1", requestedAt: NOW };
  }

  function harness(grants: readonly CapabilityGrant[] = []) {
    const events: AuditEvent[] = [];
    const audit: AuditSink = {
      async record(entry) {
        events.push(entry);
      },
    };
    const grantSource: GrantSource = { load: async () => grants };
    const kernel = new SharedOSKernel({
      audit,
      grantSource,
      authorizer: new CapabilityAuthorizer(),
    });
    kernel.registerTool(TOOL);
    return { kernel, events };
  }

  it("classifies the kernel's own records for all three tool_unavailable situations", async () => {
    const { kernel, events } = harness();

    const unregistered = await kernel.invokeTool(
      accessContext(["files"]),
      call("call-unregistered", "files.missing"),
    );
    const disabled = await kernel.invokeTool(accessContext([]), call("call-disabled"));
    const undiscoverable = await kernel.invokeTool(
      accessContext(["files"]),
      call("call-undiscoverable"),
    );

    for (const result of [unregistered, disabled, undiscoverable]) {
      expect(result.status).toBe("denied");
      expect(result.status === "denied" && result.error.code).toBe("tool_unavailable");
    }
    expect(explainRefusal(unregistered, events)?.gate).toBe("registration");
    expect(explainRefusal(disabled, events)?.gate).toBe("registration");
    const explained = explainRefusal(undiscoverable, events);
    expect(explained?.gate).toBe("grant");
    expect(explained?.decision?.type).toBe("authorization.checked");
    expect(explained?.decision?.reason).toBe("no_matching_grant");
  });
});
