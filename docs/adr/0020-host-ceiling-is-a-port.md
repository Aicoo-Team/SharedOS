# ADR 0020: The host ceiling is a port, not a convention

- Status: Proposed
- Date: 2026-08-31
- Reverts: the documentation change in `663dd94`

## Context

`docs/security/permission-model.md` on `main` lists twelve steps the kernel
evaluates for each operation. Step 10 is:

> Apply the host ceiling and any non-grant policy constraints.

There is no such call site. `CapabilityAuthorizer.#decide` returns `allow` as
soon as an eligible grant matches a capability and any bounded use is consumed,
and `SharedOSKernel` audits that decision and proceeds. The only "ceiling" in
the kernel is the one a _tool_ declares for itself, which ADR 0012 keeps
deliberately separate and answers with `invalid_tool_requirement`.

That gap is real, and `663dd94` found it first. It resolved it in the other
direction: step 10 was removed, the algorithm renumbered to eleven, and the
actor definition rewritten to say the ceiling "is applied before SharedOS is
asked" — through what a `GrantSource` returns and which namespaces a context
enables — with the kernel having "no policy port of its own". Its reasoning was
that nothing implements the step, that the one shipping host narrows authority
exactly that way, and that a kernel-side port "would be a new trust-boundary
contract needing an ADR, and no host asks for one".

This is that ADR, and it argues the opposite resolution. Taking its three
grounds in turn:

**"Nothing implements it."** True, and the reason this decision has to be made
rather than assumed. A document describing enforcement the code does not have
can be fixed by deleting the claim or by implementing it. `663dd94` deleted it.
The claim was load-bearing, so this ADR implements it instead.

**"The one shipping host narrows authority that way."** SharedEval narrows
through an immutable per-run grant manifest and a per-actor
`enabledToolNamespaces`. That is an experiment harness whose policy is fixed
before the run starts and cannot depend on a request, and for that shape,
upstream narrowing genuinely suffices. Generalising from a host whose policy is
static to a contract that must also serve hosts whose policy is not is the
error. Pulse's ceiling reads the arguments of the call — which file, which
recipient — and cannot be computed when authority is loaded.

**"No host asks for one."** One already built it. Pulse states so in its own
adapter: `toolAccess.allowedTools` "stays a Pulse-side ceiling applied while the
tool map is built, so effective authority is `Pulse ceiling ∩ SharedOS
grants`". The ask is not hypothetical; it is a second enforcement point that
shipped because there was nowhere else to put it.

### Why upstream narrowing is not the same thing

The decisive objection is not expressiveness. It is that upstream refusal is
**invisible and misattributed**.

A host that refuses by withholding a grant produces `no_matching_grant`. That
record says no such authority exists. The truth is that the authority exists and
policy refused it. Those are different facts about a deployment, and today they
are the same row — so a denial that is a deliberate product decision is
indistinguishable from an owner who never granted anything. A namespace refused
by policy is worse: the tool is simply absent from the catalogue and nothing is
recorded at all.

Three consequences follow, and none is reachable by a host doing more work
upstream:

- **The audit record is incomplete.** A call the host's ceiling refused never
  reaches the kernel, so nothing records that a decision was made or why.
- **Denial rates cannot be computed.** "No grant exists" and "a grant exists and
  policy overrode it" cannot be separated after the fact.
- **Conformance cannot reach it.** ADR 0013 makes the matrix the case set, and a
  ceiling applied in host code before the kernel is called has no cell.

### Not a fourth copy of an existing mechanism

SharedOS already narrows in three places, and a port that overlapped them would
be worse than none:

| existing                               | what it narrows                                     | when it can be computed |
| -------------------------------------- | --------------------------------------------------- | ----------------------- |
| `AccessContext.enabledToolNamespaces`  | whole tool namespaces, on or off                    | before any request      |
| `ToolNamespaceSettingsStore`           | the persisted namespace selection, after org policy | at settings write       |
| a tool's declared `requiredCapability` | what that tool may resolve to                       | at registration         |

All three are static with respect to the request: each is fully determined
before the arguments of a particular call are known, and each can be applied
once while a catalogue is built. A ceiling that has to read _this_ request
cannot be any of them.

## Decision

The host ceiling becomes a port the kernel calls, in the position step 10
already assigns it. `663dd94`'s documentation change is reverted and step 10
restored.

```ts
export interface HostCeiling {
  narrow(
    decision: AuthorizationDecision,
    request: AuthorizationRequest,
    context: AccessContext,
  ): AuthorizationDecision;
}
```

**The signature is synchronous, and that is the enforcement.** "Deterministic
and cheap" cannot be asserted in prose and then relied on. A synchronous return
cannot await a network call or a model call, so the constraint is carried by the
type rather than by a comment. A timeout was rejected for the same reason it
would fail as a conformance signal: what it admits depends on how fast the
machine is, so the same ceiling could pass on one host and fail on another.

- It is consulted **only after a grant has matched**, on an `allowed` decision.
  A denial is never shown to it, so a ceiling cannot turn one into an allow.
- It may return only the decision it was given or a denial. A returned `allowed`
  that does not carry the `matchedGrantId` it was handed is treated as a
  malfunction and fails closed, so widening is not expressible rather than
  merely forbidden.
- Its denial carries `policy_denied`. The code names **what** was refused, not
  **who** refused it: ADR 0012 removed `tool_not_available` for exactly that
  conflation and settled that "a code is what was refused; a source is who
  refused it". Which component refused is `OperationRecord.source`, and that is
  the only place it lives — a parallel copy in decision metadata would be the
  same fact in two shapes.
- A throw fails closed and is recorded as an infrastructure denial, consistent
  with every other unavailable trusted component.
- It is optional. A kernel constructed without one behaves exactly as it does
  today.

### Who may install one, and how that is visible

Whoever constructs the kernel constructs the ceiling; there is no separate
authority for installing one, because a host that can build a kernel can already
choose its `GrantSource`. What changes is that the choice is no longer silent:
**the kernel records whether a ceiling is installed**, so a deployment that
denies everything through policy is legible in the record rather than appearing
as a deployment where nobody was granted anything.

### Denial-rate arithmetic

`policy_denied` is **its own bucket inside policy denials** — not an
infrastructure denial, and not merged with `no_matching_grant`. Today
`INFRASTRUCTURE_DENIAL_REASONS` is the only split the vocabulary supports, which
is why a policy refusal currently has nowhere to go. The three-way shape is:

```text
denials = infrastructure (failClosed)
        + policy { no_matching_grant, grant_exhausted, policy_denied, … }
escalations are neither (ADR 0011)
```

### Both paths, and the row that proves it

The ceiling runs on `authorize` and on `canDiscover`. That is one call per tool
per catalogue build plus one per invocation, which the synchronous signature is
what makes affordable.

Conformance gains a row that makes the pairing checkable rather than asserted:
**a tool the ceiling refuses at invocation is absent from the catalogue.** A
ceiling consulted on only one of the two paths fails that row. The row lands
with the implementation, not with this ADR: ADR 0013's strict gate covers every
declared row, so a row added ahead of the code would have to be declared
`notImplemented` with a reason.

## The port alone does not close the class

Three refusal paths remain invisible or misattributed after the port lands, and
the honest case for this direction includes all three.

**1. A withheld grant never reaches the port.** The ceiling is consulted only on
an `allowed` decision, so a host that refuses by not returning a grant bypasses
it entirely and the kernel records `no_matching_grant`. Closing that requires
inverting the `GrantSource` contract: **return the grants the actor holds; do
not apply policy here.**

That inversion is consistent with this ADR's own rejection of filtering in
`GrantSource`. A request-dependent filter there would make `AuthoritySnapshot.hash`
depend on the request, so the snapshot would stop identifying "the authority
this turn holds". Inverting the rule protects that property rather than
straining it.

It also changes what a snapshot means, and that has to be written down rather
than left implicit. The snapshot then contains authority that policy will
refuse, so an auditor reading it alone would overstate what the turn could do.
Its meaning becomes **"authority held", not "authority usable"** — a shift that
belongs in ADR 0010's neighbourhood.

**2. Namespace enablement launders the same invisibility.**
`enabledToolNamespaces` carries two different things: the user's own settings
choice, and organization policy. Split them by intent. The user's choice stays
where it is; policy-driven namespace denial moves into the ceiling, where it
produces a recorded `policy_denied` instead of a silent absence. Without the
split, the port covers one field while the same refusal keeps flowing through
another.

**3. The pre-kernel host gate stays outside either way.** The determinism rule
excludes a model-based sanitizer by design, so a host that runs one still runs
it before the kernel is asked. Choosing the port does not remove the obligation
that comes with that: such a host **emits its verdict to the same `AuditSink`
with the same outcome vocabulary**. The port is added on top of that contract,
not in place of it.

**Net effect.** With only the port, a deployment gets one covered path, one
still misattributed, one still silent — and a `policy_denied` count that reads
as complete when it is not. All three follow-ons have to land for the class to
actually close.

## Consequences

- The permission model's step 10 becomes true of the code. Until now it
  described an intention, and `663dd94` was right that the two disagreed.
- A deployment can answer "how often does our own policy override a grant we
  issued", which is the question that tells an operator their grants are wider
  than their policy.
- `AuditOutcome` gains no new value: a ceiling denial is a denial. What is new
  is that it is recorded at all, and distinguishable by reason code.
- Hosts that apply a ceiling today keep the same logic and move the call site.
  Pulse's `toolAccess.allowedTools` intersection is the first candidate, and it
  stops being invisible without becoming a grant.
- Judgment layers that are not expressible as grants — a relationship model, a
  content-sensitivity check, an org-wide freeze — get a home that cannot widen
  authority, instead of wrapping the kernel where they can do anything.
- SharedEval is unaffected. A host that narrows entirely upstream installs no
  ceiling and behaves exactly as before; its ADR 0002 prohibition on a second
  authorizer in the host is untouched, because a ceiling is not a second
  authorizer — it cannot allow anything.

## Rejected alternatives

**Delete the claim instead of implementing it (`663dd94`).** Rejected on the
evidence above: the enforcement it removed is the only one that can record a
policy refusal, and its replacement — refuse by not issuing, not returning, or
not enabling — is precisely the invisible path. It is the right change if
SharedOS only ever serves hosts whose policy is fixed before a run; it is the
wrong one for a host whose policy reads the request.

**Leave it a convention.** Rejected. The convention already produced a second
enforcement point in the first product host, with no audit and no test.

**Filter the grants in `GrantSource` instead.** Rejected: a ceiling that depends
on the request cannot be applied when authority is loaded, and it would make the
authority snapshot depend on the request, breaking the one-snapshot-per-turn
property ADR 0010 relies on.

**Reuse `ToolNamespaceSettingsStore`.** Rejected: it narrows a persisted
namespace selection at settings-write time and cannot read a call's arguments.
Widening it into a per-request hook would give one interface two unrelated jobs
and two different lifetimes.

**An async signature with a timeout.** Rejected. It admits a network or model
call and then bounds it by wall time, so what passes depends on machine speed —
which cannot be a conformance signal, and which makes the ceiling's determinism
a property of the deployment rather than of the contract.

**Let the ceiling return an escalation.** Rejected here and answered in ADR
0019. A ceiling says no; whether a no is worth asking a human about is the
host's decision, made on the denial it receives, using the capability that
denial describes.
