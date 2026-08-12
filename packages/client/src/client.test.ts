import { describe, expect, it, vi } from "vitest";

import { SharedOSClient, SharedOSClientError } from "./index.js";

describe("SharedOSClient", () => {
  it("adds authentication and purpose without putting grants in the body", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (_input, init) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("authorization")).toBe("Bearer secret");
      expect(headers.get("x-sharedos-purpose")).toBe("prepare-report");
      expect(init?.body).toBeUndefined();

      return Response.json([]);
    });

    const client = new SharedOSClient({
      baseUrl: "https://sharedos.test/",
      token: "secret",
      fetch,
    });
    await client.listTools({ purpose: "prepare-report" });

    expect(fetch).toHaveBeenCalledWith(
      "https://sharedos.test/v1/tools",
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
        { status: 403 },
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
      fetch: async () => Response.json([{ name: "files.search" }]),
    });

    await expect(client.listTools()).rejects.toMatchObject({
      code: "invalid_response",
      status: 200,
    });
  });
});
