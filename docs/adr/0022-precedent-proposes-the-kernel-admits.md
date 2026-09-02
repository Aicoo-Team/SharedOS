# ADR 0022: A precedent proposes; the kernel decides whether it may

- Status: Proposed
- Date: 2026-09-02
- Extends: `docs/adr/0019-escalation-names-the-authority-it-needs.md`

## Context

ADR 0011 made escalation terminal and settled how one is resolved: the host
issues a grant to the trusted store and the next turn loads it. ADR 0019 gave
the record a payload, so the reviewer receives a `CapabilityRequest` instead of
a sentence. Neither says anything about the second time the same question is
asked, and the answer today is that it costs another human. A system whose only
way to widen authority is a person, and which never remembers what that person
decided, asks the same person the same question until they stop reading.

Hosts are already answering it, outside SharedOS. Aicoo runs two precedent
lookups: `findRelevantPrecedents` over resolved escalations, and
`findToolApprovalPrecedent` for cross-agent tool approval. Both hold their own
storage, expiry, and vocabulary, which is the same parallel-machinery outcome
ADR 0019 was written to stop for the escalation payload and did not cover for
what happens next.

Two specific things in that host motivate the shape below, and neither is a
complaint about it — both are the right instinct meeting a boundary that does
not exist yet.

**`exactOnly` is the right instinct and too blunt.** The authorization path sets
`exactOnly: true`, under a comment that says authorization decisions must never
inherit social similarity fallbacks. That is correct, and it is correct about
one case out of three. `findRelevantPrecedents` returns an empty list before any
non-exact strategy runs, so the switch also turns off auto-**deny** on similar
evidence, and turns off approving something narrower than what was asked. The
second is not hypothetical in that host: `allow_redacted` is already a decision
value a human can pick, and the automatic path can never produce it. What the
switch is really reaching for is a rule about direction — fuzzy evidence may
narrow, never widen — and a boolean cannot express a direction.

**A precedent must be keyed on effective capability, not on the grant set.**
Aicoo's `grant-adapter.ts` grants two whole unmodelled buckets, `web` and
`pulse-legacy`, deliberately: the second is the fallback bucket that catches
every tool name no other rule matches, and they are granted so that SharedOS
does not become silently stricter than the behaviour it is shadowing. It also
deliberately does not translate `toolAccess.allowedTools`, because importing
that union-shaped axis would rebuild the permission cross-product the boundary
exists to remove. The file states the consequence itself: effective authority is
`Pulse ceiling ∩ SharedOS grants`.

So the grant set alone reads **wider than reality**. A precedent keyed on it
would record that a human approved authority the tool map was quietly holding
down, and the next auto-decision would cite that record to justify the wider
thing — a widening produced by nobody, from a decision that was never made. This
is where ADR 0020 stops being an accounting improvement: the host ceiling as a
port is what makes "effective" a value the kernel can name at all. Without it,
"effective capability" is a phrase about a host's internals, and there is
nothing to key on.

## Decision

SharedOS learns what a precedent is, and learns to judge one proposal about it.
It does not learn to make the proposal.

A **precedent** is a resolved escalation: the `CapabilityRequest` ADR 0019
records, the decision a human made about it, and — when that decision was an
approval — the grant it produced. Nothing new is stored to have one; a host that
records escalations already has the material.

### The host proposes; the kernel admits

The host may compute a proposal however it likes: exact key match, Jaccard over
tool names, embeddings, an LLM, a model trained on its own history. The kernel
does not rank, score, learn, or improve. It answers one question about a
finished proposal — **may this be decided without a human?** — and the proposal
carries no similarity score, no confidence, and no match type, because a field
the kernel is handed and must ignore is a field a host will eventually expect it
to honour. (ADR 0009 rejected a context that carried `grants` the kernel ignored
for the same reason.)

That separation is the entire point. It lets a product's matching get better
every quarter without the kernel ever having to trust a similarity score, and it
means the thing a security review reads is four rules and not a model.

### Exactness is derived, not declared

A proposal names the precedents it cites, by request id. ADR 0019 already
derives `CapabilityRequest.id` deterministically from the requester, owner,
resource, and action, precisely so that a conformance cell can state what it
observed — and that determinism does a second job here. The kernel re-derives
the id for the request now in front of it and compares. Equality **is** an exact
key match; anything else is fuzzy evidence.

So the host never asserts "this was exact". It could not be trusted to, since
the assertion is exactly what R1 gates, and a rule enforced against a
self-report is a rule enforced against honest hosts only.

### The four admission rules

**R1 — fuzzy evidence may only narrow, never widen.**

| cited evidence | proposed outcome | admissible                          |
| -------------- | ---------------- | ----------------------------------- |
| exact          | deny             | yes                                 |
| exact          | allow            | yes, at the precedent's width       |
| fuzzy          | deny             | yes                                 |
| fuzzy          | allow            | no — downgraded to `allow_narrowed` |

A denial needs no width, so similar evidence can carry it: refusing something
resembling a thing this owner has refused before takes nothing away that was
not already absent, and the worst case is an escalation the owner never sees,
which is the case that exists today for every request.

An allow is the opposite: it is the only outcome that creates authority, so it
is the only one where "close enough" would be a widening nobody authorized. A
fuzzy allow is therefore admissible only as an `allow_narrowed` that lies inside
**every** precedent it cites — not as a new decision value, but as the same
allow with a capability the kernel has bounded. Only an exact key match may
authorize at the full width a human approved, because only an exact match is the
same question.

**R2 — never wider than the precedents cited.**

Checked with `capabilityIsWithin`, the predicate `deriveGrant` and the
delegation chain already use: same namespace, same resolved owner, an action set
contained in the precedent's, and a path inside it by segment for `descendants`
or equal for `exact`. Not a second predicate that means roughly the same thing —
ADR 0008 has already paid for what happens when two definitions of "narrower"
drift, and a containment rule that is right in one place and approximate in
another is worse than one that is missing.

The kernel does not construct the intersection of the cited precedents. It
requires the proposal to be within each of them, applying one predicate N times,
which is the same guarantee without an intersection algebra the contract would
then have to define and test. Cited precedents that are disjoint make every
proposal inadmissible, which is the correct answer.

**R3 — take the tightest envelope.** The proposed grant carries the minimum
expiry, the minimum bounded use, the intersection of allowed purposes, and
`delegationDepth: 0` across every precedent cited. An auto-decision may not
outlive, outlast, outnumber, or out-purpose the narrowest human decision it
leans on, and it may not be reissued at all: a machine-made grant that can be
delegated is a machine-made grant whose blast radius is decided by somebody
else.

Two things this deliberately is not. It is not delegation — the auto-issued
grant is issued by the owner, not derived from a parent — so ADR 0008's
`bounded_parent_not_delegable` does not apply and a bounded precedent may still
be cited. And it does **not** bound total consumption across a class. ADR 0008
refused declarative `maxUses` attenuation because counters are per grant, and
that objection holds here too: n auto-decisions citing a k-use precedent carry
n·k uses between them. R3 claims only that no single auto-decision is more
permissive than the narrowest human decision behind it. What bounds the class is
R4.

**R4 — every auto-decision is marked.** The issued grant carries
`metadata.autoDecided`, and the resolution is audited as its own event naming
the cited precedent ids. The principle it exists for is plain: **a learner whose
output cannot be revoked wholesale must not be allowed to run.** A product will
improve its matcher, and some improvement will be wrong; the difference between
that being an incident and being a rollback is whether the operator can select
everything the matcher produced and revoke it in one action, without
distinguishing it by hand from what people decided.

`metadata` is otherwise opaque host data, and ADR 0008 refused to put the parent
link there for exactly that reason. This one key is reserved and validated
instead — which is consistent, not an exception, because 0008's objection was to
_authority_ depending on unvalidated metadata. `autoDecided` grants nothing and
removes nothing. It is a handle, and what has to be reportable is that the
handle is present, which only a validated key makes checkable.

The kernel does not write grants; the host's store does. So R4 is enforced at
admission — a proposal that does not declare the marker is inadmissible — and
honoured at issue by the host, the same division ADR 0011 already draws around
resolution.

### Where this happens, and where it does not

An auto-decision is made where the human's decision would have been made: in the
host's control plane, between turns, against an escalation that is already
terminal. The turn that escalated ended when it escalated. Nothing here resumes
it, queues it, or waits for it, and the next turn loads the grant like any
other.

## Consequences

- Auto-deny and approve-but-narrower become reachable for the first time, which
  is the half of the useful behaviour `exactOnly` currently switches off along
  with the dangerous half.
- A host can replace its matcher — heuristic to embedding to model — without a
  kernel change, a protocol version, or a security review of the matcher, since
  what the review reads is R1 through R4 and those do not move.
- The kernel gains no ability to widen authority. Every admissible outcome is a
  deny, an allow at a width a human already approved for the identical request,
  or an allow strictly inside one. There is no input to admission that makes it
  more permissive.
- Precedents keyed on effective capability means a host that installs no
  `HostCeiling` (ADR 0020) keys on its grant set, which for that host is the
  same thing. A host that has a ceiling and does not install it can still cite
  precedents, and they will be wider than its reality — so the keying rule is a
  reason to land ADR 0020's port, not a check that can substitute for it.
- Conformance gains rows, and they land with the implementation rather than with
  this ADR: ADR 0013's strict gate covers every declared row, so a row added
  ahead of the code has to be declared `notImplemented` with a reason. The rows
  worth declaring are the four R1 cells and one for a proposal citing disjoint
  precedents.
- An operator can answer "what did the machine decide on our behalf, and what
  did it cite" from the audit stream, which is the question that decides whether
  a matcher stays turned on.

## Rejected alternatives

**The kernel computes similarity itself.** Rejected. It would put a ranking
function inside the one component whose whole value is that it is deterministic
and reviewable, and it would freeze one notion of similarity into a protocol
that hosts with very different corpora have to share. It also gets the trust
direction backwards: a kernel that computes the score has to trust its own
score, whereas a kernel that only bounds a proposal never has to trust one at
all.

**A `pending` grant state.** Rejected, and it is not merely undesirable — it is
unrepresentable. The `GrantSource` contract answers with the grants an actor
holds, and every one of them is evaluated for activity at the turn's admission.
A grant that is present but not yet authority would be a fourth thing beside
active, expired, and revoked, and every consumer that reasons about "what this
actor holds" — the authority snapshot, reach, the card of ADR 0021 — would have
to learn to subtract it, including anything that later describes an agent's
reach. A decision that has not been made is not a weak grant; it is no grant.

**Resolve inside a running turn.** Rejected: ADR 0011 closed it, ADR 0019
reaffirmed it against a `ConsentPort`, and an automatic answer makes it more
tempting rather than less, because the latency argument for waiting disappears.
The objection does not: an answer arriving into a running turn is a second
channel for authority to enter it, which ADR 0009 closed, and a turn that could
be auto-approved mid-flight is a turn that can widen its own authority by asking
in a way its own host will match.

**A third decision value.** Rejected, for the reason ADR 0019 already gives:
`allowed | denied | confirm` makes escalation a decision SharedOS made, which is
exactly the distinction ADR 0011 exists to hold. `allow_narrowed` is not that
value — it is an ordinary allow whose capability the kernel bounded, it
serialises as `allowed: true`, and nothing switching on the decision needs a new
case.

**Key a precedent on the adapter's raw grant output.** Rejected on the evidence
in Context. Where a host holds authority down outside its grant set, the grant
set overstates what a human approved, and a precedent is a record of what a
human approved. Keying on the wider set teaches the system an authority nobody
granted, and it does so most in exactly the deployments that were being careful.

**Let the kernel decline a proposal by escalating it.** Rejected. An
inadmissible proposal is not an event: the escalation it concerns is already
recorded and already waiting for a human, and manufacturing a second one would
double-count in every denominator ADR 0011 was careful about. Inadmissible means
the auto-decision does not happen and the request stays where it was.
