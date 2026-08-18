# @aicoo/sharedos-adapters

Codex and Claude Code runtime adapters for SharedOS.

An adapter is translation and nothing else. The turn loop, the
permission-filtered tool catalogue, per-call re-authorization, and audit all
come from the SharedOS execution envelope, so installing a second harness
changes no kernel code and adds no second permission path.

```ts
import { SharedOSExecutor } from "@aicoo/sharedos-runtime";
import { createCodexRuntime } from "@aicoo/sharedos-adapters";
import { ChildProcessTransport } from "@aicoo/sharedos-adapters/node";

const codex = createCodexRuntime({
  transport: new ChildProcessTransport({ command: "codex", args: ["exec", "--json"] }),
});
const turns = new SharedOSExecutor(kernel, codex);
```

Use `createCodexRuntime` rather than wrapping `createCodexDriver` in
`StandardRuntime` yourself. The executor stamps the installed plugin's manifest
onto every execution record, and `StandardRuntime` reports itself as
`sharedos.standard`, so the driver-only form files a Codex turn's evidence under
the reference loop. Comparing harnesses depends on each column's evidence naming
the harness that produced it.

## The three pieces

An adapter is assembled from parts that are replaceable independently, which is
what lets the translation be verified without the vendor's CLI present.

| Piece              | Responsibility                                                                    |
| ------------------ | --------------------------------------------------------------------------------- |
| `HarnessProtocol`  | The vendor's wire shapes: tool declarations, tool calls, tool results, completion |
| `HarnessTransport` | How the harness is reached: a subprocess, an HTTP session, a recorded transcript  |
| `HarnessDriver`    | An `AgentTurnDriver` that joins the two and hands every tool call to the envelope |

## What the adapter must not do

Tool calls are passed to the envelope exactly as the harness emitted them,
including names that are not in the catalogue.

Filtering them in the adapter would be the adapter quietly enforcing policy, and
worse, it would erase the attempt: a guess at an unexposed tool has to reach the
envelope to be refused and recorded. An adapter that silently dropped it would
make a harness that tried look identical to one that did not.

For the same reason a refusal is reported back to the harness as an ordinary
tool result carrying its reason code, not as a transport error. The harness needs
to know it was refused so it can choose differently.

Tool calls arriving together in one frame are executed one at a time. SharedOS
re-authorizes every call separately, so serialising them is the conservative
order and the one whose audit trail matches what actually happened.

## Verification status

The translation code is exercised end to end against recorded transcripts, which
run the real protocol modules through a real kernel and a real execution
envelope. `TranscriptTransport` replays vendor frames batch by batch, releasing
the next batch only once a result has been written, which is the shape of every
tool-using harness.

What a transcript cannot cover is the transport binding: the exact command-line
flags each CLI wants, and the outer envelope it wraps its frames in.

| Layer                                      | Status                                                 |
| ------------------------------------------ | ------------------------------------------------------ |
| SharedOS side of the translation           | Verified by tests                                      |
| Codex function-call shapes                 | Targets the OpenAI Responses function-calling protocol |
| Claude Code content blocks                 | Targets Anthropic message content blocks               |
| Claude Code stream-json envelope           | **Verify against a live CLI**                          |
| CLI invocation flags and startup handshake | **Verify against a live CLI**                          |

The two rows marked for verification are confined to `codex/protocol.ts`,
`claude-code/protocol.ts`, and the `ChildProcessTransport` options a host
supplies. Nothing else changes when they are corrected.

## Availability

`probeCodex` and `probeClaudeCode` report whether a harness can run here, and
say why not when it cannot:

```ts
import { probeClaudeCode } from "@aicoo/sharedos-adapters/node";

const availability = await probeClaudeCode();
// { harness: "claude-code", available: false, reason: "The claude executable is not on PATH." }
```

Both harnesses can authenticate from a stored login as well as from an
environment variable, so a probe treats credentials as optional and reports which
one it found. Conformance runs should use this to mark a column as not
exercised rather than as failing: an absent harness is not evidence about
SharedOS.

## Host neutrality

The main entry point has no Node dependency. `ChildProcessTransport` and the
availability probes are published from `@aicoo/sharedos-adapters/node`, because
spawning a CLI and reading `PATH` are host concerns rather than protocol ones.
