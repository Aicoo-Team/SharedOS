# @sharedos/core

The deny-by-default SharedOS authorization and dispatch kernel.

```bash
npm install @sharedos/core @sharedos/contracts
```

The kernel filters tool discovery, re-authorizes exact invocations, binds
resource ownership, and emits structured audit events. Embedded hosts must
construct access contexts from authenticated identity and trusted grant state.

Tool use requires registration, namespace enablement, and capability authority.
Static handlers use `ToolRegistry`; user-specific MCP catalogs use
`ContextToolProvider`. A host implements `ToolNamespaceSettingsStore` for
atomic, durable namespace updates while keeping its database and product policy.

SharedOS is currently an `0.x` prerelease.
