import { describe, expect, expectTypeOf, it } from "vitest";

import {
  AccessContextSchema,
  AuthorizationDecisionSchema,
  CapabilityGrantSchema,
  ExecutionRequestSchema,
  JsonValueSchema,
  MessageDeliveryResultSchema,
  MessageEnvelopeSchema,
  RemoteExecutionRequestSchema,
  RemoteResourceOperationSchema,
  ResourceOperationSchema,
  ToolResultSchema,
  type AccessContext,
  type JsonValue,
} from "./index.js";

const actor = { kind: "agent" as const, agentId: "agent-bob" };
const owner = { kind: "human" as const, userId: "alice" };
const now = "2026-08-03T10:00:00.000Z";

const grant = {
  id: "grant-1",
  namespaceId: "aicoo:alice",
  subject: actor,
  issuer: owner,
  capabilities: [
    {
      resource: {
        namespace: "memory",
        path: ["project-x"],
        owner,
      },
      actions: ["search", "read"],
      scope: "descendants" as const,
    },
  ],
  constraints: {
    purposes: ["prepare-investor-update"],
    expiresAt: "2026-08-04T10:00:00.000Z",
  },
  issuedAt: now,
};

const context = {
  namespaceId: "aicoo:alice",
  actor,
  authority: owner,
  owner,
  purpose: "prepare-investor-update",
  traceId: "trace-1",
  grants: [grant],
  now,
};

describe("JSON-safe protocol contracts", () => {
  it("accepts nested JSON and rejects values JSON cannot preserve", () => {
    const value = { nested: ["hello", 42, true, null] };

    expect(JsonValueSchema.parse(value)).toEqual(value);
    expect(JsonValueSchema.safeParse({ bad: undefined }).success).toBe(false);
    expect(JsonValueSchema.safeParse(Number.POSITIVE_INFINITY).success).toBe(false);
    expect(JsonValueSchema.safeParse(new Date()).success).toBe(false);
  });

  it("parses a complete access context and grant", () => {
    expect(CapabilityGrantSchema.parse(grant)).toEqual(grant);
    expect(AccessContextSchema.parse(context)).toEqual(context);
    expectTypeOf(AccessContextSchema.parse(context)).toEqualTypeOf<AccessContext>();
  });

  it("shares authorization decisions without leaking provider state", () => {
    expect(
      AuthorizationDecisionSchema.parse({
        allowed: true,
        reasonCode: "grant_matched",
        matchedGrantId: "grant-1",
      }),
    ).toEqual({
      allowed: true,
      reasonCode: "grant_matched",
      matchedGrantId: "grant-1",
    });
  });

  it("rejects an invalid capability time window", () => {
    const invalid = {
      ...grant,
      constraints: {
        notBefore: "2026-08-05T10:00:00.000Z",
        expiresAt: "2026-08-04T10:00:00.000Z",
      },
    };

    expect(CapabilityGrantSchema.safeParse(invalid).success).toBe(false);
  });

  it("keeps authority out of message envelopes", () => {
    const message = {
      version: "1",
      id: "message-1",
      sender: actor,
      receiver: { kind: "agent" as const, agentId: "agent-alice" },
      intent: "summarize",
      purpose: "prepare-investor-update",
      payload: { query: "latest project status" },
      traceId: "trace-1",
      createdAt: now,
    };

    expect(MessageEnvelopeSchema.parse(message)).toEqual(message);
    expect(MessageEnvelopeSchema.safeParse({ ...message, grants: [grant] }).success).toBe(false);
  });

  it("requires an error when message delivery fails", () => {
    expect(
      MessageDeliveryResultSchema.safeParse({
        messageId: "message-1",
        status: "denied",
        timestamp: now,
        error: { code: "no_matching_grant", message: "Permission denied" },
      }).success,
    ).toBe(true);
    expect(
      MessageDeliveryResultSchema.safeParse({
        messageId: "message-1",
        status: "failed",
        timestamp: now,
      }).success,
    ).toBe(false);
    expect(
      MessageDeliveryResultSchema.safeParse({
        messageId: "message-1",
        status: "delivered",
        timestamp: now,
      }).success,
    ).toBe(true);
  });

  it("validates resource and execution requests at their wire boundaries", () => {
    const message = {
      version: "1" as const,
      id: "message-1",
      sender: owner,
      receiver: actor,
      intent: "search-memory",
      purpose: context.purpose,
      payload: { query: "project status" },
      traceId: context.traceId,
      createdAt: now,
    };
    const tool = {
      name: "memory.search",
      description: "Search an authorized memory namespace",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string" } },
      },
      requiredCapability: {
        resource: { namespace: "memory", path: ["project-x"], owner },
        action: "search",
      },
      annotations: { readOnly: true },
    };

    expect(
      ResourceOperationSchema.safeParse({
        operationId: "operation-1",
        context,
        resource: tool.requiredCapability.resource,
        action: "search",
        input: { query: "project status" },
      }).success,
    ).toBe(true);

    expect(
      ExecutionRequestSchema.safeParse({
        version: "1",
        executionId: "execution-1",
        agent: actor,
        context,
        message,
        tools: [tool],
      }).success,
    ).toBe(true);
  });

  it("uses discriminated results so failures cannot masquerade as output", () => {
    expect(
      ToolResultSchema.safeParse({
        callId: "call-1",
        tool: "memory.search",
        status: "failed",
        output: [],
        completedAt: now,
      }).success,
    ).toBe(false);

    expect(
      ToolResultSchema.safeParse({
        callId: "call-1",
        tool: "memory.search",
        status: "failed",
        error: { code: "provider_unavailable", message: "Try again" },
        completedAt: now,
      }).success,
    ).toBe(true);
  });

  it("keeps authority out of remote HTTP request contracts", () => {
    expect(
      RemoteResourceOperationSchema.safeParse({
        operationId: "operation-1",
        resource: { namespace: "memory", path: ["project-x"] },
        action: "read",
      }).success,
    ).toBe(true);
    expect(
      RemoteResourceOperationSchema.safeParse({
        operationId: "operation-1",
        resource: { namespace: "memory", path: ["project-x"] },
        action: "read",
        context,
      }).success,
    ).toBe(false);
    expect(
      RemoteExecutionRequestSchema.safeParse({
        version: "1",
        executionId: "execution-1",
        agent: actor,
        message: {
          version: "1",
          id: "message-1",
          sender: owner,
          receiver: actor,
          intent: "read",
          purpose: context.purpose,
          payload: null,
          traceId: context.traceId,
          createdAt: now,
        },
        context,
        tools: [],
      }).success,
    ).toBe(false);
  });

  it("exports JsonValue as the schema's recursive value type", () => {
    expectTypeOf(JsonValueSchema.parse({ ok: true })).toEqualTypeOf<JsonValue>();
  });
});
