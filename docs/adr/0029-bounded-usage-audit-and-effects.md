# ADR 0029: Bounded usage, audit and provider effects share recovery

- Status: Accepted for compatibility epoch 2; production durability remains host-owned.
- Date: 2026-10-04
- Extends: ADR 0023, ADR 0028 (durable operation replay), and ADR 0027 (wire epochs)

## Context

Before this change, the authorizer called `GrantUsageStore.tryConsume` before the kernel
recorded `authorization.checked`. A failing audit write exhausted a `maxUses: 1`
grant without entering the provider. The pre-change fault-injection probe
confirmed usage one and provider invocations zero. That counter limited
authorized attempts, including attempts that failed before dispatch.
The post-change regression in `packages/runtime/src/audit-outage.test.ts`
confirms usage zero and provider invocations zero after audit rejection, then
one successful fresh call and no additional invocation when replaying it. A successful provider result whose outcome
audit fails is returned, but the diagnostic callback alone provides no durable
recovery record.

Neither a provider exception nor cancellation proves that no effect happened.
An HTTP timeout can follow a committed payment. A process can die after sending
the request and before recording its answer. SharedOS cannot make a transaction
span arbitrary remote providers, grant accounting and audit storage.

## Decision

`maxUses` bounds admitted kernel effects: reservations occupy capacity, and usage
is committed durably before entering a provider that may cause an effect. A
committed use remains spent even if the provider fails, returns an invalid
result, is cancelled, or its outcome is unknown. It is not a success counter.
Discovery does not reserve or commit usage.

Recovery extends the operation record and identity established by replay
protection. There is no second operation store and no identity keyed only by a
caller-supplied tool ID. Reservation, input binding, fencing, effect admission,
result and pending audit events belong to that same operation. Its structural `ReplayKey` and fingerprint retain namespace, actor, authority,
resource scope, purpose and trace binding.
Same-key/different-input requests are refused. A concurrent retry cannot acquire
an operation another worker owns.

### Host storage transaction and audit delivery

The host must atomically bind a bounded reservation to the claimed operation and
check reserved plus committed uses against the limit. A failed or ambiguously
acknowledged write is read back using that identity; it is never retried as a
fresh decrement. Separate counter and operation writes without a transaction or
equivalent recoverable protocol do not satisfy this port.

The authorization decision must be durably accepted before dispatch. The host
may accept it through a transactional audit outbox rather than synchronously
deliver it to a remote sink. An outbox is part of the operation recovery
transaction, not an in-memory error callback. Audit delivery deduplicates by
`AuditEvent.id`; retries retain the original event and ID. Delivery failure is
observable and the event stays pending until acknowledged.

Before provider entry, a fenced host transaction commits the reservation and
marks the operation effect-admitted. If this write has an unknown outcome, the
worker does not enter the provider. Recovery treats the admission as potentially
effectful until durable state and provider evidence resolve it. A stale worker
must not dispatch after recovery has released its reservation.

`EffectStore` extends `ReplayStore` with `reserveUsage`, `admitEffect`,
`releaseUsage`, `appendAudit`, `pendingAudit` and `acknowledgeAudit`. It also
answers `getUsage` including both reserved and committed capacity. The kernel
uses the same store for default discovery and execution; custom authorizers
must use it as their `usageStore` too. It never calls the legacy `tryConsume`
port. A bounded kernel operation without this extension fails closed as
`usage_store_unavailable`, even when a legacy counter exists. Direct low-level
`consume: true` authorizer calls and fixture `tryConsume` remain legacy admission
utilities, not a provider recovery protocol; hosts must migrate effects through
the kernel.

The effect record carries reserved/admitted/released state on the original
replay record. Authorization audit says `usageState: "reserved"` and
`consumed: false`. A successful pre-admission release queues
`grant.usage.released` atomically with the release. The kernel reports release
only after acknowledgement; a lost acknowledgement is resolved from the record.
A provider outcome says whether bounded capacity committed;
unbounded operations do not claim a bounded use. On crashes, the admission
record is authoritative; absence of an outcome audit proves nothing.

The provider's result and its outcome audit event are recorded together in the
operation result/outbox transaction. A sink outage after that transaction does
not turn success into a retryable failure. If the result transaction itself
cannot be persisted after an effect, the admission record continues to prevent
redispatch; recovery must reconcile with the provider. Reporting a success to
the caller does not imply that its durable receipt exists.

### Release and ambiguity

Only a reservation proven not to have crossed effect admission may be released.
An authorization audit rejection before admission releases it through the same
fenced operation transaction. If release fails, capacity remains occupied and
recovery retries that transaction; the caller cannot assume restored authority.
A cancellation observed before admission follows the same rule. Expiring a
worker lease does not itself prove a release is safe.

After admission, failures and cancellations are ambiguous unless the provider
supplies trusted reconciliation evidence. SharedOS never automatically refunds
committed usage. A provider's generic exception, status code, abort signal or
model-written claim is not sufficient evidence. A deliberate host repair must
be authenticated, fenced and audited; it cannot silently turn a potentially
committed effect into reusable authority.

### Crash recovery and retries

| Crash or failure point                                             | Recovery                                                                                     |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Before reservation transaction                                     | No capacity spent; claim and authorize normally.                                             |
| After reservation, before durable decision                         | Fence the previous worker; release only while state proves no admission.                     |
| After decision acceptance, before admission                        | Reservation still occupies capacity; resume or release under the same fence.                 |
| During admission acknowledgement                                   | Read back the operation; never infer failure from a timeout.                                 |
| After admission, before provider entry                             | Conservatively retain usage; no automatic redispatch or refund.                              |
| During provider work or after effect, before result transaction    | Mark unresolved; query provider using its operation identity or require host reconciliation. |
| After result/outbox transaction, before audit sink acknowledgement | Return the recorded receipt; deliver pending events with their original IDs.                 |

A completed replay returns its recorded receipt without invoking the provider
again. An admitted operation without a durable result returns an unresolved
status, not permission to retry the effect. Recovery can resume dispatch only
where the provider implements a verified idempotency/reconciliation contract for
the same identity. A tool's `idempotent` catalogue hint alone is insufficient.
Released operations must undergo authorization again: release restores capacity,
not an old decision, an expired grant or a revoked authority lease.

### Explicit audit configuration and compatibility

Kernel construction requires an explicit audit choice. A host supplies an
`AuditSink`; tests and development may intentionally choose `audit: "discard"`
or instantiate `NoopAuditSink`. Omission fails at construction. Discard mode
provides no durability and cannot demonstrate production readiness.

The reservation/effect-admission meaning of bounded usage and the operation
recovery states are breaking contracts. They must ship with the protocol
versioning work, including runtime manifest negotiation, wire schema validation,
HTTP/client checks and migration documentation. Old `tryConsume` adapters must
not be silently interpreted as recoverable reservations. Existing durable
counters migrate conservatively as committed usage; unresolved historic effects
must not create available capacity. This implementation shares the unpublished compatibility epoch 2 from ADR 0027:
`usageState` and replay effect/outbox fields are schema changes, and bounded
admission and explicit audit configuration change observable guarantees. Epoch 1
readers/writers are rejected at the existing protocol boundaries. If epoch 2 is
published before this lands, this change requires the next coordinated epoch.
The prerequisite PRs are durable replay (#99) and protocol versioning (#100).

Supply one durable `EffectStore` as `SharedOSKernelOptions.replayStore`. Deliver
its pending audit through the host's recovery worker using
`reconcileAuditOutbox(store, sink, batchSize)`. Successful sink writes are
acknowledged only afterwards. Lost acknowledgements cause redelivery with the
same event ID, never redispatch of the provider. Recovery must establish that
the old worker is stopped before releasing an abandoned pre-admission claim;
release fences future admission. The core owns no scheduler or database.

## Validation and production gates

Fault injection must cover audit rejection before entry, reservation/admission
acknowledgement loss, crashes at each transition, failed releases, concurrent
capacity races, abort before and after admission, effect-then-throw, malformed
provider answers, result persistence failure, outbox delivery outages and
restarted reconciliation. Tests must assert both provider invocation count and
capacity, not just the returned error. Replays must preserve receipts and audit
IDs while input conflicts and stale fences deny dispatch.

In-memory adapters are test fixtures, not production crash durability. Production
hosts must prove their transaction/fencing protocol and each remote provider's
idempotency or reconciliation behavior independently. Until these gates pass,
SharedOS does not claim exactly-once remote effects.
