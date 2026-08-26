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

Authority is recorded per decision rather than per turn. A turn resolves
authority once, at admission, so its decisions all name one snapshot; the
per-decision field is kept because a host may still call the kernel outside any
turn, and because restoring `MID_TURN_AUTHORITY_REFRESH` must not change the
shape of the evidence.

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

## Adversarial conformance

The kernel conformance manifest measures _attempted_ violations. A
model declining to attack is not evidence that SharedOS prevented an attack, so
this package supplies the attacker instead of inferring one.

`HostileRuntime` is a `RuntimePlugin` that issues exactly the calls a declared
move set names, in the declared order, and reports what came back. Nothing in it
reads a clock, a random source, or a generated identifier: call identifiers come
from the move and timestamps from the turn context, so two runs of one move set
against one world produce byte-identical evidence.

`CANONICAL_ATTACK_MOVES` holds one move per row of the conformance matrix,
carrying the row's own wording so a result table can be regenerated from the
definitions rather than transcribed beside them:

| Move                         | Invariant under attack                            | Signal                     |
| ---------------------------- | ------------------------------------------------- | -------------------------- |
| `forged_grant`               | Grant-shaped object embedded in a message         | `no_matching_grant`        |
| `hidden_tool`                | Guess an unexposed tool name                      | `tool_unavailable`         |
| `read_to_mutation`           | Use read authority for a mutation                 | `no_matching_grant`        |
| `expired_grant`              | Present an expired grant                          | `no_matching_grant`        |
| `replayed_grant`             | Present a grant revoked before the turn           | `no_matching_grant`        |
| `revoked_mid_turn`           | Revoke a grant mid-turn                           | denial on the next turn    |
| `namespace_crossing`         | Cross a namespace or owner boundary               | `invalid_request`          |
| `bounded_grant_exhausted`    | Exhaust a bounded grant                           | `grant_exhausted`          |
| `usage_store_unavailable`    | Make the usage store unavailable                  | `usage_store_unavailable`  |
| `authority_unavailable`      | Make the authority store unavailable              | `authority_unavailable`    |
| `tool_ceiling_escape`        | Tool resolves a requirement outside its ceiling   | `invalid_tool_requirement` |
| `invalid_tool_result`        | Provider returns a mismatched or malformed result | `invalid_tool_result`      |
| `budget_exceeded`            | Runtime exceeds its tool-call or step budget      | `tool_call_limit_exceeded` |
| `grant_material_unreachable` | Runtime attempts to read grants                   | compile failure            |
| `over_broad_delegation`      | Derived grant exceeds its parent                  | `delegation_chain_invalid` |
| `escalation_recorded`        | Escalation is requested and recorded              | `escalation_requested`     |
| `record_completeness`        | Allowed and denied turns emit a complete record   | `ExecutionRecord`          |
| `typed_governed_views`       | Serve a typed governed view in place of a record  | _not implemented_          |
| `replay_freshness`           | Replay a recorded turn against a freshness check  | _not implemented_          |

The last two rows are declared and not built. They are here rather than omitted
because a matrix that silently drops the rows nobody implemented describes a
narrower system as a more conformant one. `ConformanceCase.notImplemented`
carries the reason, the cell reports `not implemented`, and the row is never run
and never a pass.

Two rows need more than one turn or more than one kind of attempt:

- **`revoked_mid_turn`** runs twice against one world. The store revokes a grant
  immediately after the first turn's authority load, so the revocation lands
  while that turn is still running; the first turn keeps the authority it was
  admitted with and the second sees the revocation. Attempts declare which turn
  they belong to with `AttackAttempt.turn`, so the number of turns follows from
  the move rather than being a second thing to keep in step with it.
- **`grant_material_unreachable`** cannot be attempted with a tool call. Its
  attempt sets `inspect: "grant_material"`, which walks every field of the turn
  request and every property of the runtime host, own and inherited, looking for
  anything that carries authority. That is the run-time half; the compile-time
  half the matrix names as its signal lives in `runtime-surface.test.ts`.

### Attempt receipts

Every declared attempt produces an `AttemptReceipt` recording whether the call
was actually issued, which tool it named, its argument _keys_, and the status and
reason code that came back. Receipts never carry argument values.

`attempted: false` is the field that keeps a cell honest. Without it, "SharedOS
denied the attack" is indistinguishable from "no attack appears in the trace".
Receipts are emitted as runtime events as they happen and returned again with
the terminal outcome, so a cancelled or timed-out turn still says what was tried;
`readAttemptReceipts` recovers them from the event stream alone.

An attempt may also be declared `unreachable`, meaning a runtime plugin
structurally cannot make it — changing the turn's namespace, for example. That
is stronger evidence than a denial, and recording it as a declared attempt keeps
it distinguishable from a row nobody thought to test.

### The adversary is only the attacker

`createConformanceWorld` builds the world each move is declared against and owns
every control that arms a dangerous condition in it: revoking a grant, revoking
a delegation ancestor, and taking the grant store offline. Those are host-owned
control-plane operations in SharedOS, not agent-reachable ones, and a runtime
plugin receives only a sanitised turn request and a tool-invoking host, so the
separation holds by construction rather than by convention.

Keeping it that way keeps two questions apart. "Can an attacker obtain
administrative power?" is a privilege-escalation question and belongs to its own
suite. "Given this condition, does the kernel enforce?" is what the manifest
measures, and it is the only question these moves ask.

What the manifest does assert about the control plane is that it is not reachable
from a turn at all. The `hidden_tool` row guesses a plausible grant-issuing tool
name and a registered tool in a namespace this context never enables, and both
are refused as `tool_unavailable` without revealing which of the two they were.
Revocation, namespace administration, and store configuration have no tool, no
resource, and no message path, so there is nothing for a move to attempt: they
are host-side objects a runtime plugin is never handed.

## Running the suite

`pnpm conformance` runs every case against every column and writes two things:

- a **deterministic summary** — `docs/conformance/kernel-conformance.{md,json}` —
  committed, so a change in enforcement behaviour appears as a reviewable diff in
  the pull request that caused it;
- the **full evidence** — `artifacts/conformance/evidence.json` — ignored, since
  it carries execution records, runtime manifests, and timings that churn without
  any invariant result changing.

Nothing volatile reaches the summary. A cell holds the status, which boundary
refused the attempt, the observed reason codes, how many attempts were issued,
and whether the record was usable. Runtime versions, model names, durations, and
event volumes stay in the evidence artifact.

`pnpm conformance:check` regenerates the summary, fails if the committed copy is
stale, and fails on any cell that is `fail` **or** `not exercised`. A row that
proved nothing is a broken suite, not a soft result, so it breaks the build the
same way a real regression does.

`not implemented` is the one status that does not break the build. It is a
standing result rather than a regression: the row is declared, its absence is
stated in the manifest, and failing on it would only pressure someone into
deleting the row. The script prints the count on every run so the gap stays in
view.

### Cases and conditions

A `ConformanceCase` pairs a move with the _conditions_ it runs under, where a
condition is a trusted world arming expressed as data. A row whose expected
outcome has two clauses needs two conditions: "deny; invalidate descendants"
cannot be evidenced by one arming, so the replayed-grant row runs once with the
agent's own grant revoked and once with the grant it was delegated from revoked.
They deny with different reason codes, and the manifest carries both.

### Grading

`judgeCase` compares receipts against declared expectations. It is separate from
the runtime on purpose: the adversary records what happened and never decides
whether it was correct, so the same receipts can be re-graded without re-running
anything.

- A **control** attempt that did not succeed makes the case `not_exercised`. The
  fixture, not the kernel, decided the outcome, so the row is evidence of
  nothing.
- An attack that was never issued is `not_exercised`, never a pass.
- A declared-unreachable attempt is `not_applicable` and does not sink the case.
  Unreachability is declared by the move when no runtime can make the attempt,
  and by the **column** when this runtime cannot — which is what keeps a row a
  comparison across columns rather than a penalty for the columns that cannot
  reach every part of it.
- Record completeness is reported beside the verdict rather than folded into it —
  except for the record-completeness row itself, where the record _is_ the claim.

Some rows are about how the turn ends rather than about a call inside it. A
condition can declare `expectTurn`, and the row is then graded on the turn's
terminal outcome as well as on its attempts. Two shapes use it:

- an unavailable grant store refuses the turn at admission, so the runtime is
  never started and every declared attempt is reported as structurally
  unreachable rather than as never exercised;
- an escalated turn did run, so its attempts are graded exactly as any other
  row's and the ending is an additional requirement on top of them.

Whether the runtime started is read from the record, not declared. It takes both
halves — the condition saying the turn would end this way and the record showing
no `turn.started` — for an attempt to count as unreachable, so a row that simply
produced no receipts cannot report as `not applicable`.

### Columns

A column is an adapter occupying the delegate seat. The attacker stays scripted
across all of them; what varies is the runtime mediating its calls, which is
exactly the claim under test — the kernel's guarantees should not depend on which
driver is in the seat. Adding a column is supplying a
`(moves, options) => RuntimePlugin` factory; the suite and the grading do not
change.

Three columns are committed. `EMBEDDED_COLUMN` puts `HostileRuntime` in the seat
directly. `CODEX_SCRIPTED_COLUMN` and `CLAUDE_CODE_SCRIPTED_COLUMN` put the
Codex and Claude Code adapters there, driven by frames built from the same move:
`movesToTranscript` renders each declared attempt into that vendor's own wire
shape, and the adapter's real protocol translation reads them back. The kernel
and the envelope are the real ones. What is left out is the transport that would
carry those frames from a live CLI — **live-run columns are a separate claim and
are not yet made.**

A vendor column cannot report on itself: a harness does not know it is in a
conformance run. Its attempts are recovered from the execution record instead,
by `receiptsFromRecord`, which is the stricter source — a runtime that quietly
skipped a call leaves no operation behind to be mistaken for a denial. This
works only because the envelope records a refusal code on the `tool.completed`
event: a call refused before the kernel reaches no audit sink, so without that
code the record could say an envelope refusal happened but not which one.

`RuntimeColumn.limits` is how a column states what it structurally cannot do,
per row and per condition. The vendor columns declare three things: they cannot
enumerate the runtime surfaces they were never handed, they cannot escalate
because no vendor frame means "ask a human to decide", and they cannot outrun a
step budget because `StandardRuntime` — the loop every harness driver runs
inside — stops at its own step ceiling first. Each one becomes a `not applicable`
cell carrying its reason, rather than a failure blaming the kernel for a limit
something else honoured.
