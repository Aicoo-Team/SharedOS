# SharedOS

SharedOS is a **permission-controlled state and delegation kernel with a
pluggable execution layer for agents**. It lets agents communicate, access
files, and invoke built-in or external tools without allowing a message—or a
model—to grant itself authority.

SharedOS is more than a messaging protocol. It provides the reusable execution
and authorization layer beneath agent products and agent evaluation systems
alike.

> **Project status:** initial architecture and contracts are under active
> development. SharedOS is distributed as a `0.x` prerelease under npm's
> `next` tag; the API is not stable or production-hardened yet.

## Why SharedOS is more than messaging

Cross-boundary agent requests ultimately target state: facts to retrieve, state
changes to perform, or understanding to carry into future work. That state has
two operational forms:

| Access surface   | What it represents                                                                        | SharedOS control                                                  |
| ---------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Knowledge access | Accumulated understanding such as project context, identity, decisions, plans, and memory | `files` capabilities over explicit paths and actions              |
| Live tool access | Transient state and external side effects such as calendar, email, APIs, records, and MCP | Tool namespace enablement plus exact resource/action capabilities |

Transient information must be observed at request time. Calendar availability,
inbox contents, and the current status of an external record remain behind live
tools because a copied answer can immediately become stale. Accumulated
understanding is different: it develops across interactions and should remain
inspectable, searchable, editable, snapshotable, and governable.

SharedOS therefore adopts **file-as-memory** for accumulated understanding.
Memory is not a second opaque store with separate authority. It is a role over
authorized files, and agents are expected to distill knowledge into the file
tree. Memory, workspace, identity, history, and curated knowledge can occupy
different paths or mounted views, but they retain one file identity and one
permission model. Derived indexes and context mounts must preserve the grants
of their source files.

A live tool result becomes durable SharedOS knowledge only when an agent
distills it into a file. Reading the source tool and creating, replacing, or
appending that file are separate permission decisions; authority does not
transfer implicitly between them.

This gives every agent relationship two independently partitionable capability
sets:

1. **File capabilities:** which accumulated knowledge the other agent may list,
   search, read, create, replace, append, delete, or snapshot.
2. **Tool capabilities:** which live systems, accounts, resources, and actions
   the other agent may use. Tool namespace selection is an additional coarse
   availability gate, never authority by itself.

A colleague can therefore search one project subtree and read only calendar
free/busy information without seeing personal knowledge or sending email. A
different delegate can share the same files while receiving a narrower—or
broader—tool surface. Messages coordinate the work, but they grant neither kind
of access.

## What belongs in SharedOS

- A deny-by-default permission kernel based on explicit capability grants.
- Structured agent identities, addresses, messages, namespaces, and traces.
- Agent-to-agent request and response dispatch.
- A canonical `files` resource contract, including deterministic operations
  such as list, read, search, grep, create, replace, append, delete, and snapshot.
- A registry for built-in OS capabilities and host-provided external or MCP
  tools.
- A default-off tool namespace control plane with context-specific catalogs,
  host-owned settings, and discovery/invocation enforcement.
- One permission-controlled agent turn, with a standard runtime, a replaceable
  runtime-plugin contract, provenance, and audit events.
- Equivalent embedded-library and HTTP client boundaries over the same
  contracts.

SharedOS owns the **semantics and enforcement** of file capabilities. The host
owns the files, notes, folders, indexes, embeddings, credentials, and lifecycle.
Memory is a role or mounted view of authorized files, never a second authority
or storage namespace.

SharedOS deliberately does not own product UI, accounts, billing, benchmark
tasks, gold labels, evaluators, or multi-tick experiment scheduling.

## Architecture at a glance

```mermaid
flowchart LR
  A["Product host"] --> E["Embedded SharedOS runtime"]
  P["Evaluation control plane"] --> X["SharedOS execution adapter"]
  X --> E
  H["HTTP client / service"] --> E
  E --> K["Fixed security envelope"]
  K --> R["RuntimePlugin"]
  R --> RS["Standard runtime"]
  R --> RC["Harness runtimes: Codex, Claude Code, DeepSeek Harness, Pi"]
  R --> RD["Model-API or custom runtime"]
  K --> PK["Permission kernel"]
  PK --> C["Capability contracts"]
  K --> C
  E --> HP["Host provider ports"]
  HP --> D["Host-owned files, indexes, tools, models, and audit store"]
```

The dependency direction is always:

```text
Any host product or harness  ->  SharedOS contracts and runtime
SharedOS                    -X->  host product internals
```

The SharedOS core must not import a host's web framework, ORM, cloud SDK, credit
accounting, benchmark tasks, gold data, runners, or evaluators.

Read the practical [host integration guide](docs/host-integration.md), the
generated [package API reference](docs/api/README.md), the complete
[architecture](docs/architecture.md),
[permission model](docs/security/permission-model.md), and
[threat model](docs/security/threat-model.md).

## Packages

| Package                       | Responsibility                                                  |
| ----------------------------- | --------------------------------------------------------------- |
| `@aicoo/sharedos-contracts`   | JSON-safe protocol types, schemas, and stable identifiers       |
| `@aicoo/sharedos-core`        | Deterministic authorization, routing, and dispatch decisions    |
| `@aicoo/sharedos-os`          | Standard `files` operations and guarded OS tools                |
| `@aicoo/sharedos-runtime`     | Fixed turn envelope, standard runtime, and plugin contract      |
| `@aicoo/sharedos-client`      | Typed client for a remote SharedOS HTTP boundary                |
| `@aicoo/sharedos-http`        | Transport adapter over the same runtime and contracts           |
| `@aicoo/sharedos`             | One-install entry point re-exporting the production packages    |
| `@aicoo/sharedos-testkit`     | In-memory providers and conformance helpers for tests           |
| `@aicoo/sharedos-conformance` | Standard execution records and adversarial conformance evidence |
| `@aicoo/sharedos-adapters`    | Codex, Claude Code, DeepSeek Harness, and Pi runtime adapters   |
| `@aicoo/sharedos-mcp`         | The permission-filtered catalogue served as an MCP tool server  |

`testkit` is not a production persistence layer. Production state remains in
the host.

## Pluggable runtimes

SharedOS is runtime-agnostic, not runtime-less. `@aicoo/sharedos-runtime` ships
`StandardRuntime`, a bounded reference loop over `AgentTurnDriver`, while
`RuntimePlugin` allows a host to install a complete Codex, DeepSeek, or custom
harness.

Everything above the security kernel may vary: model/provider adapters, agent
loops, prompt and context strategy, stopping logic, session implementation, and
execution backend. The security envelope does not vary. It admits the target
agent, exposes only the effective tool catalog, withholds grants and issuing
authority, re-authorizes every exact tool call, wraps runtime events, applies
the deadline, and records the runtime id and version in the result.

Runtime selection comes from trusted host configuration, never from a message
or model-authored request field. An in-process plugin is trusted host code; an
untrusted harness belongs in a sandbox or remote process connected through the
same capability-broker boundary.

## Integration modes

**Embedded library — recommended for products.** The host keeps authentication,
billing, UI, and its existing persistence. It implements SharedOS provider
ports, then calls the runtime in-process.

**Execution adapter — recommended for evaluation harnesses.** The harness
creates an isolated world and asks SharedOS to execute one turn at a time. It
remains responsible for tick order, budgets, stopping, snapshots, judges,
metrics, and artifacts.

**HTTP boundary.** Deployments that cannot embed the runtime can expose the same
contracts through `@aicoo/sharedos-http` and consume them with `@aicoo/sharedos-client`.
Transport authentication establishes the caller; it does not replace capability
authorization.

## Security invariants

1. No matching grant means deny.
2. A message carries data and one host-bound purpose, never authority.
3. Tool discovery is filtered, and every invocation is authorized again.
4. A tool namespace must be enabled independently of its capability grant.
5. Invoking a target agent requires its own recipient-scoped execution grant.
6. Reads, writes, messages, and external calls use the same capability model.
7. Resource, action, purpose, expiry, actor, authority, namespace, and trace are
   retained in authorization and audit decisions.
8. The model sees a sanitized context, never grants or issuing authority.
9. A host adapter cannot silently widen the authority evaluated by the core.

## Quickstart

```bash
npm install @aicoo/sharedos
```

The [quickstart](docs/quickstart.md) is two working programs — the kernel
embedded in your process, and the same kernel over HTTP — written against the
published packages. From there:

- [Every endpoint](docs/endpoints.md): one page naming all five surfaces, and
  the capability space they all resolve to.
- [HTTP API reference](docs/http-api.md): every route, request body, status
  code, and header, plus where authentication enters.
- [MCP API reference](docs/mcp-api.md): the same catalog as an MCP server —
  both transports, every method, and the configuration each harness expects.
- [Tool catalog](docs/tools.md): the twelve `files` tools, the two standard
  tools outside them, the three availability gates, and how to register native
  or MCP tools of your own.
- [Reason and error codes](docs/errors.md): what every denial means and what to
  change in response.

To run the sender-to-receiver example from a local clone:

```bash
pnpm install
pnpm example:quickstart
```

The example executes one Bob → Alice turn, consumes an explicit Alice execution
grant, filters the visible tool catalog, then authorizes an exact file search.
See [`examples/quickstart`](examples/quickstart/src/index.ts).

SharedOS leaves storage, durable stores, and the model to the host, so a first
integration has to write those before anything runs. The
[reference host](examples/reference-host/README.md) is a working one — a
filesystem `files` provider covering all twelve actions with its path-escape
defences, durable SQLite stores for bounded uses, revocation, namespace
settings and audit, and an `AgentTurnDriver` over a live model:

```bash
pnpm example:reference-host
```

To see the delegation rules on their own, in vocabulary that is not a document
product:

```bash
pnpm example:fleet-delegation
```

One robot passes part of its mandate to another, cannot pass on more than it
holds, and loses it the moment the operator revokes upstream. See
[`examples/fleet-delegation`](examples/fleet-delegation/src/index.ts).

To explore the two proposed agent-network product modes as an interactive UI,
run the local Network Studio prototype:

```bash
pnpm example:network-studio
```

The prototype compares fixed-entry runtime coordination with an adaptive,
trainable network and visualizes entry agents, completion policy, topology, and
run state. It is a front-end simulation and does not invoke real agents.

Task-level self-organization, recursive delegation, recovery policy, and
cross-task experience belong to the separate
[Runtime Agent Coordination](https://github.com/Aicoo-Team/runtime-agent-coordination)
host project. SharedOS deliberately stops at authorization, messaging, brokered
tools, and one bounded runtime turn.

## Package preview

The one-install entry point is `@aicoo/sharedos`. Individual packages remain
available for hosts that want a smaller dependency surface. Release candidates
use one synchronized version and the `next` dist-tag.

```bash
pnpm pack:preview
```

This builds every package, verifies that `workspace:*` dependencies were
rewritten to exact prerelease versions, installs the tarballs into a fresh
consumer project, and checks both runtime imports and TypeScript declarations.
Artifacts are written to `artifacts/npm/`.

## Development

Requirements: Node.js 20.11 or newer and pnpm 9.15. The reference host example
needs Node.js 22.5 or newer for `node:sqlite`.

```bash
pnpm install
pnpm check
```

The repository is a TypeScript workspace. Public contracts must stay JSON-safe,
and permission changes require tests for both allowed and denied paths. See
[CONTRIBUTING.md](CONTRIBUTING.md) before proposing a change.

Released changes are recorded in the [changelog](CHANGELOG.md). The remaining
production-hardening work is tracked in
[release readiness](docs/release-readiness.md), including durable
replay/idempotency and host-adapter requirements. The exact package order,
validation commands, first-publication bootstrap, and trusted-publishing
transition are documented in the
[npm release runbook](docs/npm-release.md).

## Architecture decisions

- [ADR 0001: Library-first runtime](docs/adr/0001-library-first-runtime.md)
- [ADR 0002: Host-owned storage](docs/adr/0002-host-owned-storage.md)
- [ADR 0003: Scheduler boundary](docs/adr/0003-scheduler-boundary.md)
- [ADR 0004: Canonical resource path segments](docs/adr/0004-canonical-resource-path-segments.md)
- [ADR 0005: Files are the canonical resource plane](docs/adr/0005-files-resource-plane.md)
- [ADR 0006: Tool namespace control plane](docs/adr/0006-tool-namespace-control-plane.md)
- [ADR 0007: Pluggable runtimes inside a fixed security envelope](docs/adr/0007-pluggable-runtime-security-envelope.md)
- [ADR 0008: Validate the complete delegation chain before use](docs/adr/0008-delegation-chain-validation.md)
- [ADR 0009: Load authority from a trusted grant source, never from a context](docs/adr/0009-trusted-grant-source.md)
- [ADR 0010: Resolve authority once per turn](docs/adr/0010-per-turn-authority.md)
- [ADR 0011: Escalation is a terminal outcome, not a denial](docs/adr/0011-escalation-terminal-outcome.md)
- [ADR 0012: One refusal vocabulary at both enforcement boundaries](docs/adr/0012-one-refusal-vocabulary.md)
- [ADR 0013: The conformance matrix is the case set](docs/adr/0013-matrix-is-the-case-set.md)
- [ADR 0014: MCP is the toolshare boundary](docs/adr/0014-mcp-toolshare.md)
- [ADR 0015: One message purpose and recipient-owned execution](docs/adr/0015-message-purpose-and-recipient-execution.md)
- [ADR 0016: Expiry is instant-bound, revocation is snapshot-bound](docs/adr/0016-expiry-is-instant-bound.md)
- [ADR 0017: What a driver may declare about its own turn](docs/adr/0017-driver-declared-turn-control.md)
- [ADR 0018: Escalation over MCP is recovered from the call, not returned by it](docs/adr/0018-escalation-over-mcp.md)
- [ADR 0019: An escalation names the authority it needs](docs/adr/0019-escalation-names-the-authority-it-needs.md)
- [ADR 0020: The host ceiling is a port, not a convention](docs/adr/0020-host-ceiling-is-a-port.md)
- [ADR 0023: Every refusal reaches audit, and the record names the boundary](docs/adr/0023-every-refusal-reaches-audit.md)

## License

SharedOS is licensed under the [Apache License 2.0](LICENSE).
