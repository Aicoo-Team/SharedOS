# SharedOS

SharedOS is a **permission-controlled agent-to-agent runtime**. It lets agents
communicate, access memory and workspace resources, and invoke built-in or
external tools without allowing a message—or a model—to grant itself authority.

SharedOS is more than a messaging protocol. It provides the reusable execution
and authorization layer beneath products such as Aicoo and experiment systems
such as PACT.

> **Project status:** initial architecture and contracts are under active
> development. Every workspace package is intentionally private: the `0.x`
> API is not published or production-ready yet.

## What belongs in SharedOS

- A deny-by-default permission kernel based on explicit capability grants.
- Structured agent identities, addresses, messages, namespaces, and traces.
- Agent-to-agent request and response dispatch.
- Memory and workspace resource contracts, including deterministic operations
  such as search, read, grep, append, and write.
- A registry for built-in OS capabilities and host-provided external or MCP
  tools.
- One permission-controlled agent turn, with provenance and audit events.
- Equivalent embedded-library and HTTP client boundaries over the same
  contracts.

SharedOS owns the **semantics and enforcement** of a memory capability. The host
owns the memory data, database, embeddings, credentials, and lifecycle. The same
rule applies to workspace resources and external tools.

SharedOS deliberately does not own product UI, accounts, billing, benchmark
tasks, gold labels, evaluators, or multi-tick experiment scheduling.

## Architecture at a glance

```mermaid
flowchart LR
  A["Aicoo product host"] --> E["Embedded SharedOS runtime"]
  P["PACT control plane"] --> X["SharedOS execution adapter"]
  X --> E
  H["HTTP client / service"] --> E
  E --> K["Permission kernel"]
  E --> R["One-turn execution"]
  K --> C["Capability contracts"]
  R --> C
  E --> HP["Host provider ports"]
  HP --> D["Host-owned memory, workspace, tools, models, and audit store"]
```

The dependency direction is always:

```text
Aicoo / PACT / another host  ->  SharedOS contracts and runtime
SharedOS                    -X->  host product internals
```

The SharedOS core must not import Next.js, Drizzle, Azure, Aicoo credits, or
PACT tasks, gold data, runners, and evaluators.

Read the complete [architecture](docs/architecture.md),
[permission model](docs/security/permission-model.md), and
[threat model](docs/security/threat-model.md).

## Packages

| Package               | Responsibility                                               |
| --------------------- | ------------------------------------------------------------ |
| `@sharedos/contracts` | JSON-safe protocol types, schemas, and stable identifiers    |
| `@sharedos/core`      | Deterministic authorization, routing, and dispatch decisions |
| `@sharedos/os`        | Standard memory/workspace operations and guarded OS tools    |
| `@sharedos/runtime`   | One permission-controlled agent turn over host providers     |
| `@sharedos/client`    | Typed client for a remote SharedOS HTTP boundary             |
| `@sharedos/http`      | Transport adapter over the same runtime and contracts        |
| `@sharedos/testkit`   | In-memory providers and conformance helpers for tests        |

`testkit` is not a production persistence layer. Production state remains in
the host.

## Integration modes

**Embedded library — recommended for Aicoo.** Aicoo keeps authentication,
billing, UI, and its existing persistence. It implements SharedOS provider
ports, then calls the runtime in-process. See the
[Aicoo integration guide](docs/integrations/aicoo.md).

**Execution adapter — recommended for PACT.** PACT creates an isolated world and
asks SharedOS to execute one turn at a time. PACT remains responsible for tick
order, budgets, stopping, snapshots, judges, metrics, and artifacts. See the
[PACT integration guide](docs/integrations/pact.md).

**HTTP boundary.** Deployments that cannot embed the runtime can expose the same
contracts through `@sharedos/http` and consume them with `@sharedos/client`.
Transport authentication establishes the caller; it does not replace capability
authorization.

## Security invariants

1. No matching grant means deny.
2. A message carries intent and context, never authority.
3. Tool discovery is filtered, and every invocation is authorized again.
4. Invoking a target agent requires its own recipient-scoped execution grant.
5. Reads, writes, messages, and external calls use the same capability model.
6. Resource, action, purpose, expiry, actor, authority, namespace, and trace are
   retained in authorization and audit decisions.
7. The model sees a sanitized context, never grants or issuing authority.
8. A host adapter cannot silently widen the authority evaluated by the core.

## Local quickstart

The packages are not available from npm yet. Run the workspace example from a
local clone:

```bash
pnpm install
pnpm example:quickstart
```

The example executes one Bob → Alice turn, consumes an explicit Alice execution
grant, filters the visible tool catalog, then authorizes an exact memory search.
See [`examples/quickstart`](examples/quickstart/src/index.ts).

## Development

Requirements: Node.js 20.11 or newer and pnpm 9.15.

```bash
pnpm install
pnpm check
```

The repository is a TypeScript workspace. Public contracts must stay JSON-safe,
and permission changes require tests for both allowed and denied paths. See
[CONTRIBUTING.md](CONTRIBUTING.md) before proposing a change.

Public release is deliberately gated on the items in
[release readiness](docs/release-readiness.md), including a license decision,
npm scope ownership, durable replay/idempotency, and security contact setup.

## Architecture decisions

- [ADR 0001: Library-first runtime](docs/adr/0001-library-first-runtime.md)
- [ADR 0002: Host-owned storage](docs/adr/0002-host-owned-storage.md)
- [ADR 0003: Scheduler boundary](docs/adr/0003-scheduler-boundary.md)

## License

No license has been declared yet. Until one is added, no permission is granted
to copy, modify, or redistribute this code outside the repository owner's
authorization.
