# @aicoo/sharedos-contracts

Strict, JSON-safe SharedOS protocol schemas and TypeScript types.

```bash
npm install @aicoo/sharedos-contracts
```

Use this package for addresses, capabilities, messages, resources, tools,
runtime manifests/events/outcomes, execution results, audit events, and HTTP
wire contracts.
External boundaries should parse untrusted values with the exported schemas
rather than relying on type casts.

Tool definitions include a logical namespace, source, read/write catalog class,
and exact capability requirement. Access contexts carry the trusted effective
namespace selection; `ToolNamespaceUpdateSchema` defines portable, idempotent
enable/disable patches.

`AuditEventSchema` is the durable shape a host persists. What SharedOS itself
states about an event is a field it names; `metadata` holds what a host port
supplied and the details particular to one event type. It is strict, so a
persisted trail that parses is one the kernel could have written.

SharedOS is currently an `0.x` prerelease.
