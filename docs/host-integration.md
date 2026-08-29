# Host integration guide

This guide is for a product or benchmark that wants to run agents through
SharedOS. It describes the production boundary; the complete executable example
is in [`examples/quickstart`](../examples/quickstart/src/index.ts).

## What you are integrating

SharedOS is the permission and one-turn execution layer between an agent and the
state it wants to use. A host keeps its existing product, storage, model
provider, credentials, and scheduler, then supplies those capabilities through
SharedOS ports.

```text
host identity + policy + state
             |
             v
     trusted AccessContext
             |
             v
 SharedOS kernel + TurnExecutor
      |                 |
      v                 v
 files / live tools   agent driver
```

SharedOS does not become the source of truth for users or data. It owns the
portable contracts and the decision that a particular actor may perform a
particular action for a particular purpose. The host owns the facts used to
construct that decision.

## Current package status

The intended one-install entry point is `@aicoo/sharedos`, with individual
`@aicoo/sharedos-*` packages available for hosts that need a smaller dependency
surface. The packages are public `0.x` prereleases under npm's `next` dist-tag;
the contracts are not yet stable or production-hardened.

For development, clone this repository and either use workspace dependencies or
create verified local tarballs:

```bash
pnpm install
pnpm pack:preview
```

The tarballs are written to `artifacts/npm/`. Public consumers install the
explicit prerelease tag with `npm install @aicoo/sharedos@next`; the remaining
production gates are tracked in [release readiness](release-readiness.md).

## Choose an integration shape

### Embedded runtime

Use the packages in the host process. This is the preferred shape for products
that already own transactions, persistence, and model calls.
There is no extra network hop, and the host can implement providers directly
over its existing services.

### Remote runtime

Expose the same kernel through `@aicoo/sharedos-http` and call it with
`@aicoo/sharedos-client`. Use this when process or language isolation matters more
than the additional deployment boundary. Transport authentication identifies
the caller; it does not replace SharedOS capability authorization.

Evaluation harnesses use a third, related shape: the runner owns the experiment
loop and calls an embedded or remote SharedOS adapter once per tick. SharedOS
still executes only one bounded turn.

## Embedded integration, step by step

### 1. Resolve a trusted access context

For every request, the host resolves identity, namespace settings, and time from
trusted server-side state. An access context carries no authority:

```ts
import type { AccessContext } from "@aicoo/sharedos";

const context: AccessContext = {
  namespaceId: "tenant-acme",
  actor: { kind: "agent", agentId: "researcher" },
  authority: { kind: "human", userId: "owner-1" },
  owner: { kind: "human", userId: "owner-1" },
  purpose: "prepare-investor-update",
  traceId: crypto.randomUUID(),
  enabledToolNamespaces: ["files", "calendar"],
  now: new Date().toISOString(),
};
```

Do not deserialize an `AccessContext` supplied by a model, message payload, or
untrusted client and treat it as trusted identity. In particular:

- `actor` is the principal performing the operation;
- `authority` is the issuer whose grants are being exercised;
- `owner` scopes the target resources;
- `namespaceId` isolates the tenant or benchmark world;
- `purpose`, time, expiry, and usage limits participate in authorization;
- `enabledToolNamespaces` comes from host-owned settings.

### 1b. Implement the trusted grant source

Authority enters SharedOS only through a `GrantSource`, which every kernel
requires. The kernel calls it once per turn, so a grant _revoked_ while a turn is
running is observed by the next turn. A grant that _expires_ while a turn is
running is refused inside it: the expiry is already on the grant the turn holds,
so honouring it needs no second load. See
`docs/adr/0016-expiry-is-instant-bound.md`.

```ts
import type { GrantSource } from "@aicoo/sharedos";

const grantSource: GrantSource = {
  async load(access, signal) {
    // Answer from the issuing store, never from anything the caller supplied.
    return grantStore.activeGrantsFor(
      {
        namespaceId: access.namespaceId,
        subject: access.actor,
        issuer: access.authority,
      },
      { signal },
    );
  },
};
```

The contract is narrow on purpose:

- return only grants issued to `access.actor` by `access.authority` inside
  `access.namespaceId`; anything else is treated as an unavailable source, not
  as partial authority;
- apply the host ceiling here. Product or organization policy that reduces an
  actor's authority is expressed by not returning the grant it forbids (and by
  not enabling the namespaces it forbids); SharedOS applies no policy of its
  own on top of what the source returns;
- return material that satisfies `CapabilityGrantSchema`, including signature or
  revocation verification the host requires;
- throw when the store is unreachable. SharedOS converts that into a fail-closed
  `authority_unavailable` denial and never falls back to a cached set.

A host that issues delegated grants also installs a `DelegationChainResolver`
so ancestors can be re-resolved; see
`docs/adr/0008-delegation-chain-validation.md`.

### 2. Adapt host state to the `files` resource plane

SharedOS uses one canonical `files` namespace. Memory, workspace, identity,
history, raw evidence, and curated knowledge are roles or roots inside that
file tree—not separate permission systems.

Implement `ResourceProvider` over the host's existing storage:

```ts
import type { ResourceProvider } from "@aicoo/sharedos";

const files: ResourceProvider = {
  namespace: "files",
  async invoke(operation, signal) {
    signal.throwIfAborted();
    return hostFiles.invoke({
      namespaceId: operation.context.namespaceId,
      owner: operation.resource.owner ?? operation.context.owner,
      path: operation.resource.path,
      action: operation.action,
      input: operation.input,
      signal,
    });
  },
};
```

The provider maps SharedOS actions onto host behavior:

| Read surface                             | Mutation surface                        | Recovery surface                                       |
| ---------------------------------------- | --------------------------------------- | ------------------------------------------------------ |
| `list`, `stat`, `read`, `search`, `grep` | `create`, `replace`, `append`, `delete` | `snapshot:create`, `snapshot:list`, `snapshot:restore` |

The provider must preserve tenant isolation, canonicalize paths beneath its
configured root, reject symlink or traversal escapes, implement version checks
for concurrent writes, and return JSON-safe `ResourceResult` values. Search
indexes and model context mounts must preserve the grants of their source files.

### 3. Build the kernel and register file tools

```ts
import { CapabilityAuthorizer, SharedOSKernel, registerStandardOsTools } from "@aicoo/sharedos";

const kernel = new SharedOSKernel({
  grantSource,
  authorizer: new CapabilityAuthorizer({
    usageStore: durableGrantUsageStore,
    grantVerifier: durableGrantVerifier,
  }),
  audit: durableAuditSink,
  toolNamespaceSettings,
  toolProviders: [userMcpToolProvider],
  // Durable host ports. The router returns only a reply accepted from the
  // run's message log; it does not fabricate an envelope from model output.
  messageTransport: durableMessageLog,
  messageRequestRouter: durableReplyRouter,
  createMessageId: () => crypto.randomUUID(),
});

kernel.registerResourceProvider(files);
registerStandardOsTools(kernel, { files });
```

Registering the provider enables direct resource operations. Registering the
standard tools exposes the same operations as model-callable tools such as
`files.search` and `files.append`. Neither registration grants access.

The in-memory stores from `@aicoo/sharedos-testkit` are useful for tests and
isolated experiment worlds. They are not production persistence.

When both message ports are configured, the kernel adds the canonical
`messages.request` tool to each effective turn catalog. Enable the `messages`
tool namespace and issue a recipient-scoped `sharedos.messaging` + `send`
grant. The model supplies only `recipient` and JSON-safe `payload`; SharedOS
copies sender, purpose, trace, timestamp, and message id from trusted context,
consumes the exact send capability once, and validates the correlated reply.

The transport and router do not make SharedOS a scheduler. After durable
acceptance, the host wakes the recipient and invokes another SharedOS turn with
the recipient as both `context.actor` and `request.agent`. That recipient needs
its own `sharedos.execution` + `invoke` grant and its own file or tool grants.
The reply is another authorized envelope whose `replyTo` names the immutable
request id.

### 4. Grant the minimum authority

A grant binds subject, issuer, namespace, purpose, time constraints, resource
scope, and actions. For example, this capability allows semantic search below
one project root, but does not allow reading another root or changing a file:

```ts
const projectSearch = {
  resource: {
    namespace: "files",
    path: ["Work", "Projects", "sharedos"],
    owner: { kind: "human", userId: "owner-1" },
  },
  actions: ["search"],
  scope: "descendants",
} as const;
```

Invoking the target agent is a separate capability. Use
`agentExecutionCapability(targetAgent, owner)` when issuing that grant. A
message addressed to the target agent is never sufficient by itself.

### 5. Add native, connector, or MCP tools

Live systems such as calendar, email, GitHub, and Notion remain tools because
their state must be observed—or changed—at execution time. The host owns OAuth,
credentials, MCP connections, and the implementation of each `ToolHandler`.

Use `kernel.registerTool` for static, process-wide tools. Use a
`ContextToolProvider` for user-specific or dynamically discovered catalogs so
one user's MCP reload cannot mutate another user's tool registry.

Every tool declares:

- a globally stable tool name, such as `notion.search`;
- a logical namespace, such as `notion`;
- a source, such as `native` or `mcp`;
- a conservative read/write classification;
- an input schema;
- a capability ceiling for discovery;
- preferably, `resolveRequirement`, which derives the exact resource and action
  from validated call arguments immediately before invocation.

A Notion MCP connection can therefore be mounted safely, but connecting it and
authorizing it are different operations. A typical search call is usable only
when all of the following are true:

```text
the host registered this user's Notion handler
AND the `notion` namespace is enabled
AND a matching `notion` resource/action grant exists
AND the exact argument-selected page or database is still authorized
```

For example, the host can grant search on one database without granting page
updates. Similarly, a calendar namespace can expose free/busy reads while event
details, event creation, and event deletion remain separately scoped actions.

### 6. Select a runtime and execute exactly one bounded turn

For the reference loop, the host implements `AgentTurnDriver`, wraps it in
`StandardRuntime`, and places that plugin inside `SharedOSExecutor`:

```ts
import { SharedOSExecutor, StandardRuntime } from "@aicoo/sharedos";

const runtime = new StandardRuntime(agentDriver);
const turns = new SharedOSExecutor(kernel, runtime, {
  defaultMaxSteps: 16,
  defaultMaxToolCalls: 16,
  defaultTimeoutMs: 120_000,
});

const visibleTools = await kernel.listTools(context);
const result = await turns.execute({
  version: "1",
  executionId: crypto.randomUUID(),
  agent: targetAgent,
  context,
  message,
  tools: [...visibleTools],
});
```

For an inbound Bob → Alice message, `targetAgent` and `context.actor` are both
Alice. The envelope sender remains Bob for provenance; it is not the actor whose
grants are used by Alice's turn. Purpose and trace must match the trusted
recipient context.

`TurnExecutor(kernel, agentDriver)` remains a compatibility shorthand for this
standard composition.

To install a complete Codex, DeepSeek, or private harness, implement
`RuntimePlugin` and register it from trusted host configuration:

```ts
import { RuntimeRegistry, SharedOSExecutor } from "@aicoo/sharedos";

const runtimes = new RuntimeRegistry([standardRuntime, codexRuntime, deepseekRuntime]);
const runtime = runtimes.resolve(serverPolicy.runtimeId);
const turns = new SharedOSExecutor(kernel, runtime);
```

Do not resolve `runtimeId` directly from a message, model output, or unverified
request metadata. A runtime receives a frozen, sanitized context without grants
or issuing authority. The envelope admits the target-agent invocation, filters
discovery, and re-authorizes every exact tool call through `RuntimeHost`. A turn
ends when the runtime completes or fails, the deadline expires, or the host
cancels it. The standard runtime additionally enforces its driver step limit.

SharedOS does not decide when an entire agent network is complete. Runtime
coordination, adaptive routing, retries, budgets, and network-level stopping
belong to the host scheduler, which may invoke another bounded turn after
examining the result and events.

## Why namespace enablement is not permission

Tool availability has three independent gates:

```text
usable tool = registered for this context
              AND namespace enabled
              AND capability allowed
```

Namespace settings are the product control plane: they answer whether a family
of tools should appear in this context. Capabilities are the authority plane:
they answer which exact resources and actions the actor may use. SharedOS
filters discovery and checks invocation again so neither a stale catalog nor a
model-authored call can bypass the second gate.

If the product allows users to change namespace settings, implement
`ToolNamespaceSettingsStore.applyUpdate` as an atomic update over fresh state.
The store may narrow a request according to organization policy, but must not
widen it.

## Remote integration

On the server, wrap the same kernel and turn executor:

```ts
import { createKernelSharedOSApi, createSharedOSHandler } from "@aicoo/sharedos";

const api = createKernelSharedOSApi({ kernel, turns });
const handle = createSharedOSHandler({
  api,
  resolveContext: async (request) => resolveTrustedContextFromSession(request),
});
```

On the caller, use `SharedOSClient`. It has one method per route and
validates every response against the same schema the server used:

```ts
import { SharedOSClient } from "@aicoo/sharedos";

const sharedos = new SharedOSClient({
  baseUrl: "https://sharedos.internal.example",
  // A value, or an async function so a short-lived token is minted per call.
  headers: async () => ({ authorization: `Bearer ${await serviceIdentityToken()}` }),
});
```

The HTTP server must derive `AccessContext` from authenticated server-side
state. Never accept the authorization context from the remote JSON body.

Every route, request shape, and status code is listed in the
[HTTP API reference](http-api.md).

## Production responsibilities that remain in the host

Before production use, the host must provide:

- authenticated identity and tenant resolution;
- a durable `GrantSource`, revocation verification, and atomic bounded-grant
  usage;
- isolated file and tool providers with cancellation-safe side effects;
- durable tool namespace settings and credential isolation;
- durable, append-only audit storage and operational alerting;
- replay and idempotency controls around externally visible mutations;
- model-driver limits, product scheduling, retries, budgets, and stopping;
- consent, policy administration, retention, deletion, and incident response.

See the [permission model](security/permission-model.md) and
[threat model](security/threat-model.md) before exposing writes or external
tools.

## Adoption checklist

1. Select embedded or remote deployment and record the SharedOS version.
2. Map product identities to structured addresses and choose the world or
   tenant `namespaceId` boundary.
3. Implement the trusted `AccessContext` resolver.
4. Adapt existing knowledge and working state to one `files` provider.
5. Register built-in, native, and context-specific MCP tools.
6. Persist enabled tool namespaces independently from grants.
7. Issue least-authority grants, including a separate target-agent invocation
   grant.
8. Select a trusted `RuntimePlugin`; use `StandardRuntime` with a bounded
   `AgentTurnDriver` when the reference loop is sufficient.
9. Add allowed and denied conformance tests for every permission-bearing path.
10. Record runtime id/version separately from model and execution backend, and
    keep network scheduling outside SharedOS.
11. Run `pnpm check` and test cancellation, replay, revocation, audit failure,
    broker closure, and tenant isolation before enabling production writes.

Host-specific mappings live outside this guide: they depend on how your product
already models storage, identity, and tools.
