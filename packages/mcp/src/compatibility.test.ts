import { describe, expect, it, vi } from "vitest";
import type { SharedOSToolCatalog } from "@aicoo/sharedos-contracts";
import { McpToolServer, toCallToolResult, type McpToolInvoker } from "./server.js";

function fixture(version = "2") {
  const invoker: McpToolInvoker = {
    catalog: vi.fn(
      async () =>
        ({
          version,
          executionId: "turn-1",
          catalogHash: "a".repeat(64),
          tools: [],
        }) as unknown as SharedOSToolCatalog,
    ),
    invoke: vi.fn(async () => ({
      callId: "call-1",
      tool: "files.read",
      status: "succeeded" as const,
      output: null,
      completedAt: "2026-10-04T00:00:00.000Z",
    })),
  };
  const server = new McpToolServer({ invoker });
  const request = (method: string, params: unknown = {}) =>
    server.handle(
      {
        jsonrpc: "2.0",
        id: "request-1",
        method,
        params,
      },
      new AbortController().signal,
    );
  return { invoker, request };
}

describe("MCP protocol compatibility", () => {
  it("keeps the MCP revision independent and advertises the SharedOS epoch", async () => {
    const { request } = fixture();
    expect(
      await request("initialize", {
        protocolVersion: "2024-11-05",
        _meta: { "sharedos/protocolVersion": "2" },
      }),
    ).toMatchObject({
      result: {
        protocolVersion: "2024-11-05",
        _meta: { "sharedos/protocolVersion": "2" },
      },
    });
    expect(await request("tools/list")).toMatchObject({
      result: { tools: [], _meta: { "sharedos/protocolVersion": "2" } },
    });
  });

  it.each(["initialize", "tools/call"])(
    "rejects an unsupported %s pin before reaching the invoker",
    async (method) => {
      const { request, invoker } = fixture();
      const response = await request(method, {
        name: "files.read",
        _meta: { "sharedos/protocolVersion": "1" },
      });
      expect(response).toMatchObject({
        error: {
          code: -32602,
          message: expect.stringContaining('supported version is "2"'),
          data: { code: "unsupported_protocol_version", supportedVersion: "2" },
        },
      });
      expect(invoker.catalog).not.toHaveBeenCalled();
      expect(invoker.invoke).not.toHaveBeenCalled();
    },
  );

  it.each(["tools/list", "tools/call"])("rejects an older catalogue during %s", async (method) => {
    const { request, invoker } = fixture("1");
    expect(await request(method, { name: "files.read" })).toMatchObject({
      error: { data: { code: "unsupported_protocol_version" } },
    });
    expect(invoker.invoke).not.toHaveBeenCalled();
  });

  it("stamps successful and refused tool results without changing their meaning", () => {
    const base = { callId: "call-1", tool: "files.read", completedAt: "2026-10-04T00:00:00.000Z" };
    expect(toCallToolResult({ ...base, status: "succeeded", output: null })).toMatchObject({
      isError: false,
      _meta: { "sharedos/protocolVersion": "2" },
    });
    expect(
      toCallToolResult({
        ...base,
        status: "denied",
        error: { code: "permission_denied", message: "Denied" },
      }),
    ).toMatchObject({
      isError: true,
      _meta: { "sharedos/protocolVersion": "2", "sharedos/status": "denied" },
    });
  });
});
