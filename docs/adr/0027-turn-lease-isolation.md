# ADR 0027: Isolate turn leases and share initialization

- Status: Accepted
- Date: 2026-10-04
- Amends: `docs/adr/0010-per-turn-authority.md` and
  `docs/adr/0026-catalogue-resolved-once-per-turn.md`

## Context

Namespace, actor, authority, owner, purpose and trace identify an authorization
scope, not an execution. Separate executions may share all of them. The old
lease key allowed such executions to share frozen grants, host policy and the
effective catalogue. Concurrent opens also loaded independently before
registering, overwrote the same map entry, and could remove another handle's
lease on close.

## Decision

`AccessContext` gains an optional JSON-safe `turnId`. It is a trusted host-created
identity, carries no authority, and joins the existing authorization fields in
`turnAuthorityKey`. The executor creates a fresh ID for each run, overriding any
supplied ID. Even overlapping runs with the same `executionId` are isolated;
execution IDs remain record identifiers, with no replay protection.

Nested handlers preserve `turnId` when calling back into the kernel. Context
clones and clock/namespace updates retain it. The ID is not included in the
model-facing runtime context. Direct kernel hosts opening explicit scopes must
assign distinct IDs to independent turns and preserve the ID for operations
within a turn. Omitting it retains the legacy context-keyed scope for existing
callers; those scopes cannot distinguish otherwise identical concurrent turns.
Direct operations without a matching lease continue to resolve independently.

A pending lease is registered before loading begins. Each opener reserves one
reference before awaiting the shared authority/policy load. The load has its own
abort controller: cancelling one waiter releases only its reservation, while
other waiters continue. A rejected initialization releases every failed opener's
reservation and allows subsequent initialization. An unavailable authority
result remains held fail-closed, as before.

Closing a handle is idempotent and releases the exact lease instance it acquired.
The last reference removes only that instance and aborts outstanding work,
including catalogue derivation. A cancelled load that ignores its signal and
finishes late cannot install itself or remove a replacement lease.

## Consequences

Authority, host policy and the effective registry are still resolved once per
turn. Expiry and enabled namespace checks still run per operation. Store-side
revocation remains a next-turn event. No replay protection or revocation policy
changes are introduced.

The optional field is additive for current callers, but an older strict
`AccessContext` decoder will reject contexts containing it. Hosts transporting
these contexts must upgrade both ends together. Hosts using explicit kernel
scopes should migrate from implicit context identity to fresh turn IDs.
