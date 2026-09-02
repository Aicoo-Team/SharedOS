# ADR 0021: An agent card, with reach computed at read time

- Status: Proposed
- Date: 2026-09-02

## Context

SharedOS can address an agent and can authorize one. It cannot describe one.

An identity here is an `Address` — `{ kind: "agent", agentId }` and nothing
else. That is enough to route a message, enough to name a subject on a grant,
and enough to bind an owner to a resource. It is not enough for the request the
documentation opens with, one agent asking a colleague's agent for something,
because the asking agent has no way to find out what the other can be asked
for. It has to already know, and it learns it out of band: from a product's own
directory, from a human, or from a prompt someone wrote by hand.

So every host that wants that request to work builds a directory, and every one
of those directories computes its answer from something other than the grants
the kernel will decide against. One already has. Aicoo's `TeamAgentCard` carries
a name, a description, skills, a provider, and interface bindings; beside it
`TeamAgentContact` carries `accessibleResources` and `authorityBoundaries`, two
lists that read exactly as "what this agent can reach". Both are derived from an
`agent_permissions` row — the host's own permission model, not the grant set.
The directory can therefore advertise access the kernel would refuse, and cannot
advertise access that arrived any other way. It is not wrong so much as
answering a different question than the one its reader is asking.

The computation is not the missing piece. PR #13 built it for the turn's own
scope: `RuntimeVisibleContext.reach` and `kernel.reach(context)` derive
namespace, path, actions and scope from the grants that would authorize
something at that instant — no grant id, no issuer, no expiry — and a bounded
grant whose budget is spent does not appear at all. What a card needs is that
computation pointed at somebody else. The moment it points at somebody else it
stops being self-description and becomes disclosure, and that is the part that
needs deciding rather than implementing.

## Decision

SharedOS gains a card: the kernel's description of an agent, made of identity,
computed reach, and nothing a product would want to put next to them.

### Reach is computed, never stored

A card's reach is derived when the card is read, from the grants in force at
that instant, by the same derivation `kernel.reach` already performs for the
turn's own scope. It is not a column, not a cached projection, and not written
anywhere.

Storing it guarantees drift, and the drift is in the dangerous direction. A
revoked grant leaves a stored card advertising authority that no longer exists,
and the reader of that card cannot tell — the card looks exactly like a card
that is still true. Every mechanism SharedOS has for making authority go away
works by not matching at the next decision: revocation and purpose withdrawal at
the turn's admission, expiry at the operation, a spent budget at the moment it
is spent (ADR 0016). A stored reach is outside all of them, so it would be the
one description of authority in the system that nothing invalidates. The
refresh job that would fix it is the tell: if a value needs a job to stay true,
it was a query.

Computing it is affordable for the same reason `kernel.reach` is: it reads
already-resolved authority and consults no provider.

The reach of a **subject** requires the subject's authority, and authority is
loaded for the context's actor. The kernel therefore performs a second
`GrantSource.load` under a context it derives from the reader's own — same
`namespaceId`, same `now`, same `authority` — with `actor` set to the subject.
Two properties follow and both are wanted:

- **The card is bounded by one authority.** A reader sees what the subject can
  reach under the authority the reader is itself operating under, not the
  subject's whole life. That is the correct blast radius and it costs no new
  field: `AccessContext.authority` already scopes what a `GrantSource` may
  answer with.
- **It is bounded by one world.** A card read in one namespace never describes
  reach in another, because the derived context carries the reader's
  `namespaceId` (ADR 0004).

The subject's `ResolvedAuthority` is used for exactly one thing — producing the
reach shape — and authorizes nothing. ADR 0009's wrapper is what makes that
checkable rather than promised: it is not assignable to `AccessContext`, so a
subject's grants cannot reach a provider, a handler, or a runtime by accident.

### Reading a card is an authorized operation

A card is served only to an actor holding a capability over the directory:
namespace `sharedos`, path `["directory", <subject>]`, action `read` — a
kernel affordance in the same namespace as `["escalation"]`, granted per subject
with `exact` scope or over a directory with `descendants`. The affordance is
published to the model the way `sharedos.escalate` is, as `sharedos.card`, so
permission-filtered discovery does its usual work: an agent with no grant over
the directory does not see that a directory exists.

Without that gate the directory is an enumeration oracle. Reading a card would
answer "does this agent exist" and, through reach, "what resources exist and
where", for any actor that can reach the kernel at all — and it would answer
positively, in one call, rather than one refusal at a time.

That is precisely the leak the refusal vocabulary is built to close. ADR 0012
gave both enforcement boundaries one code for one refusal, so a caller that
names a tool it may not use is told `tool_unavailable` and cannot tell an
unpublished tool from an unauthorized one. ADR 0019 held the same line on the
other side, requiring a denial's `requiredCapability` to describe an absent path
and an unreachable one identically, "so it is not later 'improved' into an
existence oracle". An ungated card would hand over in a single read the map that
both of those decisions decline to leak, and it would be no less a leak for
having been served deliberately.

The gate is also what pays for the second authority load. Nothing loads a
subject's grants until a reader has been authorized to ask about that subject.

### The card is a view, not a record

A card exists in as many shapes as there are readers authorized to see it. It
is not one public object with a redaction pass applied on the way out.

This is the field-level narrowing PR #35 introduces, used for the first time on
a kernel-owned resource rather than a host one: a `Capability` declares a named
view with a field list and then authorizes that view of its resource and nothing
rawer, matching is exact and never substitutive, and the kernel projects the
provider's answer down to the declared fields before anything leaves the
boundary. A grant over `identity` alone serves a name; a grant over
`identity + reach` serves what the agent can be asked for. A raw read whose only
covering authority is view-bound is refused `view_required` with the servable
view names, so a reader holding the narrow view is told what it may still ask
for.

The alternative is not "no views"; it is a bespoke redaction pass written once
for cards, which is the thing PR #35 exists to stop being written repeatedly.

One limit is real and is stated rather than designed around. Projection is
field-level, so a view may drop `reach` entirely but cannot serve part of one
entry's path. A host that wants a coarser answer — namespaces and counts, no
paths — expresses it as a **distinct named view**, not as a filter applied
inside `reach`. A field that means different things depending on who is reading
is the record shape this section refuses.

### The host's richer card degrades to a renderer

The kernel owns three things: identity, computed reach, and the read gate.
Everything else a product wants on a card — display name, avatar, handle, team
role, connection state, availability, skills, protocol bindings, the
`accessibleResources` prose a person actually reads — stays in the host, which
composes them around the kernel's answer.

The test is not whether a field is useful. `TeamAgentCard`'s fields are all
useful. It is whether the field is authority: reach is what the kernel decides
against, and a display name is not. A kernel that carried avatars would be
carrying a schema it cannot validate the meaning of, could not test, and would
have to version on a product's release schedule — and the first host to want a
field the kernel lacks would put it in metadata, where the next host would find
it and read it differently.

What the host gains for giving up the computation is that its two derived lists
stop being a second opinion. `accessibleResources` and `authorityBoundaries`
become renderings of the kernel's reach, so the directory and the decision agree
by construction rather than by both being maintained.

## Consequences

- A `GrantSource` may now be called with a context whose actor is not the
  caller. An implementation that assumed "actor is whoever is making the
  request" and read a session, a cookie, or an ambient user id instead of
  `context.actor` becomes wrong — silently, and in the direction of answering
  with the wrong principal's grants. This is the only behavioural obligation
  this ADR puts on an existing host and it needs saying loudly.
- A card read costs one authorization and one additional authority load. It
  consumes no bounded use, for the same reason discovery does not: reading that
  a door exists is not opening it.
- Reach on a card is a lower bound on truth, never an upper one. It omits
  authority the reader's authority did not issue, and it is descriptive: every
  operation is still authorized independently, so a stale or over-wide entry
  permits nothing. That is what makes it safe to serve to a model at all.
- Two agents reading the same subject may see different cards, and both are
  correct. Any consumer that caches a card must key the cache by reader, and a
  host that caches across readers has rebuilt the public directory this ADR
  rejects.
- The kernel gains a resource whose representation is a record it composes
  itself rather than one a provider returns, which is new. It is also why the
  governed-view projection applies cleanly: there is no provider that could
  widen the result.

## Rejected alternatives

**Store reach as a field on a card record.** Rejected. It is the one shape in
which a revoked grant keeps advertising itself, and it fails in the direction
that matters: a stale card overstates authority, and the reader has no way to
know. Every proposal to fix it — a refresh job, a TTL, an invalidation hook on
revoke — is a reconstruction of the read-time query with a window during which
the answer is wrong.

**An unauthenticated public directory.** Rejected. It is the enumeration oracle
in its purest form, and it discards the argument ADR 0012 and ADR 0019 both
make about existence: SharedOS deliberately refuses to tell a caller whether a
thing exists, one refusal at a time, and a public directory answers the same
question in bulk. "It only lists agents, not resources" does not survive reach
being on the card, and a directory without reach is not the feature.

**Put the host's display fields in the kernel card.** Rejected. A kernel that
carries `avatarUrl` has taken on a product's release schedule and a schema whose
correctness it cannot state, in exchange for saving each host a join. It also
inverts the dependency rule this repository is organised around: hosts depend on
SharedOS, never the reverse, and a card with a `provider.organization` field
knows the name of a product.

**Compute reach from the host's permission row instead of from grants.**
Rejected, and it is worth naming because it is what exists today and it looks
like a shortcut rather than a decision. A description derived from a different
source than the decision is a second permission model, and the two disagree in
both directions: the row advertises what the kernel refuses, and it cannot
advertise what any other grant allows.

**Serve the intersection of the subject's reach and the reader's own.**
Rejected. It sounds safer and answers the wrong question — a reader wants to
know what the subject can do, precisely because it is something the reader
cannot do itself, and the intersection is empty exactly when the card would have
been useful. Authority scoping does the narrowing instead, and it narrows on a
line someone actually drew.
