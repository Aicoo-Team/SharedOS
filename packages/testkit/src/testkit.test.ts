import { describe, expect, it } from "vitest";

import type { Capability } from "@sharedos/contracts";

import {
  InMemoryToolNamespaceSettingsStore,
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
    ).resolves.toEqual({ allowed: false, reasonCode: "no_matching_grant" });
  });

  it("builds grants bound to the same namespace as the context", async () => {
    const { kernel } = createTestKernel();
    const capability: Capability = {
      resource: { namespace: "files", path: ["Workspace", "project-x"] },
      actions: ["search"],
      scope: "descendants",
    };
    const grant = createTestGrant({ capabilities: [capability], purposes: ["test"] });
    const context = createTestContext({ grants: [grant] });

    await expect(
      kernel.authorize(context, {
        resource: { namespace: "files", path: ["Workspace", "project-x", "status.md"] },
        action: "search",
      }),
    ).resolves.toEqual({ allowed: true, reasonCode: "allowed", matchedGrantId: "grant-1" });
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
