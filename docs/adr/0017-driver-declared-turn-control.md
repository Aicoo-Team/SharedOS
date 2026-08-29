# ADR 0017: What a driver may declare about its own turn

- Status: Accepted
- Date: 2026-08-28
- Amends: the vendor-harness consequence in
  `docs/adr/0011-escalation-terminal-outcome.md`

## Context

Two conformance rows reported themselves structurally unavailable, under reasons
that named a vendor limitation. Neither reason was true. Both were facts about
`AgentTurnDecision`, which is ours.

`RuntimeTurnOutcome` has carried an escalate variant since ADR 0011, and nothing
inside the standard loop could produce one: a driver could offer a tool call, a
completion, or a failure. So every driven column reported the escalation row as
not applicable, explaining that no vendor frame means "ask a human to decide" --
an explanation about CLIs, for a gap in a type no CLI touches.

The step ceiling had the same shape. The envelope enforces its ceiling over the
steps a runtime declares, and inside `StandardRuntime` the loop declared them.
The loop's index stops at `maxSteps` because the loop stops there, so a call at
or past the ceiling could not be made from any driven column at all, and the row
was reported not applicable under a reason that sounded like a fact about
harnesses.

A row that cannot be reached is not evidence of anything. It is a hole in the
matrix wearing an explanation.

## Decision

A driver may declare two things about its own turn, and the envelope keeps
deciding both.

**It may declare that the turn ends in an ask.** `AgentTurnDecision` gains an
escalate variant, and `StandardRuntime` settles the turn on the outcome ADR 0011
already defined.

**The ask is published as a tool.** `sharedos.escalate` is catalogued and
permission-filtered like any other tool, with `ESCALATION_TOOL_DEFINITION`,
`ESCALATION_RESOURCE_PATH` and `ESCALATION_ACTION` exported from
`@aicoo/sharedos-runtime`. An agent holding no grant over it does not see it.

It is nonetheless never invoked. Both drivers recognise the name and return an
escalate decision, so no `ToolCall` is built and the kernel is never asked. The
registered handler exists to put the tool in the catalogue and to fail loudly --
`escalation_not_terminated` -- if some driver forwards it anyway, because a call
that quietly succeeded would record an escalation the envelope never terminated
on.

**The catalogue gates the name.** Ending a turn on the name skips the envelope,
and with it the envelope's check that the tool was published to this agent. So
a driver honours the name only when its turn's catalogue holds
`sharedos.escalate`, read from the same `RuntimeTurnRequest.tools` it offered
the seat's occupant; a call naming the affordance on a turn that was never
granted it is passed through and refused `tool_unavailable` like any other
unpublished tool. Without this, a model that emitted the fixed name -- guessed,
or remembered from another turn -- would end the turn `escalated` and deliver
its text to the owner with no grant behind it, which is the alternative rejected
below wearing a different hat.

The envelope holds the same gate from outside. A replacement plugin is a
replacement for exactly the driver's check, and a limit only the reference
implementations honour is not a limit (ADR 0012), so `SharedOSExecutor` repeats
it against the catalogue the turn was actually served: an `escalate` outcome
from any runtime plugin whose turn's catalogue does not hold the affordance is
refused, and the turn fails `tool_unavailable` -- the code the envelope already
uses for a call outside the catalogue, from the same boundary. Nothing reached
the kernel, so nothing is audited; as with every envelope refusal, the event
stream (`turn.failed`) is the record. It is `failed` rather than a new status
because a runtime returning an outcome it was not allowed to return is a
runtime misbehaving, the case `invalid_runtime_outcome` already covers.

**It may declare the step it is calling at.** `AgentTurnDecision.tool_call`
carries an optional `step`, and `StandardRuntime` uses `decision.step ?? step`.
A driver that says nothing is bounded exactly as before. One that names a step
is refused for it if the envelope disagrees, because **declaring a step is a
claim, not a permission**: nothing a driver says widens what it may do. The
claim reaches forward only: `StandardRuntime` refuses a declared step behind its
own position as a malformed decision (`invalid_driver_decision`), since the
declaration exists to reach past the budget and a position the loop has already
passed is not that -- it is a claim the loop can see is false.

**A call the driver reached for is attributed to the driver.** Where the seat's
occupant asked for an ordinary call and the driver reached past the budget on
its behalf, `ColumnLimits.driverIssued` says so, the cell carries the attempt
ids, and the table prints `pass (driver)`. In a column where every other pass
means the harness or the model chose the call, an unmarked one would put the
driver's doing under their name.

## Consequences

- Asking for a human is an affordance a host grants, not something a runtime has
  by existing. A host that publishes no escalation grant has agents that cannot
  escalate, and that is the intended arrangement rather than a gap in it.
- ADR 0011's consequence that "a vendor harness column cannot produce one" no
  longer holds and is amended in place: a driven column produces one by calling
  the affordance, because it is a catalogued tool rather than a frame the vendor
  protocol has to carry.
- The escalation row moves the four vendor columns from not applicable to pass,
  113 to 117, and the world set hash from `b3ed312d` to `fca58c64` -- the world
  having gained a tool, a namespace, and the grant that makes it visible. The
  step declaration takes 117 to 121 and not applicable 8 to 4, world set hash
  `fca58c64` to `c75490de`.
- The MCP columns keep the escalation row as not applicable, under a reason that
  is now true of them specifically: on that path tool calls leave over MCP
  rather than over the driver's decision channel, so a call to the affordance is
  answered by the kernel instead of ending the turn.
- Below the ceiling, the record carries the step as the runtime declared it.
  The envelope enforces the ceiling and the distinct-step count (ADR 0012), not
  the truth of a position: a replacement plugin's steps are its own claim about
  its own loop, and `tool.requested` / `tool.completed` record that claim,
  which is what `RuntimeToolInvocationOptions.step` has always meant. The
  attribution of a reach past the budget to the driver rather than the seat's
  occupant lives in the conformance report -- `ColumnLimits.driverIssued`,
  `pass (driver)` -- not in the runtime record, and this is the intended split:
  the record says what position was declared, the report says who declared it.
- One condition's world widened: the step ceiling row runs at two steps rather
  than one, because a driven column gets one call per turn of the loop and at
  one step the loop ended underneath the attack. It is the only condition whose
  world this changed.

## Rejected alternatives

**Infer the ask from what the model said.** An assistant message that sounds
like it wants a human is a phrase, and grading it would make the row measure
prose rather than a choice. A tool call is a choice with a name.

**Give every runtime escalation implicitly, ungranted.** Rejected because it
makes the row test whether the affordance exists rather than whether its holder
chose it, and because it hands every agent a channel to the owner that no host
opted into.

**Let a declared step widen the budget.** Rejected: it inverts the envelope. The
declaration exists so a driver can be refused accurately, not so it can place
itself where refusal does not reach.

**Leave step numbering to the loop.** Rejected as the status quo that made a
whole class of ceiling behaviour unreachable while labelling the gap a harness
limitation -- the failure this ADR exists to correct.
