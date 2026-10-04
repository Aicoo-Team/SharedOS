import { describe, expect, it, vi } from "vitest";

import { SharedOSClient, SharedOSClientError } from "./index.js";

describe("SharedOSClient", () => {
  it("adds authentication and purpose without putting grants in the body", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (_input, init) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("authorization")).toBe("Bearer secret");
      expect(headers.get("x-sharedos-purpose")).toBe("prepare-report");
      expect(init?.body).toBeUndefined();

      return Response.json([], { headers: { "x-sharedos-protocol-version": "2" } });
    });

    const client = new SharedOSClient({
      baseUrl: "https://sharedos.test/",
      token: "secret",
      fetch,
    });
    await client.listTools({ purpose: "prepare-report" });

    expect(fetch).toHaveBeenCalledWith(
      "https://sharedos.test/v2/tools",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("returns structured API failures", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      Response.json(
        {
          error: {
            code: "permission_denied",
            message: "No matching grant.",
            requestId: "request-1",
          },
        },
        { status: 403, headers: { "x-sharedos-protocol-version": "2" } },
      ),
    );

    const client = new SharedOSClient({ baseUrl: "https://sharedos.test", fetch });

    await expect(client.listTools()).rejects.toEqual(
      expect.objectContaining<Partial<SharedOSClientError>>({
        status: 403,
        code: "permission_denied",
        requestId: "request-1",
      }),
    );
  });

  it("rejects malformed success payloads instead of trusting a type cast", async () => {
    const client = new SharedOSClient({
      baseUrl: "https://sharedos.test",
      fetch: async () =>
        Response.json([{ name: "files.search" }], {
          headers: { "x-sharedos-protocol-version": "2" },
        }),
    });

    await expect(client.listTools()).rejects.toMatchObject({
      code: "invalid_response",
      status: 200,
    });
  });
});

describe("HTTP protocol compatibility", () => {
  it.each(["1", "3", undefined])(
    "rejects response epoch %s before reading the strict schema",
    async (version) => {
      const client = new SharedOSClient({
        baseUrl: "https://sharedos.test",
        fetch: async () =>
          new Response("not even JSON", {
            headers: version === undefined ? {} : { "x-sharedos-protocol-version": version },
          }),
      });
      await expect(client.listTools()).rejects.toMatchObject({
        code: "unsupported_protocol_version",
        message: expect.stringContaining('supported version is "2"'),
      });
    },
  );

  it("rejects an old body stamp even when the header advertises v2", async () => {
    const client = new SharedOSClient({
      baseUrl: "https://sharedos.test",
      fetch: async () =>
        Response.json(
          { status: "ok", protocolVersion: "1" },
          {
            headers: { "x-sharedos-protocol-version": "2" },
          },
        ),
    });
    await expect(client.health()).rejects.toMatchObject({ code: "unsupported_protocol_version" });
  });

  it("reports an older server with an unversioned 404 as incompatible", async () => {
    const client = new SharedOSClient({
      baseUrl: "https://sharedos.test",
      fetch: async () =>
        Response.json(
          {
            error: { code: "not_found", message: "Unknown v2 endpoint." },
          },
          { status: 404 },
        ),
    });
    await expect(client.listTools()).rejects.toMatchObject({
      code: "unsupported_protocol_version",
      status: 404,
    });
  });

  it("receives clear errors when a new server rejects an old writer", async () => {
    const client = new SharedOSClient({
      baseUrl: "https://sharedos.test",
      fetch: async () =>
        Response.json(
          {
            error: {
              code: "unsupported_protocol_version",
              message: 'Unsupported SharedOS protocol version "1"; supported version is "2".',
              requestId: "mismatch",
            },
          },
          { status: 426, headers: { "x-sharedos-protocol-version": "2" } },
        ),
    });
    await expect(client.listTools()).rejects.toMatchObject({
      code: "unsupported_protocol_version",
      status: 426,
      requestId: "mismatch",
    });
  });
});

it("rejects an incompatible nested execution event before result validation", async () => {
  const client = new SharedOSClient({
    baseUrl: "https://sharedos.test",
    fetch: async () =>
      Response.json(
        { version: "2", events: [{ version: "1" }] },
        {
          headers: { "x-sharedos-protocol-version": "2" },
        },
      ),
  });
  await expect(
    client.executeTurn({
      version: "2",
      executionId: "turn-1",
      agent: { kind: "agent", agentId: "agent-1" },
      message: {
        version: "2",
        id: "message-1",
        sender: { kind: "human", userId: "owner-1" },
        receiver: { kind: "agent", agentId: "agent-1" },
        purpose: "review",
        payload: null,
        traceId: "trace-1",
        createdAt: "2026-10-04T00:00:00.000Z",
      },
    }),
  ).rejects.toMatchObject({ code: "unsupported_protocol_version" });
});
