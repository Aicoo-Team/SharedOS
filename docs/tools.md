# Tool catalog

A tool is how a model reaches live state or performs an action. SharedOS ships
one plane of them — `files` — and a registry for yours.

## Three gates, all required

```text
usable tool = registered for this context
              AND its namespace is enabled
              AND a capability grant allows the exact resource and action
```

They answer different questions and none substitutes for another.

**Registration** is what exists. `kernel.registerTool` adds a static,
process-wide tool. `kernel.registerToolProvider` adds a `ContextToolProvider`
for per-user or dynamically discovered catalogs — use it for MCP connections so
one user's reload cannot mutate another user's registry.

**Namespace enablement** is the product control plane: should this _family_ of
tools be offered here at all. Namespaces are **off by default**, host-owned, and
never authority. Enabling `calendar` grants nothing in it.

**Capability** is authority: which exact resources and actions this actor may
use. Checked when the catalog is listed, and checked again on every invocation.

The second check is the one that matters. A tool visible in `/v1/tools` is not
permitted; a model that rewrites the `path` in its own arguments does not reach
outside the grant, because the requirement is re-derived from the parsed
arguments immediately before execution.

## The `files` plane

`registerStandardOsTools(kernel, { files })` exposes one `ResourceProvider` as
twelve tools. `files` is the canonical plane for accumulated knowledge — memory,
workspace, identity, history, and curated notes are roots or roles inside one
file tree, not separate permission systems ([ADR 0005](adr/0005-files-resource-plane.md)).

| Tool                     | Action             | Class       | Arguments beyond `path`                                             |
| ------------------------ | ------------------ | ----------- | ------------------------------------------------------------------- |
| `files.list`             | `list`             | read        | —                                                                   |
| `files.stat`             | `stat`             | read        | —                                                                   |
| `files.read`             | `read`             | read        | —                                                                   |
| `files.search`           | `search`           | read        | `query`, `limit?`                                                   |
| `files.grep`             | `grep`             | read        | `pattern`, `mode`, `caseSensitive`, `contextBefore`, `contextAfter` |
| `files.create`           | `create`           | write       | `content`, `metadata?`                                              |
| `files.replace`          | `replace`          | destructive | `content`, `expectedVersion?`                                       |
| `files.append`           | `append`           | write       | `content`, `expectedVersion?`, `metadata?`                          |
| `files.delete`           | `delete`           | destructive | `expectedVersion?`, `recursive`                                     |
| `files.snapshot.create`  | `snapshot:create`  | write       | `label?`                                                            |
| `files.snapshot.list`    | `snapshot:list`    | read        | `limit?`                                                            |
| `files.snapshot.restore` | `snapshot:restore` | destructive | `snapshotId`, `expectedVersion?`                                    |

The **action** column is what a grant names. Granting `["search", "read"]`
makes exactly `files.search` and `files.read` visible; the other ten do not
appear in the catalog at all. The literal `"*"` is the one action that covers
every other, so a grant listing it makes all twelve visible — see the
[permission model](security/permission-model.md#capabilities-and-resources).

`path` is an array of segments, at most 64, each at most 256 characters.
Separators, traversal markers, and control characters are rejected by the
contract, so every host receives the same canonical vocabulary.

Argument schemas are exported if you need to validate ahead of a call:
`FilesSearchArgumentsSchema`, `FilesGrepArgumentsSchema`,
`FilesCreateArgumentsSchema`, and so on.

### Outputs are not yet specified

Every tool's **input** has a schema. Every tool's **output** is a free-form
`JsonValue`, and no `files` tool sets `outputSchema`. Two hosts can therefore
return different shapes from `files.search`, and prompt or client code written
against one is not portable to the other.

If that matters to you, pin the host you integrate with and treat the shape as
that host's contract, not SharedOS's. Constraining these outputs is open work.

## Registering your own tool

Live systems — calendar, email, GitHub, Notion, an internal API — stay tools
because their state has to be observed, or changed, at execution time. You own
the OAuth, the credentials, the connection, and the implementation.

```ts
import type { ToolHandler } from "@aicoo/sharedos";

const calendarFreeBusy: ToolHandler = {
  definition: {
    name: "calendar.freeBusy", // globally stable
    description: "Read free/busy windows for one calendar.",
    namespace: "calendar", // the availability gate
    source: "native", // "native" | "mcp" | your own label
    readWrite: "read", // conservative catalog classification
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["calendarId", "from", "to"],
      properties: {
        calendarId: { type: "string" },
        from: { type: "string" },
        to: { type: "string" },
      },
    },
    // The ceiling used for discovery: the broadest thing this tool could
    // ever require. Narrower than this is still checked per call.
    requiredCapability: {
      resource: { namespace: "calendar", path: [] },
      action: "freeBusy",
    },
    annotations: { readOnly: true },
  },

  // Runs before authorization. Throw on anything you would not execute.
  parseArguments: (args) => CalendarFreeBusyArgs.parse(args),

  // The important one. Derive the *exact* resource from validated arguments,
  // immediately before invocation, so argument tampering cannot widen scope.
  resolveRequirement: (context, call) => ({
    resource: {
      namespace: "calendar",
      path: [String(call.arguments.calendarId)],
      owner: context.owner,
    },
    action: "freeBusy",
  }),

  invoke: async (context, call, signal) => {
    const args = CalendarFreeBusyArgs.parse(call.arguments);
    const windows = await calendarApi.freeBusy(args, { signal });
    return {
      callId: call.id,
      tool: call.tool,
      status: "succeeded",
      output: { windows },
      completedAt: new Date().toISOString(),
    };
  },
};

kernel.registerTool(calendarFreeBusy);
```

Omitting `resolveRequirement` means the tool is authorized against its declared
`requiredCapability` only — acceptable for a tool that takes no resource
argument, and a scope hole for anything that does.

A `resolveRequirement` that returns a namespace the declared ceiling does not
cover is rejected as `invalid_tool_requirement`. Declare the ceiling in the same
plane you will resolve into.

With that registered, a Notion-style search is usable only when all of these
hold at once:

```text
the host registered this user's handler
AND the `notion` namespace is enabled for this context
AND a `notion` resource/action grant matches
AND the exact page or database the arguments select is still authorized
```

Which means you can grant search on one database without granting page updates,
and expose calendar free/busy while event contents, creation, and deletion stay
separately scoped.

## Per-user catalogs

```ts
import type { ContextToolProvider } from "@aicoo/sharedos";

const mcpTools: ContextToolProvider = {
  id: "user-mcp",
  async listTools(context, signal) {
    const connections = await mcpRegistry.forUser(context.owner, { signal });
    return connections.flatMap(toToolHandlers);
  },
};

const kernel = new SharedOSKernel({ toolProviders: [mcpTools] });
```

The provider is called with exactly one trusted context, and the handlers it
returns are used for that call only. Nothing it returns is cached into a shared
registry.

If a provider throws, the catalog request fails with `tool_catalog_unavailable`
rather than silently returning a partial list — a truncated catalog would read
as "you have no access to that" and be indistinguishable from a denial.

## Managing namespaces

```ts
const catalog = await kernel.updateToolNamespaces(
  context,
  { enable: ["files", "calendar"], disable: ["notion"] },
  { signal },
);
```

The same namespace may not appear in both lists. Your
`ToolNamespaceSettingsStore.applyUpdate` must apply the patch atomically
against fresh state, and may narrow the request by organization policy — never
widen it beyond what host policy allows. The returned catalog is what actually
took effect, which may be less than what was requested.

`applyToolNamespaceUpdate(current, update)` implements the standard patch
semantics if you only need persistence around it.

## Related

- [HTTP API reference](http-api.md) — the tool routes on the wire
- [Reason and error codes](errors.md) — what each denial means
- [ADR 0006: Tool namespace control plane](adr/0006-tool-namespace-control-plane.md)
- [Permission model](security/permission-model.md) — the normative invariants
