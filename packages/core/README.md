# @aicoo/sharedos-core

The deny-by-default SharedOS authorization and dispatch kernel.

```bash
npm install @aicoo/sharedos-core
```

The kernel filters tool discovery, re-authorizes exact invocations, binds
resource ownership, and emits structured audit events. Embedded hosts must
construct access contexts from authenticated identity and trusted grant state.

Tool use requires registration, namespace enablement, and capability authority.
Static handlers use `ToolRegistry`; user-specific MCP catalogs use
`ContextToolProvider`. A host implements `ToolNamespaceSettingsStore` for
atomic, durable namespace updates while keeping its database and product policy.

SharedOS is currently a `1.0.0` preview.

## Replay storage

`SharedOSKernelOptions.replayStore` enables the kernel-owned replay state machine
for execution, tool, resource and message IDs. Hosts implement `ReplayStore` with
atomic durable claims and fenced settlement. Keep identity tombstones after
result expiry; never reclaim pending operations solely because a timeout passed.
See [ADR 0028](https://github.com/systemind-team/SharedOS/blob/main/docs/adr/0028-durable-operation-replay.md).

`InMemoryReplayStore` is exported by `@aicoo/sharedos-testkit` for isolated tests.
It is not durable or suitable for production. Without a configured
store, unbounded calls retain legacy unprotected behavior. External effects still require
provider idempotency or reconciliation for crash ambiguity.

Kernel construction requires an explicit `audit` sink. For tests or development,
`audit: "discard"` intentionally drops records; `new NoopAuditSink()` is also
an explicit opt-out. Neither choice provides production audit durability.

## Bounded effects and audit recovery

A bounded kernel effect requires one `EffectStore` as `replayStore`. It extends
`ReplayStore` with atomic reservation, fenced admission, release and an audit
outbox on the same operation record. `maxUses` limits admitted effects, including
failed or ambiguous effects. An audit failure before admission releases capacity;
a provider error or cancellation after admission never refunds it. A legacy
`tryConsume` counter alone fails bounded kernel operations closed.

The default authorizer reads usage from that store. If you supply a custom
`CapabilityAuthorizer`, pass the same store as its `usageStore`.
`reconcileAuditOutbox` delivers pending records with their original IDs; the sink
must deduplicate by `AuditEvent.id`. Hosts own recovery scheduling and provider
reconciliation. See ADR 0029; arbitrary remote effects are not an atomic transaction.
