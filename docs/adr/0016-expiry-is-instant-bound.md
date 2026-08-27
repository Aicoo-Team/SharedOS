# ADR 0016: Expiry is instant-bound, revocation is snapshot-bound

- Status: Accepted
- Date: 2026-08-27
- Amends: the "Removals are frozen together" section of
  `docs/adr/0010-per-turn-authority.md`

## Context

ADR 0010 resolved authority once, at the turn boundary, and held it. It also
froze every removal together, because every removal ran through one check --
`grantIsActive` in `packages/core/src/internal.ts` -- evaluated against a single
instant: the one carried by the turn's resolved authority. Revocation, expiry,
`notBefore`, and purpose withdrawal were therefore all observed by the _next_
turn.

ADR 0010 recorded that as a deferral rather than a decision, in
`MID_TURN_AUTHORITY_REFRESH`:

> TBD Expiry with mid-turn grant refusal.

The asymmetry it names is real. A revocation is a store-side edit: SharedOS
cannot see one without re-reading the store, and re-reading the store per
operation is the thing ADR 0010 turned off. An expiry is not an edit at all. It
is a field the grant already carried when the turn loaded it, so refusing it
part-way through the turn costs no store read, leaks no store state, and needs
nothing the turn is not already holding.

Freezing them together was never a decision about expiry. It was a consequence
of expiry and revocation sharing one line of code.

## Decision

The two removals are decided at two instants.

- **Expiry** is decided at the instant of the **operation**. A grant whose
  validity window closes while a turn is running is refused at the next decision
  in that turn.
- **Revocation, purpose withdrawal, `issuedAt`, and `notBefore`** are decided at
  the instant the turn's **authority was resolved**, exactly as ADR 0010
  specified.

The rule that separates them is directional, not a matter of where the fact came
from: **the operation's clock may only take authority away.** Expiry narrows, so
it moves with the operation. `notBefore` and `issuedAt` widen — a window opening
mid-turn would hand a running request authority it was not admitted with — so
they stay at admission. Revocation would narrow, and stays at admission anyway,
because SharedOS cannot observe it without the store read ADR 0010 removed.

`grantIsActive` takes both instants. `CapabilityAuthorizer.authorize` and
`canDiscover` accept the operation instant as an option, defaulting to the
turn's; a kernel call outside any turn therefore behaves exactly as before, and
so does any host calling the authorizer directly. `SharedOSKernel` supplies the
instant from the live `AccessContext` the executor already stamps onto every
call, so no new plumbing reaches a provider, a tool handler, or a runtime.

Expiry is evaluated at the later of the two instants rather than at the
operation's alone. The operation's is normally later; taking the maximum means a
host whose clock runs backwards cannot revive an expired grant by presenting an
earlier instant than the one its turn was admitted at.

An ancestor is subject to the same split. `validateDelegationChain` takes the
admission instant alongside `now`, so an ancestor that expires mid-turn
invalidates its descendants at the next decision, and an ancestor revoked
mid-turn does not.

## Consequences

- A turn no longer outlives the validity window of the authority that admitted
  it. A host issuing short-lived grants gets the window it asked for rather than
  the window plus one turn.
- The grant set a turn holds does not change, and neither does the number of
  authority states it observes. `AuthorityRecord.snapshots` still holds exactly
  one entry, `stableAuthorityHash` is still always set, and a decision an expiry
  refused names the same snapshot hash as the decision before it. Expiry narrows
  what one snapshot authorizes; it does not make a second one.
- `cost.authorityLoads` is unchanged at 1 per turn. Nothing here reads a store.
- Discovery moves with execution. `listTools` and the per-call discovery filter
  take the same instant, so a catalogue is not offered on authority that
  execution would refuse.
- `MID_TURN_AUTHORITY_REFRESH` keeps its TBD no longer. What remains behind the
  fuse is exactly one behaviour: observing a store edit without waiting for the
  next turn. It is still off.
- **The mid-turn conformance row becomes two rows.** `revoked-mid-turn` and
  `expired-mid-turn` make the identical call at the identical path at the
  identical position in their scripts and require opposite answers, so one
  script cannot state both. The expiry row also needs one turn where the
  revocation row needs two, which is the finding in the shape of the evidence.
- **The conformance world gains a clock that moves.** Nothing can expire during
  a turn when time does not move, and `CONFORMANCE_NOW` is one frozen instant. A
  condition may now arm a clock that advances one step per mediated operation,
  indexed on the operations recorded in the audit stream rather than on wall
  time, so the run stays byte-identical across repeats. It is opt-in per
  condition and every other condition still runs frozen, so no existing artifact
  moves.

## Rejected alternatives

**Leave both frozen and pull `MID_TURN_AUTHORITY_REFRESH` when expiry matters.**
Rejected because the fuse buys mid-turn expiry only by also buying a store read
per operation, which is the cost ADR 0010 removed and the execution model it
rejected. The two are unrelated problems and should not share one switch.

**Move every removal to the operation instant.** Rejected: it is per-operation
resolution again for revocation, and it lets a `notBefore` window open under a
running request. A turn that can gain authority while it runs is the
asynchronous-update model ADR 0010 was written against.

**Re-read the store when a held grant is near its expiry.** Rejected as the
worst of both: it reintroduces the store read, and it makes whether a revocation
is observed depend on whether some unrelated grant happened to be expiring.

**ADR 0010's own "freeze the grant set but keep the operation's clock."**
Rejected there as "a hybrid nobody can reason about", on the grounds that
revocation would wait for the next turn while expiry landed mid-turn, and that
if expiry should be refused mid-turn it should be by an explicit decision. This
is that decision. The hybrid is reasonable once the rule is stated as a
direction rather than as a pair of exceptions: the grant set is what the turn
was admitted with and never grows; the clock is the operation's and can only
shrink what that set authorizes.
