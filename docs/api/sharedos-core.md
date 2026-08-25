[**SharedOS API v0.1.0-alpha.2**](README.md)

---

[SharedOS API](README.md) / @aicoo/sharedos-core

# @aicoo/sharedos-core

The deny-by-default SharedOS authorization and dispatch kernel.

```bash
npm install @aicoo/sharedos-core@next
```

The kernel filters tool discovery, re-authorizes exact invocations, binds
resource ownership, and emits structured audit events. Embedded hosts must
construct access contexts from authenticated identity and trusted grant state.

Tool use requires registration, namespace enablement, and capability authority.
Static handlers use `ToolRegistry`; user-specific MCP catalogs use
`ContextToolProvider`. A host implements `ToolNamespaceSettingsStore` for
atomic, durable namespace updates while keeping its database and product policy.

SharedOS is currently an `0.x` prerelease.

## Classes

### CapabilityAuthorizer

Defined in: [packages/core/src/authorization.ts:116](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L116)

#### Constructors

##### Constructor

> **new CapabilityAuthorizer**(`options?`): [`CapabilityAuthorizer`](#capabilityauthorizer)

Defined in: [packages/core/src/authorization.ts:122](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L122)

###### Parameters

| Parameter | Type                                                          |
| --------- | ------------------------------------------------------------- |
| `options` | [`CapabilityAuthorizerOptions`](#capabilityauthorizeroptions) |

###### Returns

[`CapabilityAuthorizer`](#capabilityauthorizer)

#### Methods

##### authorize()

> **authorize**(`authority`, `request`, `options?`): `Promise`\<\{ `allowed`: `boolean`; `matchedGrantId?`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `reasonCode`: `string`; \}\>

Defined in: [packages/core/src/authorization.ts:129](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L129)

###### Parameters

| Parameter   | Type                                            |
| ----------- | ----------------------------------------------- |
| `authority` | [`ResolvedAuthority`](#resolvedauthority)       |
| `request`   | [`AuthorizationRequest`](#authorizationrequest) |
| `options`   | [`AuthorizeOptions`](#authorizeoptions)         |

###### Returns

`Promise`\<\{ `allowed`: `boolean`; `matchedGrantId?`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `reasonCode`: `string`; \}\>

##### canDiscover()

> **canDiscover**(`authority`, `ceiling`): `Promise`\<\{ `allowed`: `boolean`; `matchedGrantId?`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `reasonCode`: `string`; \}\>

Defined in: [packages/core/src/authorization.ts:142](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L142)

Non-consuming catalog check. A narrow grant can discover a tool whose
declared resource is a broader ceiling; invocation still checks the exact
argument-selected resource.

###### Parameters

| Parameter   | Type                                            |
| ----------- | ----------------------------------------------- |
| `authority` | [`ResolvedAuthority`](#resolvedauthority)       |
| `ceiling`   | [`AuthorizationRequest`](#authorizationrequest) |

###### Returns

`Promise`\<\{ `allowed`: `boolean`; `matchedGrantId?`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `reasonCode`: `string`; \}\>

---

### CompositeAuditSink

Defined in: [packages/core/src/audit.ts:62](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L62)

#### Implements

- [`AuditSink`](#auditsink)

#### Constructors

##### Constructor

> **new CompositeAuditSink**(`sinks`): [`CompositeAuditSink`](#compositeauditsink)

Defined in: [packages/core/src/audit.ts:65](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L65)

###### Parameters

| Parameter | Type                                 |
| --------- | ------------------------------------ |
| `sinks`   | readonly [`AuditSink`](#auditsink)[] |

###### Returns

[`CompositeAuditSink`](#compositeauditsink)

#### Methods

##### record()

> **record**(`event`): `Promise`\<`void`>\>

Defined in: [packages/core/src/audit.ts:69](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L69)

###### Parameters

| Parameter | Type                        |
| --------- | --------------------------- |
| `event`   | [`AuditEvent`](#auditevent) |

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`AuditSink`](#auditsink).[`record`](#record-2)

---

### DuplicateRegistrationError

Defined in: [packages/core/src/errors.ts:1](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/errors.ts#L1)

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new DuplicateRegistrationError**(`kind`, `identifier`): [`DuplicateRegistrationError`](#duplicateregistrationerror)

Defined in: [packages/core/src/errors.ts:4](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/errors.ts#L4)

###### Parameters

| Parameter    | Type                                                                                   |
| ------------ | -------------------------------------------------------------------------------------- |
| `kind`       | `"tool"` \| `"resource namespace"` \| `"tool provider"` \| `"tool namespace settings"` |
| `identifier` | `string`                                                                               |

###### Returns

[`DuplicateRegistrationError`](#duplicateregistrationerror)

###### Overrides

`Error.constructor`

#### Properties

| Property                                                | Modifier   | Type                           | Default value                  | Description                                                                                                                                                                                                                                                                                                                                                                                                                                       | Overrides    | Inherited from          | Defined in                                                                                                       |
| ------------------------------------------------------- | ---------- | ------------------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| <a id="property-cause"></a> `cause?`                    | `public`   | `unknown`                      | `undefined`                    | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | -            | `Error.cause`           | node\_modules/.pnpm/typescript@5.9.3/node\_modules/typescript/lib/lib.es2022.error.d.ts:26                       |
| <a id="property-message"></a> `message`                 | `public`   | `string`                       | `undefined`                    | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | -            | `Error.message`         | node\_modules/.pnpm/typescript@5.9.3/node\_modules/typescript/lib/lib.es5.d.ts:1077                              |
| <a id="property-name"></a> `name`                       | `readonly` | `"DuplicateRegistrationError"` | `"DuplicateRegistrationError"` | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `Error.name` | -                       | [packages/core/src/errors.ts:2](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/errors.ts#L2) |
| <a id="property-stack"></a> `stack?`                    | `public`   | `string`                       | `undefined`                    | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | -            | `Error.stack`           | node\_modules/.pnpm/typescript@5.9.3/node\_modules/typescript/lib/lib.es5.d.ts:1078                              |
| <a id="property-stacktracelimit"></a> `stackTraceLimit` | `static`   | `number`                       | `undefined`                    | The `Error.stackTraceLimit` property specifies the number of stack frames collected by a stack trace (whether generated by `new Error().stack` or `Error.captureStackTrace(obj)`). The default value is `10` but may be set to any valid JavaScript number. Changes will affect any stack trace captured _after_ the value has been changed. If set to a non-number value, or set to a negative number, stack traces will not capture any frames. | -            | `Error.stackTraceLimit` | node\_modules/.pnpm/@types+node@22.20.1/node\_modules/@types/node/globals.d.ts:68                                |

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

### InMemoryGrantUsageStore

Defined in: [packages/core/src/authorization.ts:92](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L92)

An atomic, process-local usage store suitable for tests and single-process
hosts. Distributed hosts should inject a durable compare-and-set store.

#### Implements

- [`GrantUsageStore`](#grantusagestore)

#### Constructors

##### Constructor

> **new InMemoryGrantUsageStore**(): [`InMemoryGrantUsageStore`](#inmemorygrantusagestore)

###### Returns

[`InMemoryGrantUsageStore`](#inmemorygrantusagestore)

#### Methods

##### getUsage()

> **getUsage**(`namespaceId`, `grantId`): `Promise`\<`number`>\>

Defined in: [packages/core/src/authorization.ts:95](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L95)

###### Parameters

| Parameter     | Type     |
| ------------- | -------- |
| `namespaceId` | `string` |
| `grantId`     | `string` |

###### Returns

`Promise`\<`number`\>

###### Implementation of

[`GrantUsageStore`](#grantusagestore).[`getUsage`](#getusage-1)

##### tryConsume()

> **tryConsume**(`namespaceId`, `grantId`, `maximumUses`): `Promise`\<`boolean`>\>

Defined in: [packages/core/src/authorization.ts:99](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L99)

###### Parameters

| Parameter     | Type     |
| ------------- | -------- |
| `namespaceId` | `string` |
| `grantId`     | `string` |
| `maximumUses` | `number` |

###### Returns

`Promise`\<`boolean`\>

###### Implementation of

[`GrantUsageStore`](#grantusagestore).[`tryConsume`](#tryconsume-1)

---

### MissingRegistrationError

Defined in: [packages/core/src/errors.ts:12](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/errors.ts#L12)

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new MissingRegistrationError**(`kind`, `identifier`): [`MissingRegistrationError`](#missingregistrationerror)

Defined in: [packages/core/src/errors.ts:15](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/errors.ts#L15)

###### Parameters

| Parameter    | Type                                                                                   |
| ------------ | -------------------------------------------------------------------------------------- |
| `kind`       | `"tool"` \| `"resource namespace"` \| `"tool provider"` \| `"tool namespace settings"` |
| `identifier` | `string`                                                                               |

###### Returns

[`MissingRegistrationError`](#missingregistrationerror)

###### Overrides

`Error.constructor`

#### Properties

| Property                                                  | Modifier   | Type                         | Default value                | Description                                                                                                                                                                                                                                                                                                                                                                                                                                       | Overrides    | Inherited from          | Defined in                                                                                                         |
| --------------------------------------------------------- | ---------- | ---------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| <a id="property-cause-1"></a> `cause?`                    | `public`   | `unknown`                    | `undefined`                  | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | -            | `Error.cause`           | node\_modules/.pnpm/typescript@5.9.3/node\_modules/typescript/lib/lib.es2022.error.d.ts:26                         |
| <a id="property-message-1"></a> `message`                 | `public`   | `string`                     | `undefined`                  | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | -            | `Error.message`         | node\_modules/.pnpm/typescript@5.9.3/node\_modules/typescript/lib/lib.es5.d.ts:1077                                |
| <a id="property-name-1"></a> `name`                       | `readonly` | `"MissingRegistrationError"` | `"MissingRegistrationError"` | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `Error.name` | -                       | [packages/core/src/errors.ts:13](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/errors.ts#L13) |
| <a id="property-stack-1"></a> `stack?`                    | `public`   | `string`                     | `undefined`                  | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | -            | `Error.stack`           | node\_modules/.pnpm/typescript@5.9.3/node\_modules/typescript/lib/lib.es5.d.ts:1078                                |
| <a id="property-stacktracelimit-1"></a> `stackTraceLimit` | `static`   | `number`                     | `undefined`                  | The `Error.stackTraceLimit` property specifies the number of stack frames collected by a stack trace (whether generated by `new Error().stack` or `Error.captureStackTrace(obj)`). The default value is `10` but may be set to any valid JavaScript number. Changes will affect any stack trace captured _after_ the value has been changed. If set to a non-number value, or set to a negative number, stack traces will not capture any frames. | -            | `Error.stackTraceLimit` | node\_modules/.pnpm/@types+node@22.20.1/node\_modules/@types/node/globals.d.ts:68                                  |

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

### NoopAuditSink

Defined in: [packages/core/src/audit.ts:56](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L56)

#### Implements

- [`AuditSink`](#auditsink)

#### Constructors

##### Constructor

> **new NoopAuditSink**(): [`NoopAuditSink`](#noopauditsink)

###### Returns

[`NoopAuditSink`](#noopauditsink)

#### Methods

##### record()

> **record**(`_event`): `Promise`\<`void`>\>

Defined in: [packages/core/src/audit.ts:57](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L57)

###### Parameters

| Parameter | Type                        |
| --------- | --------------------------- |
| `_event`  | [`AuditEvent`](#auditevent) |

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`AuditSink`](#auditsink).[`record`](#record-2)

---

### RecipientScopedMessageCapabilityResolver

Defined in: [packages/core/src/message-service.ts:39](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/message-service.ts#L39)

#### Implements

- [`MessageCapabilityResolver`](#messagecapabilityresolver)

#### Constructors

##### Constructor

> **new RecipientScopedMessageCapabilityResolver**(`namespace?`): [`RecipientScopedMessageCapabilityResolver`](#recipientscopedmessagecapabilityresolver)

Defined in: [packages/core/src/message-service.ts:42](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/message-service.ts#L42)

###### Parameters

| Parameter   | Type     | Default value         |
| ----------- | -------- | --------------------- |
| `namespace` | `string` | `MESSAGING_NAMESPACE` |

###### Returns

[`RecipientScopedMessageCapabilityResolver`](#recipientscopedmessagecapabilityresolver)

#### Methods

##### resolve()

> **resolve**(`context`, `envelope`): [`AuthorizationRequest`](#authorizationrequest)

Defined in: [packages/core/src/message-service.ts:46](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/message-service.ts#L46)

###### Parameters

| Parameter                       | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context`                       | \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \} |
| `context.actor`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.authority`             | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.enabledToolNamespaces` | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.namespaceId`           | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.now`                   | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.owner`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.purpose`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.traceId`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `envelope`                      | \{ `createdAt`: `string`; `id`: `string`; `intent`: `string`; `payload`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `provenance?`: \{ `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}; `purpose`: `string`; `receiver`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `replyTo?`: `string`; `sender`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `traceId`: `string`; `version`: `"1"`; \}     |
| `envelope.createdAt`            | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `envelope.id`                   | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `envelope.intent`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `envelope.payload`              | [`JsonValue`](sharedos-contracts.md#jsonvalue)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `envelope.provenance?`          | \{ `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `envelope.provenance.metadata?` | [`JsonObject`](sharedos-contracts.md#jsonobject)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `envelope.provenance.parentIds` | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `envelope.provenance.source`    | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `envelope.purpose`              | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `envelope.receiver`             | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `envelope.replyTo?`             | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `envelope.sender`               | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `envelope.traceId`              | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `envelope.version`              | `"1"`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

###### Returns

[`AuthorizationRequest`](#authorizationrequest)

###### Implementation of

[`MessageCapabilityResolver`](#messagecapabilityresolver).[`resolve`](#resolve-3)

---

### ResourceProviderRegistry

Defined in: [packages/core/src/resource-registry.ts:23](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/resource-registry.ts#L23)

#### Constructors

##### Constructor

> **new ResourceProviderRegistry**(): [`ResourceProviderRegistry`](#resourceproviderregistry)

###### Returns

[`ResourceProviderRegistry`](#resourceproviderregistry)

#### Methods

##### get()

> **get**(`namespace`): [`ResourceProvider`](#resourceprovider) \| `undefined`

Defined in: [packages/core/src/resource-registry.ts:37](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/resource-registry.ts#L37)

###### Parameters

| Parameter   | Type     |
| ----------- | -------- |
| `namespace` | `string` |

###### Returns

[`ResourceProvider`](#resourceprovider) \| `undefined`

##### has()

> **has**(`namespace`): `boolean`

Defined in: [packages/core/src/resource-registry.ts:41](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/resource-registry.ts#L41)

###### Parameters

| Parameter   | Type     |
| ----------- | -------- |
| `namespace` | `string` |

###### Returns

`boolean`

##### namespaces()

> **namespaces**(): readonly `string`[]

Defined in: [packages/core/src/resource-registry.ts:45](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/resource-registry.ts#L45)

###### Returns

readonly `string`[]

##### register()

> **register**(`provider`): `void`

Defined in: [packages/core/src/resource-registry.ts:26](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/resource-registry.ts#L26)

###### Parameters

| Parameter  | Type                                    |
| ---------- | --------------------------------------- |
| `provider` | [`ResourceProvider`](#resourceprovider) |

###### Returns

`void`

---

### SharedOSKernel

Defined in: [packages/core/src/kernel.ts:108](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L108)

Host-neutral facade for every permission-controlled SharedOS operation.
AccessContext is a trusted host-created boundary; never construct it from an
unverified request body.

#### Constructors

##### Constructor

> **new SharedOSKernel**(`options`): [`SharedOSKernel`](#sharedoskernel)

Defined in: [packages/core/src/kernel.ts:121](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L121)

###### Parameters

| Parameter | Type                                              |
| --------- | ------------------------------------------------- |
| `options` | [`SharedOSKernelOptions`](#sharedoskerneloptions) |

###### Returns

[`SharedOSKernel`](#sharedoskernel)

#### Methods

##### admitTurn()

> **admitTurn**(`context`, `agent`, `options?`): `Promise`\<\{ `allowed`: `boolean`; `matchedGrantId?`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `reasonCode`: `string`; \}\>

Defined in: [packages/core/src/kernel.ts:226](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L226)

Consume permission to invoke exactly one target agent turn.

###### Parameters

| Parameter                       | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context`                       | \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \} |
| `context.actor`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.authority`             | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.enabledToolNamespaces` | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.namespaceId`           | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.now`                   | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.owner`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.purpose`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.traceId`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `agent`                         | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `options`                       | [`KernelOperationOptions`](#kerneloperationoptions)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

###### Returns

`Promise`\<\{ `allowed`: `boolean`; `matchedGrantId?`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `reasonCode`: `string`; \}\>

##### authorize()

> **authorize**(`context`, `request`, `options?`): `Promise`\<\{ `allowed`: `boolean`; `matchedGrantId?`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `reasonCode`: `string`; \}\>

Defined in: [packages/core/src/kernel.ts:210](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L210)

###### Parameters

| Parameter                       | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context`                       | \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \} |
| `context.actor`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.authority`             | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.enabledToolNamespaces` | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.namespaceId`           | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.now`                   | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.owner`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.purpose`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.traceId`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `request`                       | [`AuthorizationRequest`](#authorizationrequest)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `options`                       | [`KernelOperationOptions`](#kerneloperationoptions)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

###### Returns

`Promise`\<\{ `allowed`: `boolean`; `matchedGrantId?`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `reasonCode`: `string`; \}\>

##### invokeResource()

> **invokeResource**(`context`, `request`, `options?`): `Promise`\<\{ `completedAt`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `operationId`: `string`; `output`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `status`: `"succeeded"`; \} \| \{ `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `operationId`: `string`; `status`: `"denied"`; \} \| \{ `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `operationId`: `string`; `status`: `"failed"`; \}\>

Defined in: [packages/core/src/kernel.ts:636](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L636)

###### Parameters

| Parameter                       | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context`                       | \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \} |
| `context.actor`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.authority`             | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.enabledToolNamespaces` | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.namespaceId`           | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.now`                   | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.owner`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.purpose`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.traceId`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `request`                       | [`ResourceInvocationRequest`](#resourceinvocationrequest)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `options`                       | [`KernelOperationOptions`](#kerneloperationoptions)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

###### Returns

`Promise`\<\{ `completedAt`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `operationId`: `string`; `output`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `status`: `"succeeded"`; \} \| \{ `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `operationId`: `string`; `status`: `"denied"`; \} \| \{ `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `operationId`: `string`; `status`: `"failed"`; \}\>

##### invokeTool()

> **invokeTool**(`context`, `call`, `options?`): `Promise`\<\{ `callId`: `string`; `completedAt`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `output`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `status`: `"succeeded"`; `tool`: `string`; \} \| \{ `callId`: `string`; `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"denied"`; `tool`: `string`; \} \| \{ `callId`: `string`; `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"failed"`; `tool`: `string`; \}\>

Defined in: [packages/core/src/kernel.ts:416](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L416)

###### Parameters

| Parameter                       | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context`                       | \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \} |
| `context.actor`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.authority`             | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.enabledToolNamespaces` | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.namespaceId`           | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.now`                   | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.owner`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.purpose`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.traceId`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `call`                          | \{ `arguments`: [`JsonObject`](sharedos-contracts.md#jsonobject); `id`: `string`; `requestedAt`: `string`; `tool`: `string`; `traceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `call.arguments`                | [`JsonObject`](sharedos-contracts.md#jsonobject)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `call.id`                       | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `call.requestedAt`              | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `call.tool`                     | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `call.traceId`                  | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `options`                       | [`KernelOperationOptions`](#kerneloperationoptions)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

###### Returns

`Promise`\<\{ `callId`: `string`; `completedAt`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `output`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `status`: `"succeeded"`; `tool`: `string`; \} \| \{ `callId`: `string`; `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"denied"`; `tool`: `string`; \} \| \{ `callId`: `string`; `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"failed"`; `tool`: `string`; \}\>

##### listToolNamespaces()

> **listToolNamespaces**(`context`, `options?`): `Promise`\<\{ `namespaces`: `object`[]; `summary`: \{ `disabled`: `number`; `enabled`: `number`; `total`: `number`; \}; \}\>

Defined in: [packages/core/src/kernel.ts:345](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L345)

###### Parameters

| Parameter                       | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context`                       | \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \} |
| `context.actor`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.authority`             | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.enabledToolNamespaces` | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.namespaceId`           | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.now`                   | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.owner`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.purpose`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.traceId`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `options`                       | [`KernelOperationOptions`](#kerneloperationoptions)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

###### Returns

`Promise`\<\{ `namespaces`: `object`[]; `summary`: \{ `disabled`: `number`; `enabled`: `number`; `total`: `number`; \}; \}\>

##### listTools()

> **listTools**(`context`, `options?`): `Promise`\<readonly `object`[]\>

Defined in: [packages/core/src/kernel.ts:296](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L296)

###### Parameters

| Parameter                       | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context`                       | \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \} |
| `context.actor`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.authority`             | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.enabledToolNamespaces` | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.namespaceId`           | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.now`                   | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.owner`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.purpose`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.traceId`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `options`                       | [`KernelOperationOptions`](#kerneloperationoptions)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

###### Returns

`Promise`\<readonly `object`[]\>

##### openTurnAuthority()

> **openTurnAuthority**(`context`, `options?`): `Promise`\<[`TurnAuthorityScope`](#turnauthorityscope)>\>

Defined in: [packages/core/src/kernel.ts:174](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L174)

Resolve the authority one turn will be decided against, and hold it.

A turn must decide against a single authority state. This loads that state
once, at the turn boundary, and every kernel operation presenting the same
turn identity is then answered from it -- including operations a tool
handler makes back into the kernel, which never receive a handle and would
otherwise re-read the store.

An unavailable source is held too, so a turn that could not establish
authority stays fail-closed for its whole length instead of retrying the
store on every call and possibly changing its mind.

Callers must `close` the returned scope on every exit path. Hosts that call
kernel operations outside any turn need not open one: an operation with no
lease resolves its own authority, which is a turn of one operation.

###### Parameters

| Parameter                       | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context`                       | \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \} |
| `context.actor`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.authority`             | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.enabledToolNamespaces` | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.namespaceId`           | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.now`                   | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.owner`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.purpose`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.traceId`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `options`                       | [`KernelOperationOptions`](#kerneloperationoptions)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

###### Returns

`Promise`\<[`TurnAuthorityScope`](#turnauthorityscope)\>

##### recordEscalation()

> **recordEscalation**(`context`, `reason`, `options?`): `Promise`\<\{ `reason`: `string`; `requestedAt`: `string`; `reviewer`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `status`: `"pending"`; \}\>

Defined in: [packages/core/src/kernel.ts:262](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L262)

Record that a turn stopped and asked a human to decide.

This mints nothing and unblocks nothing. It writes one audit event and
returns the stub the turn terminates with, so an escalation is visible in
the same stream as the decisions around it rather than surviving only as
runtime prose. The reviewer is the owner the turn already runs on behalf
of; SharedOS has no review roster and does not invent one.

Resolving an escalation is host-owned control-plane work: it ends in a new
grant issued to the trusted store, which the _next_ turn loads. There is
deliberately no path from here back into the running turn.

###### Parameters

| Parameter                       | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context`                       | \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \} |
| `context.actor`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.authority`             | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.enabledToolNamespaces` | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.namespaceId`           | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.now`                   | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.owner`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.purpose`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.traceId`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `reason`                        | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `options`                       | [`KernelOperationOptions`](#kerneloperationoptions)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

###### Returns

`Promise`\<\{ `reason`: `string`; `requestedAt`: `string`; `reviewer`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `status`: `"pending"`; \}\>

##### registerResourceProvider()

> **registerResourceProvider**(`provider`): `void`

Defined in: [packages/core/src/kernel.ts:138](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L138)

###### Parameters

| Parameter  | Type                                    |
| ---------- | --------------------------------------- |
| `provider` | [`ResourceProvider`](#resourceprovider) |

###### Returns

`void`

##### registerTool()

> **registerTool**(`handler`): `void`

Defined in: [packages/core/src/kernel.ts:142](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L142)

###### Parameters

| Parameter | Type                          |
| --------- | ----------------------------- |
| `handler` | [`ToolHandler`](#toolhandler) |

###### Returns

`void`

##### registerToolProvider()

> **registerToolProvider**(`provider`): `void`

Defined in: [packages/core/src/kernel.ts:146](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L146)

###### Parameters

| Parameter  | Type                                          |
| ---------- | --------------------------------------------- |
| `provider` | [`ContextToolProvider`](#contexttoolprovider) |

###### Returns

`void`

##### sendMessage()

> **sendMessage**(`context`, `envelope`, `options?`): `Promise`\<\{ `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"accepted"`; `timestamp`: `string`; \} \| \{ `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"delivered"`; `timestamp`: `string`; \} \| \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"denied"`; `timestamp`: `string`; \} \| \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"failed"`; `timestamp`: `string`; \}\>

Defined in: [packages/core/src/kernel.ts:759](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L759)

###### Parameters

| Parameter                       | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context`                       | \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \} |
| `context.actor`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.authority`             | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.enabledToolNamespaces` | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.namespaceId`           | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.now`                   | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.owner`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.purpose`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.traceId`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `envelope`                      | \{ `createdAt`: `string`; `id`: `string`; `intent`: `string`; `payload`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `provenance?`: \{ `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}; `purpose`: `string`; `receiver`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `replyTo?`: `string`; `sender`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `traceId`: `string`; `version`: `"1"`; \}     |
| `envelope.createdAt`            | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `envelope.id`                   | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `envelope.intent`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `envelope.payload`              | [`JsonValue`](sharedos-contracts.md#jsonvalue)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `envelope.provenance?`          | \{ `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `envelope.provenance.metadata?` | [`JsonObject`](sharedos-contracts.md#jsonobject)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `envelope.provenance.parentIds` | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `envelope.provenance.source`    | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `envelope.purpose`              | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `envelope.receiver`             | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `envelope.replyTo?`             | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `envelope.sender`               | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `envelope.traceId`              | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `envelope.version`              | `"1"`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `options`                       | [`KernelOperationOptions`](#kerneloperationoptions)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

###### Returns

`Promise`\<\{ `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"accepted"`; `timestamp`: `string`; \} \| \{ `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"delivered"`; `timestamp`: `string`; \} \| \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"denied"`; `timestamp`: `string`; \} \| \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"failed"`; `timestamp`: `string`; \}\>

##### updateToolNamespaces()

> **updateToolNamespaces**(`context`, `update`, `options?`): `Promise`\<\{ `namespaces`: `object`[]; `summary`: \{ `disabled`: `number`; `enabled`: `number`; `total`: `number`; \}; \}\>

Defined in: [packages/core/src/kernel.ts:368](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L368)

###### Parameters

| Parameter                       | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context`                       | \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \} |
| `context.actor`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.authority`             | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.enabledToolNamespaces` | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.namespaceId`           | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.now`                   | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.owner`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.purpose`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.traceId`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `update`                        | \{ `disable?`: `string`[]; `enable?`: `string`[]; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `update.disable?`               | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `update.enable?`                | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `options`                       | [`KernelOperationOptions`](#kerneloperationoptions)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

###### Returns

`Promise`\<\{ `namespaces`: `object`[]; `summary`: \{ `disabled`: `number`; `enabled`: `number`; `total`: `number`; \}; \}\>

---

### ToolRegistry

Defined in: [packages/core/src/tool-registry.ts:34](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/tool-registry.ts#L34)

#### Constructors

##### Constructor

> **new ToolRegistry**(): [`ToolRegistry`](#toolregistry)

###### Returns

[`ToolRegistry`](#toolregistry)

#### Methods

##### definitions()

> **definitions**(): readonly `object`[]

Defined in: [packages/core/src/tool-registry.ts:78](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/tool-registry.ts#L78)

###### Returns

readonly `object`[]

##### get()

> **get**(`name`): [`ToolHandler`](#toolhandler) \| `undefined`

Defined in: [packages/core/src/tool-registry.ts:70](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/tool-registry.ts#L70)

###### Parameters

| Parameter | Type     |
| --------- | -------- |
| `name`    | `string` |

###### Returns

[`ToolHandler`](#toolhandler) \| `undefined`

##### handlers()

> **handlers**(): readonly [`ToolHandler`](#toolhandler)[]

Defined in: [packages/core/src/tool-registry.ts:84](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/tool-registry.ts#L84)

###### Returns

readonly [`ToolHandler`](#toolhandler)[]

##### has()

> **has**(`name`): `boolean`

Defined in: [packages/core/src/tool-registry.ts:74](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/tool-registry.ts#L74)

###### Parameters

| Parameter | Type     |
| --------- | -------- |
| `name`    | `string` |

###### Returns

`boolean`

##### namespaceCatalog()

> **namespaceCatalog**(`enabledToolNamespaces`): `object`

Defined in: [packages/core/src/tool-registry.ts:90](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/tool-registry.ts#L90)

###### Parameters

| Parameter               | Type                |
| ----------------------- | ------------------- |
| `enabledToolNamespaces` | readonly `string`[] |

###### Returns

`object`

###### namespaces

> **namespaces**: `object`[]

###### summary

> **summary**: `object`

###### summary.disabled

> **disabled**: `number`

###### summary.enabled

> **enabled**: `number`

###### summary.total

> **total**: `number`

##### register()

> **register**(`handler`): `void`

Defined in: [packages/core/src/tool-registry.ts:37](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/tool-registry.ts#L37)

###### Parameters

| Parameter | Type                          |
| --------- | ----------------------------- |
| `handler` | [`ToolHandler`](#toolhandler) |

###### Returns

`void`

---

### TrustedAuthorityResolver

Defined in: [packages/core/src/authority.ts:144](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L144)

Loads and validates authority for one access context.

Every failure mode collapses to `unavailable`, so a decision is never made
against a partially trusted authority set.

#### Constructors

##### Constructor

> **new TrustedAuthorityResolver**(`source`): [`TrustedAuthorityResolver`](#trustedauthorityresolver)

Defined in: [packages/core/src/authority.ts:149](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L149)

###### Parameters

| Parameter | Type                          |
| --------- | ----------------------------- |
| `source`  | [`GrantSource`](#grantsource) |

###### Returns

[`TrustedAuthorityResolver`](#trustedauthorityresolver)

#### Methods

##### resolve()

> **resolve**(`context`, `signal`): `Promise`\<[`AuthorityResolution`](#authorityresolution)>\>

Defined in: [packages/core/src/authority.ts:156](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L156)

###### Parameters

| Parameter                       | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context`                       | \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \} |
| `context.actor`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.authority`             | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.enabledToolNamespaces` | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.namespaceId`           | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.now`                   | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.owner`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.purpose`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.traceId`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `signal`                        | `AbortSignal`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

###### Returns

`Promise`\<[`AuthorityResolution`](#authorityresolution)\>

## Interfaces

### AuditEvent

Defined in: [packages/core/src/audit.ts:23](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L23)

#### Properties

| Property                                             | Modifier   | Type                                                                                                                                                                                                       | Description                                                                                                                                                                                                                                       | Defined in                                                                                                       |
| ---------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| <a id="property-action"></a> `action?`               | `readonly` | `string`                                                                                                                                                                                                   | -                                                                                                                                                                                                                                                 | [packages/core/src/audit.ts:35](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L35) |
| <a id="property-actor"></a> `actor`                  | `readonly` | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \} | -                                                                                                                                                                                                                                                 | [packages/core/src/audit.ts:30](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L30) |
| <a id="property-at"></a> `at`                        | `readonly` | `string`                                                                                                                                                                                                   | -                                                                                                                                                                                                                                                 | [packages/core/src/audit.ts:27](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L27) |
| <a id="property-authority"></a> `authority`          | `readonly` | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \} | -                                                                                                                                                                                                                                                 | [packages/core/src/audit.ts:31](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L31) |
| <a id="property-authorityhash"></a> `authorityHash?` | `readonly` | `string`                                                                                                                                                                                                   | Content identifier of the exact authority set the decision was made against. A turn resolves authority once, so every decision in it carries the same value; the `authority.resolved` event that opened the turn carries the grant ids behind it. | [packages/core/src/audit.ts:43](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L43) |
| <a id="property-grantid"></a> `grantId?`             | `readonly` | `string`                                                                                                                                                                                                   | -                                                                                                                                                                                                                                                 | [packages/core/src/audit.ts:36](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L36) |
| <a id="property-messageid"></a> `messageId?`         | `readonly` | `string`                                                                                                                                                                                                   | -                                                                                                                                                                                                                                                 | [packages/core/src/audit.ts:46](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L46) |
| <a id="property-metadata"></a> `metadata?`           | `readonly` | [`JsonObject`](sharedos-contracts.md#jsonobject)                                                                                                                                                           | -                                                                                                                                                                                                                                                 | [packages/core/src/audit.ts:49](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L49) |
| <a id="property-namespaceid"></a> `namespaceId`      | `readonly` | `string`                                                                                                                                                                                                   | -                                                                                                                                                                                                                                                 | [packages/core/src/audit.ts:29](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L29) |
| <a id="property-operationid"></a> `operationId?`     | `readonly` | `string`                                                                                                                                                                                                   | -                                                                                                                                                                                                                                                 | [packages/core/src/audit.ts:44](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L44) |
| <a id="property-outcome"></a> `outcome`              | `readonly` | [`AuditOutcome`](#auditoutcome)                                                                                                                                                                            | -                                                                                                                                                                                                                                                 | [packages/core/src/audit.ts:26](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L26) |
| <a id="property-owner"></a> `owner`                  | `readonly` | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \} | -                                                                                                                                                                                                                                                 | [packages/core/src/audit.ts:32](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L32) |
| <a id="property-purpose"></a> `purpose`              | `readonly` | `string`                                                                                                                                                                                                   | -                                                                                                                                                                                                                                                 | [packages/core/src/audit.ts:33](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L33) |
| <a id="property-reason"></a> `reason?`               | `readonly` | `string`                                                                                                                                                                                                   | -                                                                                                                                                                                                                                                 | [packages/core/src/audit.ts:48](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L48) |
| <a id="property-receiver"></a> `receiver?`           | `readonly` | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \} | -                                                                                                                                                                                                                                                 | [packages/core/src/audit.ts:47](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L47) |
| <a id="property-resource"></a> `resource?`           | `readonly` | `object`                                                                                                                                                                                                   | -                                                                                                                                                                                                                                                 | [packages/core/src/audit.ts:34](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L34) |
| `resource.namespace`                                 | `public`   | `string`                                                                                                                                                                                                   | -                                                                                                                                                                                                                                                 | packages/contracts/dist/capability.d.ts:54                                                                       |
| `resource.owner?`                                    | `public`   | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \} | -                                                                                                                                                                                                                                                 | packages/contracts/dist/capability.d.ts:55                                                                       |
| `resource.path`                                      | `public`   | `string`[]                                                                                                                                                                                                 | -                                                                                                                                                                                                                                                 | packages/contracts/dist/capability.d.ts:53                                                                       |
| <a id="property-tool"></a> `tool?`                   | `readonly` | `string`                                                                                                                                                                                                   | -                                                                                                                                                                                                                                                 | [packages/core/src/audit.ts:45](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L45) |
| <a id="property-traceid"></a> `traceId`              | `readonly` | `string`                                                                                                                                                                                                   | -                                                                                                                                                                                                                                                 | [packages/core/src/audit.ts:28](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L28) |
| <a id="property-type"></a> `type`                    | `readonly` | [`AuditEventType`](#auditeventtype)                                                                                                                                                                        | -                                                                                                                                                                                                                                                 | [packages/core/src/audit.ts:25](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L25) |
| <a id="property-version"></a> `version`              | `readonly` | `"1"`                                                                                                                                                                                                      | -                                                                                                                                                                                                                                                 | [packages/core/src/audit.ts:24](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L24) |

---

### AuditSink

Defined in: [packages/core/src/audit.ts:52](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L52)

#### Methods

##### record()

> **record**(`event`): `Promise`\<`void`>\>

Defined in: [packages/core/src/audit.ts:53](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L53)

###### Parameters

| Parameter | Type                        |
| --------- | --------------------------- |
| `event`   | [`AuditEvent`](#auditevent) |

###### Returns

`Promise`\<`void`\>

---

### AuthoritySnapshot

Defined in: [packages/core/src/authority.ts:112](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L112)

A content identifier for exactly the authority one decision was made against.

With [MID\_TURN\_AUTHORITY\_REFRESH](#mid_turn_authority_refresh) off, a turn resolves authority once
and every decision in it names the same snapshot. The per-decision field is
kept rather than collapsed to a per-turn one because a host may still make
kernel calls outside any turn, and because re-enabling the fuse must not
change the shape of the evidence.

#### Properties

| Property                                      | Modifier   | Type                | Description                                                          | Defined in                                                                                                                 |
| --------------------------------------------- | ---------- | ------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-grantcount"></a> `grantCount` | `readonly` | `number`            | -                                                                    | [packages/core/src/authority.ts:116](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L116) |
| <a id="property-grantids"></a> `grantIds`     | `readonly` | readonly `string`[] | -                                                                    | [packages/core/src/authority.ts:115](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L115) |
| <a id="property-hash"></a> `hash`             | `readonly` | `string`            | SHA-256 over the canonical, order-independent form of the grant set. | [packages/core/src/authority.ts:114](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L114) |
| <a id="property-loadedat"></a> `loadedAt`     | `readonly` | `string`            | -                                                                    | [packages/core/src/authority.ts:117](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L117) |

---

### AuthorizationRequest

Defined in: [packages/core/src/authorization.ts:26](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L26)

#### Properties

| Property                                    | Modifier   | Type                                                                                                                                                                                                       | Defined in                                                                                                                       |
| ------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-action-1"></a> `action`     | `readonly` | `string`                                                                                                                                                                                                   | [packages/core/src/authorization.ts:28](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L28) |
| <a id="property-resource-1"></a> `resource` | `readonly` | `object`                                                                                                                                                                                                   | [packages/core/src/authorization.ts:27](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L27) |
| `resource.namespace`                        | `public`   | `string`                                                                                                                                                                                                   | packages/contracts/dist/capability.d.ts:54                                                                                       |
| `resource.owner?`                           | `public`   | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \} | packages/contracts/dist/capability.d.ts:55                                                                                       |
| `resource.path`                             | `public`   | `string`[]                                                                                                                                                                                                 | packages/contracts/dist/capability.d.ts:53                                                                                       |

---

### AuthorizeOptions

Defined in: [packages/core/src/authorization.ts:69](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L69)

#### Properties

| Property                                 | Modifier   | Type      | Description                                                                                                                            | Defined in                                                                                                                       |
| ---------------------------------------- | ---------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-consume"></a> `consume?` | `readonly` | `boolean` | Consumption is reserved for execution. Discovery calls must leave this false so merely viewing a catalog cannot spend a bounded grant. | [packages/core/src/authorization.ts:74](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L74) |

---

### CapabilityAuthorizerOptions

Defined in: [packages/core/src/authorization.ts:77](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L77)

#### Properties

| Property                                                                   | Modifier   | Type                                                  | Description                                                                                                          | Defined in                                                                                                                       |
| -------------------------------------------------------------------------- | ---------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-delegationresolver"></a> `delegationResolver?`             | `readonly` | [`DelegationChainResolver`](#delegationchainresolver) | Trusted ancestor lookup for delegated grants. Without it, a grant that claims a parent can never authorize anything. | [packages/core/src/authorization.ts:84](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L84) |
| <a id="property-grantverifier"></a> `grantVerifier?`                       | `readonly` | [`CapabilityGrantVerifier`](#capabilitygrantverifier) | -                                                                                                                    | [packages/core/src/authorization.ts:79](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L79) |
| <a id="property-maxdelegationchainlength"></a> `maxDelegationChainLength?` | `readonly` | `number`                                              | -                                                                                                                    | [packages/core/src/authorization.ts:85](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L85) |
| <a id="property-usagestore"></a> `usageStore?`                             | `readonly` | [`GrantUsageStore`](#grantusagestore)                 | -                                                                                                                    | [packages/core/src/authorization.ts:78](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L78) |

---

### CapabilityGrantVerifier

Defined in: [packages/core/src/authorization.ts:65](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L65)

#### Methods

##### verify()

> **verify**(`grant`, `context`): `Promise`\<`boolean`>\>

Defined in: [packages/core/src/authorization.ts:66](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L66)

###### Parameters

| Parameter                            | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `grant`                              | \{ `capabilities`: `object`[]; `constraints`: \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}; `id`: `string`; `issuedAt`: `string`; `issuer`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `namespaceId`: `string`; `parentGrantId?`: `string`; `revokedAt?`: `string`; `subject`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \} |
| `grant.capabilities`                 | `object`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `grant.constraints`                  | \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `grant.constraints.delegationDepth?` | `number`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `grant.constraints.expiresAt?`       | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `grant.constraints.maxUses?`         | `number`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `grant.constraints.notBefore?`       | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `grant.constraints.purposes?`        | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `grant.id`                           | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `grant.issuedAt`                     | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `grant.issuer`                       | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `grant.metadata?`                    | [`JsonObject`](sharedos-contracts.md#jsonobject)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `grant.namespaceId`                  | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `grant.parentGrantId?`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `grant.revokedAt?`                   | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `grant.subject`                      | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context`                            | \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \}                   |
| `context.actor`                      | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.authority`                  | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.enabledToolNamespaces`      | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.namespaceId`                | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `context.now`                        | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `context.owner`                      | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.purpose`                    | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `context.traceId`                    | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

###### Returns

`Promise`\<`boolean`\>

---

### ContextToolProvider

Defined in: [packages/core/src/tool-registry.ts:29](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/tool-registry.ts#L29)

Supplies tools for exactly one trusted access context.

Hosts use this port for user-specific MCP servers and other dynamic catalogs
instead of mutating one global registry shared by concurrent users.

#### Properties

| Property                      | Modifier   | Type     | Defined in                                                                                                                       |
| ----------------------------- | ---------- | -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-id"></a> `id` | `readonly` | `string` | [packages/core/src/tool-registry.ts:30](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/tool-registry.ts#L30) |

#### Methods

##### listTools()

> **listTools**(`context`, `signal`): `Promise`\<readonly [`ToolHandler`](#toolhandler)[]\>

Defined in: [packages/core/src/tool-registry.ts:31](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/tool-registry.ts#L31)

###### Parameters

| Parameter                       | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context`                       | \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \} |
| `context.actor`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.authority`             | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.enabledToolNamespaces` | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.namespaceId`           | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.now`                   | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.owner`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.purpose`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.traceId`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `signal`                        | `AbortSignal`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

###### Returns

`Promise`\<readonly [`ToolHandler`](#toolhandler)[]\>

---

### DelegationChainResolver

Defined in: [packages/core/src/delegation.ts:28](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/delegation.ts#L28)

The trusted lookup for ancestors of a derived grant.

A delegated grant travels with a parent identifier, never with its parent's
contents, so the ancestor must be loaded from an authoritative source. An
implementation must resolve only within the requested namespace and must
throw rather than return a partial or stale ancestor.

#### Methods

##### resolve()

> **resolve**(`namespaceId`, `grantId`): `Promise`\<\{ `capabilities`: `object`[]; `constraints`: \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}; `id`: `string`; `issuedAt`: `string`; `issuer`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `namespaceId`: `string`; `parentGrantId?`: `string`; `revokedAt?`: `string`; `subject`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \} \| `undefined`>\>

Defined in: [packages/core/src/delegation.ts:29](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/delegation.ts#L29)

###### Parameters

| Parameter     | Type     |
| ------------- | -------- |
| `namespaceId` | `string` |
| `grantId`     | `string` |

###### Returns

`Promise`\<\{ `capabilities`: `object`[]; `constraints`: \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}; `id`: `string`; `issuedAt`: `string`; `issuer`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `namespaceId`: `string`; `parentGrantId?`: `string`; `revokedAt?`: `string`; `subject`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \} \| `undefined`\>

---

### DelegationValidationOptions

Defined in: [packages/core/src/delegation.ts:64](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/delegation.ts#L64)

#### Properties

| Property                                               | Modifier   | Type                                                  | Defined in                                                                                                                 |
| ------------------------------------------------------ | ---------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-maxchainlength"></a> `maxChainLength?` | `readonly` | `number`                                              | [packages/core/src/delegation.ts:66](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/delegation.ts#L66) |
| <a id="property-resolver"></a> `resolver?`             | `readonly` | [`DelegationChainResolver`](#delegationchainresolver) | [packages/core/src/delegation.ts:65](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/delegation.ts#L65) |

---

### DeriveGrantRequest

Defined in: [packages/core/src/delegation.ts:278](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/delegation.ts#L278)

#### Properties

| Property                                          | Modifier   | Type                                                                                                                                                                                                       | Description                                                                      | Defined in                                                                                                                   |
| ------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-capabilities"></a> `capabilities` | `readonly` | readonly `object`[]                                                                                                                                                                                        | The subset being passed on. Must be within the parent, capability by capability. | [packages/core/src/delegation.ts:284](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/delegation.ts#L284) |
| <a id="property-constraints"></a> `constraints?`  | `readonly` | `Omit`\<\{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}, `"delegationDepth"`\> & `object`                               | -                                                                                | [packages/core/src/delegation.ts:285](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/delegation.ts#L285) |
| <a id="property-id-1"></a> `id`                   | `readonly` | `string`                                                                                                                                                                                                   | Identifier for the derived grant. Must be unique within the namespace.           | [packages/core/src/delegation.ts:280](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/delegation.ts#L280) |
| <a id="property-issuedat"></a> `issuedAt`         | `readonly` | `string`                                                                                                                                                                                                   | -                                                                                | [packages/core/src/delegation.ts:288](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/delegation.ts#L288) |
| <a id="property-metadata-1"></a> `metadata?`      | `readonly` | [`JsonObject`](sharedos-contracts.md#jsonobject)                                                                                                                                                           | -                                                                                | [packages/core/src/delegation.ts:289](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/delegation.ts#L289) |
| <a id="property-subject"></a> `subject`           | `readonly` | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \} | Who receives the derived authority.                                              | [packages/core/src/delegation.ts:282](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/delegation.ts#L282) |

---

### GrantSource

Defined in: [packages/core/src/authority.ts:92](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L92)

The trusted boundary that loads authoritative grants.

This is the only way authority enters SharedOS. An implementation must answer
from the issuing store rather than from anything the caller supplied, and it
must return exactly the active grants issued to `context.actor` by
`context.authority` inside `context.namespaceId`. Returning material outside
that scope, or material that does not satisfy the grant contract, is treated
as an unavailable source rather than as partial authority.

Throwing is the correct response to an outage. SharedOS converts it into a
fail-closed denial; it never falls back to a cached or caller-supplied set.

#### Methods

##### load()

> **load**(`context`, `signal`): `Promise`\<readonly `object`[]\>

Defined in: [packages/core/src/authority.ts:93](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L93)

###### Parameters

| Parameter                       | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context`                       | \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \} |
| `context.actor`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.authority`             | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.enabledToolNamespaces` | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.namespaceId`           | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.now`                   | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.owner`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.purpose`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.traceId`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `signal`                        | `AbortSignal`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

###### Returns

`Promise`\<readonly `object`[]\>

---

### GrantUsageStore

Defined in: [packages/core/src/authorization.ts:60](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L60)

#### Methods

##### getUsage()

> **getUsage**(`namespaceId`, `grantId`): `Promise`\<`number`>\>

Defined in: [packages/core/src/authorization.ts:61](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L61)

###### Parameters

| Parameter     | Type     |
| ------------- | -------- |
| `namespaceId` | `string` |
| `grantId`     | `string` |

###### Returns

`Promise`\<`number`\>

##### tryConsume()

> **tryConsume**(`namespaceId`, `grantId`, `maximumUses`): `Promise`\<`boolean`>\>

Defined in: [packages/core/src/authorization.ts:62](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L62)

###### Parameters

| Parameter     | Type     |
| ------------- | -------- |
| `namespaceId` | `string` |
| `grantId`     | `string` |
| `maximumUses` | `number` |

###### Returns

`Promise`\<`boolean`\>

---

### KernelOperationOptions

Defined in: [packages/core/src/kernel.ts:78](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L78)

#### Properties

| Property                               | Modifier   | Type          | Defined in                                                                                                         |
| -------------------------------------- | ---------- | ------------- | ------------------------------------------------------------------------------------------------------------------ |
| <a id="property-signal"></a> `signal?` | `readonly` | `AbortSignal` | [packages/core/src/kernel.ts:79](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L79) |

---

### MessageCapabilityResolver

Defined in: [packages/core/src/message-service.ts:35](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/message-service.ts#L35)

#### Methods

##### resolve()

> **resolve**(`context`, `envelope`): [`AuthorizationRequest`](#authorizationrequest)

Defined in: [packages/core/src/message-service.ts:36](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/message-service.ts#L36)

###### Parameters

| Parameter                       | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context`                       | \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \} |
| `context.actor`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.authority`             | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.enabledToolNamespaces` | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.namespaceId`           | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.now`                   | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.owner`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.purpose`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.traceId`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `envelope`                      | \{ `createdAt`: `string`; `id`: `string`; `intent`: `string`; `payload`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `provenance?`: \{ `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}; `purpose`: `string`; `receiver`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `replyTo?`: `string`; `sender`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `traceId`: `string`; `version`: `"1"`; \}     |
| `envelope.createdAt`            | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `envelope.id`                   | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `envelope.intent`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `envelope.payload`              | [`JsonValue`](sharedos-contracts.md#jsonvalue)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `envelope.provenance?`          | \{ `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `envelope.provenance.metadata?` | [`JsonObject`](sharedos-contracts.md#jsonobject)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `envelope.provenance.parentIds` | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `envelope.provenance.source`    | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `envelope.purpose`              | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `envelope.receiver`             | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `envelope.replyTo?`             | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `envelope.sender`               | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `envelope.traceId`              | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `envelope.version`              | `"1"`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

###### Returns

[`AuthorizationRequest`](#authorizationrequest)

---

### MessageTransport

Defined in: [packages/core/src/message-service.ts:27](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/message-service.ts#L27)

#### Methods

##### deliver()

> **deliver**(`context`, `envelope`, `signal`): `Promise`\<\{ `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"accepted"`; `timestamp`: `string`; \} \| \{ `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"delivered"`; `timestamp`: `string`; \} \| \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"denied"`; `timestamp`: `string`; \} \| \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"failed"`; `timestamp`: `string`; \}\>

Defined in: [packages/core/src/message-service.ts:28](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/message-service.ts#L28)

###### Parameters

| Parameter                       | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context`                       | \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \} |
| `context.actor`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.authority`             | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.enabledToolNamespaces` | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.namespaceId`           | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.now`                   | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.owner`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.purpose`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.traceId`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `envelope`                      | \{ `createdAt`: `string`; `id`: `string`; `intent`: `string`; `payload`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `provenance?`: \{ `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}; `purpose`: `string`; `receiver`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `replyTo?`: `string`; `sender`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `traceId`: `string`; `version`: `"1"`; \}     |
| `envelope.createdAt`            | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `envelope.id`                   | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `envelope.intent`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `envelope.payload`              | [`JsonValue`](sharedos-contracts.md#jsonvalue)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `envelope.provenance?`          | \{ `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `envelope.provenance.metadata?` | [`JsonObject`](sharedos-contracts.md#jsonobject)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `envelope.provenance.parentIds` | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `envelope.provenance.source`    | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `envelope.purpose`              | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `envelope.receiver`             | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `envelope.replyTo?`             | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `envelope.sender`               | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `envelope.traceId`              | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `envelope.version`              | `"1"`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `signal`                        | `AbortSignal`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

###### Returns

`Promise`\<\{ `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"accepted"`; `timestamp`: `string`; \} \| \{ `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"delivered"`; `timestamp`: `string`; \} \| \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"denied"`; `timestamp`: `string`; \} \| \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"failed"`; `timestamp`: `string`; \}\>

---

### ResolvedAuthority

Defined in: [packages/core/src/authority.ts:128](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L128)

An access context together with the authority a trusted source produced for
it.

Authority is deliberately held beside the context rather than merged into it,
so a resolved authority can never be passed to a provider, tool handler,
message transport, or runtime that expects an `AccessContext`.

#### Properties

| Property                                  | Modifier   | Type                                                                                                                                                                                                       | Defined in                                                                                                                 |
| ----------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-context"></a> `context`   | `readonly` | `object`                                                                                                                                                                                                   | [packages/core/src/authority.ts:129](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L129) |
| `context.actor`                           | `public`   | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \} | packages/contracts/dist/access.d.ts:144                                                                                    |
| `context.authority`                       | `public`   | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \} | packages/contracts/dist/access.d.ts:157                                                                                    |
| `context.enabledToolNamespaces`           | `public`   | `string`[]                                                                                                                                                                                                 | packages/contracts/dist/access.d.ts:170                                                                                    |
| `context.namespaceId`                     | `public`   | `string`                                                                                                                                                                                                   | packages/contracts/dist/access.d.ts:141                                                                                    |
| `context.now`                             | `public`   | `string`                                                                                                                                                                                                   | packages/contracts/dist/access.d.ts:171                                                                                    |
| `context.owner`                           | `public`   | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \} | packages/contracts/dist/access.d.ts:128                                                                                    |
| `context.purpose`                         | `public`   | `string`                                                                                                                                                                                                   | packages/contracts/dist/access.d.ts:142                                                                                    |
| `context.traceId`                         | `public`   | `string`                                                                                                                                                                                                   | packages/contracts/dist/access.d.ts:143                                                                                    |
| <a id="property-grants"></a> `grants`     | `readonly` | readonly `object`[]                                                                                                                                                                                        | [packages/core/src/authority.ts:130](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L130) |
| <a id="property-snapshot"></a> `snapshot` | `readonly` | [`AuthoritySnapshot`](#authoritysnapshot)                                                                                                                                                                  | [packages/core/src/authority.ts:131](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L131) |

---

### ResourceInvocationRequest

Defined in: [packages/core/src/resource-registry.ts:10](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/resource-registry.ts#L10)

#### Properties

| Property                                          | Modifier   | Type                                                                                                                                                                                                       | Defined in                                                                                                                               |
| ------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-action-2"></a> `action`           | `readonly` | `string`                                                                                                                                                                                                   | [packages/core/src/resource-registry.ts:13](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/resource-registry.ts#L13) |
| <a id="property-input"></a> `input?`              | `readonly` | [`JsonValue`](sharedos-contracts.md#jsonvalue)                                                                                                                                                             | [packages/core/src/resource-registry.ts:14](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/resource-registry.ts#L14) |
| <a id="property-metadata-2"></a> `metadata?`      | `readonly` | [`JsonObject`](sharedos-contracts.md#jsonobject)                                                                                                                                                           | [packages/core/src/resource-registry.ts:15](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/resource-registry.ts#L15) |
| <a id="property-operationid-1"></a> `operationId` | `readonly` | `string`                                                                                                                                                                                                   | [packages/core/src/resource-registry.ts:11](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/resource-registry.ts#L11) |
| <a id="property-resource-2"></a> `resource`       | `readonly` | `object`                                                                                                                                                                                                   | [packages/core/src/resource-registry.ts:12](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/resource-registry.ts#L12) |
| `resource.namespace`                              | `public`   | `string`                                                                                                                                                                                                   | packages/contracts/dist/capability.d.ts:54                                                                                               |
| `resource.owner?`                                 | `public`   | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \} | packages/contracts/dist/capability.d.ts:55                                                                                               |
| `resource.path`                                   | `public`   | `string`[]                                                                                                                                                                                                 | packages/contracts/dist/capability.d.ts:53                                                                                               |

---

### ResourceProvider

Defined in: [packages/core/src/resource-registry.ts:18](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/resource-registry.ts#L18)

#### Properties

| Property                                    | Modifier   | Type     | Defined in                                                                                                                               |
| ------------------------------------------- | ---------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-namespace"></a> `namespace` | `readonly` | `string` | [packages/core/src/resource-registry.ts:19](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/resource-registry.ts#L19) |

#### Methods

##### invoke()

> **invoke**(`operation`, `signal`): `Promise`\<\{ `completedAt`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `operationId`: `string`; `output`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `status`: `"succeeded"`; \} \| \{ `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `operationId`: `string`; `status`: `"denied"`; \} \| \{ `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `operationId`: `string`; `status`: `"failed"`; \}\>

Defined in: [packages/core/src/resource-registry.ts:20](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/resource-registry.ts#L20)

###### Parameters

| Parameter                                 | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `operation`                               | \{ `action`: `string`; `context`: \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \}; `input?`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `operationId`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; \} |
| `operation.action`                        | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `operation.context`                       | \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `operation.context.actor`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `operation.context.authority`             | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `operation.context.enabledToolNamespaces` | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `operation.context.namespaceId`           | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `operation.context.now`                   | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `operation.context.owner`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `operation.context.purpose`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `operation.context.traceId`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `operation.input?`                        | [`JsonValue`](sharedos-contracts.md#jsonvalue)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `operation.metadata?`                     | [`JsonObject`](sharedos-contracts.md#jsonobject)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `operation.operationId`                   | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `operation.resource`                      | \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `operation.resource.namespace`            | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `operation.resource.owner?`               | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `operation.resource.path`                 | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `signal`                                  | `AbortSignal`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

###### Returns

`Promise`\<\{ `completedAt`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `operationId`: `string`; `output`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `status`: `"succeeded"`; \} \| \{ `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `operationId`: `string`; `status`: `"denied"`; \} \| \{ `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `operationId`: `string`; `status`: `"failed"`; \}\>

---

### SharedOSKernelOptions

Defined in: [packages/core/src/kernel.ts:60](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L60)

#### Properties

| Property                                                                     | Modifier   | Type                                                        | Description                                                                                                                  | Defined in                                                                                                         |
| ---------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| <a id="property-audit"></a> `audit?`                                         | `readonly` | [`AuditSink`](#auditsink)                                   | -                                                                                                                            | [packages/core/src/kernel.ts:73](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L73) |
| <a id="property-authorizer"></a> `authorizer?`                               | `readonly` | [`CapabilityAuthorizer`](#capabilityauthorizer)             | -                                                                                                                            | [packages/core/src/kernel.ts:66](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L66) |
| <a id="property-grantsource"></a> `grantSource`                              | `readonly` | [`GrantSource`](#grantsource)                               | The trusted boundary that loads authority. It is required: a kernel with no authoritative grant source can only fail closed. | [packages/core/src/kernel.ts:65](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L65) |
| <a id="property-messagecapabilityresolver"></a> `messageCapabilityResolver?` | `readonly` | [`MessageCapabilityResolver`](#messagecapabilityresolver)   | -                                                                                                                            | [packages/core/src/kernel.ts:72](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L72) |
| <a id="property-messagetransport"></a> `messageTransport?`                   | `readonly` | [`MessageTransport`](#messagetransport)                     | -                                                                                                                            | [packages/core/src/kernel.ts:71](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L71) |
| <a id="property-onauditerror"></a> `onAuditError?`                           | `readonly` | (`error`, `event`) => `void` \| `Promise`\<`void`\>         | Notification for audit failures that occur after a side effect.                                                              | [packages/core/src/kernel.ts:75](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L75) |
| <a id="property-resources"></a> `resources?`                                 | `readonly` | [`ResourceProviderRegistry`](#resourceproviderregistry)     | -                                                                                                                            | [packages/core/src/kernel.ts:67](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L67) |
| <a id="property-toolnamespacesettings"></a> `toolNamespaceSettings?`         | `readonly` | [`ToolNamespaceSettingsStore`](#toolnamespacesettingsstore) | -                                                                                                                            | [packages/core/src/kernel.ts:70](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L70) |
| <a id="property-toolproviders"></a> `toolProviders?`                         | `readonly` | readonly [`ContextToolProvider`](#contexttoolprovider)[]    | -                                                                                                                            | [packages/core/src/kernel.ts:69](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L69) |
| <a id="property-tools"></a> `tools?`                                         | `readonly` | [`ToolRegistry`](#toolregistry)                             | -                                                                                                                            | [packages/core/src/kernel.ts:68](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L68) |

---

### ToolHandler

Defined in: [packages/core/src/tool-registry.ts:14](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/tool-registry.ts#L14)

#### Properties

| Property                                                       | Modifier   | Type                                                                                                                                                                                                       | Description                                                                | Defined in                                                                                                                       |
| -------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-definition"></a> `definition`                  | `readonly` | `object`                                                                                                                                                                                                   | -                                                                          | [packages/core/src/tool-registry.ts:15](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/tool-registry.ts#L15) |
| `definition.annotations?`                                      | `public`   | `object`                                                                                                                                                                                                   | -                                                                          | packages/contracts/dist/tool.d.ts:287                                                                                            |
| `definition.annotations.destructive?`                          | `public`   | `boolean`                                                                                                                                                                                                  | -                                                                          | packages/contracts/dist/tool.d.ts:289                                                                                            |
| `definition.annotations.idempotent?`                           | `public`   | `boolean`                                                                                                                                                                                                  | -                                                                          | packages/contracts/dist/tool.d.ts:290                                                                                            |
| `definition.annotations.readOnly?`                             | `public`   | `boolean`                                                                                                                                                                                                  | -                                                                          | packages/contracts/dist/tool.d.ts:288                                                                                            |
| `definition.description`                                       | `public`   | `string`                                                                                                                                                                                                   | -                                                                          | packages/contracts/dist/tool.d.ts:261                                                                                            |
| `definition.inputSchema`                                       | `public`   | [`JsonObject`](sharedos-contracts.md#jsonobject)                                                                                                                                                           | -                                                                          | packages/contracts/dist/tool.d.ts:264                                                                                            |
| `definition.metadata?`                                         | `public`   | [`JsonObject`](sharedos-contracts.md#jsonobject)                                                                                                                                                           | -                                                                          | packages/contracts/dist/tool.d.ts:285                                                                                            |
| `definition.name`                                              | `public`   | `string`                                                                                                                                                                                                   | -                                                                          | packages/contracts/dist/tool.d.ts:260                                                                                            |
| `definition.namespace`                                         | `public`   | `string`                                                                                                                                                                                                   | -                                                                          | packages/contracts/dist/tool.d.ts:259                                                                                            |
| `definition.outputSchema?`                                     | `public`   | [`JsonObject`](sharedos-contracts.md#jsonobject)                                                                                                                                                           | -                                                                          | packages/contracts/dist/tool.d.ts:286                                                                                            |
| `definition.readWrite`                                         | `public`   | `"read"` \| `"write"`                                                                                                                                                                                      | -                                                                          | packages/contracts/dist/tool.d.ts:263                                                                                            |
| `definition.requiredCapability`                                | `public`   | `object`                                                                                                                                                                                                   | -                                                                          | packages/contracts/dist/tool.d.ts:265                                                                                            |
| `definition.requiredCapability.action`                         | `public`   | `string`                                                                                                                                                                                                   | -                                                                          | packages/contracts/dist/tool.d.ts:283                                                                                            |
| `definition.requiredCapability.resource`                       | `public`   | `object`                                                                                                                                                                                                   | -                                                                          | packages/contracts/dist/tool.d.ts:266                                                                                            |
| `definition.requiredCapability.resource.namespace`             | `public`   | `string`                                                                                                                                                                                                   | -                                                                          | packages/contracts/dist/tool.d.ts:268                                                                                            |
| `definition.requiredCapability.resource.owner?`                | `public`   | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \} | -                                                                          | packages/contracts/dist/tool.d.ts:269                                                                                            |
| `definition.requiredCapability.resource.path`                  | `public`   | `string`[]                                                                                                                                                                                                 | -                                                                          | packages/contracts/dist/tool.d.ts:267                                                                                            |
| `definition.source`                                            | `public`   | `string`                                                                                                                                                                                                   | -                                                                          | packages/contracts/dist/tool.d.ts:262                                                                                            |
| <a id="property-parsearguments"></a> `parseArguments`          | `readonly` | (`arguments_`) => `unknown`                                                                                                                                                                                | Parse and normalize untrusted arguments before authorization or execution. | [packages/core/src/tool-registry.ts:17](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/tool-registry.ts#L17) |
| <a id="property-resolverequirement"></a> `resolveRequirement?` | `readonly` | (`context`, `call`) => [`AuthorizationRequest`](#authorizationrequest)                                                                                                                                     | Resolve argument-selected resources immediately before execution.          | [packages/core/src/tool-registry.ts:19](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/tool-registry.ts#L19) |

#### Methods

##### invoke()

> **invoke**(`context`, `call`, `signal`): `Promise`\<\{ `callId`: `string`; `completedAt`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `output`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `status`: `"succeeded"`; `tool`: `string`; \} \| \{ `callId`: `string`; `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"denied"`; `tool`: `string`; \} \| \{ `callId`: `string`; `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"failed"`; `tool`: `string`; \}\>

Defined in: [packages/core/src/tool-registry.ts:20](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/tool-registry.ts#L20)

###### Parameters

| Parameter                       | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context`                       | \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \} |
| `context.actor`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.authority`             | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.enabledToolNamespaces` | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.namespaceId`           | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.now`                   | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.owner`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.purpose`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.traceId`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `call`                          | \{ `arguments`: [`JsonObject`](sharedos-contracts.md#jsonobject); `id`: `string`; `requestedAt`: `string`; `tool`: `string`; `traceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `call.arguments`                | [`JsonObject`](sharedos-contracts.md#jsonobject)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `call.id`                       | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `call.requestedAt`              | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `call.tool`                     | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `call.traceId`                  | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `signal`                        | `AbortSignal`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

###### Returns

`Promise`\<\{ `callId`: `string`; `completedAt`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `output`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `status`: `"succeeded"`; `tool`: `string`; \} \| \{ `callId`: `string`; `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"denied"`; `tool`: `string`; \} \| \{ `callId`: `string`; `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"failed"`; `tool`: `string`; \}\>

---

### ToolNamespaceSettingsStore

Defined in: [packages/core/src/tool-namespace-control.ts:11](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/tool-namespace-control.ts#L11)

Host-owned persistence and product-policy boundary for namespace settings.

Implementations must apply a patch atomically against fresh state and return
the authoritative effective selection. They may narrow the result according
to organization policy, but must never widen it beyond trusted host policy.

#### Methods

##### applyUpdate()

> **applyUpdate**(`context`, `update`, `signal`): `Promise`\<readonly `string`[]\>

Defined in: [packages/core/src/tool-namespace-control.ts:12](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/tool-namespace-control.ts#L12)

###### Parameters

| Parameter                       | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context`                       | \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \} |
| `context.actor`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.authority`             | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.enabledToolNamespaces` | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.namespaceId`           | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.now`                   | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.owner`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.purpose`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.traceId`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `update`                        | \{ `disable?`: `string`[]; `enable?`: `string`[]; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `update.disable?`               | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `update.enable?`                | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `signal`                        | `AbortSignal`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

###### Returns

`Promise`\<readonly `string`[]\>

## Type Aliases

### AuditEventType

> **AuditEventType** = `"authority.resolved"` \| `"authorization.checked"` \| `"escalation.requested"` \| `"resource.invoked"` \| `"tool.catalog.listed"` \| `"tool.namespace.catalog.listed"` \| `"tool.namespace.selection.updated"` \| `"tool.invoked"` \| `"message.sent"`

Defined in: [packages/core/src/audit.ts:3](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L3)

---

### AuditOutcome

> **AuditOutcome** = `"allowed"` \| `"denied"` \| `"succeeded"` \| `"failed"` \| `"escalated"`

Defined in: [packages/core/src/audit.ts:21](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L21)

`escalated` is its own outcome, not a denial.

A denial is a decision SharedOS made. An escalation is a decision it declined
to make and handed to a human, and counting the two together would inflate
every denial rate by the cases where the system correctly asked for help.

---

### AuthorityResolution

> **AuthorityResolution** = \{ `authority`: [`ResolvedAuthority`](#resolvedauthority); `status`: `"resolved"`; \} \| \{ `code`: [`AuthorityUnavailableCode`](#authorityunavailablecode); `status`: `"unavailable"`; \}

Defined in: [packages/core/src/authority.ts:134](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L134)

---

### AuthorityUnavailableCode

> **AuthorityUnavailableCode** = `"grant_source_failed"` \| `"invalid_grant_material"` \| `"grant_scope_mismatch"` \| `"grant_limit_exceeded"`

Defined in: [packages/core/src/authority.ts:97](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L97)

Why authority could not be established for one decision.

---

### AuthorizationReasonCode

> **AuthorizationReasonCode** = `"allowed"` \| `"invalid_context"` \| `"invalid_request"` \| `"no_matching_grant"` \| `"grant_exhausted"` \| `"delegation_chain_invalid"` \| `"authority_unavailable"` \| `"delegation_chain_unverified"` \| `"usage_store_unavailable"`

Defined in: [packages/core/src/authorization.ts:31](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L31)

---

### DelegationRefusal

> **DelegationRefusal** = `"empty_capabilities"` \| `"id_collides_with_parent"` \| `"bounded_parent_not_delegable"` \| `"parent_not_delegable"` \| `"depth_exhausted"` \| `"capability_not_within_parent"` \| `"purpose_not_within_parent"` \| `"window_not_within_parent"` \| `"issued_before_parent"`

Defined in: [packages/core/src/delegation.ts:263](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/delegation.ts#L263)

Why a delegation was refused at the point it was issued.

---

### DelegationUnverifiedCode

> **DelegationUnverifiedCode** = `"resolver_unavailable"` \| `"parent_not_found"` \| `"resolver_failed"`

Defined in: [packages/core/src/delegation.ts:46](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/delegation.ts#L46)

The chain could not be established, which is never treated as valid.

---

### DelegationValidation

> **DelegationValidation** = \{ `chain`: readonly `string`[]; `status`: `"valid"`; \} \| \{ `chain`: readonly `string`[]; `code`: [`DelegationViolationCode`](#delegationviolationcode); `grantId`: `string`; `status`: `"invalid"`; \} \| \{ `chain`: readonly `string`[]; `code`: [`DelegationUnverifiedCode`](#delegationunverifiedcode); `grantId`: `string`; `status`: `"unverified"`; \}

Defined in: [packages/core/src/delegation.ts:49](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/delegation.ts#L49)

---

### DelegationViolationCode

> **DelegationViolationCode** = `"delegation_not_permitted"` \| `"delegation_depth_exceeded"` \| `"bounded_parent_not_delegable"` \| `"issuer_not_parent_subject"` \| `"namespace_mismatch"` \| `"parent_inactive"` \| `"capability_widened"` \| `"constraints_widened"` \| `"chain_cycle"` \| `"chain_too_long"`

Defined in: [packages/core/src/delegation.ts:33](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/delegation.ts#L33)

A structural rule the presented chain broke.

---

### DeriveGrantResult

> **DeriveGrantResult** = \{ `grant`: [`CapabilityGrant`](sharedos-contracts.md#capabilitygrant); `ok`: `true`; \} \| \{ `ok`: `false`; `reason`: [`DelegationRefusal`](#delegationrefusal); \}

Defined in: [packages/core/src/delegation.ts:274](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/delegation.ts#L274)

---

### TurnAuthorityScope

> **TurnAuthorityScope** = `object`

Defined in: [packages/core/src/authority.ts:70](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L70)

A handle on one turn's frozen authority.

The handle reports whether authority could be established at the turn
boundary so a caller can refuse admission, and carries the snapshot the whole
turn will be decided against. It deliberately exposes no grants: like
[ResolvedAuthority](#resolvedauthority), it is not assignable to an `AccessContext`, so it
cannot reach a provider, tool handler, transport, or runtime.

`close` is idempotent and must run on every path out of the turn, including
cancellation. An unclosed lease keeps a stale authority state answering for
any later operation that presents the same turn identity.

#### Properties

##### code?

> `readonly` `optional` **code?**: [`AuthorityUnavailableCode`](#authorityunavailablecode)

Defined in: [packages/core/src/authority.ts:75](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L75)

Present when it was not.

##### snapshot?

> `readonly` `optional` **snapshot?**: [`AuthoritySnapshot`](#authoritysnapshot)

Defined in: [packages/core/src/authority.ts:73](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L73)

Present when authority was established.

##### status

> `readonly` **status**: `"resolved"` \| `"unavailable"`

Defined in: [packages/core/src/authority.ts:71](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L71)

#### Methods

##### close()

> **close**(): `void`

Defined in: [packages/core/src/authority.ts:76](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L76)

###### Returns

`void`

## Variables

### AGENT\_INVOKE\_ACTION

> `const` **AGENT\_INVOKE\_ACTION**: `"invoke"` = `"invoke"`

Defined in: [packages/core/src/kernel.ts:83](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L83)

---

### DEFAULT\_MAX\_DELEGATION\_CHAIN\_LENGTH

> `const` **DEFAULT\_MAX\_DELEGATION\_CHAIN\_LENGTH**: `16` = `16`

Defined in: [packages/core/src/delegation.ts:18](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/delegation.ts#L18)

The longest ancestor chain SharedOS will walk before failing closed.

---

### EXECUTION\_NAMESPACE

> `const` **EXECUTION\_NAMESPACE**: `"sharedos.execution"` = `"sharedos.execution"`

Defined in: [packages/core/src/kernel.ts:82](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L82)

---

### INFRASTRUCTURE\_DENIAL\_REASONS

> `const` **INFRASTRUCTURE\_DENIAL\_REASONS**: readonly [`AuthorizationReasonCode`](#authorizationreasoncode)[]

Defined in: [packages/core/src/authorization.ts:50](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L50)

Denials caused by SharedOS being unable to establish a fact, not by policy.

Fail-closed behaviour makes these look like denials at the call site. An
experiment must separate them from expected permission denials before
computing any rate, so they are named once here and marked `failClosed` in
the audit record.

---

### MAX\_RESOLVED\_GRANTS

> `const` **MAX\_RESOLVED\_GRANTS**: `256` = `256`

Defined in: [packages/core/src/authority.ts:8](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L8)

The largest authority set SharedOS will evaluate for one decision.

---

### MESSAGE\_SEND\_ACTION

> `const` **MESSAGE\_SEND\_ACTION**: `"send"` = `"send"`

Defined in: [packages/core/src/message-service.ts:13](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/message-service.ts#L13)

---

### MESSAGING\_NAMESPACE

> `const` **MESSAGING\_NAMESPACE**: `"sharedos.messaging"` = `"sharedos.messaging"`

Defined in: [packages/core/src/message-service.ts:12](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/message-service.ts#L12)

---

### MID\_TURN\_AUTHORITY\_REFRESH

> `const` **MID\_TURN\_AUTHORITY\_REFRESH**: `false` = `false`

Defined in: [packages/core/src/authority.ts:35](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L35)

The fuse over per-operation authority resolution. Off.

SharedOS originally re-loaded authority from the trusted source for every
kernel operation, so a grant removed from the store part-way through a turn
was refused at the next decision inside that same turn. That path is retained
in [SharedOSKernel](#sharedoskernel) and is re-enabled by setting this to `true`.

It is off because a turn must decide against one authority state. Authority
is now resolved once, at the turn boundary, and every grant removal --
revocation, expiry, purpose withdrawal -- is observed by the _next_ turn. A
request therefore carries the authority it was admitted with, rather than
having authority resolved underneath it while it runs.

TBD Expiry with mid-turn grant refusal.

Expiry is the open question this fuse exists for. A revocation is a store-side
edit and is naturally a next-turn event: SharedOS cannot see it without
re-reading the store. An expiry is different -- it is a property the grant
already carried when the turn began, so refusing it mid-turn costs no store
read and leaks no store state. The two are frozen together today only because
they share one removal check -- `grantIsActive` in `internal.ts` -- which is
evaluated against the instant the turn's authority was resolved. Splitting them is a
semantic decision about what a turn is, not a mechanical one, and is deferred.

## Functions

### addressesEqual()

> **addressesEqual**(`left`, `right`): `boolean`

Defined in: [packages/core/src/internal.ts:19](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/internal.ts#L19)

#### Parameters

| Parameter | Type                                                                                                                                                                                                       |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `left`    | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \} |
| `right`   | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \} |

#### Returns

`boolean`

---

### addressPath()

> **addressPath**(`address`): \[`"human"` \| `"agent"` \| `"group"` \| `"service"`, `string`\]

Defined in: [packages/core/src/message-service.ts:58](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/message-service.ts#L58)

Stable, segment-safe grant path for recipient-scoped messaging.

#### Parameters

| Parameter | Type                                                                                                                                                                                                       |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `address` | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \} |

#### Returns

\[`"human"` \| `"agent"` \| `"group"` \| `"service"`, `string`\]

---

### agentExecutionCapability()

> **agentExecutionCapability**(`agent`, `owner`): `object`

Defined in: [packages/core/src/kernel.ts:85](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L85)

#### Parameters

| Parameter | Type                                                                                                                                                                                                       |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agent`   | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \} |
| `owner`   | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \} |

#### Returns

`object`

##### actions

> **actions**: `string`[]

##### resource

> **resource**: `object`

###### resource.namespace

> **namespace**: `string`

###### resource.owner?

> `optional` **owner?**: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}

###### resource.path

> **path**: `string`[]

##### scope

> **scope**: `"exact"` \| `"descendants"`

---

### applyToolNamespaceUpdate()

> **applyToolNamespaceUpdate**(`current`, `update`): `string`[]

Defined in: [packages/core/src/tool-namespace-control.ts:20](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/tool-namespace-control.ts#L20)

Apply the standard idempotent patch semantics used by host stores.

#### Parameters

| Parameter         | Type                                                 |
| ----------------- | ---------------------------------------------------- |
| `current`         | readonly `string`[]                                  |
| `update`          | \{ `disable?`: `string`[]; `enable?`: `string`[]; \} |
| `update.disable?` | `string`[]                                           |
| `update.enable?`  | `string`[]                                           |

#### Returns

`string`[]

---

### auditEvent()

> **auditEvent**(`context`, `event`): [`AuditEvent`](#auditevent)

Defined in: [packages/core/src/audit.ts:76](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L76)

#### Parameters

| Parameter                       | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context`                       | \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \} |
| `context.actor`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.authority`             | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.enabledToolNamespaces` | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.namespaceId`           | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.now`                   | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.owner`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.purpose`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.traceId`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `event`                         | `Omit`\<[`AuditEvent`](#auditevent), `"version"` \| `"at"` \| `"traceId"` \| `"namespaceId"` \| `"actor"` \| `"authority"` \| `"owner"` \| `"purpose"`\>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

#### Returns

[`AuditEvent`](#auditevent)

---

### canonicalJson()

> **canonicalJson**(`value`): `string`

Defined in: [packages/core/src/internal.ts:4](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/internal.ts#L4)

Structural JSON equality for protocol values with unordered object keys.

#### Parameters

| Parameter | Type      |
| --------- | --------- |
| `value`   | `unknown` |

#### Returns

`string`

---

### capabilityIntersectsCeiling()

> **capabilityIntersectsCeiling**(`capability`, `ceiling`, `context`): `boolean`

Defined in: [packages/core/src/authorization.ts:336](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L336)

#### Parameters

| Parameter                       | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `capability`                    | \{ `actions`: `string`[]; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; `scope`: `"exact"` \| `"descendants"`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `capability.actions`            | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `capability.resource`           | \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `capability.resource.namespace` | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `capability.resource.owner?`    | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `capability.resource.path`      | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `capability.scope`              | `"exact"` \| `"descendants"`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `ceiling`                       | [`AuthorizationRequest`](#authorizationrequest)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `context`                       | \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \} |
| `context.actor`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.authority`             | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.enabledToolNamespaces` | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.namespaceId`           | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.now`                   | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.owner`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.purpose`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.traceId`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

#### Returns

`boolean`

---

### capabilityMatches()

> **capabilityMatches**(`capability`, `request`, `context`): `boolean`

Defined in: [packages/core/src/authorization.ts:308](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L308)

#### Parameters

| Parameter                       | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `capability`                    | \{ `actions`: `string`[]; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; `scope`: `"exact"` \| `"descendants"`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `capability.actions`            | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `capability.resource`           | \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `capability.resource.namespace` | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `capability.resource.owner?`    | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `capability.resource.path`      | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `capability.scope`              | `"exact"` \| `"descendants"`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `request`                       | [`AuthorizationRequest`](#authorizationrequest)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `context`                       | \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \} |
| `context.actor`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.authority`             | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.enabledToolNamespaces` | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.namespaceId`           | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.now`                   | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.owner`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.purpose`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.traceId`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

#### Returns

`boolean`

---

### deriveGrant()

> **deriveGrant**(`parent`, `request`): [`DeriveGrantResult`](#derivegrantresult)

Defined in: [packages/core/src/delegation.ts:388](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/delegation.ts#L388)

Derive a narrower grant from one the delegator already holds.

This is the supported way to produce a grant whose issuer is not the resource
owner. It is a pure function: it never consults a store, never mints
authority the parent does not carry, and refuses rather than clamping when a
request would exceed the parent — a silently clamped delegation reads as
accepted, and the delegator then believes it passed on more than it did.

What it produces is a claim, not a decision. The derived grant names only its
immediate parent, and `validateDelegationChain` re-resolves the ancestors
from the issuing store at every use, because narrowing settles here but
revocation happens afterwards. Deriving a grant is therefore never sufficient
on its own: a host that issues one must also install a
`DelegationChainResolver`.

#### Parameters

| Parameter                             | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `parent`                              | \{ `capabilities`: `object`[]; `constraints`: \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}; `id`: `string`; `issuedAt`: `string`; `issuer`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `namespaceId`: `string`; `parentGrantId?`: `string`; `revokedAt?`: `string`; `subject`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \} |
| `parent.capabilities`                 | `object`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `parent.constraints`                  | \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `parent.constraints.delegationDepth?` | `number`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `parent.constraints.expiresAt?`       | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `parent.constraints.maxUses?`         | `number`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `parent.constraints.notBefore?`       | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `parent.constraints.purposes?`        | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `parent.id`                           | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `parent.issuedAt`                     | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `parent.issuer`                       | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `parent.metadata?`                    | [`JsonObject`](sharedos-contracts.md#jsonobject)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `parent.namespaceId`                  | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `parent.parentGrantId?`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `parent.revokedAt?`                   | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `parent.subject`                      | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `request`                             | [`DeriveGrantRequest`](#derivegrantrequest)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

#### Returns

[`DeriveGrantResult`](#derivegrantresult)

---

### hashJson()

> **hashJson**(`value`): `Promise`\<`string`>\>

Defined in: [packages/core/src/hashing.ts:12](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/hashing.ts#L12)

A stable content identifier for any JSON-safe value.

Object key order never changes the result, so two hosts that serialize the
same state differently still produce the same identifier. Web Crypto is used
rather than `node:crypto` so the kernel stays host-neutral.

#### Parameters

| Parameter | Type      |
| --------- | --------- |
| `value`   | `unknown` |

#### Returns

`Promise`\<`string`\>

---

### isInfrastructureDenial()

> **isInfrastructureDenial**(`reasonCode`): `boolean`

Defined in: [packages/core/src/authorization.ts:56](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L56)

#### Parameters

| Parameter    | Type     |
| ------------ | -------- |
| `reasonCode` | `string` |

#### Returns

`boolean`

---

### messageSendCapability()

> **messageSendCapability**(`receiver`, `owner`): `object`

Defined in: [packages/core/src/message-service.ts:15](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/message-service.ts#L15)

#### Parameters

| Parameter  | Type                                                                                                                                                                                                       |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `receiver` | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \} |
| `owner`    | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \} |

#### Returns

`object`

##### actions

> **actions**: `string`[]

##### resource

> **resource**: `object`

###### resource.namespace

> **namespace**: `string`

###### resource.owner?

> `optional` **owner?**: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}

###### resource.path

> **path**: `string`[]

##### scope

> **scope**: `"exact"` \| `"descendants"`

---

### sha256Hex()

> **sha256Hex**(`value`): `Promise`\<`string`>\>

Defined in: [packages/core/src/hashing.ts:16](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/hashing.ts#L16)

#### Parameters

| Parameter | Type     |
| --------- | -------- |
| `value`   | `string` |

#### Returns

`Promise`\<`string`\>

---

### toResourceOperation()

> **toResourceOperation**(`context`, `request`): `object`

Defined in: [packages/core/src/resource-registry.ts:50](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/resource-registry.ts#L50)

#### Parameters

| Parameter                       | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context`                       | \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \} |
| `context.actor`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.authority`             | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.enabledToolNamespaces` | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.namespaceId`           | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.now`                   | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.owner`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.purpose`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.traceId`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `request`                       | [`ResourceInvocationRequest`](#resourceinvocationrequest)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

#### Returns

`object`

##### action

> **action**: `string`

##### context

> **context**: `object`

###### context.actor

> **actor**: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}

###### context.authority

> **authority**: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}

###### context.enabledToolNamespaces

> **enabledToolNamespaces**: `string`[]

###### context.namespaceId

> **namespaceId**: `string`

###### context.now

> **now**: `string`

###### context.owner

> **owner**: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}

###### context.purpose

> **purpose**: `string`

###### context.traceId

> **traceId**: `string`

##### input?

> `optional` **input?**: [`JsonValue`](sharedos-contracts.md#jsonvalue)

##### metadata?

> `optional` **metadata?**: [`JsonObject`](sharedos-contracts.md#jsonobject)

##### operationId

> **operationId**: `string`

##### resource

> **resource**: `object`

###### resource.namespace

> **namespace**: `string`

###### resource.owner?

> `optional` **owner?**: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}

###### resource.path

> **path**: `string`[]

---

### turnAuthorityKey()

> **turnAuthorityKey**(`context`): `string`

Defined in: [packages/core/src/authority.ts:46](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L46)

The identity a turn's frozen authority is held against.

`now` is excluded because the turn instant is precisely what a lease freezes,
and `enabledToolNamespaces` is excluded because namespace enablement is host
state that stays live per operation and is never read by an authorization
decision. Every other field an authorization decision reads is in the key, so
a lease can never answer for a context it was not resolved for.

#### Parameters

| Parameter                       | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context`                       | \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \} |
| `context.actor`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.authority`             | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.enabledToolNamespaces` | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.namespaceId`           | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.now`                   | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.owner`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.purpose`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.traceId`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

#### Returns

`string`

---

### validateDelegationChain()

> **validateDelegationChain**(`grant`, `context`, `now`, `options?`): `Promise`\<[`DelegationValidation`](#delegationvalidation)>\>

Defined in: [packages/core/src/delegation.ts:91](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/delegation.ts#L91)

Validate the complete ancestor chain of one grant.

A grant without `parentGrantId` is a root grant and is valid here; its own
expiry, revocation, and purpose remain the caller's separate check. For a
derived grant every link must satisfy all of:

- the child's issuer is exactly the parent's subject;
- both grants live in the same namespace;
- the parent is itself active for the requested purpose at `now`, so
  revoking or expiring an ancestor invalidates every descendant;
- every child capability is covered by one parent capability;
- time window and purposes never widen;
- the parent holds delegation budget and the child's budget is strictly
  smaller;
- the parent is not itself bounded by `maxUses`. Usage counters are per
  grant, so n children of a k-use parent would carry n*k uses between them.
  Sharing one budget across a chain needs accounting that spans grants, and
  until that exists the parent is refused rather than multiplied.

Anything the resolver cannot establish returns `unverified`, never `valid`.

#### Parameters

| Parameter                            | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `grant`                              | \{ `capabilities`: `object`[]; `constraints`: \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}; `id`: `string`; `issuedAt`: `string`; `issuer`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `namespaceId`: `string`; `parentGrantId?`: `string`; `revokedAt?`: `string`; `subject`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \} |
| `grant.capabilities`                 | `object`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `grant.constraints`                  | \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `grant.constraints.delegationDepth?` | `number`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `grant.constraints.expiresAt?`       | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `grant.constraints.maxUses?`         | `number`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `grant.constraints.notBefore?`       | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `grant.constraints.purposes?`        | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `grant.id`                           | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `grant.issuedAt`                     | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `grant.issuer`                       | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `grant.metadata?`                    | [`JsonObject`](sharedos-contracts.md#jsonobject)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `grant.namespaceId`                  | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `grant.parentGrantId?`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `grant.revokedAt?`                   | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `grant.subject`                      | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context`                            | \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \}                   |
| `context.actor`                      | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.authority`                  | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.enabledToolNamespaces`      | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.namespaceId`                | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `context.now`                        | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `context.owner`                      | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context.purpose`                    | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `context.traceId`                    | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `now`                                | `number`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `options`                            | [`DelegationValidationOptions`](#delegationvalidationoptions)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

#### Returns

`Promise`\<[`DelegationValidation`](#delegationvalidation)\>
