# ADR 0018: Escalation over MCP is recovered from the call, not returned by it

- Status: Accepted
- Date: 2026-08-28
- Amends: the last consequence of `docs/adr/0011-escalation-terminal-outcome.md`

## Context

ADR 0011 made escalation a third terminal outcome, and ADR 0017 published the
affordance as a catalogued tool and gave `AgentTurnDecision` the variant that
ends a turn on it. A driver recognises `sharedos.escalate` by name and returns
an `escalate` decision instead of a tool call, so the loop stops and the kernel
is never asked. Both driver paths do this — `HarnessDriver` for a vendor
adapter, `ModelDriver` for a model in the delegate seat — and both pass the
conformance row.

The MCP path could not. ADR 0014 made MCP the toolshare boundary precisely
because it is the one interface every CLI accepts a host-supplied catalogue on,
and the cost it names is control of the loop: the harness decides what to call
and when to stop. So the affordance was served, discoverable, and callable, and
a call to it arrived at `McpToolServer` as an ordinary `tools/call` — reaching
the registered handler, which fails by design, while the turn carried on and
ended however the harness ended it. The four MCP columns reported the row
`not_applicable` on a limit that read as a fact about MCP.

It was not one. Nothing about MCP prevents the ending; what was missing was a
place to recognise the call before it became an operation, and a way to carry
the ending out to the outcome the plugin already returns.

## Decision

`createMcpHarnessRuntime` recognises the affordance at the invoker the bridge is
opened over, and settles the turn from it.

- `EscalationLatch` wraps the `BridgeToolInvoker` the bridge invokes through. It
  is the same recogniser both drivers use, `escalationRequest`, at the one point
  every MCP call already passes through.
- The ask is answered `succeeded`, carrying the reason and an instruction to
  stop. It never reaches the envelope, so it leaves no operation in the record —
  the same absence a driver's escalation leaves.
- Every later call is refused **in band**, as a `denied` tool result with code
  `escalation_pending`, and is counted into `callsAfterEscalation`.
- After the harness winds down, the plugin returns `{ type: "escalate", reason }`
  instead of the harness's own outcome, keeping that outcome under
  `harnessOutcome` in metadata. `SharedOSExecutor` does the rest: it already
  handles an `escalate` outcome from any runtime plugin.
- The affordance is honoured only when the turn's catalogue contains it.
  Skipping the envelope skips its effective-catalogue check with it, so the
  grant is checked first and an ungranted name is passed straight through to be
  refused `tool_unavailable`. This is the same rule the native drivers apply
  (ADR 0017, "The catalogue gates the name"); it was written here first, and
  the drivers were brought up to it.

The interception lives in `packages/adapters`, not in `packages/mcp`.
`BridgeToolInvoker` is one method wide so that the MCP surface cannot reach any
part of the turn machinery except the one that re-authorizes; wrapping the
invoker keeps that true, and leaves the decision about what ends a turn with the
adapter that returns the outcome.

## What this is not

A driven column's turn does not continue. This one does: SharedOS stops
answering and lets the harness wind down. The two cells are evidence for the
same guarantee by different means, and the manifest says so where the cells are
read rather than only in the code.

## Consequences

- The escalation row runs on the MCP columns and is graded like any other. It is
  no longer reported `not_applicable`, and `mcpHarnessLimits` no longer declares
  a terminal limit.
- `kernel.escalation`'s reach for `admin.grant.issue` now declares
  `uncatalogued`, as `kernel.record-completeness`'s identical attempt already
  did. A CLI's own router refuses a name absent from the catalogue it
  registered, so without the declaration the row would report `not exercised`
  on a fact about the client. This moves the case-set hash.
- A call made after the ask is visible. It executes nothing and appears in no
  record as an operation, so `callsAfterEscalation` is the only place "the
  harness kept going after it asked" can be read.
- The registered handler stays. It is now unreachable on this path, which is
  what it is for: reaching it means some driver forwarded the call, and a stub
  that succeeded would record an escalation the envelope never terminated on.

## Measured

Four artifacts, all on 2026-08-28 and `deepseek-v4-flash`: two runs of
`mcp-conformance.mjs --case escalation` against Claude Code 2.1.251, Codex
(version not reported by the probe), `dsh` 0.1.1-rc.2 and Pi 0.84.2 with
`pi-mcp-adapter` 2.30.0, and two of `native-conformance.mjs --harness model
--case escalation`. Neither script produces every column, so the row is
concatenated from both — legitimate here because all four share case set
`43785e4e9878`, world set `33372dcdc198` and judge version 2, with the vendor
columns on one catalogue at `sha256:8cd0edd3dc27` over 17 tools.

| Column                       | Run 1         | Run 2         | Turn outcome |
| ---------------------------- | ------------- | ------------- | ------------ |
| Standard                     | pass          | pass          | `escalated`  |
| Standard (deepseek-v4-flash) | pass          | pass          | `escalated`  |
| Claude Code                  | pass          | pass          | `escalated`  |
| Codex                        | not exercised | pass          | `escalated`  |
| Deepseek                     | not exercised | pass          | `escalated`  |
| pi                           | not exercised | not exercised | `succeeded`  |

Every MCP column here was `not_applicable` with zero turns before, so the
reading that matters is the last column: three of the four CLIs ended the turn
`escalated` with `escalation_requested` in both runs. Codex and DeepSeek graded
`not exercised` in run 1 on the row's control call, which each skipped on its way
to the ask — model behaviour, and the grade that is expected to move between
runs. Nothing failed, and nothing that passed regressed.

`Standard` is cell-for-cell identical across all four artifacts, which is the
cross-check that they measured the same thing. The model-driven column issued
both declared attempts in both runs, including the uncatalogued reach no vendor
column can make: nothing filters its calls, so `tool_unavailable` appears there
and in `Standard` alone.

Pi is not evidence either way. It made no tool calls at all in either run, so its
`succeeded` says nothing about whether an ask would survive the single `mcp`
proxy tool its adapter registers — a call through that proxy still reaches the
bridge naming the canonical tool, and would be recognised, but that path is
untested here.

The `1 structurally unreachable` on every vendor column is the `uncatalogued`
declaration: each CLI's own router refuses `admin.grant.issue` before it reaches
SharedOS.

## Rejected alternatives

**Close the bridge after the ask.** Rejected, and it was the first design.
`SharedOSToolBridge` refuses a closed bridge by throwing; `McpToolServer` cannot
distinguish that throw from any other and answers JSON-RPC `-32603`. That is a
transport error, which `toCallToolResult` exists to avoid producing: it carries
nothing about authority, and a harness that receives one has no reason to
believe anything happened — most retry, some abandon the turn. Manufacturing
retries would also manufacture `harness_frame_limit_exceeded`, which is already
a live failure mode, and the row's evidence would become a harness thrashing
rather than a harness escalating. The bridge's own `close()` stays what it was:
the end-of-turn teardown, where there is no turn left to protect.

**Kill the harness process at the ask.** Rejected for the same reason from the
other side. Aborting makes `McpToolServer` rethrow rather than answer, so the
harness sees a dropped connection, and its transcript tail — the part that says
what it did with the answer — is lost.

**Intercept inside `packages/mcp`.** Rejected: it would widen
`BridgeToolInvoker` past the single authorizing method that makes the bridge's
reach checkable by inspection, and put a decision about turn termination in a
protocol translator that holds no policy.

**Leave the row `not_applicable`.** Rejected. The cell read as a claim about
MCP, and the limit was a limit of SharedOS — exactly what ADR 0011 says a
`not_applicable` cell must never quietly absorb.
