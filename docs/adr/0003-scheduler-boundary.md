# ADR 0003: Execute one turn and leave scheduling to the host

- Status: Accepted
- Date: 2026-08-03

## Context

The legacy `experiment_v2.ts` flow combines several different concerns: it
creates experimental state, runs autonomous ticks, starts fresh processes,
captures transcripts, evaluates results, performs rollback, and writes
artifacts. Aicoo also has production heartbeat behavior, but its scheduling is
tied to product delivery, user policy, and billing.

Putting those loops into SharedOS would make the runtime depend on either PACT
experiment concepts or Aicoo product policy. It would also make one execution
request ambiguous: a caller could not tell whether it starts a bounded action or
an autonomous scheduler.

## Decision

SharedOS owns one bounded, permission-controlled agent turn. The turn can emit
events and request authorized provider operations, but it does not decide when
the next turn begins.

PACT owns:

- the number and order of ticks;
- run budgets, retries, resume behavior, and stopping conditions;
- snapshots, judges, gold labels, metrics, statistics, and artifacts.

Aicoo owns:

- production heartbeat and cron scheduling;
- delivery and retry policy;
- product billing and user-facing lifecycle.

The useful single-turn logic in experimental scripts may be extracted into
SharedOS. The surrounding scheduler and evaluation loop stays in PACT.

## Consequences

### Positive

- Every SharedOS call has a bounded lifecycle.
- PACT can reproduce and compare explicit scheduler policies.
- Aicoo can evolve production heartbeats without changing the shared runtime.
- SharedOS workers remain passive command executors rather than hidden autonomous
  processes.

### Costs

- Hosts must implement or choose a scheduler.
- Retry semantics spanning several turns are not automatically portable.
- A scheduler conformance layer, if later required, must be designed separately.

## Rejected alternatives

**Use `experiment_v2.ts` as the SharedOS startup engine.** Rejected because it
mixes benchmark control-plane behavior with production execution.

**Put all heartbeat behavior in SharedOS.** Rejected because timing, billing,
delivery, and stopping are host policies rather than permission-kernel concerns.
