# @aicoo/sharedos-conformance

Standard execution records and infrastructure conformance evidence for SharedOS.

SharedOS answers "what happened during this execution?". This package turns that
answer into one comparable artifact so an experiment layer such as PACT can ask
"was it correct, secure, reproducible, and how did it compare?" without
re-deriving evidence per runtime adapter.

It contains no task definitions, gold labels, evaluators, or scores. Assembling
a record never re-decides an authorization outcome; it reads the evidence the
kernel already emitted.

## Execution record

`assembleExecutionRecord` combines an `ExecutionRequest`, its `ExecutionResult`,
and the turn's `AuditEvent`s into an `ExecutionRecord`:

- **experiment identity** — task, run, and separate `specHash`, `worldHash`, and
  `evaluatorHash`;
- **system identity** — protocol, SharedOS version, runtime manifest, adapter,
  model, and `policyHash`;
- **authority** — principal, namespace, and every distinct authority state the
  turn observed, each with the grant ids behind it;
- **execution** — exposed tools, decisions, mediated operations, ordered events,
  and terminal result;
- **state** — before/after snapshot references by id and hash only;
- **cost** — elapsed time, tool calls, authority loads, audit volume, and tokens
  when a runtime reports them.

Authority is recorded per decision rather than per turn. SharedOS re-loads
authority for every kernel operation, so a grant revoked mid-turn produces a
second snapshot instead of silently changing the first, and every decision names
the state it was made against.

## Reproducibility

`hashExperimentInputs` hashes a specification, its materialised world, and its
evaluator separately. `compareReproducibility` uses those to decide whether two
runs may be compared at all: a differing spec means they answer different
questions, and a matching spec with a differing world means materialisation is
not deterministic.

## Completeness

`checkRecordCompleteness` names every missing field and separates evidence that
must be present from evidence that only exists when a run produced it.
`checkRecordRedaction` re-checks that no tool arguments, tool results, or
message payloads reached the record.
