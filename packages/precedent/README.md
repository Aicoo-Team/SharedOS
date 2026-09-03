# @aicoo/sharedos-precedent

Admission rules for an auto-decision proposed from an owner's prior answers.

```bash
npm install @aicoo/sharedos-precedent@next
```

A **precedent** is a resolved escalation: the `CapabilityRequest` that was
asked, what the owner answered, and — when they approved — the width they
approved. Nothing new is stored to have one, and nothing is stored here: the
rows stay host-side behind `PrecedentLookup`, because a precedent is a record of
what one owner answered and SharedOS stores nothing.

The host proposes; this package admits. A matcher may be an exact key match,
Jaccard over tool names, embeddings, or a model trained on the host's own
history — this does not rank, score, learn, or improve. It answers one question
about a finished proposal, **may this be decided without a human?**, against
ADR 0022's four rules, and the proposal carries no similarity score, confidence,
or match type: a field the kernel is handed and must ignore is a field a host
will eventually expect it to honour.

```ts
import { admitAutoDecision, autoDecisionAuditEvent } from "@aicoo/sharedos-precedent";

const admission = await admitAutoDecision(
  {
    request, // the escalation now in front of the control plane
    citedRequestIds: matcher.cite(request), // however the host found them
    proposed: { allowed: true, capabilities: [oneNarrowCapability] },
    marker: { matcher: "jaccard-v3" },
  },
  precedentLookup,
);

if (admission.admitted) {
  await auditSink.record(autoDecisionAuditEvent(context, admission.decision));
  if (admission.decision.allowed) {
    await grants.issue({
      /* ... */
      capabilities: admission.decision.capabilities,
      constraints: admission.decision.constraints,
      metadata: admission.decision.metadata,
    });
  }
}
```

## What it decides, and what it never decides

A precedent decides whether to **ask**, never whether to **permit**. Nothing
here is an `AuthorizationDecision`, nothing returned is assignable to one, and
no port accepts one back as authority. An admitted allow _describes_ a grant for
the host's store to issue; the next turn loads it through `GrantSource` like any
other, and the turn that escalated stays ended. There is no consent queue, no
resumption, and no `pending` grant state.

That a denial cannot become an allow is structural rather than a rule:
`RefusedPrecedent` has no capabilities, so there is no width on a refusal for an
allow to read, and citing one in a proposed allow is inadmissible.

## The four rules

| rule   | what it holds                                                                                                                                                                                     |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R1** | Fuzzy evidence may only narrow. `similar + deny` is admissible; `similar + allow` comes back `narrowed` and bounded by what this request asked for; full width needs an exact key match.          |
| **R2** | Never wider than the precedents cited, checked with `capabilityIsWithin` — the predicate the delegation chain already uses — once per precedent. Disjoint precedents make every proposal refused. |
| **R3** | The tightest envelope: minimum expiry, latest start, minimum bounded use, purpose intersection, `delegationDepth: 0`. It bounds one decision, never a class.                                      |
| **R4** | Every auto-decision is marked. A proposal that declares no matcher is inadmissible, and the marker reaches the grant's metadata and an `escalation.auto_decided` audit event.                     |

R4 is what makes a bad matcher a rollback instead of an incident: an operator
selects everything one matcher produced — `readAutoDecided` off the grant, or
the audit stream — and revokes it in one action, without telling it apart from
what people decided by hand.

## Exactness is derived, not declared

A host never asserts that a match was exact; the assertion is exactly what R1
gates, and a rule enforced against a self-report is a rule enforced against
honest hosts only. `PrecedentKey` is the structured key — namespace, owner,
requester, purpose, and effective capability — and `precedentKeyDigest` is its
only fingerprint. Equality of the digest **is** an exact match; anything else is
fuzzy evidence, including a citation that mixes one identical precedent with a
similar one.

The key is deliberately time-invariant, as `CapabilityRequest.id` is since
ADR 0019. The id is still not usable for this: it hashes the constraints the
requester asked for, and R3 takes the envelope from the precedents rather than
from the ask, so an ask for a shorter expiry must not be a different question.

It is also keyed on **effective** capability rather than on a grant set. A host
that holds authority down outside its grants — a tool map, an allow-list, an
ADR 0020 `HostCeiling` — has an effective authority narrower than its grant set,
and keying on the wider one would teach the system an authority nobody granted,
most of all in the deployments that were being careful.

See [ADR 0022](https://github.com/Aicoo-Team/SharedOS/blob/main/docs/adr/0022-precedent-proposes-the-kernel-admits.md).

SharedOS is currently an `0.x` prerelease.
