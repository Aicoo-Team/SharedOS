[**SharedOS API v0.1.0-alpha.3**](README.md)

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

Defined in: [packages/core/src/authorization.ts:133](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L133)

#### Constructors

##### Constructor

> **new CapabilityAuthorizer**(`options?`): [`CapabilityAuthorizer`](#capabilityauthorizer)

Defined in: [packages/core/src/authorization.ts:139](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L139)

###### Parameters

| Parameter | Type                                                          |
| --------- | ------------------------------------------------------------- |
| `options` | [`CapabilityAuthorizerOptions`](#capabilityauthorizeroptions) |

###### Returns

[`CapabilityAuthorizer`](#capabilityauthorizer)

#### Methods

##### authorize()

> **authorize**(`authority`, `request`, `options?`): `Promise`\<\{ `allowed`: `boolean`; `matchedGrantId?`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `reasonCode`: `string`; \}\>

Defined in: [packages/core/src/authorization.ts:146](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L146)

###### Parameters

| Parameter   | Type                                            |
| ----------- | ----------------------------------------------- |
| `authority` | [`ResolvedAuthority`](#resolvedauthority)       |
| `request`   | [`AuthorizationRequest`](#authorizationrequest) |
| `options`   | [`AuthorizeOptions`](#authorizeoptions)         |

###### Returns

`Promise`\<\{ `allowed`: `boolean`; `matchedGrantId?`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `reasonCode`: `string`; \}\>

##### canDiscover()

> **canDiscover**(`authority`, `ceiling`, `options?`): `Promise`\<\{ `allowed`: `boolean`; `matchedGrantId?`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `reasonCode`: `string`; \}\>

Defined in: [packages/core/src/authorization.ts:165](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L165)

Non-consuming catalog check. A narrow grant can discover a tool whose
declared resource is a broader ceiling; invocation still checks the exact
argument-selected resource.

###### Parameters

| Parameter   | Type                                                          |
| ----------- | ------------------------------------------------------------- |
| `authority` | [`ResolvedAuthority`](#resolvedauthority)                     |
| `ceiling`   | [`AuthorizationRequest`](#authorizationrequest)               |
| `options`   | [`AuthorizationInstantOptions`](#authorizationinstantoptions) |

###### Returns

`Promise`\<\{ `allowed`: `boolean`; `matchedGrantId?`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `reasonCode`: `string`; \}\>

---

### CompositeAuditSink

Defined in: [packages/core/src/audit.ts:63](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L63)

#### Implements

- [`AuditSink`](#auditsink)

#### Constructors

##### Constructor

> **new CompositeAuditSink**(`sinks`): [`CompositeAuditSink`](#compositeauditsink)

Defined in: [packages/core/src/audit.ts:66](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L66)

###### Parameters

| Parameter | Type                                 |
| --------- | ------------------------------------ |
| `sinks`   | readonly [`AuditSink`](#auditsink)[] |

###### Returns

[`CompositeAuditSink`](#compositeauditsink)

#### Methods

##### record()

> **record**(`event`): `Promise`\<`void`>\>

Defined in: [packages/core/src/audit.ts:70](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L70)

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

Defined in: [packages/core/src/authorization.ts:109](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L109)

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

Defined in: [packages/core/src/authorization.ts:112](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L112)

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

Defined in: [packages/core/src/authorization.ts:116](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L116)

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

Defined in: [packages/core/src/audit.ts:57](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L57)

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

Defined in: [packages/core/src/audit.ts:58](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L58)

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

Defined in: [packages/core/src/message-service.ts:52](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/message-service.ts#L52)

#### Implements

- [`MessageCapabilityResolver`](#messagecapabilityresolver)

#### Constructors

##### Constructor

> **new RecipientScopedMessageCapabilityResolver**(`namespace?`): [`RecipientScopedMessageCapabilityResolver`](#recipientscopedmessagecapabilityresolver)

Defined in: [packages/core/src/message-service.ts:55](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/message-service.ts#L55)

###### Parameters

| Parameter   | Type     | Default value         |
| ----------- | -------- | --------------------- |
| `namespace` | `string` | `MESSAGING_NAMESPACE` |

###### Returns

[`RecipientScopedMessageCapabilityResolver`](#recipientscopedmessagecapabilityresolver)

#### Methods

##### resolve()

> **resolve**(`context`, `envelope`): [`AuthorizationRequest`](#authorizationrequest)

Defined in: [packages/core/src/message-service.ts:59](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/message-service.ts#L59)

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
| `envelope`                      | \{ `createdAt`: `string`; `id`: `string`; `payload`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `provenance?`: \{ `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}; `purpose`: `string`; `receiver`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `replyTo?`: `string`; `sender`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `traceId`: `string`; `version`: `"1"`; \}                         |
| `envelope.createdAt`            | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `envelope.id`                   | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
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

Defined in: [packages/core/src/kernel.ts:125](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L125)

Host-neutral facade for every permission-controlled SharedOS operation.
AccessContext is a trusted host-created boundary; never construct it from an
unverified request body.

#### Constructors

##### Constructor

> **new SharedOSKernel**(`options`): [`SharedOSKernel`](#sharedoskernel)

Defined in: [packages/core/src/kernel.ts:141](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L141)

###### Parameters

| Parameter | Type                                              |
| --------- | ------------------------------------------------- |
| `options` | [`SharedOSKernelOptions`](#sharedoskerneloptions) |

###### Returns

[`SharedOSKernel`](#sharedoskernel)

#### Methods

##### admitTurn()

> **admitTurn**(`context`, `agent`, `options?`): `Promise`\<\{ `allowed`: `boolean`; `matchedGrantId?`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `reasonCode`: `string`; \}\>

Defined in: [packages/core/src/kernel.ts:249](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L249)

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

Defined in: [packages/core/src/kernel.ts:233](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L233)

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

Defined in: [packages/core/src/kernel.ts:731](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L731)

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

Defined in: [packages/core/src/kernel.ts:475](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L475)

Re-authorize and dispatch one tool call.

The span around it is the kernel's whole share of one mediated call, and it
contains the provider's own work, which is not enforcement. That part is
named separately as `SPAN.TOOL_HANDLER` and carries the same call id,
so a report subtracts it rather than attributing the host's storage to
SharedOS. Both spans exist or neither does.

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

##### listPublishedTools()

> **listPublishedTools**(`context`, `options`): `Promise`\<\{ `catalogHash`: `string`; `executionId`: `string`; `tools`: `object`[]; `version`: `"1"`; \}\>

Defined in: [packages/core/src/kernel.ts:387](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L387)

The effective catalogue as an external harness receives it.

[listTools](#listtools) answers with SharedOS registrations, which carry the
capability each tool would require. That is the right answer inside the host
and the wrong thing to put on a wire, so everything crossing the MCP
boundary goes through this instead: the same permission-filtered set,
projected to what a model is allowed to see, in canonical order, with the
hash that identifies it.

A context whose authority could not be loaded receives an empty catalogue
and a hash over nothing, exactly as [listTools](#listtools) returns no tools --
fail-closed, and still a well-formed catalogue rather than an error the
harness would have to interpret.

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
| `options`                       | [`KernelOperationOptions`](#kerneloperationoptions) & `object`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

###### Returns

`Promise`\<\{ `catalogHash`: `string`; `executionId`: `string`; `tools`: `object`[]; `version`: `"1"`; \}\>

##### listToolNamespaces()

> **listToolNamespaces**(`context`, `options?`): `Promise`\<\{ `namespaces`: `object`[]; `summary`: \{ `disabled`: `number`; `enabled`: `number`; `total`: `number`; \}; \}\>

Defined in: [packages/core/src/kernel.ts:395](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L395)

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

Defined in: [packages/core/src/kernel.ts:319](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L319)

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

Defined in: [packages/core/src/kernel.ts:197](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L197)

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

Defined in: [packages/core/src/kernel.ts:285](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L285)

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

Defined in: [packages/core/src/kernel.ts:161](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L161)

###### Parameters

| Parameter  | Type                                    |
| ---------- | --------------------------------------- |
| `provider` | [`ResourceProvider`](#resourceprovider) |

###### Returns

`void`

##### registerTool()

> **registerTool**(`handler`): `void`

Defined in: [packages/core/src/kernel.ts:165](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L165)

###### Parameters

| Parameter | Type                          |
| --------- | ----------------------------- |
| `handler` | [`ToolHandler`](#toolhandler) |

###### Returns

`void`

##### registerToolProvider()

> **registerToolProvider**(`provider`): `void`

Defined in: [packages/core/src/kernel.ts:169](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L169)

###### Parameters

| Parameter  | Type                                          |
| ---------- | --------------------------------------------- |
| `provider` | [`ContextToolProvider`](#contexttoolprovider) |

###### Returns

`void`

##### sendMessage()

> **sendMessage**(`context`, `envelope`, `options?`): `Promise`\<\{ `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"accepted"`; `timestamp`: `string`; \} \| \{ `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"delivered"`; `timestamp`: `string`; \} \| \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"denied"`; `timestamp`: `string`; \} \| \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"failed"`; `timestamp`: `string`; \}\>

Defined in: [packages/core/src/kernel.ts:872](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L872)

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
| `envelope`                      | \{ `createdAt`: `string`; `id`: `string`; `payload`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `provenance?`: \{ `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}; `purpose`: `string`; `receiver`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `replyTo?`: `string`; `sender`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `traceId`: `string`; `version`: `"1"`; \}                         |
| `envelope.createdAt`            | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `envelope.id`                   | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
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

Defined in: [packages/core/src/kernel.ts:418](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L418)

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

Defined in: [packages/core/src/tool-registry.ts:35](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/tool-registry.ts#L35)

#### Constructors

##### Constructor

> **new ToolRegistry**(): [`ToolRegistry`](#toolregistry)

###### Returns

[`ToolRegistry`](#toolregistry)

#### Methods

##### definitions()

> **definitions**(): readonly `object`[]

Defined in: [packages/core/src/tool-registry.ts:79](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/tool-registry.ts#L79)

###### Returns

readonly `object`[]

##### get()

> **get**(`name`): [`ToolHandler`](#toolhandler) \| `undefined`

Defined in: [packages/core/src/tool-registry.ts:71](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/tool-registry.ts#L71)

###### Parameters

| Parameter | Type     |
| --------- | -------- |
| `name`    | `string` |

###### Returns

[`ToolHandler`](#toolhandler) \| `undefined`

##### handlers()

> **handlers**(): readonly [`ToolHandler`](#toolhandler)[]

Defined in: [packages/core/src/tool-registry.ts:85](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/tool-registry.ts#L85)

###### Returns

readonly [`ToolHandler`](#toolhandler)[]

##### has()

> **has**(`name`): `boolean`

Defined in: [packages/core/src/tool-registry.ts:75](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/tool-registry.ts#L75)

###### Parameters

| Parameter | Type     |
| --------- | -------- |
| `name`    | `string` |

###### Returns

`boolean`

##### namespaceCatalog()

> **namespaceCatalog**(`enabledToolNamespaces`): `object`

Defined in: [packages/core/src/tool-registry.ts:91](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/tool-registry.ts#L91)

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

Defined in: [packages/core/src/tool-registry.ts:38](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/tool-registry.ts#L38)

###### Parameters

| Parameter | Type                          |
| --------- | ----------------------------- |
| `handler` | [`ToolHandler`](#toolhandler) |

###### Returns

`void`

---

### TrustedAuthorityResolver

Defined in: [packages/core/src/authority.ts:149](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L149)

Loads and validates authority for one access context.

Every failure mode collapses to `unavailable`, so a decision is never made
against a partially trusted authority set.

#### Constructors

##### Constructor

> **new TrustedAuthorityResolver**(`source`): [`TrustedAuthorityResolver`](#trustedauthorityresolver)

Defined in: [packages/core/src/authority.ts:154](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L154)

###### Parameters

| Parameter | Type                          |
| --------- | ----------------------------- |
| `source`  | [`GrantSource`](#grantsource) |

###### Returns

[`TrustedAuthorityResolver`](#trustedauthorityresolver)

#### Methods

##### resolve()

> **resolve**(`context`, `signal`): `Promise`\<[`AuthorityResolution`](#authorityresolution)>\>

Defined in: [packages/core/src/authority.ts:161](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L161)

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

Defined in: [packages/core/src/audit.ts:24](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L24)

#### Properties

| Property                                             | Modifier   | Type                                                                                                                                                                                                       | Description                                                                                                                                                                                                                                       | Defined in                                                                                                       |
| ---------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| <a id="property-action"></a> `action?`               | `readonly` | `string`                                                                                                                                                                                                   | -                                                                                                                                                                                                                                                 | [packages/core/src/audit.ts:36](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L36) |
| <a id="property-actor"></a> `actor`                  | `readonly` | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \} | -                                                                                                                                                                                                                                                 | [packages/core/src/audit.ts:31](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L31) |
| <a id="property-at"></a> `at`                        | `readonly` | `string`                                                                                                                                                                                                   | -                                                                                                                                                                                                                                                 | [packages/core/src/audit.ts:28](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L28) |
| <a id="property-authority"></a> `authority`          | `readonly` | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \} | -                                                                                                                                                                                                                                                 | [packages/core/src/audit.ts:32](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L32) |
| <a id="property-authorityhash"></a> `authorityHash?` | `readonly` | `string`                                                                                                                                                                                                   | Content identifier of the exact authority set the decision was made against. A turn resolves authority once, so every decision in it carries the same value; the `authority.resolved` event that opened the turn carries the grant ids behind it. | [packages/core/src/audit.ts:44](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L44) |
| <a id="property-grantid"></a> `grantId?`             | `readonly` | `string`                                                                                                                                                                                                   | -                                                                                                                                                                                                                                                 | [packages/core/src/audit.ts:37](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L37) |
| <a id="property-messageid"></a> `messageId?`         | `readonly` | `string`                                                                                                                                                                                                   | -                                                                                                                                                                                                                                                 | [packages/core/src/audit.ts:47](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L47) |
| <a id="property-metadata"></a> `metadata?`           | `readonly` | [`JsonObject`](sharedos-contracts.md#jsonobject)                                                                                                                                                           | -                                                                                                                                                                                                                                                 | [packages/core/src/audit.ts:50](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L50) |
| <a id="property-namespaceid"></a> `namespaceId`      | `readonly` | `string`                                                                                                                                                                                                   | -                                                                                                                                                                                                                                                 | [packages/core/src/audit.ts:30](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L30) |
| <a id="property-operationid"></a> `operationId?`     | `readonly` | `string`                                                                                                                                                                                                   | -                                                                                                                                                                                                                                                 | [packages/core/src/audit.ts:45](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L45) |
| <a id="property-outcome"></a> `outcome`              | `readonly` | [`AuditOutcome`](#auditoutcome)                                                                                                                                                                            | -                                                                                                                                                                                                                                                 | [packages/core/src/audit.ts:27](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L27) |
| <a id="property-owner"></a> `owner`                  | `readonly` | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \} | -                                                                                                                                                                                                                                                 | [packages/core/src/audit.ts:33](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L33) |
| <a id="property-purpose"></a> `purpose`              | `readonly` | `string`                                                                                                                                                                                                   | -                                                                                                                                                                                                                                                 | [packages/core/src/audit.ts:34](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L34) |
| <a id="property-reason"></a> `reason?`               | `readonly` | `string`                                                                                                                                                                                                   | -                                                                                                                                                                                                                                                 | [packages/core/src/audit.ts:49](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L49) |
| <a id="property-receiver"></a> `receiver?`           | `readonly` | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \} | -                                                                                                                                                                                                                                                 | [packages/core/src/audit.ts:48](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L48) |
| <a id="property-resource"></a> `resource?`           | `readonly` | `object`                                                                                                                                                                                                   | -                                                                                                                                                                                                                                                 | [packages/core/src/audit.ts:35](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L35) |
| `resource.namespace`                                 | `public`   | `string`                                                                                                                                                                                                   | -                                                                                                                                                                                                                                                 | packages/contracts/dist/capability.d.ts:54                                                                       |
| `resource.owner?`                                    | `public`   | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \} | -                                                                                                                                                                                                                                                 | packages/contracts/dist/capability.d.ts:55                                                                       |
| `resource.path`                                      | `public`   | `string`[]                                                                                                                                                                                                 | -                                                                                                                                                                                                                                                 | packages/contracts/dist/capability.d.ts:53                                                                       |
| <a id="property-tool"></a> `tool?`                   | `readonly` | `string`                                                                                                                                                                                                   | -                                                                                                                                                                                                                                                 | [packages/core/src/audit.ts:46](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L46) |
| <a id="property-traceid"></a> `traceId`              | `readonly` | `string`                                                                                                                                                                                                   | -                                                                                                                                                                                                                                                 | [packages/core/src/audit.ts:29](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L29) |
| <a id="property-type"></a> `type`                    | `readonly` | [`AuditEventType`](#auditeventtype)                                                                                                                                                                        | -                                                                                                                                                                                                                                                 | [packages/core/src/audit.ts:26](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L26) |
| <a id="property-version"></a> `version`              | `readonly` | `"1"`                                                                                                                                                                                                      | -                                                                                                                                                                                                                                                 | [packages/core/src/audit.ts:25](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L25) |

---

### AuditSink

Defined in: [packages/core/src/audit.ts:53](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L53)

#### Methods

##### record()

> **record**(`event`): `Promise`\<`void`>\>

Defined in: [packages/core/src/audit.ts:54](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L54)

###### Parameters

| Parameter | Type                        |
| --------- | --------------------------- |
| `event`   | [`AuditEvent`](#auditevent) |

###### Returns

`Promise`\<`void`\>

---

### AuthoritySnapshot

Defined in: [packages/core/src/authority.ts:117](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L117)

A content identifier for exactly the authority one decision was made against.

With [MID\_TURN\_AUTHORITY\_REFRESH](#mid_turn_authority_refresh) off, a turn resolves authority once
and every decision in it names the same snapshot -- including a decision that
refused an expired grant, because expiry narrows what a snapshot authorizes
without changing which snapshot it is. The per-decision field is
kept rather than collapsed to a per-turn one because a host may still make
kernel calls outside any turn, and because re-enabling the fuse must not
change the shape of the evidence.

#### Properties

| Property                                      | Modifier   | Type                | Description                                                          | Defined in                                                                                                                 |
| --------------------------------------------- | ---------- | ------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-grantcount"></a> `grantCount` | `readonly` | `number`            | -                                                                    | [packages/core/src/authority.ts:121](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L121) |
| <a id="property-grantids"></a> `grantIds`     | `readonly` | readonly `string`[] | -                                                                    | [packages/core/src/authority.ts:120](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L120) |
| <a id="property-hash"></a> `hash`             | `readonly` | `string`            | SHA-256 over the canonical, order-independent form of the grant set. | [packages/core/src/authority.ts:119](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L119) |
| <a id="property-loadedat"></a> `loadedAt`     | `readonly` | `string`            | -                                                                    | [packages/core/src/authority.ts:122](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L122) |

---

### AuthorizationInstantOptions

Defined in: [packages/core/src/authorization.ts:82](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L82)

The instant one decision is made at, when it is not the turn's own.

`ResolvedAuthority.context` carries the instant the turn's authority was
resolved, and that is what a turn is admitted against. A caller that knows the
instant of the _operation_ -- `SharedOSKernel` does, because the executor
stamps a live context onto every call -- names it here, and a grant whose
validity window has closed since admission is refused without re-reading the
store. Omitting it decides at the turn's instant, which is what a kernel call
outside any turn is. See `grantIsActive` in `internal.ts` for which removals
move and which do not, and ADR 0016 for why.

#### Extended by

- [`AuthorizeOptions`](#authorizeoptions)

#### Properties

| Property                         | Modifier   | Type     | Defined in                                                                                                                       |
| -------------------------------- | ---------- | -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-now"></a> `now?` | `readonly` | `string` | [packages/core/src/authorization.ts:83](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L83) |

---

### AuthorizationRequest

Defined in: [packages/core/src/authorization.ts:27](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L27)

#### Properties

| Property                                    | Modifier   | Type                                                                                                                                                                                                       | Defined in                                                                                                                       |
| ------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-action-1"></a> `action`     | `readonly` | `string`                                                                                                                                                                                                   | [packages/core/src/authorization.ts:29](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L29) |
| <a id="property-resource-1"></a> `resource` | `readonly` | `object`                                                                                                                                                                                                   | [packages/core/src/authorization.ts:28](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L28) |
| `resource.namespace`                        | `public`   | `string`                                                                                                                                                                                                   | packages/contracts/dist/capability.d.ts:54                                                                                       |
| `resource.owner?`                           | `public`   | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \} | packages/contracts/dist/capability.d.ts:55                                                                                       |
| `resource.path`                             | `public`   | `string`[]                                                                                                                                                                                                 | packages/contracts/dist/capability.d.ts:53                                                                                       |

---

### AuthorizeOptions

Defined in: [packages/core/src/authorization.ts:86](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L86)

The instant one decision is made at, when it is not the turn's own.

`ResolvedAuthority.context` carries the instant the turn's authority was
resolved, and that is what a turn is admitted against. A caller that knows the
instant of the _operation_ -- `SharedOSKernel` does, because the executor
stamps a live context onto every call -- names it here, and a grant whose
validity window has closed since admission is refused without re-reading the
store. Omitting it decides at the turn's instant, which is what a kernel call
outside any turn is. See `grantIsActive` in `internal.ts` for which removals
move and which do not, and ADR 0016 for why.

#### Extends

- [`AuthorizationInstantOptions`](#authorizationinstantoptions)

#### Properties

| Property                                 | Modifier   | Type      | Description                                                                                                                            | Inherited from                                                                       | Defined in                                                                                                                       |
| ---------------------------------------- | ---------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-consume"></a> `consume?` | `readonly` | `boolean` | Consumption is reserved for execution. Discovery calls must leave this false so merely viewing a catalog cannot spend a bounded grant. | -                                                                                    | [packages/core/src/authorization.ts:91](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L91) |
| <a id="property-now-1"></a> `now?`       | `readonly` | `string`  | -                                                                                                                                      | [`AuthorizationInstantOptions`](#authorizationinstantoptions).[`now`](#property-now) | [packages/core/src/authorization.ts:83](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L83) |

---

### CapabilityAuthorizerOptions

Defined in: [packages/core/src/authorization.ts:94](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L94)

#### Properties

| Property                                                                   | Modifier   | Type                                                  | Description                                                                                                          | Defined in                                                                                                                         |
| -------------------------------------------------------------------------- | ---------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-delegationresolver"></a> `delegationResolver?`             | `readonly` | [`DelegationChainResolver`](#delegationchainresolver) | Trusted ancestor lookup for delegated grants. Without it, a grant that claims a parent can never authorize anything. | [packages/core/src/authorization.ts:101](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L101) |
| <a id="property-grantverifier"></a> `grantVerifier?`                       | `readonly` | [`CapabilityGrantVerifier`](#capabilitygrantverifier) | -                                                                                                                    | [packages/core/src/authorization.ts:96](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L96)   |
| <a id="property-maxdelegationchainlength"></a> `maxDelegationChainLength?` | `readonly` | `number`                                              | -                                                                                                                    | [packages/core/src/authorization.ts:102](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L102) |
| <a id="property-usagestore"></a> `usageStore?`                             | `readonly` | [`GrantUsageStore`](#grantusagestore)                 | -                                                                                                                    | [packages/core/src/authorization.ts:95](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L95)   |

---

### CapabilityGrantVerifier

Defined in: [packages/core/src/authorization.ts:66](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L66)

#### Methods

##### verify()

> **verify**(`grant`, `context`): `Promise`\<`boolean`>\>

Defined in: [packages/core/src/authorization.ts:67](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L67)

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

Defined in: [packages/core/src/tool-registry.ts:30](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/tool-registry.ts#L30)

Supplies tools for exactly one trusted access context.

Hosts use this port for user-specific MCP servers and other dynamic catalogs
instead of mutating one global registry shared by concurrent users.

#### Properties

| Property                      | Modifier   | Type     | Defined in                                                                                                                       |
| ----------------------------- | ---------- | -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-id"></a> `id` | `readonly` | `string` | [packages/core/src/tool-registry.ts:31](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/tool-registry.ts#L31) |

#### Methods

##### listTools()

> **listTools**(`context`, `signal`): `Promise`\<readonly [`ToolHandler`](#toolhandler)[]\>

Defined in: [packages/core/src/tool-registry.ts:32](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/tool-registry.ts#L32)

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

Defined in: [packages/core/src/delegation.ts:29](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/delegation.ts#L29)

The trusted lookup for ancestors of a derived grant.

A delegated grant travels with a parent identifier, never with its parent's
contents, so the ancestor must be loaded from an authoritative source. An
implementation must resolve only within the requested namespace and must
throw rather than return a partial or stale ancestor.

#### Methods

##### resolve()

> **resolve**(`namespaceId`, `grantId`): `Promise`\<\{ `capabilities`: `object`[]; `constraints`: \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}; `id`: `string`; `issuedAt`: `string`; `issuer`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `namespaceId`: `string`; `parentGrantId?`: `string`; `revokedAt?`: `string`; `subject`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \} \| `undefined`>\>

Defined in: [packages/core/src/delegation.ts:30](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/delegation.ts#L30)

###### Parameters

| Parameter     | Type     |
| ------------- | -------- |
| `namespaceId` | `string` |
| `grantId`     | `string` |

###### Returns

`Promise`\<\{ `capabilities`: `object`[]; `constraints`: \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}; `id`: `string`; `issuedAt`: `string`; `issuer`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `namespaceId`: `string`; `parentGrantId?`: `string`; `revokedAt?`: `string`; `subject`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \} \| `undefined`\>

---

### DelegationValidationOptions

Defined in: [packages/core/src/delegation.ts:65](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/delegation.ts#L65)

#### Properties

| Property                                               | Modifier   | Type                                                  | Description                                                                                                                                                                                                                                                                                       | Defined in                                                                                                                 |
| ------------------------------------------------------ | ---------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-admittedat"></a> `admittedAt?`         | `readonly` | `number`                                              | The instant the turn's authority was resolved, when it is not `now`. An ancestor is subject to the same split as the grant that names it: its expiry is observed at `now`, everything else at the instant the turn was admitted. Defaults to `now`, which decides the whole chain at one instant. | [packages/core/src/delegation.ts:75](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/delegation.ts#L75) |
| <a id="property-maxchainlength"></a> `maxChainLength?` | `readonly` | `number`                                              | -                                                                                                                                                                                                                                                                                                 | [packages/core/src/delegation.ts:67](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/delegation.ts#L67) |
| <a id="property-resolver"></a> `resolver?`             | `readonly` | [`DelegationChainResolver`](#delegationchainresolver) | -                                                                                                                                                                                                                                                                                                 | [packages/core/src/delegation.ts:66](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/delegation.ts#L66) |

---

### DeriveGrantRequest

Defined in: [packages/core/src/delegation.ts:290](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/delegation.ts#L290)

#### Properties

| Property                                          | Modifier   | Type                                                                                                                                                                                                       | Description                                                                      | Defined in                                                                                                                   |
| ------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-capabilities"></a> `capabilities` | `readonly` | readonly `object`[]                                                                                                                                                                                        | The subset being passed on. Must be within the parent, capability by capability. | [packages/core/src/delegation.ts:296](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/delegation.ts#L296) |
| <a id="property-constraints"></a> `constraints?`  | `readonly` | `Omit`\<\{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}, `"delegationDepth"`\> & `object`                               | -                                                                                | [packages/core/src/delegation.ts:297](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/delegation.ts#L297) |
| <a id="property-id-1"></a> `id`                   | `readonly` | `string`                                                                                                                                                                                                   | Identifier for the derived grant. Must be unique within the namespace.           | [packages/core/src/delegation.ts:292](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/delegation.ts#L292) |
| <a id="property-issuedat"></a> `issuedAt`         | `readonly` | `string`                                                                                                                                                                                                   | -                                                                                | [packages/core/src/delegation.ts:300](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/delegation.ts#L300) |
| <a id="property-metadata-1"></a> `metadata?`      | `readonly` | [`JsonObject`](sharedos-contracts.md#jsonobject)                                                                                                                                                           | -                                                                                | [packages/core/src/delegation.ts:301](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/delegation.ts#L301) |
| <a id="property-subject"></a> `subject`           | `readonly` | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \} | Who receives the derived authority.                                              | [packages/core/src/delegation.ts:294](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/delegation.ts#L294) |

---

### GrantSource

Defined in: [packages/core/src/authority.ts:95](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L95)

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

Defined in: [packages/core/src/authority.ts:96](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L96)

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

Defined in: [packages/core/src/authorization.ts:61](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L61)

#### Methods

##### getUsage()

> **getUsage**(`namespaceId`, `grantId`): `Promise`\<`number`>\>

Defined in: [packages/core/src/authorization.ts:62](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L62)

###### Parameters

| Parameter     | Type     |
| ------------- | -------- |
| `namespaceId` | `string` |
| `grantId`     | `string` |

###### Returns

`Promise`\<`number`\>

##### tryConsume()

> **tryConsume**(`namespaceId`, `grantId`, `maximumUses`): `Promise`\<`boolean`>\>

Defined in: [packages/core/src/authorization.ts:63](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L63)

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

Defined in: [packages/core/src/kernel.ts:95](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L95)

#### Properties

| Property                               | Modifier   | Type          | Defined in                                                                                                         |
| -------------------------------------- | ---------- | ------------- | ------------------------------------------------------------------------------------------------------------------ |
| <a id="property-signal"></a> `signal?` | `readonly` | `AbortSignal` | [packages/core/src/kernel.ts:96](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L96) |

---

### MessageCapabilityResolver

Defined in: [packages/core/src/message-service.ts:48](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/message-service.ts#L48)

#### Methods

##### resolve()

> **resolve**(`context`, `envelope`): [`AuthorizationRequest`](#authorizationrequest)

Defined in: [packages/core/src/message-service.ts:49](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/message-service.ts#L49)

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
| `envelope`                      | \{ `createdAt`: `string`; `id`: `string`; `payload`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `provenance?`: \{ `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}; `purpose`: `string`; `receiver`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `replyTo?`: `string`; `sender`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `traceId`: `string`; `version`: `"1"`; \}                         |
| `envelope.createdAt`            | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `envelope.id`                   | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
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

### MessageRequestRouter

Defined in: [packages/core/src/message-service.ts:39](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/message-service.ts#L39)

Host-owned lookup for the durable reply to one accepted message request.
SharedOS validates the returned envelope before exposing its payload.

#### Methods

##### resolveReply()

> **resolveReply**(`context`, `request`, `delivery`, `signal`): `Promise`\<\{ `createdAt`: `string`; `id`: `string`; `payload`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `provenance?`: \{ `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}; `purpose`: `string`; `receiver`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `replyTo?`: `string`; `sender`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `traceId`: `string`; `version`: `"1"`; \}\>

Defined in: [packages/core/src/message-service.ts:40](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/message-service.ts#L40)

###### Parameters

| Parameter                       | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context`                       | \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \}                                                                             |
| `context.actor`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `context.authority`             | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `context.enabledToolNamespaces` | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `context.namespaceId`           | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `context.now`                   | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `context.owner`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `context.purpose`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `context.traceId`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `request`                       | \{ `createdAt`: `string`; `id`: `string`; `payload`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `provenance?`: \{ `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}; `purpose`: `string`; `receiver`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `replyTo?`: `string`; `sender`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `traceId`: `string`; `version`: `"1"`; \}                                                                                                     |
| `request.createdAt`             | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `request.id`                    | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `request.payload`               | [`JsonValue`](sharedos-contracts.md#jsonvalue)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `request.provenance?`           | \{ `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `request.provenance.metadata?`  | [`JsonObject`](sharedos-contracts.md#jsonobject)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `request.provenance.parentIds`  | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `request.provenance.source`     | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `request.purpose`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `request.receiver`              | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `request.replyTo?`              | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `request.sender`                | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `request.traceId`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `request.version`               | `"1"`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `delivery`                      | \{ `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"accepted"`; `timestamp`: `string`; \} \| \{ `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"delivered"`; `timestamp`: `string`; \} \| \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"denied"`; `timestamp`: `string`; \} \| \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"failed"`; `timestamp`: `string`; \} |
| `signal`                        | `AbortSignal`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

###### Returns

`Promise`\<\{ `createdAt`: `string`; `id`: `string`; `payload`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `provenance?`: \{ `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}; `purpose`: `string`; `receiver`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `replyTo?`: `string`; `sender`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `traceId`: `string`; `version`: `"1"`; \}\>

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
| `envelope`                      | \{ `createdAt`: `string`; `id`: `string`; `payload`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `provenance?`: \{ `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}; `purpose`: `string`; `receiver`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `replyTo?`: `string`; `sender`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `traceId`: `string`; `version`: `"1"`; \}                         |
| `envelope.createdAt`            | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `envelope.id`                   | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
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

Defined in: [packages/core/src/authority.ts:133](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L133)

An access context together with the authority a trusted source produced for
it.

Authority is deliberately held beside the context rather than merged into it,
so a resolved authority can never be passed to a provider, tool handler,
message transport, or runtime that expects an `AccessContext`.

#### Properties

| Property                                  | Modifier   | Type                                                                                                                                                                                                       | Defined in                                                                                                                 |
| ----------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-context"></a> `context`   | `readonly` | `object`                                                                                                                                                                                                   | [packages/core/src/authority.ts:134](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L134) |
| `context.actor`                           | `public`   | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \} | packages/contracts/dist/access.d.ts:144                                                                                    |
| `context.authority`                       | `public`   | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \} | packages/contracts/dist/access.d.ts:157                                                                                    |
| `context.enabledToolNamespaces`           | `public`   | `string`[]                                                                                                                                                                                                 | packages/contracts/dist/access.d.ts:170                                                                                    |
| `context.namespaceId`                     | `public`   | `string`                                                                                                                                                                                                   | packages/contracts/dist/access.d.ts:141                                                                                    |
| `context.now`                             | `public`   | `string`                                                                                                                                                                                                   | packages/contracts/dist/access.d.ts:171                                                                                    |
| `context.owner`                           | `public`   | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \} | packages/contracts/dist/access.d.ts:128                                                                                    |
| `context.purpose`                         | `public`   | `string`                                                                                                                                                                                                   | packages/contracts/dist/access.d.ts:142                                                                                    |
| `context.traceId`                         | `public`   | `string`                                                                                                                                                                                                   | packages/contracts/dist/access.d.ts:143                                                                                    |
| <a id="property-grants"></a> `grants`     | `readonly` | readonly `object`[]                                                                                                                                                                                        | [packages/core/src/authority.ts:135](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L135) |
| <a id="property-snapshot"></a> `snapshot` | `readonly` | [`AuthoritySnapshot`](#authoritysnapshot)                                                                                                                                                                  | [packages/core/src/authority.ts:136](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L136) |

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

Defined in: [packages/core/src/kernel.ts:67](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L67)

#### Properties

| Property                                                                     | Modifier   | Type                                                        | Description                                                                                                                                                                                                                                               | Defined in                                                                                                         |
| ---------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| <a id="property-audit"></a> `audit?`                                         | `readonly` | [`AuditSink`](#auditsink)                                   | -                                                                                                                                                                                                                                                         | [packages/core/src/kernel.ts:82](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L82) |
| <a id="property-authorizer"></a> `authorizer?`                               | `readonly` | [`CapabilityAuthorizer`](#capabilityauthorizer)             | -                                                                                                                                                                                                                                                         | [packages/core/src/kernel.ts:73](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L73) |
| <a id="property-createmessageid"></a> `createMessageId?`                     | `readonly` | (`context`, `call`) => `string`                             | -                                                                                                                                                                                                                                                         | [packages/core/src/kernel.ts:81](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L81) |
| <a id="property-grantsource"></a> `grantSource`                              | `readonly` | [`GrantSource`](#grantsource)                               | The trusted boundary that loads authority. It is required: a kernel with no authoritative grant source can only fail closed.                                                                                                                              | [packages/core/src/kernel.ts:72](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L72) |
| <a id="property-messagecapabilityresolver"></a> `messageCapabilityResolver?` | `readonly` | [`MessageCapabilityResolver`](#messagecapabilityresolver)   | -                                                                                                                                                                                                                                                         | [packages/core/src/kernel.ts:80](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L80) |
| <a id="property-messagerequestrouter"></a> `messageRequestRouter?`           | `readonly` | [`MessageRequestRouter`](#messagerequestrouter)             | -                                                                                                                                                                                                                                                         | [packages/core/src/kernel.ts:79](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L79) |
| <a id="property-messagetransport"></a> `messageTransport?`                   | `readonly` | [`MessageTransport`](#messagetransport)                     | -                                                                                                                                                                                                                                                         | [packages/core/src/kernel.ts:78](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L78) |
| <a id="property-onauditerror"></a> `onAuditError?`                           | `readonly` | (`error`, `event`) => `void` \| `Promise`\<`void`\>         | Notification for audit failures that occur after a side effect.                                                                                                                                                                                           | [packages/core/src/kernel.ts:84](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L84) |
| <a id="property-resources"></a> `resources?`                                 | `readonly` | [`ResourceProviderRegistry`](#resourceproviderregistry)     | -                                                                                                                                                                                                                                                         | [packages/core/src/kernel.ts:74](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L74) |
| <a id="property-spans"></a> `spans?`                                         | `readonly` | [`SpanSink`](#spansink)                                     | Where the cost of enforcement is reported, when a host is measuring it. Absent by default and absent in every production path that does not ask for it, which is what keeps a measured run and an unmeasured one the same run. See [SpanSink](#spansink). | [packages/core/src/kernel.ts:92](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L92) |
| <a id="property-toolnamespacesettings"></a> `toolNamespaceSettings?`         | `readonly` | [`ToolNamespaceSettingsStore`](#toolnamespacesettingsstore) | -                                                                                                                                                                                                                                                         | [packages/core/src/kernel.ts:77](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L77) |
| <a id="property-toolproviders"></a> `toolProviders?`                         | `readonly` | readonly [`ContextToolProvider`](#contexttoolprovider)[]    | -                                                                                                                                                                                                                                                         | [packages/core/src/kernel.ts:76](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L76) |
| <a id="property-tools"></a> `tools?`                                         | `readonly` | [`ToolRegistry`](#toolregistry)                             | -                                                                                                                                                                                                                                                         | [packages/core/src/kernel.ts:75](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L75) |

---

### Span

Defined in: [packages/core/src/spans.ts:37](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/spans.ts#L37)

One completed span of SharedOS-owned work.

#### Properties

| Property                                      | Modifier   | Type                                | Description                                    | Defined in                                                                                                       |
| --------------------------------------------- | ---------- | ----------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| <a id="property-attributes"></a> `attributes` | `readonly` | [`SpanAttributes`](#spanattributes) | -                                              | [packages/core/src/spans.ts:41](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/spans.ts#L41) |
| <a id="property-durationms"></a> `durationMs` | `readonly` | `number`                            | Monotonic duration in fractional milliseconds. | [packages/core/src/spans.ts:40](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/spans.ts#L40) |
| <a id="property-name-2"></a> `name`           | `readonly` | `string`                            | -                                              | [packages/core/src/spans.ts:38](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/spans.ts#L38) |

---

### SpanScope

Defined in: [packages/core/src/spans.ts:64](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/spans.ts#L64)

The handle an operation uses to say what it turned out to be.

Attributes are set from inside the measured operation rather than derived
from its return value, because the facts worth recording are not all in the
return: the call id an MCP server minted, the refusal code a path took, the
boundary that answered. Setting one on a span nobody is recording is a no-op.

#### Methods

##### set()

> **set**(`key`, `value`): `void`

Defined in: [packages/core/src/spans.ts:65](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/spans.ts#L65)

###### Parameters

| Parameter | Type                              |
| --------- | --------------------------------- |
| `key`     | `string`                          |
| `value`   | `string` \| `number` \| `boolean` |

###### Returns

`void`

---

### SpanSink

Defined in: [packages/core/src/spans.ts:52](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/spans.ts#L52)

Where completed spans are reported.

Synchronous and returning nothing, so a sink cannot delay the operation it is
measuring or change what the operation returns. A sink that throws is
ignored: measurement is an observation, and an observation that could fail an
authorization decision would be a new way for a turn to be denied.

#### Methods

##### record()

> **record**(`span`): `void`

Defined in: [packages/core/src/spans.ts:53](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/spans.ts#L53)

###### Parameters

| Parameter | Type            |
| --------- | --------------- |
| `span`    | [`Span`](#span) |

###### Returns

`void`

---

### ToolCatalogOptions

Defined in: [packages/core/src/published-tool.ts:133](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/published-tool.ts#L133)

#### Properties

| Property                                        | Modifier   | Type     | Defined in                                                                                                                           |
| ----------------------------------------------- | ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| <a id="property-executionid"></a> `executionId` | `readonly` | `string` | [packages/core/src/published-tool.ts:134](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/published-tool.ts#L134) |

---

### ToolHandler

Defined in: [packages/core/src/tool-registry.ts:15](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/tool-registry.ts#L15)

#### Properties

| Property                                                       | Modifier   | Type                                                                                                                                                                                                       | Description                                                                | Defined in                                                                                                                       |
| -------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| <a id="property-definition"></a> `definition`                  | `readonly` | `object`                                                                                                                                                                                                   | -                                                                          | [packages/core/src/tool-registry.ts:16](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/tool-registry.ts#L16) |
| `definition.annotations?`                                      | `public`   | `object`                                                                                                                                                                                                   | -                                                                          | packages/contracts/dist/tool.d.ts:309                                                                                            |
| `definition.annotations.destructive?`                          | `public`   | `boolean`                                                                                                                                                                                                  | -                                                                          | packages/contracts/dist/tool.d.ts:311                                                                                            |
| `definition.annotations.idempotent?`                           | `public`   | `boolean`                                                                                                                                                                                                  | -                                                                          | packages/contracts/dist/tool.d.ts:312                                                                                            |
| `definition.annotations.readOnly?`                             | `public`   | `boolean`                                                                                                                                                                                                  | -                                                                          | packages/contracts/dist/tool.d.ts:310                                                                                            |
| `definition.description`                                       | `public`   | `string`                                                                                                                                                                                                   | -                                                                          | packages/contracts/dist/tool.d.ts:283                                                                                            |
| `definition.inputSchema`                                       | `public`   | [`JsonObject`](sharedos-contracts.md#jsonobject)                                                                                                                                                           | -                                                                          | packages/contracts/dist/tool.d.ts:286                                                                                            |
| `definition.metadata?`                                         | `public`   | [`JsonObject`](sharedos-contracts.md#jsonobject)                                                                                                                                                           | -                                                                          | packages/contracts/dist/tool.d.ts:307                                                                                            |
| `definition.name`                                              | `public`   | `string`                                                                                                                                                                                                   | -                                                                          | packages/contracts/dist/tool.d.ts:282                                                                                            |
| `definition.namespace`                                         | `public`   | `string`                                                                                                                                                                                                   | -                                                                          | packages/contracts/dist/tool.d.ts:281                                                                                            |
| `definition.outputSchema?`                                     | `public`   | [`JsonObject`](sharedos-contracts.md#jsonobject)                                                                                                                                                           | -                                                                          | packages/contracts/dist/tool.d.ts:308                                                                                            |
| `definition.readWrite`                                         | `public`   | `"write"` \| `"read"`                                                                                                                                                                                      | -                                                                          | packages/contracts/dist/tool.d.ts:285                                                                                            |
| `definition.requiredCapability`                                | `public`   | `object`                                                                                                                                                                                                   | -                                                                          | packages/contracts/dist/tool.d.ts:287                                                                                            |
| `definition.requiredCapability.action`                         | `public`   | `string`                                                                                                                                                                                                   | -                                                                          | packages/contracts/dist/tool.d.ts:305                                                                                            |
| `definition.requiredCapability.resource`                       | `public`   | `object`                                                                                                                                                                                                   | -                                                                          | packages/contracts/dist/tool.d.ts:288                                                                                            |
| `definition.requiredCapability.resource.namespace`             | `public`   | `string`                                                                                                                                                                                                   | -                                                                          | packages/contracts/dist/tool.d.ts:290                                                                                            |
| `definition.requiredCapability.resource.owner?`                | `public`   | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \} | -                                                                          | packages/contracts/dist/tool.d.ts:291                                                                                            |
| `definition.requiredCapability.resource.path`                  | `public`   | `string`[]                                                                                                                                                                                                 | -                                                                          | packages/contracts/dist/tool.d.ts:289                                                                                            |
| `definition.source`                                            | `public`   | `string`                                                                                                                                                                                                   | -                                                                          | packages/contracts/dist/tool.d.ts:284                                                                                            |
| <a id="property-parsearguments"></a> `parseArguments`          | `readonly` | (`arguments_`) => `unknown`                                                                                                                                                                                | Parse and normalize untrusted arguments before authorization or execution. | [packages/core/src/tool-registry.ts:18](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/tool-registry.ts#L18) |
| <a id="property-resolverequirement"></a> `resolveRequirement?` | `readonly` | (`context`, `call`) => [`AuthorizationRequest`](#authorizationrequest)                                                                                                                                     | Resolve argument-selected resources immediately before execution.          | [packages/core/src/tool-registry.ts:20](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/tool-registry.ts#L20) |

#### Methods

##### invoke()

> **invoke**(`context`, `call`, `signal`): `Promise`\<\{ `callId`: `string`; `completedAt`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `output`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `status`: `"succeeded"`; `tool`: `string`; \} \| \{ `callId`: `string`; `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"denied"`; `tool`: `string`; \} \| \{ `callId`: `string`; `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"failed"`; `tool`: `string`; \}\>

Defined in: [packages/core/src/tool-registry.ts:21](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/tool-registry.ts#L21)

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

Defined in: [packages/core/src/audit.ts:4](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L4)

---

### AuditOutcome

> **AuditOutcome** = `"allowed"` \| `"denied"` \| `"succeeded"` \| `"failed"` \| `"escalated"`

Defined in: [packages/core/src/audit.ts:22](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L22)

`escalated` is its own outcome, not a denial.

A denial is a decision SharedOS made. An escalation is a decision it declined
to make and handed to a human, and counting the two together would inflate
every denial rate by the cases where the system correctly asked for help.

---

### AuthorityResolution

> **AuthorityResolution** = \{ `authority`: [`ResolvedAuthority`](#resolvedauthority); `status`: `"resolved"`; \} \| \{ `code`: [`AuthorityUnavailableCode`](#authorityunavailablecode); `status`: `"unavailable"`; \}

Defined in: [packages/core/src/authority.ts:139](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L139)

---

### AuthorityUnavailableCode

> **AuthorityUnavailableCode** = `"grant_source_failed"` \| `"invalid_grant_material"` \| `"grant_scope_mismatch"` \| `"grant_limit_exceeded"`

Defined in: [packages/core/src/authority.ts:100](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L100)

Why authority could not be established for one decision.

---

### AuthorizationReasonCode

> **AuthorizationReasonCode** = `"allowed"` \| `"invalid_context"` \| `"invalid_request"` \| `"no_matching_grant"` \| `"grant_exhausted"` \| `"delegation_chain_invalid"` \| `"authority_unavailable"` \| `"delegation_chain_unverified"` \| `"usage_store_unavailable"`

Defined in: [packages/core/src/authorization.ts:32](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L32)

---

### DelegationRefusal

> **DelegationRefusal** = `"empty_capabilities"` \| `"id_collides_with_parent"` \| `"bounded_parent_not_delegable"` \| `"parent_not_delegable"` \| `"depth_exhausted"` \| `"capability_not_within_parent"` \| `"purpose_not_within_parent"` \| `"window_not_within_parent"` \| `"issued_before_parent"`

Defined in: [packages/core/src/delegation.ts:275](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/delegation.ts#L275)

Why a delegation was refused at the point it was issued.

---

### DelegationUnverifiedCode

> **DelegationUnverifiedCode** = `"resolver_unavailable"` \| `"parent_not_found"` \| `"resolver_failed"`

Defined in: [packages/core/src/delegation.ts:47](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/delegation.ts#L47)

The chain could not be established, which is never treated as valid.

---

### DelegationValidation

> **DelegationValidation** = \{ `chain`: readonly `string`[]; `status`: `"valid"`; \} \| \{ `chain`: readonly `string`[]; `code`: [`DelegationViolationCode`](#delegationviolationcode); `grantId`: `string`; `status`: `"invalid"`; \} \| \{ `chain`: readonly `string`[]; `code`: [`DelegationUnverifiedCode`](#delegationunverifiedcode); `grantId`: `string`; `status`: `"unverified"`; \}

Defined in: [packages/core/src/delegation.ts:50](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/delegation.ts#L50)

---

### DelegationViolationCode

> **DelegationViolationCode** = `"delegation_not_permitted"` \| `"delegation_depth_exceeded"` \| `"bounded_parent_not_delegable"` \| `"issuer_not_parent_subject"` \| `"namespace_mismatch"` \| `"parent_inactive"` \| `"capability_widened"` \| `"constraints_widened"` \| `"chain_cycle"` \| `"chain_too_long"`

Defined in: [packages/core/src/delegation.ts:34](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/delegation.ts#L34)

A structural rule the presented chain broke.

---

### DeriveGrantResult

> **DeriveGrantResult** = \{ `grant`: [`CapabilityGrant`](sharedos-contracts.md#capabilitygrant); `ok`: `true`; \} \| \{ `ok`: `false`; `reason`: [`DelegationRefusal`](#delegationrefusal); \}

Defined in: [packages/core/src/delegation.ts:286](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/delegation.ts#L286)

---

### SpanAttributes

> **SpanAttributes** = `Readonly`\<`Record`\<`string`, `string` \| `number` \| `boolean`>>\>\>

Defined in: [packages/core/src/spans.ts:34](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/spans.ts#L34)

What a span may say about itself.

Identifiers, tool names, and outcomes. Never arguments, never results, never
payloads -- the same redaction rule the audit trail follows, for the same
reason: a measurement sink is not an authorized reader of anything a call
carried, and a span that leaked one would be a disclosure channel opened by
turning measurement on.

---

### SpanName

> **SpanName** = _typeof_ [`SPAN`](#span-1)\[keyof _typeof_ [`SPAN`](#span-1)\]

Defined in: [packages/core/src/spans.ts:188](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/spans.ts#L188)

---

### TurnAuthorityScope

> **TurnAuthorityScope** = `object`

Defined in: [packages/core/src/authority.ts:73](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L73)

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

Defined in: [packages/core/src/authority.ts:78](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L78)

Present when it was not.

##### snapshot?

> `readonly` `optional` **snapshot?**: [`AuthoritySnapshot`](#authoritysnapshot)

Defined in: [packages/core/src/authority.ts:76](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L76)

Present when authority was established.

##### status

> `readonly` **status**: `"resolved"` \| `"unavailable"`

Defined in: [packages/core/src/authority.ts:74](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L74)

#### Methods

##### close()

> **close**(): `void`

Defined in: [packages/core/src/authority.ts:79](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L79)

###### Returns

`void`

## Variables

### AGENT\_INVOKE\_ACTION

> `const` **AGENT\_INVOKE\_ACTION**: `"invoke"` = `"invoke"`

Defined in: [packages/core/src/kernel.ts:100](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L100)

---

### CATALOG\_HASH\_FIELDS

> `const` **CATALOG\_HASH\_FIELDS**: readonly `string`[]

Defined in: [packages/core/src/published-tool.ts:27](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/published-tool.ts#L27)

The fields of a published tool that `catalogHash` is computed over.

This list is the contract, not an implementation detail. Two hosts can both
claim to compute `catalogHash` and disagree on every value unless
participation is fixed somewhere, so it is fixed here and asserted by
[publishToolDefinition](#publishtooldefinition), which cannot emit a key outside it.

What is deliberately absent is everything that varies with _how_ a catalogue
was delivered rather than _what_ it contains: `executionId`, the harness-side
alias, the runtime name, the transport. Two harnesses handed the same tools
must hash identically, or the hash cannot be used to prove they were compared
on equal terms -- which is the only reason it exists.

---

### DEFAULT\_MAX\_DELEGATION\_CHAIN\_LENGTH

> `const` **DEFAULT\_MAX\_DELEGATION\_CHAIN\_LENGTH**: `16` = `16`

Defined in: [packages/core/src/delegation.ts:19](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/delegation.ts#L19)

The longest ancestor chain SharedOS will walk before failing closed.

---

### EXECUTION\_NAMESPACE

> `const` **EXECUTION\_NAMESPACE**: `"sharedos.execution"` = `"sharedos.execution"`

Defined in: [packages/core/src/kernel.ts:99](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L99)

---

### INFRASTRUCTURE\_DENIAL\_REASONS

> `const` **INFRASTRUCTURE\_DENIAL\_REASONS**: readonly [`AuthorizationReasonCode`](#authorizationreasoncode)[]

Defined in: [packages/core/src/authorization.ts:51](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L51)

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

### MESSAGE\_REQUEST\_TOOL\_DEFINITION

> `const` **MESSAGE\_REQUEST\_TOOL\_DEFINITION**: [`ToolDefinition`](sharedos-contracts.md#tooldefinition)

Defined in: [packages/core/src/message-tool.ts:24](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/message-tool.ts#L24)

---

### MESSAGE\_REQUEST\_TOOL\_NAME

> `const` **MESSAGE\_REQUEST\_TOOL\_NAME**: `"messages.request"` = `"messages.request"`

Defined in: [packages/core/src/message-tool.ts:22](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/message-tool.ts#L22)

---

### MESSAGE\_SEND\_ACTION

> `const` **MESSAGE\_SEND\_ACTION**: `"send"` = `"send"`

Defined in: [packages/core/src/message-service.ts:13](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/message-service.ts#L13)

---

### MESSAGE\_TOOL\_NAMESPACE

> `const` **MESSAGE\_TOOL\_NAMESPACE**: `"messages"` = `"messages"`

Defined in: [packages/core/src/message-tool.ts:21](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/message-tool.ts#L21)

---

### MESSAGING\_NAMESPACE

> `const` **MESSAGING\_NAMESPACE**: `"sharedos.messaging"` = `"sharedos.messaging"`

Defined in: [packages/core/src/message-service.ts:12](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/message-service.ts#L12)

---

### MID\_TURN\_AUTHORITY\_REFRESH

> `const` **MID\_TURN\_AUTHORITY\_REFRESH**: `false` = `false`

Defined in: [packages/core/src/authority.ts:38](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L38)

The fuse over per-operation authority resolution. Off.

SharedOS originally re-loaded authority from the trusted source for every
kernel operation, so a grant removed from the store part-way through a turn
was refused at the next decision inside that same turn. That path is retained
in [SharedOSKernel](#sharedoskernel) and is re-enabled by setting this to `true`.

It is off because a turn must decide against one _grant set_. Authority is
resolved once, at the turn boundary, and a store-side edit -- a revocation, a
withdrawn purpose -- is observed by the _next_ turn. A request therefore
carries the authority it was admitted with, rather than having authority
resolved underneath it while it runs.

The fuse no longer covers expiry. ADR 0016 settled the question this constant
used to carry as a TBD: expiry is a property the grant already held when the
turn began, so honouring it part-way through costs no store read and leaks no
store state, and `grantIsActive` in `internal.ts` now evaluates it against the
instant of the operation while every other removal stays at the instant the
turn's authority was resolved. Nothing about that needs this fuse, which is
why it stays off.

What remains behind it is exactly one behaviour: seeing a store edit without
waiting for the next turn. A host cannot set it: it is an exported constant,
a build-time switch for this package's maintainers, and turning it on means
patching the package. Whether it becomes a kernel option, with the store read
per operation that implies, is an open item (`docs/open-items.md`).

---

### SPAN

> `const` **SPAN**: `Readonly`\<\{ `AUTHORITY_LOAD`: `"kernel.authority.load"`; `AUTHORIZE`: `"kernel.authorize"`; `MCP_HANDLE`: `"mcp.handle"`; `TOOL_CATALOGUE`: `"kernel.tool.catalogue"`; `TOOL_DISCOVER`: `"kernel.tool.discover"`; `TOOL_HANDLER`: `"kernel.tool.handler"`; `TOOL_INVOKE`: `"kernel.tool.invoke"`; `TOOL_MEDIATE`: `"envelope.tool.mediate"`; `TURN`: `"envelope.turn"`; \}\>

Defined in: [packages/core/src/spans.ts:167](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/spans.ts#L167)

The spans SharedOS emits, named once so a sink and a report agree.

`TOOL_HANDLER` is the odd one and the important one: it is the only span here
that measures work SharedOS does not own. A resource provider's read is the
host's storage, not enforcement, and an end-to-end figure that included it
would report the host's disk as a SharedOS cost. It is emitted so it can be
taken back out, correlated by the `callId` every span on one call carries.

## Functions

### addressesEqual()

> **addressesEqual**(`left`, `right`): `boolean`

Defined in: [packages/core/src/internal.ts:36](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/internal.ts#L36)

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

Defined in: [packages/core/src/message-service.ts:71](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/message-service.ts#L71)

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

Defined in: [packages/core/src/kernel.ts:102](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/kernel.ts#L102)

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

Defined in: [packages/core/src/audit.ts:77](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/audit.ts#L77)

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

### buildToolCatalog()

> **buildToolCatalog**(`definitions`, `options`): `Promise`\<\{ `catalogHash`: `string`; `executionId`: `string`; `tools`: `object`[]; `version`: `"1"`; \}\>

Defined in: [packages/core/src/published-tool.ts:138](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/published-tool.ts#L138)

Build the per-turn catalogue a harness is served, hash included.

#### Parameters

| Parameter     | Type                                        |
| ------------- | ------------------------------------------- |
| `definitions` | readonly `object`[]                         |
| `options`     | [`ToolCatalogOptions`](#toolcatalogoptions) |

#### Returns

`Promise`\<\{ `catalogHash`: `string`; `executionId`: `string`; `tools`: `object`[]; `version`: `"1"`; \}\>

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

Defined in: [packages/core/src/authorization.ts:372](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L372)

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

Defined in: [packages/core/src/authorization.ts:344](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L344)

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

### catalogHash()

> **catalogHash**(`tools`): `Promise`\<`string`>\>

Defined in: [packages/core/src/published-tool.ts:121](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/published-tool.ts#L121)

A stable identifier for one effective, model-facing tool catalogue.

    catalogHash = SHA-256(canonical JSON(tools sorted by canonical name))

Canonicalisation is [canonicalJson](#canonicaljson): object keys sorted, no incidental
whitespace, so a host that serialises its schemas in a different key order
still produces the same hash. Field participation is
[CATALOG\_HASH\_FIELDS](#catalog_hash_fields).

The hash answers one question -- were these harnesses given the same semantic
tool set? -- and answers it against schema drift, a missing tool, a renamed
tool, and a stale discovery cache alike.

#### Parameters

| Parameter | Type                |
| --------- | ------------------- |
| `tools`   | readonly `object`[] |

#### Returns

`Promise`\<`string`\>

---

### deriveGrant()

> **deriveGrant**(`parent`, `request`): [`DeriveGrantResult`](#derivegrantresult)

Defined in: [packages/core/src/delegation.ts:400](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/delegation.ts#L400)

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

### formatCatalogHash()

> **formatCatalogHash**(`hash`): `string`

Defined in: [packages/core/src/published-tool.ts:129](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/published-tool.ts#L129)

The hash as an experiment record renders it: algorithm-qualified.

#### Parameters

| Parameter | Type     |
| --------- | -------- |
| `hash`    | `string` |

#### Returns

`string`

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

Defined in: [packages/core/src/authorization.ts:57](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authorization.ts#L57)

#### Parameters

| Parameter    | Type     |
| ------------ | -------- |
| `reasonCode` | `string` |

#### Returns

`boolean`

---

### measure()

> **measure**\<`T`>\>(`sink`, `name`, `operation`, `describe?`): `Promise`\<`T`>\>

Defined in: [packages/core/src/spans.ts:92](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/spans.ts#L92)

Run an operation, and report how long the part SharedOS owns took.

With no sink this is one comparison and a direct call: `operation` is invoked
and its own promise handed back untouched, so an uninstrumented host pays
nothing for the call sites existing.

That property is the reason `operation` must be an ordinary arrow that
_returns_ a promise rather than an `async` one that awaits inside. An async
callback allocates a second promise and two microtask hops on every call,
measured or not, and eight of those on the path of one tool call is a real
cost charged to hosts that never asked to be measured. Attributes only
knowable from the result go to `describe`, which runs solely when there is a
sink to report to.

Nested spans are reported whole and are not subtracted from one another here.
A span that contains foreign work -- a resource provider, a host's storage --
is separated from it by naming that work in its own span and correlating the
two afterwards on a shared identifier. Doing the subtraction inside would
need an ambient stack, and an ambient stack is wrong the first time two turns
are in flight at once.

#### Type Parameters

| Type Parameter |
| -------------- |
| `T`            |

#### Parameters

| Parameter   | Type                                   |
| ----------- | -------------------------------------- |
| `sink`      | [`SpanSink`](#spansink) \| `undefined` |
| `name`      | `string`                               |
| `operation` | (`scope`) => `Promise`\<`T`\>          |
| `describe?` | (`value`, `scope`) => `void`           |

#### Returns

`Promise`\<`T`\>

---

### measureSync()

> **measureSync**\<`T`>\>(`sink`, `name`, `operation`): `T`

Defined in: [packages/core/src/spans.ts:102](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/spans.ts#L102)

[measure](#measure) for an operation that does not await.

#### Type Parameters

| Type Parameter |
| -------------- |
| `T`            |

#### Parameters

| Parameter   | Type                                   |
| ----------- | -------------------------------------- |
| `sink`      | [`SpanSink`](#spansink) \| `undefined` |
| `name`      | `string`                               |
| `operation` | (`scope`) => `T`                       |

#### Returns

`T`

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

### portableToolName()

> **portableToolName**(`name`): `string`

Defined in: [packages/core/src/published-tool.ts:161](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/published-tool.ts#L161)

The canonical name rewritten for a transport that cannot carry a dot.

Provided because harnesses do this anyway and an unowned rewrite is worse than
an owned one. It is transport presentation only: it is not the tool's
identity, it is not what `catalogHash` covers, and nothing may authorize
against it. SharedOS maps a harness alias back to the canonical name before
the call reaches the kernel; the alias may be recorded diagnostically, and
that is the whole of its role.

#### Parameters

| Parameter | Type     |
| --------- | -------- |
| `name`    | `string` |

#### Returns

`string`

---

### publishToolCatalog()

> **publishToolCatalog**(`definitions`): readonly `object`[]

Defined in: [packages/core/src/published-tool.ts:91](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/published-tool.ts#L91)

Project a permission-filtered catalogue, in canonical order.

Sorting is part of the projection rather than of the hash, so the tools a
harness receives and the tools that were hashed are in the same order and can
be compared by eye. Duplicate names are rejected here: a catalogue that
publishes one name twice has already lost the property the whole boundary
rests on, that a name identifies exactly one operation.

#### Parameters

| Parameter     | Type                |
| ------------- | ------------------- |
| `definitions` | readonly `object`[] |

#### Returns

readonly `object`[]

---

### publishToolDefinition()

> **publishToolDefinition**(`definition`): `object`

Defined in: [packages/core/src/published-tool.ts:51](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/published-tool.ts#L51)

Project one registered tool into what a harness is allowed to see.

Everything authorization-bearing is dropped rather than redacted:
`requiredCapability`, `resolveRequirement`, and the handler itself never leave
SharedOS. A harness therefore cannot infer what authority a call would need,
and could not use the answer if it could -- the requirement is re-resolved
from the _arguments_ at invocation time, so two calls to one published tool
routinely need different authority.

`readWrite` is a required classification on every registration, so
`readOnlyHint` is always determined. `destructiveHint` and `idempotentHint`
appear only when the registration stated them: emitting a guess would put an
unfixed value into `catalogHash`.

#### Parameters

| Parameter                                          | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `definition`                                       | \{ `annotations?`: \{ `destructive?`: `boolean`; `idempotent?`: `boolean`; `readOnly?`: `boolean`; \}; `description`: `string`; `inputSchema`: [`JsonObject`](sharedos-contracts.md#jsonobject); `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `name`: `string`; `namespace`: `string`; `outputSchema?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `readWrite`: `"write"` \| `"read"`; `requiredCapability`: \{ `action`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; \}; `source`: `string`; \} |
| `definition.annotations?`                          | \{ `destructive?`: `boolean`; `idempotent?`: `boolean`; `readOnly?`: `boolean`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `definition.annotations.destructive?`              | `boolean`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `definition.annotations.idempotent?`               | `boolean`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `definition.annotations.readOnly?`                 | `boolean`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `definition.description`                           | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `definition.inputSchema`                           | [`JsonObject`](sharedos-contracts.md#jsonobject)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `definition.metadata?`                             | [`JsonObject`](sharedos-contracts.md#jsonobject)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `definition.name`                                  | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `definition.namespace`                             | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `definition.outputSchema?`                         | [`JsonObject`](sharedos-contracts.md#jsonobject)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `definition.readWrite`                             | `"write"` \| `"read"`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `definition.requiredCapability`                    | \{ `action`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `definition.requiredCapability.action`             | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `definition.requiredCapability.resource`           | \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `definition.requiredCapability.resource.namespace` | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `definition.requiredCapability.resource.owner?`    | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `definition.requiredCapability.resource.path`      | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `definition.source`                                | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

#### Returns

`object`

##### annotations?

> `optional` **annotations?**: `object`

###### annotations.destructiveHint?

> `optional` **destructiveHint?**: `boolean`

###### annotations.idempotentHint?

> `optional` **idempotentHint?**: `boolean`

###### annotations.openWorldHint?

> `optional` **openWorldHint?**: `boolean`

###### annotations.readOnlyHint?

> `optional` **readOnlyHint?**: `boolean`

##### description

> **description**: `string`

##### inputSchema

> **inputSchema**: [`JsonObject`](sharedos-contracts.md#jsonobject)

##### metadata?

> `optional` **metadata?**: `object`

###### metadata.namespace?

> `optional` **namespace?**: `string`

###### metadata.source?

> `optional` **source?**: `string`

##### name

> **name**: `string`

##### outputSchema?

> `optional` **outputSchema?**: [`JsonObject`](sharedos-contracts.md#jsonobject)

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

Defined in: [packages/core/src/authority.ts:49](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/authority.ts#L49)

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

Defined in: [packages/core/src/delegation.ts:102](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/core/src/delegation.ts#L102)

Validate the complete ancestor chain of one grant.

A grant without `parentGrantId` is a root grant and is valid here; its own
expiry, revocation, and purpose remain the caller's separate check. For a
derived grant every link must satisfy all of:

- the child's issuer is exactly the parent's subject;
- both grants live in the same namespace;
- the parent is itself active for the requested purpose, so revoking or
  expiring an ancestor invalidates every descendant. A revoked ancestor is
  observed at `options.admittedAt` and an expired one at `now`, exactly as
  for the grant presenting the chain;
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
