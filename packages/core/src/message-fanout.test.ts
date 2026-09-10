import { describe, expect, it } from "vitest";
import type { AccessContext, CapabilityGrant, ToolCall } from "@aicoo/sharedos-contracts";
import type { AuditEvent } from "./audit.js";
import { CapabilityAuthorizer, InMemoryGrantUsageStore } from "./authorization.js";
import { SharedOSKernel } from "./kernel.js";
import { messageSendCapability } from "./message-service.js";

const now = "2026-09-06T00:00:00.000Z";
const owner = { kind: "human", userId: "owner" } as const;
const asker = { kind: "agent", agentId: "asker" } as const;
const recipient = (index: number) => ({ kind: "agent" as const, agentId: `colleague-${index}` });
const context: AccessContext = {
  namespaceId: "fanout",
  actor: asker,
  authority: owner,
  owner,
  purpose: "launch-review",
  traceId: "fanout-trace",
  now,
  enabledToolNamespaces: ["messages"],
};
function setup(count: number, bounded = true) {
  const grants: CapabilityGrant[] = Array.from({ length: count }, (_, index) => ({
    id: `send-${index}`,
    namespaceId: "fanout",
    subject: asker,
    issuer: owner,
    capabilities: [messageSendCapability(recipient(index), owner)],
    constraints: { maxUses: 1, purposes: ["launch-review"] },
    issuedAt: now,
  }));
  const usage = new InMemoryGrantUsageStore();
  const deliveries: string[] = [];
  const events: AuditEvent[] = [];
  let serial = 0;
  const kernel = new SharedOSKernel({
    grantSource: { load: async () => grants },
    authorizer: new CapabilityAuthorizer(bounded ? { usageStore: usage } : {}),
    audit: {
      record: async (event) => {
        events.push(event);
      },
    },
    createMessageId: () => `message-${++serial}`,
    messageTransport: {
      deliver: async (_context, message) => {
        deliveries.push(message.id);
        return { messageId: message.id, status: "accepted", timestamp: now };
      },
    },
    messageRequestRouter: {
      resolveReply: async (_context, message) => ({
        version: "1",
        id: `reply-${message.id}`,
        sender: message.receiver,
        receiver: message.sender,
        purpose: message.purpose,
        traceId: message.traceId,
        createdAt: now,
        replyTo: message.id,
        payload: { recipient: message.receiver },
      }),
    },
  });
  const ask = (index: number, attempt = "first") => {
    const call: ToolCall = {
      id: `call-${index}-${attempt}`,
      tool: "messages.request",
      arguments: { recipient: recipient(index), payload: { question: "Ready to launch?" } },
      traceId: context.traceId,
      requestedAt: now,
    };
    return kernel.invokeTool(context, call);
  };
  /**
   * Run the fanout the way the shipped path runs it.
   *
   * `SharedOSExecutor` opens one authority lease per turn, so a fanout that
   * called the kernel lease-less would be covering a shape no turn takes. The
   * hold is over the grant set only: usage is read and consumed per decision,
   * so single-use exhaustion is unchanged by it.
   */
  const withTurn = async <T>(run: () => Promise<T>): Promise<T> => {
    const scope = await kernel.openTurnAuthority(context);
    try {
      return await run();
    } finally {
      scope.close();
    }
  };
  const toolCauses = () =>
    events.filter((event) => event.type === "tool.invoked").map((event) => event.metadata?.cause);
  return { ask, grants, usage, deliveries, withTurn, toolCauses };
}
describe("recipient-scoped single-use request fanout", () => {
  it.each([1, 25])(
    "isolates %i recipients even when each request races a replay",
    async (count) => {
      const { withTurn, ask, deliveries, usage } = setup(count);
      await withTurn(async () => {
        await Promise.all(
          Array.from({ length: count }, async (_, index) => {
            const pair = await Promise.all([ask(index), ask(index, "replay")]);
            // Exactly one of the two spends the ticket. Which refusal the loser
            // is handed depends on whether it cleared discovery before the
            // winner consumed, so this case pins the outcome and not the code;
            // the sequential case below pins the code.
            expect(pair.filter(({ status }) => status === "succeeded")).toHaveLength(1);
            expect(pair.filter(({ status }) => status === "denied")).toHaveLength(1);
            expect(pair.find(({ status }) => status === "succeeded")).toMatchObject({
              output: { recipient: recipient(index) },
            });
            expect(await usage.getUsage("fanout", `send-${index}`)).toBe(1);
          }),
        );
      });
      expect(deliveries).toHaveLength(count);
      expect(new Set(deliveries).size).toBe(count);
    },
  );

  it("hides a spent ticket from the caller and names the cause only in audit", async () => {
    // Ordered, so there is no race to absorb the disclosure question. A bounded
    // grant whose budget is spent is not reach, so the replay is refused at
    // discovery: the caller is told `tool_unavailable` and learns nothing about
    // the grant, while the trusted audit event carries `grant_exhausted`.
    const { withTurn, ask, usage, deliveries, toolCauses } = setup(1);
    await withTurn(async () => {
      expect(await ask(0)).toMatchObject({ status: "succeeded" });
      expect(await ask(0, "replay")).toMatchObject({
        status: "denied",
        error: { code: "tool_unavailable" },
      });
      expect(await usage.getUsage("fanout", "send-0")).toBe(1);
    });
    expect(toolCauses()).toContain("grant_exhausted");
    expect(deliveries).toHaveLength(1);
  });

  it("a wrong recipient cannot spend another recipient's ticket", async () => {
    // `no_matching_grant` rather than the hidden-tool refusal above: the asker
    // still holds an unspent send grant, so the tool clears discovery and the
    // exact recipient is what the call is refused on.
    const { withTurn, ask, usage, deliveries } = setup(1);
    await withTurn(async () => {
      expect(await ask(1)).toMatchObject({
        status: "denied",
        error: { code: "no_matching_grant" },
      });
      expect(await usage.getUsage("fanout", "send-0")).toBe(0);
      expect(await ask(0)).toMatchObject({ status: "succeeded" });
    });
    expect(deliveries).toHaveLength(1);
  });

  it("revoking one recipient leaves the other ticket usable", async () => {
    // The turn opens after the revocation, because a turn decides against the
    // authority it was admitted with; a store edit lands on the next one.
    const { withTurn, ask, grants, deliveries } = setup(2);
    grants[0] = { ...grants[0]!, revokedAt: now };
    await withTurn(async () => {
      expect(await ask(0)).toMatchObject({ status: "denied" });
      expect(await ask(1)).toMatchObject({ status: "succeeded" });
    });
    expect(deliveries).toHaveLength(1);
  });

  it("fails closed without a usage store and never reaches transport", async () => {
    const { withTurn, ask, deliveries } = setup(2, false);
    await withTurn(async () => {
      const results = await Promise.all([ask(0), ask(1)]);
      expect(results.every(({ status }) => status === "denied")).toBe(true);
    });
    expect(deliveries).toHaveLength(0);
  });
});
