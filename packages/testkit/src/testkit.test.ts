import { describe, expect, it } from "vitest";

import type { Capability, MessageEnvelope } from "@aicoo/sharedos-contracts";
import { CapabilityAuthorizer, SharedOSKernel } from "@aicoo/sharedos-core";

import {
  InMemoryDelegationChainResolver,
  InMemoryGrantSource,
  InMemoryMessageRequestRouter,
  InMemoryMessageTransport,
  InMemoryToolNamespaceSettingsStore,
  UnavailableDelegationChainResolver,
  UnavailableGrantUsageStore,
  createTestContext,
  createTestGrant,
  createTestKernel,
} from "./index.js";

describe("testkit", () => {
  it("creates isolated, deny-by-default contexts", async () => {
    const { kernel } = createTestKernel();
    const context = createTestContext();

    // Deny by default, and the denial says what would have satisfied it. A
    // fixture kernel is where a host first sees that field, so it is asserted
    // here rather than left to the core package's own tests.
    await expect(
      kernel.authorize(context, {
        resource: { namespace: "files", path: ["Workspace", "project-x"] },
        action: "search",
      }),
    ).resolves.toMatchObject({
      allowed: false,
      reasonCode: "no_matching_grant",
      requiredAuthority: {
        capabilities: [
          {
            resource: { namespace: "files", path: ["Workspace", "project-x"] },
            actions: ["search"],
            scope: "exact",
          },
        ],
      },
    });
  });

  it("builds grants bound to the same namespace as the context", async () => {
    const kernel = createTestKernel();
    const capability: Capability = {
      resource: { namespace: "files", path: ["Workspace", "project-x"] },
      actions: ["search"],
      scope: "descendants",
    };
    const grant = createTestGrant({ capabilities: [capability], purposes: ["test"] });
    const context = createTestContext();
    kernel.grants.add(grant);

    await expect(
      kernel.kernel.authorize(context, {
        resource: { namespace: "files", path: ["Workspace", "project-x", "status.md"] },
        action: "search",
      }),
    ).resolves.toEqual({ allowed: true, reasonCode: "allowed", matchedGrantId: "grant-1" });
  });

  it("stops a delegated grant at the kernel once its parent is revoked, and audits why", async () => {
    const manager = { kind: "agent", agentId: "agent-manager" } as const;
    const owner = { kind: "human", userId: "owner-1" } as const;
    const parent = createTestGrant({
      id: "grant-parent",
      subject: manager,
      issuer: owner,
      capabilities: [
        {
          resource: { namespace: "files", path: ["Workspace"] },
          actions: ["read"],
          scope: "descendants",
        },
      ],
      purposes: ["test"],
      delegationDepth: 1,
    });
    const child = createTestGrant({
      id: "grant-child",
      issuer: manager,
      parentGrantId: "grant-parent",
      capabilities: [
        {
          resource: { namespace: "files", path: ["Workspace", "notes.md"] },
          actions: ["read"],
          scope: "exact",
        },
      ],
      purposes: ["test"],
    });
    const resolver = new InMemoryDelegationChainResolver([parent]);
    const { kernel, audit } = createTestKernel({
      delegationResolver: resolver,
      grants: [child],
    });
    const context = createTestContext({ authority: manager });
    const request = {
      resource: { namespace: "files", path: ["Workspace", "notes.md"] },
      action: "read",
    };

    await expect(kernel.authorize(context, request)).resolves.toMatchObject({ allowed: true });

    resolver.revoke("namespace-1", "grant-parent", "2025-12-31T00:00:00.000Z");

    await expect(kernel.authorize(context, request)).resolves.toMatchObject({
      allowed: false,
      reasonCode: "delegation_chain_invalid",
    });
    expect(audit.events.at(-1)).toMatchObject({
      type: "authorization.checked",
      outcome: "denied",
      reason: "delegation_chain_invalid",
    });
  });

  it("denies a delegated grant when the ancestor store cannot be reached", async () => {
    const child = createTestGrant({
      parentGrantId: "grant-parent",
      capabilities: [
        {
          resource: { namespace: "files", path: ["Workspace", "notes.md"] },
          actions: ["read"],
          scope: "exact",
        },
      ],
      purposes: ["test"],
    });
    const { kernel } = createTestKernel({
      delegationResolver: new UnavailableDelegationChainResolver(),
      grants: [child],
    });

    await expect(
      kernel.authorize(createTestContext(), {
        resource: { namespace: "files", path: ["Workspace", "notes.md"] },
        action: "read",
      }),
    ).resolves.toMatchObject({ allowed: false, reasonCode: "delegation_chain_unverified" });
  });

  it("provides isolated in-memory namespace settings for host adapter tests", async () => {
    const store = new InMemoryToolNamespaceSettingsStore({
      "namespace-1": ["files"],
    });
    const context = createTestContext();

    await expect(
      store.applyUpdate(context, { enable: ["calendar"], disable: ["files"] }),
    ).resolves.toEqual(["calendar"]);
    expect(store.get("namespace-1")).toEqual(["calendar"]);
  });

  it("moves a grant's expiry in both grant stores, and refuses an id it does not hold", async () => {
    const notes: Capability = {
      resource: { namespace: "files", path: ["Workspace", "notes.md"] },
      actions: ["read"],
      scope: "exact",
    };
    const parent = createTestGrant({
      id: "grant-parent",
      subject: { kind: "human", userId: "owner-1" },
      capabilities: [notes],
      purposes: ["test"],
      delegationDepth: 1,
    });
    const child = createTestGrant({
      parentGrantId: parent.id,
      capabilities: [notes],
      purposes: ["test"],
    });
    const grants = new InMemoryGrantSource([child]);
    const chain = new InMemoryDelegationChainResolver([parent, child]);
    const { kernel } = createTestKernel({ grantSource: grants, delegationResolver: chain });
    const request = { resource: notes.resource, action: "read" };

    await expect(kernel.authorize(createTestContext(), request)).resolves.toMatchObject({
      allowed: true,
    });

    // The window closes on the ancestor alone, which is the edit a delegated
    // grant cannot see for itself and the resolver exists to show it.
    chain.expire(parent.namespaceId, parent.id, "2026-01-01T00:00:00.001Z");
    await expect(kernel.authorize(createTestContext(), request)).resolves.toMatchObject({
      allowed: false,
    });

    grants.expire(child.id, "2026-01-01T00:00:00.001Z");
    await expect(grants.load(createTestContext())).resolves.toMatchObject([
      { constraints: { expiresAt: "2026-01-01T00:00:00.001Z" } },
    ]);

    expect(() => grants.expire("grant-unknown", "2026-01-01T00:00:00.001Z")).toThrow(
      "grant is not registered",
    );
    expect(() => chain.expire(parent.namespaceId, "grant-unknown", "x")).toThrow(
      "grant is not registered",
    );
  });

  it("fails a bounded decision closed when the usage store cannot answer", async () => {
    const bounded = createTestGrant({
      capabilities: [
        {
          resource: { namespace: "files", path: ["Workspace", "notes.md"] },
          actions: ["read"],
          scope: "exact",
        },
      ],
      purposes: ["test"],
      maxUses: 1,
    });
    const kernel = new SharedOSKernel({
      grantSource: new InMemoryGrantSource([bounded]),
      authorizer: new CapabilityAuthorizer({ usageStore: new UnavailableGrantUsageStore() }),
    });

    const decision = await kernel.authorize(createTestContext(), {
      resource: { namespace: "files", path: ["Workspace", "notes.md"] },
      action: "read",
    });
    expect(decision.allowed).toBe(false);
  });

  it("answers a request the transport accepted, and no other", async () => {
    const transport = new InMemoryMessageTransport();
    const router = new InMemoryMessageRequestRouter(transport);
    const context = createTestContext();
    const request: MessageEnvelope = {
      version: "1",
      id: "message-1",
      sender: { kind: "agent", agentId: "agent-1" },
      receiver: { kind: "agent", agentId: "agent-2" },
      purpose: "test",
      payload: { question: "status" },
      traceId: context.traceId,
      createdAt: context.now,
    };
    const delivery = await transport.deliver(context, request);
    await expect(router.resolveReply(context, request, delivery)).resolves.toEqual({
      version: "1",
      id: "message-1-reply",
      sender: request.receiver,
      receiver: request.sender,
      purpose: "test",
      payload: { messageId: "message-1" },
      traceId: context.traceId,
      createdAt: context.now,
      replyTo: "message-1",
    });

    await expect(
      router.resolveReply(context, { ...request, id: "message-2" }, delivery),
    ).rejects.toThrow("absent from the accepted message log");
  });
});
