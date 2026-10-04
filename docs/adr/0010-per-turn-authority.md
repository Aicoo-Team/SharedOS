# ADR 0010: Resolve authority once per turn

- Status: Accepted, amended by
  `docs/adr/0016-expiry-is-instant-bound.md`
- Date: 2026-08-21
- Revised: 2026-09-20. The per-operation path this ADR kept behind
  `MID_TURN_AUTHORITY_REFRESH` is removed. "The old path" below says what it was
  and why it went; the turn of one operation is unchanged.
- Revised: 2026-10-04. A turn's identity takes the execution id, which the
  executor copies onto the context, so two executions that agree on every other
  field no longer share a lease, and a second run under an id that is still
  running is refused. An open with no id that finds a lease installed while it
  was loading joins it. All in the Decision below.
- Supersedes: the per-operation resolution decided in
  `docs/adr/0009-trusted-grant-source.md`

## Context

ADR 0009 made `GrantSource` the only way authority enters SharedOS, and had
`SharedOSKernel` call it once per kernel operation. A turn with _N_ tool calls
performed _N + 2_ loads, and a grant revoked while the turn was running was
refused at the next decision inside that same turn.

That is a defensible revocation posture and a poor execution model. A turn is
the unit SharedOS admits, records, and reports on, and under per-operation
resolution one turn could span several authority states: a request could be
admitted under one set of grants and finish under another, with no point at
which the turn as a whole was authorized. The evidence layer had to carry the
consequence — `AuthorityRecord.snapshots` is a list precisely because a turn
could observe more than one state, and `stableAuthorityHash` existed only to say
"this time, it did not".

It also read as an asynchronous update. A request is constructed against the
authority the caller believes it has, and then authority is resolved underneath
it, repeatedly, while it runs. The grant store fed the kernel directly rather
than passing through the turn, so what a turn was permitted to do was not fixed
when the turn began.

ADR 0009 considered and rejected per-turn resolution, on three grounds: it would
put the boundary above the kernel, leave direct kernel callers unprotected, and
make mid-turn revocation unobservable. The first two were objections to
implementing it in the executor. The third is real, and is now the accepted
trade-off rather than a defect.

## Decision

Authority is resolved once, at the turn boundary, and held for the turn.

`SharedOSKernel.openTurnAuthority(context)` loads authority through the same
`TrustedAuthorityResolver` and registers it against the turn's identity —
namespace, actor, issuing authority, owner, purpose, trace, and `executionId`
when the context carries one. Every kernel operation presenting that identity is
answered from the held state, with no store read and no second
`authority.resolved` event. The handle is closed on every path out of the turn,
including cancellation.

Three properties follow from where the boundary sits:

- **The kernel still owns it.** ADR 0009's first objection is answered by
  keeping resolution inside `SharedOSKernel`. The executor opens and closes a
  handle; it never receives grants, and the handle is not assignable to an
  `AccessContext`, so it cannot reach a provider, tool handler, transport, or
  runtime.
- **Direct kernel callers stay protected.** An operation with no open turn
  resolves its own authority, which is a turn of one operation. ADR 0009's
  second objection does not apply.
- **A nested call is inside the same turn.** A tool handler that calls back into
  the kernel — `sendMessage`, `invokeResource` — receives only an
  `AccessContext` and could not carry a handle even if it wanted to. Registering
  by turn identity rather than by handle is what keeps those calls on the turn's
  authority instead of re-reading the store behind it.

An unavailable source is held too. A turn that could not establish authority
stays fail-closed for its whole length rather than retrying the store on each
call and possibly changing its mind.

### One execution is one turn

Namespace, actor, authority, owner, purpose and trace say who is acting and
why. They do not name a run. A host may start two executions that agree on all
six, and an inbound message has to run under its sender's trace, so two
messages to one recipient do. While both were open the second was answered from
the first's lease: it was decided against authority loaded before it began,
wrote no `authority.resolved` of its own, and was served the first's catalogue
(ADR 0026). A revocation made between the two starts was not the next-turn
event this ADR promises.

The protocol already names a run: `ExecutionRequest.executionId`. So
`AccessContext` carries an optional `executionId` and it is part of the
identity. `SharedOSExecutor` copies the request's onto the context it opens the
turn with, over anything the context arrived with, and the kernel hands the
context to a tool handler as it received it, so a nested call stays on its
turn. It confers nothing and is an in-process value: the HTTP request schemas
omit the context, and the runtime plugin's request is built without it.

One execution id is one turn. A second open under an id whose turn is still
open is not joined. It rejects with `ExecutionInProgressError`, read off the
lease table, which is already the record of what is running: no store is read
and the open turn is untouched. The executor ends that run `denied` with
`execution_in_progress`, and the turn-end record carries it to audit. Joining
would have decided the second run against the first's authority and run its
work twice. This is not replay protection. Nothing is kept once a turn closes,
and an id that has finished can run again.

A context without an id is identified by the other six fields, as before. Opens
that present one identity share one lease, which is released when the last of
them closes. Two such opens can also race, each finding no lease and loading.
The one that finishes second joins the lease the first installed. It used to
replace it, so the first's close removed the entry the second was holding and
the rest of that turn resolved per operation. Both loads are audited, and the
turn decides against the first.

### Removals are frozen together

> Amended by ADR 0016. Expiry is now decided at the instant of the operation;
> everything else below still holds. The section is kept as written because the
> reasoning that follows it — the fuse, and why the alternative was rejected —
> is what ADR 0016 answers.

Every way a grant leaves an actor's authority runs through one check,
`grantIsActive`: not yet active, expired, revoked, or withdrawn from the
requested purpose. That check is evaluated against `now` on the context carried
by the turn's resolved authority — the instant the turn was admitted — so all
four are observed by the _next_ turn.

Audit still records the live instant of each decision. The freeze governs what
was decided, not when a record says it happened.

### The old path

Per-operation resolution, as ADR 0009 specified it, was first retained rather
than deleted. `MID_TURN_AUTHORITY_REFRESH` in `packages/core/src/authority.ts`
was the fuse: an exported `const false` which, set, made the turn handle report
the boundary outcome but hold nothing, so every operation resolved its own
authority.

It was off, and carried the open question it existed for:

> TBD Expiry with mid-turn grant refusal.

Revocation is a store-side edit and is naturally a next-turn event, because
SharedOS cannot see it without re-reading the store. Expiry is not: it is a
property the grant already carried when the turn began, so refusing it mid-turn
costs no store read and leaks no store state. The two were frozen together only
because they shared one removal check.

ADR 0016 settled it: expiry is decided at the operation's instant and every
other removal at the turn's, so a turn no longer outlives the validity window of
the authority that admitted it. That needed nothing from the fuse. What was left
behind it was one behaviour and no open question — observing a store edit
without waiting for the next turn — at the price of the store read per operation
this ADR exists to remove. No host could set it, because it was a constant and
turning it on meant patching the package, and no test did. It is removed, and
with it the only second way authority was ever resolved inside a turn.

What is not removed is the operation with no open turn. That was never the old
path: it is a turn of one operation, stated above, and the HTTP surface and a
host serving MCP outside a turn both run on it.

## Consequences

- A revocation recorded while a turn runs is observed by the next turn. A host
  whose revocation SLA is shorter than its maximum turn length must bound turn
  length, not rely on the kernel. (Since ADR 0016 an _expiry_ is observed inside
  the turn, so a short-lived grant is one way to bound it.)
- One authority load per turn instead of _N + 2_. `cost.authorityLoads` falls to
  1 for a turn of any size, which changes the Table 6 _Capability
  authorization_ row from a per-call cost to a per-turn one.
- Every decision in a turn names one authority state.
  `AuthorityRecord.snapshots` holds exactly one entry and `stableAuthorityHash`
  is always set. Both are kept rather than collapsed: a host may still make
  kernel calls outside any turn, each of which resolves its own.
- **The grant-store conformance row moves to the turn boundary.** With one load
  per turn there is no mid-turn outage to inject: an unavailable store refuses
  the turn at admission, the runtime is never started, and no attempt exists to
  be denied. The row is now graded on the turn's terminal outcome, and its
  declared attempts are reported as structurally unreachable rather than as
  never exercised. See `ConformanceCondition.expectTurn`.
- A turn refused this way has no authority state to name, so record completeness
  no longer treats a missing snapshot, or a decision without an authority hash,
  as a required gap when the decision failed closed. Demanding an authority
  state from a turn that could not establish one would report every correct
  fail-closed turn as unusable evidence.
- Bounded use is unaffected. `maxUses` is a counter, not authority, and is still
  consumed atomically per operation.
- A host that retries an execution under its id while the original is still
  running is refused `execution_in_progress`. It waits for the original, or
  retries under a new id.
- A host that opens turns itself, and may have two open at once for one actor,
  purpose and trace, puts an `executionId` on each context and passes it on
  every call the turn makes. Without one they are one turn.

## Rejected alternatives

**A random id per run, minted by the executor.** Rejected for the execution id.
It isolated two overlapping runs of one execution id as well, by giving the
turn a second identity that appears in no request, event or record. The
execution id is already the name of a run everywhere else, and two overlapping
runs under one id are refused rather than run side by side.

**Resolve per turn in the executor.** Rejected for ADR 0009's original reasons,
which still hold: it puts the boundary above the kernel and leaves direct kernel
callers and nested tool-handler calls resolving per operation.

**Pass the resolved authority to each kernel call.** Rejected because a tool
handler receives an `AccessContext` and nothing else. Threading a handle through
the tool contract would put authority one refactor away from a provider.

**Freeze the grant set but keep the operation's clock.** Rejected here as a
hybrid nobody can reason about: revocation would wait for the next turn while
expiry still landed mid-turn, and the two are the same removal in the same
check. If expiry should be refused mid-turn it should be by an explicit
decision, which is what the fuse's TBD recorded — and ADR 0016 is that decision.
It adopts this alternative for expiry alone, on a rule this ADR did not have:
the operation's clock may only narrow what the frozen grant set authorizes,
never widen it.

**Delete the per-operation path.** Rejected because the expiry question is open.
A fuse that can be pulled makes the alternative testable; a deleted branch makes
it a rewrite.
