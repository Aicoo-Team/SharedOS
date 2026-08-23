[**SharedOS API v0.1.0-alpha.0**](README.md)

---

[SharedOS API](README.md) / @aicoo/sharedos-adapters

# @aicoo/sharedos-adapters

Codex, Claude Code, DeepSeek Harness, and Pi runtime adapters for SharedOS.

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
    args: ["exec", "--json"],
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
`scripts/live-conformance.mjs` covers exactly that gap by spawning the installed
CLI and parsing what the binary actually emits.

| Layer                            | Status                                                       |
| -------------------------------- | ------------------------------------------------------------ |
| SharedOS side of the translation | Verified by tests                                            |
| Codex function-call shapes       | Targets the OpenAI Responses function-calling protocol       |
| Claude Code content blocks       | Targets Anthropic message content blocks                     |
| DeepSeek session-log events      | Targets the harness's `tool/call` + `turn/end` vocabulary    |
| Pi RPC messages                  | Targets Pi's assembled `AssistantMessage` content            |
| Claude Code stream-json envelope | Verified live against `claude` 2.1.238                       |
| Pi RPC envelope                  | Verified live against `pi` 0.84.2                            |
| Codex / DeepSeek CLI invocation  | **Verify against a live CLI** — neither was installable here |

## Who executes the tools

The four harnesses do not agree on this, and the difference decides how much a
column can claim.

| Harness     | Catalogue reaches the harness by     | Tool executed by      |
| ----------- | ------------------------------------ | --------------------- |
| Codex       | `function` declarations, on the wire | The host              |
| Claude Code | `input_schema` tools, on the wire    | The host              |
| DeepSeek    | Out of band — an MCP server          | The host, via MCP     |
| Pi          | Out of band — `defineTool`, no MCP   | The host, via the SDK |

Codex and Claude Code carry a tool catalogue in the protocol itself. DeepSeek
Harness and Pi run their own tools and have no wire frame that means "here is
your catalogue", so a host that wants the permission-filtered one delivered must
use the harness's own out-of-band path. Both adapters therefore stamp
`catalogueDelivery: "out-of-band"` onto every execution record they produce: a
column whose catalogue arrived out of band is making a narrower claim than one
whose catalogue was on the wire, and that belongs in the evidence rather than in
a footnote.

This is also why a live conformance run needs more than a live transport. The
transport is verified; delivering the catalogue to a live `claude` or `dsh`
session needs an MCP bridge that does not exist yet, and until it does a live
column's rows are `not exercised` rather than passing.

## Availability

`probeCodex`, `probeClaudeCode`, `probeDeepseek`, and `probePi` report whether a
harness can run here, and say why not when it cannot:

```ts
import { probeClaudeCode } from "@aicoo/sharedos-adapters/node";

const availability = await probeClaudeCode();
// { harness: "claude-code", available: false, reason: "The claude executable is not on PATH." }
```

Every one of these harnesses can authenticate from a stored login as well as from
an environment variable, so a probe treats credentials as optional and reports
which one it found. Conformance runs should use this to mark a column as not
exercised rather than as failing: an absent harness is not evidence about
SharedOS.

## Host neutrality

The main entry point has no Node dependency. `ChildProcessTransport` and the
availability probes are published from `@aicoo/sharedos-adapters/node`, because
spawning a CLI and reading `PATH` are host concerns rather than protocol ones.

## Classes

### HarnessDriver

Defined in: [adapters/src/driver.ts:50](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/driver.ts#L50)

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

Defined in: [adapters/src/driver.ts:57](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/driver.ts#L57)

###### Parameters

| Parameter | Type                                            |
| --------- | ----------------------------------------------- |
| `options` | [`HarnessDriverOptions`](#harnessdriveroptions) |

###### Returns

[`HarnessDriver`](#harnessdriver)

#### Properties

| Property                                  | Modifier   | Type                                             | Defined in                                                                                                        |
| ----------------------------------------- | ---------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| <a id="property-manifest"></a> `manifest` | `readonly` | `object`                                         | [adapters/src/driver.ts:51](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/driver.ts#L51) |
| `manifest.id`                             | `public`   | `string`                                         | contracts/dist/runtime.d.ts:9                                                                                     |
| `manifest.metadata?`                      | `public`   | [`JsonObject`](sharedos-contracts.md#jsonobject) | contracts/dist/runtime.d.ts:12                                                                                    |
| `manifest.protocolVersion`                | `public`   | `"1"`                                            | contracts/dist/runtime.d.ts:11                                                                                    |
| `manifest.version`                        | `public`   | `string`                                         | contracts/dist/runtime.d.ts:10                                                                                    |

#### Methods

##### open()

> **open**(`request`, `signal`): `Promise`\<[`AgentTurnSession`](sharedos-runtime.md#agentturnsession)>\>

Defined in: [adapters/src/driver.ts:68](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/driver.ts#L68)

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

Defined in: [adapters/src/runtime.ts:27](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/runtime.ts#L27)

A harness driver installed as a runtime under its own identity.

`StandardRuntime` is the reference turn loop and reports itself as
`sharedos.standard`, which is correct for the driver it was built for and
wrong for a vendor harness: the executor stamps the _plugin's_ manifest onto
every execution record, so a Codex turn wrapped in `StandardRuntime` alone
would file its evidence under the standard runtime.

That matters beyond tidiness. Comparing harnesses depends on each column's
evidence naming the harness that produced it; a column that misattributes
itself is worse than a column that is absent, because it looks like data.

This keeps the loop and replaces only the identity.

#### Implements

- [`RuntimePlugin`](sharedos-runtime.md#runtimeplugin)

#### Constructors

##### Constructor

> **new HarnessRuntime**(`driver`, `options?`): [`HarnessRuntime`](#harnessruntime)

Defined in: [adapters/src/runtime.ts:31](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/runtime.ts#L31)

###### Parameters

| Parameter | Type                                                                   |
| --------- | ---------------------------------------------------------------------- |
| `driver`  | [`HarnessDriver`](#harnessdriver)                                      |
| `options` | [`StandardRuntimeOptions`](sharedos-runtime.md#standardruntimeoptions) |

###### Returns

[`HarnessRuntime`](#harnessruntime)

#### Properties

| Property                                    | Modifier   | Type                                             | Defined in                                                                                                          |
| ------------------------------------------- | ---------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| <a id="property-manifest-1"></a> `manifest` | `readonly` | `object`                                         | [adapters/src/runtime.ts:28](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/runtime.ts#L28) |
| `manifest.id`                               | `public`   | `string`                                         | contracts/dist/runtime.d.ts:9                                                                                       |
| `manifest.metadata?`                        | `public`   | [`JsonObject`](sharedos-contracts.md#jsonobject) | contracts/dist/runtime.d.ts:12                                                                                      |
| `manifest.protocolVersion`                  | `public`   | `"1"`                                            | contracts/dist/runtime.d.ts:11                                                                                      |
| `manifest.version`                          | `public`   | `string`                                         | contracts/dist/runtime.d.ts:10                                                                                      |

#### Methods

##### run()

> **run**(`request`, `host`, `signal`): `Promise`\<\{ `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `output`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `type`: `"complete"`; \} \| \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `type`: `"fail"`; \} \| \{ `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `reason`: `string`; `type`: `"escalate"`; \}\>

Defined in: [adapters/src/runtime.ts:36](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/runtime.ts#L36)

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

### TranscriptTransport

Defined in: [adapters/src/transcript.ts:27](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/transcript.ts#L27)

Replays a recorded conversation through the real protocol translation.

This is how an adapter is verified without the vendor's CLI or credentials
present. The frames are the vendor's, the parsing is the adapter's, and the
only thing left unexercised is the transport that would have carried them.

#### Implements

- [`HarnessTransport`](#harnesstransport)

#### Constructors

##### Constructor

> **new TranscriptTransport**(`transcript`): [`TranscriptTransport`](#transcripttransport)

Defined in: [adapters/src/transcript.ts:32](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/transcript.ts#L32)

###### Parameters

| Parameter    | Type                                      |
| ------------ | ----------------------------------------- |
| `transcript` | [`HarnessTranscript`](#harnesstranscript) |

###### Returns

[`TranscriptTransport`](#transcripttransport)

#### Properties

| Property                                | Modifier   | Type                                               | Default value | Defined in                                                                                                                |
| --------------------------------------- | ---------- | -------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-opened"></a> `opened`   | `readonly` | [`HarnessTurnRequest`](#harnessturnrequest)[]      | `[]`          | [adapters/src/transcript.ts:28](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/transcript.ts#L28) |
| <a id="property-written"></a> `written` | `readonly` | [`JsonObject`](sharedos-contracts.md#jsonobject)[] | `[]`          | [adapters/src/transcript.ts:29](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/transcript.ts#L29) |

#### Methods

##### open()

> **open**(`request`): `Promise`\<[`HarnessChannel`](#harnesschannel)>\>

Defined in: [adapters/src/transcript.ts:39](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/transcript.ts#L39)

###### Parameters

| Parameter | Type                                        |
| --------- | ------------------------------------------- |
| `request` | [`HarnessTurnRequest`](#harnessturnrequest) |

###### Returns

`Promise`\<[`HarnessChannel`](#harnesschannel)\>

###### Implementation of

[`HarnessTransport`](#harnesstransport).[`open`](#open-2)

## Interfaces

### HarnessAvailability

Defined in: [adapters/src/harness.ts:80](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L80)

Whether a harness can actually be run here, and if not, why not.

#### Properties

| Property                                    | Modifier   | Type                                             | Defined in                                                                                                          |
| ------------------------------------------- | ---------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| <a id="property-available"></a> `available` | `readonly` | `boolean`                                        | [adapters/src/harness.ts:82](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L82) |
| <a id="property-detail"></a> `detail?`      | `readonly` | [`JsonObject`](sharedos-contracts.md#jsonobject) | [adapters/src/harness.ts:84](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L84) |
| <a id="property-harness"></a> `harness`     | `readonly` | `string`                                         | [adapters/src/harness.ts:81](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L81) |
| <a id="property-reason"></a> `reason?`      | `readonly` | `string`                                         | [adapters/src/harness.ts:83](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L83) |

---

### HarnessChannel

Defined in: [adapters/src/harness.ts:42](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L42)

One open harness turn. Reads and writes are frames, never SharedOS types.

#### Methods

##### close()

> **close**(): `Promise`\<`void`>\>

Defined in: [adapters/src/harness.ts:46](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L46)

###### Returns

`Promise`\<`void`\>

##### read()

> **read**(`signal`): `Promise`\<[`JsonObject`](sharedos-contracts.md#jsonobject) \| `undefined`>\>

Defined in: [adapters/src/harness.ts:44](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L44)

The next frame, or `undefined` once the harness has finished speaking.

###### Parameters

| Parameter | Type          |
| --------- | ------------- |
| `signal`  | `AbortSignal` |

###### Returns

`Promise`\<[`JsonObject`](sharedos-contracts.md#jsonobject) \| `undefined`\>

##### write()

> **write**(`frame`, `signal`): `Promise`\<`void`>\>

Defined in: [adapters/src/harness.ts:45](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L45)

###### Parameters

| Parameter | Type                                             |
| --------- | ------------------------------------------------ |
| `frame`   | [`JsonObject`](sharedos-contracts.md#jsonobject) |
| `signal`  | `AbortSignal`                                    |

###### Returns

`Promise`\<`void`\>

---

### HarnessDriverOptions

Defined in: [adapters/src/driver.ts:24](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/driver.ts#L24)

#### Properties

| Property                                                   | Modifier   | Type                                             | Description                                                        | Defined in                                                                                                        |
| ---------------------------------------------------------- | ---------- | ------------------------------------------------ | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| <a id="property-manifest-2"></a> `manifest`                | `readonly` | `object`                                         | -                                                                  | [adapters/src/driver.ts:25](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/driver.ts#L25) |
| `manifest.id`                                              | `public`   | `string`                                         | -                                                                  | contracts/dist/runtime.d.ts:9                                                                                     |
| `manifest.metadata?`                                       | `public`   | [`JsonObject`](sharedos-contracts.md#jsonobject) | -                                                                  | contracts/dist/runtime.d.ts:12                                                                                    |
| `manifest.protocolVersion`                                 | `public`   | `"1"`                                            | -                                                                  | contracts/dist/runtime.d.ts:11                                                                                    |
| `manifest.version`                                         | `public`   | `string`                                         | -                                                                  | contracts/dist/runtime.d.ts:10                                                                                    |
| <a id="property-maxignoredframes"></a> `maxIgnoredFrames?` | `readonly` | `number`                                         | Guard against a harness that streams unrelated frames without end. | [adapters/src/driver.ts:31](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/driver.ts#L31) |
| <a id="property-prompt"></a> `prompt?`                     | `readonly` | (`request`) => `string`                          | Overrides how the turn message becomes the harness prompt.         | [adapters/src/driver.ts:29](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/driver.ts#L29) |
| <a id="property-protocol"></a> `protocol`                  | `readonly` | [`HarnessProtocol`](#harnessprotocol)            | -                                                                  | [adapters/src/driver.ts:26](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/driver.ts#L26) |
| <a id="property-transport"></a> `transport`                | `readonly` | [`HarnessTransport`](#harnesstransport)          | -                                                                  | [adapters/src/driver.ts:27](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/driver.ts#L27) |

---

### HarnessFrameWriter

Defined in: [adapters/src/writer.ts:22](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/writer.ts#L22)

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

| Property                                      | Modifier   | Type     | Description                                                                | Defined in                                                                                                        |
| --------------------------------------------- | ---------- | -------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| <a id="property-protocolid"></a> `protocolId` | `readonly` | `string` | The protocol these frames belong to; must match the reading protocol's id. | [adapters/src/writer.ts:24](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/writer.ts#L24) |

#### Methods

##### complete()

> **complete**(`output?`): [`JsonObject`](sharedos-contracts.md#jsonobject)

Defined in: [adapters/src/writer.ts:27](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/writer.ts#L27)

###### Parameters

| Parameter | Type                                           |
| --------- | ---------------------------------------------- |
| `output?` | [`JsonValue`](sharedos-contracts.md#jsonvalue) |

###### Returns

[`JsonObject`](sharedos-contracts.md#jsonobject)

##### message()

> **message**(`text`): [`JsonObject`](sharedos-contracts.md#jsonobject)

Defined in: [adapters/src/writer.ts:26](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/writer.ts#L26)

###### Parameters

| Parameter | Type     |
| --------- | -------- |
| `text`    | `string` |

###### Returns

[`JsonObject`](sharedos-contracts.md#jsonobject)

##### toolCall()

> **toolCall**(`callId`, `tool`, `arguments_`): [`JsonObject`](sharedos-contracts.md#jsonobject)

Defined in: [adapters/src/writer.ts:25](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/writer.ts#L25)

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

Defined in: [adapters/src/harness.ts:66](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L66)

The translation between SharedOS and one vendor's wire shapes.

This is the whole adapter. Everything else -- the turn loop, per-call
re-authorization, the permission-filtered catalogue, audit -- is supplied by
the SharedOS execution envelope and is not reimplemented per vendor.

#### Properties

| Property                      | Modifier   | Type     | Defined in                                                                                                          |
| ----------------------------- | ---------- | -------- | ------------------------------------------------------------------------------------------------------------------- |
| <a id="property-id"></a> `id` | `readonly` | `string` | [adapters/src/harness.ts:67](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L67) |

#### Methods

##### describeTools()

> **describeTools**(`tools`): [`JsonValue`](sharedos-contracts.md#jsonvalue)

Defined in: [adapters/src/harness.ts:69](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L69)

Render the permission-filtered catalogue in the harness's own tool shape.

###### Parameters

| Parameter | Type                |
| --------- | ------------------- |
| `tools`   | readonly `object`[] |

###### Returns

[`JsonValue`](sharedos-contracts.md#jsonvalue)

##### encodeToolResult()

> **encodeToolResult**(`result`): [`JsonObject`](sharedos-contracts.md#jsonobject)

Defined in: [adapters/src/harness.ts:76](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L76)

###### Parameters

| Parameter | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `result`  | \{ `callId`: `string`; `completedAt`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `output`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `status`: `"succeeded"`; `tool`: `string`; \} \| \{ `callId`: `string`; `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"denied"`; `tool`: `string`; \} \| \{ `callId`: `string`; `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"failed"`; `tool`: `string`; \} |

###### Returns

[`JsonObject`](sharedos-contracts.md#jsonobject)

##### interpret()

> **interpret**(`frame`): readonly [`HarnessStep`](#harnessstep)[]

Defined in: [adapters/src/harness.ts:75](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L75)

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

Defined in: [adapters/src/harness.ts:88](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L88)

What a harness needs before it can run: an executable, credentials, or both.

#### Properties

| Property                                                        | Modifier   | Type                | Description                                                            | Defined in                                                                                                          |
| --------------------------------------------------------------- | ---------- | ------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| <a id="property-credentialsoptional"></a> `credentialsOptional` | `readonly` | `boolean`           | True when the harness can authenticate from a stored session instead.  | [adapters/src/harness.ts:95](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L95) |
| <a id="property-credentialvariables"></a> `credentialVariables` | `readonly` | readonly `string`[] | Environment variables, any one of which satisfies the credential need. | [adapters/src/harness.ts:93](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L93) |
| <a id="property-executable"></a> `executable`                   | `readonly` | `string`            | Executable expected on PATH.                                           | [adapters/src/harness.ts:91](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L91) |
| <a id="property-harness-1"></a> `harness`                       | `readonly` | `string`            | -                                                                      | [adapters/src/harness.ts:89](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L89) |

---

### HarnessTranscript

Defined in: [adapters/src/transcript.ts:16](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/transcript.ts#L16)

A recorded harness conversation.

Batches are released one tool result at a time: the first batch is emitted
when the turn opens, and each later batch is unlocked by the adapter writing
a result back. That is the shape of every tool-using harness, so a transcript
exercises the same code path a live session does.

#### Properties

| Property                                | Modifier   | Type                                                                   | Defined in                                                                                                                |
| --------------------------------------- | ---------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-batches"></a> `batches` | `readonly` | readonly readonly [`JsonObject`](sharedos-contracts.md#jsonobject)[][] | [adapters/src/transcript.ts:17](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/transcript.ts#L17) |

---

### HarnessTransport

Defined in: [adapters/src/harness.ts:55](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L55)

How a harness is reached: a subprocess, an HTTP session, or a recorded
transcript. Keeping this separate from the protocol is what lets one adapter
be exercised deterministically and then run live without changing the
translation code under test.

#### Methods

##### open()

> **open**(`request`, `signal`): `Promise`\<[`HarnessChannel`](#harnesschannel)>\>

Defined in: [adapters/src/harness.ts:56](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L56)

###### Parameters

| Parameter | Type                                        |
| --------- | ------------------------------------------- |
| `request` | [`HarnessTurnRequest`](#harnessturnrequest) |
| `signal`  | `AbortSignal`                               |

###### Returns

`Promise`\<[`HarnessChannel`](#harnesschannel)\>

---

### HarnessTurnRequest

Defined in: [adapters/src/harness.ts:31](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L31)

Everything a harness needs to start one turn.

#### Properties

| Property                                        | Modifier   | Type                                                                 | Description                                                            | Defined in                                                                                                          |
| ----------------------------------------------- | ---------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| <a id="property-context"></a> `context`         | `readonly` | [`RuntimeVisibleContext`](sharedos-runtime.md#runtimevisiblecontext) | The sanitised context. It carries no grants and no issuing authority.  | [adapters/src/harness.ts:37](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L37) |
| <a id="property-executionid"></a> `executionId` | `readonly` | `string`                                                             | -                                                                      | [adapters/src/harness.ts:32](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L32) |
| <a id="property-metadata"></a> `metadata?`      | `readonly` | [`JsonObject`](sharedos-contracts.md#jsonobject)                     | -                                                                      | [adapters/src/harness.ts:38](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L38) |
| <a id="property-prompt-1"></a> `prompt`         | `readonly` | `string`                                                             | -                                                                      | [adapters/src/harness.ts:33](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L33) |
| <a id="property-tools"></a> `tools`             | `readonly` | [`JsonValue`](sharedos-contracts.md#jsonvalue)                       | The permission-filtered catalogue, already in the harness's own shape. | [adapters/src/harness.ts:35](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L35) |

## Type Aliases

### ClaudeCodeDriverOptions

> **ClaudeCodeDriverOptions** = `Omit`\<[`HarnessDriverOptions`](#harnessdriveroptions), `"manifest"` \| `"protocol"`> \> & `object`

Defined in: [adapters/src/claude-code/index.ts:34](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/claude-code/index.ts#L34)

#### Type Declaration

##### manifest?

> `readonly` `optional` **manifest?**: [`RuntimeManifest`](sharedos-contracts.md#runtimemanifest)

##### transport

> `readonly` **transport**: [`HarnessTransport`](#harnesstransport)

---

### CodexDriverOptions

> **CodexDriverOptions** = `Omit`\<[`HarnessDriverOptions`](#harnessdriveroptions), `"manifest"` \| `"protocol"`> \> & `object`

Defined in: [adapters/src/codex/index.ts:34](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/codex/index.ts#L34)

#### Type Declaration

##### manifest?

> `readonly` `optional` **manifest?**: [`RuntimeManifest`](sharedos-contracts.md#runtimemanifest)

##### transport

> `readonly` **transport**: [`HarnessTransport`](#harnesstransport)

---

### DeepseekDriverOptions

> **DeepseekDriverOptions** = `Omit`\<[`HarnessDriverOptions`](#harnessdriveroptions), `"manifest"` \| `"protocol"`> \> & `object`

Defined in: [adapters/src/deepseek/index.ts:41](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/deepseek/index.ts#L41)

#### Type Declaration

##### manifest?

> `readonly` `optional` **manifest?**: [`RuntimeManifest`](sharedos-contracts.md#runtimemanifest)

##### transport

> `readonly` **transport**: [`HarnessTransport`](#harnesstransport)

---

### HarnessFrame

> **HarnessFrame** = [`JsonObject`](sharedos-contracts.md#jsonobject)

Defined in: [adapters/src/harness.ts:11](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L11)

One raw protocol frame, in whatever shape the harness speaks.

---

### HarnessStep

> **HarnessStep** = \{ `arguments`: [`JsonObject`](sharedos-contracts.md#jsonobject); `callId`: `string`; `tool`: `string`; `type`: `"tool_call"`; \} \| \{ `text`: `string`; `type`: `"message"`; \} \| \{ `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `output?`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `type`: `"complete"`; \} \| \{ `error`: [`ProtocolError`](sharedos-contracts.md#protocolerror); `type`: `"failed"`; \}

Defined in: [adapters/src/harness.ts:19](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/harness.ts#L19)

What one frame means once the vendor protocol has interpreted it.

`message` is assistant prose. It is kept rather than discarded so a harness
whose terminal frame carries no text still produces a turn output.

---

### PiDriverOptions

> **PiDriverOptions** = `Omit`\<[`HarnessDriverOptions`](#harnessdriveroptions), `"manifest"` \| `"protocol"`> \> & `object`

Defined in: [adapters/src/pi/index.ts:45](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/pi/index.ts#L45)

#### Type Declaration

##### manifest?

> `readonly` `optional` **manifest?**: [`RuntimeManifest`](sharedos-contracts.md#runtimemanifest)

##### transport

> `readonly` **transport**: [`HarnessTransport`](#harnesstransport)

## Variables

### CLAUDE\_CODE\_ADAPTER\_VERSION

> `const` **CLAUDE\_CODE\_ADAPTER\_VERSION**: `"0.1.0-alpha.0"` = `"0.1.0-alpha.0"`

Defined in: [adapters/src/claude-code/index.ts:11](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/claude-code/index.ts#L11)

---

### CLAUDE\_CODE\_PROTOCOL\_ID

> `const` **CLAUDE\_CODE\_PROTOCOL\_ID**: `"anthropic.messages.stream-json"` = `"anthropic.messages.stream-json"`

Defined in: [adapters/src/claude-code/protocol.ts:15](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/claude-code/protocol.ts#L15)

Claude Code speaks Anthropic message content blocks inside a stream-json
envelope.

The content blocks -- `tool_use`, `tool_result`, `text` -- are the stable
part and are what this module translates. The `{type:"assistant"|"user"|
"result"}` envelope is the CLI's `--output-format stream-json` framing.

---

### CLAUDE\_CODE\_REQUIREMENTS

> `const` **CLAUDE\_CODE\_REQUIREMENTS**: [`HarnessRequirements`](#harnessrequirements)

Defined in: [adapters/src/claude-code/index.ts:26](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/claude-code/index.ts#L26)

What a live Claude Code session needs before it can run.

---

### CLAUDE\_CODE\_RUNTIME\_MANIFEST

> `const` **CLAUDE\_CODE\_RUNTIME\_MANIFEST**: [`RuntimeManifest`](sharedos-contracts.md#runtimemanifest)

Defined in: [adapters/src/claude-code/index.ts:13](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/claude-code/index.ts#L13)

---

### claudeCodeFrameWriter

> `const` **claudeCodeFrameWriter**: [`HarnessFrameWriter`](#harnessframewriter)

Defined in: [adapters/src/writer.ts:58](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/writer.ts#L58)

Frames in the Anthropic content-block shape Claude Code speaks.

---

### claudeCodeProtocol

> `const` **claudeCodeProtocol**: [`HarnessProtocol`](#harnessprotocol)

Defined in: [adapters/src/claude-code/protocol.ts:48](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/claude-code/protocol.ts#L48)

---

### CODEX\_ADAPTER\_VERSION

> `const` **CODEX\_ADAPTER\_VERSION**: `"0.1.0-alpha.0"` = `"0.1.0-alpha.0"`

Defined in: [adapters/src/codex/index.ts:11](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/codex/index.ts#L11)

---

### CODEX\_PROTOCOL\_ID

> `const` **CODEX\_PROTOCOL\_ID**: `"openai.responses.function-calling"` = `"openai.responses.function-calling"`

Defined in: [adapters/src/codex/protocol.ts:15](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/codex/protocol.ts#L15)

Codex speaks the OpenAI Responses function-calling shape.

That is the layer this module targets: function tool declarations,
`function_call` items, and `function_call_output` results. It is deliberately
not the Codex CLI's own event envelope, which differs between releases. What
carries these frames -- the CLI in JSON mode, the Codex SDK, or a direct
Responses call -- is the transport's problem, not the protocol's.

---

### CODEX\_REQUIREMENTS

> `const` **CODEX\_REQUIREMENTS**: [`HarnessRequirements`](#harnessrequirements)

Defined in: [adapters/src/codex/index.ts:26](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/codex/index.ts#L26)

What a live Codex session needs before it can run.

---

### CODEX\_RUNTIME\_MANIFEST

> `const` **CODEX\_RUNTIME\_MANIFEST**: [`RuntimeManifest`](sharedos-contracts.md#runtimemanifest)

Defined in: [adapters/src/codex/index.ts:13](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/codex/index.ts#L13)

---

### codexFrameWriter

> `const` **codexFrameWriter**: [`HarnessFrameWriter`](#harnessframewriter)

Defined in: [adapters/src/writer.ts:31](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/writer.ts#L31)

Frames in the OpenAI Responses function-calling shape Codex speaks.

---

### codexProtocol

> `const` **codexProtocol**: [`HarnessProtocol`](#harnessprotocol)

Defined in: [adapters/src/codex/protocol.ts:63](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/codex/protocol.ts#L63)

---

### DEEPSEEK\_ADAPTER\_VERSION

> `const` **DEEPSEEK\_ADAPTER\_VERSION**: `"0.1.0-alpha.0"` = `"0.1.0-alpha.0"`

Defined in: [adapters/src/deepseek/index.ts:11](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/deepseek/index.ts#L11)

---

### DEEPSEEK\_PROTOCOL\_ID

> `const` **DEEPSEEK\_PROTOCOL\_ID**: `"deepseek.harness.session-events"` = `"deepseek.harness.session-events"`

Defined in: [adapters/src/deepseek/protocol.ts:26](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/deepseek/protocol.ts#L26)

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

Defined in: [adapters/src/deepseek/index.ts:33](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/deepseek/index.ts#L33)

What a live DeepSeek Harness session needs before it can run.

---

### DEEPSEEK\_RUNTIME\_MANIFEST

> `const` **DEEPSEEK\_RUNTIME\_MANIFEST**: [`RuntimeManifest`](sharedos-contracts.md#runtimemanifest)

Defined in: [adapters/src/deepseek/index.ts:13](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/deepseek/index.ts#L13)

---

### deepseekFrameWriter

> `const` **deepseekFrameWriter**: [`HarnessFrameWriter`](#harnessframewriter)

Defined in: [adapters/src/writer.ts:92](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/writer.ts#L92)

Frames in the session-log shape DeepSeek Harness streams.

Wrapped in their `session.event` notification rather than left bare, because
that is the shape a live SDK runtime emits and a fixture that skipped the
envelope would exercise only half of what the parser has to accept.

---

### deepseekProtocol

> `const` **deepseekProtocol**: [`HarnessProtocol`](#harnessprotocol)

Defined in: [adapters/src/deepseek/protocol.ts:106](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/deepseek/protocol.ts#L106)

---

### PI\_ADAPTER\_VERSION

> `const` **PI\_ADAPTER\_VERSION**: `"0.1.0-alpha.0"` = `"0.1.0-alpha.0"`

Defined in: [adapters/src/pi/index.ts:11](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/pi/index.ts#L11)

---

### PI\_PROTOCOL\_ID

> `const` **PI\_PROTOCOL\_ID**: `"pi.rpc.jsonl"` = `"pi.rpc.jsonl"`

Defined in: [adapters/src/pi/protocol.ts:29](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/pi/protocol.ts#L29)

Pi speaks newline-delimited JSON events in its RPC mode (`pi --mode rpc`).

The message vocabulary is the layer this module targets: an `AssistantMessage`
whose content carries `toolCall` blocks, a `ToolResultMessage` carrying the
result back, and the `agent_end` / `response` frames that end a turn. It is
deliberately not Pi's streaming delta events, which restate the same content
token by token; Pi's own guidance is to treat the assembled message as
authoritative, and reading both would issue every call twice.

Two asymmetries are worth stating plainly, because both are properties of the
harness rather than of this adapter:

- Pi does not declare tools on the RPC wire, and has no MCP support at all.
  Its path for a host-supplied tool is `defineTool` through the SDK or an
  extension, so [HarnessProtocol.describeTools](#describetools) renders that shape and no frame is
  emitted for it.
- Pi executes its own tools. `tool_execution_start` announces a call Pi is
  already running, not a request for the host to run one, so it is not read
  as a tool call. The `toolCall` content block -- the model's actual request
  -- is.

---

### PI\_REQUIREMENTS

> `const` **PI\_REQUIREMENTS**: [`HarnessRequirements`](#harnessrequirements)

Defined in: [adapters/src/pi/index.ts:33](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/pi/index.ts#L33)

What a live Pi session needs before it can run.

---

### PI\_RUNTIME\_MANIFEST

> `const` **PI\_RUNTIME\_MANIFEST**: [`RuntimeManifest`](sharedos-contracts.md#runtimemanifest)

Defined in: [adapters/src/pi/index.ts:13](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/pi/index.ts#L13)

---

### piFrameWriter

> `const` **piFrameWriter**: [`HarnessFrameWriter`](#harnessframewriter)

Defined in: [adapters/src/writer.ts:135](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/writer.ts#L135)

Frames in the RPC message shape Pi speaks.

---

### piProtocol

> `const` **piProtocol**: [`HarnessProtocol`](#harnessprotocol)

Defined in: [adapters/src/pi/protocol.ts:85](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/pi/protocol.ts#L85)

## Functions

### createClaudeCodeDriver()

> **createClaudeCodeDriver**(`options`): [`HarnessDriver`](#harnessdriver)

Defined in: [adapters/src/claude-code/index.ts:46](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/claude-code/index.ts#L46)

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

Defined in: [adapters/src/claude-code/index.ts:61](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/claude-code/index.ts#L61)

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

Defined in: [adapters/src/codex/index.ts:46](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/codex/index.ts#L46)

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

Defined in: [adapters/src/codex/index.ts:61](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/codex/index.ts#L61)

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

Defined in: [adapters/src/deepseek/index.ts:53](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/deepseek/index.ts#L53)

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

Defined in: [adapters/src/deepseek/index.ts:68](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/deepseek/index.ts#L68)

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

Defined in: [adapters/src/pi/index.ts:57](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/pi/index.ts#L57)

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

Defined in: [adapters/src/pi/index.ts:72](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/pi/index.ts#L72)

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
