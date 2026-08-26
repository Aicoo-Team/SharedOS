# ADR 0013: The conformance matrix is the case set

- Status: Accepted
- Date: 2026-08-21

## Context

The kernel conformance manifest ran seven rows. The conformance matrix declares
seventeen, plus two structural reinforcements it names but does not tabulate.
The other rows were not untested — expiry, bounded use, delegation attenuation,
and tool-ceiling rejection all had unit tests — but a unit test and a manifest
cell make different claims. A unit test says a function behaves; a manifest cell
says an attacker in the delegate seat, in a world armed against them, could not
get through, and that the record afterwards was usable evidence.

Two rows had no coverage of either kind, and neither appeared in the manifest.
An absent row and a passing row are indistinguishable from a table that only
lists what was run, so the manifest described a narrower system as a more
conformant one.

## Decision

Every row of the matrix is a `ConformanceCase`, and the strict gate covers all
of them.

Rows SharedOS does not implement are **declared, not omitted**.
`ConformanceCase.notImplemented` carries the reason, the cell reports
`not implemented`, and the row is never run and never a pass. Two rows are in
that state: typed governed views and replay/freshness.

`not implemented` is the one status that does not break the build. It is a
standing result rather than a regression: the row is declared, its absence is
stated, and failing on it would only pressure someone into deleting the row. The
conformance script prints the count on every run so the gap stays in view.

Three rows needed machinery the suite did not have, and each got the smallest
thing that made the row honest rather than the smallest thing that made it pass:

- **Revoke a grant mid-turn** now runs two turns against one world. Attempts
  declare which turn they belong to, so the turn count follows from the move.
  The alternative — arming the same revocation before the turn instead of during
  it — would have been a second copy of the "revoked before the turn" row
  wearing this row's name.
- **Runtime attempts to read grants** has a run-time half and a compile-time
  half. The attempt walks every field of the turn request and every property of
  the runtime host looking for authority; the compile failure the matrix names
  as its signal is asserted in `runtime-surface.test.ts`, which the build
  checks. Reporting a compile-time guarantee as a passing cell nobody ran would
  have been the manifest asserting something it did not observe.
- **Runtime exceeds its tool-call or step budget** splits into two conditions,
  because a row whose expected outcome has two clauses cannot be evidenced by
  one arming. The adversary issues the over-budget call deliberately, since a
  ceiling only the runtime honours is not a ceiling.

## Vendor columns, offline

The manifest gains a column per vendor adapter. `movesToTranscript` renders each
declared attempt into that vendor's own wire shape and the adapter's real
protocol translation reads it back, against the real kernel and envelope.

What is left out is the transport that would carry those frames from a live CLI.
These columns say nothing about whether a live session is installed,
authenticated, or emitting these shapes today. **Live-run columns are a separate
claim and are not made.** The manifest header says so rather than leaving a
reader to assume the columns mean more than they do.

A vendor column cannot report on itself — a harness does not know it is in a
conformance run — so its attempts are recovered from the execution record by
`receiptsFromRecord`. That is the stricter source: a runtime that quietly
skipped a call leaves no operation behind to be mistaken for a denial. It works
only because the envelope now records a refusal code on the `tool.completed`
event (ADR 0012).

`RuntimeColumn.limits` is how a column states what it structurally cannot do,
per row and per condition, producing a `not applicable` cell that carries its
reason. This keeps a row a comparison across columns rather than a penalty for
the columns that cannot reach every part of it.

## Consequences

- The manifest is 21 rows across 3 columns. Nineteen rows are run; two are
  declared and not built.
- A regression in any matrix invariant now breaks the build, not just the seven
  that used to be cells.
- The control-plane suite is explicitly out of scope. Whether an attacker can
  obtain administrative power is a privilege-escalation question with its own
  suite; whether the kernel enforces given a condition is what this manifest
  measures.
- Adding a row means adding a case, and a row nobody can implement yet still has
  to be written down.

## Rejected alternatives

**Leave the other rows as unit tests.** Rejected because the manifest is what is
published and reviewed. A guarantee evidenced only in a test file is not a
guarantee a reader of the manifest can see, and the two claims are not the same.

**Omit the rows SharedOS does not implement.** Rejected: it is the failure mode
a conformance manifest exists to prevent.

**Fail the build on `not implemented`.** Rejected. The only way to make the
build green would be to delete the row, which is the outcome the declaration
exists to avoid.

**Redefine an over-reach as an escalation to fill the escalation row.** Rejected
in favour of building escalation. See ADR 0011.
