# ADR 0010: Resolve authority once per turn

- Status: Accepted, amended by
  `docs/adr/0016-expiry-is-instant-bound.md`
- Date: 2026-08-21
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
namespace, actor, issuing authority, owner, purpose, and trace. Every kernel
operation presenting that identity is answered from the held state, with no
store read and no second `authority.resolved` event. The handle is closed on
every path out of the turn, including cancellation.

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

### The old path is retained, not deleted

`MID_TURN_AUTHORITY_REFRESH` in `packages/core/src/authority.ts` is the fuse.
Setting it restores per-operation resolution exactly as ADR 0009 specified: the
turn handle then reports the boundary outcome but holds nothing, and every
operation resolves its own authority.

It is off, and carried the open question it existed for:

> TBD Expiry with mid-turn grant refusal.

Revocation is a store-side edit and is naturally a next-turn event, because
SharedOS cannot see it without re-reading the store. Expiry is not: it is a
property the grant already carried when the turn began, so refusing it mid-turn
costs no store read and leaks no store state. The two were frozen together only
because they shared one removal check.

ADR 0016 settled it: expiry is decided at the operation's instant and every
other removal at the turn's, so a turn no longer outlives the validity window of
the authority that admitted it. That needed nothing from this fuse, which stays
off. What remains behind it is one behaviour and no open question — observing a
store edit without waiting for the next turn.

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
  kernel calls outside any turn, and re-enabling the fuse must not change the
  shape of the evidence.
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

## Rejected alternatives

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
