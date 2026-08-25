# ADR 0006: Standardize the tool namespace control plane

- Status: Accepted
- Date: 2026-08-09

## Context

SharedOS already required a capability grant before an agent could discover or
invoke a tool. Hosts additionally group tools into user-configurable namespaces
such as `calendar`, `email`, `github`, or a user-connected `notion` MCP server.
That second mechanism answers a different question: which families of tools
should exist in this user's current tool surface at all?

Without a shared contract, every host would recreate catalog metadata,
enable/disable behavior, MCP aggregation, and execution-time checks. The common
process-global mutable registry pattern would also allow one user's MCP reload
to remove or replace another user's tools under concurrent requests.

Three concepts called “namespace” must remain distinct:

1. `AccessContext.namespaceId` isolates a tenant, sandbox, or experiment world.
2. `ResourceRef.namespace` identifies the capability authority domain, such as
   `files` or `calendar`.
3. `ToolDefinition.namespace` groups tools for discovery and user/product
   enablement, such as `calendar` or `notion`.

They may use the same text in simple integrations, but they have different
security meanings and must not be inferred from one another.

## Decision

Every SharedOS tool definition declares:

- a logical `namespace`;
- a host-extensible `source`, such as `sharedos`, `native`, `mcp`, or
  `composio`;
- a conservative `readWrite` catalog classification;
- its existing exact `requiredCapability`.

Every trusted `AccessContext` declares its effective
`enabledToolNamespaces`. An empty selection means all tool namespaces are off.
A tool is usable only when all three conditions hold:

```text
registered for this context
AND tool namespace enabled
AND required capability allowed
```

The kernel applies the namespace check during filtered discovery and repeats it
during invocation before capability authorization. Namespace enablement never
creates authority, and `source`, `readWrite`, descriptions, annotations, and
tool names are metadata rather than permission evidence.

SharedOS exposes a context-specific namespace catalog and an idempotent patch
contract with `enable` and `disable` lists. A host-owned
`ToolNamespaceSettingsStore` applies that patch atomically against fresh state,
enforces any product or organization ceiling, persists it, and returns the
authoritative effective selection. The standard HTTP/client adapter exposes
this as `GET` and `PUT /v1/tools/namespaces`. Embedded hosts can call the same
kernel methods directly.

Static tools use the ordinary registry. User-specific MCP servers and other
dynamic catalogs use `ContextToolProvider`, which resolves handlers for exactly
one trusted access context. The kernel merges those handlers into an ephemeral
registry for that operation and rejects duplicate names. A dynamic provider
must not mutate a singleton registry shared by concurrent users.

SharedOS owns the contracts, deterministic patch semantics, catalog
aggregation, and enforcement. Each host continues to own:

- authentication and consent UI;
- namespace-setting persistence and policy ceilings;
- OAuth tokens, MCP credentials, server connections, and refresh lifecycle;
- connector egress controls and concrete tool implementations.

For example, importing a Notion MCP server remains a host operation. The host
supplies that user's Notion handlers through a context provider with
`namespace: "notion"` and `source: "mcp"`. SharedOS then lists and toggles the
namespace consistently, but a Notion capability grant is still required for
each visible or executed operation.

## Consequences

### Positive

- Product and evaluation hosts share one catalog and enablement model without
  importing product code into SharedOS.
- Disabled namespaces disappear from model-visible discovery and fail closed
  at invocation even when a caller guesses a tool name.
- Capability grants remain the sole source of operation authority.
- User-specific MCP catalogs are isolated across concurrent requests.
- Hosts can use different databases and connector SDKs behind the same control
  plane.

### Costs

- This is a breaking `0.x` protocol change: every tool definition and access
  context must declare its namespace fields explicitly.
- Hosts must implement the settings port to support the standard PUT endpoint.
- Hosts must map their stored setting into every newly resolved access context;
  mutating one context object is intentionally insufficient.
- A namespace is intentionally coarse. Fine-grained calendar, Notion, file, or
  account access still requires capability scopes and host connector policy.

## Rejected alternatives

**Infer the tool namespace from its name.** Rejected because names such as
`mcp_notion_search` are conventions, not stable authority or grouping data.

**Use capabilities alone.** Rejected because users and products need a coarse,
default-off tool-surface switch independent of fine-grained resource authority.

**Treat namespace enablement as authority.** Rejected because enabling
`calendar` must not imply permission to create, delete, or read every calendar.

**Use a mutable singleton MCP registry.** Rejected because concurrent
users can overwrite one another's catalogs and because a host-specific loading
strategy does not belong in SharedOS.
