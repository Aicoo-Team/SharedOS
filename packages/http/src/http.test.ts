import { describe, expect, it, vi } from "vitest";

import type { AccessContext } from "@sharedos/contracts";
import { SharedOSClient } from "@sharedos/client";
import { SharedOSKernel } from "@sharedos/core";

import {
  SharedOSHttpError,
  createKernelSharedOSApi,
  createSharedOSHandler,
  type SharedOSApi,
} from "./index.js";

const context: AccessContext = {
  actor: { kind: "agent", agentId: "agent-bob" },
  authority: { kind: "human", userId: "user-alice" },
  owner: { kind: "human", userId: "user-alice" },
  namespaceId: "namespace-1",
  purpose: "prepare-report",
  traceId: "trace-1",
  grants: [],
  now: "2026-08-03T00:00:00.000Z",
};

function createApi(): SharedOSApi {
  return {
    authorize: vi.fn(async () => ({ allowed: false, reasonCode: "no_matching_grant" })),
    listTools: vi.fn(async () => []),
    invokeTool: vi.fn(async (_context, call) => ({
      callId: call.id,
      tool: call.tool,
      status: "succeeded" as const,
      output: null,
      completedAt: context.now,
    })),
    invokeResource: vi.fn(async (_context, operation) => ({
      operationId: operation.operationId,
      status: "succeeded" as const,
      output: null,
      completedAt: context.now,
    })),
    sendMessage: vi.fn(async (_context, envelope) => ({
      messageId: envelope.id,
      status: "accepted" as const,
      timestamp: "2026-08-03T00:00:00.000Z",
    })),
    executeTurn: vi.fn(async () => ({
      version: "1" as const,
      executionId: "execution-1",
      traceId: context.traceId,
      status: "succeeded" as const,
      output: null,
      events: [],
      startedAt: context.now,
      completedAt: context.now,
    })),
  };
}

describe("createSharedOSHandler", () => {
  it("builds remote turns from server context and permission-filtered tools", async () => {
    const kernel = new SharedOSKernel();
    const execute = vi.fn(async () => ({
      version: "1" as const,
      executionId: "execution-1",
      traceId: "trace-1",
      status: "succeeded" as const,
      output: null,
      events: [],
      startedAt: "2026-08-03T00:00:00.000Z",
      completedAt: "2026-08-03T00:00:00.000Z",
    }));
    const api = createKernelSharedOSApi({
      kernel,
      turns: { execute },
    });

    await api.executeTurn(context, {
      version: "1",
      executionId: "execution-1",
      agent: { kind: "agent", agentId: "agent-alice" },
      message: {
        version: "1",
        id: "message-1",
        sender: { kind: "agent", agentId: "agent-bob" },
        receiver: { kind: "agent", agentId: "agent-alice" },
        intent: "prepare",
        purpose: "prepare-report",
        payload: null,
        traceId: "trace-1",
        createdAt: "2026-08-03T00:00:00.000Z",
      },
    });

    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ context, tools: [] }), {});
  });

  it("resolves authority server-side before listing tools", async () => {
    const api = createApi();
    const resolveContext = vi.fn(async () => context);
    const handler = createSharedOSHandler({ api, resolveContext });

    const response = await handler(new Request("https://sharedos.test/v1/tools"));

    expect(response.status).toBe(200);
    expect(resolveContext).toHaveBeenCalledOnce();
    expect(api.listTools).toHaveBeenCalledWith(
      context,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("does not resolve auth context for health checks", async () => {
    const resolveContext = vi.fn(async () => context);
    const handler = createSharedOSHandler({ api: createApi(), resolveContext });

    const response = await handler(new Request("https://sharedos.test/health"));

    expect(response.status).toBe(200);
    expect(resolveContext).not.toHaveBeenCalled();
  });

  it("fails closed when a host returns an invalid access context", async () => {
    const handler = createSharedOSHandler({
      api: createApi(),
      resolveContext: async () => ({ grants: [] }) as unknown as AccessContext,
    });

    const response = await handler(new Request("https://sharedos.test/v1/tools"));
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(500);
    expect(payload.error.code).toBe("invalid_access_context");
  });

  it("maps permission failures without leaking internal details", async () => {
    const api = createApi();
    api.listTools = vi.fn(async () => {
      throw Object.assign(new Error("private grant details"), { code: "permission_denied" });
    });
    const handler = createSharedOSHandler({ api, resolveContext: async () => context });

    const response = await handler(new Request("https://sharedos.test/v1/tools"));
    const payload = (await response.json()) as { error: { message: string } };

    expect(response.status).toBe(403);
    expect(payload.error.message).not.toContain("private grant details");
  });

  it("injects resource authority and rejects caller-supplied contexts", async () => {
    const api = createApi();
    const handler = createSharedOSHandler({ api, resolveContext: async () => context });
    const operation = {
      operationId: "operation-1",
      resource: { namespace: "files", path: ["Workspace", "project-x"] },
      action: "search",
    };

    const response = await handler(
      new Request("https://sharedos.test/v1/resources/invoke", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(operation),
      }),
    );

    expect(response.status).toBe(200);
    expect(api.invokeResource).toHaveBeenCalledWith(
      context,
      expect.objectContaining({ context, operationId: "operation-1" }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    const forgedResponse = await handler(
      new Request("https://sharedos.test/v1/resources/invoke", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...operation, context }),
      }),
    );
    expect(forgedResponse.status).toBe(400);
  });

  it("supports host-defined authentication errors", async () => {
    const handler = createSharedOSHandler({
      api: createApi(),
      resolveContext: async () => {
        throw new SharedOSHttpError(401, "unauthorized", "Authentication required.");
      },
    });

    const response = await handler(new Request("https://sharedos.test/v1/tools"));
    expect(response.status).toBe(401);
  });

  it("uses 202 only for asynchronously accepted messages", async () => {
    const envelope = {
      version: "1" as const,
      id: "message-1",
      sender: context.actor,
      receiver: { kind: "agent" as const, agentId: "agent-alice" },
      intent: "prepare",
      purpose: context.purpose,
      payload: null,
      traceId: context.traceId,
      createdAt: context.now,
    };
    const acceptedApi = createApi();
    const accepted = await createSharedOSHandler({
      api: acceptedApi,
      resolveContext: async () => context,
    })(
      new Request("https://sharedos.test/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(envelope),
      }),
    );

    const deniedApi = createApi();
    deniedApi.sendMessage = vi.fn(async () => ({
      messageId: envelope.id,
      status: "denied" as const,
      timestamp: context.now,
      error: { code: "no_matching_grant", message: "Denied" },
    }));
    const denied = await createSharedOSHandler({
      api: deniedApi,
      resolveContext: async () => context,
    })(
      new Request("https://sharedos.test/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(envelope),
      }),
    );

    expect(accepted.status).toBe(202);
    expect(denied.status).toBe(200);
  });

  it("stays wire-compatible with the typed HTTP client", async () => {
    const handler = createSharedOSHandler({
      api: createApi(),
      resolveContext: async () => context,
    });
    const client = new SharedOSClient({
      baseUrl: "https://sharedos.test",
      fetch: async (input, init) => handler(new Request(input, init)),
    });

    await expect(client.listTools()).resolves.toEqual([]);
  });
});
