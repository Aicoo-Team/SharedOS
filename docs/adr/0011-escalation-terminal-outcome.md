# ADR 0011: Escalation is a terminal outcome, not a denial

- Status: Accepted
- Date: 2026-08-21

## Context

The conformance matrix declares a row for "escalation is requested and
recorded", expecting the request to be recorded and audited with a human
reviewer assumed. SharedOS had nothing to record. A runtime that stopped because
it needed authority it did not hold could only return `fail`, which is what a
runtime returns when it broke, or the host could read the denial that preceded
the stop and infer intent from it.

Both readings lose the fact. "The turn erred" and "the turn asked for help" are
different events, and an execution record that cannot separate them cannot be
used to count either: every escalation inflates the failure rate, and every
denial that preceded one is indistinguishable from a denial the agent simply
took.

The conformance suite had absorbed the confusion. Its record-completeness row
listed a reach for an unexposed control-plane tool as its "escalation attempt",
which redefined escalation to mean over-reach — a refusal the agent did not ask
for and nobody was told about.

## Decision

Escalation is a third terminal state, alongside completion and failure.

- `RuntimeTurnOutcome` gains `{ type: "escalate", reason }`. A runtime declares
  that it stopped and why it needs a human.
- `ExecutionResult` gains `{ status: "escalated", escalation }`, carrying an
  `Escalation`: the reason, the reviewer, the instant, and a status that is
  always `pending`.
- `SharedOSKernel.recordEscalation` writes one `escalation.requested` audit
  event and returns the stub. `AuditOutcome` gains `escalated`, which is
  deliberately not `denied`: a denial is a decision SharedOS made, and an
  escalation is a decision it declined to make. Counting them together would
  inflate every denial rate by the cases where the system correctly asked.
- `ExecutionRecord` carries the escalation and a terminal reason code of
  `escalation_requested`, so a row can be graded on it and an experiment layer
  can count escalations without reading audit.

The reviewer is **assumed, not resolved**: it is the owner the turn already runs
on behalf of. SharedOS has no review roster and does not invent one; a host with
a real one substitutes its own.

## The stub is the whole feature

`Escalation.status` is always `pending` and nothing inside SharedOS advances it.
There is no queue, no approval token, and no resumption, and the omission is the
design rather than an unfinished part of it.

Resolving an escalation means issuing a grant to the trusted store, which is
host-owned control-plane work, and the _next_ turn loads it — the same path
every other authority change takes. An escalation that could be resolved from
inside a turn would be an escalation an agent could grant itself, and a
resumption path would be a second way for authority to enter a running turn,
which is exactly what ADR 0009 closed.

## Consequences

- An escalated turn grants nothing and changes nothing. It is a record and a
  stop.
- A host switching on `ExecutionResult.status` must handle `escalated`. It has
  no `error`, so code that reached for one no longer compiles.
- The conformance row is graded on the turn's terminal outcome through
  `ConformanceCondition.expectTurn`, with its attempts graded normally, because
  unlike a turn refused at the boundary an escalated turn did run.
- The record-completeness row no longer calls an over-reach an escalation. It
  now names that attempt for what it is: an operation refused before the kernel.
- A vendor harness column produces one by calling the affordance, because it is
  a catalogued tool rather than a frame the vendor protocol has to carry. See
  ADR 0017. The MCP columns reach the same ending by a different route, since
  the harness owns the loop there and the ask arrives as a call; see ADR 0018.

## Rejected alternatives

**Escalate by failing with a reserved code.** Rejected because it survives only
by convention. Any consumer that groups failures — a dashboard, a denial rate, a
retry policy — silently folds escalations back in, and the reserved code is
invisible in the type.

**Model the review queue.** Rejected as out of scope and unsafe to guess at.
Review routing, approval, and expiry are host policy, and a wrong model here
would be one every host has to work around rather than one they could replace.

**Let an escalation resume the turn once approved.** Rejected: it is a second
channel for authority to enter a turn that is already running, which contradicts
ADR 0010's single load at the turn boundary.
