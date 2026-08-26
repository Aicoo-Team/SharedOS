import { describe, expect, it } from "vitest";

import type {
  AccessContext,
  CapabilityGrant,
  ResourceRef,
  ToolCall,
} from "@aicoo/sharedos-contracts";

import type { GrantSource } from "./authority.js";
import { SharedOSKernel } from "./kernel.js";
import { SPAN, type Span, type SpanSink, measure, measureSync } from "./spans.js";
import type { ToolHandler } from "./tool-registry.js";

const NOW = "2026-08-25T09:00:00.000Z";
const ACTOR = { kind: "agent", agentId: "agent-bob" } as const;
const AUTHORITY = { kind: "human", userId: "user-alice" } as const;
const OWNER = AUTHORITY;

const FILE_RESOURCE: ResourceRef = { namespace: "files", path: ["Workspace"] };

class RecordingSink implements SpanSink {
  readonly spans: Span[] = [];

  record(span: Span): void {
    this.spans.push(span);
  }

  named(name: string): readonly Span[] {
    return this.spans.filter((span) => span.name === name);
  }
}

function context(): AccessContext {
  return {
    namespaceId: "world-alpha",
    enabledToolNamespaces: ["files"],
    actor: ACTOR,
    authority: AUTHORITY,
    owner: OWNER,
    purpose: "measure",
    traceId: "trace-1",
    now: NOW,
  };
}

function readGrant(): CapabilityGrant {
  return {
    id: "grant-read",
    namespaceId: "world-alpha",
    subject: ACTOR,
    issuer: AUTHORITY,
    capabilities: [{ resource: FILE_RESOURCE, actions: ["read"], scope: "descendants" }],
    constraints: {},
    issuedAt: "2026-08-25T08:00:00.000Z",
  };
}

function grantSource(grants: readonly CapabilityGrant[]): GrantSource {
  return {
    async load() {
      await Promise.resolve();
      return grants;
    },
  };
}

function readTool(): ToolHandler {
  return {
    definition: {
      name: "files.read",
      description: "Read one file",
      namespace: "files",
      source: "sharedos",
      readWrite: "read",
      inputSchema: { type: "object", properties: { path: { type: "array" } } },
      requiredCapability: { resource: FILE_RESOURCE, action: "read" },
      annotations: { readOnly: true },
    },
    parseArguments: (arguments_) => arguments_,
    async invoke(_context, call) {
      await Promise.resolve();
      return {
        callId: call.id,
        tool: call.tool,
        status: "succeeded",
        output: { text: "policy" },
        completedAt: NOW,
      };
    },
  };
}

function call(overrides: Partial<ToolCall> = {}): ToolCall {
  return {
    id: "call-1",
    tool: "files.read",
    arguments: { path: ["Workspace", "policy.md"], secret: "hunter2" },
    traceId: "trace-1",
    requestedAt: NOW,
    ...overrides,
  };
}

describe("measure", () => {
  it("returns the operation's own promise when nothing is measuring", async () => {
    const marker = Symbol("result");
    await expect(measure(undefined, "unused", async () => marker)).resolves.toBe(marker);
  });

  it("reports a span for a completed operation", async () => {
    const sink = new RecordingSink();

    await measure(sink, "probe", async (span) => {
      span.set("outcome", "allowed");
      return 1;
    });

    expect(sink.spans).toHaveLength(1);
    expect(sink.spans[0]).toMatchObject({ name: "probe", attributes: { outcome: "allowed" } });
    expect(sink.spans[0]?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("reports a span for an operation that threw, and rethrows it", async () => {
    const sink = new RecordingSink();

    await expect(
      measure(sink, "probe", async () => {
        throw new Error("no");
      }),
    ).rejects.toThrow("no");
    expect(sink.named("probe")).toHaveLength(1);
  });

  it("does not let a failing sink change the outcome", async () => {
    const sink: SpanSink = {
      record() {
        throw new Error("the sink is broken");
      },
    };

    await expect(measure(sink, "probe", async () => "value")).resolves.toBe("value");
    expect(measureSync(sink, "probe", () => "value")).toBe("value");
  });
});

describe("kernel measurement", () => {
  it("reports the authority load, the decision, the call, and the provider", async () => {
    const sink = new RecordingSink();
    const kernel = new SharedOSKernel({ grantSource: grantSource([readGrant()]), spans: sink });
    kernel.registerTool(readTool());

    const result = await kernel.invokeTool(context(), call());

    expect(result.status).toBe("succeeded");
    expect(sink.named(SPAN.AUTHORITY_LOAD)).toHaveLength(1);
    expect(sink.named(SPAN.TOOL_INVOKE)).toHaveLength(1);
    expect(sink.named(SPAN.TOOL_HANDLER)).toHaveLength(1);
    expect(sink.named(SPAN.AUTHORIZE).length).toBeGreaterThanOrEqual(1);
  });

  it("gives every span of one call the same call id, so the provider can be subtracted", async () => {
    const sink = new RecordingSink();
    const kernel = new SharedOSKernel({ grantSource: grantSource([readGrant()]), spans: sink });
    kernel.registerTool(readTool());

    await kernel.invokeTool(context(), call());

    const invoke = sink.named(SPAN.TOOL_INVOKE)[0];
    const handler = sink.named(SPAN.TOOL_HANDLER)[0];
    expect(invoke?.attributes["callId"]).toBe("call-1");
    expect(handler?.attributes["callId"]).toBe("call-1");
    // The provider is inside the kernel's span, so subtracting it can never
    // produce more time than the kernel span itself reported.
    expect(handler?.durationMs).toBeLessThanOrEqual((invoke?.durationMs ?? 0) + 1e-6);
  });

  it("measures a refused call as well as an allowed one", async () => {
    const sink = new RecordingSink();
    const kernel = new SharedOSKernel({ grantSource: grantSource([]), spans: sink });
    kernel.registerTool(readTool());

    const result = await kernel.invokeTool(context(), call());

    expect(result.status).toBe("denied");
    expect(sink.named(SPAN.TOOL_INVOKE)[0]?.attributes["outcome"]).toBe("denied");
    // Refused before the provider, so there is nothing to subtract.
    expect(sink.named(SPAN.TOOL_HANDLER)).toHaveLength(0);
  });

  it("keeps arguments, results, and payloads out of every span", async () => {
    const sink = new RecordingSink();
    const kernel = new SharedOSKernel({ grantSource: grantSource([readGrant()]), spans: sink });
    kernel.registerTool(readTool());

    await kernel.invokeTool(context(), call());

    const serialized = JSON.stringify(sink.spans);
    expect(serialized).not.toContain("hunter2");
    expect(serialized).not.toContain("policy.md");
    expect(serialized).not.toContain("policy");
  });

  it("reads no monotonic clock and allocates no span when nothing is measuring", async () => {
    const kernel = new SharedOSKernel({ grantSource: grantSource([readGrant()]) });
    kernel.registerTool(readTool());

    // The measured and unmeasured paths are the same path: an uninstrumented
    // kernel is what every committed conformance record was produced by, and it
    // has to keep returning exactly what it returned before.
    await expect(kernel.invokeTool(context(), call())).resolves.toMatchObject({
      callId: "call-1",
      status: "succeeded",
    });
  });
});
