# ADR 0012: One refusal vocabulary at both enforcement boundaries

- Status: Accepted
- Date: 2026-08-21

## Context

SharedOS enforces at two boundaries: the execution envelope, which refuses a
call for a tool outside the permission-filtered catalogue before the kernel is
consulted, and the kernel, which re-authorizes every mediated operation. ADR
0007 established the split deliberately.

Three things had drifted out of it.

**Two codes for one refusal.** The envelope answered an unexposed tool with
`tool_not_available` and the kernel answered the same attempt with
`tool_unavailable`. The conformance matrix declares one signal for that row, so
which code appeared depended on which boundary happened to get there first — and
a host matching on the declared one would miss half the refusals.

**A boundary crossing reported as a tool defect.** A tool that resolved a
requirement naming another owner was refused with `invalid_tool_requirement`,
the code for a tool escaping the ceiling it declared. The declared-ceiling check
ran first and its owner comparison caught the crossing on the way past. The two
are different findings: one says the tool misbehaved, the other says the request
is not permitted. The matrix declares `invalid_request` for a boundary crossing,
and the row was passing on the wrong evidence.

**Refusals the record could not name.** A call the envelope terminated never
reaches the kernel and so never reaches audit. The execution record therefore
knew that an envelope refusal had happened but not which one — a guessed tool
and a blown call budget were the same entry. The conformance suite only appeared
to distinguish them because the scripted adversary re-reported its own reason
codes, which is the runtime being trusted to describe its own refusals.

A fourth gap sat beside them: the step budget was enforced only by
`StandardRuntime`'s own loop. A `RuntimePlugin` is a replacement for exactly
that loop, so a limit only the reference implementation honours is not a limit.

## Decision

The two boundaries share one vocabulary and are equally recorded.

- **One code.** The envelope emits `tool_unavailable`, the kernel's code. Which
  boundary refused is still recoverable: it is `OperationRecord.source`, which
  is where that distinction belongs. A code is what was refused; a source is who
  refused it, and conflating them made the declared signal depend on routing.
- **The world boundary is checked first.** `SharedOSKernel.invokeTool` tests
  whether a resolved requirement names the caller's own owner before testing it
  against the tool's declared ceiling. A crossing is answered by the authorizer,
  so it carries `invalid_request` and a recorded authorization decision like any
  other denial. `invalid_tool_requirement` keeps its own meaning.
- **The record names envelope refusals.** `tool.completed` carries the refusal
  code, and the execution record's envelope operations carry it through. The
  event stream is the only record of a call audit never saw, so this is the only
  place the distinction can live.
- **The envelope holds the step ceiling.** A declared step at or past
  `maxSteps` is refused, and so is a new step once that many distinct ones have
  been seen — the second rule is what stops a plugin renumbering its way around
  the first. A plugin that declares no step is not step-bounded, because the
  envelope sees tool calls and cannot infer model turns from them; it is still
  bounded by `maxToolCalls`, which needs nothing from the runtime.

## Consequences

- A host matching on `tool_not_available` no longer sees it. The code is gone
  rather than aliased: two names for one refusal is the defect.
- An owner-crossing attempt is now `denied` with `invalid_request` rather than
  `failed` with `invalid_tool_requirement`, and produces an audit decision it
  previously did not.
- An execution record distinguishes envelope refusals without depending on the
  runtime to report honestly about itself. That is what makes a conformance
  column possible for a runtime which cannot report on itself at all — a vendor
  harness replaying recorded frames has its attempts recovered from the record.
- `step_limit_exceeded` can now come from the envelope as well as from
  `StandardRuntime`. Both mean the same thing, which is the point.

## Rejected alternatives

**Alias the two codes.** Rejected: it keeps both in the wire vocabulary forever
and leaves every consumer to know they are the same.

**Clamp a foreign owner back to the caller's own in the provider.** Rejected —
and the conformance world's file store deliberately does not do it. A provider
that quietly corrected its arguments would make the kernel look correct while
doing the enforcement itself, and the fixture would stop testing the boundary it
exists to test.

**Put envelope refusals into audit.** Rejected. Audit is the kernel's record of
decisions it made, and a call the kernel never saw is not one of them. The
execution event stream already carries the attempt; it only needed to carry the
outcome with it.

**Infer steps from tool calls.** Rejected as a guess dressed as a limit. One
model turn may make no calls or several, so a count of calls is not a count of
steps, and enforcing one as the other would refuse correct turns while letting
others through.
