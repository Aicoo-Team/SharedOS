# ADR 0007: Put replaceable runtimes inside a fixed security envelope

- Status: Accepted
- Date: 2026-08-14
- Revised: 2026-09-18. A turn may drain before its deadline stops it, the seat
  is not asked about a result that arrives while it drains, and `retryable` says
  whether running the turn again repeats anything. All three are in the Decision
  below, which describes what ships.
- Revised: 2026-09-18. The standard loop is reached through
  `createStandardRuntime`, which seats one driver and reports that driver's
  manifest; `StandardRuntime`, `ModelRuntime`, `HarnessRuntime` and
  `DriverRuntime` are gone. This ADR also takes in what ADR 0027 decided, the
  envelope holding what a runtime states for the record, so `RuntimeHost` is
  described here whole and ADR 0027 is withdrawn.

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

A runtime also knows things about its turn that a record has to carry: what the
seat was told, and whether the delegate asked for a human. A plugin's outcome
cannot carry them reliably, because three endings return no outcome. A turn
cancelled at its deadline has a plugin that threw at the abort, a plugin can
throw on its own, and an outcome can fail to parse. In each the envelope builds
the result from its own provenance and nothing the plugin had computed reaches
it. The 2026-09-08 live run showed the cost: one stalled turn dropped out of its
column's prompt set, the column folded 28 entries against the others' 29, and
its moved hash read as a reworded prompt.

## Decision

SharedOS separates one-turn execution into two layers:

1. `SharedOSExecutor` is the fixed security envelope. It validates the request,
   checks target-agent admission, computes the effective tool catalog, removes
   grants and issuing authority from runtime-visible context, applies the
   deadline, wraps runtime events, holds what the runtime states for the record,
   records runtime provenance, and closes the capability broker when the turn
   ends.
2. `RuntimePlugin` is the replaceable harness, the occupant of the seat. It
   decides how to run the agent loop and when to return a terminal outcome. It
   receives only a sanitized `RuntimeTurnRequest`, an `AbortSignal`, and a
   `RuntimeHost` capability broker.

### What a runtime is handed: `RuntimeHost`

The host has five members, and a compile-time guard pins the list, so a sixth is
a decision made here and not in a pull request.

| Member       | What it is                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------ |
| `limits`     | The turn's bounded step, tool-call and deadline `RuntimeLimits`                                              |
| `invokeTool` | The one way to have an effect                                                                                |
| `emit`       | Something that happened at a moment, recorded among the turn's events in order                               |
| `annotate`   | A statement about the turn, which the envelope holds and writes on every ending                              |
| `draining`   | An `AbortSignal` saying the turn takes nothing new; see [below](#a-turn-drains-before-its-deadline-stops-it) |

None of them reads authority. `emit` and `annotate` return nothing, and
`draining` tells and cannot be asked.

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

### The envelope holds what a runtime states for the record

`annotate(key, value)` exists for a fact that is true of the turn, not of a
moment in it, and that must survive an ending with no outcome.

- **One write path.** The executor holds a frozen clone of each value under the
  turn and writes it into `ExecutionResult.metadata` on every way out:
  completed, failed, escalated, cancelled, a plugin that threw, and an outcome
  that did not parse.
- **One merge order.** The outcome's own metadata, then the annotations, then
  `runtime`. An annotation outranks the same key on an outcome, because it is
  the statement the envelope holds for every ending. `runtime` is the
  envelope's provenance and nothing a plugin says can replace it.
- **Three refused keys, and one refused value.** It throws a `TypeError` for an
  empty key, for the key `runtime`, for the key `__proto__`, which
  `JsonObjectSchema` drops from every object it reads, and for a value that is
  not JSON. Those are plugin bugs.
- **It never refuses on the state of the host.** A write made while the turn is
  aborted but still open is kept, which is the case the channel exists for. A
  write made after the turn has closed is dropped without a throw. So a call
  site needs no guard, and stating a fact cannot become a `driver_failed` turn
  or a transport fault answered to a harness.
- **The last write to a key wins.**
- **Two keys are defined.** `promptHash`, stated by the standard loop from
  `AgentTurnSession.promptHash` once `open` has resolved, and by
  `createMcpHarnessRuntime` before it binds its port. `escalationAsked`, as
  `{ tool, reason }`, stated by the standard loop, the MCP escalation latch and
  the conformance adversary the moment the affordance is recognised.
- **`emit` keeps its meaning.** It is for something that happened at a moment
  and belongs among the turn's events in order. The adversary's attempt receipts
  stay events for that reason.

The grading rules read an `ExecutionRecord`, and a record carries a turn's events
and none of its result metadata, so a fact stated through `annotate` reaches them
only by being lifted. Two are: `assembleExecutionRecord` lifts `promptHash` into
`system.promptHash`, and `escalationAsked` into the optional
`execution.escalationAsked`, validated on shape, which the judge reads. No
identity hash covers `execution`. An annotation is the plugin's own claim, and
for the ask that is the safe direction of trust: it can only make a row grade
harder, because a pass still needs the turn to have ended `escalated`, which the
envelope alone records.

One hole survives, by construction. A turn cancelled before its runtime had
anything to state, inside a driver's `open` or before the MCP runtime has
composed its prompt, records nothing. No channel can carry a value that has not
been computed.

### A turn drains before its deadline stops it

The deadline reaches a tool handler as an abort, and the usual handler passes
that signal to its I/O. A `transfer_funds` that debits one account and then
credits another, caught between the two when the deadline fires, stops there:
one account debited, the other never credited, recorded `interrupted` (ADR
0023). The record is honest and the effect is still half done.

So a host may give the envelope a grace, `drainGraceMs`, and the turn has two
signals instead of one. The first is aborted a grace ahead of the deadline and
says only that the turn takes nothing new: a tool call asked for from then on is
refused `denied` with `turn_draining` and recorded like any call the envelope
stops. The second is the one there always was, it is the only one a handler is
given, and it fires at the deadline as before. A handler running when the first
fires is left alone and answers with its real outcome; one still running at the
second is stopped and recorded `interrupted`. The turn ends as soon as what was
in flight has answered, `cancelled` with `turn_cancelled`, and never later than
`timeoutMs`.

The grace is inside the limit, not on top of it. A host that set 120 seconds
gets a turn that ends by 120 seconds, and the envelope does not cap the grace
against a request's own `timeoutMs`: a grace no smaller than the limit leaves no
time in which a call is taken, and that choice is the host's. Zero, the default,
is the behaviour before this revision.

Two endings drain, the two the envelope makes itself: the deadline, and an audit
outage before an effect (ADR 0023), which lasts the grace or the time left,
whichever is shorter. A host's own cancellation does not. It asked for a stop
and gets one at once, as it always did.

`RuntimeHost.draining` is the first signal, and the fifth member of the host. It
tells and cannot be asked: its reason is a fixed one of the envelope's, never
what a sink threw. A plugin that ignores it is refused the same calls and
stopped at the same deadline.

### The seat is not asked about a late result

`AgentTurnSession.next` does two things at once: it is handed the last result
and asks the seat what to do next. A result that arrives while the turn is
draining does not reach it, because no new call would be taken and a model does
not answer in the seconds left. Once the turn is draining the standard loop
never starts a new decision, and a result that arrives then ends the loop. A
decision already being made is left to land: one that ends the turn is honoured,
and a tool call is refused.

The late call is not lost. Its id, its tool and how it ended are in the turn's
events as `tool.completed` and in the audit trail, and `retryable` below is
worked out from it. It is not written into a history, because SharedOS keeps
none: a session's conversation lasts one turn, and what an agent remembers
between turns is the host's. A host that carries a conversation forward reads
the turn's events and records the call there itself, so its next turn's model
does not find a transfer asked for and never answered.

### `retryable` says whether running the turn again repeats anything

`turn_cancelled` and `runtime_failed` said `retryable: true` whatever the turn
had done, and a plugin's own failure said whatever the plugin said, which for
the harness adapters is `true` on any harness failure. A host that followed the
flag after a turn had sent a payment sent it twice. The flag answered whether
the kind of failure passes; a host needs to know whether the retry is safe, and
only the envelope knows what the turn's calls went on to do.

The rule is one for every ending that offers a retry, `audit_unavailable`
included. A call counts against it when its tool is a `write` that its
definition does not declare `idempotent`, read from the catalogue the kernel
listed for the turn and never from the plugin. Such a call that came back
anything but `denied`, or is still with the kernel when the turn ends, makes the
ending `retryable: false`. A `read` never counts, so a search that outlived its
deadline is still retried. A plugin's own `true` stands only where the rule
agrees, and its `false` is never raised. The rule rests on the definition's
author: a tool declared `read` that writes brings the hazard back, which is why
the schema calls the classification conservative.

### What SharedOS ships for the seat

"Standard" names the SharedOS-owned default at each layer.

`createStandardRuntime({ driver })` is the standard runtime: the SharedOS loop
with one driver seated. The loop asks the driver what to do next, forwards every
tool call to the envelope, and stops at its own step ceiling. The slot takes any
`AgentTurnDriver`, the narrower model/provider seam. The loop is the same
whichever driver is seated, so the runtime reports the seated driver's manifest
as its own, and a record names what sat in the seat; a driver that states no
manifest is reported as `sharedos.standard`. The loop class is private. There is
no second way to build it and no wrapper that exists only to swap a manifest.

Three drivers fill the slot:

- `StandardTurnDriver`, in `@aicoo/sharedos-adapters`, is the standard driver: a
  model API in the seat, with the catalogue rendered into the model's tool-call
  shape and nothing between the model and the kernel.
- A host's own `AgentTurnDriver`, for a host with a model path of its own.
- `EvalHarnessDriver`, which only evaluation seats. It speaks a vendor's exact
  wire format over a transport, so a vendor's codec can be graded against the
  kernel, and it is the one driver that can declare a step past its budget.

A driver is not a plugin, so there is no factory per driver and none per vendor.
A vendor CLI is seated in a product by `createMcpHarnessRuntime`, the other
`RuntimePlugin` SharedOS ships: the CLI keeps its own loop and its own model and
is served the turn's catalogue over MCP (ADR 0014). A harness declares no step,
so that turn is bounded by `maxToolCalls` and `timeoutMs`.

The original `TurnExecutor(kernel, driver)` remained as a facade until
`0.1.0-alpha.6`, when it was removed: it built exactly
`new SharedOSExecutor(kernel, createStandardRuntime({ driver }))`, which a host
writes itself.

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
- The standard loop remains a small default, and one factory is the whole of its
  public surface.
- Runtime ids and versions become explicit evaluation and incident provenance,
  and a record names the driver that sat in the standard loop without a wrapper
  class per kind of driver.
- Existing `AgentTurnDriver` implementations continue to work; a host changes
  how it seats one, not the driver.
- A fact a runtime states is on the result however the turn ends, and a call
  site that states one needs no guard.

### Costs

- Runtime adapters must translate their native tool calls, events, stopping
  reasons, and cancellation into the SharedOS contracts.
- JavaScript cancellation remains cooperative; an in-process plugin can ignore
  an abort signal and therefore belongs to the trusted computing base.
- A turn with a grace stops taking calls that much sooner, and a turn that only
  read and one that wrote now end with different `retryable` values under the
  same code, so a host that retried every `turn_cancelled` retries fewer.
- A host that builds its own `RuntimeHost`, which only a test double does,
  carries all five members.
- A full streaming or resumable runtime protocol will require additional
  versioned contracts rather than undocumented plugin-specific fields.

## Rejected alternatives

**A settlement budget after the deadline.** Abort the handlers at the deadline,
then wait a separate budget for whatever is still running and deliver its
results. Rejected because the wait protects only a handler written to ignore
its abort, the ordinary one having stopped half-way already, and because it
turns a host's limit into a limit plus a budget. It also needed a versioned
driver extension, acknowledgements bound to a digest of each result, and a new
key on `ExecutionResult` that a strict version 1 decoder rejects.

**A session method that takes a late result into the agent's history.** An
optional `ingest(result)` beside `next`, called while the turn drains, with what
became of each result stated on the turn's record. Rejected because no session
SharedOS ships has a history that outlives its turn, so the method would have no
implementer and the record could only say it was unsupported. Memory between
turns is the host's, and a host has the turn's events to write it from.

**Hand the result over before its outcome record is written.** An observation
handle on each kernel operation, so a slow sink cannot hold a result back.
Rejected because the seat could then act on an effect whose record had not been
attempted, and the next call's decision could enter the trail ahead of it. The
case it was for, a sink that never answers, is closed where every such write
already passes: `auditWriteTimeoutMs` (ADR 0023).

**A second host signal that asks for a graceful stop.** Rejected for now. A
host's cancellation stays the immediate stop it was, and nothing a host waits on
drains. It is an addition if a host asks for one.

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

**State record facts as runtime events, behind one shared guard.** The first
fix for the lost prompt hash sent both facts through `emit`, since
`ExecutionResult.events` survives cancellation. `emit` refuses on a closed or
aborted host, and a refused record-only event must not become the turn's
outcome, so every call site needed a guard; centralising it still left a
reporter option on each runtime, a fallback rule in the assembler, and a reader
that inferred from the event order a fact the producer held as a value.

**Have the envelope compute the prompt hash.** The envelope never sees the
text. A driver or a harness runtime composes it, and the envelope's
`RuntimeTurnRequest` is the input to that composition, not its result.

**Let `annotate` refuse on a closed host, as `emit` does.** That restores the
per-site guard. The MCP latch would answer a harness with a transport fault for
a call SharedOS had accepted, which is the failure the guard existed to prevent.

**Carry the result's metadata into the record whole.** The record's `execution`
block is strict on purpose: metadata is opaque host and plugin data, and the
grading rules must not come to depend on an unvalidated key. A typed, validated
field per fact keeps that line where ADR 0008 and ADR 0022 drew it.

**Move the adversary's attempt receipts onto `annotate`.** Declined. A receipt
is ordered against the `tool.requested` and `tool.completed` events around it,
and a crash terminal is graded on the receipts issued before the throw. That is
what `emit` is for.

**A runtime wrapper per kind of driver, or a deprecated alias for the loop
class.** `ModelRuntime` and `HarnessRuntime` wrapped the loop only to report the
driver's manifest in place of `sharedos.standard`, and `StandardRuntime` was the
loop under a name that read as a runtime with a model in it. The loop reports
its driver's manifest itself, so the wrappers had nothing left to do, and an
alias would keep a name in the SDK whose only effect is to delay one line of a
host's migration.
