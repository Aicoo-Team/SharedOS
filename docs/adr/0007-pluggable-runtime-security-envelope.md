# ADR 0007: Put replaceable runtimes inside a fixed security envelope

- Status: Accepted
- Date: 2026-08-14

## Context

SharedOS must support different agent harnesses without making one model loop,
provider, or sandbox architecture part of the operating-system contract. One
host may run a Codex-specific runtime while others use DeepSeek Harness, another
vendor harness, or a private implementation.

The original `TurnExecutor` exposed an `AgentTurnDriver` port, but still owned
the complete model/tool loop. That made model providers replaceable inside one
loop while making a substantially different harness difficult to adopt.

At the same time, SharedOS cannot treat permission evaluation as an ordinary
plugin. A runtime is influenced by untrusted messages, models, retrieved files,
and tool results. Giving it grants, raw handlers, credentials, or an unguarded
registry would let a replaceable harness bypass the security property SharedOS
exists to provide.

## Decision

SharedOS separates one-turn execution into two layers:

1. `SharedOSExecutor` is the fixed security envelope. It validates the request,
   checks target-agent admission, computes the effective tool catalog, removes
   grants and issuing authority from runtime-visible context, applies the
   deadline, wraps runtime events, records runtime provenance, and closes the
   capability broker when the turn ends.
2. `RuntimePlugin` is the replaceable harness. It decides how to run the agent
   loop and when to return a terminal outcome. It receives only a sanitized
   `RuntimeTurnRequest`, bounded step/tool-call/deadline `RuntimeLimits`, an
   `AbortSignal`, and a `RuntimeHost` capability broker.

Every `RuntimeHost.invokeTool` call is checked against the hard tool-call ceiling
and effective catalog, then passed to `SharedOSKernel.invokeTool`, which resolves
the trusted handler, validates arguments, and re-authorizes the exact
resource/action operation.
Runtime-originated observations are represented as `runtime.event`; a plugin
cannot emit authoritative `turn.*` or `tool.*` events directly.

Embedded callers may observe immutable event snapshots through
`ExecuteTurnOptions.onEvent` for live UI delivery. The callback is observational
and cannot replace the final protocol outcome. A transport-neutral resumable
stream remains a future versioned contract.

`StandardRuntime` is the reference implementation of `RuntimePlugin`. It owns
the existing bounded driver loop and retains `AgentTurnDriver` as a narrower
model/provider seam. The original `TurnExecutor(kernel, driver)` API remains as
a compatibility facade over `SharedOSExecutor` plus `StandardRuntime`.

`RuntimeRegistry` is instance-scoped. A trusted host registers plugins at boot
and resolves a runtime from trusted configuration. Runtime selection is not a
field in the model-visible execution request and cannot be requested by a
message.

Each runtime has a JSON-safe manifest containing an id, implementation version,
SharedOS protocol version, and optional descriptive metadata. The executor
places an authoritative manifest snapshot in every execution result so hosts and
evaluation pipelines do not pool outcomes from semantically different harnesses.

In-process runtime plugins are trusted code with the ambient privileges of the
host process. A host that does not trust a runtime must place it behind a
process, container, microVM, or remote adapter and expose only the equivalent
capability-broker protocol.

## Consequences

### Positive

- Standard, Codex, DeepSeek, and host-specific loops can share one files, tool,
  namespace, permission, and audit model.
- Replacing a runtime does not migrate an agent's file-as-memory state or
  silently change its authority.
- The standard loop remains a small reference and fallback implementation.
- Runtime ids and versions become explicit evaluation and incident provenance.
- Existing `AgentTurnDriver` integrations continue to work.

### Costs

- Runtime adapters must translate their native tool calls, events, stopping
  reasons, and cancellation into the SharedOS contracts.
- JavaScript cancellation remains cooperative; an in-process plugin can ignore
  an abort signal and therefore belongs to the trusted computing base.
- A full streaming or resumable runtime protocol will require additional
  versioned contracts rather than undocumented plugin-specific fields.

## Rejected alternatives

**Make every SharedOS component replaceable with no privileged core.** Rejected
because a replaceable tool registry or permission path could invalidate
deny-by-default authorization. SharedOS adopts composability above the security
kernel, not in place of it.

**Keep only `AgentTurnDriver`.** Rejected because a complete external harness
may own its own loop, session log, tool-call scheduling, and stopping semantics.

**Let `ExecutionRequest` select `runtimeId`.** Rejected because messages and
model-visible metadata are untrusted. Hosts may expose a user choice only after
binding it to trusted server-side policy.

**Give runtime plugins direct kernel, registry, or provider access.** Rejected
because the plugin could enumerate hidden capabilities or bypass the exact-call
authorization boundary.
