# ADR 0019: An escalation names the authority it needs

- Status: Accepted
- Date: 2026-08-31
- Extends: `docs/adr/0011-escalation-terminal-outcome.md`

## Context

ADR 0011 made escalation a third terminal state and settled how one is resolved:
issuing a grant to the trusted store is host-owned control-plane work, and the
_next_ turn loads it. ADR 0017 published the affordance as a catalogued tool and
gave `AgentTurnDecision` the variant that ends a turn on it. ADR 0018 recovered
the same ending from an MCP call. The mechanism is complete on the model's side.

Two things are missing on the other side, and they are the same omission seen
twice.

**Only a model can start one.** A driver recognises `sharedos.escalate` by name
and ends the turn. Nothing else can. But the component that actually establishes
that authority was missing is `CapabilityAuthorizer`, and it has no way to say
so beyond `allowed: false`. A host whose product policy is "this class of denial
is worth asking a human about" has to detect that outside SharedOS, from a
denial that looks like every other denial.

**A recorded escalation cannot say what it needs.** `recordEscalation(context,
reason)` takes a free-text reason, and `Escalation` carries `reason`,
`reviewer`, `requestedAt`, and a status that is always `pending`. So the host
that ADR 0011 hands resolution to receives prose. To issue the grant that
resolves it, a reviewer — or a control plane acting for one — has to reconstruct
the resource, action, owner, and purpose from a sentence a model wrote.

The cost of both is observable in a real host. Aicoo runs two human-in-the-loop
paths in production, one for cross-agent tool approval and one for its
escalation protocol, and both live entirely outside SharedOS with their own
storage, their own expiry, and their own reason codes. Neither could be
expressed here: the first is a system-initiated ask, and the second needs the
approval to name a capability so it can be turned into a grant. Each host that
hits this will grow the same pair of parallel mechanisms, which is the outcome
ADR 0011 was written to prevent for the terminal state and did not cover for the
payload.

`CapabilityRequest` already exists for exactly this. `docs/security/permission-model.md`
says it "expresses requested authority for a consent workflow. It is not usable
authority until an eligible issuer turns it into a trusted grant", and the type's
own comment records that no port accepts one yet.

## Decision

Escalation stays one mechanism with one terminal state. It gains a payload, and
the authorizer gains a way to describe what was missing. Neither adds a control
path.

### A denial may describe the authority that would have satisfied it

`AuthorizationDecision` gains an optional `requiredCapability: CapabilityRequest`,
populated only on a `no_matching_grant` denial, where the authorizer already
holds every field it needs: the request's resource and action, and the context's
owner, namespace, purpose, and instant.

It is a description, not an offer. It grants nothing, it is not accepted as
input anywhere, and the denial is still a denial — `allowed` stays `false` and
fail-closed behaviour is untouched. A host that ignores the field behaves
exactly as it does today.

**It discloses nothing the caller did not already hold.** The description echoes
the resource and action the caller just named, together with the owner,
namespace and purpose that were already in its own access context. In
particular it does **not** reveal whether the path exists: the same description
is produced for a path that is absent and for one the actor merely cannot reach,
because the authorizer never consults a provider to build it. That property is
stated here so it is not later "improved" into an existence oracle by populating
the field from anything a provider knows.

It is deliberately absent from the other denials. `grant_exhausted` names a
grant that exists, and the infrastructure denials name a fact SharedOS could not
establish; describing a capability for either would suggest that issuing one is
the remedy when it is not.

### An escalation may carry it

`Escalation` gains an optional `request: CapabilityRequest`, and
`recordEscalation` accepts one alongside the reason. The `escalation.requested`
audit event records it.

`CapabilityRequest` carries a required `id`, `requester` and `requestedAt`, and
**the kernel mints all three** — a host cannot supply them, because a request
the caller authored would be a caller-chosen correlation for a decision the
kernel made. They come from the trusted context and nothing else: `requester` is
`context.actor`, `owner` is `context.owner`, and `requestedAt` is `context.now`.

`id` is **derived deterministically** from those fields together with the
resource and action, not generated randomly. A random UUID would make a
conformance cell that cannot state what it observed: the row would have to
either ignore the identifier or re-derive it, and a manifest that ignores a
field is a manifest that does not check it.

The reviewer is still assumed, the status is still always `pending`, and nothing
inside SharedOS advances it. Resolution is unchanged and still host-owned: the
host turns the request into a grant, and the next turn loads it.

### One mechanism, two triggers

A model that chooses `sharedos.escalate` and a host that escalates a denial its
policy marks as askable produce the same `Escalation`, in the same terminal
state, resolved the same way. The kernel never decides to escalate on its own —
it describes, and the host chooses — so there is exactly one place a turn can
end this way and exactly one queue a reviewer reads.

## Consequences

- The audit record for an escalation becomes machine-readable. A control plane
  can render "@alice's agent needs `files/Memory/project-x: read`" and issue the
  grant on one action, instead of parsing a sentence.
- Escalations remain excluded from denial rates, exactly as ADR 0011 requires.
  Nothing here makes an escalation a denial or a denial an escalation.
- The authorizer does no extra work on the allow path, and none on any denial
  other than `no_matching_grant`.
- A host that already had a consent workflow can retire its parallel record. The
  workflow stays host-owned; what stops being host-owned is the vocabulary for
  saying which capability it is about.
- Conformance gains a row: an escalation recorded after a `no_matching_grant`
  denial names the capability that denial described. It lands with the
  implementation — ADR 0013's gate covers every declared row, so a row added
  ahead of the code would have to be declared `notImplemented` with a reason.
- `CapabilityRequest` stops being a type with no port. It is still not authority
  and still not accepted as input. Its row in `docs/open-items.md` — "define a
  port or delete it" — is closed by **the implementing PR**, not by this ADR: an
  open item is closed by the code that closes it, not by a decision to write
  that code.

### Protocol version

The field is additive and optional for a writer, and still breaking for a
reader: every schema here is `.strict()`, so a reader on the previous version
rejects an envelope carrying the unknown key rather than ignoring it. **The
protocol version is bumped**, on the rule that what decides a bump is whether an
existing peer can still parse what it receives, not whether the author added or
removed a field.

### Open

**How many capabilities may one escalation name?** `CapabilityRequest.capabilities`
is an array bounded at 64, the same bound the contract uses for every other
list, so the number is a payload guard rather than a statement about review.
The kernel-produced path emits exactly one, because one denial describes one
missing capability; a host authoring a request deliberately could name several.
Whether an escalation is answered as a whole — and therefore whether more than
one may be named at all — is **undecided** and does not block this ADR.

## Rejected alternatives

**A third decision value, `allowed | denied | confirm`.** Rejected. It makes
escalation a decision, which is precisely what ADR 0011 refused: "a denial is a
decision SharedOS made, and an escalation is a decision it declined to make."
It also gives a turn a second way to terminate, one the driver does not own, so
`AgentTurnDecision` and the authorizer would each be able to end a turn on the
same event and the record would have to say which did.

**A `ConsentPort` the kernel calls to ask a human.** Rejected as the same
mistake at larger scale. ADR 0011 states there is "no queue, no approval token,
and no resumption, and the omission is the design"; a port whose whole purpose
is to wait for an answer reintroduces all three. Worse, an answer arriving into
a running turn is a second way for authority to enter it, which ADR 0009 closed.
Asking is host work. SharedOS's part is to record what was asked.

**Put the capability in `Escalation.reason` as structured text.** Rejected: it
is a schema behind a string, unvalidated, and it would make the 512-character
bound on `reason` a limit on how many capabilities an escalation may name.

**Leave it as prose and let hosts pattern-match denials.** Rejected. That is the
status quo, and the status quo is two hosts' worth of parallel approval
machinery that SharedOS cannot see, cannot audit, and cannot test.
