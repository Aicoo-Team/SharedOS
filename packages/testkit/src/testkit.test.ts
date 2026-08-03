import { describe, expect, it } from "vitest";

import type { Capability } from "@sharedos/contracts";

import { createTestContext, createTestGrant, createTestKernel } from "./index.js";

describe("testkit", () => {
  it("creates isolated, deny-by-default contexts", async () => {
    const { kernel } = createTestKernel();
    const context = createTestContext();

    await expect(
      kernel.authorize(context, {
        resource: { namespace: "memory", path: ["project-x"] },
        action: "search",
      }),
    ).resolves.toEqual({ allowed: false, reasonCode: "no_matching_grant" });
  });

  it("builds grants bound to the same namespace as the context", async () => {
    const { kernel } = createTestKernel();
    const capability: Capability = {
      resource: { namespace: "memory", path: ["project-x"] },
      actions: ["search"],
      scope: "descendants",
    };
    const grant = createTestGrant({ capabilities: [capability], purposes: ["test"] });
    const context = createTestContext({ grants: [grant] });

    await expect(
      kernel.authorize(context, {
        resource: { namespace: "memory", path: ["project-x", "status"] },
        action: "search",
      }),
    ).resolves.toEqual({ allowed: true, reasonCode: "allowed", matchedGrantId: "grant-1" });
  });
});
