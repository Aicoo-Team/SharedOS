/**
 * One question, N recipients, N tickets.
 *
 * Asking three colleagues' agents the same question is three authorizations,
 * not one. Each recipient gets its own grant carrying one exact
 * `messageSendCapability(recipient, owner)` and `constraints.maxUses: 1`, so a
 * ticket spent on one colleague cannot be spent on another and cannot be spent
 * twice on the same one.
 *
 * A single grant covering every recipient would share one usage budget across
 * them, which is the shape this example exists to argue against.
 *
 * Run: pnpm example:recipient-fanout
 */
import type { AccessContext, Address, CapabilityGrant, ToolCall } from "@aicoo/sharedos-contracts";
import type { AuditEvent } from "@aicoo/sharedos-core";
import {
  CapabilityAuthorizer,
  InMemoryGrantUsageStore,
  SharedOSKernel,
  messageSendCapability,
} from "@aicoo/sharedos-core";

const NOW = "2026-09-06T00:00:00.000Z";
const QUESTION = "Ready to launch?";
const OWNER = { kind: "human", userId: "owner" } as const satisfies Address;
const ASKER = { kind: "agent", agentId: "asker" } as const satisfies Address;

const colleague = (index: number) =>
  ({ kind: "agent", agentId: `colleague-${index}` }) as const satisfies Address;

const context: AccessContext = {
  namespaceId: "fanout",
  actor: ASKER,
  authority: OWNER,
  owner: OWNER,
  purpose: "launch-review",
  traceId: "fanout-trace",
  now: NOW,
  enabledToolNamespaces: ["messages"],
};

/**
 * One scene's world: a fresh kernel, a fresh ticket per recipient, and a fresh
 * usage store. Each scene starts clean because a spent ticket stays spent --
 * that is the property, so it cannot be undone between scenes.
 */
function world(recipients: number, { bounded = true } = {}) {
  const grants: CapabilityGrant[] = Array.from({ length: recipients }, (_, index) => ({
    id: `send-${index}`,
    namespaceId: "fanout",
    subject: ASKER,
    issuer: OWNER,
    capabilities: [messageSendCapability(colleague(index), OWNER)],
    constraints: { maxUses: 1, purposes: ["launch-review"] },
    issuedAt: NOW,
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
        return { messageId: message.id, status: "accepted", timestamp: NOW };
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
        createdAt: NOW,
        replyTo: message.id,
        payload: { recipient: message.receiver },
      }),
    },
  });

  const ask = (index: number, attempt = "first") => {
    const call: ToolCall = {
      id: `call-${index}-${attempt}`,
      tool: "messages.request",
      arguments: { recipient: colleague(index), payload: { question: QUESTION } },
      traceId: context.traceId,
      requestedAt: NOW,
    };
    return kernel.invokeTool(context, call);
  };

  /**
   * A turn, the way the shipped path runs one: `SharedOSExecutor` opens a single
   * authority lease and every operation inside it decides against that one
   * state. The hold is over the grant set only -- usage is read and consumed per
   * decision, so a ticket still cannot be spent twice inside one turn.
   */
  const turn = async <T>(run: () => Promise<T>): Promise<T> => {
    const scope = await kernel.openTurnAuthority(context);
    try {
      return await run();
    } finally {
      scope.close();
    }
  };

  /** What the trusted audit stream says, which is more than the caller is told. */
  const lastCause = () =>
    events
      .filter((event) => event.type === "tool.invoked")
      .map((event) => event.metadata?.["cause"])
      .at(-1);

  return { ask, turn, grants, usage, deliveries, lastCause };
}

function line(label: string, verdict: string, detail: string): void {
  console.log(`  ${verdict.padEnd(6)} ${label.padEnd(14)} ${detail}`);
}

async function main(): Promise<void> {
  console.log("\nSharedOS — one question, one ticket per recipient\n");
  console.log(`  Asked of each, identically: "${QUESTION}"\n`);

  console.log("1. three colleagues, three single-use tickets, one turn\n");
  {
    const { ask, turn, deliveries, usage } = world(3);
    await turn(async () => {
      for (let index = 0; index < 3; index += 1) {
        const result = await ask(index);
        const spent = await usage.getUsage("fanout", `send-${index}`);
        const reply =
          result.status === "succeeded"
            ? (result.output as { recipient: { agentId: string } }).recipient.agentId
            : "none";
        line(
          `colleague-${index}`,
          result.status === "succeeded" ? "SENT" : "DENY",
          `ticket spent ${spent}/1   reply from ${reply}`,
        );
      }
    });
    console.log(
      `\n  deliveries: ${deliveries.length}, all distinct: ${new Set(deliveries).size === deliveries.length}`,
    );
  }

  console.log("\n2. the same question asked twice of one colleague\n");
  {
    const { ask, turn, deliveries, lastCause } = world(1);
    await turn(async () => {
      await ask(0);
      const replay = await ask(0, "replay");
      line(
        "colleague-0",
        "DENY",
        `caller is told ${replay.status === "denied" ? replay.error.code : "nothing"}, audit says ${String(lastCause())}`,
      );
    });
    console.log("\n  A spent bounded grant is not reach, so the replay is refused at discovery.");
    console.log(`  The caller learns nothing about the ticket. deliveries: ${deliveries.length}`);
  }

  console.log("\n3. a colleague nobody issued a ticket for\n");
  {
    const { ask, turn, deliveries, usage } = world(1);
    await turn(async () => {
      const result = await ask(1);
      line(
        "colleague-1",
        "DENY",
        `${result.status === "denied" ? result.error.code : "allowed"}   colleague-0's ticket spent ${await usage.getUsage("fanout", "send-0")}/1`,
      );
    });
    console.log(`\n  Refused on the recipient, not on discovery: the asker still holds an unspent`);
    console.log(`  ticket, so the tool is visible. deliveries: ${deliveries.length}`);
  }

  console.log("\n4. the owner revokes one ticket; the other is untouched\n");
  {
    const { ask, turn, grants, deliveries } = world(2);
    grants[0] = { ...grants[0]!, revokedAt: NOW };
    await turn(async () => {
      const revoked = await ask(0);
      line(
        "colleague-0",
        "DENY",
        `revoked   ${revoked.status === "denied" ? revoked.error.code : ""}`,
      );
      const other = await ask(1);
      line("colleague-1", other.status === "succeeded" ? "SENT" : "DENY", "ticket untouched");
    });
    console.log(`\n  deliveries: ${deliveries.length}`);
  }

  console.log("\n5. no usage store, so a single-use ticket cannot be counted\n");
  {
    const { ask, turn, deliveries } = world(2, { bounded: false });
    await turn(async () => {
      for (let index = 0; index < 2; index += 1) {
        const result = await ask(index);
        line(
          `colleague-${index}`,
          "DENY",
          result.status === "denied" ? result.error.code : "allowed",
        );
      }
    });
    console.log(
      `\n  Fails closed before the transport is reached. deliveries: ${deliveries.length}`,
    );
  }

  console.log(
    [
      "",
      "One grant covering all three recipients would have shared one budget, and",
      "the first send would have spent the other two. A ticket per recipient is",
      "what makes a spent ticket, a wrong recipient, and a revoked recipient three",
      "different refusals instead of one.",
      "",
    ].join("\n"),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
