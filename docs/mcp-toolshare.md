# MCP toolshare

SharedOS is the canonical tool catalogue and authorization broker. MCP is the
default interoperability boundary presented to external harnesses.

```
Harness configuration declares a CONNECTION.
SharedOS declares the TOOLS.
SharedOS capabilities declare the AUTHORITY.
RuntimeHost is the only EXECUTION path.
```

Everything below follows from those four lines. The design decisions and the
alternatives rejected along the way are in
[ADR 0014](adr/0014-mcp-toolshare.md).

## Why this exists

SharedOS could already drive a vendor harness through `@aicoo/sharedos-adapters`:
the adapter speaks the vendor's API-layer tool-call shape and SharedOS owns the
turn loop. That path is exact, and it cannot be pointed at an installed CLI. No
coding-agent CLI exposes its API layer, and none has a wire frame meaning _here
is your tool catalogue_ — so a live CLI told to call `files.read` reaches for its
own `Read` instead, and every kernel row goes unexercised.

MCP is the one interface Codex, Claude Code, and DeepSeek Harness all accept a
host-supplied tool set on. Over it, the CLI runs natively — its own model, its
own loop — and still cannot take an action SharedOS did not authorize.

## One name, three places

```
ToolDefinition.name  =  SharedOS canonical tool ID  =  raw MCP Tool.name
```

`ToolNameSchema` enforces it at registration: 1–128 characters of
`[A-Za-z0-9_.-]`, deliberately narrower than `IdentifierSchema`. A tool name goes
on a wire, so the character set has to be one every harness carries unchanged.

Names are globally unique across namespaces. Two brokered providers exposing the
same underlying operation publish two names:

```
files.search        github.search        notion.search
```

never `search` three times.

A harness may rewrite the name for its own display — Claude Code, Codex, and
DeepSeek all use `mcp__<server>__<tool>`, and DeepSeek appends a hash when
normalisation would collide. That alias is presentation. It is recorded on the
bridge for diagnosis, never on the `ToolCall`, so it cannot reach an
authorization decision even by mistake.

## What crosses the boundary

`PublishedToolDefinition` is defined by what it omits:

| Published                               | Never published                                     |
| --------------------------------------- | --------------------------------------------------- |
| `name`, `description`                   | `requiredCapability`, `resolveRequirement`          |
| `inputSchema`, `outputSchema`           | grants, issuing authority, `AccessContext`          |
| `annotations` (MCP hints)               | namespace settings, credentials, handler references |
| `metadata.namespace`, `metadata.source` |                                                     |

The omission is load-bearing rather than tidy. Authorization is
`resource + action + context`, resolved from the **arguments** at call time — not
`grant → files.read` — so two calls to one published tool routinely need
different authority:

```
files.read(path="/public/a.txt")   → allowed
files.read(path="/private/a.txt")  → denied
```

The canonical tool ID identifies the operation implementation, not the authority.
Publishing a capability requirement would therefore be both a leak and a lie.

## Per turn, never global

```
1. SharedOS resolves a trusted AccessContext.
2. kernel.listTools(context) computes the effective catalogue.
3. A turn-scoped MCP bridge exposes only those tools.
4. The harness runs.
5. Every tools/call becomes a SharedOS ToolCall.
6. RuntimeHost.invokeTool() re-authorizes the exact call.
7. The bridge closes when the turn closes.
```

`ContextToolProvider` exists so one user's MCP catalogue never mutates a registry
shared with concurrent users, and that invariant now runs all the way through the
harness. There is no long-lived SharedOS MCP server holding a union of every
user's tools: it would have to re-derive who is asking on every call, and would
be wrong once.

Step 7 is not housekeeping. Harness processes outlive their turns — on
cancellation, on timeout — and after the bridge closes such a process finds a
shut door and a released port rather than a catalogue resolved for a turn that
has ended.

## Refusals are results

```
SharedOS succeeded → MCP successful content/result
SharedOS denied    → MCP tool error/result, never transport error
SharedOS failed    → MCP tool error/result
cancellation       → aborted MCP request/session
```

A JSON-RPC error means the request could not be processed. A harness receiving
one learns nothing about its authority; most retry, some abandon the turn. A
denial is a processed request whose answer is "no", and returning it as
`isError: true` is what lets a harness report the refusal and carry on.

`denied` and `failed` stay distinguishable in the payload and in
`_meta["sharedos/status"]`. They mean different things — policy refused this,
versus the tool broke — and collapsing them makes a denial rate uncountable.

## Catalogue hashes

```
catalogHash = SHA-256(canonical JSON(tools sorted by canonical name))
```

Field participation is the contract, not an implementation detail. It is fixed by
`CATALOG_HASH_FIELDS` and asserted by the projection, which cannot emit a key
outside it:

| Participates                   | Does not      |
| ------------------------------ | ------------- |
| `name`, `description`          | `executionId` |
| `inputSchema`, `outputSchema`  | harness alias |
| `annotations`                  | runtime name  |
| `metadata` (namespace, source) | transport     |

Without fixed participation, two implementations can both claim to compute
`catalogHash` and agree on nothing.

The hash lands in `SystemIdentity` on every execution record. That turns
cross-harness comparison into a check: two columns whose hashes differ were not
given the same tool set, and their refusal behaviour cannot be compared until
that is explained. It also catches schema drift, a missing tool, a renamed tool,
and a stale discovery cache — failures that otherwise look like a harness
behaving differently.

## Tool classes

| Class             | Example                         | SharedOS authorized? | Recommendation                                   |
| ----------------- | ------------------------------- | -------------------- | ------------------------------------------------ |
| `managed`         | `files.search`, brokered GitHub | Yes                  | The normal SharedOS path                         |
| `harness_local`   | patch tool, bounded shell       | No                   | Allow only if the sandbox cannot bypass SharedOS |
| `external_direct` | independently configured Jira   | No                   | Explicit opt-in hybrid mode                      |

`ToolPolicy` declares which a run had:

```json
{
  "mode": "strict",
  "managedMcp": ["sharedos"],
  "harnessLocal": ["apply_patch"],
  "externalDirect": []
}
```

versus

```json
{
  "mode": "hybrid",
  "managedMcp": ["sharedos"],
  "harnessLocal": ["shell", "apply_patch"],
  "externalDirect": ["github", "browser"]
}
```

A `strict` policy that also lists `externalDirect` entries is rejected by the
schema, rather than producing a run whose headline claim its own manifest
contradicts. `harnessLocal` stays permitted under `strict` — no CLI gives up all
its own tools — but the entries must be named.

This is what makes a result readable. "The kernel refused every violation" means
one thing when the managed catalogue was the only way to have an effect, and
almost nothing when the harness also had a shell.

## Using it

### Inside a turn

```ts
import { McpToolServer, openToolBridge } from "@aicoo/sharedos-mcp";
import { createStreamableHttpMcpServer } from "@aicoo/sharedos-mcp/node";

// Inside RuntimePlugin.run(request, host, signal):
const bridge = openToolBridge({
  executionId: request.executionId,
  context: { traceId: request.context.traceId, now: request.context.now },
  tools: request.tools, // already permission-filtered by the envelope
  host, // RuntimeHost: every call is re-authorized
});
const http = await createStreamableHttpMcpServer({
  server: new McpToolServer({ invoker: bridge }),
});
try {
  // ... point the harness at http.url and run it ...
} finally {
  bridge.close();
  await http.close();
}
```

### Outside a turn

```ts
import { kernelToolBridge } from "@aicoo/sharedos-mcp";

const invoker = kernelToolBridge({ kernel, context, executionId });
```

Every kernel guarantee still holds — filtered discovery, per-call
re-authorization. What is absent is the envelope: no step or tool-call budget and
no execution event stream, so a turn's evidence cannot be assembled from a
session served this way.

### The installed CLIs

```ts
import { CLAUDE_CODE_MCP_HARNESS, createMcpHarnessRuntime } from "@aicoo/sharedos-adapters/node";

const runtime = createMcpHarnessRuntime(CLAUDE_CODE_MCP_HARNESS);
```

`CODEX_MCP_HARNESS` and `DEEPSEEK_MCP_HARNESS` are the other two. Pi has no MCP
client and is transcript-only; saying so is more useful than a column that cannot
mean anything.

Each spec generates its own connection file and nothing else:

| Harness     | File               | Shape                                          |
| ----------- | ------------------ | ---------------------------------------------- |
| Codex       | `config.toml`      | `[mcp_servers.sharedos]`, `required = true`    |
| Claude Code | `.mcp.json`        | `{"type":"http","url":…}`                      |
| DeepSeek    | `cordis.patch.yml` | one `@deepseek-ai/dsh-mcp-client` plugin entry |

The launch flags remove what would otherwise confuse a measurement:
`--strict-mcp-config` drops the machine's own MCP servers, so a `strict` policy
is checkable rather than merely declared, and the disallowed-tools list removes
the harness's own file and shell tools — a probe that can edit files on the
machine it is measuring is answering a different question.

`--allowedTools mcp__sharedos` auto-approves the server. That is a permission
_prompt_ decision, not an authorization one: Claude separates the two, print mode
has no human to prompt, and what secures the run is that every call is
re-authorized by the kernel.

### Sandboxed or remote harnesses

Loopback plus an ephemeral port is enough when the port is known only to the
subprocess it was opened for. Otherwise mint a short-lived execution token:

```ts
const token = await mintExecutionToken(
  { executionId, namespaceId, actor: "agent:agent-bob", catalogHash, expiresAt },
  hostSecret,
);
const http = await createStreamableHttpMcpServer({
  server,
  authorize: async (presented) =>
    presented !== undefined &&
    (await verifyExecutionToken(presented, hostSecret, { now, expect: { executionId } })).valid,
});
```

The token identifies the broker session. It carries no grants and no
capabilities: whoever presents it still receives exactly the catalogue that
turn's `AccessContext` resolved, and every call is still authorized from the
trusted grant source at the moment of the call. `catalogHash` is bound in so a
stale sandbox cannot reconnect and call tools it was never shown.

## Running the conformance column

```sh
pnpm build
pnpm conformance:mcp                      # one case, every installed harness
pnpm conformance:mcp -- --harness claude-code --full
```

Live runs cost model tokens, so the default is one case; `--full` runs the whole
set and is what a published result should come from. Output lands in
`artifacts/conformance/mcp-conformance.json`.

The column is reported separately from the committed manifest. Its correlation is
weaker than a transcript column's — a live harness mints its own call ids, so
attempts are matched on tool and resource — and its result depends on a model's
choices. A harness that is absent, unauthenticated, or that declines a declared
call leaves no operation in the record and is graded `not exercised`: never a
pass, and never a kernel failure.
