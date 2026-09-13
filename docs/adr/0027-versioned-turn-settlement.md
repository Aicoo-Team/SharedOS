# ADR 0027: Separate Work Cancellation from Result Settlement

Status: proposed, opt-in implementation

## Context

Aborting an await does not undo an already performed operation. Previously,
the kernel awaited post-effect audit before returning a tool result, while the
executor raced that return against its work signal. A successful effect could
therefore lose its result delivery. The standard driver's `next(tool_result)`
also combined persistence with new generation; cancelling that promise could
start `close` while result persistence was still active.

An execution status alone cannot express whether an effect is known, its result
has reached durable actor history, or session publication and cleanup completed.
No benchmark scheduling or host-specific storage belongs in this solution.

## Decision

Introduce a separate, explicitly versioned settlement profile:

```ts
new TurnExecutor(kernel, driver, {
  settlement: { version: "1", timeoutMs: 5_000 },
});
```

The host chooses a finite budget from 1 through 60,000 milliseconds. It begins
once work is cancelled or terminated and covers the entire settlement, not a
fresh budget for each pending operation. Work admission continues to use the
original work signal, grants, catalogue and limits. Settlement never authorizes
another tool call or model decision and never retries an operation.

### Kernel Observation

`SharedOSKernel.observeTool` starts the same checked invocation as `invokeTool`
and returns a version 1 handle:

- `result`: an immutable, validated actual result, before post-effect audit.
- `audit`: `recorded`, `failed`, or `unknown`, independent of diagnostic-hook latency.
- `completion`: the original invocation's complete promise, retained for drain.

Denied and failed results remain denied and failed. Invalid provider results
are handled by existing kernel validation. A file, audit string or caller claim
is never used to synthesize a successful result. Discovery filtering and
consuming execution authorization remain unchanged.

`recorded` means the configured audit sink fulfilled its write contract. Its
physical durability is a property of that host-owned sink. Legacy terminal and
envelope-refusal audit ports have no durability receipt: a return is not promoted
to a confirmed audit state. Their pending work is joined within the budget;
envelope-refused operations explicitly report audit `unknown`.

### Driver Port

Before opening resources, a driver opts in with
`AgentTurnDriver.settlement = { version: "1", closeUnregistered }`. The cleanup
hook accepts an opened session and the settlement signal, and releases only its
resources. Missing or malformed driver capabilities are rejected before `open`.
A driver whose `open` rejects must clean up any resources it has not returned.

An opted-in `AgentTurnSession` supplies a `settlement` extension with version 1:

- `nextDecision(workSignal)`: generation only, using previously ingested state.
- `ingestToolResult(envelope, settlementSignal)`: persist the actual result and
  return its durable ACK without generation, tools or other world effects.
- `finish(outcome, settlementSignal)`: publish the actor-history finish only
  after outstanding work, tool results, ACKs and required operation audits settle.
- `close(settlementSignal)`: resource cleanup only, never history publication.

The ACK binds version, execution, trace, call, tool and SHA-256 of canonical
result JSON. A resolved promise, an in-memory buffer or a queued write is not a
durable ACK. Adapters must accept the same persisted result idempotently and
reject conflicting content. The executor rejects reuse of a call identity before
invoking the operation again. Strict schemas and exact receipt comparison reject
foreign or conflicting ACKs.

Contract schemas reject contradictory public states and mismatched envelope
identities. Parsing alone is not a certificate of durability or a verification of
the digest against result bytes: the runtime computes that digest and compares
the ACK against its retained actual result. The persistence guarantee still
requires a trusted host adapter implementing the durable-ingestion contract.

StandardRuntime registers the per-turn extension through the optional
`RuntimeHost.settlement` port before decisions. It tracks pending open and
decision promises as well as tool operations. Finish cannot race a still-pending
result ingestion or decision. Resource cleanup is separate: a late-opened
session, malformed session or failed registration is released by the previously
negotiated `closeUnregistered` hook without claiming its history finished. The
open and exceptional cleanup share the aggregate settlement budget. After
registration, cleanup belongs only to the controller, never both owners.
A provider that ignores cancellation may remain active after the budget; this is reported as
incomplete, not as process quiescence.

### Return Contract

The optional `ExecutionResult.settlement` field carries the versioned snapshot:
operation result readiness, exact digest when known, ingestion, operation audit,
history finish, resource cleanup and pending call/work identifiers.

`settled` describes this explicit real-time settlement contract, not task success,
all possible host audit durability, process-crash recovery, or benchmark commit
eligibility. `incomplete` preserves known facts and unresolved work. `unsupported`
does not imply any history persistence guarantee. Late completions cannot change
the already returned snapshot and do not trigger operation replay.

A work cancellation remains `cancelled` even when settlement succeeds. Once work
has already produced its terminal outcome, a caller abort during finish does not
retroactively change that outcome; the existing finite settlement still runs.
For example, `succeeded` with `incomplete` is possible and must not be treated by
a host as a safely committed world tick.

## Compatibility and Migration

The original `AgentTurnInput` and legacy `next`/`close` behavior remain unchanged
when the profile is absent; legacy result JSON does not acquire a new field.
The opt-in profile requires the observed kernel port and a versioned driver
capability and session extension. An unsupported driver fails before opening or
generating rather than falling back to a fresh `next(tool_result)` after cancellation.

The execution envelope retains protocol version 1, but an older strict v1 decoder
rejects the new `settlement` key. This is a coordinated opt-in extension, not a
claim that old consumers accept new-profile responses. Constructor configuration
controls emission; the profile remains off for existing integrations. Before
enabling it, the host must upgrade every relevant HTTP/client/SDK decoder or keep
the profile on a separate local execution port. Driver support alone is not
consumer negotiation. This change does not add HTTP capability negotiation and
must not be enabled indiscriminately behind an existing mixed-version endpoint.

Existing adapters are not silently upgraded and do not gain durable-history
claims. A host enabling this profile must implement the non-generative journal
port, require a suitable settlement report before committing state, and record
its chosen profile and budget in run provenance. No PAIR or NET scheduler,
MEMORY format, task, evaluator or gold label enters SharedOS.

## Deferred Work

This change does not atomically bind a host workspace publication to an operation
receipt. Crash recovery requires versioned host-owned storage, atomic publication
and receipt reconciliation. It does not repair or resume preexisting failed
worlds, optimize full-history reads, enlarge model context or change experiment
tick budgets. Those remain separate migrations with separate evidence.

## Verification

Regression tests cover actual kernel result delivery while audit is gated,
cancellation during ingestion, ACK-before-cancel with finish still active,
pending handlers/ACKs/audit/close, invalid receipts, unsupported drivers, unknown
thrown values and execution authorization denial with no effect. Existing
legacy and permission tests remain required alongside the new profile tests.
