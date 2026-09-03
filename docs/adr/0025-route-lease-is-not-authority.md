# ADR 0025: A route lease is not an authority lease

- Status: Proposed
- Date: 2026-09-02

## Context

`MessageTransport` is one method. `SharedOSKernel.sendMessage` parses the
envelope, checks that its sender, purpose, and trace match the trusted
`AccessContext`, resolves the turn's authority, authorizes a recipient-scoped
`sharedos.messaging/send`, and only then calls `deliver`. Everything after the
decision is the host's, and today the only host that has written it is Pulse.

There, the same delivery is around 1,270 lines in `lib/local-agent/messages.ts`
and its neighbours, and it is four things rather than one:

- A **route lease**. A `c2c_comm_sessions` row binds a requester principal and a
  recipient principal to a frozen endpoint and session handle, with a status, a
  grant expiry, and an optional collaboration that can expire or go inactive
  underneath it.
- A **device identity**. The frozen endpoint and session handle name a specific
  device runtime, and `resolveActiveEndpointAndSession` decides whether that
  device is still the reachable one. A message frozen to a route that has since
  moved is not delivered to wherever the recipient happens to be now.
- A **delivery state machine**. `queued`, `queued_busy`, `dispatched`,
  `device_acked`, `runtime_pending`, `runtime_acked`, `runtime_unavailable`,
  `failed`, `revoked`. A message may be parked before it has any endpoint at all
  and dispatched later, when the lease activates, by
  `dispatchMessagesParkedForGrant`.
- A **revocation cascade**. `cascadeDeliveriesTerminal` drives every delivery
  still in `queued`, `dispatched`, `device_acked`, or `runtime_pending` to a
  terminal `revoked` when the session or its collaboration is revoked or
  expires.

Phase 11 of `docs/integrations/pulse-migration.md` moves all four behind
`MessageTransport`. The question this ADR answers is what the extracted package
is allowed to decide, and the answer has been made harder by an accident of
vocabulary: SharedOS and Pulse both call their thing a grant, and both hold it
for the length of something. `TurnAuthorityScope`'s own doc comment already says
"an unclosed lease keeps a stale authority state answering". A
`c2c_comm_sessions` row is also held, also expires, also cascades on
revocation — and authorizes nothing.

Two objects with the same shape and different jobs is how one of them gets
deleted as a duplicate of the other. The specific deletion this ADR exists to
prevent is the plausible one: the kernel has already authorized this send, so
the transport's session check is a second authorization point, and phase 11's
own definition of done says exactly one component decides that an operation is
allowed — therefore drop the check. That reading is wrong, and it is wrong in a
way that produces no test failure and no audit anomaly. It produces a delivered
message the owner had already revoked the route for.

One thing the migration inherits should be named here rather than discovered
later. `requireGrantForMessagePersistence` today answers two questions in one
call: it locks and validates the session row, and it also looks for a standing
`agentPermissions` relationship when there is no accepted collaboration. The
second half is an authorization check. Phase 8 removes it — "a communication
session answers whether the route is still live; it must stop also answering
whether the caller is permitted" — and phase 11 extracts what is left. The two
phases have to land in that order, because extracting the function as it stands
would carry a permission check into a package this ADR says holds none.

## Decision

### The transport implements delivery and decides nothing about authority

`MessageTransport` gains the route lease, the device identity, the delivery
state machine, and the revocation cascade. It gains no grant, no `GrantSource`,
no capability, and no reason to know what a capability is. `deliver` is called
only after `sendMessage` has authorized the send; it is the implementation of
that authorized effect and never a review of it.

This is the same boundary ADR 0015 drew when it made `MessageTransport` and
`MessageRequestRouter` host ports: SharedOS defines authorization, correlation,
validation, cancellation, typed outcomes, and audit at the boundary, and does
not own the queue behind it. Phase 11 moves considerably more code behind that
port. It does not move the boundary.

### The two leases are named apart

`TurnAuthorityScope` is an **authority lease**: the frozen answer to "what may
this actor do", held for one turn, resolved once at the turn boundary
(ADR 0010).

A communication session is a **route lease**: the frozen answer to "is there
still a live path from this sender to this recipient's device", held by the host
store, checked at dispatch.

The names are not decoration. Three rules follow from them and are the reason to
write them down:

- The transport never says "grant". A route lease is granted by nobody in the
  SharedOS sense; it is opened, kept alive, and revoked.
- A lease refusal is never `no_matching_grant`. That code means the authorizer
  found no capability covering the request, and ADR 0012's whole argument is
  that one refusal must not have two names — the inverse also holds, and two
  refusals must not share one. A dispatch refused for a dead route and a send
  refused for missing authority are different findings and a host reading audit
  must be able to separate them, exactly as phase 9 requires policy denials,
  fail-closed denials, and escalations to be separable before any rate is
  computed.
- Revoking a route lease is not revoking authority, and vice versa. An owner who
  revokes a session has stopped one path; the actor's `sharedos.messaging/send`
  capability is untouched and a different live route would still carry a message.
  A host that wants both must do both.

### Authorization does not replace the route-lease check

They answer different questions at different instants.

**Instant one — the turn boundary.** The kernel decides whether the actor _may_
send to that recipient, against the authority snapshot resolved once when the
turn was admitted. By ADR 0010 that snapshot cannot see a revocation that lands
mid-turn, and ADR 0016 did not change it: expiry moved to the operation's
instant, revocation stayed snapshot-bound, because a revocation is a store edit
and seeing one costs the store read that ADR 0010 removed. The staleness is
deliberate and this ADR does not reopen it.

**Instant two — the moment of dispatch.** The transport decides whether the
route is _still live_, against the host's own rows, under the row lock that
already exists. `requireGrantForMessagePersistence` takes `.for('update')` on
the communication session and, where there is one, on its collaboration. A
concurrent revocation must wait for that transaction to commit, so the two
cannot interleave: either the delivery row is written and the revocation
cascades over a delivery that already exists, or the revocation lands first and
the dispatch reads a dead lease.

Between those two instants sits an unbounded interval. This is the part that
makes the argument load-bearing rather than pedantic: **delivery is a side
effect that outlives the decision authorizing it.** A message may be parked with
no endpoint at all and dispatched minutes or hours later, when the lease
activates and `dispatchMessagesParkedForGrant` walks the queue. That function
already re-runs the lease check per parked message, and re-checks that the
current route still matches the frozen one, precisely because the authorization
that admitted the message is by then arbitrarily old. Nothing about that gap is
bounded by the turn.

So an authorization that is deliberately one turn stale cannot be the only gate.
Not because the authorization is wrong — it was correct at the instant it was
made, and the audit record of it stands — but because it was never a statement
about a moment that had not happened yet.

The consequence for the extraction is a prohibition rather than a mechanism:
**a dispatch may not skip its lease check on the grounds that the kernel already
allowed the send.** That is the revocation race, stated as an implementation
shortcut.

### The lock stays in the transport

`.for('update')` moves behind `MessageTransport` unchanged. The port does not
take it over, and does not learn about it.

Three reasons, and the third is the one that decides it:

- It locks rows SharedOS does not own and cannot name. ADR 0002 keeps storage
  host-owned; a kernel that could take a row lock on `c2c_comm_sessions` would
  need to know the table exists.
- The kernel's own authorization takes no lock and must not start. Under
  ADR 0010 authority is resolved once and held for the turn, so a lock taken at
  the turn boundary would be held for the whole turn — across model calls, tool
  calls, and network waits. That is a decision to serialize turns against the
  grant store, which is a much larger change than it looks and is not this one.
- A lock is only meaningful together with the write it serializes. The write
  here is the delivery row's transition, and that row is the transport's. Moving
  the lock up to the port while leaving the write below it would produce a lock
  that guards nothing, which is worse than no lock because it reads like
  protection.

The port's signature therefore does not change: `deliver(context, envelope,
signal)` is already the call in which the lease check, the lock, and the write
all happen together.

### A refused dispatch is a refused delivery, and says so

`MessageDeliveryResult` already carries `denied` and `failed` variants with a
`ProtocolError`, so a transport that finds a dead route has a way to say it
without inventing one. It must use it, and specifically:

- A dispatch refused by a dead, expired, or moved route returns `denied` with a
  route-lease code of the host's vocabulary. It does not return `accepted`.
- The kernel does not upgrade it. `#deliverAuthorizedMessage` parses the receipt,
  requires the message id to match, records it, and returns it verbatim; a
  `denied` receipt stays denied. `messages.request` then fails the tool call with
  `message_request_not_accepted` rather than waiting on the router for a reply
  that is never coming.

This is what "terminate rather than deliver" means at the SharedOS boundary. On
the host side it is the cascade: a delivery already in flight when the revocation
lands is driven to terminal `revoked`, not left queued for a later retry that
would deliver it after all.

### The conformance row

The matrix carries a row for the race, `route-lease-revoked`, and it lands with
this ADR:

> **Invariant:** dispatch a send authorized before the route lease was revoked.
> **Expected outcome:** terminate rather than deliver.

The row is worth stating precisely, because it is easy to write a version of it
that proves nothing. What it grades at the SharedOS boundary is not that a
fixture transport implements a lease — a fixture doing what it was written to do
is not evidence — but that a refusal at dispatch is _reachable_ and is not
overridden: the kernel's own prior authorization does not make the send
undeniable, the refusal is distinguishable in the record from a send that was
never authorized at all, and the turn continues afterwards with the message
undelivered.

Its condition, `lease-closed-between-two-dispatches`, arms the lease on the
transport rather than the grant store, and puts both instants inside one turn.
The turn sends twice to the same recipient on the same authority; the lease is
revoked after the first dispatch is accepted. Nothing in the grant store moves,
so the kernel's decision is provably identical across the two — which is what
makes the second refusal attributable to the route and to nothing else. A
control read afterwards establishes that the dead route ended the dispatch and
not the turn.

The manifest's columns read that refusal from two different places, and the
expectation declares both. A column that sees the tool result reports
`message_request_not_accepted`: delivery was not accepted, so `messages.request`
has no reply to wait for. A column whose receipts are recovered from the
execution record reads the `message.sent` operation, which carries the
transport's own code. Either way the code is one no unauthorized send can
produce — a send with no authority is refused before dispatch, as `denied` with
`no_matching_grant` — so the row cannot be satisfied by a refusal that happened
earlier. That is the naming rule above paying for itself.

### Both deployments run the same suite

Embedded Pulse and a self-hosted deployment pass the same conformance suite, as
phase 7 requires of the HTTP boundary. Stated as an obligation rather than a
description: neither parity column exists today. `packages/conformance` runs the
kernel manifest across an adversary column, the standard harness, and four
scripted vendor adapters, all of them embedded. A transport that behaves one way
in-process and another over a process boundary would be a difference in what an
owner's revocation means, which is the last place a deployment mode should be
visible.

## Consequences

- The transport package is large and holds no authorization decision. Reviewing
  it is a question about correctness of delivery, not about who may send.
- The conformance matrix gains its first row about a decision SharedOS does not
  make. Every other row asks whether the kernel refused something; this one asks
  whether the kernel lets a refusal it did not make stand.
- Two checks stand between a model's `messages.request` and a delivered message,
  and they are not redundant. A reviewer who finds one and removes it as a
  duplicate of the other has reintroduced the race in whichever direction they
  removed.
- A revocation's effect is bounded by the host's dispatch path, not by the
  kernel. A route revoked while a turn runs stops the next dispatch; the send
  capability the turn is holding is unaffected until its next turn, exactly as
  ADR 0010 says.
- Audit gains a refusal that is not an authorization denial. A host computing a
  denial rate must exclude route-lease refusals or it will count a device that
  went offline as a permission failure.
- Phase 8 becomes a prerequisite of phase 11 rather than a neighbour of it. The
  session check has to stop answering the permission question before the code
  that asks it moves into a package that may not answer it.
- The parked-message path is where this matters most and is the least exercised.
  A message that waits for lease activation is the case where the two instants
  are furthest apart, and it is host-scheduled, so no SharedOS turn is running
  when it is dispatched.

## Rejected alternatives

**Drop the lease check; the kernel already authorized the send.** Rejected —
this is the race the row exists to hold. The kernel's answer is about the turn's
snapshot, and the snapshot is one turn stale for revocation by an accepted
decision (ADR 0010). Deleting the dispatch-time check converts that deliberate
staleness into a delivery window, and the delivery is the effect the owner was
trying to stop.

**Move authorization to dispatch instead, so there is one check at the later
instant.** Rejected. It would put a capability decision inside a host port,
which needs grants to reach the transport — the exact reachability ADR 0009 and
ADR 0010 removed, and which `TurnAuthorityScope` is deliberately typed to
prevent. It would also authorize a send the model was told had already been
accepted, and there is no honest thing to do with a denial that arrives after
the tool call returned.

**Refresh the turn's authority before each delivery** — pull
`MID_TURN_AUTHORITY_REFRESH` for the messaging path. Rejected twice over.
ADR 0010 decided the general question, and ADR 0016 settled the one part of it
that was open. And it would not work here even if it were free: the route lease
is not a `CapabilityGrant`, so re-reading the grant store tells the kernel
nothing about whether the recipient's device is still reachable.

**Model the route lease as a `CapabilityGrant` so the kernel can see its
revocation.** Rejected. It fails on its own terms — a grant-shaped route lease
is still resolved into the turn's snapshot, so its revocation would still be
invisible until the next turn, and the race would survive the refactor with a
new name. It also puts device reachability into the grant store, where a
`GrantSource` would have to answer a question about network state.

**Add a `checkRoute` method to the port, and let the kernel call it before
`deliver`.** Rejected. A check separated from the write it guards is a
time-of-check/time-of-use gap by construction: the lock would be taken, released
at the end of `checkRoute`, and the revocation would land in the gap. It also
puts a route concept in the kernel's vocabulary in order to have the kernel ask
a question it cannot act on.

**Let the transport accept the message and terminate it asynchronously.**
Rejected. `messages.request` returns the recipient's reply, so an `accepted`
receipt for a message that will never be delivered leaves the router waiting for
a reply that cannot arrive, and the model has been told the request was accepted.
An outcome the caller can act on is worth more than a queue position.

**Keep the transport's refusal in the same vocabulary as an authorization
denial,** so hosts have fewer codes to learn. Rejected for ADR 0012's reason
read the other way: one refusal must not have two names, and two refusals must
not share one. A dead route and a missing capability call for different
responses — reconnect the device, or ask the owner for authority — and a single
code makes the audit trail unable to tell a host which.
