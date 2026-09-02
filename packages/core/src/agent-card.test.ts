import { describe, expect, it } from "vitest";

import type { AccessContext, Address, CapabilityGrant } from "@aicoo/sharedos-contracts";

import {
  agentCardCapability,
  agentCardPath,
  directoryCapability,
  summarizeReach,
} from "./agent-card.js";
import type { AuditEvent, AuditSink } from "./audit.js";
import type { GrantSource } from "./authority.js";
import { CapabilityAuthorizer, InMemoryGrantUsageStore, addressesEqual } from "./authorization.js";
import { SharedOSKernel, type SharedOSKernelOptions } from "./kernel.js";

const NOW = "2026-09-02T09:00:00.000Z";
const READER = { kind: "agent", agentId: "agent-ana" } as const;
const SUBJECT = { kind: "agent", agentId: "agent-bob" } as const;
const STRANGER = { kind: "agent", agentId: "agent-carol" } as const;
const AUTHORITY = { kind: "human", userId: "user-alice" } as const;
const OWNER = AUTHORITY;
const OTHER_AUTHORITY = { kind: "human", userId: "user-dana" } as const;

function context(overrides: Partial<AccessContext> = {}): AccessContext {
  return {
    namespaceId: "world-alpha",
    enabledToolNamespaces: [],
    actor: READER,
    authority: AUTHORITY,
    owner: OWNER,
    purpose: "prepare-update",
    traceId: "trace-1",
    now: NOW,
    ...overrides,
  };
}

function grant(
  id: string,
  subject: Address,
  capabilities: CapabilityGrant["capabilities"],
  overrides: Partial<CapabilityGrant> = {},
): CapabilityGrant {
  return {
    id,
    namespaceId: "world-alpha",
    subject,
    issuer: AUTHORITY,
    capabilities,
    constraints: {},
    issuedAt: "2026-09-02T08:00:00.000Z",
    ...overrides,
  };
}

/**
 * A store that answers the contract: exactly the grants issued to
 * `context.actor` by `context.authority` inside `context.namespaceId`.
 */
class DirectoryGrantSource implements GrantSource {
  readonly loads: AccessContext[] = [];
  #grants: readonly CapabilityGrant[];

  constructor(grants: readonly CapabilityGrant[] = []) {
    this.#grants = grants;
  }

  serve(grants: readonly CapabilityGrant[]): this {
    this.#grants = grants;
    return this;
  }

  async load(access: AccessContext): Promise<readonly CapabilityGrant[]> {
    await Promise.resolve();
    this.loads.push(structuredClone(access));
    return this.#grants.filter(
      (entry) =>
        entry.namespaceId === access.namespaceId &&
        addressesEqual(entry.subject, access.actor) &&
        addressesEqual(entry.issuer, access.authority),
    );
  }
}

class RecordingAuditSink implements AuditSink {
  readonly events: AuditEvent[] = [];

  async record(event: AuditEvent): Promise<void> {
    await Promise.resolve();
    this.events.push(event);
  }
}

function kernelWith(
  source: GrantSource,
  options: Omit<SharedOSKernelOptions, "grantSource"> = {},
): SharedOSKernel {
  return new SharedOSKernel({ ...options, grantSource: source });
}

const SUBJECT_FILES = grant("grant-subject-files", SUBJECT, [
  {
    resource: { namespace: "files", path: ["Workspace", "roadmap"], owner: OWNER },
    actions: ["read"],
    scope: "descendants",
  },
]);
const SUBJECT_CALENDAR = grant("grant-subject-calendar", SUBJECT, [
  {
    resource: { namespace: "calendar", path: ["primary"], owner: OWNER },
    actions: ["read", "write"],
    scope: "exact",
  },
]);
const READER_CARD = grant("grant-reader-card", READER, [
  agentCardCapability(SUBJECT, OWNER, "reach"),
]);
const READER_IDENTITY_ONLY = grant("grant-reader-identity", READER, [
  agentCardCapability(SUBJECT, OWNER, "identity"),
]);
const READER_DIRECTORY = grant("grant-reader-directory", READER, [directoryCapability(OWNER)]);

describe("agent card resources", () => {
  it("addresses the widest card at the subject and each narrower view beneath it", () => {
    expect(agentCardPath(SUBJECT)).toEqual(["directory", "agent", "agent-bob"]);
    expect(agentCardPath(SUBJECT, "identity")).toEqual([
      "directory",
      "agent",
      "agent-bob",
      "identity",
    ]);
    expect(agentCardPath(SUBJECT, "namespaces")).toEqual([
      "directory",
      "agent",
      "agent-bob",
      "namespaces",
    ]);
  });

  it("counts reach entries per namespace without carrying a path", () => {
    expect(
      summarizeReach([
        { namespace: "files", path: ["Workspace", "roadmap"], actions: ["read"], scope: "exact" },
        { namespace: "files", path: ["Workspace", "notes"], actions: ["write"], scope: "exact" },
        { namespace: "calendar", path: ["primary"], actions: ["read"], scope: "exact" },
      ]),
    ).toEqual([
      { namespace: "calendar", actions: ["read"], entries: 1 },
      { namespace: "files", actions: ["read", "write"], entries: 2 },
    ]);
  });
});

describe("SharedOSKernel.readAgentCard", () => {
  it("describes the subject's reach, not the reader's", async () => {
    const kernel = kernelWith(
      new DirectoryGrantSource([READER_CARD, SUBJECT_FILES, SUBJECT_CALENDAR]),
    );

    await expect(kernel.readAgentCard(context(), SUBJECT)).resolves.toEqual({
      status: "served",
      card: {
        view: "reach",
        subject: SUBJECT,
        namespaceId: "world-alpha",
        readAt: NOW,
        reach: [
          { namespace: "calendar", path: ["primary"], actions: ["read", "write"], scope: "exact" },
          {
            namespace: "files",
            path: ["Workspace", "roadmap"],
            actions: ["read"],
            scope: "descendants",
          },
        ],
      },
    });
  });

  it("carries no grant id, issuer, expiry or budget onto the card", async () => {
    const bounded = grant(
      "grant-subject-bounded",
      SUBJECT,
      [
        {
          resource: { namespace: "files", path: ["Workspace"], owner: OWNER },
          actions: ["read"],
          scope: "descendants",
        },
      ],
      { constraints: { maxUses: 4, expiresAt: "2026-12-01T00:00:00.000Z" } },
    );
    const kernel = kernelWith(new DirectoryGrantSource([READER_CARD, bounded]), {
      authorizer: new CapabilityAuthorizer({ usageStore: new InMemoryGrantUsageStore() }),
    });

    const read = await kernel.readAgentCard(context(), SUBJECT);
    expect(read.status).toBe("served");
    const serialized = JSON.stringify(read);
    for (const secret of ["grant-subject-bounded", "user-alice", "2026-12-01", "maxUses"]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it("computes reach at read time, so a revoked grant stops being advertised", async () => {
    const source = new DirectoryGrantSource([READER_CARD, SUBJECT_FILES]);
    const kernel = kernelWith(source);

    const before = await kernel.readAgentCard(context(), SUBJECT);
    expect(before).toMatchObject({ status: "served", card: { reach: [expect.anything()] } });

    source.serve([READER_CARD, { ...SUBJECT_FILES, revokedAt: "2026-09-02T08:30:00.000Z" }]);

    const after = await kernel.readAgentCard(context(), SUBJECT);
    expect(after).toMatchObject({ status: "served", card: { reach: [] } });
  });

  it("refuses a reader holding no directory grant, and never loads the subject's grants", async () => {
    const source = new DirectoryGrantSource([SUBJECT_FILES]);
    const kernel = kernelWith(source);

    const read = await kernel.readAgentCard(context(), SUBJECT);

    expect(read).toMatchObject({ status: "refused", reasonCode: "no_matching_grant" });
    expect(read).toMatchObject({ servableViews: [] });
    expect(source.loads.map((load) => load.actor)).toEqual([READER]);
  });

  it("refuses an unauthorized reader identically for an agent that holds nothing at all", async () => {
    const kernel = kernelWith(new DirectoryGrantSource([SUBJECT_FILES]));
    const context_ = context();

    const known = await kernel.readAgentCard(context_, SUBJECT);
    const unknown = await kernel.readAgentCard(context_, STRANGER);

    // Only the subject in the described capability differs; nothing in the
    // refusal says one of these agents exists and the other does not.
    expect({ ...known, requiredAuthority: undefined }).toEqual({
      ...unknown,
      requiredAuthority: undefined,
    });
  });

  it("serves an authorized reader the same empty card for an agent with no grants", async () => {
    const kernel = kernelWith(new DirectoryGrantSource([READER_DIRECTORY]));

    await expect(kernel.readAgentCard(context(), STRANGER)).resolves.toEqual({
      status: "served",
      card: {
        view: "reach",
        subject: STRANGER,
        namespaceId: "world-alpha",
        readAt: NOW,
        reach: [],
      },
    });
  });

  it("serves a less-authorized reader less, and tells it what it may still ask for", async () => {
    const kernel = kernelWith(
      new DirectoryGrantSource([READER_IDENTITY_ONLY, SUBJECT_FILES, SUBJECT_CALENDAR]),
    );

    await expect(kernel.readAgentCard(context(), SUBJECT, { view: "identity" })).resolves.toEqual({
      status: "served",
      card: { view: "identity", subject: SUBJECT, namespaceId: "world-alpha", readAt: NOW },
    });

    const widest = await kernel.readAgentCard(context(), SUBJECT);
    expect(widest).toMatchObject({
      status: "refused",
      reasonCode: "no_matching_grant",
      servableViews: ["identity"],
    });
  });

  it("never loads the subject's grants for a view made of no reach", async () => {
    const source = new DirectoryGrantSource([READER_IDENTITY_ONLY, SUBJECT_FILES]);
    const kernel = kernelWith(source);

    await kernel.readAgentCard(context(), SUBJECT, { view: "identity" });

    expect(source.loads.map((load) => load.actor)).toEqual([READER]);
  });

  it("serves the coarse view as its own named view, with counts and no paths", async () => {
    const kernel = kernelWith(
      new DirectoryGrantSource([READER_DIRECTORY, SUBJECT_FILES, SUBJECT_CALENDAR]),
    );

    await expect(kernel.readAgentCard(context(), SUBJECT, { view: "namespaces" })).resolves.toEqual(
      {
        status: "served",
        card: {
          view: "namespaces",
          subject: SUBJECT,
          namespaceId: "world-alpha",
          readAt: NOW,
          namespaces: [
            { namespace: "calendar", actions: ["read", "write"], entries: 1 },
            { namespace: "files", actions: ["read"], entries: 1 },
          ],
        },
      },
    );
  });

  it("bounds a card to what the subject holds under the reader's own authority", async () => {
    const elsewhere = grant(
      "grant-subject-elsewhere",
      SUBJECT,
      [
        {
          resource: { namespace: "billing", path: ["ledger"], owner: OWNER },
          actions: ["read"],
          scope: "exact",
        },
      ],
      { issuer: OTHER_AUTHORITY },
    );
    const kernel = kernelWith(new DirectoryGrantSource([READER_CARD, SUBJECT_FILES, elsewhere]));

    const read = await kernel.readAgentCard(context(), SUBJECT);

    expect(read).toMatchObject({
      status: "served",
      card: { reach: [{ namespace: "files" }] },
    });
  });

  it("loads the subject's grants under a context that differs from the reader's in actor alone", async () => {
    const source = new DirectoryGrantSource([READER_CARD, SUBJECT_FILES]);
    const kernel = kernelWith(source);

    await kernel.readAgentCard(context(), SUBJECT);

    expect(source.loads).toHaveLength(2);
    const [reader, subject] = source.loads as [AccessContext, AccessContext];
    expect(reader.actor).toEqual(READER);
    expect(subject.actor).toEqual(SUBJECT);
    expect({ ...reader, actor: undefined }).toEqual({ ...subject, actor: undefined });
  });

  /**
   * The one behavioural obligation ADR 0021 puts on an existing host.
   *
   * A `GrantSource` is now called with a context whose actor is not the caller.
   * One that reads an ambient session user instead of `context.actor` answers
   * with the wrong principal's grants -- and this pins that SharedOS refuses the
   * card rather than serving the reader's own reach under the subject's name.
   */
  it("refuses rather than serving a card built from the wrong principal's grants", async () => {
    class AmbientSessionGrantSource implements GrantSource {
      async load(): Promise<readonly CapabilityGrant[]> {
        await Promise.resolve();
        // Always the session user's grants, whatever `context.actor` says.
        return [READER_CARD, grant("grant-reader-files", READER, SUBJECT_FILES.capabilities)];
      }
    }
    const kernel = kernelWith(new AmbientSessionGrantSource());

    await expect(kernel.readAgentCard(context(), SUBJECT)).resolves.toEqual({
      status: "refused",
      reasonCode: "authority_unavailable",
      servableViews: [],
    });
  });

  it("costs the reader no bounded use, however many times it is read", async () => {
    const usageStore = new InMemoryGrantUsageStore();
    const bounded = grant("grant-reader-bounded", READER, [directoryCapability(OWNER)], {
      constraints: { maxUses: 1 },
    });
    const kernel = kernelWith(new DirectoryGrantSource([bounded, SUBJECT_FILES]), {
      authorizer: new CapabilityAuthorizer({ usageStore }),
    });

    await expect(kernel.readAgentCard(context(), SUBJECT)).resolves.toMatchObject({
      status: "served",
    });
    await expect(kernel.readAgentCard(context(), SUBJECT)).resolves.toMatchObject({
      status: "served",
    });
    expect(await usageStore.getUsage("world-alpha", "grant-reader-bounded")).toBe(0);
  });

  it("records one authorization for the view that was asked for", async () => {
    const audit = new RecordingAuditSink();
    const kernel = kernelWith(new DirectoryGrantSource([READER_IDENTITY_ONLY, SUBJECT_FILES]), {
      audit,
    });

    await kernel.readAgentCard(context(), SUBJECT);

    const checks = audit.events.filter((event) => event.type === "authorization.checked");
    expect(checks).toHaveLength(1);
    expect(checks[0]).toMatchObject({
      outcome: "denied",
      actor: READER,
      action: "read",
      resource: { namespace: "sharedos", path: ["directory", "agent", "agent-bob"] },
      metadata: { consumed: false },
    });
  });

  it("reads a card in one world only, and never describes another", async () => {
    const otherWorld = grant("grant-subject-other-world", SUBJECT, SUBJECT_CALENDAR.capabilities, {
      namespaceId: "world-beta",
    });
    const kernel = kernelWith(new DirectoryGrantSource([READER_CARD, SUBJECT_FILES, otherWorld]));

    const read = await kernel.readAgentCard(context(), SUBJECT);

    expect(read).toMatchObject({
      status: "served",
      card: { namespaceId: "world-alpha", reach: [{ namespace: "files" }] },
    });
  });

  it("rejects a subject that is not a SharedOS address", async () => {
    const kernel = kernelWith(new DirectoryGrantSource([READER_DIRECTORY]));

    await expect(
      kernel.readAgentCard(context(), { kind: "agent" } as unknown as Address),
    ).rejects.toThrow(TypeError);
  });
});
