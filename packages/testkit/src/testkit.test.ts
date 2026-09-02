import { describe, expect, it } from "vitest";

import type { Capability } from "@aicoo/sharedos-contracts";

import {
  InMemoryDelegationChainResolver,
  InMemoryToolNamespaceSettingsStore,
  UnavailableDelegationChainResolver,
  createTestContext,
  createTestGrant,
  createTestKernel,
} from "./index.js";

describe("testkit", () => {
  it("creates isolated, deny-by-default contexts", async () => {
    const { kernel } = createTestKernel();
    const context = createTestContext();

    await expect(
      kernel.authorize(context, {
        resource: { namespace: "files", path: ["Workspace", "project-x"] },
        action: "search",
      }),
    ).resolves.toMatchObject({ allowed: false, reasonCode: "no_matching_grant" });
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
});
