[**SharedOS API v0.1.0-alpha.0**](README.md)

---

[SharedOS API](README.md) / @aicoo/sharedos-adapters

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

> **run**(`request`, `host`, `signal`): `Promise`\<\{ `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `output`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `type`: `"complete"`; \} \| \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `type`: `"fail"`; \}\>

Defined in: [adapters/src/runtime.ts:36](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/runtime.ts#L36)

###### Parameters

| Parameter | Type                                                           |
| --------- | -------------------------------------------------------------- |
| `request` | [`RuntimeTurnRequest`](sharedos-runtime.md#runtimeturnrequest) |
| `host`    | [`RuntimeHost`](sharedos-runtime.md#runtimehost)               |
| `signal`  | `AbortSignal`                                                  |

###### Returns

`Promise`\<\{ `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `output`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `type`: `"complete"`; \} \| \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `type`: `"fail"`; \}\>

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

### codexProtocol

> `const` **codexProtocol**: [`HarnessProtocol`](#harnessprotocol)

Defined in: [adapters/src/codex/protocol.ts:53](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/codex/protocol.ts#L53)

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
