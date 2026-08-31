# Pulse migration plan

## Outcome

SharedOS should replace Pulse's duplicated authorization and agent dispatch
plumbing while Pulse remains the product and storage owner. The first vertical
slice is the canonical `files` plane because Pulse already implements
file-as-memory through `notes` and `noteFolders`.

This is an embedded-first migration. A remote SharedOS service is unnecessary
until a real process boundary is required.

## Current Pulse seams

| Current Pulse seam                               | Target role                                                                           |
| ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `lib/notes/root-spaces.ts`                       | Canonical mapping for `Raw`, `Memory`, `Workspace`, and `Wiki` path roots             |
| Notes/folders queries and `/api/v1/os/notes/*`   | Storage implementation behind a Pulse `files` provider                                |
| `lib/gbrain/sharedos-source 2.ts`                | Revision-aware file projection; remove the duplicated root-prefix vocabulary          |
| `lib/memory/queries.ts`                          | Context loader and derived index over authorized files                                |
| `lib/ai/tools/notes-management.ts`               | Replace tool definitions with `createFileTools(...)` plus Pulse provider calls        |
| `lib/ai/tools/memory-management.ts`              | Memory maintenance workflow using `files.read/replace/append`, not a memory authority |
| `lib/tools/types.ts` and `lib/tools/registry.ts` | SharedOS `ToolDefinition`, `ToolRegistry`, and namespace catalog contracts            |
| `/api/v1/tools`                                  | Thin Pulse auth/usage adapter over kernel `listTools` and `invokeTool`                |
| `/api/v1/tools/namespaces`                       | Pulse-backed `ToolNamespaceSettingsStore` plus SharedOS GET/PUT semantics             |
| `lib/tools/mcp/bridge.ts`                        | Per-user `ContextToolProvider`; remove process-global MCP registry mutation           |
| Existing `agentPermissions` checks               | Pulse host ceiling and adapter to trusted `CapabilityGrant` records                   |
| `lib/local-agent/grants.ts` route grants         | Route lease only; authorization moves to the kernel                                   |
| `c2c_tool_grants` and `c2c_tool_approvals`       | `CapabilityGrant` records plus one host consent workflow                              |
| `lib/local-agent/trusted-tool-policies.ts`       | Host-side activation bookkeeping in front of the `GrantSource`                        |
| `lib/escalation/sanitizer.ts` and clustering     | `HostCeiling` implementation; it may narrow and never widen                           |
| `lib/escalation/permission-request.ts`           | Host consent workflow resolving a `CapabilityRequest` into a grant                    |
| c2c delivery, endpoints, and device pairing      | `MessageTransport` implementation; never a second authorization point                 |
| `lib/ai/shared-agent-core.ts` and agent-v04      | Model driver and host wrapper around one SharedOS turn                                |
| `packages/codex-cloud-runtime` and agent-v05     | Codex `RuntimePlugin`; keep sandbox/backend details outside SharedOS core             |
| `/api/v1/agent/message`                          | Authenticated transport into messaging plus target execution capabilities             |
| Heartbeats and autonomous scheduling             | Remain Pulse-owned; each scheduled tick invokes one bounded turn                      |

## Canonical file identity

Use a Pulse-owned namespace/world per isolation boundary, for example a user,
team, or sandbox world. Bind the authenticated actor and resource owner
separately. Use structured paths without joining them before authorization:

```text
["Memory", "Self", "MEMORY.md"]
["Memory", "Self", "Logs", "2026-08-07.md"]
["Workspace", "project-x", "plan.md"]
["Wiki", "product", "sharedos.md"]
```

Pulse note IDs remain stable storage identities and should be emitted as
provider metadata and audit provenance. The path is the capability scope.
Changing a path therefore requires authorization for both the source and the
destination; it is not merely a database rename.

## Provider operation mapping

| SharedOS operation | Pulse implementation                                                                |
| ------------------ | ----------------------------------------------------------------------------------- |
| `files.list`       | List authorized child folders and notes                                             |
| `files.stat`       | Return note/folder metadata and revision                                            |
| `files.read`       | Read one authorized note or folder projection                                       |
| `files.search`     | Query the existing semantic/text index with scope predicates applied before ranking |
| `files.grep`       | Use the current grep path without scanning inaccessible notes                       |
| `files.create`     | Create a note/folder only at the authorized target path                             |
| `files.replace`    | Replace content with revision/idempotency checks                                    |
| `files.append`     | Append logs or journal entries without a read-modify-write race                     |
| `files.delete`     | Delete only the authorized path; recursive deletion must be explicit                |
| `files.snapshot.*` | Wrap the existing snapshot mechanism and preserve world/owner scope                 |

Pulse currently supports move and copy. Keep those behind the existing Pulse
policy gate during the first slice. SharedOS should standardize them only after
the kernel can atomically authorize multiple resources: source read/delete and
destination create/replace. A single-resource check is not sufficient.

## Pulse adapter layout

Create a small Pulse-owned integration boundary; names are suggestions:

```text
lib/sharedos/
  kernel-factory.ts
  access-context.ts
  file-path.ts
  files-provider.ts
  grant-adapter.ts
  tool-definitions.ts
  tool-namespace-settings.ts
  mcp-tool-provider.ts
  audit-sink.ts
  agent-driver.ts
  runtime-registry.ts
  runtimes/codex.ts
  conformance/
```

`kernel-factory.ts` wires SharedOS packages to Pulse providers. Routes and agent
tools call this boundary rather than importing authorization details directly.
No Pulse type, schema, route, or billing dependency moves into SharedOS.

## Rollout phases

### 0. Package and baseline

- Consume the synchronized SharedOS packages from a private registry or packed
  workspace artifacts.
- Confirm Pulse's Node runtime meets SharedOS's declared minimum.
- Capture current allow/deny behavior for notes, memory maintenance, shared
  agents, snapshots, and `/api/v1/os` routes.

### 1. Provider parity

- Implement `files-provider.ts` over existing Pulse queries without changing
  persistence.
- Add conformance tests for all four root spaces, owner/world isolation,
  traversal rejection, and allowed/denied actions.
- Ensure semantic search applies authorization scope inside the database/index
  query, before counts, ranking, snippets, or embeddings leave the provider.

### 2. Shadow authorization

- Introduce `SHAREDOS_MODE=off|shadow|enforce` at the Pulse integration boundary.
- Make the mode **per plane**, not one switch. `sharedOSMigrationMode` today is
  one global value with a per-account override, so enforcing files would also
  enforce the c2c and escalation planes added in phases 8-11, and a rollback of
  either would have to take both. Each plane cuts over and rolls back alone.
- In shadow mode, the existing decision serves the request while SharedOS emits
  a comparison event.
- Treat every `SharedOS allow / legacy deny` and `SharedOS allow outside the
expected path` as a release blocker. Investigate legacy allows that SharedOS
  denies before enforcement.

### 3. File read cutover

- Enforce SharedOS for list, stat, read, search, and grep in one internal
  service layer.
- Point both API routes and agent tools at that layer so another endpoint cannot
  bypass the decision.
- Keep response formatting in Pulse.

### 4. File mutation cutover

- Enforce create, replace, append, delete, and snapshots.
- Use Pulse's durable idempotency and transaction/outbox boundary for mutations
  plus outcome audit.
- Replace generic `write` permissions with exact actions. Do not expose legacy
  `memory.*` or `workspace.*` aliases.

### 5. Tool namespace control-plane cutover

- Convert each native tool to a SharedOS handler with explicit `namespace`,
  `source`, `readWrite`, argument parser, and exact `requiredCapability`.
- Load Pulse's stored user namespace selection into
  `AccessContext.enabledToolNamespaces`. Empty means all optional tool families
  are off. Pulse may add mandatory built-in namespaces such as `files` only as
  an explicit product ceiling decision.
- Implement `ToolNamespaceSettingsStore` over Pulse's user settings. Apply
  enable/disable patches atomically against a fresh database row and return the
  effective selection after organization/product policy.
- Keep `/api/v1/tools/namespaces` as the authenticated Pulse route or mount the
  SharedOS HTTP adapter; either path must use the shared request/response
  schemas and kernel methods.
- Replace `loadMcpTools(userId)` plus `registry.clearPrefix("mcp_")` with a
  `ContextToolProvider` that returns only that access context's MCP handlers.
  A connected Notion server becomes `namespace: "notion"`, `source: "mcp"`;
  Pulse still owns connection setup and credentials.
- Route catalog discovery and every tool execution through the same kernel.
  Namespace enablement is only a coarse switch; calendar read/create/update/
  delete and account scope remain separate capabilities.

### 6. Runtime and one-turn agent cutover

- Wrap agent-v04's model/provider path in `StandardRuntime` rather than moving
  its prompt, billing, or provider configuration into SharedOS.
- Require a recipient-scoped execution grant before opening another agent and
  re-authorize every file/tool side effect during the turn.
- Adapt `packages/codex-cloud-runtime` to `RuntimePlugin`. Preserve its Codex
  harness, Vercel Sandbox, OIDC, network policy, and streaming translation as
  Pulse-owned implementation details.
- Translate the plugin's model-facing SharedOS tools from the sanitized
  `RuntimeTurnRequest.tools` catalog. Route every actual file, connector, or MCP
  effect through `RuntimeHost.invokeTool`; do not use a harness-local
  `allow-all` decision as SharedOS authority.
- Resolve `standard`, `codex`, and future runtime ids from authenticated Pulse
  policy. Do not accept a model- or message-selected runtime id.
- Record runtime manifest, model id, backend id, sandbox version, and SharedOS
  protocol version independently in execution and experiment artifacts.
- Keep model selection, billing, product limits, conversation rendering, and
  stop/scheduling policy in Pulse.

### 7. Network convergence

- Route agent messages through the SharedOS envelope and messaging capability.
- Keep heartbeats, retries, fan-out limits, task completion, and cross-turn stop
  policy in Pulse's scheduler.
- Expose `@aicoo/sharedos-http` only when an external runtime actually needs a process
  boundary; embedded and HTTP modes must pass the same conformance suite.

### 8. One grant source for both agent planes

- Extend `grant-adapter.ts` to translate the c2c tables — route grants, tool
  grants, and activated trusted policies — into `CapabilityGrant` records
  alongside `agentPermissions`, so the chat plane and the agent-to-agent plane
  resolve authority through one `GrantSource`.
- Keep every translation complete: one capability per bucket, no union of
  independent permission fields into a synthetic authority.
- Withhold a trusted policy that the local bridge has not yet attested. A grant
  a `GrantSource` returns is active by contract, so "approved but not applied"
  stays host bookkeeping and never reaches the kernel.
- Split `requireActiveGrant`. A communication session answers whether the route
  is still live; it must stop also answering whether the caller is permitted.
- Land this behind the c2c plane's own migration mode, shadow first.

### 9. One decision point for tool approval and escalation

- Implement `PolicySource` and `HostCeiling` (ADR 0020). Load the folder grants,
  precedents and session-scope decisions once per turn, beside the grant set,
  and decide against them synchronously — their keys are a bounded table, not a
  per-argument query, so no decision needs a database read.
- Stop applying policy in the `GrantSource`. The `toolAccess.allowedTools`
  intersection moves to the ceiling, where a refusal is recorded as
  `policy_denied` instead of reaching audit as `no_matching_grant`.
- Implement `HostCeiling` over the remaining judgment checks so they stop being
  a second enforcement point. Separate the three things currently bundled as
  "judgment", because they do not belong in the same place:
  - The **precedent mechanism** — fingerprint a request shape, match it against
    the owner's prior answers, and skip the prompt — is deterministic and is
    already wanted by both planes. Converge it to one implementation with a
    typed key. Today the c2c plane reuses the escalation precedent table by
    string-encoding a structured key into fields meant for something else:
    `relationshipCluster` holds `c2c:<principalId>` and `queryFingerprint` holds
    a JSON tuple, where the escalation plane writes a computed cluster and a
    SHA-256 of normalized intent. That is one mechanism with no home, not two
    policies.

    Name the home in this phase rather than after it. The matching logic is a
    SharedOS package — deterministic, opt-in, depending on nothing Pulse owns —
    and the rows stay host-side behind a lookup port, because a precedent is a
    record of what one owner answered and SharedOS stores nothing. Leaving the
    home unstated is how the second copy comes back.

  - A precedent decides whether to **ask**, never whether to **permit**. It runs
    after authorization has already allowed the call, so it can only skip an
    owner prompt. Keep that property explicit wherever it lands.
  - The **model-based sanitizer** is not a ceiling and does not move into the
    kernel decision. A ceiling runs in the discovery path, once per tool per
    catalogue build, so it must be deterministic and cheap (ADR 0020). The
    sanitizer stays the host gate it already is, running before the call reaches
    the kernel. What changes is that it emits its verdict through the same
    `AuditSink` with the same outcome vocabulary. Its defect today is that
    nothing records it, not that it runs host-side.
- `computePermissionGaps` largely dissolves. "Which scope was never granted" is
  the same computation as the `requiredCapability` a `no_matching_grant` denial
  now describes (ADR 0019); keep only the owner-facing scope copy.
- Replace the in-memory permission elevation used for escalation replay with a
  grant scoped to the requesting guest: `subject`, `expiresAt`, and
  `maxUses: 1`. The reason it was never persisted — that `agentPermissions` has
  no way to bound a grant to one requester for one use — does not apply to a
  `CapabilityGrant`.
- Resolve an escalation by issuing that grant, as ADR 0011 requires, using the
  `CapabilityRequest` the denial described (ADR 0019). Do not add a second
  approval path for c2c; the owner prompt and the escalation notice are two
  presentations of one record.
- Retire the per-plane reason-code vocabularies. Separate policy denials,
  fail-closed denials, and escalations before computing any rate.

### 10. One capability vocabulary

- Delete the preset-to-tool-name tables. A tool name is not a permission key;
  the resource path is. `read-project` and `edit-project` become capabilities
  over a path with actions, resolved identically in Pulse and in the local
  agent.
- Ship the vocabulary from one package so the server and the local agent cannot
  drift. Today the same table exists in both repositories and disagrees.
- Register the local agent's vetted Git subset as a tool provider in the kernel
  registry, beside the files provider. It is a provider, not a permission name,
  and not an MCP server.
- **Give Git its own resource namespace. Do not model it as file access.**
  `repo` and `files` may address the same directory and are still different
  resources, and `capabilityMatches` requires the namespace to be equal, so
  holding one grants nothing over the other. Modelling `git commit` as a write
  under `files` would mean every holder of file-write authority could also
  commit, which is a permission cross-product the model forbids and a real
  widening of what the current `GitCommit` permission allows.
- Keep the two kinds of restriction in `safe-git.ts` apart, because only one of
  them is a permission:
  - **Scope** — arguments must resolve inside the approved repository
    (`validatePathArguments`) — is expressed by the capability's path, exactly
    as it is today.
  - **Execution hardening** — five subcommands, per-subcommand argument
    allowlists, `core.hooksPath=/dev/null`, `GIT_CONFIG_NOSYSTEM`,
    `GIT_CONFIG_GLOBAL=/dev/null`, `--no-ext-diff`, `--no-textconv`,
    `hash-object --no-filters`, symlink refusal — is not authorization at all.
    It survives because the provider is the only code that can turn a capability
    into a Git invocation, and it can only emit the hardened form.
- Anything outside that subset — `push`, `reset`, `checkout`, `clean`, `config`,
  `remote` — remains `shell.command`, which is never silently granted. The
  provider does not widen the reachable set of Git operations; it only removes
  tool names from the permission vocabulary.

### 11. Extract the transport

- Move the route lease, device identity, delivery state machine, and revocation
  cascade behind `MessageTransport`. The kernel already owns `sendMessage` and
  authorizes before it delivers; the extracted package implements what
  `deliver` does and holds no authorization decision of its own.
- Name the two leases apart. `TurnAuthorityScope` is an authority lease; a
  communication session is a route lease.
- **Authorization does not replace the route-lease check, and the lease check
  keeps its lock.** These answer different questions at different instants:
  - The kernel decides whether the actor _may_ send to that recipient. It
    decides against the turn's snapshot, resolved once at the turn boundary, so
    by ADR 0010 it cannot see a revocation that lands mid-turn.
  - The transport decides whether the route is _still live at the moment of
    dispatch_, under the row lock that already exists —
    `requireGrantForMessagePersistence` takes `.for('update')` on the
    communication session and its collaboration, so a revocation must wait for
    that transaction to commit.

  Delivery is a side effect that outlives the decision authorizing it, so an
  authorization that is deliberately one turn stale cannot be the only gate.
  Move `.for('update')` behind `MessageTransport` unchanged; the port does not
  take it over. A dispatch whose lease check is skipped because the kernel
  already allowed the send is exactly the revocation race this preserves against,
  and conformance should carry a row for it: a send authorized before a
  revocation, dispatched after it, must terminate rather than deliver.

- Embedded Pulse and a self-hosted deployment must pass the same conformance
  suite, as with the HTTP boundary in phase 7.

## Observability and rollback

Record decision mismatches, denied operations, matched grant IDs, actor, owner,
world, file path, action, purpose, operation ID, and source revision. Do not log
file content or credentials. Production writes require a durable outbox or an
equivalent transaction so a committed mutation is not retried merely because
audit persistence failed.

Each phase should be independently reversible through the integration mode.
Rollback changes the serving path, not the stored file model, because SharedOS
never takes ownership of Pulse data.

## Definition of done

- Raw, Memory, Workspace, and Wiki all use one `files` provider and capability
  namespace.
- Memory loaders and embeddings cannot retrieve a source file the actor could
  not read directly.
- API routes and agent tools cannot bypass the same authorization decision.
- Native and MCP tools use one SharedOS registry contract; disabled namespaces
  are absent from discovery and rejected again during invocation.
- User-specific MCP catalogs do not mutate process-global state, and a Notion
  connection in one world cannot appear in another.
- Pulse persists namespace choices and connector credentials while SharedOS
  owns their portable control-plane semantics and execution gates.
- File mutations are idempotent and outcome-audited durably.
- Agent-v04 and shared-agent execution use `StandardRuntime` inside the same
  bounded-turn envelope.
- Agent-v05 Codex implements `RuntimePlugin`, routes SharedOS effects through
  `RuntimeHost`, and records runtime/backend/model provenance separately.
- Heartbeat and benchmark/product completion policy remain outside SharedOS.
- Exactly one component decides that an operation is allowed. The c2c and
  escalation planes hold no grant storage and no authorization check of their
  own; they contribute a route and a ceiling.
- No tool-name-to-permission table exists in either repository.
- An escalation approval is a bounded, auditable grant that expires, not an
  in-process object.
- Policy denials, fail-closed denials, and escalations are separable in audit,
  so a denial rate can be computed at all.
- Move/copy are either covered by multi-resource authorization or remain
  explicitly outside the standard SharedOS tool set.
