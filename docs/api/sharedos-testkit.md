[**SharedOS API v0.1.0-alpha.0**](README.md)

---

[SharedOS API](README.md) / @aicoo/sharedos-testkit

# @aicoo/sharedos-testkit

Deterministic in-memory fixtures and recording providers for SharedOS tests.

```bash
npm install --save-dev @aicoo/sharedos-testkit@next
```

This package is for tests, examples, and isolated experimental worlds. Its
in-memory stores are not durable or multi-instance-safe production storage.
`InMemoryToolNamespaceSettingsStore` can exercise the namespace control plane
without becoming a production settings backend.

SharedOS is currently an `0.x` prerelease.

## Classes

### InMemoryAuditSink

Defined in: [testkit/src/index.ts:26](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L26)

#### Implements

- [`AuditSink`](sharedos-core.md#auditsink)

#### Constructors

##### Constructor

> **new InMemoryAuditSink**(): [`InMemoryAuditSink`](#inmemoryauditsink)

###### Returns

[`InMemoryAuditSink`](#inmemoryauditsink)

#### Properties

| Property                              | Modifier   | Type                                          | Default value | Defined in                                                                                                    |
| ------------------------------------- | ---------- | --------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------- |
| <a id="property-events"></a> `events` | `readonly` | [`AuditEvent`](sharedos-core.md#auditevent)[] | `[]`          | [testkit/src/index.ts:27](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L27) |

#### Methods

##### record()

> **record**(`event`): `Promise`\<`void`>\>

Defined in: [testkit/src/index.ts:29](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L29)

###### Parameters

| Parameter | Type                                        |
| --------- | ------------------------------------------- |
| `event`   | [`AuditEvent`](sharedos-core.md#auditevent) |

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`AuditSink`](sharedos-core.md#auditsink).[`record`](sharedos-core.md#record-2)

---

### InMemoryMessageTransport

Defined in: [testkit/src/index.ts:34](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L34)

#### Implements

- [`MessageTransport`](sharedos-core.md#messagetransport)

#### Constructors

##### Constructor

> **new InMemoryMessageTransport**(): [`InMemoryMessageTransport`](#inmemorymessagetransport)

###### Returns

[`InMemoryMessageTransport`](#inmemorymessagetransport)

#### Properties

| Property                                      | Modifier   | Type       | Default value | Defined in                                                                                                    |
| --------------------------------------------- | ---------- | ---------- | ------------- | ------------------------------------------------------------------------------------------------------------- |
| <a id="property-deliveries"></a> `deliveries` | `readonly` | `object`[] | `[]`          | [testkit/src/index.ts:35](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L35) |

#### Methods

##### deliver()

> **deliver**(`context`, `envelope`): `Promise`\<\{ `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"accepted"`; `timestamp`: `string`; \} \| \{ `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"delivered"`; `timestamp`: `string`; \} \| \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"denied"`; `timestamp`: `string`; \} \| \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"failed"`; `timestamp`: `string`; \}\>

Defined in: [testkit/src/index.ts:37](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L37)

###### Parameters

| Parameter                       | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context`                       | \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `grants`: `object`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \} |
| `context.actor`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `context.authority`             | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `context.enabledToolNamespaces` | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `context.grants`                | `object`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `context.namespaceId`           | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `context.now`                   | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `context.owner`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `context.purpose`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `context.traceId`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `envelope`                      | \{ `createdAt`: `string`; `id`: `string`; `intent`: `string`; `payload`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `provenance?`: \{ `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}; `purpose`: `string`; `receiver`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `replyTo?`: `string`; `sender`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `traceId`: `string`; `version`: `"1"`; \}                           |
| `envelope.createdAt`            | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `envelope.id`                   | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `envelope.intent`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `envelope.payload`              | [`JsonValue`](sharedos-contracts.md#jsonvalue)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `envelope.provenance?`          | \{ `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `envelope.provenance.metadata?` | [`JsonObject`](sharedos-contracts.md#jsonobject)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `envelope.provenance.parentIds` | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `envelope.provenance.source`    | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `envelope.purpose`              | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `envelope.receiver`             | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `envelope.replyTo?`             | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `envelope.sender`               | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `envelope.traceId`              | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `envelope.version`              | `"1"`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

###### Returns

`Promise`\<\{ `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"accepted"`; `timestamp`: `string`; \} \| \{ `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"delivered"`; `timestamp`: `string`; \} \| \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"denied"`; `timestamp`: `string`; \} \| \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"failed"`; `timestamp`: `string`; \}\>

###### Implementation of

[`MessageTransport`](sharedos-core.md#messagetransport).[`deliver`](sharedos-core.md#deliver)

---

### InMemoryResourceProvider

Defined in: [testkit/src/index.ts:80](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L80)

A host-neutral recording provider for examples, conformance tests, and isolated experiment worlds.

#### Implements

- [`ResourceProvider`](sharedos-core.md#resourceprovider)

#### Constructors

##### Constructor

> **new InMemoryResourceProvider**(`namespace`, `handler?`): [`InMemoryResourceProvider`](#inmemoryresourceprovider)

Defined in: [testkit/src/index.ts:85](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L85)

###### Parameters

| Parameter   | Type                                  | Default value           |
| ----------- | ------------------------------------- | ----------------------- |
| `namespace` | `string`                              | `undefined`             |
| `handler`   | [`ResourceHandler`](#resourcehandler) | `echoResourceOperation` |

###### Returns

[`InMemoryResourceProvider`](#inmemoryresourceprovider)

#### Properties

| Property                                      | Modifier   | Type       | Default value | Defined in                                                                                                    |
| --------------------------------------------- | ---------- | ---------- | ------------- | ------------------------------------------------------------------------------------------------------------- |
| <a id="property-namespace"></a> `namespace`   | `readonly` | `string`   | `undefined`   | [testkit/src/index.ts:81](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L81) |
| <a id="property-operations"></a> `operations` | `readonly` | `object`[] | `[]`          | [testkit/src/index.ts:82](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L82) |

#### Methods

##### invoke()

> **invoke**(`operation`): `Promise`\<\{ `completedAt`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `operationId`: `string`; `output`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `status`: `"succeeded"`; \} \| \{ `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `operationId`: `string`; `status`: `"denied"`; \} \| \{ `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `operationId`: `string`; `status`: `"failed"`; \}\>

Defined in: [testkit/src/index.ts:90](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L90)

###### Parameters

| Parameter                                 | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `operation`                               | \{ `action`: `string`; `context`: \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `grants`: `object`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \}; `input?`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `operationId`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; \} |
| `operation.action`                        | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `operation.context`                       | \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `grants`: `object`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `operation.context.actor`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `operation.context.authority`             | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `operation.context.enabledToolNamespaces` | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `operation.context.grants`                | `object`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `operation.context.namespaceId`           | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `operation.context.now`                   | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `operation.context.owner`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `operation.context.purpose`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `operation.context.traceId`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `operation.input?`                        | [`JsonValue`](sharedos-contracts.md#jsonvalue)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `operation.metadata?`                     | [`JsonObject`](sharedos-contracts.md#jsonobject)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `operation.operationId`                   | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `operation.resource`                      | \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `operation.resource.namespace`            | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `operation.resource.owner?`               | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `operation.resource.path`                 | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

###### Returns

`Promise`\<\{ `completedAt`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `operationId`: `string`; `output`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `status`: `"succeeded"`; \} \| \{ `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `operationId`: `string`; `status`: `"denied"`; \} \| \{ `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `operationId`: `string`; `status`: `"failed"`; \}\>

###### Implementation of

[`ResourceProvider`](sharedos-core.md#resourceprovider).[`invoke`](sharedos-core.md#invoke)

---

### InMemoryToolNamespaceSettingsStore

Defined in: [testkit/src/index.ts:51](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L51)

Namespace settings fixture keyed by the access-context namespace/world.

#### Implements

- [`ToolNamespaceSettingsStore`](sharedos-core.md#toolnamespacesettingsstore)

#### Constructors

##### Constructor

> **new InMemoryToolNamespaceSettingsStore**(`initial?`): [`InMemoryToolNamespaceSettingsStore`](#inmemorytoolnamespacesettingsstore)

Defined in: [testkit/src/index.ts:54](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L54)

###### Parameters

| Parameter | Type                                                                                                  |
| --------- | ----------------------------------------------------------------------------------------------------- |
| `initial` | `Readonly`\<`Record`\<`string`, readonly [`ToolNamespace`](sharedos-contracts.md#toolnamespace)[]\>\> |

###### Returns

[`InMemoryToolNamespaceSettingsStore`](#inmemorytoolnamespacesettingsstore)

#### Methods

##### applyUpdate()

> **applyUpdate**(`context`, `update`): `Promise`\<readonly `string`[]\>

Defined in: [testkit/src/index.ts:60](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L60)

###### Parameters

| Parameter                       | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context`                       | \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `grants`: `object`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \} |
| `context.actor`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `context.authority`             | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `context.enabledToolNamespaces` | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `context.grants`                | `object`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `context.namespaceId`           | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `context.now`                   | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `context.owner`                 | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `context.purpose`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `context.traceId`               | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `update`                        | \{ `disable?`: `string`[]; `enable?`: `string`[]; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `update.disable?`               | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `update.enable?`                | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

###### Returns

`Promise`\<readonly `string`[]\>

###### Implementation of

[`ToolNamespaceSettingsStore`](sharedos-core.md#toolnamespacesettingsstore).[`applyUpdate`](sharedos-core.md#applyupdate)

##### get()

> **get**(`namespaceId`): readonly `string`[]

Defined in: [testkit/src/index.ts:72](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L72)

###### Parameters

| Parameter     | Type     |
| ------------- | -------- |
| `namespaceId` | `string` |

###### Returns

readonly `string`[]

## Interfaces

### TestContextOptions

Defined in: [testkit/src/index.ts:116](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L116)

#### Properties

| Property                                                             | Modifier   | Type                                                                                                                                                                                                       | Defined in                                                                                                      |
| -------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| <a id="property-actor"></a> `actor?`                                 | `readonly` | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \} | [testkit/src/index.ts:117](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L117) |
| <a id="property-authority"></a> `authority?`                         | `readonly` | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \} | [testkit/src/index.ts:118](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L118) |
| <a id="property-enabledtoolnamespaces"></a> `enabledToolNamespaces?` | `readonly` | readonly `string`[]                                                                                                                                                                                        | [testkit/src/index.ts:121](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L121) |
| <a id="property-grants"></a> `grants?`                               | `readonly` | readonly `object`[]                                                                                                                                                                                        | [testkit/src/index.ts:124](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L124) |
| <a id="property-namespaceid"></a> `namespaceId?`                     | `readonly` | `string`                                                                                                                                                                                                   | [testkit/src/index.ts:120](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L120) |
| <a id="property-now"></a> `now?`                                     | `readonly` | `string`                                                                                                                                                                                                   | [testkit/src/index.ts:125](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L125) |
| <a id="property-owner"></a> `owner?`                                 | `readonly` | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \} | [testkit/src/index.ts:119](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L119) |
| <a id="property-purpose"></a> `purpose?`                             | `readonly` | `string`                                                                                                                                                                                                   | [testkit/src/index.ts:122](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L122) |
| <a id="property-traceid"></a> `traceId?`                             | `readonly` | `string`                                                                                                                                                                                                   | [testkit/src/index.ts:123](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L123) |

---

### TestGrantOptions

Defined in: [testkit/src/index.ts:143](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L143)

#### Properties

| Property                                           | Modifier   | Type                                                                                                                                                                                                       | Defined in                                                                                                      |
| -------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| <a id="property-capabilities"></a> `capabilities`  | `readonly` | readonly `object`[]                                                                                                                                                                                        | [testkit/src/index.ts:148](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L148) |
| <a id="property-expiresat"></a> `expiresAt?`       | `readonly` | `string`                                                                                                                                                                                                   | [testkit/src/index.ts:151](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L151) |
| <a id="property-id"></a> `id?`                     | `readonly` | `string`                                                                                                                                                                                                   | [testkit/src/index.ts:144](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L144) |
| <a id="property-issuedat"></a> `issuedAt?`         | `readonly` | `string`                                                                                                                                                                                                   | [testkit/src/index.ts:150](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L150) |
| <a id="property-issuer"></a> `issuer?`             | `readonly` | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \} | [testkit/src/index.ts:147](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L147) |
| <a id="property-namespaceid-1"></a> `namespaceId?` | `readonly` | `string`                                                                                                                                                                                                   | [testkit/src/index.ts:145](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L145) |
| <a id="property-purposes"></a> `purposes?`         | `readonly` | readonly `string`[]                                                                                                                                                                                        | [testkit/src/index.ts:149](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L149) |
| <a id="property-subject"></a> `subject?`           | `readonly` | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \} | [testkit/src/index.ts:146](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L146) |

---

### TestKernel

Defined in: [testkit/src/index.ts:96](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L96)

#### Properties

| Property                                  | Modifier   | Type                                                    | Defined in                                                                                                    |
| ----------------------------------------- | ---------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| <a id="property-audit"></a> `audit`       | `readonly` | [`InMemoryAuditSink`](#inmemoryauditsink)               | [testkit/src/index.ts:98](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L98) |
| <a id="property-kernel"></a> `kernel`     | `readonly` | [`SharedOSKernel`](sharedos-core.md#sharedoskernel)     | [testkit/src/index.ts:97](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L97) |
| <a id="property-messages"></a> `messages` | `readonly` | [`InMemoryMessageTransport`](#inmemorymessagetransport) | [testkit/src/index.ts:99](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L99) |

## Type Aliases

### ResourceHandler

> **ResourceHandler** = (`operation`) => `Promise`\<[`ResourceResult`](sharedos-contracts.md#resourceresult)>\>

Defined in: [testkit/src/index.ts:77](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L77)

#### Parameters

| Parameter   | Type                                                           |
| ----------- | -------------------------------------------------------------- |
| `operation` | [`ResourceOperation`](sharedos-contracts.md#resourceoperation) |

#### Returns

`Promise`\<[`ResourceResult`](sharedos-contracts.md#resourceresult)\>

## Functions

### createTestContext()

> **createTestContext**(`options?`): `object`

Defined in: [testkit/src/index.ts:128](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L128)

#### Parameters

| Parameter | Type                                        |
| --------- | ------------------------------------------- |
| `options` | [`TestContextOptions`](#testcontextoptions) |

#### Returns

`object`

##### actor

> **actor**: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}

##### authority

> **authority**: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}

##### enabledToolNamespaces

> **enabledToolNamespaces**: `string`[]

##### grants

> **grants**: `object`[]

##### namespaceId

> **namespaceId**: `string`

##### now

> **now**: `string`

##### owner

> **owner**: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}

##### purpose

> **purpose**: `string`

##### traceId

> **traceId**: `string`

---

### createTestGrant()

> **createTestGrant**(`options`): `object`

Defined in: [testkit/src/index.ts:154](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L154)

#### Parameters

| Parameter | Type                                    |
| --------- | --------------------------------------- |
| `options` | [`TestGrantOptions`](#testgrantoptions) |

#### Returns

`object`

##### capabilities

> **capabilities**: `object`[]

##### constraints

> **constraints**: `object`

###### constraints.delegationDepth?

> `optional` **delegationDepth?**: `number`

###### constraints.expiresAt?

> `optional` **expiresAt?**: `string`

###### constraints.maxUses?

> `optional` **maxUses?**: `number`

###### constraints.notBefore?

> `optional` **notBefore?**: `string`

###### constraints.purposes?

> `optional` **purposes?**: `string`[]

##### id

> **id**: `string`

##### issuedAt

> **issuedAt**: `string`

##### issuer

> **issuer**: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}

##### metadata?

> `optional` **metadata?**: [`JsonObject`](sharedos-contracts.md#jsonobject)

##### namespaceId

> **namespaceId**: `string`

##### revokedAt?

> `optional` **revokedAt?**: `string`

##### subject

> **subject**: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}

---

### createTestKernel()

> **createTestKernel**(): [`TestKernel`](#testkernel)

Defined in: [testkit/src/index.ts:102](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L102)

#### Returns

[`TestKernel`](#testkernel)
