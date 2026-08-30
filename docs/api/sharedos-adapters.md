[**SharedOS API v0.1.0-alpha.3**](README.md)

---

[SharedOS API](README.md) / @aicoo/sharedos-adapters

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
import {
  OpenAiCompatibleModelClient,
  ModelDriver,
  ModelRuntime,
} from "@aicoo/sharedos-adapters";
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

### Signing in and out without the vendor's CLI

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

Signing out is `pnpm login:subscription --logout`, or
`logoutCodexSubscription` in code. It tells the provider first and deletes the
stored session second, and that order is the point: deleting a login forgets it
here, it does not stop it working, and the refresh token is what keeps a
subscription session alive anywhere a copy of it survives — a backup, a
container image, a shell history.

| Call                      | What it ends                                                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `revokeSubscriptionLogin` | The session, at the provider. Hands back the refresh token, or the access token when there is no refresh token |
| `forgetCodexLogin`        | The stored copy, and only the session — an API key in the same file is left alone                              |
| `logoutCodexSubscription` | Both, in that order                                                                                            |

A failed revocation refuses to forget, so the log-out stays retryable rather
than leaving a live session that this machine can no longer name.
`--logout --local` is the escape hatch for a machine being decommissioned or an
endpoint that is down; it is named for what it does, because calling a local
delete a log-out is the mistake this whole path exists to avoid.

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

## Classes

### DriverRuntime

Defined in: [packages/adapters/src/runtime.ts:31](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/runtime.ts#L31)

A driver installed as a runtime under its own identity.

`StandardRuntime` is the reference turn loop and reports itself as
`sharedos.standard`, which is correct for the driver it was built for and
wrong for a vendor harness or a model: the executor stamps the _plugin's_
manifest onto every execution record, so a Codex turn wrapped in
`StandardRuntime` alone would file its evidence under the standard runtime.

That matters beyond tidiness. Comparing harnesses depends on each column's
evidence naming the harness that produced it; a column that misattributes
itself is worse than a column that is absent, because it looks like data.

This keeps the loop and replaces only the identity. `StandardRuntime` still
owns the steps, still stops at `maxSteps`, and still re-authorizes every
call -- which is the property that distinguishes a driven column from one
where a vendor CLI owns the loop.

#### Extended by

- [`ModelRuntime`](#modelruntime)
- [`HarnessRuntime`](#harnessruntime)

#### Type Parameters

| Type Parameter                                                                    |
| --------------------------------------------------------------------------------- |
| `D` _extends_ [`AgentTurnDriver`](sharedos-runtime.md#agentturndriver) & `object` |

#### Implements

- [`RuntimePlugin`](sharedos-runtime.md#runtimeplugin)

#### Constructors

##### Constructor

> **new DriverRuntime**\<`D`>\>(`driver`, `options?`): [`DriverRuntime`](#driverruntime)\<`D`>\>

Defined in: [packages/adapters/src/runtime.ts:37](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/runtime.ts#L37)

###### Parameters

| Parameter | Type                                                                   |
| --------- | ---------------------------------------------------------------------- |
| `driver`  | `D`                                                                    |
| `options` | [`StandardRuntimeOptions`](sharedos-runtime.md#standardruntimeoptions) |

###### Returns

[`DriverRuntime`](#driverruntime)\<`D`\>

#### Properties

| Property                                  | Modifier   | Type                                             | Defined in                                                                                                                   |
| ----------------------------------------- | ---------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-manifest"></a> `manifest` | `readonly` | `object`                                         | [packages/adapters/src/runtime.ts:34](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/runtime.ts#L34) |
| `manifest.id`                             | `public`   | `string`                                         | packages/contracts/dist/runtime.d.ts:9                                                                                       |
| `manifest.metadata?`                      | `public`   | [`JsonObject`](sharedos-contracts.md#jsonobject) | packages/contracts/dist/runtime.d.ts:12                                                                                      |
| `manifest.protocolVersion`                | `public`   | `"1"`                                            | packages/contracts/dist/runtime.d.ts:11                                                                                      |
| `manifest.version`                        | `public`   | `string`                                         | packages/contracts/dist/runtime.d.ts:10                                                                                      |

#### Methods

##### run()

> **run**(`request`, `host`, `signal`): `Promise`\<\{ `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `output`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `type`: `"complete"`; \} \| \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `type`: `"fail"`; \} \| \{ `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `reason`: `string`; `type`: `"escalate"`; \}\>

Defined in: [packages/adapters/src/runtime.ts:42](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/runtime.ts#L42)

###### Parameters

| Parameter | Type                                                           |
| --------- | -------------------------------------------------------------- |
| `request` | [`RuntimeTurnRequest`](sharedos-runtime.md#runtimeturnrequest) |
| `host`    | [`RuntimeHost`](sharedos-runtime.md#runtimehost)               |
| `signal`  | `AbortSignal`                                                  |

###### Returns

`Promise`\<\{ `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `output`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `type`: `"complete"`; \} \| \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `type`: `"fail"`; \} \| \{ `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `reason`: `string`; `type`: `"escalate"`; \}\>

###### Implementation of

[`RuntimePlugin`](sharedos-runtime.md#runtimeplugin).[`run`](sharedos-runtime.md#run-1)

---

### HarnessDriver

Defined in: [packages/adapters/src/driver.ts:57](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/driver.ts#L57)

One vendor harness, driven as a SharedOS agent turn.

A driver is only translation. The turn loop, the permission-filtered
catalogue, per-call re-authorization, and audit all belong to the SharedOS
execution envelope, which is why adding a harness requires no kernel change
and no second enforcement path.

Tool calls are passed through exactly as the harness emitted them, including
names that are not in the catalogue. Filtering those here would be the
adapter quietly enforcing policy, and worse, it would erase the attempt: a
guess at an unexposed tool has to reach the envelope to be refused and
recorded.

#### Implements

- [`AgentTurnDriver`](sharedos-runtime.md#agentturndriver)

#### Constructors

##### Constructor

> **new HarnessDriver**(`options`): [`HarnessDriver`](#harnessdriver)

Defined in: [packages/adapters/src/driver.ts:65](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/driver.ts#L65)

###### Parameters

| Parameter | Type                                            |
| --------- | ----------------------------------------------- |
| `options` | [`HarnessDriverOptions`](#harnessdriveroptions) |

###### Returns

[`HarnessDriver`](#harnessdriver)

#### Properties

| Property                                    | Modifier   | Type                                             | Defined in                                                                                                                 |
| ------------------------------------------- | ---------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-manifest-1"></a> `manifest` | `readonly` | `object`                                         | [packages/adapters/src/driver.ts:58](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/driver.ts#L58) |
| `manifest.id`                               | `public`   | `string`                                         | packages/contracts/dist/runtime.d.ts:9                                                                                     |
| `manifest.metadata?`                        | `public`   | [`JsonObject`](sharedos-contracts.md#jsonobject) | packages/contracts/dist/runtime.d.ts:12                                                                                    |
| `manifest.protocolVersion`                  | `public`   | `"1"`                                            | packages/contracts/dist/runtime.d.ts:11                                                                                    |
| `manifest.version`                          | `public`   | `string`                                         | packages/contracts/dist/runtime.d.ts:10                                                                                    |

#### Methods

##### open()

> **open**(`request`, `signal`): `Promise`\<[`AgentTurnSession`](sharedos-runtime.md#agentturnsession)>\>

Defined in: [packages/adapters/src/driver.ts:77](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/driver.ts#L77)

###### Parameters

| Parameter | Type                                                           |
| --------- | -------------------------------------------------------------- |
| `request` | [`RuntimeTurnRequest`](sharedos-runtime.md#runtimeturnrequest) |
| `signal`  | `AbortSignal`                                                  |

###### Returns

`Promise`\<[`AgentTurnSession`](sharedos-runtime.md#agentturnsession)\>

###### Implementation of

[`AgentTurnDriver`](sharedos-runtime.md#agentturndriver).[`open`](sharedos-runtime.md#open)

---

### HarnessRuntime

Defined in: [packages/adapters/src/runtime.ts:52](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/runtime.ts#L52)

A harness driver installed as a runtime under its own identity; see [DriverRuntime](#driverruntime).

#### Extends

- [`DriverRuntime`](#driverruntime)\<[`HarnessDriver`](#harnessdriver)\>

#### Constructors

##### Constructor

> **new HarnessRuntime**(`driver`, `options?`): [`HarnessRuntime`](#harnessruntime)

Defined in: [packages/adapters/src/runtime.ts:37](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/runtime.ts#L37)

###### Parameters

| Parameter | Type                                                                   |
| --------- | ---------------------------------------------------------------------- |
| `driver`  | [`HarnessDriver`](#harnessdriver)                                      |
| `options` | [`StandardRuntimeOptions`](sharedos-runtime.md#standardruntimeoptions) |

###### Returns

[`HarnessRuntime`](#harnessruntime)

###### Inherited from

[`DriverRuntime`](#driverruntime).[`constructor`](#constructor)

#### Properties

| Property                                    | Modifier   | Type                                             | Inherited from                                                     | Defined in                                                                                                                   |
| ------------------------------------------- | ---------- | ------------------------------------------------ | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-manifest-2"></a> `manifest` | `readonly` | `object`                                         | [`DriverRuntime`](#driverruntime).[`manifest`](#property-manifest) | [packages/adapters/src/runtime.ts:34](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/runtime.ts#L34) |
| `manifest.id`                               | `public`   | `string`                                         | -                                                                  | packages/contracts/dist/runtime.d.ts:9                                                                                       |
| `manifest.metadata?`                        | `public`   | [`JsonObject`](sharedos-contracts.md#jsonobject) | -                                                                  | packages/contracts/dist/runtime.d.ts:12                                                                                      |
| `manifest.protocolVersion`                  | `public`   | `"1"`                                            | -                                                                  | packages/contracts/dist/runtime.d.ts:11                                                                                      |
| `manifest.version`                          | `public`   | `string`                                         | -                                                                  | packages/contracts/dist/runtime.d.ts:10                                                                                      |

#### Methods

##### run()

> **run**(`request`, `host`, `signal`): `Promise`\<\{ `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `output`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `type`: `"complete"`; \} \| \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `type`: `"fail"`; \} \| \{ `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `reason`: `string`; `type`: `"escalate"`; \}\>

Defined in: [packages/adapters/src/runtime.ts:42](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/runtime.ts#L42)

###### Parameters

| Parameter | Type                                                           |
| --------- | -------------------------------------------------------------- |
| `request` | [`RuntimeTurnRequest`](sharedos-runtime.md#runtimeturnrequest) |
| `host`    | [`RuntimeHost`](sharedos-runtime.md#runtimehost)               |
| `signal`  | `AbortSignal`                                                  |

###### Returns

`Promise`\<\{ `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `output`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `type`: `"complete"`; \} \| \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `type`: `"fail"`; \} \| \{ `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `reason`: `string`; `type`: `"escalate"`; \}\>

###### Inherited from

[`DriverRuntime`](#driverruntime).[`run`](#run)

---

### ModelCredentialError

Defined in: [packages/adapters/src/model/credential.ts:58](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L58)

A credential that could not be presented or renewed. Carries no token.

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new ModelCredentialError**(`message`, `status?`): [`ModelCredentialError`](#modelcredentialerror)

Defined in: [packages/adapters/src/model/credential.ts:61](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L61)

###### Parameters

| Parameter | Type     |
| --------- | -------- |
| `message` | `string` |
| `status?` | `number` |

###### Returns

[`ModelCredentialError`](#modelcredentialerror)

###### Overrides

`Error.constructor`

#### Properties

| Property                                                | Modifier   | Type      | Description                                                                                                                                                                                                                                                                                                                                                                                                                                       | Inherited from          | Defined in                                                                                                                                     |
| ------------------------------------------------------- | ---------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-cause"></a> `cause?`                    | `public`   | `unknown` | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `Error.cause`           | node\_modules/.pnpm/typescript@5.9.3/node\_modules/typescript/lib/lib.es2022.error.d.ts:26                                                     |
| <a id="property-message"></a> `message`                 | `public`   | `string`  | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `Error.message`         | node\_modules/.pnpm/typescript@5.9.3/node\_modules/typescript/lib/lib.es5.d.ts:1077                                                            |
| <a id="property-name"></a> `name`                       | `public`   | `string`  | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `Error.name`            | node\_modules/.pnpm/typescript@5.9.3/node\_modules/typescript/lib/lib.es5.d.ts:1076                                                            |
| <a id="property-stack"></a> `stack?`                    | `public`   | `string`  | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `Error.stack`           | node\_modules/.pnpm/typescript@5.9.3/node\_modules/typescript/lib/lib.es5.d.ts:1078                                                            |
| <a id="property-status"></a> `status?`                  | `readonly` | `number`  | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | -                       | [packages/adapters/src/model/credential.ts:59](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L59) |
| <a id="property-stacktracelimit"></a> `stackTraceLimit` | `static`   | `number`  | The `Error.stackTraceLimit` property specifies the number of stack frames collected by a stack trace (whether generated by `new Error().stack` or `Error.captureStackTrace(obj)`). The default value is `10` but may be set to any valid JavaScript number. Changes will affect any stack trace captured _after_ the value has been changed. If set to a non-number value, or set to a negative number, stack traces will not capture any frames. | `Error.stackTraceLimit` | node\_modules/.pnpm/@types+node@22.20.1/node\_modules/@types/node/globals.d.ts:68                                                              |

#### Methods

##### captureStackTrace()

> `static` **captureStackTrace**(`targetObject`, `constructorOpt?`): `void`

Defined in: node\_modules/.pnpm/@types+node@22.20.1/node\_modules/@types/node/globals.d.ts:52

Creates a `.stack` property on `targetObject`, which when accessed returns
a string representing the location in the code at which
`Error.captureStackTrace()` was called.

```js
const myObject = {};
Error.captureStackTrace(myObject);
myObject.stack; // Similar to `new Error().stack`
```

The first line of the trace will be prefixed with
`${myObject.name}: ${myObject.message}`.

The optional `constructorOpt` argument accepts a function. If given, all frames
above `constructorOpt`, including `constructorOpt`, will be omitted from the
generated stack trace.

The `constructorOpt` argument is useful for hiding implementation
details of error generation from the user. For instance:

```js
function a() {
  b();
}

function b() {
  c();
}

function c() {
  // Create an error without stack trace to avoid calculating the stack trace twice.
  const { stackTraceLimit } = Error;
  Error.stackTraceLimit = 0;
  const error = new Error();
  Error.stackTraceLimit = stackTraceLimit;

  // Capture the stack trace above function b
  Error.captureStackTrace(error, b); // Neither function c, nor b is included in the stack trace
  throw error;
}

a();
```

###### Parameters

| Parameter         | Type       |
| ----------------- | ---------- |
| `targetObject`    | `object`   |
| `constructorOpt?` | `Function` |

###### Returns

`void`

###### Inherited from

`Error.captureStackTrace`

##### prepareStackTrace()

> `static` **prepareStackTrace**(`err`, `stackTraces`): `any`

Defined in: node\_modules/.pnpm/@types+node@22.20.1/node\_modules/@types/node/globals.d.ts:56

###### Parameters

| Parameter     | Type         |
| ------------- | ------------ |
| `err`         | `Error`      |
| `stackTraces` | `CallSite`[] |

###### Returns

`any`

###### See

https://v8.dev/docs/stack-trace-api#customizing-stack-traces

###### Inherited from

`Error.prepareStackTrace`

---

### ModelDriver

Defined in: [packages/adapters/src/model/driver.ts:141](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/driver.ts#L141)

A model API driven as a SharedOS agent turn.

The same port a vendor harness occupies, with the vendor removed. A harness
driver translates frames from a CLI that has already decided what to call;
this one puts the model itself in the seat, so the catalogue it sees is the
permission-filtered one the kernel built and nothing between the two can add
a tool, drop a tool, or answer a call on its own.

What that buys is an axis the other columns cannot separate. A scripted
column leaves out the transport; a live CLI column leaves out the catalogue;
an MCP column keeps both but hands the turn loop to the vendor's scaffolding.
This one keeps the loop inside `StandardRuntime` and drops the vendor
entirely, which is what makes "the model behaved this way" distinguishable
from "the vendor's scaffolding made the model behave this way".

It is not a replacement for the scripted adversary and cannot be one. A model
chooses what to call, so an attempt it declines to issue leaves no operation
in the record and is graded as unexercised. That is the honest grading, and
the reason the deterministic column stays the reference.

#### Implements

- [`AgentTurnDriver`](sharedos-runtime.md#agentturndriver)

#### Constructors

##### Constructor

> **new ModelDriver**(`options`): [`ModelDriver`](#modeldriver)

Defined in: [packages/adapters/src/model/driver.ts:148](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/driver.ts#L148)

###### Parameters

| Parameter | Type                                        |
| --------- | ------------------------------------------- |
| `options` | [`ModelDriverOptions`](#modeldriveroptions) |

###### Returns

[`ModelDriver`](#modeldriver)

#### Properties

| Property                                    | Modifier   | Type                                             | Defined in                                                                                                                               |
| ------------------------------------------- | ---------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-manifest-3"></a> `manifest` | `readonly` | `object`                                         | [packages/adapters/src/model/driver.ts:142](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/driver.ts#L142) |
| `manifest.id`                               | `public`   | `string`                                         | packages/contracts/dist/runtime.d.ts:9                                                                                                   |
| `manifest.metadata?`                        | `public`   | [`JsonObject`](sharedos-contracts.md#jsonobject) | packages/contracts/dist/runtime.d.ts:12                                                                                                  |
| `manifest.protocolVersion`                  | `public`   | `"1"`                                            | packages/contracts/dist/runtime.d.ts:11                                                                                                  |
| `manifest.version`                          | `public`   | `string`                                         | packages/contracts/dist/runtime.d.ts:10                                                                                                  |

#### Methods

##### open()

> **open**(`request`, `_signal`): `Promise`\<[`AgentTurnSession`](sharedos-runtime.md#agentturnsession)>\>

Defined in: [packages/adapters/src/model/driver.ts:159](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/driver.ts#L159)

###### Parameters

| Parameter | Type                                                           |
| --------- | -------------------------------------------------------------- |
| `request` | [`RuntimeTurnRequest`](sharedos-runtime.md#runtimeturnrequest) |
| `_signal` | `AbortSignal`                                                  |

###### Returns

`Promise`\<[`AgentTurnSession`](sharedos-runtime.md#agentturnsession)\>

###### Implementation of

[`AgentTurnDriver`](sharedos-runtime.md#agentturndriver).[`open`](sharedos-runtime.md#open)

---

### `abstract` ModelHttpClient

Defined in: [packages/adapters/src/model/client.ts:191](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L191)

Everything a model client does that is not its provider's wire shape.

Authentication, the per-request deadline, the retry policy, the single
re-authentication, and the rule that a provider's error body never leaves
this file are the same regardless of which API is being spoken -- and they
are the parts that decide whether a failed turn is honest evidence. Holding
them once means a second wire shape is an encoder and a reader, not a second
copy of the policy that would drift from the first.

A subclass supplies three things: where to post, how to render a request, and
how to read a response.

#### Extended by

- [`OpenAiCompatibleModelClient`](#openaicompatiblemodelclient)
- [`OpenAiResponsesModelClient`](#openairesponsesmodelclient)

#### Implements

- [`ModelClient`](#modelclient)

#### Properties

| Property                                  | Modifier   | Type     | Description                                                              | Defined in                                                                                                                               |
| ----------------------------------------- | ---------- | -------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-model"></a> `model`       | `readonly` | `string` | The model this client was configured to ask for.                         | [packages/adapters/src/model/client.ts:192](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L192) |
| <a id="property-provider"></a> `provider` | `readonly` | `string` | The provider that serves it, recorded alongside the model on every turn. | [packages/adapters/src/model/client.ts:193](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L193) |

#### Accessors

##### auth

###### Get Signature

> **get** **auth**(): [`JsonObject`](sharedos-contracts.md#jsonobject)

Defined in: [packages/adapters/src/model/client.ts:226](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L226)

How this client authenticates, asked of the credential rather than captured
when the client was built.

A subscription can learn which account it pays from only when the provider
first says so, and a description taken at construction would then record
the turn as unscoped for the life of the process.

###### Returns

[`JsonObject`](sharedos-contracts.md#jsonobject)

How this client authenticates, when it authenticates at all.

Carried onto the turn's metadata for the same reason the served model is: a
run on a metered API key and a run on somebody's subscription are different
claims about where the answers came from, and a record that cannot tell
them apart cannot say which one it is evidence of. It holds identifiers and
shapes only -- see [ModelCredential.describe](#describe-1) -- and a client that
presents nothing, such as a transcript, leaves it absent.

###### Implementation of

[`ModelClient`](#modelclient).[`auth`](#property-auth)

#### Methods

##### complete()

> **complete**(`request`, `signal`): `Promise`\<[`ModelReply`](#modelreply)>\>

Defined in: [packages/adapters/src/model/client.ts:245](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L245)

###### Parameters

| Parameter | Type                                                |
| --------- | --------------------------------------------------- |
| `request` | [`ModelCompletionRequest`](#modelcompletionrequest) |
| `signal`  | `AbortSignal`                                       |

###### Returns

`Promise`\<[`ModelReply`](#modelreply)\>

###### Implementation of

[`ModelClient`](#modelclient).[`complete`](#complete-5)

---

### ModelRequestError

Defined in: [packages/adapters/src/model/client.ts:122](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L122)

A model call that did not produce an answer. Carries no response body.

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new ModelRequestError**(`message`, `status?`): [`ModelRequestError`](#modelrequesterror)

Defined in: [packages/adapters/src/model/client.ts:125](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L125)

###### Parameters

| Parameter | Type     |
| --------- | -------- |
| `message` | `string` |
| `status?` | `number` |

###### Returns

[`ModelRequestError`](#modelrequesterror)

###### Overrides

`Error.constructor`

#### Properties

| Property                                                  | Modifier   | Type      | Description                                                                                                                                                                                                                                                                                                                                                                                                                                       | Inherited from          | Defined in                                                                                                                               |
| --------------------------------------------------------- | ---------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-cause-1"></a> `cause?`                    | `public`   | `unknown` | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `Error.cause`           | node\_modules/.pnpm/typescript@5.9.3/node\_modules/typescript/lib/lib.es2022.error.d.ts:26                                               |
| <a id="property-message-1"></a> `message`                 | `public`   | `string`  | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `Error.message`         | node\_modules/.pnpm/typescript@5.9.3/node\_modules/typescript/lib/lib.es5.d.ts:1077                                                      |
| <a id="property-name-1"></a> `name`                       | `public`   | `string`  | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `Error.name`            | node\_modules/.pnpm/typescript@5.9.3/node\_modules/typescript/lib/lib.es5.d.ts:1076                                                      |
| <a id="property-stack-1"></a> `stack?`                    | `public`   | `string`  | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `Error.stack`           | node\_modules/.pnpm/typescript@5.9.3/node\_modules/typescript/lib/lib.es5.d.ts:1078                                                      |
| <a id="property-status-1"></a> `status?`                  | `readonly` | `number`  | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | -                       | [packages/adapters/src/model/client.ts:123](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L123) |
| <a id="property-stacktracelimit-1"></a> `stackTraceLimit` | `static`   | `number`  | The `Error.stackTraceLimit` property specifies the number of stack frames collected by a stack trace (whether generated by `new Error().stack` or `Error.captureStackTrace(obj)`). The default value is `10` but may be set to any valid JavaScript number. Changes will affect any stack trace captured _after_ the value has been changed. If set to a non-number value, or set to a negative number, stack traces will not capture any frames. | `Error.stackTraceLimit` | node\_modules/.pnpm/@types+node@22.20.1/node\_modules/@types/node/globals.d.ts:68                                                        |

#### Methods

##### captureStackTrace()

> `static` **captureStackTrace**(`targetObject`, `constructorOpt?`): `void`

Defined in: node\_modules/.pnpm/@types+node@22.20.1/node\_modules/@types/node/globals.d.ts:52

Creates a `.stack` property on `targetObject`, which when accessed returns
a string representing the location in the code at which
`Error.captureStackTrace()` was called.

```js
const myObject = {};
Error.captureStackTrace(myObject);
myObject.stack; // Similar to `new Error().stack`
```

The first line of the trace will be prefixed with
`${myObject.name}: ${myObject.message}`.

The optional `constructorOpt` argument accepts a function. If given, all frames
above `constructorOpt`, including `constructorOpt`, will be omitted from the
generated stack trace.

The `constructorOpt` argument is useful for hiding implementation
details of error generation from the user. For instance:

```js
function a() {
  b();
}

function b() {
  c();
}

function c() {
  // Create an error without stack trace to avoid calculating the stack trace twice.
  const { stackTraceLimit } = Error;
  Error.stackTraceLimit = 0;
  const error = new Error();
  Error.stackTraceLimit = stackTraceLimit;

  // Capture the stack trace above function b
  Error.captureStackTrace(error, b); // Neither function c, nor b is included in the stack trace
  throw error;
}

a();
```

###### Parameters

| Parameter         | Type       |
| ----------------- | ---------- |
| `targetObject`    | `object`   |
| `constructorOpt?` | `Function` |

###### Returns

`void`

###### Inherited from

`Error.captureStackTrace`

##### prepareStackTrace()

> `static` **prepareStackTrace**(`err`, `stackTraces`): `any`

Defined in: node\_modules/.pnpm/@types+node@22.20.1/node\_modules/@types/node/globals.d.ts:56

###### Parameters

| Parameter     | Type         |
| ------------- | ------------ |
| `err`         | `Error`      |
| `stackTraces` | `CallSite`[] |

###### Returns

`any`

###### See

https://v8.dev/docs/stack-trace-api#customizing-stack-traces

###### Inherited from

`Error.prepareStackTrace`

---

### ModelRuntime

Defined in: [packages/adapters/src/model/runtime.ts:11](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/runtime.ts#L11)

A model driver installed as a runtime under its own identity.

The same arrangement [HarnessRuntime](#harnessruntime) makes, for the same reason: a
column comparing models must be able to say which one produced which record.
See [DriverRuntime](#driverruntime).

#### Extends

- [`DriverRuntime`](#driverruntime)\<[`ModelDriver`](#modeldriver)\>

#### Constructors

##### Constructor

> **new ModelRuntime**(`driver`, `options?`): [`ModelRuntime`](#modelruntime)

Defined in: [packages/adapters/src/runtime.ts:37](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/runtime.ts#L37)

###### Parameters

| Parameter | Type                                                                   |
| --------- | ---------------------------------------------------------------------- |
| `driver`  | [`ModelDriver`](#modeldriver)                                          |
| `options` | [`StandardRuntimeOptions`](sharedos-runtime.md#standardruntimeoptions) |

###### Returns

[`ModelRuntime`](#modelruntime)

###### Inherited from

[`DriverRuntime`](#driverruntime).[`constructor`](#constructor)

#### Properties

| Property                                    | Modifier   | Type                                             | Inherited from                                                     | Defined in                                                                                                                   |
| ------------------------------------------- | ---------- | ------------------------------------------------ | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-manifest-4"></a> `manifest` | `readonly` | `object`                                         | [`DriverRuntime`](#driverruntime).[`manifest`](#property-manifest) | [packages/adapters/src/runtime.ts:34](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/runtime.ts#L34) |
| `manifest.id`                               | `public`   | `string`                                         | -                                                                  | packages/contracts/dist/runtime.d.ts:9                                                                                       |
| `manifest.metadata?`                        | `public`   | [`JsonObject`](sharedos-contracts.md#jsonobject) | -                                                                  | packages/contracts/dist/runtime.d.ts:12                                                                                      |
| `manifest.protocolVersion`                  | `public`   | `"1"`                                            | -                                                                  | packages/contracts/dist/runtime.d.ts:11                                                                                      |
| `manifest.version`                          | `public`   | `string`                                         | -                                                                  | packages/contracts/dist/runtime.d.ts:10                                                                                      |

#### Methods

##### run()

> **run**(`request`, `host`, `signal`): `Promise`\<\{ `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `output`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `type`: `"complete"`; \} \| \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `type`: `"fail"`; \} \| \{ `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `reason`: `string`; `type`: `"escalate"`; \}\>

Defined in: [packages/adapters/src/runtime.ts:42](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/runtime.ts#L42)

###### Parameters

| Parameter | Type                                                           |
| --------- | -------------------------------------------------------------- |
| `request` | [`RuntimeTurnRequest`](sharedos-runtime.md#runtimeturnrequest) |
| `host`    | [`RuntimeHost`](sharedos-runtime.md#runtimehost)               |
| `signal`  | `AbortSignal`                                                  |

###### Returns

`Promise`\<\{ `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `output`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `type`: `"complete"`; \} \| \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `type`: `"fail"`; \} \| \{ `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `reason`: `string`; `type`: `"escalate"`; \}\>

###### Inherited from

[`DriverRuntime`](#driverruntime).[`run`](#run)

---

### OpenAiCompatibleModelClient

Defined in: [packages/adapters/src/model/chat-completions.ts:80](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/chat-completions.ts#L80)

A chat-completions client for any provider speaking the OpenAI wire shape.

DeepSeek is the one this was built against, but nothing here is DeepSeek
specific: the endpoint, model, and provider label are all supplied, so
pointing the column at another compatible provider is configuration rather
than a second client.

#### Extends

- [`ModelHttpClient`](#abstract-modelhttpclient)

#### Constructors

##### Constructor

> **new OpenAiCompatibleModelClient**(`options`): [`OpenAiCompatibleModelClient`](#openaicompatiblemodelclient)

Defined in: [packages/adapters/src/model/chat-completions.ts:85](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/chat-completions.ts#L85)

###### Parameters

| Parameter | Type                                                                        |
| --------- | --------------------------------------------------------------------------- |
| `options` | [`OpenAiCompatibleModelClientOptions`](#openaicompatiblemodelclientoptions) |

###### Returns

[`OpenAiCompatibleModelClient`](#openaicompatiblemodelclient)

###### Overrides

`ModelHttpClient.constructor`

#### Properties

| Property                                    | Modifier   | Type     | Description                                                              | Inherited from                                                                  | Defined in                                                                                                                               |
| ------------------------------------------- | ---------- | -------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-model-1"></a> `model`       | `readonly` | `string` | The model this client was configured to ask for.                         | [`ModelHttpClient`](#abstract-modelhttpclient).[`model`](#property-model)       | [packages/adapters/src/model/client.ts:192](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L192) |
| <a id="property-provider-1"></a> `provider` | `readonly` | `string` | The provider that serves it, recorded alongside the model on every turn. | [`ModelHttpClient`](#abstract-modelhttpclient).[`provider`](#property-provider) | [packages/adapters/src/model/client.ts:193](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L193) |

#### Accessors

##### auth

###### Get Signature

> **get** **auth**(): [`JsonObject`](sharedos-contracts.md#jsonobject)

Defined in: [packages/adapters/src/model/client.ts:226](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L226)

How this client authenticates, asked of the credential rather than captured
when the client was built.

A subscription can learn which account it pays from only when the provider
first says so, and a description taken at construction would then record
the turn as unscoped for the life of the process.

###### Returns

[`JsonObject`](sharedos-contracts.md#jsonobject)

How this client authenticates, when it authenticates at all.

Carried onto the turn's metadata for the same reason the served model is: a
run on a metered API key and a run on somebody's subscription are different
claims about where the answers came from, and a record that cannot tell
them apart cannot say which one it is evidence of. It holds identifiers and
shapes only -- see [ModelCredential.describe](#describe-1) -- and a client that
presents nothing, such as a transcript, leaves it absent.

###### Inherited from

[`ModelHttpClient`](#abstract-modelhttpclient).[`auth`](#auth)

#### Methods

##### complete()

> **complete**(`request`, `signal`): `Promise`\<[`ModelReply`](#modelreply)>\>

Defined in: [packages/adapters/src/model/client.ts:245](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L245)

###### Parameters

| Parameter | Type                                                |
| --------- | --------------------------------------------------- |
| `request` | [`ModelCompletionRequest`](#modelcompletionrequest) |
| `signal`  | `AbortSignal`                                       |

###### Returns

`Promise`\<[`ModelReply`](#modelreply)\>

###### Inherited from

[`ModelHttpClient`](#abstract-modelhttpclient).[`complete`](#complete)

---

### OpenAiResponsesModelClient

Defined in: [packages/adapters/src/model/responses.ts:125](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/responses.ts#L125)

A client for OpenAI's Responses API, including the endpoint a ChatGPT
subscription reaches.

The second wire shape, not a second policy. Authentication, the retry rule,
the single re-authentication, the per-request deadline, and the rule that a
provider's error body never reaches a caller all come from
[ModelHttpClient](#abstract-modelhttpclient), so what is here is exactly the translation: how a
conversation is written as input items, how tools are declared, and how an
answer -- one JSON document, or a stream of events -- is read back into a
reply.

It is what makes a Codex subscription usable in the model seat.
`SubscriptionOAuthCredential` authenticates against `chatgpt.com`, and this
speaks what that endpoint speaks; the chat-completions client authenticates
identically and would fail on the wire shape.

#### Extends

- [`ModelHttpClient`](#abstract-modelhttpclient)

#### Constructors

##### Constructor

> **new OpenAiResponsesModelClient**(`options`): [`OpenAiResponsesModelClient`](#openairesponsesmodelclient)

Defined in: [packages/adapters/src/model/responses.ts:132](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/responses.ts#L132)

###### Parameters

| Parameter | Type                                                                      |
| --------- | ------------------------------------------------------------------------- |
| `options` | [`OpenAiResponsesModelClientOptions`](#openairesponsesmodelclientoptions) |

###### Returns

[`OpenAiResponsesModelClient`](#openairesponsesmodelclient)

###### Overrides

`ModelHttpClient.constructor`

#### Properties

| Property                                    | Modifier   | Type     | Description                                                              | Inherited from                                                                  | Defined in                                                                                                                               |
| ------------------------------------------- | ---------- | -------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-model-2"></a> `model`       | `readonly` | `string` | The model this client was configured to ask for.                         | [`ModelHttpClient`](#abstract-modelhttpclient).[`model`](#property-model)       | [packages/adapters/src/model/client.ts:192](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L192) |
| <a id="property-provider-2"></a> `provider` | `readonly` | `string` | The provider that serves it, recorded alongside the model on every turn. | [`ModelHttpClient`](#abstract-modelhttpclient).[`provider`](#property-provider) | [packages/adapters/src/model/client.ts:193](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L193) |

#### Accessors

##### auth

###### Get Signature

> **get** **auth**(): [`JsonObject`](sharedos-contracts.md#jsonobject)

Defined in: [packages/adapters/src/model/client.ts:226](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L226)

How this client authenticates, asked of the credential rather than captured
when the client was built.

A subscription can learn which account it pays from only when the provider
first says so, and a description taken at construction would then record
the turn as unscoped for the life of the process.

###### Returns

[`JsonObject`](sharedos-contracts.md#jsonobject)

How this client authenticates, when it authenticates at all.

Carried onto the turn's metadata for the same reason the served model is: a
run on a metered API key and a run on somebody's subscription are different
claims about where the answers came from, and a record that cannot tell
them apart cannot say which one it is evidence of. It holds identifiers and
shapes only -- see [ModelCredential.describe](#describe-1) -- and a client that
presents nothing, such as a transcript, leaves it absent.

###### Inherited from

[`ModelHttpClient`](#abstract-modelhttpclient).[`auth`](#auth)

#### Methods

##### complete()

> **complete**(`request`, `signal`): `Promise`\<[`ModelReply`](#modelreply)>\>

Defined in: [packages/adapters/src/model/client.ts:245](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L245)

###### Parameters

| Parameter | Type                                                |
| --------- | --------------------------------------------------- |
| `request` | [`ModelCompletionRequest`](#modelcompletionrequest) |
| `signal`  | `AbortSignal`                                       |

###### Returns

`Promise`\<[`ModelReply`](#modelreply)\>

###### Inherited from

[`ModelHttpClient`](#abstract-modelhttpclient).[`complete`](#complete)

---

### SubscriptionOAuthCredential

Defined in: [packages/adapters/src/model/credential.ts:474](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L474)

A subscription in the model seat.

The provider recognises the caller as a person with a plan rather than as an
account with a meter, so what is presented is an access token that expires
and the code of the account the call is billed to. Both come from a login the
host already performed -- `codex login` and its equivalents -- and neither is
minted here: SharedOS does not run an authorization flow, has no client
secret, and never sees the user's password.

Renewal is the only thing this does beyond copying headers, and it is done
for one reason: a turn that begins inside the validity window can outlive it,
and a model call refused halfway through a turn is recorded as a failed turn
that says nothing about SharedOS.

#### Implements

- [`ModelCredential`](#modelcredential)

#### Constructors

##### Constructor

> **new SubscriptionOAuthCredential**(`options`): [`SubscriptionOAuthCredential`](#subscriptionoauthcredential)

Defined in: [packages/adapters/src/model/credential.ts:494](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L494)

###### Parameters

| Parameter | Type                                                                        |
| --------- | --------------------------------------------------------------------------- |
| `options` | [`SubscriptionOAuthCredentialOptions`](#subscriptionoauthcredentialoptions) |

###### Returns

[`SubscriptionOAuthCredential`](#subscriptionoauthcredential)

#### Properties

| Property                              | Modifier   | Type                   | Default value          | Description                                                              | Defined in                                                                                                                                       |
| ------------------------------------- | ---------- | ---------------------- | ---------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| <a id="property-scheme"></a> `scheme` | `readonly` | `"subscription_oauth"` | `"subscription_oauth"` | How a call authenticates, in one word, for the record. Never the secret. | [packages/adapters/src/model/credential.ts:475](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L475) |

#### Accessors

##### tokens

###### Get Signature

> **get** **tokens**(): [`SubscriptionTokens`](#subscriptiontokens)

Defined in: [packages/adapters/src/model/credential.ts:509](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L509)

The tokens as they now stand, for a host persisting them itself.

###### Returns

[`SubscriptionTokens`](#subscriptiontokens)

#### Methods

##### describe()

> **describe**(): [`JsonObject`](sharedos-contracts.md#jsonobject)

Defined in: [packages/adapters/src/model/credential.ts:537](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L537)

What may be recorded about how this call authenticated.

Identifiers and shapes, never a token and never the account code itself.
A record naming the paying account would put a stable, personal identifier
into artifacts that get committed and compared; that the seat was
account-scoped is the fact a reader of the record needs, and it is the
weaker claim.

###### Returns

[`JsonObject`](sharedos-contracts.md#jsonobject)

###### Implementation of

[`ModelCredential`](#modelcredential).[`describe`](#describe-1)

##### headers()

> **headers**(`signal`): `Promise`\<`Readonly`\<`Record`\<`string`, `string`>>>\>\>\>

Defined in: [packages/adapters/src/model/credential.ts:513](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L513)

The headers one call presents, resolved at the instant of that call.

Resolved per call rather than once at construction because a subscription
token has a validity window: a client that captured its headers when it was
built would keep presenting a token that had since expired. The rule is the
one ADR 0016 states for authority -- the operation's clock may only take
away -- so a token whose window has closed by the time the call is made is
renewed here, and a window that has not opened yet is never widened.

###### Parameters

| Parameter | Type          |
| --------- | ------------- |
| `signal`  | `AbortSignal` |

###### Returns

`Promise`\<`Readonly`\<`Record`\<`string`, `string`\>\>\>

###### Implementation of

[`ModelCredential`](#modelcredential).[`headers`](#headers-1)

##### renew()

> **renew**(`signal`): `Promise`\<`boolean`>\>

Defined in: [packages/adapters/src/model/credential.ts:531](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L531)

One chance to renew, after the provider refused the call as
unauthenticated.

`false` means nothing changed and the caller should not try again: there was
no refresh token, or the renewal returned the same access token. Absent
entirely on a credential that cannot renew, which is what a static key is.

###### Parameters

| Parameter | Type          |
| --------- | ------------- |
| `signal`  | `AbortSignal` |

###### Returns

`Promise`\<`boolean`\>

###### Implementation of

[`ModelCredential`](#modelcredential).[`renew`](#renew-1)

---

### ToolNameCodec

Defined in: [packages/adapters/src/model/driver.ts:53](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/driver.ts#L53)

How a SharedOS tool name is spoken to a model, and read back.

Dots become underscores on the way out and the catalogue's own map decides
the way back, so a catalogued tool round-trips exactly rather than through a
guess. The map is built per turn from the permission-filtered catalogue,
which means it contains precisely the tools this actor was allowed to see.

A name the map does not contain is decoded by reversing the substitution and
then passed through unchanged. That path is best-effort and it exists for one
reason: a model that invents a tool outside its catalogue must still be able
to reach the envelope and be refused. Filtering it here, or failing to decode
it, would erase the attempt -- and an attempt that never arrives is graded as
a tool that was never tried, not as a tool that was refused.

#### Constructors

##### Constructor

> **new ToolNameCodec**(`tools`): [`ToolNameCodec`](#toolnamecodec)

Defined in: [packages/adapters/src/model/driver.ts:57](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/driver.ts#L57)

###### Parameters

| Parameter | Type                |
| --------- | ------------------- |
| `tools`   | readonly `object`[] |

###### Returns

[`ToolNameCodec`](#toolnamecodec)

#### Methods

##### fromWire()

> **fromWire**(`name`): `string`

Defined in: [packages/adapters/src/model/driver.ts:83](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/driver.ts#L83)

###### Parameters

| Parameter | Type     |
| --------- | -------- |
| `name`    | `string` |

###### Returns

`string`

##### toWire()

> **toWire**(`name`): `string`

Defined in: [packages/adapters/src/model/driver.ts:79](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/driver.ts#L79)

###### Parameters

| Parameter | Type     |
| --------- | -------- |
| `name`    | `string` |

###### Returns

`string`

---

### TranscriptModelClient

Defined in: [packages/adapters/src/model/transcript.ts:38](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/transcript.ts#L38)

Replays a supplied conversation through the real model driver.

This is how the native harness is verified without a provider or a
credential present, and it is the exact counterpart of `TranscriptTransport`
for a vendor harness. The replies are the caller's, written in the model's
own tool-call shape; the name decoding, argument parsing, escalation
recognition, and step accounting are the driver's; and the only thing left
unexercised is the provider that would have produced the replies.

A spent transcript is an error rather than a completion. A live provider
always answers; a recording that has run out has nothing to say, and
answering "done" on its behalf would grade a script that ended too early as
a model choosing to stop. The driver fails the turn `model_call_failed`,
which is the visible result.

#### Implements

- [`ModelClient`](#modelclient)

#### Constructors

##### Constructor

> **new TranscriptModelClient**(`transcript`, `options?`): [`TranscriptModelClient`](#transcriptmodelclient)

Defined in: [packages/adapters/src/model/transcript.ts:46](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/transcript.ts#L46)

###### Parameters

| Parameter    | Type                                                            |
| ------------ | --------------------------------------------------------------- |
| `transcript` | [`ModelTranscript`](#modeltranscript)                           |
| `options`    | [`TranscriptModelClientOptions`](#transcriptmodelclientoptions) |

###### Returns

[`TranscriptModelClient`](#transcriptmodelclient)

#### Properties

| Property                                    | Modifier   | Type                                                  | Default value | Description                                                              | Defined in                                                                                                                                     |
| ------------------------------------------- | ---------- | ----------------------------------------------------- | ------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-model-3"></a> `model`       | `readonly` | `string`                                              | `undefined`   | The model this client was configured to ask for.                         | [packages/adapters/src/model/transcript.ts:39](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/transcript.ts#L39) |
| <a id="property-provider-3"></a> `provider` | `readonly` | `string`                                              | `undefined`   | The provider that serves it, recorded alongside the model on every turn. | [packages/adapters/src/model/transcript.ts:40](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/transcript.ts#L40) |
| <a id="property-seen"></a> `seen`           | `readonly` | [`ModelCompletionRequest`](#modelcompletionrequest)[] | `[]`          | Every request the driver made, in order, for a test to read back.        | [packages/adapters/src/model/transcript.ts:42](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/transcript.ts#L42) |

#### Methods

##### complete()

> **complete**(`request`, `signal`): `Promise`\<[`ModelReply`](#modelreply)>\>

Defined in: [packages/adapters/src/model/transcript.ts:55](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/transcript.ts#L55)

###### Parameters

| Parameter | Type                                                |
| --------- | --------------------------------------------------- |
| `request` | [`ModelCompletionRequest`](#modelcompletionrequest) |
| `signal`  | `AbortSignal`                                       |

###### Returns

`Promise`\<[`ModelReply`](#modelreply)\>

###### Implementation of

[`ModelClient`](#modelclient).[`complete`](#complete-5)

---

### TranscriptTransport

Defined in: [packages/adapters/src/transcript.ts:27](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/transcript.ts#L27)

Replays a supplied conversation through the real protocol translation.

This is how an adapter is verified without the vendor's CLI or credentials
present. The frames are the vendor's, the parsing is the adapter's, and the
only thing left unexercised is the transport that would have carried them.

#### Implements

- [`HarnessTransport`](#harnesstransport)

#### Constructors

##### Constructor

> **new TranscriptTransport**(`transcript`): [`TranscriptTransport`](#transcripttransport)

Defined in: [packages/adapters/src/transcript.ts:32](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/transcript.ts#L32)

###### Parameters

| Parameter    | Type                                      |
| ------------ | ----------------------------------------- |
| `transcript` | [`HarnessTranscript`](#harnesstranscript) |

###### Returns

[`TranscriptTransport`](#transcripttransport)

#### Properties

| Property                                | Modifier   | Type                                               | Default value | Defined in                                                                                                                         |
| --------------------------------------- | ---------- | -------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-opened"></a> `opened`   | `readonly` | [`HarnessTurnRequest`](#harnessturnrequest)[]      | `[]`          | [packages/adapters/src/transcript.ts:28](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/transcript.ts#L28) |
| <a id="property-written"></a> `written` | `readonly` | [`JsonObject`](sharedos-contracts.md#jsonobject)[] | `[]`          | [packages/adapters/src/transcript.ts:29](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/transcript.ts#L29) |

#### Methods

##### open()

> **open**(`request`): `Promise`\<[`HarnessChannel`](#harnesschannel)>\>

Defined in: [packages/adapters/src/transcript.ts:39](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/transcript.ts#L39)

###### Parameters

| Parameter | Type                                        |
| --------- | ------------------------------------------- |
| `request` | [`HarnessTurnRequest`](#harnessturnrequest) |

###### Returns

`Promise`\<[`HarnessChannel`](#harnesschannel)\>

###### Implementation of

[`HarnessTransport`](#harnesstransport).[`open`](#open-3)

## Interfaces

### DeviceAuthorization

Defined in: [packages/adapters/src/model/device-authorization.ts:80](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/device-authorization.ts#L80)

A login a person has been asked to complete somewhere else.

Two phases rather than one call, because between them something has to be put
in front of a human. A single function that polled internally would have to
print, and where that text goes is not a library's decision.

#### Properties

| Property                                                | Modifier   | Type     | Description                                       | Defined in                                                                                                                                                         |
| ------------------------------------------------------- | ---------- | -------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| <a id="property-expiresat"></a> `expiresAt`             | `readonly` | `string` | RFC 3339. After this they start again.            | [packages/adapters/src/model/device-authorization.ts:86](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/device-authorization.ts#L86) |
| <a id="property-intervalms"></a> `intervalMs`           | `readonly` | `number` | How often this asks, as the provider asked it to. | [packages/adapters/src/model/device-authorization.ts:88](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/device-authorization.ts#L88) |
| <a id="property-usercode"></a> `userCode`               | `readonly` | `string` | Short, and theirs to type.                        | [packages/adapters/src/model/device-authorization.ts:82](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/device-authorization.ts#L82) |
| <a id="property-verificationuri"></a> `verificationUri` | `readonly` | `string` | The page they type it into.                       | [packages/adapters/src/model/device-authorization.ts:84](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/device-authorization.ts#L84) |

#### Methods

##### wait()

> **wait**(`signal`): `Promise`\<[`SubscriptionTokens`](#subscriptiontokens)>\>

Defined in: [packages/adapters/src/model/device-authorization.ts:90](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/device-authorization.ts#L90)

Poll until they finish, the code dies, or the caller gives up.

###### Parameters

| Parameter | Type          |
| --------- | ------------- |
| `signal`  | `AbortSignal` |

###### Returns

`Promise`\<[`SubscriptionTokens`](#subscriptiontokens)\>

---

### DeviceAuthorizationOptions

Defined in: [packages/adapters/src/model/device-authorization.ts:64](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/device-authorization.ts#L64)

#### Extends

- [`TokenGrantOptions`](#tokengrantoptions)

#### Properties

| Property                                                     | Modifier   | Type                                                                                           | Description                                                                  | Inherited from                                                                               | Defined in                                                                                                                                                         |
| ------------------------------------------------------------ | ---------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| <a id="property-accountcode"></a> `accountCode?`             | `readonly` | `string`                                                                                       | Kept when the response does not repeat it.                                   | [`TokenGrantOptions`](#tokengrantoptions).[`accountCode`](#property-accountcode-4)           | [packages/adapters/src/model/credential.ts:259](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L259)                   |
| <a id="property-encoding"></a> `encoding?`                   | `readonly` | `"form"` \| `"json"`                                                                           | Overrides the profile's default encoding, for a grant that differs.          | [`TokenGrantOptions`](#tokengrantoptions).[`encoding`](#property-encoding-3)                 | [packages/adapters/src/model/credential.ts:251](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L251)                   |
| <a id="property-fetch"></a> `fetch?`                         | `readonly` | \{(`input`, `init?`): `Promise`\<`Response`\>; (`input`, `init?`): `Promise`\<`Response`\>; \} | Injected for tests, which must never reach a network.                        | [`TokenGrantOptions`](#tokengrantoptions).[`fetch`](#property-fetch-6)                       | [packages/adapters/src/model/credential.ts:261](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L261)                   |
| <a id="property-minimumintervalms"></a> `minimumIntervalMs?` | `readonly` | `number`                                                                                       | A floor under the provider's polling interval.                               | -                                                                                            | [packages/adapters/src/model/device-authorization.ts:68](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/device-authorization.ts#L68) |
| <a id="property-now"></a> `now?`                             | `readonly` | () => `string`                                                                                 | The clock, RFC 3339. Injected for tests, which must not depend on real time. | [`TokenGrantOptions`](#tokengrantoptions).[`now`](#property-now-3)                           | [packages/adapters/src/model/credential.ts:255](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L255)                   |
| <a id="property-profile"></a> `profile?`                     | `readonly` | [`SubscriptionOAuthProfile`](#subscriptionoauthprofile)                                        | Default [OPENAI\_SUBSCRIPTION\_PROFILE](#openai_subscription_profile).       | -                                                                                            | [packages/adapters/src/model/device-authorization.ts:66](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/device-authorization.ts#L66) |
| <a id="property-refreshtoken"></a> `refreshToken?`           | `readonly` | `string`                                                                                       | Kept when the response does not repeat it, so a login survives an exchange.  | [`TokenGrantOptions`](#tokengrantoptions).[`refreshToken`](#property-refreshtoken-3)         | [packages/adapters/src/model/credential.ts:257](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L257)                   |
| <a id="property-requesttimeoutms"></a> `requestTimeoutMs?`   | `readonly` | `number`                                                                                       | How long one token exchange may take. Default 30s.                           | [`TokenGrantOptions`](#tokengrantoptions).[`requestTimeoutMs`](#property-requesttimeoutms-6) | [packages/adapters/src/model/credential.ts:253](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L253)                   |
| <a id="property-timeoutms"></a> `timeoutMs?`                 | `readonly` | `number`                                                                                       | How long the person has. Default 15 minutes, which is the provider's.        | -                                                                                            | [packages/adapters/src/model/device-authorization.ts:70](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/device-authorization.ts#L70) |

---

### HarnessAvailability

Defined in: [packages/adapters/src/harness.ts:80](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L80)

Whether a harness can actually be run here, and if not, why not.

#### Properties

| Property                                    | Modifier   | Type                                             | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Defined in                                                                                                                   |
| ------------------------------------------- | ---------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-available"></a> `available` | `readonly` | `boolean`                                        | -                                                                                                                                                                                                                                                                                                                                                                                                                                                           | [packages/adapters/src/harness.ts:82](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L82) |
| <a id="property-detail"></a> `detail?`      | `readonly` | [`JsonObject`](sharedos-contracts.md#jsonobject) | Includes `versionOutput`, the line `version` was read from, verbatim.                                                                                                                                                                                                                                                                                                                                                                                       | [packages/adapters/src/harness.ts:95](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L95) |
| <a id="property-harness"></a> `harness`     | `readonly` | `string`                                         | -                                                                                                                                                                                                                                                                                                                                                                                                                                                           | [packages/adapters/src/harness.ts:81](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L81) |
| <a id="property-reason"></a> `reason?`      | `readonly` | `string`                                         | -                                                                                                                                                                                                                                                                                                                                                                                                                                                           | [packages/adapters/src/harness.ts:83](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L83) |
| <a id="property-version"></a> `version?`    | `readonly` | `string`                                         | The build that answered, as the harness itself reports it. A result about a vendor CLI is a result about one version of it, and the version is the harness's to state: nothing in this repository pins the installed binary, and a number carried in a runbook is a claim about what someone typed rather than about what ran. Absent when the executable declined to report one -- see [HarnessRequirements.versionArguments](#property-versionarguments). | [packages/adapters/src/harness.ts:93](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L93) |

---

### HarnessChannel

Defined in: [packages/adapters/src/harness.ts:42](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L42)

One open harness turn. Reads and writes are frames, never SharedOS types.

#### Methods

##### close()

> **close**(): `Promise`\<`void`>\>

Defined in: [packages/adapters/src/harness.ts:46](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L46)

###### Returns

`Promise`\<`void`\>

##### read()

> **read**(`signal`): `Promise`\<[`JsonObject`](sharedos-contracts.md#jsonobject) \| `undefined`>\>

Defined in: [packages/adapters/src/harness.ts:44](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L44)

The next frame, or `undefined` once the harness has finished speaking.

###### Parameters

| Parameter | Type          |
| --------- | ------------- |
| `signal`  | `AbortSignal` |

###### Returns

`Promise`\<[`JsonObject`](sharedos-contracts.md#jsonobject) \| `undefined`\>

##### write()

> **write**(`frame`, `signal`): `Promise`\<`void`>\>

Defined in: [packages/adapters/src/harness.ts:45](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L45)

###### Parameters

| Parameter | Type                                             |
| --------- | ------------------------------------------------ |
| `frame`   | [`JsonObject`](sharedos-contracts.md#jsonobject) |
| `signal`  | `AbortSignal`                                    |

###### Returns

`Promise`\<`void`\>

---

### HarnessDriverOptions

Defined in: [packages/adapters/src/driver.ts:21](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/driver.ts#L21)

#### Properties

| Property                                                   | Modifier   | Type                                             | Description                                                                                                                                                                                                                                                                                                                                                                                                                        | Defined in                                                                                                                 |
| ---------------------------------------------------------- | ---------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-declarestep"></a> `declareStep?`           | `readonly` | (`index`, `request`) => `number` \| `undefined`  | The step to declare for the nth call this turn releases, if any. `undefined` -- the default for every call -- leaves the step to the loop. It exists for the one thing a driven harness cannot otherwise express: reaching past its own budget. The loop's index stops at `maxSteps`, so a call at or past the ceiling can only be made by a driver that names the step itself, which makes the driver the attacker for that call. | [packages/adapters/src/driver.ts:38](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/driver.ts#L38) |
| <a id="property-manifest-5"></a> `manifest`                | `readonly` | `object`                                         | -                                                                                                                                                                                                                                                                                                                                                                                                                                  | [packages/adapters/src/driver.ts:22](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/driver.ts#L22) |
| `manifest.id`                                              | `public`   | `string`                                         | -                                                                                                                                                                                                                                                                                                                                                                                                                                  | packages/contracts/dist/runtime.d.ts:9                                                                                     |
| `manifest.metadata?`                                       | `public`   | [`JsonObject`](sharedos-contracts.md#jsonobject) | -                                                                                                                                                                                                                                                                                                                                                                                                                                  | packages/contracts/dist/runtime.d.ts:12                                                                                    |
| `manifest.protocolVersion`                                 | `public`   | `"1"`                                            | -                                                                                                                                                                                                                                                                                                                                                                                                                                  | packages/contracts/dist/runtime.d.ts:11                                                                                    |
| `manifest.version`                                         | `public`   | `string`                                         | -                                                                                                                                                                                                                                                                                                                                                                                                                                  | packages/contracts/dist/runtime.d.ts:10                                                                                    |
| <a id="property-maxignoredframes"></a> `maxIgnoredFrames?` | `readonly` | `number`                                         | Guard against a harness that streams unrelated frames without end.                                                                                                                                                                                                                                                                                                                                                                 | [packages/adapters/src/driver.ts:28](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/driver.ts#L28) |
| <a id="property-prompt"></a> `prompt?`                     | `readonly` | (`request`) => `string`                          | Overrides how the turn message becomes the harness prompt.                                                                                                                                                                                                                                                                                                                                                                         | [packages/adapters/src/driver.ts:26](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/driver.ts#L26) |
| <a id="property-protocol"></a> `protocol`                  | `readonly` | [`HarnessProtocol`](#harnessprotocol)            | -                                                                                                                                                                                                                                                                                                                                                                                                                                  | [packages/adapters/src/driver.ts:23](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/driver.ts#L23) |
| <a id="property-transport"></a> `transport`                | `readonly` | [`HarnessTransport`](#harnesstransport)          | -                                                                                                                                                                                                                                                                                                                                                                                                                                  | [packages/adapters/src/driver.ts:24](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/driver.ts#L24) |

---

### HarnessFrameWriter

Defined in: [packages/adapters/src/writer.ts:22](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/writer.ts#L22)

The inverse of [HarnessProtocol.interpret](#interpret): frames a harness would send.

A `HarnessProtocol` only ever reads. That is correct for production, where
the frames come from the vendor, and it leaves no way to _build_ a recorded
conversation for a harness to be replayed against. Writing those frames by
hand per test is how a fixture drifts from the shape the parser expects, so
the two live side by side and are exercised against each other.

A writer is deliberately not part of `HarnessProtocol`. Requiring every
adapter to implement an encoder that production never calls would put dead
code in the security-relevant path.

#### Properties

| Property                                      | Modifier   | Type     | Description                                                                | Defined in                                                                                                                 |
| --------------------------------------------- | ---------- | -------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-protocolid"></a> `protocolId` | `readonly` | `string` | The protocol these frames belong to; must match the reading protocol's id. | [packages/adapters/src/writer.ts:24](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/writer.ts#L24) |

#### Methods

##### complete()

> **complete**(`output?`): [`JsonObject`](sharedos-contracts.md#jsonobject)

Defined in: [packages/adapters/src/writer.ts:27](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/writer.ts#L27)

###### Parameters

| Parameter | Type                                           |
| --------- | ---------------------------------------------- |
| `output?` | [`JsonValue`](sharedos-contracts.md#jsonvalue) |

###### Returns

[`JsonObject`](sharedos-contracts.md#jsonobject)

##### message()

> **message**(`text`): [`JsonObject`](sharedos-contracts.md#jsonobject)

Defined in: [packages/adapters/src/writer.ts:26](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/writer.ts#L26)

###### Parameters

| Parameter | Type     |
| --------- | -------- |
| `text`    | `string` |

###### Returns

[`JsonObject`](sharedos-contracts.md#jsonobject)

##### toolCall()

> **toolCall**(`callId`, `tool`, `arguments_`): [`JsonObject`](sharedos-contracts.md#jsonobject)

Defined in: [packages/adapters/src/writer.ts:25](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/writer.ts#L25)

###### Parameters

| Parameter    | Type                                             |
| ------------ | ------------------------------------------------ |
| `callId`     | `string`                                         |
| `tool`       | `string`                                         |
| `arguments_` | [`JsonObject`](sharedos-contracts.md#jsonobject) |

###### Returns

[`JsonObject`](sharedos-contracts.md#jsonobject)

---

### HarnessProtocol

Defined in: [packages/adapters/src/harness.ts:66](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L66)

The translation between SharedOS and one vendor's wire shapes.

This is the whole adapter. Everything else -- the turn loop, per-call
re-authorization, the permission-filtered catalogue, audit -- is supplied by
the SharedOS execution envelope and is not reimplemented per vendor.

#### Properties

| Property                      | Modifier   | Type     | Defined in                                                                                                                   |
| ----------------------------- | ---------- | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-id"></a> `id` | `readonly` | `string` | [packages/adapters/src/harness.ts:67](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L67) |

#### Methods

##### describeTools()

> **describeTools**(`tools`): [`JsonValue`](sharedos-contracts.md#jsonvalue)

Defined in: [packages/adapters/src/harness.ts:69](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L69)

Render the permission-filtered catalogue in the harness's own tool shape.

###### Parameters

| Parameter | Type                |
| --------- | ------------------- |
| `tools`   | readonly `object`[] |

###### Returns

[`JsonValue`](sharedos-contracts.md#jsonvalue)

##### encodeToolResult()

> **encodeToolResult**(`result`): [`JsonObject`](sharedos-contracts.md#jsonobject)

Defined in: [packages/adapters/src/harness.ts:76](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L76)

###### Parameters

| Parameter | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `result`  | \{ `callId`: `string`; `completedAt`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `output`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `status`: `"succeeded"`; `tool`: `string`; \} \| \{ `callId`: `string`; `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"denied"`; `tool`: `string`; \} \| \{ `callId`: `string`; `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"failed"`; `tool`: `string`; \} |

###### Returns

[`JsonObject`](sharedos-contracts.md#jsonobject)

##### interpret()

> **interpret**(`frame`): readonly [`HarnessStep`](#harnessstep)[]

Defined in: [packages/adapters/src/harness.ts:75](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L75)

Everything one frame means, in order. Frames carrying nothing relevant --
progress notices, token counts, thinking blocks -- yield an empty array,
and a frame carrying several tool calls yields one step each.

###### Parameters

| Parameter | Type                                             |
| --------- | ------------------------------------------------ |
| `frame`   | [`JsonObject`](sharedos-contracts.md#jsonobject) |

###### Returns

readonly [`HarnessStep`](#harnessstep)[]

---

### HarnessRequirements

Defined in: [packages/adapters/src/harness.ts:99](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L99)

What a harness needs before it can run: an executable, credentials, or both.

#### Properties

| Property                                                        | Modifier   | Type                | Description                                                                                                                                     | Defined in                                                                                                                     |
| --------------------------------------------------------------- | ---------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| <a id="property-credentialsoptional"></a> `credentialsOptional` | `readonly` | `boolean`           | True when the harness can authenticate from a stored session instead.                                                                           | [packages/adapters/src/harness.ts:106](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L106) |
| <a id="property-credentialvariables"></a> `credentialVariables` | `readonly` | readonly `string`[] | Environment variables, any one of which satisfies the credential need.                                                                          | [packages/adapters/src/harness.ts:104](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L104) |
| <a id="property-executable"></a> `executable`                   | `readonly` | `string`            | Executable expected on PATH.                                                                                                                    | [packages/adapters/src/harness.ts:102](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L102) |
| <a id="property-harness-1"></a> `harness`                       | `readonly` | `string`            | -                                                                                                                                               | [packages/adapters/src/harness.ts:100](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L100) |
| <a id="property-versionarguments"></a> `versionArguments?`      | `readonly` | readonly `string`[] | How to ask this executable what it is. Defaults to `--version`, which all four harnesses here answer; declared so one that does not can say so. | [packages/adapters/src/harness.ts:111](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L111) |

---

### HarnessTranscript

Defined in: [packages/adapters/src/transcript.ts:16](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/transcript.ts#L16)

A harness conversation, supplied by its caller.

Batches are released one tool result at a time: the first batch is emitted
when the turn opens, and each later batch is unlocked by the adapter writing
a result back. That is the shape of every tool-using harness, so a transcript
exercises the same code path a live session does.

#### Properties

| Property                                | Modifier   | Type                                                                   | Defined in                                                                                                                         |
| --------------------------------------- | ---------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-batches"></a> `batches` | `readonly` | readonly readonly [`JsonObject`](sharedos-contracts.md#jsonobject)[][] | [packages/adapters/src/transcript.ts:17](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/transcript.ts#L17) |

---

### HarnessTransport

Defined in: [packages/adapters/src/harness.ts:55](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L55)

How a harness is reached: a subprocess, an HTTP session, or a recorded
transcript. Keeping this separate from the protocol is what lets one adapter
be exercised deterministically and then run live without changing the
translation code under test.

#### Methods

##### open()

> **open**(`request`, `signal`): `Promise`\<[`HarnessChannel`](#harnesschannel)>\>

Defined in: [packages/adapters/src/harness.ts:56](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L56)

###### Parameters

| Parameter | Type                                        |
| --------- | ------------------------------------------- |
| `request` | [`HarnessTurnRequest`](#harnessturnrequest) |
| `signal`  | `AbortSignal`                               |

###### Returns

`Promise`\<[`HarnessChannel`](#harnesschannel)\>

---

### HarnessTurnRequest

Defined in: [packages/adapters/src/harness.ts:31](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L31)

Everything a harness needs to start one turn.

#### Properties

| Property                                        | Modifier   | Type                                                                 | Description                                                            | Defined in                                                                                                                   |
| ----------------------------------------------- | ---------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-context"></a> `context`         | `readonly` | [`RuntimeVisibleContext`](sharedos-runtime.md#runtimevisiblecontext) | The sanitised context. It carries no grants and no issuing authority.  | [packages/adapters/src/harness.ts:37](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L37) |
| <a id="property-executionid"></a> `executionId` | `readonly` | `string`                                                             | -                                                                      | [packages/adapters/src/harness.ts:32](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L32) |
| <a id="property-metadata"></a> `metadata?`      | `readonly` | [`JsonObject`](sharedos-contracts.md#jsonobject)                     | -                                                                      | [packages/adapters/src/harness.ts:38](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L38) |
| <a id="property-prompt-1"></a> `prompt`         | `readonly` | `string`                                                             | -                                                                      | [packages/adapters/src/harness.ts:33](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L33) |
| <a id="property-tools"></a> `tools`             | `readonly` | [`JsonValue`](sharedos-contracts.md#jsonvalue)                       | The permission-filtered catalogue, already in the harness's own shape. | [packages/adapters/src/harness.ts:35](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L35) |

---

### ModelClient

Defined in: [packages/adapters/src/model/client.ts:102](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L102)

A model API in the SharedOS driver seat.

Deliberately narrower than any provider SDK: one call, tools in, tool calls
out. Everything that decides whether a call is allowed to happen -- the
catalogue, the turn loop, per-call re-authorization, audit -- stays in the
execution envelope, so a second provider is a second implementation of this
interface and no new enforcement path.

#### Properties

| Property                                    | Modifier   | Type                                             | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Defined in                                                                                                                               |
| ------------------------------------------- | ---------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-auth"></a> `auth?`          | `readonly` | [`JsonObject`](sharedos-contracts.md#jsonobject) | How this client authenticates, when it authenticates at all. Carried onto the turn's metadata for the same reason the served model is: a run on a metered API key and a run on somebody's subscription are different claims about where the answers came from, and a record that cannot tell them apart cannot say which one it is evidence of. It holds identifiers and shapes only -- see [ModelCredential.describe](#describe-1) -- and a client that presents nothing, such as a transcript, leaves it absent. | [packages/adapters/src/model/client.ts:117](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L117) |
| <a id="property-model-4"></a> `model`       | `readonly` | `string`                                         | The model this client was configured to ask for.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | [packages/adapters/src/model/client.ts:104](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L104) |
| <a id="property-provider-4"></a> `provider` | `readonly` | `string`                                         | The provider that serves it, recorded alongside the model on every turn.                                                                                                                                                                                                                                                                                                                                                                                                                                           | [packages/adapters/src/model/client.ts:106](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L106) |

#### Methods

##### complete()

> **complete**(`request`, `signal`): `Promise`\<[`ModelReply`](#modelreply)>\>

Defined in: [packages/adapters/src/model/client.ts:118](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L118)

###### Parameters

| Parameter | Type                                                |
| --------- | --------------------------------------------------- |
| `request` | [`ModelCompletionRequest`](#modelcompletionrequest) |
| `signal`  | `AbortSignal`                                       |

###### Returns

`Promise`\<[`ModelReply`](#modelreply)\>

---

### ModelCompletionRequest

Defined in: [packages/adapters/src/model/client.ts:45](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L45)

#### Properties

| Property                                  | Modifier   | Type                                       | Defined in                                                                                                                             |
| ----------------------------------------- | ---------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-messages"></a> `messages` | `readonly` | readonly [`ModelMessage`](#modelmessage)[] | [packages/adapters/src/model/client.ts:46](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L46) |
| <a id="property-tools-1"></a> `tools`     | `readonly` | readonly [`ModelTool`](#modeltool)[]       | [packages/adapters/src/model/client.ts:47](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L47) |

---

### ModelCredential

Defined in: [packages/adapters/src/model/credential.ts:20](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L20)

What one model call presents to prove it may be made.

Deliberately not "an API key". A key is one way a provider recognises a
caller; a subscription is another, and the two differ in a way the client
cannot paper over: a key is a constant, and a subscription token expires,
is renewed against a token endpoint, and names the account the call is billed
to in a header of the provider's choosing.

This is authentication and nothing else. Nothing a credential returns is
SharedOS authority: the catalogue this turn sees, the calls it may make, and
the audit it leaves are all resolved from the `GrantSource` before any of
this is consulted, and a credential that authenticates perfectly still
reaches exactly the tools the grant chain allows. A subscription that pays
for the model does not vouch for the agent using it.

#### Properties

| Property                                | Modifier   | Type     | Description                                                              | Defined in                                                                                                                                     |
| --------------------------------------- | ---------- | -------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-scheme-1"></a> `scheme` | `readonly` | `string` | How a call authenticates, in one word, for the record. Never the secret. | [packages/adapters/src/model/credential.ts:24](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L24) |

#### Methods

##### describe()

> **describe**(): [`JsonObject`](sharedos-contracts.md#jsonobject)

Defined in: [packages/adapters/src/model/credential.ts:54](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L54)

What may be recorded about how this call authenticated.

Identifiers and shapes, never a token and never the account code itself.
A record naming the paying account would put a stable, personal identifier
into artifacts that get committed and compared; that the seat was
account-scoped is the fact a reader of the record needs, and it is the
weaker claim.

###### Returns

[`JsonObject`](sharedos-contracts.md#jsonobject)

##### headers()

> **headers**(`signal`): `Promise`\<`Readonly`\<`Record`\<`string`, `string`>>>\>\>\>

Defined in: [packages/adapters/src/model/credential.ts:35](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L35)

The headers one call presents, resolved at the instant of that call.

Resolved per call rather than once at construction because a subscription
token has a validity window: a client that captured its headers when it was
built would keep presenting a token that had since expired. The rule is the
one ADR 0016 states for authority -- the operation's clock may only take
away -- so a token whose window has closed by the time the call is made is
renewed here, and a window that has not opened yet is never widened.

###### Parameters

| Parameter | Type          |
| --------- | ------------- |
| `signal`  | `AbortSignal` |

###### Returns

`Promise`\<`Readonly`\<`Record`\<`string`, `string`\>\>\>

##### renew()?

> `optional` **renew**(`signal`): `Promise`\<`boolean`>\>

Defined in: [packages/adapters/src/model/credential.ts:44](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L44)

One chance to renew, after the provider refused the call as
unauthenticated.

`false` means nothing changed and the caller should not try again: there was
no refresh token, or the renewal returned the same access token. Absent
entirely on a credential that cannot renew, which is what a static key is.

###### Parameters

| Parameter | Type          |
| --------- | ------------- |
| `signal`  | `AbortSignal` |

###### Returns

`Promise`\<`boolean`\>

---

### ModelDriverOptions

Defined in: [packages/adapters/src/model/driver.ts:88](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/driver.ts#L88)

#### Properties

| Property                                                     | Modifier   | Type                                             | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Defined in                                                                                                                               |
| ------------------------------------------------------------ | ---------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-client"></a> `client`                        | `readonly` | [`ModelClient`](#modelclient)                    | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | [packages/adapters/src/model/driver.ts:90](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/driver.ts#L90)   |
| <a id="property-declarestep-1"></a> `declareStep?`           | `readonly` | (`index`, `request`) => `number` \| `undefined`  | The step to declare for the nth call this turn releases, if any. Returning `undefined` -- the default for every call -- leaves the step to the loop, which is what a driver asking for one call at a time should do. It exists for the one thing a driver cannot otherwise express: reaching past its own budget. The loop's index stops at `maxSteps`, so a call at or past the ceiling can only be made by a driver that names the step itself. Supplying this makes the driver the attacker for that call, which is a different claim from the model choosing it, and a column that uses it should say so rather than letting the row read as a model's doing. | [packages/adapters/src/model/driver.ts:115](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/driver.ts#L115) |
| <a id="property-manifest-6"></a> `manifest`                  | `readonly` | `object`                                         | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | [packages/adapters/src/model/driver.ts:89](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/driver.ts#L89)   |
| `manifest.id`                                                | `public`   | `string`                                         | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | packages/contracts/dist/runtime.d.ts:9                                                                                                   |
| `manifest.metadata?`                                         | `public`   | [`JsonObject`](sharedos-contracts.md#jsonobject) | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | packages/contracts/dist/runtime.d.ts:12                                                                                                  |
| `manifest.protocolVersion`                                   | `public`   | `"1"`                                            | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | packages/contracts/dist/runtime.d.ts:11                                                                                                  |
| `manifest.version`                                           | `public`   | `string`                                         | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | packages/contracts/dist/runtime.d.ts:10                                                                                                  |
| <a id="property-maxmalformedcalls"></a> `maxMalformedCalls?` | `readonly` | `number`                                         | Guard against a model that never forms a readable call. A call whose arguments do not parse is refused by the driver and answered back to the model, which costs the turn no step; a model that kept producing them would otherwise be spoken to until the turn timed out. Past this many in one turn, the turn fails instead.                                                                                                                                                                                                                                                                                                                                    | [packages/adapters/src/model/driver.ts:101](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/driver.ts#L101) |
| <a id="property-prompt-2"></a> `prompt?`                     | `readonly` | (`request`) => `string`                          | Overrides how the turn message becomes the model's prompt.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | [packages/adapters/src/model/driver.ts:92](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/driver.ts#L92)   |

---

### ModelHttpClientOptions

Defined in: [packages/adapters/src/model/client.ts:134](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L134)

#### Extended by

- [`OpenAiCompatibleModelClientOptions`](#openaicompatiblemodelclientoptions)
- [`OpenAiResponsesModelClientOptions`](#openairesponsesmodelclientoptions)

#### Properties

| Property                                                     | Modifier   | Type                                                                                           | Description                                                                                                                                                                                                                                                                                                                                                                                                                      | Defined in                                                                                                                               |
| ------------------------------------------------------------ | ---------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-apikey"></a> `apiKey?`                       | `readonly` | `string`                                                                                       | A metered account's key. Supply this or [credential](#property-credential), never both.                                                                                                                                                                                                                                                                                                                                          | [packages/adapters/src/model/client.ts:136](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L136) |
| <a id="property-baseurl"></a> `baseUrl`                      | `readonly` | `string`                                                                                       | The API root, without a trailing slash.                                                                                                                                                                                                                                                                                                                                                                                          | [packages/adapters/src/model/client.ts:149](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L149) |
| <a id="property-credential"></a> `credential?`               | `readonly` | [`ModelCredential`](#modelcredential)                                                          | How calls authenticate, for anything a constant key cannot express. A subscription is the case this exists for: an access token that expires, renewed against the provider's token endpoint, presented alongside the code of the account the plan bills. See [SubscriptionOAuthCredential](#subscriptionoauthcredential).                                                                                                        | [packages/adapters/src/model/client.ts:144](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L144) |
| <a id="property-fetch-1"></a> `fetch?`                       | `readonly` | \{(`input`, `init?`): `Promise`\<`Response`\>; (`input`, `init?`): `Promise`\<`Response`\>; \} | Injected for tests, which must never reach a network.                                                                                                                                                                                                                                                                                                                                                                            | [packages/adapters/src/model/client.ts:163](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L163) |
| <a id="property-headers"></a> `headers?`                     | `readonly` | `Readonly`\<`Record`\<`string`, `string`\>\>                                                   | Constant headers this endpoint requires, beyond the content type. A subscription endpoint often wants more than a token -- a client originator, a beta opt-in -- and which ones is the operator's knowledge of their provider rather than something this package should assert. The credential's own headers win over these: a static configuration must not be able to override the token or the account the call is billed to. | [packages/adapters/src/model/client.ts:159](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L159) |
| <a id="property-model-5"></a> `model`                        | `readonly` | `string`                                                                                       | -                                                                                                                                                                                                                                                                                                                                                                                                                                | [packages/adapters/src/model/client.ts:145](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L145) |
| <a id="property-provider-5"></a> `provider`                  | `readonly` | `string`                                                                                       | Names the provider on every record this client's turns produce.                                                                                                                                                                                                                                                                                                                                                                  | [packages/adapters/src/model/client.ts:147](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L147) |
| <a id="property-requesttimeoutms-1"></a> `requestTimeoutMs?` | `readonly` | `number`                                                                                       | How long one model call may take, independently of the turn's own budget.                                                                                                                                                                                                                                                                                                                                                        | [packages/adapters/src/model/client.ts:161](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L161) |

---

### ModelReply

Defined in: [packages/adapters/src/model/client.ts:57](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L57)

What the model answered with.

#### Properties

| Property                                           | Modifier   | Type                                         | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Defined in                                                                                                                             |
| -------------------------------------------------- | ---------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-finishreason"></a> `finishReason?` | `readonly` | `string`                                     | Why generation stopped, in the provider's own vocabulary. Recorded verbatim and never normalised, so two providers that end a reply for the same reason under different words stay distinguishable in the record. What the driver acts on is [truncated](#property-truncated), which is the same fact stated once for every wire shape.                                                                                                                                                                                     | [packages/adapters/src/model/client.ts:68](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L68) |
| <a id="property-model-6"></a> `model?`             | `readonly` | `string`                                     | The model the provider says actually answered. Recorded separately from the one that was asked for because they differ: DeepSeek maps an unrecognised name onto a default rather than rejecting it, so a run configured for one model can be served by another. The record should say what answered, which is the weaker claim and the honest one.                                                                                                                                                                          | [packages/adapters/src/model/client.ts:90](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L90) |
| <a id="property-text"></a> `text`                  | `readonly` | `string`                                     | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | [packages/adapters/src/model/client.ts:58](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L58) |
| <a id="property-toolcalls"></a> `toolCalls`        | `readonly` | readonly [`ModelToolCall`](#modeltoolcall)[] | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | [packages/adapters/src/model/client.ts:59](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L59) |
| <a id="property-truncated"></a> `truncated?`       | `readonly` | `boolean`                                    | Whether the provider ended the reply rather than the model choosing to. A completion cut off at the output ceiling looks, without this, exactly like a completion the model chose to end: its calls may be half-written and its silence is not a decision. The driver fails the turn on it rather than grading the cut, so every client has to state it -- `finish_reason: "length"` on chat-completions, an `incomplete` status on the Responses API -- and a client that leaves it absent is claiming the model finished. | [packages/adapters/src/model/client.ts:79](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L79) |
| <a id="property-usage"></a> `usage?`               | `readonly` | [`ModelUsage`](#modelusage)                  | Absent when the provider reported no usage; never estimated.                                                                                                                                                                                                                                                                                                                                                                                                                                                                | [packages/adapters/src/model/client.ts:81](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L81) |

---

### ModelTool

Defined in: [packages/adapters/src/model/client.ts:22](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L22)

A tool offered to the model, already rendered into the provider's alphabet.

#### Properties

| Property                                        | Modifier   | Type                                             | Defined in                                                                                                                             |
| ----------------------------------------------- | ---------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-description"></a> `description` | `readonly` | `string`                                         | [packages/adapters/src/model/client.ts:24](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L24) |
| <a id="property-name-2"></a> `name`             | `readonly` | `string`                                         | [packages/adapters/src/model/client.ts:23](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L23) |
| <a id="property-parameters"></a> `parameters`   | `readonly` | [`JsonObject`](sharedos-contracts.md#jsonobject) | [packages/adapters/src/model/client.ts:25](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L25) |

---

### ModelToolCall

Defined in: [packages/adapters/src/model/client.ts:15](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L15)

One tool call a model asked for, exactly as it came off the wire.

The name is the provider's alphabet, not SharedOS's, and the arguments are
still an unparsed string. Neither is normalised here: a client's job is to
carry what the model said, and deciding what an unparseable argument blob or
an unrecognised name means is a policy question that belongs to the driver.

#### Properties

| Property                                    | Modifier   | Type     | Defined in                                                                                                                             |
| ------------------------------------------- | ---------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-arguments"></a> `arguments` | `readonly` | `string` | [packages/adapters/src/model/client.ts:18](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L18) |
| <a id="property-id-1"></a> `id`             | `readonly` | `string` | [packages/adapters/src/model/client.ts:16](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L16) |
| <a id="property-name-3"></a> `name`         | `readonly` | `string` | [packages/adapters/src/model/client.ts:17](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L17) |

---

### ModelTranscript

Defined in: [packages/adapters/src/model/transcript.ts:11](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/transcript.ts#L11)

A model conversation, supplied by its caller.

One reply per model call. The first reply answers the opening prompt, and
each later reply is released only once every tool call in the reply before
it has been answered -- which is what the driver already requires of a live
provider, so a transcript exercises the same code path a live model does.

#### Properties

| Property                                | Modifier   | Type                                   | Defined in                                                                                                                                     |
| --------------------------------------- | ---------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-replies"></a> `replies` | `readonly` | readonly [`ModelReply`](#modelreply)[] | [packages/adapters/src/model/transcript.ts:12](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/transcript.ts#L12) |

---

### ModelUsage

Defined in: [packages/adapters/src/model/client.ts:51](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L51)

What a provider billed for one reply, when it said.

#### Properties

| Property                                           | Modifier   | Type     | Defined in                                                                                                                             |
| -------------------------------------------------- | ---------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-inputtokens"></a> `inputTokens?`   | `readonly` | `number` | [packages/adapters/src/model/client.ts:52](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L52) |
| <a id="property-outputtokens"></a> `outputTokens?` | `readonly` | `number` | [packages/adapters/src/model/client.ts:53](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L53) |

---

### OpenAiCompatibleModelClientOptions

Defined in: [packages/adapters/src/model/chat-completions.ts:51](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/chat-completions.ts#L51)

#### Extends

- [`ModelHttpClientOptions`](#modelhttpclientoptions)

#### Properties

| Property                                                     | Modifier   | Type                                                                                           | Description                                                                                                                                                                                                                                                                                                                                                                                                                      | Overrides                                                                          | Inherited from                                                                                         | Defined in                                                                                                                                                 |
| ------------------------------------------------------------ | ---------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-apikey-1"></a> `apiKey?`                     | `readonly` | `string`                                                                                       | A metered account's key. Supply this or [credential](#property-credential), never both.                                                                                                                                                                                                                                                                                                                                          | -                                                                                  | [`ModelHttpClientOptions`](#modelhttpclientoptions).[`apiKey`](#property-apikey)                       | [packages/adapters/src/model/client.ts:136](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L136)                   |
| <a id="property-baseurl-1"></a> `baseUrl`                    | `readonly` | `string`                                                                                       | The chat-completions root, without a trailing slash.                                                                                                                                                                                                                                                                                                                                                                             | [`ModelHttpClientOptions`](#modelhttpclientoptions).[`baseUrl`](#property-baseurl) | -                                                                                                      | [packages/adapters/src/model/chat-completions.ts:53](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/chat-completions.ts#L53) |
| <a id="property-credential-1"></a> `credential?`             | `readonly` | [`ModelCredential`](#modelcredential)                                                          | How calls authenticate, for anything a constant key cannot express. A subscription is the case this exists for: an access token that expires, renewed against the provider's token endpoint, presented alongside the code of the account the plan bills. See [SubscriptionOAuthCredential](#subscriptionoauthcredential).                                                                                                        | -                                                                                  | [`ModelHttpClientOptions`](#modelhttpclientoptions).[`credential`](#property-credential)               | [packages/adapters/src/model/client.ts:144](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L144)                   |
| <a id="property-fetch-2"></a> `fetch?`                       | `readonly` | \{(`input`, `init?`): `Promise`\<`Response`\>; (`input`, `init?`): `Promise`\<`Response`\>; \} | Injected for tests, which must never reach a network.                                                                                                                                                                                                                                                                                                                                                                            | -                                                                                  | [`ModelHttpClientOptions`](#modelhttpclientoptions).[`fetch`](#property-fetch-1)                       | [packages/adapters/src/model/client.ts:163](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L163)                   |
| <a id="property-headers-1"></a> `headers?`                   | `readonly` | `Readonly`\<`Record`\<`string`, `string`\>\>                                                   | Constant headers this endpoint requires, beyond the content type. A subscription endpoint often wants more than a token -- a client originator, a beta opt-in -- and which ones is the operator's knowledge of their provider rather than something this package should assert. The credential's own headers win over these: a static configuration must not be able to override the token or the account the call is billed to. | -                                                                                  | [`ModelHttpClientOptions`](#modelhttpclientoptions).[`headers`](#property-headers)                     | [packages/adapters/src/model/client.ts:159](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L159)                   |
| <a id="property-maxoutputtokens"></a> `maxOutputTokens?`     | `readonly` | `number`                                                                                       | -                                                                                                                                                                                                                                                                                                                                                                                                                                | -                                                                                  | -                                                                                                      | [packages/adapters/src/model/chat-completions.ts:54](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/chat-completions.ts#L54) |
| <a id="property-model-7"></a> `model`                        | `readonly` | `string`                                                                                       | -                                                                                                                                                                                                                                                                                                                                                                                                                                | -                                                                                  | [`ModelHttpClientOptions`](#modelhttpclientoptions).[`model`](#property-model-5)                       | [packages/adapters/src/model/client.ts:145](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L145)                   |
| <a id="property-provider-6"></a> `provider`                  | `readonly` | `string`                                                                                       | Names the provider on every record this client's turns produce.                                                                                                                                                                                                                                                                                                                                                                  | -                                                                                  | [`ModelHttpClientOptions`](#modelhttpclientoptions).[`provider`](#property-provider-5)                 | [packages/adapters/src/model/client.ts:147](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L147)                   |
| <a id="property-requesttimeoutms-2"></a> `requestTimeoutMs?` | `readonly` | `number`                                                                                       | How long one model call may take, independently of the turn's own budget.                                                                                                                                                                                                                                                                                                                                                        | -                                                                                  | [`ModelHttpClientOptions`](#modelhttpclientoptions).[`requestTimeoutMs`](#property-requesttimeoutms-1) | [packages/adapters/src/model/client.ts:161](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L161)                   |
| <a id="property-temperature"></a> `temperature?`             | `readonly` | `number`                                                                                       | Left at zero by default, which reduces variation between runs but does not remove it. This column is not deterministic and must not be described as if it were: a temperature of zero is not a seed, and the same prompt can still produce a different call sequence on a different day.                                                                                                                                         | -                                                                                  | -                                                                                                      | [packages/adapters/src/model/chat-completions.ts:61](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/chat-completions.ts#L61) |

---

### OpenAiResponsesModelClientOptions

Defined in: [packages/adapters/src/model/responses.ts:67](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/responses.ts#L67)

#### Extends

- [`ModelHttpClientOptions`](#modelhttpclientoptions)

#### Properties

| Property                                                     | Modifier   | Type                                                                                           | Description                                                                                                                                                                                                                                                                                                                                                                                                                      | Overrides                                                                          | Inherited from                                                                                         | Defined in                                                                                                                                   |
| ------------------------------------------------------------ | ---------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-apikey-2"></a> `apiKey?`                     | `readonly` | `string`                                                                                       | A metered account's key. Supply this or [credential](#property-credential), never both.                                                                                                                                                                                                                                                                                                                                          | -                                                                                  | [`ModelHttpClientOptions`](#modelhttpclientoptions).[`apiKey`](#property-apikey)                       | [packages/adapters/src/model/client.ts:136](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L136)     |
| <a id="property-baseurl-2"></a> `baseUrl`                    | `readonly` | `string`                                                                                       | The Responses root, without a trailing slash and without `/responses`.                                                                                                                                                                                                                                                                                                                                                           | [`ModelHttpClientOptions`](#modelhttpclientoptions).[`baseUrl`](#property-baseurl) | -                                                                                                      | [packages/adapters/src/model/responses.ts:69](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/responses.ts#L69) |
| <a id="property-credential-2"></a> `credential?`             | `readonly` | [`ModelCredential`](#modelcredential)                                                          | How calls authenticate, for anything a constant key cannot express. A subscription is the case this exists for: an access token that expires, renewed against the provider's token endpoint, presented alongside the code of the account the plan bills. See [SubscriptionOAuthCredential](#subscriptionoauthcredential).                                                                                                        | -                                                                                  | [`ModelHttpClientOptions`](#modelhttpclientoptions).[`credential`](#property-credential)               | [packages/adapters/src/model/client.ts:144](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L144)     |
| <a id="property-fetch-3"></a> `fetch?`                       | `readonly` | \{(`input`, `init?`): `Promise`\<`Response`\>; (`input`, `init?`): `Promise`\<`Response`\>; \} | Injected for tests, which must never reach a network.                                                                                                                                                                                                                                                                                                                                                                            | -                                                                                  | [`ModelHttpClientOptions`](#modelhttpclientoptions).[`fetch`](#property-fetch-1)                       | [packages/adapters/src/model/client.ts:163](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L163)     |
| <a id="property-headers-2"></a> `headers?`                   | `readonly` | `Readonly`\<`Record`\<`string`, `string`\>\>                                                   | Constant headers this endpoint requires, beyond the content type. A subscription endpoint often wants more than a token -- a client originator, a beta opt-in -- and which ones is the operator's knowledge of their provider rather than something this package should assert. The credential's own headers win over these: a static configuration must not be able to override the token or the account the call is billed to. | -                                                                                  | [`ModelHttpClientOptions`](#modelhttpclientoptions).[`headers`](#property-headers)                     | [packages/adapters/src/model/client.ts:159](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L159)     |
| <a id="property-maxoutputtokens-1"></a> `maxOutputTokens?`   | `readonly` | `number`                                                                                       | -                                                                                                                                                                                                                                                                                                                                                                                                                                | -                                                                                  | -                                                                                                      | [packages/adapters/src/model/responses.ts:70](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/responses.ts#L70) |
| <a id="property-model-8"></a> `model`                        | `readonly` | `string`                                                                                       | -                                                                                                                                                                                                                                                                                                                                                                                                                                | -                                                                                  | [`ModelHttpClientOptions`](#modelhttpclientoptions).[`model`](#property-model-5)                       | [packages/adapters/src/model/client.ts:145](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L145)     |
| <a id="property-provider-7"></a> `provider`                  | `readonly` | `string`                                                                                       | Names the provider on every record this client's turns produce.                                                                                                                                                                                                                                                                                                                                                                  | -                                                                                  | [`ModelHttpClientOptions`](#modelhttpclientoptions).[`provider`](#property-provider-5)                 | [packages/adapters/src/model/client.ts:147](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L147)     |
| <a id="property-requesttimeoutms-3"></a> `requestTimeoutMs?` | `readonly` | `number`                                                                                       | How long one model call may take, independently of the turn's own budget.                                                                                                                                                                                                                                                                                                                                                        | -                                                                                  | [`ModelHttpClientOptions`](#modelhttpclientoptions).[`requestTimeoutMs`](#property-requesttimeoutms-1) | [packages/adapters/src/model/client.ts:161](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L161)     |
| <a id="property-store"></a> `store?`                         | `readonly` | `boolean`                                                                                      | Whether the provider may retain the turn. Default false. The request carries the turn's prompt, the catalogue, and every tool result. Asking a provider to keep that is a decision a host should make deliberately, so the default is not to.                                                                                                                                                                                    | -                                                                                  | -                                                                                                      | [packages/adapters/src/model/responses.ts:96](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/responses.ts#L96) |
| <a id="property-stream"></a> `stream?`                       | `readonly` | `boolean`                                                                                      | Whether to ask for the answer as a stream of events. Default true. Streaming is not a feature here; it is what the subscription endpoint accepts. What arrives is decided by the response's own content type rather than by this flag, so a provider that streams anyway, or that declines to, is read correctly either way.                                                                                                     | -                                                                                  | -                                                                                                      | [packages/adapters/src/model/responses.ts:88](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/responses.ts#L88) |
| <a id="property-temperature-1"></a> `temperature?`           | `readonly` | `number`                                                                                       | Omitted unless a caller asks for one, unlike the chat-completions client. A reasoning model rejects the parameter outright, and those are the models this endpoint mostly serves, so a default of zero would make the client unusable against exactly the provider it exists for. A caller pointing it at a model that accepts one can still say so.                                                                             | -                                                                                  | -                                                                                                      | [packages/adapters/src/model/responses.ts:79](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/responses.ts#L79) |

---

### RevocationOptions

Defined in: [packages/adapters/src/model/credential.ts:373](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L373)

#### Extends

- [`TokenGrantOptions`](#tokengrantoptions)

#### Properties

| Property                                                     | Modifier   | Type                                                                                           | Description                                                                  | Inherited from                                                                               | Defined in                                                                                                                                       |
| ------------------------------------------------------------ | ---------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| <a id="property-accountcode-1"></a> `accountCode?`           | `readonly` | `string`                                                                                       | Kept when the response does not repeat it.                                   | [`TokenGrantOptions`](#tokengrantoptions).[`accountCode`](#property-accountcode-4)           | [packages/adapters/src/model/credential.ts:259](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L259) |
| <a id="property-encoding-1"></a> `encoding?`                 | `readonly` | `"form"` \| `"json"`                                                                           | Overrides the profile's default encoding, for a grant that differs.          | [`TokenGrantOptions`](#tokengrantoptions).[`encoding`](#property-encoding-3)                 | [packages/adapters/src/model/credential.ts:251](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L251) |
| <a id="property-fetch-4"></a> `fetch?`                       | `readonly` | \{(`input`, `init?`): `Promise`\<`Response`\>; (`input`, `init?`): `Promise`\<`Response`\>; \} | Injected for tests, which must never reach a network.                        | [`TokenGrantOptions`](#tokengrantoptions).[`fetch`](#property-fetch-6)                       | [packages/adapters/src/model/credential.ts:261](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L261) |
| <a id="property-now-1"></a> `now?`                           | `readonly` | () => `string`                                                                                 | The clock, RFC 3339. Injected for tests, which must not depend on real time. | [`TokenGrantOptions`](#tokengrantoptions).[`now`](#property-now-3)                           | [packages/adapters/src/model/credential.ts:255](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L255) |
| <a id="property-profile-1"></a> `profile?`                   | `readonly` | [`SubscriptionOAuthProfile`](#subscriptionoauthprofile)                                        | Default [OPENAI\_SUBSCRIPTION\_PROFILE](#openai_subscription_profile).       | -                                                                                            | [packages/adapters/src/model/credential.ts:375](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L375) |
| <a id="property-refreshtoken-1"></a> `refreshToken?`         | `readonly` | `string`                                                                                       | Kept when the response does not repeat it, so a login survives an exchange.  | [`TokenGrantOptions`](#tokengrantoptions).[`refreshToken`](#property-refreshtoken-3)         | [packages/adapters/src/model/credential.ts:257](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L257) |
| <a id="property-requesttimeoutms-4"></a> `requestTimeoutMs?` | `readonly` | `number`                                                                                       | How long one token exchange may take. Default 30s.                           | [`TokenGrantOptions`](#tokengrantoptions).[`requestTimeoutMs`](#property-requesttimeoutms-6) | [packages/adapters/src/model/credential.ts:253](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L253) |

---

### SubscriptionOAuthCredentialOptions

Defined in: [packages/adapters/src/model/credential.ts:200](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L200)

#### Properties

| Property                                                     | Modifier   | Type                                                                                           | Description                                                                                                                                                                                                                                                                                                                                                                       | Defined in                                                                                                                                       |
| ------------------------------------------------------------ | ---------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| <a id="property-accountcode-2"></a> `accountCode?`           | `readonly` | `string`                                                                                       | Overrides the account code the login carried, for a multi-account login.                                                                                                                                                                                                                                                                                                          | [packages/adapters/src/model/credential.ts:204](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L204) |
| <a id="property-fetch-5"></a> `fetch?`                       | `readonly` | \{(`input`, `init?`): `Promise`\<`Response`\>; (`input`, `init?`): `Promise`\<`Response`\>; \} | Injected for tests, which must never reach a network.                                                                                                                                                                                                                                                                                                                             | [packages/adapters/src/model/credential.ts:228](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L228) |
| <a id="property-now-2"></a> `now?`                           | `readonly` | () => `string`                                                                                 | The clock, RFC 3339. Injected for tests, which must not depend on real time.                                                                                                                                                                                                                                                                                                      | [packages/adapters/src/model/credential.ts:226](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L226) |
| <a id="property-onrefresh"></a> `onRefresh?`                 | `readonly` | (`tokens`) => `void` \| `Promise`\<`void`\>                                                    | Where renewed tokens go. Providers rotate the refresh token on every exchange, so a host that does not persist what comes back has a login that works until the process exits and then cannot be renewed at all. SharedOS stores nothing itself: this is the host's sink, called with the whole set, and a failure in it is not allowed to fail the model call that triggered it. | [packages/adapters/src/model/credential.ts:224](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L224) |
| <a id="property-profile-2"></a> `profile`                    | `readonly` | [`SubscriptionOAuthProfile`](#subscriptionoauthprofile)                                        | -                                                                                                                                                                                                                                                                                                                                                                                 | [packages/adapters/src/model/credential.ts:201](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L201) |
| <a id="property-refreshskewms"></a> `refreshSkewMs?`         | `readonly` | `number`                                                                                       | How long before expiry a token is renewed anyway. Default 60s. A token that is valid when the request is written can still be expired when the provider reads it. The skew renews early rather than discovering that as a failed turn.                                                                                                                                            | [packages/adapters/src/model/credential.ts:212](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L212) |
| <a id="property-requesttimeoutms-5"></a> `requestTimeoutMs?` | `readonly` | `number`                                                                                       | How long one token exchange may take. Default 30s.                                                                                                                                                                                                                                                                                                                                | [packages/adapters/src/model/credential.ts:214](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L214) |
| <a id="property-tokens"></a> `tokens`                        | `readonly` | [`SubscriptionTokens`](#subscriptiontokens)                                                    | -                                                                                                                                                                                                                                                                                                                                                                                 | [packages/adapters/src/model/credential.ts:202](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L202) |

---

### SubscriptionOAuthProfile

Defined in: [packages/adapters/src/model/credential.ts:96](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L96)

Where a subscription provider's tokens come from and how its account code
travels.

A profile is configuration, not code: adding a second subscription provider
is a second one of these, and no second credential class.

#### Properties

| Property                                                           | Modifier   | Type                                         | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Defined in                                                                                                                                       |
| ------------------------------------------------------------------ | ---------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| <a id="property-accountheader"></a> `accountHeader`                | `readonly` | `string`                                     | The header the provider reads the subscription's account code from. Subscription plans are billed per account, and the access token alone does not always say which one: a login that covers several workspaces issues one token and expects the account to be named alongside it.                                                                                                                                                                           | [packages/adapters/src/model/credential.ts:131](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L131) |
| <a id="property-clientid"></a> `clientId`                          | `readonly` | `string`                                     | The public client the login was performed by.                                                                                                                                                                                                                                                                                                                                                                                                                | [packages/adapters/src/model/credential.ts:123](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L123) |
| <a id="property-codeexchangeencoding"></a> `codeExchangeEncoding?` | `readonly` | `"form"` \| `"json"`                         | How it wants the body of an authorization-code exchange, when that differs. It does differ, and not as an oversight: OpenAI's own client posts a refresh as JSON and a code exchange as `application/x-www-form-urlencoded` to the same endpoint. Declared separately rather than assumed equal, because assuming would mean one of the two grants is sent in an encoding no client has ever tested against that server.                                     | [packages/adapters/src/model/credential.ts:143](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L143) |
| <a id="property-encoding-2"></a> `encoding?`                       | `readonly` | `"form"` \| `"json"`                         | How the token endpoint wants its request body. RFC 6749 says `form`.                                                                                                                                                                                                                                                                                                                                                                                         | [packages/adapters/src/model/credential.ts:133](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L133) |
| <a id="property-headers-3"></a> `headers?`                         | `readonly` | `Readonly`\<`Record`\<`string`, `string`\>\> | Constant headers the provider requires on a subscription call.                                                                                                                                                                                                                                                                                                                                                                                               | [packages/adapters/src/model/credential.ts:145](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L145) |
| <a id="property-id-2"></a> `id`                                    | `readonly` | `string`                                     | Names the issuer on every record this credential's turns produce.                                                                                                                                                                                                                                                                                                                                                                                            | [packages/adapters/src/model/credential.ts:98](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L98)   |
| <a id="property-issuerurl"></a> `issuerUrl?`                       | `readonly` | `string`                                     | The issuer root, from which a device login derives every path it needs. One field rather than four because that is how the provider treats it: the route chosen for the issuer is reused for the device-auth endpoints, the callback it redirects to, and the token exchange, and resolving them separately would let a host point half a login at one host and half at another. Absent on a profile with no device login. See `requestDeviceAuthorization`. | [packages/adapters/src/model/credential.ts:111](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L111) |
| <a id="property-revocationurl"></a> `revocationUrl?`               | `readonly` | `string`                                     | Where a login is handed back, for a host ending one. Named rather than derived. Revocation is the one call whose absence is silent -- a login nobody revoked simply stays live -- so a profile that guessed at the path would let a failed log-out look like a completed one. Absent on a profile whose provider publishes no revocation endpoint, and `revokeSubscriptionLogin` says so rather than posting hopefully.                                      | [packages/adapters/src/model/credential.ts:121](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L121) |
| <a id="property-tokenurl"></a> `tokenUrl`                          | `readonly` | `string`                                     | The OAuth token endpoint, which is where a refresh is exchanged.                                                                                                                                                                                                                                                                                                                                                                                             | [packages/adapters/src/model/credential.ts:100](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L100) |

---

### SubscriptionTokens

Defined in: [packages/adapters/src/model/credential.ts:184](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L184)

One subscription login, as it is held between calls and persisted between
runs.

JSON-safe on purpose: a host stores this wherever it stores secrets, and the
refresh token rotates, so the shape that comes out of a renewal is the shape
that has to go back to the store.

#### Properties

| Property                                             | Modifier   | Type     | Description                                                                                                                                                                                                                                              | Defined in                                                                                                                                       |
| ---------------------------------------------------- | ---------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| <a id="property-accesstoken"></a> `accessToken`      | `readonly` | `string` | -                                                                                                                                                                                                                                                        | [packages/adapters/src/model/credential.ts:185](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L185) |
| <a id="property-accountcode-3"></a> `accountCode?`   | `readonly` | `string` | The subscription account this login pays from, when the login carried one. Called a code rather than an id because that is what it is to SharedOS: an opaque string copied into a header. Nothing here parses it, compares it, or treats it as identity. | [packages/adapters/src/model/credential.ts:197](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L197) |
| <a id="property-expiresat-1"></a> `expiresAt?`       | `readonly` | `string` | RFC 3339. Absent when the provider did not say when it ends.                                                                                                                                                                                             | [packages/adapters/src/model/credential.ts:189](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L189) |
| <a id="property-refreshtoken-2"></a> `refreshToken?` | `readonly` | `string` | Absent on a login that cannot be renewed; the credential then cannot either.                                                                                                                                                                             | [packages/adapters/src/model/credential.ts:187](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L187) |

---

### TokenGrantOptions

Defined in: [packages/adapters/src/model/credential.ts:249](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L249)

#### Extended by

- [`RevocationOptions`](#revocationoptions)
- [`DeviceAuthorizationOptions`](#deviceauthorizationoptions)

#### Properties

| Property                                                     | Modifier   | Type                                                                                           | Description                                                                  | Defined in                                                                                                                                       |
| ------------------------------------------------------------ | ---------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| <a id="property-accountcode-4"></a> `accountCode?`           | `readonly` | `string`                                                                                       | Kept when the response does not repeat it.                                   | [packages/adapters/src/model/credential.ts:259](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L259) |
| <a id="property-encoding-3"></a> `encoding?`                 | `readonly` | `"form"` \| `"json"`                                                                           | Overrides the profile's default encoding, for a grant that differs.          | [packages/adapters/src/model/credential.ts:251](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L251) |
| <a id="property-fetch-6"></a> `fetch?`                       | `readonly` | \{(`input`, `init?`): `Promise`\<`Response`\>; (`input`, `init?`): `Promise`\<`Response`\>; \} | Injected for tests, which must never reach a network.                        | [packages/adapters/src/model/credential.ts:261](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L261) |
| <a id="property-now-3"></a> `now?`                           | `readonly` | () => `string`                                                                                 | The clock, RFC 3339. Injected for tests, which must not depend on real time. | [packages/adapters/src/model/credential.ts:255](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L255) |
| <a id="property-refreshtoken-3"></a> `refreshToken?`         | `readonly` | `string`                                                                                       | Kept when the response does not repeat it, so a login survives an exchange.  | [packages/adapters/src/model/credential.ts:257](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L257) |
| <a id="property-requesttimeoutms-6"></a> `requestTimeoutMs?` | `readonly` | `number`                                                                                       | How long one token exchange may take. Default 30s.                           | [packages/adapters/src/model/credential.ts:253](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L253) |

---

### TranscriptModelClientOptions

Defined in: [packages/adapters/src/model/transcript.ts:15](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/transcript.ts#L15)

#### Properties

| Property                                     | Modifier   | Type     | Description                                                      | Defined in                                                                                                                                     |
| -------------------------------------------- | ---------- | -------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-model-9"></a> `model?`       | `readonly` | `string` | What the record names as the model; defaults to `transcript`.    | [packages/adapters/src/model/transcript.ts:17](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/transcript.ts#L17) |
| <a id="property-provider-8"></a> `provider?` | `readonly` | `string` | What the record names as the provider; defaults to `transcript`. | [packages/adapters/src/model/transcript.ts:19](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/transcript.ts#L19) |

## Type Aliases

### ClaudeCodeDriverOptions

> **ClaudeCodeDriverOptions** = `Omit`\<[`HarnessDriverOptions`](#harnessdriveroptions), `"manifest"` \| `"protocol"`> \> & `object`

Defined in: [packages/adapters/src/claude-code/index.ts:38](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/claude-code/index.ts#L38)

#### Type Declaration

##### manifest?

> `readonly` `optional` **manifest?**: [`RuntimeManifest`](sharedos-contracts.md#runtimemanifest)

##### transport

> `readonly` **transport**: [`HarnessTransport`](#harnesstransport)

---

### CodexDriverOptions

> **CodexDriverOptions** = `Omit`\<[`HarnessDriverOptions`](#harnessdriveroptions), `"manifest"` \| `"protocol"`> \> & `object`

Defined in: [packages/adapters/src/codex/index.ts:38](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/codex/index.ts#L38)

#### Type Declaration

##### manifest?

> `readonly` `optional` **manifest?**: [`RuntimeManifest`](sharedos-contracts.md#runtimemanifest)

##### transport

> `readonly` **transport**: [`HarnessTransport`](#harnesstransport)

---

### DeepseekDriverOptions

> **DeepseekDriverOptions** = `Omit`\<[`HarnessDriverOptions`](#harnessdriveroptions), `"manifest"` \| `"protocol"`> \> & `object`

Defined in: [packages/adapters/src/deepseek/index.ts:45](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/deepseek/index.ts#L45)

#### Type Declaration

##### manifest?

> `readonly` `optional` **manifest?**: [`RuntimeManifest`](sharedos-contracts.md#runtimemanifest)

##### transport

> `readonly` **transport**: [`HarnessTransport`](#harnesstransport)

---

### HarnessFrame

> **HarnessFrame** = [`JsonObject`](sharedos-contracts.md#jsonobject)

Defined in: [packages/adapters/src/harness.ts:11](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L11)

One raw protocol frame, in whatever shape the harness speaks.

---

### HarnessStep

> **HarnessStep** = \{ `arguments`: [`JsonObject`](sharedos-contracts.md#jsonobject); `callId`: `string`; `tool`: `string`; `type`: `"tool_call"`; \} \| \{ `text`: `string`; `type`: `"message"`; \} \| \{ `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `output?`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `type`: `"complete"`; \} \| \{ `error`: [`ProtocolError`](sharedos-contracts.md#protocolerror); `type`: `"failed"`; \}

Defined in: [packages/adapters/src/harness.ts:19](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L19)

What one frame means once the vendor protocol has interpreted it.

`message` is assistant prose. It is kept rather than discarded so a harness
whose terminal frame carries no text still produces a turn output.

---

### ModelMessage

> **ModelMessage** = \{ `content`: `string`; `role`: `"system"` \| `"user"`; \} \| \{ `content`: `string`; `role`: `"assistant"`; `toolCalls`: readonly [`ModelToolCall`](#modeltoolcall)[]; \} \| \{ `content`: `string`; `role`: `"tool"`; `toolCallId`: `string`; \}

Defined in: [packages/adapters/src/model/client.ts:36](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L36)

One turn of conversation.

`assistant` carries the tool calls the model asked for and `tool` carries one
result back, because a chat-completions provider requires the pair to appear
in that order and requires every call in an assistant message to be answered
before the next one is sent.

---

### PiDriverOptions

> **PiDriverOptions** = `Omit`\<[`HarnessDriverOptions`](#harnessdriveroptions), `"manifest"` \| `"protocol"`> \> & `object`

Defined in: [packages/adapters/src/pi/index.ts:49](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/pi/index.ts#L49)

#### Type Declaration

##### manifest?

> `readonly` `optional` **manifest?**: [`RuntimeManifest`](sharedos-contracts.md#runtimemanifest)

##### transport

> `readonly` **transport**: [`HarnessTransport`](#harnesstransport)

---

### SubscriptionRevocation

> **SubscriptionRevocation** = `"refresh_token"` \| `"access_token"` \| `"nothing"`

Defined in: [packages/adapters/src/model/credential.ts:371](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L371)

Which token a log-out handed back, or that there was none to hand back.

---

### TokenGrant

> **TokenGrant** = \{ `granted`: `true`; `tokens`: [`SubscriptionTokens`](#subscriptiontokens); \} \| \{ `code?`: `string`; `granted`: `false`; `status`: `number`; \}

Defined in: [packages/adapters/src/model/credential.ts:272](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L272)

What one call to a token endpoint produced.

A refusal is a value rather than an exception because a device login polls a
token endpoint that answers `400 authorization_pending` on purpose, several
times, before it ever succeeds. Throwing on that would make the ordinary path
of one grant the exception path of another.

## Variables

### CLAUDE\_CODE\_ADAPTER\_VERSION

> `const` **CLAUDE\_CODE\_ADAPTER\_VERSION**: `"0.1.0-alpha.3"` = `"0.1.0-alpha.3"`

Defined in: [packages/adapters/src/claude-code/index.ts:15](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/claude-code/index.ts#L15)

---

### CLAUDE\_CODE\_HARNESS\_ID

> `const` **CLAUDE\_CODE\_HARNESS\_ID**: `"claude-code"`

Defined in: [packages/adapters/src/claude-code/index.ts:13](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/claude-code/index.ts#L13)

The id this harness goes by everywhere: manifests, requirements, MCP specs, scripts.

---

### CLAUDE\_CODE\_PROTOCOL\_ID

> `const` **CLAUDE\_CODE\_PROTOCOL\_ID**: `"anthropic.messages.stream-json"` = `"anthropic.messages.stream-json"`

Defined in: [packages/adapters/src/claude-code/protocol.ts:15](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/claude-code/protocol.ts#L15)

Claude Code speaks Anthropic message content blocks inside a stream-json
envelope.

The content blocks -- `tool_use`, `tool_result`, `text` -- are the stable
part and are what this module translates. The `{type:"assistant"|"user"|
"result"}` envelope is the CLI's `--output-format stream-json` framing.

---

### CLAUDE\_CODE\_REQUIREMENTS

> `const` **CLAUDE\_CODE\_REQUIREMENTS**: [`HarnessRequirements`](#harnessrequirements)

Defined in: [packages/adapters/src/claude-code/index.ts:30](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/claude-code/index.ts#L30)

What a live Claude Code session needs before it can run.

---

### CLAUDE\_CODE\_RUNTIME\_MANIFEST

> `const` **CLAUDE\_CODE\_RUNTIME\_MANIFEST**: [`RuntimeManifest`](sharedos-contracts.md#runtimemanifest)

Defined in: [packages/adapters/src/claude-code/index.ts:17](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/claude-code/index.ts#L17)

---

### claudeCodeFrameWriter

> `const` **claudeCodeFrameWriter**: [`HarnessFrameWriter`](#harnessframewriter)

Defined in: [packages/adapters/src/writer.ts:58](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/writer.ts#L58)

Frames in the Anthropic content-block shape Claude Code speaks.

---

### claudeCodeProtocol

> `const` **claudeCodeProtocol**: [`HarnessProtocol`](#harnessprotocol)

Defined in: [packages/adapters/src/claude-code/protocol.ts:48](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/claude-code/protocol.ts#L48)

---

### CODEX\_ADAPTER\_VERSION

> `const` **CODEX\_ADAPTER\_VERSION**: `"0.1.0-alpha.3"` = `"0.1.0-alpha.3"`

Defined in: [packages/adapters/src/codex/index.ts:15](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/codex/index.ts#L15)

---

### CODEX\_HARNESS\_ID

> `const` **CODEX\_HARNESS\_ID**: `"codex"`

Defined in: [packages/adapters/src/codex/index.ts:13](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/codex/index.ts#L13)

The id this harness goes by everywhere: manifests, requirements, MCP specs, scripts.

---

### CODEX\_PROTOCOL\_ID

> `const` **CODEX\_PROTOCOL\_ID**: `"openai.responses.function-calling"` = `"openai.responses.function-calling"`

Defined in: [packages/adapters/src/codex/protocol.ts:18](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/codex/protocol.ts#L18)

Codex speaks the OpenAI Responses function-calling shape.

That is the layer this module targets: function tool declarations,
`function_call` items, and `function_call_output` results. It is deliberately
not the Codex CLI's own event envelope, which differs between releases. What
carries these frames -- the CLI in JSON mode, the Codex SDK, or a direct
Responses call -- is the transport's problem, not the protocol's.

---

### CODEX\_REQUIREMENTS

> `const` **CODEX\_REQUIREMENTS**: [`HarnessRequirements`](#harnessrequirements)

Defined in: [packages/adapters/src/codex/index.ts:30](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/codex/index.ts#L30)

What a live Codex session needs before it can run.

---

### CODEX\_RUNTIME\_MANIFEST

> `const` **CODEX\_RUNTIME\_MANIFEST**: [`RuntimeManifest`](sharedos-contracts.md#runtimemanifest)

Defined in: [packages/adapters/src/codex/index.ts:17](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/codex/index.ts#L17)

---

### codexFrameWriter

> `const` **codexFrameWriter**: [`HarnessFrameWriter`](#harnessframewriter)

Defined in: [packages/adapters/src/writer.ts:31](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/writer.ts#L31)

Frames in the OpenAI Responses function-calling shape Codex speaks.

---

### codexProtocol

> `const` **codexProtocol**: [`HarnessProtocol`](#harnessprotocol)

Defined in: [packages/adapters/src/codex/protocol.ts:66](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/codex/protocol.ts#L66)

---

### DEEPSEEK\_ADAPTER\_VERSION

> `const` **DEEPSEEK\_ADAPTER\_VERSION**: `"0.1.0-alpha.3"` = `"0.1.0-alpha.3"`

Defined in: [packages/adapters/src/deepseek/index.ts:15](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/deepseek/index.ts#L15)

---

### DEEPSEEK\_HARNESS\_ID

> `const` **DEEPSEEK\_HARNESS\_ID**: `"deepseek"`

Defined in: [packages/adapters/src/deepseek/index.ts:13](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/deepseek/index.ts#L13)

The id this harness goes by everywhere: manifests, requirements, MCP specs, scripts.

---

### DEEPSEEK\_PROTOCOL\_ID

> `const` **DEEPSEEK\_PROTOCOL\_ID**: `"deepseek.harness.session-events"` = `"deepseek.harness.session-events"`

Defined in: [packages/adapters/src/deepseek/protocol.ts:27](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/deepseek/protocol.ts#L27)

DeepSeek Harness speaks its own session-log vocabulary over a
newline-delimited JSON-RPC 2.0 stdio transport.

That vocabulary is the layer this module targets: `tool/call` carrying the
model's raw argument string, `assistant/message` carrying assembled content
blocks, and `turn/end` carrying a structured reason. It is deliberately not
the `dsh` CLI's command-line surface, which is a plugin composition that
varies per deployment. What carries these frames -- the SDK runtime server,
the ACP bridge, or a recorded log -- is the transport's problem.

One asymmetry is worth stating plainly, because it is a property of the
harness rather than of this adapter. DeepSeek Harness executes its own tools:
its wire has no frame meaning "here is your catalogue". A host that wants the
catalogue to be the permission-filtered one must deliver it out of band, and
the harness's own path for that is an MCP server (`dsh-mcp-client`). So
[HarnessProtocol.describeTools](#describetools) renders the harness's `ToolSchema` shape, which is what
that out-of-band channel carries, and no frame is emitted for it.

---

### DEEPSEEK\_REQUIREMENTS

> `const` **DEEPSEEK\_REQUIREMENTS**: [`HarnessRequirements`](#harnessrequirements)

Defined in: [packages/adapters/src/deepseek/index.ts:37](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/deepseek/index.ts#L37)

What a live DeepSeek Harness session needs before it can run.

---

### DEEPSEEK\_RUNTIME\_MANIFEST

> `const` **DEEPSEEK\_RUNTIME\_MANIFEST**: [`RuntimeManifest`](sharedos-contracts.md#runtimemanifest)

Defined in: [packages/adapters/src/deepseek/index.ts:17](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/deepseek/index.ts#L17)

---

### deepseekFrameWriter

> `const` **deepseekFrameWriter**: [`HarnessFrameWriter`](#harnessframewriter)

Defined in: [packages/adapters/src/writer.ts:92](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/writer.ts#L92)

Frames in the session-log shape DeepSeek Harness streams.

Wrapped in their `session.event` notification rather than left bare, because
that is the shape a live SDK runtime emits and a fixture that skipped the
envelope would exercise only half of what the parser has to accept.

---

### deepseekProtocol

> `const` **deepseekProtocol**: [`HarnessProtocol`](#harnessprotocol)

Defined in: [packages/adapters/src/deepseek/protocol.ts:107](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/deepseek/protocol.ts#L107)

---

### OPENAI\_SUBSCRIPTION\_PROFILE

> `const` **OPENAI\_SUBSCRIPTION\_PROFILE**: [`SubscriptionOAuthProfile`](#subscriptionoauthprofile)

Defined in: [packages/adapters/src/model/credential.ts:165](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L165)

The OpenAI login, whether a vendor CLI performed it or SharedOS did.

The client id is the public one Codex authorizes with; there is no secret in
a PKCE flow, which is what makes it publishable here.

Every value is the one OpenAI's own client uses, taken from
`codex-rs/login` rather than from a specification. That matters twice over.
The device login is not RFC 8628 -- it is the provider's own protocol under
`/api/accounts/deviceauth`, which is why the OpenID discovery document at
`https://auth.openai.com/.well-known/openid-configuration` advertises no
`device_authorization_endpoint` and why reading that document is not enough
to know whether a provider has a device login. And that document names
`/api/accounts/authorize` and `/api/accounts/oauth/token` where the working
client uses `/oauth/token`; the working client wins, because an untested
endpoint fails as a broken login.

---

### PI\_ADAPTER\_VERSION

> `const` **PI\_ADAPTER\_VERSION**: `"0.1.0-alpha.3"` = `"0.1.0-alpha.3"`

Defined in: [packages/adapters/src/pi/index.ts:15](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/pi/index.ts#L15)

---

### PI\_HARNESS\_ID

> `const` **PI\_HARNESS\_ID**: `"pi"`

Defined in: [packages/adapters/src/pi/index.ts:13](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/pi/index.ts#L13)

The id this harness goes by everywhere: manifests, requirements, MCP specs, scripts.

---

### PI\_PROTOCOL\_ID

> `const` **PI\_PROTOCOL\_ID**: `"pi.rpc.jsonl"` = `"pi.rpc.jsonl"`

Defined in: [packages/adapters/src/pi/protocol.ts:30](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/pi/protocol.ts#L30)

Pi speaks newline-delimited JSON events in its RPC mode (`pi --mode rpc`).

The message vocabulary is the layer this module targets: an `AssistantMessage`
whose content carries `toolCall` blocks, a `ToolResultMessage` carrying the
result back, and the `agent_end` / `response` frames that end a turn. It is
deliberately not Pi's streaming delta events, which restate the same content
token by token; Pi's own guidance is to treat the assembled message as
authoritative, and reading both would issue every call twice.

Two asymmetries are worth stating plainly, because both are properties of the
harness rather than of this adapter:

- Pi does not declare tools on the RPC wire, and ships no MCP client of its
  own. Its path for a host-supplied tool is `defineTool` through the SDK, or
  an extension such as `pi-mcp-adapter`, which is how the MCP column reaches
  it; [HarnessProtocol.describeTools](#describetools) renders the `defineTool` shape and
  no frame is emitted for it.
- Pi executes its own tools. `tool_execution_start` announces a call Pi is
  already running, not a request for the host to run one, so it is not read
  as a tool call. The `toolCall` content block -- the model's actual request
  -- is.

---

### PI\_REQUIREMENTS

> `const` **PI\_REQUIREMENTS**: [`HarnessRequirements`](#harnessrequirements)

Defined in: [packages/adapters/src/pi/index.ts:37](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/pi/index.ts#L37)

What a live Pi session needs before it can run.

---

### PI\_RUNTIME\_MANIFEST

> `const` **PI\_RUNTIME\_MANIFEST**: [`RuntimeManifest`](sharedos-contracts.md#runtimemanifest)

Defined in: [packages/adapters/src/pi/index.ts:17](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/pi/index.ts#L17)

---

### piFrameWriter

> `const` **piFrameWriter**: [`HarnessFrameWriter`](#harnessframewriter)

Defined in: [packages/adapters/src/writer.ts:135](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/writer.ts#L135)

Frames in the RPC message shape Pi speaks.

---

### piProtocol

> `const` **piProtocol**: [`HarnessProtocol`](#harnessprotocol)

Defined in: [packages/adapters/src/pi/protocol.ts:86](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/pi/protocol.ts#L86)

## Functions

### accountCodeFromIdToken()

> **accountCodeFromIdToken**(`idToken`): `string` \| `undefined`

Defined in: [packages/adapters/src/model/credential.ts:651](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L651)

The account code an OpenAI id token carries, when it carries one.

The claim is read, not verified. Nothing here checks the signature, and it
would prove nothing worth having if it did: the code is copied into a header
for the provider to route on, and the provider is the one that decides
whether this login may spend that account. Treating it as identity, or as
authority, is exactly the mistake this comment exists to prevent.

Absent for a token that is unreadable, unsegmented, or carries no such claim
-- all of which are ordinary, and none of which are errors here.

#### Parameters

| Parameter | Type                    |
| --------- | ----------------------- |
| `idToken` | `string` \| `undefined` |

#### Returns

`string` \| `undefined`

---

### apiKeyCredential()

> **apiKeyCredential**(`apiKey`): [`ModelCredential`](#modelcredential)

Defined in: [packages/adapters/src/model/credential.ts:77](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L77)

A constant key in an `authorization` header: what a metered API account is.

It cannot renew, and the omission is the point. A 401 against a static key is
a configuration error, and retrying it would ask the same wrong question
twice.

#### Parameters

| Parameter | Type     |
| --------- | -------- |
| `apiKey`  | `string` |

#### Returns

[`ModelCredential`](#modelcredential)

---

### createClaudeCodeDriver()

> **createClaudeCodeDriver**(`options`): [`HarnessDriver`](#harnessdriver)

Defined in: [packages/adapters/src/claude-code/index.ts:50](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/claude-code/index.ts#L50)

Claude Code as a SharedOS agent turn driver.

As with Codex, the adapter translates and nothing else. Enforcement stays in
the execution envelope, so installing a second harness changes no kernel code
and adds no second permission path.

#### Parameters

| Parameter | Type                                                  |
| --------- | ----------------------------------------------------- |
| `options` | [`ClaudeCodeDriverOptions`](#claudecodedriveroptions) |

#### Returns

[`HarnessDriver`](#harnessdriver)

---

### createClaudeCodeRuntime()

> **createClaudeCodeRuntime**(`options`, `runtimeOptions?`): [`HarnessRuntime`](#harnessruntime)

Defined in: [packages/adapters/src/claude-code/index.ts:65](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/claude-code/index.ts#L65)

Claude Code as an installable runtime, reporting its own manifest.

Prefer this over wrapping the driver in `StandardRuntime` directly: the
executor stamps the plugin's manifest onto every execution record, so only
this form files a turn's evidence under the harness that produced it.

#### Parameters

| Parameter        | Type                                                                   |
| ---------------- | ---------------------------------------------------------------------- |
| `options`        | [`ClaudeCodeDriverOptions`](#claudecodedriveroptions)                  |
| `runtimeOptions` | [`StandardRuntimeOptions`](sharedos-runtime.md#standardruntimeoptions) |

#### Returns

[`HarnessRuntime`](#harnessruntime)

---

### createCodexDriver()

> **createCodexDriver**(`options`): [`HarnessDriver`](#harnessdriver)

Defined in: [packages/adapters/src/codex/index.ts:50](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/codex/index.ts#L50)

Codex as a SharedOS agent turn driver.

The adapter is translation only. Install it with `StandardRuntime`, and the
turn loop, the permission-filtered catalogue, per-call re-authorization, and
audit all come from the SharedOS execution envelope unchanged.

#### Parameters

| Parameter | Type                                        |
| --------- | ------------------------------------------- |
| `options` | [`CodexDriverOptions`](#codexdriveroptions) |

#### Returns

[`HarnessDriver`](#harnessdriver)

---

### createCodexRuntime()

> **createCodexRuntime**(`options`, `runtimeOptions?`): [`HarnessRuntime`](#harnessruntime)

Defined in: [packages/adapters/src/codex/index.ts:65](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/codex/index.ts#L65)

Codex as an installable runtime, reporting its own manifest.

Prefer this over wrapping the driver in `StandardRuntime` directly: the
executor stamps the plugin's manifest onto every execution record, so only
this form files a turn's evidence under the harness that produced it.

#### Parameters

| Parameter        | Type                                                                   |
| ---------------- | ---------------------------------------------------------------------- |
| `options`        | [`CodexDriverOptions`](#codexdriveroptions)                            |
| `runtimeOptions` | [`StandardRuntimeOptions`](sharedos-runtime.md#standardruntimeoptions) |

#### Returns

[`HarnessRuntime`](#harnessruntime)

---

### createDeepseekDriver()

> **createDeepseekDriver**(`options`): [`HarnessDriver`](#harnessdriver)

Defined in: [packages/adapters/src/deepseek/index.ts:57](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/deepseek/index.ts#L57)

DeepSeek Harness as a SharedOS agent turn driver.

As with Codex and Claude Code, the adapter translates and nothing else.
Enforcement stays in the execution envelope, so installing a third harness
changes no kernel code and adds no second permission path.

#### Parameters

| Parameter | Type                                              |
| --------- | ------------------------------------------------- |
| `options` | [`DeepseekDriverOptions`](#deepseekdriveroptions) |

#### Returns

[`HarnessDriver`](#harnessdriver)

---

### createDeepseekRuntime()

> **createDeepseekRuntime**(`options`, `runtimeOptions?`): [`HarnessRuntime`](#harnessruntime)

Defined in: [packages/adapters/src/deepseek/index.ts:72](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/deepseek/index.ts#L72)

DeepSeek Harness as an installable runtime, reporting its own manifest.

Prefer this over wrapping the driver in `StandardRuntime` directly: the
executor stamps the plugin's manifest onto every execution record, so only
this form files a turn's evidence under the harness that produced it.

#### Parameters

| Parameter        | Type                                                                   |
| ---------------- | ---------------------------------------------------------------------- |
| `options`        | [`DeepseekDriverOptions`](#deepseekdriveroptions)                      |
| `runtimeOptions` | [`StandardRuntimeOptions`](sharedos-runtime.md#standardruntimeoptions) |

#### Returns

[`HarnessRuntime`](#harnessruntime)

---

### createPiDriver()

> **createPiDriver**(`options`): [`HarnessDriver`](#harnessdriver)

Defined in: [packages/adapters/src/pi/index.ts:61](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/pi/index.ts#L61)

Pi as a SharedOS agent turn driver.

As with every other harness here, the adapter translates and nothing else.
Enforcement stays in the execution envelope, so installing a fourth harness
changes no kernel code and adds no second permission path.

#### Parameters

| Parameter | Type                                  |
| --------- | ------------------------------------- |
| `options` | [`PiDriverOptions`](#pidriveroptions) |

#### Returns

[`HarnessDriver`](#harnessdriver)

---

### createPiRuntime()

> **createPiRuntime**(`options`, `runtimeOptions?`): [`HarnessRuntime`](#harnessruntime)

Defined in: [packages/adapters/src/pi/index.ts:76](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/pi/index.ts#L76)

Pi as an installable runtime, reporting its own manifest.

Prefer this over wrapping the driver in `StandardRuntime` directly: the
executor stamps the plugin's manifest onto every execution record, so only
this form files a turn's evidence under the harness that produced it.

#### Parameters

| Parameter        | Type                                                                   |
| ---------------- | ---------------------------------------------------------------------- |
| `options`        | [`PiDriverOptions`](#pidriveroptions)                                  |
| `runtimeOptions` | [`StandardRuntimeOptions`](sharedos-runtime.md#standardruntimeoptions) |

#### Returns

[`HarnessRuntime`](#harnessruntime)

---

### parseToolArguments()

> **parseToolArguments**(`raw`): [`JsonObject`](sharedos-contracts.md#jsonobject) \| `undefined`

Defined in: [packages/adapters/src/internal.ts:45](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/internal.ts#L45)

Argument blobs are model or harness output, so they are parsed rather than
trusted: an empty blob is an empty object, anything that is not a JSON
object is refused as `undefined`.

#### Parameters

| Parameter | Type     |
| --------- | -------- |
| `raw`     | `string` |

#### Returns

[`JsonObject`](sharedos-contracts.md#jsonobject) \| `undefined`

---

### postJson()

> **postJson**(`url`, `body`, `options`, `subject`): `Promise`\<`Response`>\>

Defined in: [packages/adapters/src/model/credential.ts:351](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L351)

POST one JSON document, with this package's deadline and its error wording.

The transport half of every call that is not a token grant -- a device
request, a poll, a revocation. `subject` names the endpoint in the one error
a caller can act on, because "could not be reached" is only useful when it
says what could not be reached.

#### Parameters

| Parameter | Type                                         |
| --------- | -------------------------------------------- |
| `url`     | `string`                                     |
| `body`    | `Readonly`\<`Record`\<`string`, `string`\>\> |
| `options` | [`TokenGrantOptions`](#tokengrantoptions)    |
| `subject` | `string`                                     |

#### Returns

`Promise`\<`Response`\>

---

### requestDeviceAuthorization()

> **requestDeviceAuthorization**(`options?`): `Promise`\<[`DeviceAuthorization`](#deviceauthorization)>\>

Defined in: [packages/adapters/src/model/device-authorization.ts:101](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/device-authorization.ts#L101)

Ask the provider to start a device login.

The tokens this eventually produces are the same [SubscriptionTokens](#subscriptiontokens) a
stored vendor login yields, so what consumes them --
[SubscriptionOAuthCredential](#subscriptionoauthcredential), and the store a host keeps them in --
cannot tell which flow obtained them.

#### Parameters

| Parameter | Type                                                        |
| --------- | ----------------------------------------------------------- |
| `options` | [`DeviceAuthorizationOptions`](#deviceauthorizationoptions) |

#### Returns

`Promise`\<[`DeviceAuthorization`](#deviceauthorization)\>

---

### requestTokenGrant()

> **requestTokenGrant**(`profile`, `parameters`, `options?`): `Promise`\<[`TokenGrant`](#tokengrant)>\>

Defined in: [packages/adapters/src/model/credential.ts:284](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L284)

The one place a token endpoint is asked for anything.

Every grant this package performs -- a refresh, a device authorization, an
authorization code -- differs only in the parameters it posts, so the
encoding, the timeout, the schema, the expiry arithmetic, and the rule that a
response body never escapes are decided once.

#### Parameters

| Parameter    | Type                                                    |
| ------------ | ------------------------------------------------------- |
| `profile`    | [`SubscriptionOAuthProfile`](#subscriptionoauthprofile) |
| `parameters` | `Readonly`\<`Record`\<`string`, `string`\>\>            |
| `options`    | [`TokenGrantOptions`](#tokengrantoptions)               |

#### Returns

`Promise`\<[`TokenGrant`](#tokengrant)\>

---

### revokeSubscriptionLogin()

> **revokeSubscriptionLogin**(`tokens`, `options?`): `Promise`\<[`SubscriptionRevocation`](#subscriptionrevocation)>\>

Defined in: [packages/adapters/src/model/credential.ts:393](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/credential.ts#L393)

End a login at the provider, which is the only place it can be ended.

Deleting a stored login forgets it here; it does not stop it working. The
refresh token is what keeps a subscription session alive, and until the
provider is told, a copy of that token -- in a backup, in a container image,
in a shell history -- is still a working login. So this is the half of a
log-out that matters, and forgetting the file is the half that is merely
tidy.

The refresh token is offered when there is one, because revoking it ends the
session; an access token is the fallback, and ends only itself. The client id
travels with the first and not the second, which is what the provider's own
client does.

#### Parameters

| Parameter | Type                                        |
| --------- | ------------------------------------------- |
| `tokens`  | [`SubscriptionTokens`](#subscriptiontokens) |
| `options` | [`RevocationOptions`](#revocationoptions)   |

#### Returns

`Promise`\<[`SubscriptionRevocation`](#subscriptionrevocation)\>
