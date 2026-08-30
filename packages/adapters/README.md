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

| Path                    | What is in the delegate seat                                                                     | Entry points                                                                                                                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Driven harness          | A vendor CLI, run one turn at a time by SharedOS's own loop                                      | `createCodexRuntime`, `createClaudeCodeRuntime`, `createDeepseekRuntime`, `createPiRuntime`; `HarnessRuntime`                                                                                                               |
| Driven model            | A model API, with no vendor between it and the kernel                                            | `ModelDriver`, `ModelRuntime`, `OpenAiCompatibleModelClient` or `OpenAiResponsesModelClient`; `apiKeyCredential` or `SubscriptionOAuthCredential` to authenticate it; `TranscriptModelClient` for a scripted reply sequence |
| Native harness over MCP | A vendor CLI running its own loop, with the catalogue served to it                               | `createMcpHarnessRuntime` and the `*_MCP_HARNESS` specs, from `@aicoo/sharedos-adapters/node`                                                                                                                               |
| Transcript              | Supplied vendor frames or model replies, for testing the translation without a CLI or a provider | `TranscriptTransport`, `HarnessTranscript`, and the `*FrameWriter`s that render a declared attempt in a vendor's shape; `TranscriptModelClient`, `ModelTranscript` for the model seat                                       |

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

## Authenticating the model seat

A model client presents a `ModelCredential`, and there are two kinds.

| Credential                    | What the provider recognises                                                       | Renews |
| ----------------------------- | ---------------------------------------------------------------------------------- | ------ |
| `apiKeyCredential`            | A metered account, by a constant key                                               | No     |
| `SubscriptionOAuthCredential` | A person with a plan, by an OAuth access token and the account code the plan bills | Yes    |

The subscription case is the reason the interface exists. A key is a constant;
a subscription token expires, is renewed against the provider's token endpoint,
and travels with the code of the account the call is billed to in a header the
provider names — `chatgpt-account-id`, for the login `codex login` leaves behind.

```ts
import { OpenAiCompatibleModelClient, ModelDriver, ModelRuntime } from "@aicoo/sharedos-adapters";
import { createCodexSubscriptionCredential } from "@aicoo/sharedos-adapters/node";

const credential = await createCodexSubscriptionCredential();
const runtime = new ModelRuntime(
  new ModelDriver({
    manifest,
    client: new OpenAiCompatibleModelClient({
      credential,
      model: "gpt-5.6",
      provider: "openai",
      baseUrl: "https://api.openai.com/v1",
    }),
  }),
);
```

### Signing in without the vendor's CLI

A login can be read, or obtained. Reading one is
`createCodexSubscriptionCredential`, above: whatever `codex login` left behind.
Obtaining one is a device login, which needs no vendor binary installed and no
browser on this machine.

```
$ pnpm login:subscription

Sign in to your subscription:

  1. Open  https://auth.openai.com/codex/device
  2. Enter this one-time code:  ABCD-1234
```

The person types that code on whatever device has a browser; this machine only
polls. The login lands in the file the vendor's own tools read, so everything
downstream — including `SHAREDOS_MODEL_AUTH=codex-subscription` — finds it where
it already looks. In code it is `requestDeviceAuthorization`, which returns the
code, the page, and a `wait` that resolves to the same `SubscriptionTokens` a
stored login yields.

Device login is off by default on a ChatGPT account; a person turns it on in
their security settings, or an admin does for a workspace. Until then the
provider answers with a `404`, and that is reported as the refused capability it
is rather than as a missing route.

It is deliberately not RFC 8628. That standard's discovery document says this
provider has no device login, and following it would fail at the first request:
the endpoints live under the issuer's account server, a pending login is spelled
`403` or `404` rather than `authorization_pending`, and a finished poll returns
an authorization code plus the PKCE verifier the _server_ generated, which is
then exchanged at the ordinary token endpoint. The flow here is written to the
vendor's own implementation, because for this grant that is the specification
(ADR 0020).

SharedOS still holds no client secret, never sees a password — the provider's
page does — opens no browser, and starts no listener. Renewed sessions are
written back, because providers rotate the refresh token on every exchange and a
run that does not persist what came back leaves the vendor's own CLI unable to
log in.

Three properties are worth stating plainly, because each of them is a decision
rather than an implementation detail.

**A credential is authentication, never authority.** It decides whether the
provider will answer, and nothing else. The catalogue this turn sees, the calls
it may make, and the audit it leaves are resolved from the `GrantSource` before
any credential is consulted. A subscription that pays for the model does not
vouch for the agent using it, and no header this presents can widen a grant.

**Headers are resolved per call, at the instant of the call.** A turn that
begins inside the token's validity window can outlive it, and the rule is the
one ADR 0016 states for grants: the operation's clock may only take away. A
token that has expired by the time a call is made is renewed before the call;
a window that has not opened yet is never widened.

**Nothing secret reaches a record.** `ModelCredential.describe` publishes the
scheme, the issuer, and whether the seat was account-scoped — never a token and
never the account code, which is a stable personal identifier and would
otherwise land in artifacts that get committed and compared. `ModelDriver` puts
that description on the turn's metadata as `auth`, so a run on somebody's
subscription is distinguishable from a run on a metered key.

## Two wire shapes, one policy

Which client to use is decided by what the endpoint speaks, not by how the call
authenticates.

| Client                        | Speaks                               | Reaches                                                               |
| ----------------------------- | ------------------------------------ | --------------------------------------------------------------------- |
| `OpenAiCompatibleModelClient` | `POST {baseUrl}/chat/completions`    | DeepSeek, and any provider serving the OpenAI chat-completions shape  |
| `OpenAiResponsesModelClient`  | `POST {baseUrl}/responses`, streamed | OpenAI's Responses API, including the endpoint a ChatGPT plan reaches |

Both extend `ModelHttpClient`, which holds everything that is not the wire
shape: the credential, the per-request deadline, the retry policy, the single
re-authentication on a 401, and the rule that a provider's error body never
reaches a caller. A second wire shape is an encoder and a reader — not a second
copy of the policy that decides whether a failed turn is honest evidence.

What differs is the translation. Responses items are flatter than
chat-completions messages: a tool call and the assistant text around it are
separate items, a tool result is an item of its own, and a tool is declared
without the `function` wrapper. The answer usually arrives as a stream, and what
is read is the event carrying the finished response rather than reassembled
deltas — the terminal event holds the whole response, so rebuilding it from
fragments would be a second implementation of the same answer. Which reader runs
is decided by the response's own content type, so a provider that streams when
it was not asked to, or declines to when it was, is read correctly either way.

Two defaults differ from the chat-completions client, and both are deliberate.
No `temperature` is sent unless a caller asks for one, because a reasoning model
rejects the parameter and those are the models this endpoint mostly serves. The
output ceiling is 32,768 rather than 4,096, because reasoning tokens count
against it and a reply cut off mid-thought fails the turn — correctly, but for a
reason that would be the client's doing rather than the model's.

A reply the provider cut short is reported as `truncated` by both clients, under
whichever word the provider used for it (`length`, `max_output_tokens`). That is
the one fact the driver acts on: it fails the turn rather than grading a cut
reply as a decision the model finished making.

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
tool-using harness. `TranscriptModelClient` is its counterpart for the model
seat: it replays supplied replies through the real `ModelDriver`, one reply per
model call, and treats a spent transcript as an error rather than a completion,
so a script that ends too early fails the turn instead of reading as a model
choosing to stop.

What a transcript cannot cover is the transport binding — the exact command-line
flags each CLI wants, and the outer envelope it wraps its frames in — and what a
model actually chooses. Two scripts cover exactly those gaps:

- `scripts/native-conformance.mjs` spawns each installed CLI as a driven
  harness, and runs the model column when a credential is present — a key, or
  with `SHAREDOS_MODEL_AUTH=codex-subscription`, a stored Codex login;
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
