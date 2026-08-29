[**SharedOS API v0.1.0-alpha.3**](README.md)

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
| `HarnessTransport` | How the harness is reached: a subprocess, an HTTP session, a supplied transcript  |
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

The translation code is exercised end to end against supplied transcripts, which
run the real protocol modules through a real kernel and a real execution
envelope. Nothing in this package captures a vendor session: a transcript is
whatever its caller hands it, and the conformance suite writes its own. `TranscriptTransport` replays vendor frames batch by batch, releasing
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

Defined in: [packages/adapters/src/driver.ts:50](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/driver.ts#L50)

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

Defined in: [packages/adapters/src/driver.ts:57](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/driver.ts#L57)

###### Parameters

| Parameter | Type                                            |
| --------- | ----------------------------------------------- |
| `options` | [`HarnessDriverOptions`](#harnessdriveroptions) |

###### Returns

[`HarnessDriver`](#harnessdriver)

#### Properties

| Property                                  | Modifier   | Type                                             | Defined in                                                                                                                 |
| ----------------------------------------- | ---------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-manifest"></a> `manifest` | `readonly` | `object`                                         | [packages/adapters/src/driver.ts:51](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/driver.ts#L51) |
| `manifest.id`                             | `public`   | `string`                                         | packages/contracts/dist/runtime.d.ts:9                                                                                     |
| `manifest.metadata?`                      | `public`   | [`JsonObject`](sharedos-contracts.md#jsonobject) | packages/contracts/dist/runtime.d.ts:12                                                                                    |
| `manifest.protocolVersion`                | `public`   | `"1"`                                            | packages/contracts/dist/runtime.d.ts:11                                                                                    |
| `manifest.version`                        | `public`   | `string`                                         | packages/contracts/dist/runtime.d.ts:10                                                                                    |

#### Methods

##### open()

> **open**(`request`, `signal`): `Promise`\<[`AgentTurnSession`](sharedos-runtime.md#agentturnsession)>\>

Defined in: [packages/adapters/src/driver.ts:68](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/driver.ts#L68)

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

Defined in: [packages/adapters/src/runtime.ts:27](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/runtime.ts#L27)

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

Defined in: [packages/adapters/src/runtime.ts:31](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/runtime.ts#L31)

###### Parameters

| Parameter | Type                                                                   |
| --------- | ---------------------------------------------------------------------- |
| `driver`  | [`HarnessDriver`](#harnessdriver)                                      |
| `options` | [`StandardRuntimeOptions`](sharedos-runtime.md#standardruntimeoptions) |

###### Returns

[`HarnessRuntime`](#harnessruntime)

#### Properties

| Property                                    | Modifier   | Type                                             | Defined in                                                                                                                   |
| ------------------------------------------- | ---------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-manifest-1"></a> `manifest` | `readonly` | `object`                                         | [packages/adapters/src/runtime.ts:28](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/runtime.ts#L28) |
| `manifest.id`                               | `public`   | `string`                                         | packages/contracts/dist/runtime.d.ts:9                                                                                       |
| `manifest.metadata?`                        | `public`   | [`JsonObject`](sharedos-contracts.md#jsonobject) | packages/contracts/dist/runtime.d.ts:12                                                                                      |
| `manifest.protocolVersion`                  | `public`   | `"1"`                                            | packages/contracts/dist/runtime.d.ts:11                                                                                      |
| `manifest.version`                          | `public`   | `string`                                         | packages/contracts/dist/runtime.d.ts:10                                                                                      |

#### Methods

##### run()

> **run**(`request`, `host`, `signal`): `Promise`\<\{ `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `output`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `type`: `"complete"`; \} \| \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `type`: `"fail"`; \} \| \{ `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `reason`: `string`; `type`: `"escalate"`; \}\>

Defined in: [packages/adapters/src/runtime.ts:36](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/runtime.ts#L36)

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

### ModelDriver

Defined in: [packages/adapters/src/model/driver.ts:126](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/driver.ts#L126)

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

Defined in: [packages/adapters/src/model/driver.ts:132](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/driver.ts#L132)

###### Parameters

| Parameter | Type                                        |
| --------- | ------------------------------------------- |
| `options` | [`ModelDriverOptions`](#modeldriveroptions) |

###### Returns

[`ModelDriver`](#modeldriver)

#### Properties

| Property                                    | Modifier   | Type                                             | Defined in                                                                                                                               |
| ------------------------------------------- | ---------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-manifest-2"></a> `manifest` | `readonly` | `object`                                         | [packages/adapters/src/model/driver.ts:127](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/driver.ts#L127) |
| `manifest.id`                               | `public`   | `string`                                         | packages/contracts/dist/runtime.d.ts:9                                                                                                   |
| `manifest.metadata?`                        | `public`   | [`JsonObject`](sharedos-contracts.md#jsonobject) | packages/contracts/dist/runtime.d.ts:12                                                                                                  |
| `manifest.protocolVersion`                  | `public`   | `"1"`                                            | packages/contracts/dist/runtime.d.ts:11                                                                                                  |
| `manifest.version`                          | `public`   | `string`                                         | packages/contracts/dist/runtime.d.ts:10                                                                                                  |

#### Methods

##### open()

> **open**(`request`, `_signal`): `Promise`\<[`AgentTurnSession`](sharedos-runtime.md#agentturnsession)>\>

Defined in: [packages/adapters/src/model/driver.ts:142](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/driver.ts#L142)

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

### ModelRequestError

Defined in: [packages/adapters/src/model/client.ts:98](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L98)

A model call that did not produce an answer. Carries no response body.

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new ModelRequestError**(`message`, `status?`): [`ModelRequestError`](#modelrequesterror)

Defined in: [packages/adapters/src/model/client.ts:101](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L101)

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

| Property                                                | Modifier   | Type      | Description                                                                                                                                                                                                                                                                                                                                                                                                                                       | Inherited from          | Defined in                                                                                                                             |
| ------------------------------------------------------- | ---------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-cause"></a> `cause?`                    | `public`   | `unknown` | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `Error.cause`           | node\_modules/.pnpm/typescript@5.9.3/node\_modules/typescript/lib/lib.es2022.error.d.ts:26                                             |
| <a id="property-message"></a> `message`                 | `public`   | `string`  | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `Error.message`         | node\_modules/.pnpm/typescript@5.9.3/node\_modules/typescript/lib/lib.es5.d.ts:1077                                                    |
| <a id="property-name"></a> `name`                       | `public`   | `string`  | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `Error.name`            | node\_modules/.pnpm/typescript@5.9.3/node\_modules/typescript/lib/lib.es5.d.ts:1076                                                    |
| <a id="property-stack"></a> `stack?`                    | `public`   | `string`  | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `Error.stack`           | node\_modules/.pnpm/typescript@5.9.3/node\_modules/typescript/lib/lib.es5.d.ts:1078                                                    |
| <a id="property-status"></a> `status?`                  | `readonly` | `number`  | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | -                       | [packages/adapters/src/model/client.ts:99](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L99) |
| <a id="property-stacktracelimit"></a> `stackTraceLimit` | `static`   | `number`  | The `Error.stackTraceLimit` property specifies the number of stack frames collected by a stack trace (whether generated by `new Error().stack` or `Error.captureStackTrace(obj)`). The default value is `10` but may be set to any valid JavaScript number. Changes will affect any stack trace captured _after_ the value has been changed. If set to a non-number value, or set to a negative number, stack traces will not capture any frames. | `Error.stackTraceLimit` | node\_modules/.pnpm/@types+node@22.20.1/node\_modules/@types/node/globals.d.ts:68                                                      |

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

Defined in: [packages/adapters/src/model/runtime.ts:25](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/runtime.ts#L25)

A model driver installed as a runtime under its own identity.

The same arrangement [HarnessRuntime](#harnessruntime) makes, for the same reason: the
executor stamps the plugin's manifest onto every execution record, so a model
turn wrapped in `StandardRuntime` alone would file its evidence under the
standard runtime and a column comparing models would be unable to say which
one produced which record.

The loop is unchanged. `StandardRuntime` still owns the steps, still stops at
`maxSteps`, and still re-authorizes every call -- which is the property that
distinguishes this column from one where a vendor CLI owns the loop.

#### Implements

- [`RuntimePlugin`](sharedos-runtime.md#runtimeplugin)

#### Constructors

##### Constructor

> **new ModelRuntime**(`driver`, `options?`): [`ModelRuntime`](#modelruntime)

Defined in: [packages/adapters/src/model/runtime.ts:29](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/runtime.ts#L29)

###### Parameters

| Parameter | Type                                                                   |
| --------- | ---------------------------------------------------------------------- |
| `driver`  | [`ModelDriver`](#modeldriver)                                          |
| `options` | [`StandardRuntimeOptions`](sharedos-runtime.md#standardruntimeoptions) |

###### Returns

[`ModelRuntime`](#modelruntime)

#### Properties

| Property                                    | Modifier   | Type                                             | Defined in                                                                                                                               |
| ------------------------------------------- | ---------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-manifest-3"></a> `manifest` | `readonly` | `object`                                         | [packages/adapters/src/model/runtime.ts:26](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/runtime.ts#L26) |
| `manifest.id`                               | `public`   | `string`                                         | packages/contracts/dist/runtime.d.ts:9                                                                                                   |
| `manifest.metadata?`                        | `public`   | [`JsonObject`](sharedos-contracts.md#jsonobject) | packages/contracts/dist/runtime.d.ts:12                                                                                                  |
| `manifest.protocolVersion`                  | `public`   | `"1"`                                            | packages/contracts/dist/runtime.d.ts:11                                                                                                  |
| `manifest.version`                          | `public`   | `string`                                         | packages/contracts/dist/runtime.d.ts:10                                                                                                  |

#### Methods

##### run()

> **run**(`request`, `host`, `signal`): `Promise`\<\{ `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `output`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `type`: `"complete"`; \} \| \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `type`: `"fail"`; \} \| \{ `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `reason`: `string`; `type`: `"escalate"`; \}\>

Defined in: [packages/adapters/src/model/runtime.ts:34](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/runtime.ts#L34)

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

### OpenAiCompatibleModelClient

Defined in: [packages/adapters/src/model/client.ts:196](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L196)

A chat-completions client for any provider speaking the OpenAI wire shape.

DeepSeek is the one this was built against, but nothing here is DeepSeek
specific: the endpoint, model, and provider label are all supplied, so
pointing the column at another compatible provider is configuration rather
than a second client.

#### Implements

- [`ModelClient`](#modelclient)

#### Constructors

##### Constructor

> **new OpenAiCompatibleModelClient**(`options`): [`OpenAiCompatibleModelClient`](#openaicompatiblemodelclient)

Defined in: [packages/adapters/src/model/client.ts:206](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L206)

###### Parameters

| Parameter | Type                                                                        |
| --------- | --------------------------------------------------------------------------- |
| `options` | [`OpenAiCompatibleModelClientOptions`](#openaicompatiblemodelclientoptions) |

###### Returns

[`OpenAiCompatibleModelClient`](#openaicompatiblemodelclient)

#### Properties

| Property                                  | Modifier   | Type     | Description                                                              | Defined in                                                                                                                               |
| ----------------------------------------- | ---------- | -------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-model"></a> `model`       | `readonly` | `string` | The model this client was configured to ask for.                         | [packages/adapters/src/model/client.ts:197](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L197) |
| <a id="property-provider"></a> `provider` | `readonly` | `string` | The provider that serves it, recorded alongside the model on every turn. | [packages/adapters/src/model/client.ts:198](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L198) |

#### Methods

##### complete()

> **complete**(`request`, `signal`): `Promise`\<[`ModelReply`](#modelreply)>\>

Defined in: [packages/adapters/src/model/client.ts:220](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L220)

###### Parameters

| Parameter | Type                                                |
| --------- | --------------------------------------------------- |
| `request` | [`ModelCompletionRequest`](#modelcompletionrequest) |
| `signal`  | `AbortSignal`                                       |

###### Returns

`Promise`\<[`ModelReply`](#modelreply)\>

###### Implementation of

[`ModelClient`](#modelclient).[`complete`](#complete-2)

---

### ToolNameCodec

Defined in: [packages/adapters/src/model/driver.ts:52](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/driver.ts#L52)

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

Defined in: [packages/adapters/src/model/driver.ts:56](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/driver.ts#L56)

###### Parameters

| Parameter | Type                |
| --------- | ------------------- |
| `tools`   | readonly `object`[] |

###### Returns

[`ToolNameCodec`](#toolnamecodec)

#### Methods

##### fromWire()

> **fromWire**(`name`): `string`

Defined in: [packages/adapters/src/model/driver.ts:82](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/driver.ts#L82)

###### Parameters

| Parameter | Type     |
| --------- | -------- |
| `name`    | `string` |

###### Returns

`string`

##### toWire()

> **toWire**(`name`): `string`

Defined in: [packages/adapters/src/model/driver.ts:78](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/driver.ts#L78)

###### Parameters

| Parameter | Type     |
| --------- | -------- |
| `name`    | `string` |

###### Returns

`string`

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

Defined in: [packages/adapters/src/driver.ts:24](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/driver.ts#L24)

#### Properties

| Property                                                   | Modifier   | Type                                             | Description                                                        | Defined in                                                                                                                 |
| ---------------------------------------------------------- | ---------- | ------------------------------------------------ | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-manifest-4"></a> `manifest`                | `readonly` | `object`                                         | -                                                                  | [packages/adapters/src/driver.ts:25](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/driver.ts#L25) |
| `manifest.id`                                              | `public`   | `string`                                         | -                                                                  | packages/contracts/dist/runtime.d.ts:9                                                                                     |
| `manifest.metadata?`                                       | `public`   | [`JsonObject`](sharedos-contracts.md#jsonobject) | -                                                                  | packages/contracts/dist/runtime.d.ts:12                                                                                    |
| `manifest.protocolVersion`                                 | `public`   | `"1"`                                            | -                                                                  | packages/contracts/dist/runtime.d.ts:11                                                                                    |
| `manifest.version`                                         | `public`   | `string`                                         | -                                                                  | packages/contracts/dist/runtime.d.ts:10                                                                                    |
| <a id="property-maxignoredframes"></a> `maxIgnoredFrames?` | `readonly` | `number`                                         | Guard against a harness that streams unrelated frames without end. | [packages/adapters/src/driver.ts:31](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/driver.ts#L31) |
| <a id="property-prompt"></a> `prompt?`                     | `readonly` | (`request`) => `string`                          | Overrides how the turn message becomes the harness prompt.         | [packages/adapters/src/driver.ts:29](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/driver.ts#L29) |
| <a id="property-protocol"></a> `protocol`                  | `readonly` | [`HarnessProtocol`](#harnessprotocol)            | -                                                                  | [packages/adapters/src/driver.ts:26](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/driver.ts#L26) |
| <a id="property-transport"></a> `transport`                | `readonly` | [`HarnessTransport`](#harnesstransport)          | -                                                                  | [packages/adapters/src/driver.ts:27](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/driver.ts#L27) |

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

Defined in: [packages/adapters/src/model/client.ts:89](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L89)

A model API in the SharedOS driver seat.

Deliberately narrower than any provider SDK: one call, tools in, tool calls
out. Everything that decides whether a call is allowed to happen -- the
catalogue, the turn loop, per-call re-authorization, audit -- stays in the
execution envelope, so a second provider is a second implementation of this
interface and no new enforcement path.

#### Properties

| Property                                    | Modifier   | Type     | Description                                                              | Defined in                                                                                                                             |
| ------------------------------------------- | ---------- | -------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-model-1"></a> `model`       | `readonly` | `string` | The model this client was configured to ask for.                         | [packages/adapters/src/model/client.ts:91](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L91) |
| <a id="property-provider-1"></a> `provider` | `readonly` | `string` | The provider that serves it, recorded alongside the model on every turn. | [packages/adapters/src/model/client.ts:93](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L93) |

#### Methods

##### complete()

> **complete**(`request`, `signal`): `Promise`\<[`ModelReply`](#modelreply)>\>

Defined in: [packages/adapters/src/model/client.ts:94](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L94)

###### Parameters

| Parameter | Type                                                |
| --------- | --------------------------------------------------- |
| `request` | [`ModelCompletionRequest`](#modelcompletionrequest) |
| `signal`  | `AbortSignal`                                       |

###### Returns

`Promise`\<[`ModelReply`](#modelreply)\>

---

### ModelCompletionRequest

Defined in: [packages/adapters/src/model/client.ts:42](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L42)

#### Properties

| Property                                  | Modifier   | Type                                       | Defined in                                                                                                                             |
| ----------------------------------------- | ---------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-messages"></a> `messages` | `readonly` | readonly [`ModelMessage`](#modelmessage)[] | [packages/adapters/src/model/client.ts:43](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L43) |
| <a id="property-tools-1"></a> `tools`     | `readonly` | readonly [`ModelTool`](#modeltool)[]       | [packages/adapters/src/model/client.ts:44](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L44) |

---

### ModelDriverOptions

Defined in: [packages/adapters/src/model/driver.ts:87](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/driver.ts#L87)

#### Properties

| Property                                                     | Modifier   | Type                                             | Description                                                                                                                                                                                                                                                                                                                    | Defined in                                                                                                                               |
| ------------------------------------------------------------ | ---------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-client"></a> `client`                        | `readonly` | [`ModelClient`](#modelclient)                    | -                                                                                                                                                                                                                                                                                                                              | [packages/adapters/src/model/driver.ts:89](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/driver.ts#L89)   |
| <a id="property-manifest-5"></a> `manifest`                  | `readonly` | `object`                                         | -                                                                                                                                                                                                                                                                                                                              | [packages/adapters/src/model/driver.ts:88](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/driver.ts#L88)   |
| `manifest.id`                                                | `public`   | `string`                                         | -                                                                                                                                                                                                                                                                                                                              | packages/contracts/dist/runtime.d.ts:9                                                                                                   |
| `manifest.metadata?`                                         | `public`   | [`JsonObject`](sharedos-contracts.md#jsonobject) | -                                                                                                                                                                                                                                                                                                                              | packages/contracts/dist/runtime.d.ts:12                                                                                                  |
| `manifest.protocolVersion`                                   | `public`   | `"1"`                                            | -                                                                                                                                                                                                                                                                                                                              | packages/contracts/dist/runtime.d.ts:11                                                                                                  |
| `manifest.version`                                           | `public`   | `string`                                         | -                                                                                                                                                                                                                                                                                                                              | packages/contracts/dist/runtime.d.ts:10                                                                                                  |
| <a id="property-maxmalformedcalls"></a> `maxMalformedCalls?` | `readonly` | `number`                                         | Guard against a model that never forms a readable call. A call whose arguments do not parse is refused by the driver and answered back to the model, which costs the turn no step; a model that kept producing them would otherwise be spoken to until the turn timed out. Past this many in one turn, the turn fails instead. | [packages/adapters/src/model/driver.ts:100](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/driver.ts#L100) |
| <a id="property-prompt-2"></a> `prompt?`                     | `readonly` | (`request`) => `string`                          | Overrides how the turn message becomes the model's prompt.                                                                                                                                                                                                                                                                     | [packages/adapters/src/model/driver.ts:91](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/driver.ts#L91)   |

---

### ModelReply

Defined in: [packages/adapters/src/model/client.ts:54](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L54)

What the model answered with.

#### Properties

| Property                                           | Modifier   | Type                                         | Description                                                                                                                                                                                                                                                                                                                                                                                                                               | Defined in                                                                                                                             |
| -------------------------------------------------- | ---------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-finishreason"></a> `finishReason?` | `readonly` | `string`                                     | Why generation stopped, in the provider's own vocabulary. `stop` and `tool_calls` are the model ending its reply; `length` is the provider ending it at the output-token ceiling. Carried because the two are different facts about the same reply: a completion that was cut off mid-way looks, without this, exactly like a completion the model chose to end, and a record whose purpose is honest attribution has to tell them apart. | [packages/adapters/src/model/client.ts:66](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L66) |
| <a id="property-model-2"></a> `model?`             | `readonly` | `string`                                     | The model the provider says actually answered. Recorded separately from the one that was asked for because they differ: DeepSeek maps an unrecognised name onto a default rather than rejecting it, so a run configured for one model can be served by another. The record should say what answered, which is the weaker claim and the honest one.                                                                                        | [packages/adapters/src/model/client.ts:77](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L77) |
| <a id="property-text"></a> `text`                  | `readonly` | `string`                                     | -                                                                                                                                                                                                                                                                                                                                                                                                                                         | [packages/adapters/src/model/client.ts:55](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L55) |
| <a id="property-toolcalls"></a> `toolCalls`        | `readonly` | readonly [`ModelToolCall`](#modeltoolcall)[] | -                                                                                                                                                                                                                                                                                                                                                                                                                                         | [packages/adapters/src/model/client.ts:56](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L56) |
| <a id="property-usage"></a> `usage?`               | `readonly` | [`ModelUsage`](#modelusage)                  | Absent when the provider reported no usage; never estimated.                                                                                                                                                                                                                                                                                                                                                                              | [packages/adapters/src/model/client.ts:68](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L68) |

---

### ModelTool

Defined in: [packages/adapters/src/model/client.ts:19](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L19)

A tool offered to the model, already rendered into the provider's alphabet.

#### Properties

| Property                                        | Modifier   | Type                                             | Defined in                                                                                                                             |
| ----------------------------------------------- | ---------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-description"></a> `description` | `readonly` | `string`                                         | [packages/adapters/src/model/client.ts:21](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L21) |
| <a id="property-name-1"></a> `name`             | `readonly` | `string`                                         | [packages/adapters/src/model/client.ts:20](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L20) |
| <a id="property-parameters"></a> `parameters`   | `readonly` | [`JsonObject`](sharedos-contracts.md#jsonobject) | [packages/adapters/src/model/client.ts:22](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L22) |

---

### ModelToolCall

Defined in: [packages/adapters/src/model/client.ts:12](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L12)

One tool call a model asked for, exactly as it came off the wire.

The name is the provider's alphabet, not SharedOS's, and the arguments are
still an unparsed string. Neither is normalised here: a client's job is to
carry what the model said, and deciding what an unparseable argument blob or
an unrecognised name means is a policy question that belongs to the driver.

#### Properties

| Property                                    | Modifier   | Type     | Defined in                                                                                                                             |
| ------------------------------------------- | ---------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-arguments"></a> `arguments` | `readonly` | `string` | [packages/adapters/src/model/client.ts:15](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L15) |
| <a id="property-id-1"></a> `id`             | `readonly` | `string` | [packages/adapters/src/model/client.ts:13](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L13) |
| <a id="property-name-2"></a> `name`         | `readonly` | `string` | [packages/adapters/src/model/client.ts:14](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L14) |

---

### ModelUsage

Defined in: [packages/adapters/src/model/client.ts:48](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L48)

What a provider billed for one reply, when it said.

#### Properties

| Property                                           | Modifier   | Type     | Defined in                                                                                                                             |
| -------------------------------------------------- | ---------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-inputtokens"></a> `inputTokens?`   | `readonly` | `number` | [packages/adapters/src/model/client.ts:49](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L49) |
| <a id="property-outputtokens"></a> `outputTokens?` | `readonly` | `number` | [packages/adapters/src/model/client.ts:50](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L50) |

---

### OpenAiCompatibleModelClientOptions

Defined in: [packages/adapters/src/model/client.ts:148](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L148)

#### Properties

| Property                                                   | Modifier   | Type                                                                                           | Description                                                                                                                                                                                                                                                                              | Defined in                                                                                                                               |
| ---------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-apikey"></a> `apiKey`                      | `readonly` | `string`                                                                                       | -                                                                                                                                                                                                                                                                                        | [packages/adapters/src/model/client.ts:149](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L149) |
| <a id="property-baseurl"></a> `baseUrl`                    | `readonly` | `string`                                                                                       | The chat-completions root, without a trailing slash.                                                                                                                                                                                                                                     | [packages/adapters/src/model/client.ts:154](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L154) |
| <a id="property-fetch"></a> `fetch?`                       | `readonly` | \{(`input`, `init?`): `Promise`\<`Response`\>; (`input`, `init?`): `Promise`\<`Response`\>; \} | Injected for tests, which must never reach a network.                                                                                                                                                                                                                                    | [packages/adapters/src/model/client.ts:166](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L166) |
| <a id="property-maxoutputtokens"></a> `maxOutputTokens?`   | `readonly` | `number`                                                                                       | -                                                                                                                                                                                                                                                                                        | [packages/adapters/src/model/client.ts:155](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L155) |
| <a id="property-model-3"></a> `model`                      | `readonly` | `string`                                                                                       | -                                                                                                                                                                                                                                                                                        | [packages/adapters/src/model/client.ts:150](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L150) |
| <a id="property-provider-2"></a> `provider`                | `readonly` | `string`                                                                                       | Names the provider on every record this client's turns produce.                                                                                                                                                                                                                          | [packages/adapters/src/model/client.ts:152](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L152) |
| <a id="property-requesttimeoutms"></a> `requestTimeoutMs?` | `readonly` | `number`                                                                                       | How long one model call may take, independently of the turn's own budget.                                                                                                                                                                                                                | [packages/adapters/src/model/client.ts:164](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L164) |
| <a id="property-temperature"></a> `temperature?`           | `readonly` | `number`                                                                                       | Left at zero by default, which reduces variation between runs but does not remove it. This column is not deterministic and must not be described as if it were: a temperature of zero is not a seed, and the same prompt can still produce a different call sequence on a different day. | [packages/adapters/src/model/client.ts:162](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L162) |

## Type Aliases

### ClaudeCodeDriverOptions

> **ClaudeCodeDriverOptions** = `Omit`\<[`HarnessDriverOptions`](#harnessdriveroptions), `"manifest"` \| `"protocol"`> \> & `object`

Defined in: [packages/adapters/src/claude-code/index.ts:34](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/claude-code/index.ts#L34)

#### Type Declaration

##### manifest?

> `readonly` `optional` **manifest?**: [`RuntimeManifest`](sharedos-contracts.md#runtimemanifest)

##### transport

> `readonly` **transport**: [`HarnessTransport`](#harnesstransport)

---

### CodexDriverOptions

> **CodexDriverOptions** = `Omit`\<[`HarnessDriverOptions`](#harnessdriveroptions), `"manifest"` \| `"protocol"`> \> & `object`

Defined in: [packages/adapters/src/codex/index.ts:34](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/codex/index.ts#L34)

#### Type Declaration

##### manifest?

> `readonly` `optional` **manifest?**: [`RuntimeManifest`](sharedos-contracts.md#runtimemanifest)

##### transport

> `readonly` **transport**: [`HarnessTransport`](#harnesstransport)

---

### DeepseekDriverOptions

> **DeepseekDriverOptions** = `Omit`\<[`HarnessDriverOptions`](#harnessdriveroptions), `"manifest"` \| `"protocol"`> \> & `object`

Defined in: [packages/adapters/src/deepseek/index.ts:41](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/deepseek/index.ts#L41)

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

Defined in: [packages/adapters/src/model/client.ts:33](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L33)

One turn of conversation.

`assistant` carries the tool calls the model asked for and `tool` carries one
result back, because a chat-completions provider requires the pair to appear
in that order and requires every call in an assistant message to be answered
before the next one is sent.

---

### PiDriverOptions

> **PiDriverOptions** = `Omit`\<[`HarnessDriverOptions`](#harnessdriveroptions), `"manifest"` \| `"protocol"`> \> & `object`

Defined in: [packages/adapters/src/pi/index.ts:45](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/pi/index.ts#L45)

#### Type Declaration

##### manifest?

> `readonly` `optional` **manifest?**: [`RuntimeManifest`](sharedos-contracts.md#runtimemanifest)

##### transport

> `readonly` **transport**: [`HarnessTransport`](#harnesstransport)

## Variables

### CLAUDE\_CODE\_ADAPTER\_VERSION

> `const` **CLAUDE\_CODE\_ADAPTER\_VERSION**: `"0.1.0-alpha.3"` = `"0.1.0-alpha.3"`

Defined in: [packages/adapters/src/claude-code/index.ts:11](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/claude-code/index.ts#L11)

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

Defined in: [packages/adapters/src/claude-code/index.ts:26](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/claude-code/index.ts#L26)

What a live Claude Code session needs before it can run.

---

### CLAUDE\_CODE\_RUNTIME\_MANIFEST

> `const` **CLAUDE\_CODE\_RUNTIME\_MANIFEST**: [`RuntimeManifest`](sharedos-contracts.md#runtimemanifest)

Defined in: [packages/adapters/src/claude-code/index.ts:13](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/claude-code/index.ts#L13)

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

Defined in: [packages/adapters/src/codex/index.ts:11](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/codex/index.ts#L11)

---

### CODEX\_PROTOCOL\_ID

> `const` **CODEX\_PROTOCOL\_ID**: `"openai.responses.function-calling"` = `"openai.responses.function-calling"`

Defined in: [packages/adapters/src/codex/protocol.ts:15](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/codex/protocol.ts#L15)

Codex speaks the OpenAI Responses function-calling shape.

That is the layer this module targets: function tool declarations,
`function_call` items, and `function_call_output` results. It is deliberately
not the Codex CLI's own event envelope, which differs between releases. What
carries these frames -- the CLI in JSON mode, the Codex SDK, or a direct
Responses call -- is the transport's problem, not the protocol's.

---

### CODEX\_REQUIREMENTS

> `const` **CODEX\_REQUIREMENTS**: [`HarnessRequirements`](#harnessrequirements)

Defined in: [packages/adapters/src/codex/index.ts:26](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/codex/index.ts#L26)

What a live Codex session needs before it can run.

---

### CODEX\_RUNTIME\_MANIFEST

> `const` **CODEX\_RUNTIME\_MANIFEST**: [`RuntimeManifest`](sharedos-contracts.md#runtimemanifest)

Defined in: [packages/adapters/src/codex/index.ts:13](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/codex/index.ts#L13)

---

### codexFrameWriter

> `const` **codexFrameWriter**: [`HarnessFrameWriter`](#harnessframewriter)

Defined in: [packages/adapters/src/writer.ts:31](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/writer.ts#L31)

Frames in the OpenAI Responses function-calling shape Codex speaks.

---

### codexProtocol

> `const` **codexProtocol**: [`HarnessProtocol`](#harnessprotocol)

Defined in: [packages/adapters/src/codex/protocol.ts:63](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/codex/protocol.ts#L63)

---

### DEEPSEEK\_ADAPTER\_VERSION

> `const` **DEEPSEEK\_ADAPTER\_VERSION**: `"0.1.0-alpha.3"` = `"0.1.0-alpha.3"`

Defined in: [packages/adapters/src/deepseek/index.ts:11](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/deepseek/index.ts#L11)

---

### DEEPSEEK\_PROTOCOL\_ID

> `const` **DEEPSEEK\_PROTOCOL\_ID**: `"deepseek.harness.session-events"` = `"deepseek.harness.session-events"`

Defined in: [packages/adapters/src/deepseek/protocol.ts:26](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/deepseek/protocol.ts#L26)

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

Defined in: [packages/adapters/src/deepseek/index.ts:33](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/deepseek/index.ts#L33)

What a live DeepSeek Harness session needs before it can run.

---

### DEEPSEEK\_RUNTIME\_MANIFEST

> `const` **DEEPSEEK\_RUNTIME\_MANIFEST**: [`RuntimeManifest`](sharedos-contracts.md#runtimemanifest)

Defined in: [packages/adapters/src/deepseek/index.ts:13](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/deepseek/index.ts#L13)

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

Defined in: [packages/adapters/src/deepseek/protocol.ts:106](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/deepseek/protocol.ts#L106)

---

### PI\_ADAPTER\_VERSION

> `const` **PI\_ADAPTER\_VERSION**: `"0.1.0-alpha.3"` = `"0.1.0-alpha.3"`

Defined in: [packages/adapters/src/pi/index.ts:11](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/pi/index.ts#L11)

---

### PI\_PROTOCOL\_ID

> `const` **PI\_PROTOCOL\_ID**: `"pi.rpc.jsonl"` = `"pi.rpc.jsonl"`

Defined in: [packages/adapters/src/pi/protocol.ts:29](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/pi/protocol.ts#L29)

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

Defined in: [packages/adapters/src/pi/index.ts:33](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/pi/index.ts#L33)

What a live Pi session needs before it can run.

---

### PI\_RUNTIME\_MANIFEST

> `const` **PI\_RUNTIME\_MANIFEST**: [`RuntimeManifest`](sharedos-contracts.md#runtimemanifest)

Defined in: [packages/adapters/src/pi/index.ts:13](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/pi/index.ts#L13)

---

### piFrameWriter

> `const` **piFrameWriter**: [`HarnessFrameWriter`](#harnessframewriter)

Defined in: [packages/adapters/src/writer.ts:135](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/writer.ts#L135)

Frames in the RPC message shape Pi speaks.

---

### piProtocol

> `const` **piProtocol**: [`HarnessProtocol`](#harnessprotocol)

Defined in: [packages/adapters/src/pi/protocol.ts:85](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/pi/protocol.ts#L85)

## Functions

### createClaudeCodeDriver()

> **createClaudeCodeDriver**(`options`): [`HarnessDriver`](#harnessdriver)

Defined in: [packages/adapters/src/claude-code/index.ts:46](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/claude-code/index.ts#L46)

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

Defined in: [packages/adapters/src/claude-code/index.ts:61](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/claude-code/index.ts#L61)

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

Defined in: [packages/adapters/src/codex/index.ts:46](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/codex/index.ts#L46)

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

Defined in: [packages/adapters/src/codex/index.ts:61](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/codex/index.ts#L61)

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

Defined in: [packages/adapters/src/deepseek/index.ts:53](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/deepseek/index.ts#L53)

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

Defined in: [packages/adapters/src/deepseek/index.ts:68](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/deepseek/index.ts#L68)

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

Defined in: [packages/adapters/src/pi/index.ts:57](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/pi/index.ts#L57)

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

Defined in: [packages/adapters/src/pi/index.ts:72](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/pi/index.ts#L72)

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

Defined in: [packages/adapters/src/model/client.ts:366](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/adapters/src/model/client.ts#L366)

Argument blobs are model output, so they are parsed rather than trusted.

#### Parameters

| Parameter | Type     |
| --------- | -------- |
| `raw`     | `string` |

#### Returns

[`JsonObject`](sharedos-contracts.md#jsonobject) \| `undefined`
