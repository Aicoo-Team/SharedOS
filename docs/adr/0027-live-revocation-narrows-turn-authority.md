# ADR 0027: Live revocation narrows turn authority

- Status: Accepted
- Date: 2026-10-04
- Amends: ADR 0010 and ADR 0016 for hosts installing live revocation

## Context

ADR 0010 deliberately loads `GrantSource` once per turn. Removing or revoking
material in that store does not alter a held leaf grant. ADR 0016 separately
checks expiry at the operation instant without admitting newly active grants.

The existing optional `CapabilityGrantVerifier` already runs at each leaf
eligibility check, including discovery and reach. A host can use it for live
revocation today. Its boolean cannot distinguish revocation from an outage,
throws become generic rejection, and ancestors are not passed to it. Keep this
API and its behavior for compatibility; do not describe default snapshot
behavior as the only available behavior.

## Decision

Add an optional, host-owned `GrantRevocationSource` to `CapabilityAuthorizer`.
`check(context, grantIds)` atomically reads revocation state for one candidate
and its complete validated delegation chain. It returns a namespace-scoped
opaque `revision` and the subset `revokedGrantIds`. It returns no grant contents
and cannot add authority. There is no second catalogue load, epoch cache, or
SharedOS-owned production storage. Each qualifying candidate gets a fresh read.

The host must include every revocation committed before the read begins. It
must use a consistent read over all supplied IDs; replica lag or an unverifiable
cache freshness is an outage, not an empty revoked list. The host must retain
revocations and never reuse a grant ID within its namespace. Reissuing authority
uses a new ID, eligible on the next turn. Removing a grant from the grant
store alone is still snapshot-bound; a host wishing to make removal live must
also record it as a revocation in this port. The revision identifies the state
actually read, not the `AccessContext.now` timestamp. SharedOS cannot prove that
an external implementation satisfies this freshness contract.

### Enforcement point and failures

After snapshot eligibility, capability matching, and complete chain validation,
and before host policy or bounded-use accounting, the authorizer awaits this
read. A revoked leaf or ancestor rejects this candidate; another independently
active candidate can still authorize. A throw or malformed result immediately
fails the decision closed as `authority_unavailable`, even when another grant
might match. No usage is consumed and no provider is dispatched on that path.
Reach returns `unavailable` rather than claiming an empty reachable surface on
an outage. Discovery uses the same gate; an unavailable catalogue check is
marked fail-closed. A previously offered catalogue grants no execution authority.

Without this port, the default `GrantSource` behavior remains snapshot-bound.
The legacy verifier remains independent and is still evaluated first. A host
requiring these freshness and outage guarantees must install the new port;
the verifier's boolean alone does not provide them.

### Concurrency and external effects

Each decision performs its own read; concurrent operations do not share a pending
read or a cached verdict. An operation whose read starts after revocation commits
is refused. A read concurrent with revocation may observe either state. An
earlier read may complete, authorize, and dispatch after revocation commits,
even after a later call has already been refused. The port does not serialize
operations, cancel the turn, or cancel operations already in flight.

This is an authorization check boundary, not a transaction with the provider.
Async usage accounting, audit writes, provider scheduling, and external execution
can follow the check. Revocation cannot undo an already committed external
effect. A host needing stronger guarantees must coordinate cancellation or
transactional fencing with its provider; even cancellation cannot promise rollback
of committed effects. No such provider guarantee is implied here.

### Other narrowing and callers

Expiry continues to use the later of admission and operation instants.
`issuedAt`, `notBefore`, snapshot revocation fields, and purpose membership remain
admission-bound; an active revocation verdict cannot revive them. The port receives
the live operation instant (clamped to admission) plus namespace, actor,
authority, owner, purpose and trace identity. Identity never comes from messages.
Host policy still narrows independently, after revocation and before consumption;
per-turn policy snapshots remain unchanged. Ancestor structural validation and
its existing trusted resolver remain required; live revocation is not a substitute
for a verified chain.

The gate lives in the authorizer, so resource, tool, message, admission, nested,
and direct kernel calls all reach it. A direct operation still loads its own
snapshot as a turn of one operation. Descriptive reach also applies the gate.

### Evidence and protocol compatibility

Snapshot loading and `authority.resolved` remain once per turn. Kernel
`authorization.checked` events retain their `authorityHash` and carry host-only
`metadata.revocationChecks`: checked IDs, status, revision, and revoked IDs, or
an unavailable status with checked IDs. Candidate checks are recorded in order,
including rejected candidates before an eventual allow. Catalogue audit carries
its filtering checks. The existing audit context supplies scope, purpose,
actor, authority, and trace; the operation ID joins invocation evidence.

Direct authorizer callers can receive the same evidence via `onRevocation`, a
synchronous diagnostic callback which must not throw. Evidence is detached and
frozen. Descriptive reach has no new standalone audit event, consistent with its
existing contract; callers needing evidence may use that callback.

This is an additive embedded host port and optional diagnostic callback. No
wire schema, required field, closed reason enum, or legacy verifier signature
changes. `authority_unavailable` is already supported by decision and reach
contracts, and audit metadata is already JSON-safe extensible data. Protocol
version stays `1`. Any future typed wire revocation fields, mandatory live
checking, or incompatible reason vocabulary must receive a protocol version
change rather than silently changing version `1` readers.

## Alternatives

Reloading the whole grant source per operation would defeat ADR 0010 and allow
running turns to acquire new authority. A cached epoch needs an additional
consistency protocol and still needs a fresh epoch read. Cancellation alone
cannot prove that no further dispatch occurs or distinguish committed effects.
Changing the boolean verifier would break existing hosts and still require a
separate complete-chain design. The narrow atomic check is explicit and keeps
these guarantees separate.
