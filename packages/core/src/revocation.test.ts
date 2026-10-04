import { describe, expect, it, vi } from "vitest";
import type { AccessContext, AuditEvent, CapabilityGrant } from "@aicoo/sharedos-contracts";
import {
  CapabilityAuthorizer,
  type GrantRevocationSource,
  type GrantRevocationState,
  InMemoryGrantUsageStore,
} from "./authorization.js";
import { SharedOSKernel } from "./kernel.js";

const access: AccessContext = {
  namespaceId: "world",
  actor: { kind: "agent", agentId: "worker" },
  authority: { kind: "human", userId: "owner" },
  owner: { kind: "human", userId: "owner" },
  purpose: "work",
  traceId: "turn",
  enabledToolNamespaces: ["files"],
  now: "2026-08-03T09:00:00.000Z",
};
const request = { resource: { namespace: "files", path: ["report"] }, action: "read" };
const leaf: CapabilityGrant = {
  id: "leaf",
  namespaceId: access.namespaceId,
  subject: access.actor,
  issuer: access.authority,
  capabilities: [{ resource: request.resource, actions: ["read"], scope: "exact" }],
  constraints: {},
  issuedAt: "2026-08-03T08:00:00.000Z",
};

function fixture(
  options: {
    grants?: CapabilityGrant[];
    source?: GrantRevocationSource;
    authorizer?: CapabilityAuthorizer;
  } = {},
) {
  let state: GrantRevocationState = { revision: "0", revokedGrantIds: [] };
  let outage = false;
  const check = vi.fn(async () => {
    if (outage) throw new Error("offline");
    return state;
  });
  const load = vi.fn(async () => options.grants ?? [leaf]);
  const events: AuditEvent[] = [];
  const kernel = new SharedOSKernel({
    grantSource: { load },
    authorizer:
      options.authorizer ??
      new CapabilityAuthorizer({ revocationSource: options.source ?? { check } }),
    audit: {
      record: async (event) => {
        events.push(event);
      },
    },
  });
  return {
    kernel,
    load,
    check,
    events,
    revoke: (id = "leaf") => {
      state = { revision: "1", revokedGrantIds: [id] };
    },
    outage: () => {
      outage = true;
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("live revocation narrowing", () => {
  it("refuses mid-turn revocation with one load and one snapshot, linking both reads in audit", async () => {
    const f = fixture();
    const turn = await f.kernel.openTurnAuthority(access);
    expect(await f.kernel.authorize(access, request)).toMatchObject({ allowed: true });
    f.revoke();
    expect(await f.kernel.authorize(access, request)).toMatchObject({
      allowed: false,
      reasonCode: "no_matching_grant",
    });
    turn.close();
    expect(f.load).toHaveBeenCalledTimes(1);
    const decisions = f.events.filter((event) => event.type === "authorization.checked");
    expect(decisions[0]?.authorityHash).toBe(decisions[1]?.authorityHash);
    expect(decisions[0]?.metadata?.revocationChecks).toEqual([
      { status: "checked", revision: "0", grantIds: ["leaf"], revokedGrantIds: [] },
    ]);
    expect(decisions[1]?.metadata?.revocationChecks).toEqual([
      { status: "checked", revision: "1", grantIds: ["leaf"], revokedGrantIds: ["leaf"] },
    ]);
    expect(f.events.filter((event) => event.type === "authority.resolved")).toHaveLength(1);
  });

  it("fails closed on a mid-turn outage without consuming a bounded use or reaching policy", async () => {
    const usage = new InMemoryGrantUsageStore();
    const narrow = vi.fn((decision) => decision);
    let outage = false;
    const authorizer = new CapabilityAuthorizer({
      usageStore: usage,
      hostCeiling: { narrow },
      revocationSource: {
        check: async () => {
          if (outage) throw new Error("offline");
          return { revision: "0", revokedGrantIds: [] };
        },
      },
    });
    const f = fixture({ authorizer, grants: [{ ...leaf, constraints: { maxUses: 2 } }] });
    f.kernel.registerResourceProvider({
      namespace: "files",
      invoke: async (operation) => ({
        operationId: operation.operationId,
        status: "succeeded",
        output: null,
        completedAt: access.now,
      }),
    });
    const turn = await f.kernel.openTurnAuthority(access);
    expect(
      await f.kernel.invokeResource(access, { ...request, operationId: "bounded" }),
    ).toMatchObject({ status: "succeeded" });
    outage = true;
    expect(
      await f.kernel.invokeResource(access, { ...request, operationId: "bounded" }),
    ).toMatchObject({
      status: "denied",
      error: { code: "authority_unavailable" },
    });
    expect(await usage.getUsage("world", "leaf")).toBe(1);
    expect(narrow).toHaveBeenCalledTimes(1);
    expect(f.events.filter((event) => event.type === "authorization.checked")[1]).toMatchObject({
      failClosed: true,
      metadata: { revocationChecks: [{ status: "unavailable", grantIds: ["leaf"] }] },
    });
    turn.close();
  });

  it("checks all delegated ancestors together and refuses a revoked root", async () => {
    const root: CapabilityGrant = {
      ...leaf,
      id: "root",
      subject: access.authority,
      constraints: { delegationDepth: 1 },
    };
    let revoked = false;
    const f = fixture({
      grants: [{ ...leaf, parentGrantId: "root" }],
      authorizer: new CapabilityAuthorizer({
        delegationResolver: { resolve: async () => root },
        revocationSource: {
          check: async (_context, ids) => {
            expect(ids).toEqual(["leaf", "root"]);
            return { revision: "root-revoked", revokedGrantIds: revoked ? ["root"] : [] };
          },
        },
      }),
    });
    const turn = await f.kernel.openTurnAuthority(access);
    expect(await f.kernel.authorize(access, request)).toMatchObject({ allowed: true });
    revoked = true;
    expect(await f.kernel.authorize(access, request)).toMatchObject({ allowed: false });
    turn.close();
    expect(f.events.at(-1)?.metadata?.revocationChecks).toEqual([
      {
        status: "checked",
        grantIds: ["leaf", "root"],
        revision: "root-revoked",
        revokedGrantIds: ["root"],
      },
    ]);
  });

  it("allows a separate active matching grant after a candidate is revoked", async () => {
    const check = vi.fn(async (_context, ids: readonly string[]) => ({
      revision: "1",
      revokedGrantIds: ids.includes("leaf") ? ["leaf"] : [],
    }));
    const f = fixture({ grants: [leaf, { ...leaf, id: "other" }], source: { check } });
    expect(await f.kernel.authorize(access, request)).toMatchObject({
      allowed: true,
      matchedGrantId: "other",
    });
    expect(check).toHaveBeenCalledTimes(2);
  });

  it.each([
    null,
    {},
    { revision: "", revokedGrantIds: [] },
    { revision: "1", revokedGrantIds: ["foreign"] },
    { revision: "1", revokedGrantIds: null },
  ])("fails closed on malformed state %j", async (state) => {
    const f = fixture({ source: { check: async () => state as GrantRevocationState } });
    expect(await f.kernel.authorize(access, request)).toMatchObject({
      allowed: false,
      reasonCode: "authority_unavailable",
    });
  });

  it("narrows discovery, reach and invocation inside the same turn", async () => {
    const f = fixture();
    const invoke = vi.fn(async (_context, call) => ({
      callId: call.id,
      tool: call.tool,
      status: "succeeded" as const,
      output: null,
      completedAt: access.now,
    }));
    f.kernel.registerTool({
      definition: {
        name: "files.read",
        description: "Read",
        namespace: "files",
        source: "sharedos",
        readWrite: "read",
        inputSchema: { type: "object" },
        requiredCapability: request,
        annotations: { readOnly: true },
      },
      parseArguments: (args) => args,
      invoke,
    });
    const turn = await f.kernel.openTurnAuthority(access);
    expect(await f.kernel.listTools(access)).toHaveLength(1);
    expect(await f.kernel.reach(access)).toMatchObject({
      status: "computed",
      reach: [expect.anything()],
    });
    const call = {
      id: "call",
      tool: "files.read",
      arguments: {},
      traceId: access.traceId,
      requestedAt: access.now,
    };
    expect(await f.kernel.invokeTool(access, call)).toMatchObject({ status: "succeeded" });
    f.revoke();
    expect(await f.kernel.listTools(access)).toEqual([]);
    expect(await f.kernel.reach(access)).toEqual({ status: "computed", reach: [] });
    expect(await f.kernel.invokeTool(access, { ...call, id: "revoked" })).toMatchObject({
      status: "denied",
    });
    expect(invoke).toHaveBeenCalledTimes(1);
    f.outage();
    expect(await f.kernel.reach(access)).toEqual({
      status: "unavailable",
      reasonCode: "authority_unavailable",
    });
    expect(await f.kernel.listTools(access)).toEqual([]);
    expect(f.events.filter((event) => event.type === "tool.catalog.listed").at(-1)).toMatchObject({
      failClosed: true,
    });
    turn.close();
  });

  it("cannot revive expiry or an admission-time window, and passes the live instant to the port", async () => {
    const check = vi.fn(async (context: AccessContext) => {
      expect(context.now).toBe("2026-08-03T09:30:00.000Z");
      return { revision: "0", revokedGrantIds: [] };
    });
    const f = fixture({
      grants: [
        { ...leaf, constraints: { expiresAt: "2026-08-03T09:15:00.000Z" } },
        { ...leaf, id: "future", constraints: { notBefore: "2026-08-03T09:15:00.000Z" } },
        { ...leaf, id: "active" },
      ],
      source: { check },
    });
    const turn = await f.kernel.openTurnAuthority(access);
    expect(
      await f.kernel.authorize({ ...access, now: "2026-08-03T09:30:00.000Z" }, request),
    ).toMatchObject({ allowed: true, matchedGrantId: "active" });
    expect(check).toHaveBeenCalledTimes(1);
    turn.close();
  });

  it("also checks direct kernel operations outside a turn", async () => {
    const f = fixture();
    expect(await f.kernel.authorize(access, request)).toMatchObject({ allowed: true });
    f.revoke();
    expect(await f.kernel.authorize(access, request)).toMatchObject({ allowed: false });
    expect(f.load).toHaveBeenCalledTimes(2);
    expect(f.check).toHaveBeenCalledTimes(2);
  });

  it("an active revocation verdict cannot bypass host policy", async () => {
    const check = vi.fn(async () => ({ revision: "0", revokedGrantIds: [] }));
    const f = fixture({
      authorizer: new CapabilityAuthorizer({
        revocationSource: { check },
        hostCeiling: { narrow: () => ({ allowed: false, reasonCode: "host_policy_denied" }) },
      }),
    });
    expect(await f.kernel.authorize(access, request)).toMatchObject({
      allowed: false,
      reasonCode: "host_policy_denied",
    });
    expect(check).toHaveBeenCalledTimes(1);
  });

  it("preserves the legacy live verifier and its generic rejection", async () => {
    let active = true;
    const verify = vi.fn(async () => active);
    const f = fixture({ authorizer: new CapabilityAuthorizer({ grantVerifier: { verify } }) });
    const turn = await f.kernel.openTurnAuthority(access);
    expect(await f.kernel.authorize(access, request)).toMatchObject({ allowed: true });
    active = false;
    expect(await f.kernel.authorize(access, request)).toMatchObject({ allowed: false });
    expect(f.load).toHaveBeenCalledTimes(1);
    expect(verify).toHaveBeenCalledTimes(2);
    turn.close();
  });

  it("does not undo an in-flight provider effect; a later concurrent operation is refused", async () => {
    const f = fixture();
    const entered = deferred<void>();
    const finish = deferred<void>();
    const invoke = vi.fn(async (operation) => {
      entered.resolve();
      await finish.promise;
      return {
        operationId: operation.operationId,
        status: "succeeded" as const,
        output: null,
        completedAt: access.now,
      };
    });
    f.kernel.registerResourceProvider({ namespace: "files", invoke });
    const turn = await f.kernel.openTurnAuthority(access);
    const first = f.kernel.invokeResource(access, { ...request, operationId: "first" });
    await entered.promise;
    f.revoke();
    expect(
      await f.kernel.invokeResource(access, { ...request, operationId: "second" }),
    ).toMatchObject({ status: "denied" });
    finish.resolve();
    expect(await first).toMatchObject({ status: "succeeded" });
    expect(invoke).toHaveBeenCalledTimes(1);
    turn.close();
  });

  it("independently reads concurrent calls; an earlier read may finish after revocation", async () => {
    const entered = deferred<void>();
    const finish = deferred<GrantRevocationState>();
    let checks = 0;
    const f = fixture({
      source: {
        check: async () => {
          if (++checks === 1) {
            entered.resolve();
            return finish.promise;
          }
          return { revision: "1", revokedGrantIds: ["leaf"] };
        },
      },
    });
    const turn = await f.kernel.openTurnAuthority(access);
    const first = f.kernel.authorize(access, request);
    await entered.promise;
    expect(await f.kernel.authorize(access, request)).toMatchObject({ allowed: false });
    finish.resolve({ revision: "0", revokedGrantIds: [] });
    expect(await first).toMatchObject({ allowed: true });
    turn.close();
  });
});
