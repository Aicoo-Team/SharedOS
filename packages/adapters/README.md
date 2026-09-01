# @aicoo/sharedos-adapters

Codex, Claude Code, DeepSeek Harness, and Pi as SharedOS runtimes, and a model
API in the same seat.

An adapter is translation and nothing else. The turn loop, the
permission-filtered tool catalogue, per-call re-authorization, and audit all
come from the SharedOS execution envelope, so installing another harness
changes no kernel code and adds no second permission path.

```ts
import { SharedOSExecutor } from "@aicoo/sharedos-runtime";
import { createCodexRuntime } from "@aicoo/sharedos-adapters";
import { ChildProcessTransport } from "@aicoo/sharedos-adapters/node";

const codex = createCodexRuntime({
  transport: new ChildProcessTransport({
    command: "codex",
    // `-` makes `codex exec` read its prompt from stdin, which is where the
    // opening frame goes. Without both, nothing reaches Codex.
    args: ["exec", "--json", "--skip-git-repo-check", "-"],
    openingFrame: (request) => ({ type: "user_input", text: request.prompt }),
  }),
});
const turns = new SharedOSExecutor(kernel, codex);
```

Use `createCodexRuntime` rather than wrapping `createCodexDriver` in
`StandardRuntime` yourself. The executor stamps the installed plugin's manifest
onto every execution record, and `StandardRuntime` reports itself as
`sharedos.standard`, so the driver-only form files a Codex turn's evidence under
the reference loop. Comparing harnesses depends on each column's evidence naming
the harness that produced it.

## Four ways to occupy the seat

| Path                    | What is in the delegate seat                                       | Entry points                                                                                                           |
| ----------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Driven harness          | A vendor CLI, run one turn at a time by SharedOS's own loop        | `createCodexRuntime`, `createClaudeCodeRuntime`, `createDeepseekRuntime`, `createPiRuntime`; `HarnessRuntime`          |
| Driven model            | A model API, with no vendor between it and the kernel              | `ModelDriver`, `ModelRuntime`, `OpenAiCompatibleModelClient`                                                           |
| Native harness over MCP | A vendor CLI running its own loop, with the catalogue served to it | `createMcpHarnessRuntime` and the `*_MCP_HARNESS` specs, from `@aicoo/sharedos-adapters/node`                          |
| Transcript              | Supplied vendor frames, for testing the translation without a CLI  | `TranscriptTransport`, `HarnessTranscript`, and the `*FrameWriter`s that render a declared attempt in a vendor's shape |

The first two run inside `StandardRuntime`: SharedOS owns the loop, renders the
permission-filtered catalogue into the harness's or the model's own tool shape,
and mediates every call. The third hands the loop to the vendor and serves the
catalogue over the Model Context Protocol instead; it is documented in
`docs/mcp-toolshare.md`. All of them converge on
`RuntimeHost.invokeTool`, which is the only place a tool is executed.

## The three pieces of a driven harness

An adapter is assembled from parts that are replaceable independently, which is
what lets the translation be verified without the vendor's CLI present.

| Piece              | Responsibility                                                                    |
| ------------------ | --------------------------------------------------------------------------------- |
| `HarnessProtocol`  | The vendor's wire shapes: tool declarations, tool calls, tool results, completion |
| `HarnessTransport` | How the harness is reached: a subprocess, an HTTP session, a supplied transcript  |
| `HarnessDriver`    | An `AgentTurnDriver` that joins the two and hands every tool call to the envelope |

`ModelDriver` is the same shape with the protocol folded in: the catalogue is
rendered straight into the model's tool-call format, and a `ModelClient` stands
where the transport does.

## What the adapter must not do

Tool calls are passed to the envelope as the harness emitted them, including
names that are not in the catalogue.

Filtering them in the adapter would be the adapter quietly enforcing policy, and
worse, it would erase the attempt: a guess at an unexposed tool has to reach the
envelope to be refused and recorded. An adapter that silently dropped it would
make a harness that tried look identical to one that did not.

The one call that does not reach the envelope is the escalation affordance. A
call naming `sharedos.escalate` on a turn whose catalogue offers it ends the
turn `escalated` with the reason the harness gave, because asking for a human is
an ending rather than a tool (ADR 0011, 0017). The catalogue gates the name: on
a turn that was never granted the affordance the call is passed through like any
other and refused `tool_unavailable`.

For the same reason a refusal is reported back to the harness as an ordinary
tool result carrying its reason code, not as a transport error. The harness needs
to know it was refused so it can choose differently. A model whose call
arguments are not a JSON object is answered the same way, `invalid_tool_arguments`,
and never sent `{}` in their place.

Tool calls arriving together in one frame are executed one at a time. SharedOS
re-authorizes every call separately, so serialising them is the conservative
order and the one whose audit trail matches what actually happened.

## Who executes the tools

The four harnesses do not agree on this, and the difference decides what a
driven column can claim.

| Harness     | Catalogue reaches the harness by                           | Tool executed by  |
| ----------- | ---------------------------------------------------------- | ----------------- |
| Codex       | `function` declarations, on the wire                       | The host          |
| Claude Code | `input_schema` tools, on the wire                          | The host          |
| DeepSeek    | Out of band — its `dsh-mcp-client` plugin, over MCP        | The host, via MCP |
| Pi          | Out of band — an MCP extension, or `defineTool` in the SDK | The host, via MCP |

Codex and Claude Code carry a tool catalogue in the protocol itself. DeepSeek
Harness and Pi run their own tools and have no wire frame that means "here is
your catalogue", so their driven adapters stamp `catalogueDelivery: "out-of-band"`
onto every execution record they produce: a column whose catalogue arrived out
of band is making a narrower claim than one whose catalogue was on the wire, and
that belongs in the evidence rather than in a footnote.

It is also why a native run over a CLI's own stdio — any of the four — leaves
the kernel rows `not exercised`: the driver can carry the transport, but a CLI
exposes neither its API layer nor a frame for the catalogue (ADR 0014), so the
harness reaches for its own tools. The MCP path is what closes that gap.
`createMcpHarnessRuntime` serves the permission-filtered catalogue over MCP to a
CLI running natively; `scripts/mcp-conformance.mjs` runs the case set against
each installed CLI that way, and ADR 0018 records what the escalation-case runs
on all four showed.

## Verification status

The translation code is exercised end to end against supplied transcripts, which
run the real protocol modules through a real kernel and a real execution
envelope. Nothing in this package captures a vendor session: a transcript is
whatever its caller hands it, and the conformance suite writes its own.
`TranscriptTransport` replays vendor frames in batches and releases the next
batch only once a result has been written, which is the shape of every
tool-using harness.

What a transcript cannot cover is the transport binding — the exact command-line
flags each CLI wants, and the outer envelope it wraps its frames in — and what a
model actually chooses. Two scripts cover exactly those gaps:

- `scripts/native-conformance.mjs` spawns each installed CLI as a driven
  harness, and runs the model column when a key is present;
- `scripts/mcp-conformance.mjs` runs each installed CLI natively against the
  catalogue over MCP.

Both report a harness that is absent, unauthenticated, or emitting shapes the
adapter does not parse as `not exercised`, never as a pass and never as a kernel
failure. The version each run drove is the harness's own to report, so it is
recorded in the artifact the script writes under `artifacts/conformance/` —
local to the machine that ran it, not committed — rather than pinned here; ADR
0014 and ADR 0018 pin the versions of the runs they record.

## Availability

`probeHarness` reports whether a harness can run here, and says why not when it
cannot. `probeCodex`, `probeClaudeCode`, `probeDeepseek`, and `probePi` are the
same call with each adapter's `*_REQUIREMENTS` supplied:

```ts
import { probeClaudeCode } from "@aicoo/sharedos-adapters/node";

const availability = await probeClaudeCode();
// { harness: "claude-code", available: false, reason: "The claude executable is not on PATH." }
// or { harness: "claude-code", available: true, version: "…" }
```

Every one of these harnesses can authenticate from a stored login as well as from
an environment variable, so a probe treats credentials as optional unless the
requirements say otherwise, and reports which one it found. Conformance runs use
this to mark a column as not exercised rather than as failing: an absent harness
is not evidence about SharedOS.

## Reason codes

The codes an adapter ends a turn with — `harness_*`, `model_*` — and the one it
answers in band on the MCP path, `escalation_pending`, are listed with the rest
in `docs/errors.md`.

## Host neutrality

The main entry point has no Node dependency. `ChildProcessTransport`, the
availability probes, and the MCP harness runtime are published from
`@aicoo/sharedos-adapters/node`, because spawning a CLI, reading `PATH`, and
opening a loopback server are host concerns rather than protocol ones.
