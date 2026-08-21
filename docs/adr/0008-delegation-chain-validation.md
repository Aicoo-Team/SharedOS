# ADR 0008: Validate the complete delegation chain before use

- Status: Accepted
- Date: 2026-08-18

## Context

`CapabilityConstraints` has always carried `delegationDepth`, and
`docs/security/permission-model.md` has always described what delegation must
guarantee: verifiable issuer-to-subject linkage, attenuation on every axis,
decreasing depth, and invalidation of descendants when an ancestor expires or is
revoked. None of it was enforced, so the permission model carried an explicit
warning that `delegationDepth` must not be read as permission to reissue a
grant.

That left two different situations indistinguishable at the authorization
boundary:

```text
grant itself revoked  ──►  denied            (already enforced)
parent grant revoked  ──►  child still works (not enforced)
```

The kernel conformance manifest expects "Replay an expired or revoked
grant → Deny; invalidate descendants" to be a reportable pass or fail, and a
guarantee that is only described in prose cannot be reported at all.

A delegated grant travels as a self-contained object. Its parent's contents are
therefore hearsay: a subject that can present a child grant can also present a
fabricated parent alongside it. The ancestor must come from the same trusted
source that issued it, not from the request.

## Decision

A `CapabilityGrant` may name its immediate ancestor in an optional
`parentGrantId`. The field is a claim about provenance and never authority by
itself; the contract only rejects a grant that names itself.

`CapabilityAuthorizer` accepts an optional `DelegationChainResolver`, the
trusted namespace-scoped lookup for ancestors. When a matching grant declares a
parent, the authorizer walks the chain and requires every link to satisfy all
of:

- the child's issuer is exactly the parent's subject;
- parent and child share one namespace;
- the parent is itself active for the requested purpose at decision time, so
  ancestor expiry or revocation invalidates every descendant;
- every child capability is contained in one parent capability by namespace,
  owner, action set, path, and scope;
- time window, purposes, and bounded uses never widen, and a child is never
  issued before its parent;
- the parent declares delegation budget and the child's budget is strictly
  smaller.

Validation runs after a capability match rather than during grant eligibility,
so an ordinary deny path never pays for an ancestor lookup.

Failure is reported as two distinct, auditable outcomes:

- `delegation_chain_invalid` — the chain resolved and broke a structural rule;
- `delegation_chain_unverified` — the chain could not be established at all: no
  resolver installed, an ancestor missing, or the resolver threw.

`AuthorizationDecision.metadata` carries the failing link's code and grant id so
an audit record states which link failed, not merely that one did. When several
grants fail differently, an unverifiable chain is reported ahead of an invalid
one so an infrastructure failure is never presented as a policy decision.

## Consequences

- Revoking a parent grant now invalidates its descendants, with no rewrite of
  the descendants. Ancestors are resolved on the authorization path, so the
  invalidation is observed at the next decision that resolves the chain -- which,
  since ADR 0010, is the next decision in the next turn.
- A host that issues delegated grants must install a `DelegationChainResolver`.
  Without one, delegated grants authorize nothing; grants without a parent are
  unaffected.
- Chain walking is bounded by `DEFAULT_MAX_DELEGATION_CHAIN_LENGTH` and by cycle
  detection, so a malicious or corrupted store cannot make a decision loop.
- Attenuation of `maxUses` is compared declaratively. Usage counters are not
  shared across a chain, so a child's bounded uses are its own budget within its
  parent's ceiling.
- Ancestor lookups are on the authorization path. A host resolver is expected to
  cache, and it must fail rather than serve a stale ancestor.

## Rejected alternatives

**Carry the parent link in `metadata`.** Rejected because metadata is opaque
host data. A guarantee the conformance manifest must report needs a validated contract
field.

**Embed the whole ancestor chain in the child grant.** Rejected because the
presented chain is exactly the thing an attacker controls. Only re-resolution
against the issuing store makes revocation meaningful.

**Read ancestors from the actor's own resolved authority.** Rejected because
that set holds the grants issued _to_ the actor; a parent belongs to the
delegator, so the chain would usually be unresolvable and, when present,
attacker-influenced. (`AccessContext` carried the actor's grants inline when this
ADR was written; ADR 0009 removed the field.)

**Treat a missing resolver as "no delegation configured, allow".** Rejected
because it converts an unenforced guarantee into a silent bypass. Deny-by-default
applies to the mechanism as well as to the decision.
