# ADR 0021: Every refusal reaches audit, and the record names the boundary

- Status: Accepted
- Date: 2026-08-31
- Extends: `docs/adr/0012-one-refusal-vocabulary.md`

## Context

ADR 0012 gave the two boundaries one refusal vocabulary: the envelope and the
kernel refuse an unavailable tool with the same `tool_unavailable`, and which
boundary refused is `OperationRecord.source`. That settled what a refusal is
called. It did not settle where a refusal is written down, and the answer today
is that a large class of them is written nowhere.

The execution envelope makes no audit call of its own. The single event that
reaches audit from a terminal outcome is the escalation, and it gets there by
calling the kernel, which owns audit. Everything else the envelope refuses
exists only in `ExecutionResult.events`, a stream this repository's own
production packages never read — every consumer of it is in
`@aicoo/sharedos-conformance`.

So these are invisible to a host with an audit sink and no conformance record:

| refused                                                                    | where it lives today                            |
| -------------------------------------------------------------------------- | ----------------------------------------------- |
| a tool name the turn's catalogue never offered                             | events only                                     |
| `step_limit_exceeded`, `tool_call_limit_exceeded`                          | events only                                     |
| `actor_mismatch`, `receiver_mismatch`, `message_context_mismatch`          | events only                                     |
| a plugin that ended the turn on an escalation the catalogue does not offer | events only                                     |
| `runtime_failed`, `driver_failed`, `invalid_runtime_outcome`               | events, plus `onTurnError` for the thrown error |
| that a turn started, ended, or how                                         | nowhere — no audit type exists                  |

The first is the one worth naming twice. An agent calling a tool it was never
offered is the clearest attempted-violation signal the system produces, and a
host reading audit alone cannot see that it happened.

Discovery has the same shape at the other end. `listTools` records the tools it
returned and nothing about the ones it did not: a namespace that is off is a
bare `continue`, and a tool no grant makes discoverable simply does not appear.
The refusal has no code on either side — the agent is not told, and neither is
the record.

And one documented promise is not kept. `docs/errors.md` says `tool_unavailable`
covers three situations and that the specific reason is in the audit trail,
"recorded immediately before" as an `authorization.checked` event. That holds for
one of the three. A tool that is not registered, or whose namespace is off,
produces `tool.invoked` carrying the same coarse code the wire carried, with no
decision event to disambiguate it.

## Decision

Every refusal a boundary makes is recorded, and every operation event says which
boundary made it.

### The envelope records through the kernel

`TurnKernel` already reaches the kernel through a narrow interface whose
optional members degrade gracefully — `openTurnAuthority` and `recordEscalation`
are both `Partial`, and a kernel offering neither still runs a turn. The
recording surface this ADR needs joins them there.

The envelope does not take an `AuditSink` of its own. A host would then have to
pass the same sink in two places, and the failure mode of forgetting the second
is a turn that enforces correctly and records nothing — the exact defect this
ADR exists to remove, reintroduced as a configuration mistake. One sink, owned
by the kernel, reached from the envelope the way escalation already is.

### `turn.ended` — one event, at the terminal

`AuditEventType` gains one value, not five. `turn.ended` carries the outcome and
the reason code of however the turn finished: completed, denied, failed,
cancelled, escalated.

Five lifecycle events would triple the audit volume of every successful turn to
record nothing a single terminal event does not already say. And a
`turn.denied` following an admission refusal would double-count: `admitTurn`
already produces an `authorization.checked`, so the denial is in the stream
once. A host counting denials counts decisions; a host counting turns counts
terminals; neither reads the other's events.

### Envelope-terminated calls become `tool.invoked`

A call the envelope refuses before the kernel sees it is a tool call that was
attempted and denied, which is what `tool.invoked` means. It is recorded as one,
with the code the caller was given.

### `metadata.source` on every operation event

`kernel` or `envelope`, mirroring `OperationRecord.source`.

This is required by the change rather than incidental to it. Today the rule "it
is in audit, therefore the kernel refused it" holds for free, because the
envelope records nothing. Routing envelope refusals into audit destroys that
rule, and a host reading audit alone would lose a distinction it has now.
Closing one gap while opening an ambiguity is not an improvement, so the two
land together.

### `metadata.cause` on the `tool_unavailable` family

`reason` stays `tool_unavailable` — the same code the caller was given, which is
what keeps ADR 0012's one vocabulary intact and keeps the audit code and the
wire code comparable. The specific fact goes in `metadata.cause`:
`not_registered`, `namespace_disabled`, `not_discoverable`, `not_offered` for
the envelope's catalogue refusal, and `host_policy_denied` for the ceiling of
ADR 0020.

That last one is not optional. `host_policy_denied` can only ever appear on an
`authorization.checked` event, so a host counting policy refusals from the
operation events would get zero — and for two of the causes there is no decision
event to join to. The cause field is what makes ADR 0020's count obtainable from
the events a host actually reads.

`cause` and `source` both go in `metadata`, alongside the `failClosed` and
`consumed` flags already there. `AuditEvent` keeps its top-level shape.

### Discovery is recorded in aggregate

`tool.catalog.listed` gains `withheld`: the tools that were not returned, each
with the cause that withheld it. One event per listing, as now.

Not one event per tool. A registry of two hundred tools would produce two
hundred awaited sink writes per catalogue build, which is a cost a host pays on
every turn to record the same fact a list records once. The reason to aggregate
is volume, not secrecy: a tool name is a registry constant and reveals nothing
about the world.

### What stays out, and why

- **The MCP transport's `unauthorized` refusal.** It happens before an
  `AccessContext` exists, so there is no namespace, actor, trace, or owner to
  attach the event to. Inventing an actor to fill the fields would put a
  fabricated principal in the trail, which is worse than the gap. It belongs in
  the host's HTTP log.
- **The thrown error behind any refusal.** Reason codes are bounded facts; a
  thrown message may carry arguments, rows, or credentials the thrower had in
  scope. `onProviderError` and `onTurnError` remain the only places one goes.
- **Tool arguments, tool results, message payloads.** Unchanged. The redaction
  rule that `checkRecordRedaction` enforces is not relaxed by any part of this.
- **Validation detail behind `invalid_tool_arguments`.** The code is already
  audited and stays; the parser's message is not added, because it quotes the
  value that failed.

## Consequences

- A host with an audit sink and no conformance record can see every refusal both
  boundaries make, and can tell which made it.
- `docs/errors.md`'s existing promise about `tool_unavailable` becomes true, for
  four causes rather than one of three.
- Hosts wire nothing new. No option is added to the executor, no sink is passed
  twice, and no compatibility facade has a new field to forget to forward.
- `AuditEventType` goes from nine values to ten. `AuditOutcome` is unchanged.
- Audit volume rises by roughly one event per turn plus one per envelope-refused
  call. Envelope refusals are bounded by `maxToolCalls`, which the host set.
- **`assembleExecutionRecord` must change or it will double-count.** Its
  `envelopeOperations` synthesizes operation records from `tool.completed`
  events precisely because those calls are ones "audit never saw". Once audit
  sees them, the same refusal arrives from both sources. This is the most likely
  silent regression in the change and the conformance record is where it would
  surface, as inflated attempt counts in every column.
- The conformance judge's version moves, and the case-set and world-set hashes
  with it, so every cell in the committed manifest is recomputed.

## Rejected alternatives

**Give the envelope its own `AuditSink` option.** Rejected; see above. Two
places to pass one sink, and the failure mode of missing the second is silent.

**Five `turn.*` event types.** Rejected. Volume without information, and it
double-counts admission denials against `authorization.checked`.

**Put the specific cause in `reason` instead of `metadata`.** Rejected. It
breaks the correspondence between the audit code and the code the caller was
given, which is what makes the two streams comparable, and it would split one
refusal into four codes that ADR 0012 deliberately unified.

**Emit `authorization.checked` for every `tool_unavailable`.** Rejected for the
not-registered case: there is no resource to have checked and no decision was
made. Recording one would put a decision in the trail that never happened, which
is the same defect as recording `no_matching_grant` for a withheld grant.

**One audit event per withheld tool at discovery.** Rejected on volume, above.

**Leave the event stream as the record and tell hosts to read it.** Rejected. It
is a required field on `ExecutionResult`, so hosts already pay for it on the
wire, and no production consumer in this repository reads it. Directing hosts to
a channel whose only readers are the conformance package would document the gap
rather than close it.
