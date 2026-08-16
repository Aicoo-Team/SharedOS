# @sharedos/runtime

A fixed permission envelope with standard and replaceable one-turn agent
runtimes.

```bash
npm install @sharedos/runtime@next
```

SharedOS is runtime-agnostic, not runtime-less. The package exports two layers:

- `SharedOSExecutor` validates and admits a turn, exposes only authorized tools,
  rechecks every exact call, applies cancellation, and records runtime
  provenance. Runtime plugins cannot replace this layer.
- `RuntimePlugin` owns the agent loop inside that envelope. `StandardRuntime` is
  the included reference implementation over `AgentTurnDriver`.

## Standard runtime

```ts
import { SharedOSExecutor, StandardRuntime } from "@sharedos/runtime";

const runtime = new StandardRuntime(agentDriver);
const turns = new SharedOSExecutor(kernel, runtime, {
  defaultMaxSteps: 16,
  defaultMaxToolCalls: 16,
  defaultTimeoutMs: 120_000,
});

const result = await turns.execute(executionRequest);
```

The original API remains available as a compatibility shorthand:

```ts
import { TurnExecutor } from "@sharedos/runtime";

const turns = new TurnExecutor(kernel, agentDriver);
```

## Custom runtime

```ts
import type { RuntimePlugin } from "@sharedos/runtime";

const codexRuntime: RuntimePlugin = {
  manifest: {
    id: "acme.codex",
    version: "1.0.0",
    protocolVersion: "1",
    metadata: { harness: "codex", backend: "vercel-sandbox" },
  },
  async run(request, host, signal) {
    // Translate the harness's native tool definitions to request.tools.
    // Every implementation must route actual effects through this broker.
    const result = await host.invokeTool({
      id: crypto.randomUUID(),
      tool: "files.search",
      arguments: { path: ["Projects"], query: "status" },
      traceId: request.context.traceId,
      requestedAt: request.context.now,
    });

    signal.throwIfAborted();
    return { type: "complete", output: { toolStatus: result.status } };
  },
};

const turns = new SharedOSExecutor(kernel, codexRuntime);
```

Embedded hosts can observe events as they are emitted without giving the plugin
an authoritative event channel:

```ts
await turns.execute(executionRequest, {
  signal,
  onEvent: (event) => streamController.enqueue(event),
});
```

The callback receives a frozen snapshot. Callback failure does not replace the
turn's protocol outcome; cancel the supplied signal when the consumer closes.

A plugin receives a frozen `RuntimeTurnRequest` without grants, issuing
authority, or namespace-management state. Its `RuntimeHost` contains only:

- effective step, tool-call, and deadline limits;
- `invokeTool`, which checks the visible catalog and then re-authorizes through
  the kernel;
- `emit`, which records plugin observations as wrapped `runtime.event` events.

The broker closes when `run` returns. A plugin cannot use a retained host handle
for later tool calls or emit authoritative `turn.*` and `tool.*` events.

## Trusted selection

`RuntimeRegistry` is an instance-scoped registry for trusted boot
configuration:

```ts
const runtimes = new RuntimeRegistry([new StandardRuntime(agentDriver), codexRuntime]);
const runtime = runtimes.resolve(serverPolicy.runtimeId);
const turns = new SharedOSExecutor(kernel, runtime);
```

Do not resolve a runtime id directly from a message, model output, or unverified
request metadata. In-process plugins have the ambient privileges of the host;
isolate third-party runtimes behind a process, container, microVM, or remote
adapter.

Product heartbeats, multi-turn retries, adaptive routing, benchmark scheduling,
and network-level stopping remain host responsibilities.

SharedOS is currently an `0.x` prerelease.
