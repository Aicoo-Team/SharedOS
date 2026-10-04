import { describe, expect, it, vi } from "vitest";
import { AuthorizationDecisionSchema, PROTOCOL_VERSION } from "@aicoo/sharedos-contracts";
import type { AuditEvent, ReplayKey, ToolCall, ToolDefinition } from "@aicoo/sharedos-contracts";
import {
  AuditUnavailableError,
  CapabilityAuthorizer,
  SharedOSKernel,
  reconcileAuditOutbox,
  agentExecutionCapability,
  messageSendCapability,
  type ReplayClaim,
  type ReplayStore,
} from "@aicoo/sharedos-core";
import {
  InMemoryAuditSink,
  InMemoryGrantSource,
  createTestContext,
  createTestGrant,
} from "./index.js";
import { InMemoryReplayStore } from "./replay.js";

const context = createTestContext({ enabledToolNamespaces: ["payments"] });
const definition: ToolDefinition = {
  name: "payments.transfer",
  namespace: "payments",
  source: "sharedos",
  readWrite: "write",
  description: "Transfer",
  inputSchema: { type: "object" },
  requiredCapability: {
    resource: { namespace: "payments", path: [], owner: context.owner },
    action: "transfer",
  },
};
const bounded = createTestGrant({
  id: "transfer-once",
  maxUses: 1,
  capabilities: [
    {
      resource: definition.requiredCapability.resource,
      actions: ["transfer"],
      scope: "exact",
    },
  ],
});
const key = (id: string): ReplayKey => ({
  namespaceId: context.namespaceId,
  kind: "tool",
  scope: context.traceId,
  id,
});
const call = (id: string): ToolCall => ({
  id,
  tool: definition.name,
  arguments: {},
  traceId: context.traceId,
  requestedAt: context.now,
});
const success = (call: ToolCall) => ({
  callId: call.id,
  tool: call.tool,
  status: "succeeded" as const,
  output: { moved: true },
  completedAt: context.now,
});

function setup(
  store = new InMemoryReplayStore(),
  down: (event: AuditEvent) => boolean = () => false,
) {
  const audit = new InMemoryAuditSink();
  const provider = vi.fn(async (_context, input: ToolCall, _signal: AbortSignal) => success(input));
  const kernel = new SharedOSKernel({
    grantSource: new InMemoryGrantSource([bounded]),
    replayStore: store,
    audit: {
      record: async (event) => {
        if (down(event)) throw new Error("audit offline");
        await audit.record(event);
      },
    },
  });
  kernel.registerTool({ definition, parseArguments: (input) => input, invoke: provider });
  return {
    kernel,
    provider,
    audit,
    store,
    usage: () => store.getUsage(context.namespaceId, bounded.id),
  };
}

async function claim(store: InMemoryReplayStore, id = "crashed"): Promise<ReplayClaim> {
  const { record } = await store.claim(key(id), "a".repeat(64));
  return { key: record.key, token: record.token, audit: [] };
}

describe("bounded effects recover on the replay record", () => {
  it("releases capacity on audit rejection and never re-enters on completed replay", async () => {
    const world = setup(
      undefined,
      (e) => e.type === "authorization.checked" && e.operationId === "blocked",
    );
    await expect(world.kernel.invokeTool(context, call("blocked"))).rejects.toBeInstanceOf(
      AuditUnavailableError,
    );
    expect(await world.usage()).toBe(0);
    expect(world.provider).not.toHaveBeenCalled();
    expect((await world.store.pendingAudit(100)).map((item) => item.event)).toContainEqual(
      expect.objectContaining({
        type: "grant.usage.released",
        usageState: "released",
        consumed: false,
      }),
    );
    const first = await world.kernel.invokeTool(context, call("fresh"));
    expect(first.status).toBe("succeeded");
    expect(await world.kernel.invokeTool(context, call("fresh"))).toEqual(first);
    expect(world.provider).toHaveBeenCalledOnce();
    expect(await world.usage()).toBe(1);
  });

  it("fails bounded grants closed with a legacy counter-only replay store", async () => {
    const backing = new InMemoryReplayStore();
    const legacy: ReplayStore = {
      claim: backing.claim.bind(backing),
      settle: backing.settle.bind(backing),
    };
    const provider = vi.fn();
    const kernel = new SharedOSKernel({
      grantSource: new InMemoryGrantSource([bounded]),
      replayStore: legacy,
      authorizer: new CapabilityAuthorizer({ usageStore: backing }),
      audit: "discard",
    });
    kernel.registerTool({ definition, parseArguments: (input) => input, invoke: provider });
    expect(await kernel.listTools(context)).toEqual([]);
    expect((await kernel.invokeTool(context, call("legacy"))).status).toBe("denied");
    expect(provider).not.toHaveBeenCalled();
    expect(await backing.getUsage(context.namespaceId, bounded.id)).toBe(0);
  });

  it("releases a reservation cancelled before admission", async () => {
    const controller = new AbortController();
    const world = setup(undefined, (event) => {
      if (event.type === "authorization.checked" && event.operationId === "cancel")
        controller.abort(new Error("stop"));
      return false;
    });
    await expect(
      world.kernel.invokeTool(context, call("cancel"), { signal: controller.signal }),
    ).rejects.toThrow("stop");
    expect(await world.usage()).toBe(0);
    expect(world.provider).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "never refunds a provider throw (effect happened: %s)",
    async (effectHappened) => {
      const world = setup();
      let effects = 0;
      world.provider.mockImplementation(async () => {
        if (effectHappened) effects++;
        throw new Error("connection lost");
      });
      const failed = await world.kernel.invokeTool(context, call("throw"));
      expect(failed).toMatchObject({ status: "failed", error: { code: "tool_execution_failed" } });
      expect(await world.kernel.invokeTool(context, call("throw"))).toEqual(failed);
      expect(world.provider).toHaveBeenCalledOnce();
      expect(effects).toBe(effectHappened ? 1 : 0);
      expect(await world.usage()).toBe(1);
      expect(
        await world.store.releaseUsage({
          ...(await world.store.claim(key("throw"), "b".repeat(64))).record,
          audit: [],
        }),
      ).toBe(false);
    },
  );

  it("retains usage on cancellation after a possible effect", async () => {
    const controller = new AbortController();
    const world = setup();
    world.provider.mockImplementation(async () => {
      controller.abort(new Error("after transfer"));
      throw controller.signal.reason;
    });
    await expect(
      world.kernel.invokeTool(context, call("cancel-after"), { signal: controller.signal }),
    ).rejects.toThrow("after transfer");
    expect(await world.usage()).toBe(1);
    expect(await world.kernel.invokeTool(context, call("cancel-after"))).toMatchObject({
      status: "failed",
      error: { code: "replay_interrupted" },
    });
    expect(world.provider).toHaveBeenCalledOnce();
  });

  it("recovers an ambiguously acknowledged reservation before dispatch", async () => {
    class LostReserveAck extends InMemoryReplayStore {
      override async reserveUsage(
        ownership: ReplayClaim,
        grantId: string,
        max: number,
      ): Promise<boolean> {
        await super.reserveUsage(ownership, grantId, max);
        throw new Error("lost reservation acknowledgement");
      }
    }
    const world = setup(new LostReserveAck());
    expect(await world.kernel.invokeTool(context, call("reserve"))).toMatchObject({
      status: "denied",
      error: { code: "usage_store_unavailable" },
    });
    expect(await world.usage()).toBe(0);
    expect(world.provider).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "retains capacity when admission acknowledgement is lost (committed: %s)",
    async (committed) => {
      class LostAdmissionAck extends InMemoryReplayStore {
        override async admitEffect(
          ownership: ReplayClaim,
          events: readonly AuditEvent[],
        ): Promise<boolean> {
          if (committed) await super.admitEffect(ownership, events);
          throw new Error("lost admission acknowledgement");
        }
      }
      const world = setup(new LostAdmissionAck());
      expect(await world.kernel.invokeTool(context, call("admit"))).toMatchObject({
        status: "failed",
        error: { code: "replay_unavailable" },
      });
      expect(await world.usage()).toBe(1);
      expect(world.provider).not.toHaveBeenCalled();
      const record = (await world.store.claim(key("admit"), "a".repeat(64))).record;
      expect(record.effect?.state).toBe(committed ? "admitted" : "reserved");
      expect(
        await world.store.releaseUsage({ key: record.key, token: record.token, audit: [] }),
      ).toBe(!committed);
      expect(await world.usage()).toBe(committed ? 1 : 0);
    },
  );

  it("holds capacity when release fails, and fences a stopped worker during recovery", async () => {
    class ReleaseOutage extends InMemoryReplayStore {
      offline = true;
      override async releaseUsage(ownership: ReplayClaim): Promise<boolean> {
        if (this.offline) throw new Error("release offline");
        return super.releaseUsage(ownership);
      }
    }
    const store = new ReleaseOutage();
    const world = setup(store, (e) => e.type === "authorization.checked");
    expect(await world.kernel.invokeTool(context, call("release"))).toMatchObject({
      status: "failed",
      error: { code: "replay_unavailable" },
    });
    expect(await world.usage()).toBe(1);
    expect(world.provider).not.toHaveBeenCalled();
    const record = (await store.claim(key("release"), "a".repeat(64))).record;
    store.offline = false;
    const ownership = { key: record.key, token: record.token, audit: [] };
    expect(await store.releaseUsage(ownership)).toBe(true);
    expect(await store.admitEffect(ownership, [])).toBe(false);
    expect(await world.usage()).toBe(0);
  });

  it("holds reservations across a simulated crash; admitted operations are never refunded", async () => {
    const store = new InMemoryReplayStore();
    const ownership = await claim(store);
    expect(await store.reserveUsage(ownership, bounded.id, 1)).toBe(true);
    const restarted = setup(store);
    expect((await restarted.kernel.invokeTool(context, call("other"))).status).toBe("denied");
    expect(restarted.provider).not.toHaveBeenCalled();
    expect(await store.releaseUsage(ownership)).toBe(true);
    expect(await store.admitEffect(ownership, [])).toBe(false);
    const admitted = await claim(store, "admitted-crash");
    expect(await store.reserveUsage(admitted, bounded.id, 1)).toBe(true);
    expect(await store.admitEffect(admitted, [])).toBe(true);
    expect(await store.releaseUsage(admitted)).toBe(false);
    expect(await restarted.usage()).toBe(1);
    expect((await store.claim(admitted.key, "a".repeat(64))).claimed).toBe(false);
  });

  it("persists a successful result and outcome outbox when outcome audit fails", async () => {
    const world = setup(undefined, (e) => e.type === "tool.invoked");
    const result = await world.kernel.invokeTool(context, call("outcome"));
    expect(result.status).toBe("succeeded");
    const pending = await world.store.pendingAudit(100);
    const outcome = pending.find((item) => item.event.type === "tool.invoked")!;
    expect(outcome.event).toMatchObject({
      outcome: "succeeded",
      usageState: "admitted",
      consumed: true,
    });
    expect(await reconcileAuditOutbox(world.store, world.audit)).toBe(pending.length);
    expect(world.audit.events.filter((e) => e.id === outcome.event.id)).toHaveLength(1);
    expect(await world.store.pendingAudit(100)).toEqual([]);
    expect(await world.kernel.invokeTool(context, call("outcome"))).toEqual(result);
    expect(world.provider).toHaveBeenCalledOnce();
    expect(await world.usage()).toBe(1);
  });

  it("retains a pending tombstone when result persistence fails after an effect", async () => {
    class ResultOutage extends InMemoryReplayStore {
      override async settle(..._arguments: Parameters<ReplayStore["settle"]>): Promise<boolean> {
        throw new Error("result offline");
      }
    }
    const world = setup(new ResultOutage());
    expect(await world.kernel.invokeTool(context, call("result"))).toMatchObject({
      status: "failed",
      error: { code: "replay_unavailable" },
    });
    expect(await world.kernel.invokeTool(context, call("result"))).toMatchObject({
      status: "failed",
      error: { code: "replay_pending" },
    });
    expect(world.provider).toHaveBeenCalledOnce();
    expect(await world.usage()).toBe(1);
    expect((await world.store.pendingAudit(100)).some((e) => e.event.outcome === "succeeded")).toBe(
      true,
    );
  });

  it("atomically limits racing distinct operations to one admission", async () => {
    const world = setup();
    const results = await Promise.all([
      world.kernel.invokeTool(context, call("a")),
      world.kernel.invokeTool(context, call("b")),
    ]);
    expect(results.filter((result) => result.status === "succeeded")).toHaveLength(1);
    expect(world.provider).toHaveBeenCalledOnce();
    expect(await world.usage()).toBe(1);
  });

  it("releases a direct resource reservation on audit failure and replays success without re-entry", async () => {
    const world = setup(
      undefined,
      (event) => event.type === "authorization.checked" && event.operationId === "resource-blocked",
    );
    const provider = vi.fn(async (operation) => ({
      operationId: operation.operationId,
      status: "succeeded" as const,
      output: { moved: true },
      completedAt: context.now,
    }));
    world.kernel.registerResourceProvider({ namespace: "payments", invoke: provider });
    const request = {
      operationId: "resource-blocked",
      resource: definition.requiredCapability.resource,
      action: "transfer",
    };
    await expect(world.kernel.invokeResource(context, request)).rejects.toBeInstanceOf(
      AuditUnavailableError,
    );
    expect(await world.usage()).toBe(0);
    expect(provider).not.toHaveBeenCalled();
    const fresh = { ...request, operationId: "resource-fresh" };
    const result = await world.kernel.invokeResource(context, fresh);
    expect(result.status).toBe("succeeded");
    expect(await world.kernel.invokeResource(context, fresh)).toEqual(result);
    expect(provider).toHaveBeenCalledOnce();
    expect(await world.usage()).toBe(1);
  });

  it("releases capacity when no resource provider exists", async () => {
    const world = setup();
    expect(
      await world.kernel.invokeResource(context, {
        operationId: "missing-provider",
        resource: definition.requiredCapability.resource,
        action: "transfer",
      }),
    ).toMatchObject({ status: "failed", error: { code: "resource_provider_not_found" } });
    expect(await world.usage()).toBe(0);
  });

  it("applies the same audit and reservation boundary to message delivery", async () => {
    const store = new InMemoryReplayStore();
    const receiver = { kind: "agent" as const, agentId: "recipient" };
    const grant = createTestGrant({
      maxUses: 1,
      capabilities: [messageSendCapability(receiver, context.owner)],
    });
    const deliver = vi.fn(async (_access, envelope) => ({
      messageId: envelope.id,
      status: "accepted" as const,
      timestamp: context.now,
    }));
    const kernel = new SharedOSKernel({
      grantSource: new InMemoryGrantSource([grant]),
      replayStore: store,
      messageTransport: { deliver },
      audit: {
        record: async (event) => {
          if (event.type === "authorization.checked" && event.operationId === "blocked")
            throw new Error("audit offline");
        },
      },
    });
    const message = {
      version: PROTOCOL_VERSION,
      id: "blocked",
      sender: context.actor,
      receiver,
      purpose: context.purpose,
      traceId: context.traceId,
      createdAt: context.now,
      payload: null,
    };
    await expect(kernel.sendMessage(context, message)).rejects.toBeInstanceOf(
      AuditUnavailableError,
    );
    expect(await store.getUsage(context.namespaceId, grant.id)).toBe(0);
    expect(deliver).not.toHaveBeenCalled();
    const fresh = { ...message, id: "fresh" };
    const result = await kernel.sendMessage(context, fresh);
    expect(result.status).toBe("accepted");
    expect(await kernel.sendMessage(context, fresh)).toEqual(result);
    expect(deliver).toHaveBeenCalledOnce();
    expect(await store.getUsage(context.namespaceId, grant.id)).toBe(1);
  });

  it("binds turn admission usage to the enclosing execution claim", async () => {
    const store = new InMemoryReplayStore();
    const grant = createTestGrant({
      maxUses: 1,
      capabilities: [agentExecutionCapability(context.actor, context.owner)],
    });
    const kernel = new SharedOSKernel({
      grantSource: new InMemoryGrantSource([grant]),
      replayStore: store,
      audit: {
        record: async (event) => {
          if (event.type === "authorization.checked" && event.operationId === "blocked")
            throw new Error("audit offline");
        },
      },
    });
    const admit = (id: string) =>
      kernel.replayProtection.run(
        { namespaceId: context.namespaceId, kind: "execution", scope: "", id },
        { context, agent: context.actor },
        (ownership) => kernel.admitTurn(context, context.actor, {}, ownership),
        (value) => AuthorizationDecisionSchema.parse(value),
      );
    await expect(admit("blocked")).rejects.toBeInstanceOf(AuditUnavailableError);
    expect(await store.getUsage(context.namespaceId, grant.id)).toBe(0);
    expect((await admit("fresh")).allowed).toBe(true);
    expect(await store.getUsage(context.namespaceId, grant.id)).toBe(1);
    expect((await admit("fresh")).allowed).toBe(true);
    expect(await store.getUsage(context.namespaceId, grant.id)).toBe(1);
  });

  it("retains usage for malformed provider results", async () => {
    const world = setup();
    world.provider.mockImplementation(async () => success(call("wrong-result-id")));
    expect(await world.kernel.invokeTool(context, call("malformed"))).toMatchObject({
      status: "failed",
      error: { code: "invalid_tool_result" },
    });
    expect(await world.usage()).toBe(1);
    expect(world.provider).toHaveBeenCalledOnce();
  });

  it("redelivers audit with the same ID if outbox acknowledgement fails", async () => {
    class AckOutage extends InMemoryReplayStore {
      offline = true;
      override async acknowledgeAudit(key: ReplayKey, eventId: string): Promise<void> {
        if (this.offline) throw new Error("ack offline");
        return super.acknowledgeAudit(key, eventId);
      }
    }
    const store = new AckOutage();
    const world = setup(store);
    await world.kernel.invokeTool(context, call("audit-ack"));
    const count = world.audit.events.length;
    await expect(reconcileAuditOutbox(store, world.audit)).rejects.toThrow("ack offline");
    expect((await store.pendingAudit(100)).length).toBeGreaterThan(0);
    store.offline = false;
    await reconcileAuditOutbox(store, world.audit);
    expect(world.audit.events).toHaveLength(count);
    expect(await store.pendingAudit(100)).toEqual([]);
    expect(await world.usage()).toBe(1);
  });
});
