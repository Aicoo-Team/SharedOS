# ADR 0027: The envelope holds what a runtime states for the record

- Status: Accepted
- Date: 2026-09-17
- Extends: `docs/adr/0007-pluggable-runtime-security-envelope.md`

## Context

ADR 0007 gives a runtime plugin a `RuntimeHost` with three members: its limits,
`invokeTool`, and `emit`. A plugin returns a `RuntimeTurnOutcome`, and the
outcome's `metadata` is how a plugin says something about the turn that is not
its output.

Two facts are true of a turn and are read from its record afterwards. What the
seat was told, as a content hash over the instructions and the prompt, decides
whether two runs asked the same question: a column's prompt-set hash folds one
entry per turn. That a delegate asked for a human decides how an escalation row
is graded: a turn that never asked proves nothing, and a turn that asked and
ended some other way is a failure.

Outcome metadata cannot carry either one reliably, because three endings return
no outcome. A turn cancelled at its deadline has a plugin that threw at the
abort. A plugin can throw on its own. An outcome can fail to parse. In each the
envelope builds the result from its own provenance, and nothing the plugin had
computed reaches it. The 2026-09-08 live run showed the cost: one stalled turn
dropped out of its column's prompt set, the column folded 28 entries against the
others' 29, and its moved hash read as a reworded prompt.

The first fix sent both facts through `emit`, since `ExecutionResult.events`
survives cancellation. That worked and spread a rule with it. `emit` refuses on
a closed or aborted host, and a refused record-only event must not become the
turn's outcome, so every call site needed a guard. The rule was written three
times: `announceForRecord` with a `RecordAnnouncement` in the standard loop and
in the MCP harness runtime, each reporting to its own `onTurnError` option, and
a bare `try/catch` in the conformance adversary that reported nowhere. On the
reading side the wrapped `runtime.event` layout was decoded by hand in four
places, and the prompt hash lived in two channels at once, with a precedence
rule between them.

Both facts are statements about the turn, not things that happened at a moment
in it. Nothing read where in the event order they fell.

## Decision

`RuntimeHost` gains a fourth member, `annotate(key, value)`, and the envelope
owns what it is given.

- **One write path.** The executor holds a frozen clone of each value under the
  turn and writes it into `ExecutionResult.metadata` on every way out:
  completed, failed, escalated, cancelled, a plugin that threw, and an outcome
  that did not parse.
- **One merge order.** The outcome's own metadata, then the annotations, then
  `runtime`. An annotation outranks the same key on an outcome, because it is
  the statement the envelope holds for every ending. `runtime` is the
  envelope's provenance and nothing a plugin says can replace it.
- **It never refuses on the state of the host.** It throws a `TypeError` for an
  empty key, for the key `runtime`, for the key `__proto__`, which
  `JsonObjectSchema` drops from every object it reads, and for a value that is
  not JSON. Those are plugin bugs. A write made while the turn is aborted but still open is kept,
  which is the case the channel exists for. A write made after the turn has
  closed is dropped without a throw. So a call site needs no guard, and stating
  a fact cannot become a `driver_failed` turn or a transport fault answered to a
  harness.
- **The last write to a key wins.**
- **Two keys are defined.** `promptHash`, stated by the standard loop from
  `AgentTurnSession.promptHash` once `open` has resolved, and by
  `createMcpHarnessRuntime` before it binds its port. `escalationAsked`, as
  `{ tool, reason }`, stated by the standard loop, the MCP escalation latch and
  the conformance adversary the moment the affordance is recognised.
- **`emit` keeps its meaning.** It is for something that happened at a moment
  and belongs among the turn's events in order. The adversary's attempt
  receipts stay events for that reason.

The grading rules read an `ExecutionRecord`, and a record carries a turn's
events and none of its result metadata. A fact stated through `annotate`
reaches them only by being lifted. `assembleExecutionRecord` already lifts
`promptHash` into `system.promptHash`. It now lifts `escalationAsked` into a new
optional `execution.escalationAsked`, validated on shape, and the judge reads
that field. No identity hash covers `execution`.

The wrapped-event ban of ADR 0007 is unchanged: an annotation is metadata, and a
plugin still cannot emit an authoritative `turn.*` or `tool.*` event.

## Consequences

- The refusal rule is gone rather than centralised. `announceForRecord`,
  `RecordAnnouncement`, `handed-prompt.ts` and
  `McpHarnessRuntimeOptions.onTurnError` are deleted; none was released.
  `ESCALATION_ASKED_EVENT` and `escalationAskedEvent` shipped in
  0.1.0-alpha.4 and are a public removal. `TurnErrorReporter` hears only
  contained throws.
- The prompt hash has one statement per runtime. `ModelDriver` no longer
  restates it on terminal metadata, and the MCP runtime no longer restates it
  when it settles.
- Grading rules go to version 5. A record written under version 4 carries the
  `escalation.asked` event and not the field, so the two versions are not
  cell-comparable on the escalation row. No committed cell moves, and no
  prompt-set hash moves, because the hash values are what they were.
- A host that builds its own `RuntimeHost`, which only a test double does, adds
  the member. A plugin author is unaffected.
- The compile-time pin on the host's surface becomes four members. `annotate`
  returns nothing, so it is no more a way to read authority than `emit` is.
- One hole survives, by construction. A turn cancelled before its runtime had
  anything to state, inside a driver's `open` or before the MCP runtime has
  composed its prompt, records nothing. No channel can carry a value that has
  not been computed.
- An annotation is the plugin's own claim. For the ask that is the safe
  direction of trust: it can only make a row grade harder, because a pass still
  needs the turn to have ended `escalated`, which the envelope alone records.

## Rejected alternatives

**Keep the events and centralise the guard.** `announceForRecord` was that
guard, and it still left a reporter option on each runtime, a fallback rule in
the assembler, and a reader that had to infer from the event order a fact the
producer held as a value.

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

**Move the adversary's attempt receipts onto the same channel.** Declined. A
receipt is ordered against the `tool.requested` and `tool.completed` events
around it, and a crash terminal is graded on the receipts issued before the
throw. That is what `emit` is for.
