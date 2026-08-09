import { describe, expect, it } from "vitest";

import { AccessContextSchema, CapabilityAuthorizer, SharedOSClient } from "./index.js";

describe("@sharedos/sdk", () => {
  it("exposes contracts, the kernel, and the remote client from one entry point", () => {
    expect(AccessContextSchema).toBeDefined();
    expect(CapabilityAuthorizer).toBeTypeOf("function");
    expect(SharedOSClient).toBeTypeOf("function");
  });
});
