# ADR 0020: Call freshness is instant-bound and turn-scoped

- Status: Accepted
- Date: 2026-09-01

## Context

The conformance manifest carried `replay_freshness` as a declared,
unimplemented row: "a call carries its own instant and identifiers and nothing
rejects one for having been seen before, so a replay is indistinguishable from
a repeat." The trace was already bound — a call naming another turn's trace is
refused `trace_mismatch` — but a recorded call re-issued under the current
trace, with its captured instant intact, was answered like any other.

The obvious fix is the wrong one. Deduplicating call identifiers assumes the
identifier is fresh evidence, and it is not: a `ToolCall.id` is
presenter-chosen. The model driver passes the model's own tool-call id through
(`packages/adapters/src/model/driver.ts`), and model serving stacks are free to
emit `call_0` on every reply — some do. An id-based freshness port would refuse
legitimate model turns as replays, which for the runtimes SharedOS actually
hosts is not an edge case.

What a replayed call cannot forge is its position in time relative to the turn
it is presented to. A turn has two trusted instants — the moment its authority
was resolved, and the operation instant the executor stamps onto the live
context — and both come from the host, not from the presenter.

## Decision

`SharedOSKernel.invokeTool` refuses a call whose declared `requestedAt` lies
outside its turn's window, as `stale_request`:

- minted **before the turn's authority was resolved** — the instant belongs to
  some earlier turn, which is what "replay a recorded call" means once the
  trace is already bound;
- minted **after the operation instant** — a moment that has not happened;
- carrying **no readable instant at all**.

The check is **turn-scoped**: it runs only under an open turn lease. A bare
kernel call — the HTTP surface, a host calling the kernel directly — has no
admission instant distinct from its operation, and a remote host's clock cannot
be required to agree with this one to the millisecond. Outside a turn the
window degenerates to a point, so applying it there would refuse every honest
remote call and defend nothing: bare calls resolve authority at the operation
itself, which is the freshness a replay would have to beat anyway.

Identifiers stay unchecked, deliberately. A "replay" that mints a fresh instant
inside the current turn and current trace is not a replay at all — it is a new
request, carrying no authority it did not already hold, and authorization
decides it like any other. Nothing about a call id carries authority, so
nothing about reusing one needs refusing.

In the conformance suite, the row is implemented with a control that reads at
the turn's own instant and an attack that re-issues the identical call minted
one second before admission (`AttackAttempt.requestedAtOffsetMs`, arithmetic on
the turn context rather than a clock, so a stale instant is as deterministic as
a fresh one). Only the embedded adversary can issue it: a harness frame carries
no instant and the adapters stamp the turn's own onto every call they
translate, so the driven columns declare the attempt unreachable
(`not applicable`) rather than issuing a fresh-instant call and grading it as a
replay.

## Consequences

- The manifest has no declared, unimplemented rows left. The
  `notImplemented` reporting path remains, pinned by a test on a synthetic
  case, for the next gap.
- A runtime that stamps its calls with anything other than the live context's
  instant (or the turn's admission instant) will be refused inside turns.
  `StandardRuntime`, the model driver, and the adapters already stamp the
  turn's own instant; a custom `RuntimePlugin` that invents instants was
  already lying about time.
- Replay across processes or across kernel restarts is out of scope here: the
  window is derived from the turn lease, not from durable state. A host that
  needs cross-restart replay protection needs a durable record of admitted
  turns, which is evidence-layer work, not a kernel table.
