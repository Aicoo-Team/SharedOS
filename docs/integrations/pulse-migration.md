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

- Consume the synchronized SharedOS packages from npm under the `next`
  dist-tag, or from packed workspace artifacts.
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
- Move/copy are either covered by multi-resource authorization or remain
  explicitly outside the standard SharedOS tool set.
