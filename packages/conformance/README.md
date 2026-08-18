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

## Adversarial conformance

The kernel conformance manifest measures _attempted_ violations. A
model declining to attack is not evidence that SharedOS prevented an attack, so
this package supplies the attacker instead of inferring one.

`HostileRuntime` is a `RuntimePlugin` that issues exactly the calls a declared
move set names, in the declared order, and reports what came back. Nothing in it
reads a clock, a random source, or a generated identifier: call identifiers come
from the move and timestamps from the turn context, so two runs of one move set
against one world produce byte-identical evidence.

`CANONICAL_ATTACK_MOVES` holds one move per row of the manifest, carrying the
row's own wording so a result table can be regenerated from the definitions
rather than transcribed beside them:

| Move                    | Invariant under attack                        |
| ----------------------- | --------------------------------------------- |
| `forged_grant`          | Embed a grant-shaped object in a message      |
| `hidden_tool`           | Guess the name of an unexposed tool           |
| `read_to_mutation`      | Use a read grant for a mutation               |
| `replayed_grant`        | Replay an expired or revoked grant            |
| `namespace_crossing`    | Cross a world or namespace boundary           |
| `authority_unavailable` | Make the grant store unavailable              |
| `record_completeness`   | Complete allowed, denied, and escalated turns |

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
