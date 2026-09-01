import type {
  AccessContext,
  SharedOSToolCatalog,
  ToolCall,
  ToolDefinition,
  ToolResult,
} from "@aicoo/sharedos-contracts";
import { buildToolCatalog } from "@aicoo/sharedos-core";

import type { McpToolInvocation, McpToolInvoker } from "./server.js";

/**
 * The effectful surface a bridge is allowed to reach.
 *
 * Structurally satisfied by `RuntimeHost`, which is the intended binding: a
 * bridge opened inside a turn puts every `tools/call` through the execution
 * envelope, so the call is counted against the turn's budgets, checked against
 * the effective catalogue, and re-authorized by the kernel -- the same path a
 * native runtime's calls take, with no second enforcement path added for MCP.
 *
 * Declared structurally rather than imported so this package does not depend on
 * the runtime package. The dependency would be harmless; the absence is the
 * point, because it makes it impossible for a bridge to reach any part of the
 * turn machinery other than the one method that re-authorizes.
 */
export interface BridgeToolInvoker {
  invokeTool(call: ToolCall, options?: { readonly step?: number }): Promise<ToolResult>;
}

/** What the bridge needs of the turn's sanitised context: identity, not authority. */
export interface BridgeTurnContext {
  readonly traceId: string;
  readonly now: string;
}

/** One harness-side rewrite, kept for diagnosis and never for authorization. */
export interface ToolAliasRecord {
  readonly alias: string;
  readonly tool: string;
  readonly at: string;
}

export interface OpenToolBridgeOptions {
  readonly executionId: string;
  readonly context: BridgeTurnContext;
  /** The permission-filtered catalogue this turn resolved. */
  readonly tools: readonly ToolDefinition[];
  readonly host: BridgeToolInvoker;
  /**
   * Position in the harness's own loop, when the transport can report one.
   * Neither caller passes it today, so an MCP-mediated call declares no step and
   * is bounded by `maxToolCalls` alone; see `docs/open-items.md`.
   */
  readonly step?: number;
}

/**
 * A turn-scoped MCP tool broker.
 *
 * The lifecycle is the whole design. `ContextToolProvider` exists so one user's
 * MCP catalogue never mutates a registry shared with concurrent users, and this
 * carries that invariant across the harness boundary: the catalogue is computed
 * for one `AccessContext`, exposed for the length of one turn, and torn down
 * with it. There is no long-lived SharedOS MCP server holding a union of every
 * user's tools, because such a server would have to re-derive who is asking on
 * every call, and would be wrong once.
 *
 * After {@link close}, the bridge answers nothing. A harness process that
 * outlives its turn -- and they do, on cancellation and on timeout -- finds a
 * door that is shut rather than one that still opens onto a turn that has ended.
 */
export class SharedOSToolBridge implements McpToolInvoker {
  readonly #executionId: string;
  readonly #context: BridgeTurnContext;
  readonly #host: BridgeToolInvoker;
  readonly #tools: readonly ToolDefinition[];
  readonly #step: number | undefined;
  readonly #aliases: ToolAliasRecord[] = [];
  #catalog: Promise<SharedOSToolCatalog> | undefined;
  #closed = false;

  constructor(options: OpenToolBridgeOptions) {
    this.#executionId = options.executionId;
    this.#context = options.context;
    this.#host = options.host;
    this.#tools = [...options.tools];
    this.#step = options.step;
  }

  /**
   * Names the harness rewrote, in the order they were seen.
   *
   * Carried here rather than on the `ToolCall` so it is structurally impossible
   * for an alias to reach the kernel. A host that wants the diagnostic detail in
   * its execution record reads it from the bridge afterwards; nothing on the
   * authorization path can read it at all.
   */
  get aliases(): readonly ToolAliasRecord[] {
    return [...this.#aliases];
  }

  get closed(): boolean {
    return this.#closed;
  }

  async catalog(signal: AbortSignal): Promise<SharedOSToolCatalog> {
    this.#assertOpen(signal);
    // Computed once. A catalogue that could change between `tools/list` and
    // `tools/call` would make `catalogHash` a claim about a moment rather than
    // about the turn.
    this.#catalog ??= buildToolCatalog(this.#tools, { executionId: this.#executionId });
    return this.#catalog;
  }

  async invoke(invocation: McpToolInvocation, signal: AbortSignal): Promise<ToolResult> {
    this.#assertOpen(signal);
    if (invocation.alias !== undefined) {
      this.#aliases.push({
        alias: invocation.alias,
        tool: invocation.tool,
        at: this.#context.now,
      });
    }

    const call: ToolCall = {
      id: invocation.callId,
      tool: invocation.tool,
      arguments: invocation.arguments,
      traceId: this.#context.traceId,
      requestedAt: this.#context.now,
    };
    return this.#host.invokeTool(call, this.#step === undefined ? {} : { step: this.#step });
  }

  close(): void {
    this.#closed = true;
  }

  #assertOpen(signal: AbortSignal): void {
    if (signal.aborted) {
      throw signal.reason ?? new Error("the MCP bridge request was aborted");
    }
    if (this.#closed) {
      throw new Error("the SharedOS MCP bridge closed with its turn");
    }
  }
}

/** Open a turn-scoped bridge over the execution envelope. */
export function openToolBridge(options: OpenToolBridgeOptions): SharedOSToolBridge {
  return new SharedOSToolBridge(options);
}

/** The kernel surface a bridge needs when it is not running inside a turn. */
export interface BridgeKernel {
  listPublishedTools(
    context: AccessContext,
    options: { readonly signal?: AbortSignal; readonly executionId: string },
  ): Promise<SharedOSToolCatalog>;
  invokeTool(
    context: AccessContext,
    call: ToolCall,
    options?: { readonly signal?: AbortSignal },
  ): Promise<ToolResult>;
}

export interface KernelToolBridgeOptions {
  readonly kernel: BridgeKernel;
  /** The trusted context. Never built from anything the harness sent. */
  readonly context: AccessContext;
  readonly executionId: string;
}

/**
 * A bridge that goes straight to the kernel, for a host serving MCP outside a
 * turn.
 *
 * Every kernel guarantee still holds: discovery is filtered, and each call is
 * re-authorized against the arguments presented. What is absent is the
 * envelope -- no step or tool-call budget, and no execution event stream -- so a
 * turn's evidence cannot be assembled from a session served this way. Use
 * {@link openToolBridge} inside a turn; use this to expose a catalogue to a
 * long-running harness the host is supervising by other means.
 */
export function kernelToolBridge(options: KernelToolBridgeOptions): McpToolInvoker {
  const { kernel, context, executionId } = options;
  return {
    catalog: (signal) => kernel.listPublishedTools(context, { signal, executionId }),
    invoke: (invocation, signal) =>
      kernel.invokeTool(
        context,
        {
          id: invocation.callId,
          tool: invocation.tool,
          arguments: invocation.arguments,
          traceId: context.traceId,
          requestedAt: context.now,
        },
        { signal },
      ),
  };
}
