import { describe, expect, it, vi } from "vitest";
import type { AccessContext, MessageEnvelope } from "@aicoo/sharedos-contracts";
import { SharedOSKernel } from "./kernel.js";

const context: AccessContext = {
  namespaceId: "world-1",
  actor: { kind: "agent", agentId: "agent-1" },
  authority: { kind: "human", userId: "owner-1" },
  owner: { kind: "human", userId: "owner-1" },
  purpose: "review",
  traceId: "trace-1",
  enabledToolNamespaces: [],
  now: "2026-10-04T00:00:00.000Z",
};
const message: MessageEnvelope = {
  version: "2",
  id: "message-1",
  sender: context.actor,
  receiver: { kind: "agent", agentId: "agent-2" },
  purpose: context.purpose,
  traceId: context.traceId,
  createdAt: context.now,
  payload: null,
};

describe("embedded message protocol compatibility", () => {
  it.each(["1", "3"])(
    "rejects unsupported epoch %s before resolving authority",
    async (version) => {
      const load = vi.fn(async () => []);
      const kernel = new SharedOSKernel({ grantSource: { load } });
      await expect(
        kernel.sendMessage(context, { ...message, version } as unknown as MessageEnvelope),
      ).rejects.toMatchObject({ code: "unsupported_protocol_version", receivedVersion: version });
      expect(load).not.toHaveBeenCalled();
    },
  );

  it("accepts a current message but still denies it without a grant", async () => {
    const kernel = new SharedOSKernel({ grantSource: { load: async () => [] } });
    await expect(kernel.sendMessage(context, message)).resolves.toMatchObject({ status: "denied" });
  });
});
