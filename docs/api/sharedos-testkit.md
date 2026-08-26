[**SharedOS API v0.1.0-alpha.3**](README.md)

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

Defined in: [testkit/src/index.ts:28](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L28)

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
| <a id="property-events"></a> `events` | `readonly` | [`AuditEvent`](sharedos-core.md#auditevent)[] | `[]`          | [testkit/src/index.ts:29](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L29) |

#### Methods

##### record()

> **record**(`event`): `Promise`\<`void`>\>

Defined in: [testkit/src/index.ts:31](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L31)

###### Parameters

| Parameter | Type                                        |
| --------- | ------------------------------------------- |
| `event`   | [`AuditEvent`](sharedos-core.md#auditevent) |

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`AuditSink`](sharedos-core.md#auditsink).[`record`](sharedos-core.md#record-2)

---

### InMemoryGrantChainResolver

Defined in: [testkit/src/index.ts:135](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L135)

Namespace-scoped ancestor lookup for delegated-grant fixtures.

#### Implements

- [`DelegationChainResolver`](sharedos-core.md#delegationchainresolver)

#### Constructors

##### Constructor

> **new InMemoryGrantChainResolver**(`grants?`): [`InMemoryGrantChainResolver`](#inmemorygrantchainresolver)

Defined in: [testkit/src/index.ts:138](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L138)

###### Parameters

| Parameter | Type                | Default value |
| --------- | ------------------- | ------------- |
| `grants`  | readonly `object`[] | `[]`          |

###### Returns

[`InMemoryGrantChainResolver`](#inmemorygrantchainresolver)

#### Methods

##### add()

> **add**(`grant`): `this`

Defined in: [testkit/src/index.ts:144](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L144)

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

###### Returns

`this`

##### resolve()

> **resolve**(`namespaceId`, `grantId`): `Promise`\<\{ `capabilities`: `object`[]; `constraints`: \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}; `id`: `string`; `issuedAt`: `string`; `issuer`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `namespaceId`: `string`; `parentGrantId?`: `string`; `revokedAt?`: `string`; `subject`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \} \| `undefined`>\>

Defined in: [testkit/src/index.ts:164](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L164)

###### Parameters

| Parameter     | Type     |
| ------------- | -------- |
| `namespaceId` | `string` |
| `grantId`     | `string` |

###### Returns

`Promise`\<\{ `capabilities`: `object`[]; `constraints`: \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}; `id`: `string`; `issuedAt`: `string`; `issuer`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `namespaceId`: `string`; `parentGrantId?`: `string`; `revokedAt?`: `string`; `subject`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \} \| `undefined`\>

###### Implementation of

[`DelegationChainResolver`](sharedos-core.md#delegationchainresolver).[`resolve`](sharedos-core.md#resolve-2)

##### revoke()

> **revoke**(`namespaceId`, `grantId`, `revokedAt`): `this`

Defined in: [testkit/src/index.ts:155](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L155)

Record a revocation the way a host grant store would, in place.

###### Parameters

| Parameter     | Type     |
| ------------- | -------- |
| `namespaceId` | `string` |
| `grantId`     | `string` |
| `revokedAt`   | `string` |

###### Returns

`this`

---

### InMemoryGrantSource

Defined in: [testkit/src/index.ts:86](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L86)

A host grant store fixture.

`load` answers only with grants issued to the context's actor by its
authority inside its namespace, which is the contract every production
`GrantSource` must satisfy.

#### Implements

- [`GrantSource`](sharedos-core.md#grantsource)

#### Constructors

##### Constructor

> **new InMemoryGrantSource**(`grants?`): [`InMemoryGrantSource`](#inmemorygrantsource)

Defined in: [testkit/src/index.ts:89](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L89)

###### Parameters

| Parameter | Type                | Default value |
| --------- | ------------------- | ------------- |
| `grants`  | readonly `object`[] | `[]`          |

###### Returns

[`InMemoryGrantSource`](#inmemorygrantsource)

#### Methods

##### add()

> **add**(...`grants`): `this`

Defined in: [testkit/src/index.ts:95](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L95)

###### Parameters

| Parameter   | Type                |
| ----------- | ------------------- |
| ...`grants` | readonly `object`[] |

###### Returns

`this`

##### load()

> **load**(`context`): `Promise`\<readonly `object`[]\>

Defined in: [testkit/src/index.ts:113](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L113)

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

###### Returns

`Promise`\<readonly `object`[]\>

###### Implementation of

[`GrantSource`](sharedos-core.md#grantsource).[`load`](sharedos-core.md#load)

##### revoke()

> **revoke**(`grantId`, `revokedAt`): `this`

Defined in: [testkit/src/index.ts:103](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L103)

Record a revocation the way a host store would, without deleting history.

###### Parameters

| Parameter   | Type     |
| ----------- | -------- |
| `grantId`   | `string` |
| `revokedAt` | `string` |

###### Returns

`this`

---

### InMemoryMessageTransport

Defined in: [testkit/src/index.ts:36](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L36)

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
| <a id="property-deliveries"></a> `deliveries` | `readonly` | `object`[] | `[]`          | [testkit/src/index.ts:37](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L37) |

#### Methods

##### deliver()

> **deliver**(`context`, `envelope`): `Promise`\<\{ `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"accepted"`; `timestamp`: `string`; \} \| \{ `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"delivered"`; `timestamp`: `string`; \} \| \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"denied"`; `timestamp`: `string`; \} \| \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"failed"`; `timestamp`: `string`; \}\>

Defined in: [testkit/src/index.ts:39](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L39)

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

`Promise`\<\{ `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"accepted"`; `timestamp`: `string`; \} \| \{ `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"delivered"`; `timestamp`: `string`; \} \| \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"denied"`; `timestamp`: `string`; \} \| \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"failed"`; `timestamp`: `string`; \}\>

###### Implementation of

[`MessageTransport`](sharedos-core.md#messagetransport).[`deliver`](sharedos-core.md#deliver)

---

### InMemoryResourceProvider

Defined in: [testkit/src/index.ts:182](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L182)

A host-neutral recording provider for examples, conformance tests, and isolated experiment worlds.

#### Implements

- [`ResourceProvider`](sharedos-core.md#resourceprovider)

#### Constructors

##### Constructor

> **new InMemoryResourceProvider**(`namespace`, `handler?`): [`InMemoryResourceProvider`](#inmemoryresourceprovider)

Defined in: [testkit/src/index.ts:187](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L187)

###### Parameters

| Parameter   | Type                                  | Default value           |
| ----------- | ------------------------------------- | ----------------------- |
| `namespace` | `string`                              | `undefined`             |
| `handler`   | [`ResourceHandler`](#resourcehandler) | `echoResourceOperation` |

###### Returns

[`InMemoryResourceProvider`](#inmemoryresourceprovider)

#### Properties

| Property                                      | Modifier   | Type       | Default value | Defined in                                                                                                      |
| --------------------------------------------- | ---------- | ---------- | ------------- | --------------------------------------------------------------------------------------------------------------- |
| <a id="property-namespace"></a> `namespace`   | `readonly` | `string`   | `undefined`   | [testkit/src/index.ts:183](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L183) |
| <a id="property-operations"></a> `operations` | `readonly` | `object`[] | `[]`          | [testkit/src/index.ts:184](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L184) |

#### Methods

##### invoke()

> **invoke**(`operation`): `Promise`\<\{ `completedAt`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `operationId`: `string`; `output`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `status`: `"succeeded"`; \} \| \{ `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `operationId`: `string`; `status`: `"denied"`; \} \| \{ `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `operationId`: `string`; `status`: `"failed"`; \}\>

Defined in: [testkit/src/index.ts:192](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L192)

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

###### Returns

`Promise`\<\{ `completedAt`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `operationId`: `string`; `output`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `status`: `"succeeded"`; \} \| \{ `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `operationId`: `string`; `status`: `"denied"`; \} \| \{ `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `operationId`: `string`; `status`: `"failed"`; \}\>

###### Implementation of

[`ResourceProvider`](sharedos-core.md#resourceprovider).[`invoke`](sharedos-core.md#invoke)

---

### InMemoryToolNamespaceSettingsStore

Defined in: [testkit/src/index.ts:53](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L53)

Namespace settings fixture keyed by the access-context namespace/world.

#### Implements

- [`ToolNamespaceSettingsStore`](sharedos-core.md#toolnamespacesettingsstore)

#### Constructors

##### Constructor

> **new InMemoryToolNamespaceSettingsStore**(`initial?`): [`InMemoryToolNamespaceSettingsStore`](#inmemorytoolnamespacesettingsstore)

Defined in: [testkit/src/index.ts:56](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L56)

###### Parameters

| Parameter | Type                                                                                                  |
| --------- | ----------------------------------------------------------------------------------------------------- |
| `initial` | `Readonly`\<`Record`\<`string`, readonly [`ToolNamespace`](sharedos-contracts.md#toolnamespace)[]\>\> |

###### Returns

[`InMemoryToolNamespaceSettingsStore`](#inmemorytoolnamespacesettingsstore)

#### Methods

##### applyUpdate()

> **applyUpdate**(`context`, `update`): `Promise`\<readonly `string`[]\>

Defined in: [testkit/src/index.ts:62](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L62)

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

###### Returns

`Promise`\<readonly `string`[]\>

###### Implementation of

[`ToolNamespaceSettingsStore`](sharedos-core.md#toolnamespacesettingsstore).[`applyUpdate`](sharedos-core.md#applyupdate)

##### get()

> **get**(`namespaceId`): readonly `string`[]

Defined in: [testkit/src/index.ts:74](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L74)

###### Parameters

| Parameter     | Type     |
| ------------- | -------- |
| `namespaceId` | `string` |

###### Returns

readonly `string`[]

---

### UnavailableGrantChainResolver

Defined in: [testkit/src/index.ts:172](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L172)

A resolver whose authoritative source is down; every lookup must fail closed.

#### Implements

- [`DelegationChainResolver`](sharedos-core.md#delegationchainresolver)

#### Constructors

##### Constructor

> **new UnavailableGrantChainResolver**(): [`UnavailableGrantChainResolver`](#unavailablegrantchainresolver)

###### Returns

[`UnavailableGrantChainResolver`](#unavailablegrantchainresolver)

#### Methods

##### resolve()

> **resolve**(): `Promise`\<\{ `capabilities`: `object`[]; `constraints`: \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}; `id`: `string`; `issuedAt`: `string`; `issuer`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `namespaceId`: `string`; `parentGrantId?`: `string`; `revokedAt?`: `string`; `subject`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \} \| `undefined`>\>

Defined in: [testkit/src/index.ts:173](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L173)

###### Returns

`Promise`\<\{ `capabilities`: `object`[]; `constraints`: \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}; `id`: `string`; `issuedAt`: `string`; `issuer`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `namespaceId`: `string`; `parentGrantId?`: `string`; `revokedAt?`: `string`; `subject`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \} \| `undefined`\>

###### Implementation of

[`DelegationChainResolver`](sharedos-core.md#delegationchainresolver).[`resolve`](sharedos-core.md#resolve-2)

---

### UnavailableGrantSource

Defined in: [testkit/src/index.ts:127](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L127)

A grant store that is down; every decision made against it must fail closed.

#### Implements

- [`GrantSource`](sharedos-core.md#grantsource)

#### Constructors

##### Constructor

> **new UnavailableGrantSource**(): [`UnavailableGrantSource`](#unavailablegrantsource)

###### Returns

[`UnavailableGrantSource`](#unavailablegrantsource)

#### Methods

##### load()

> **load**(): `Promise`\<readonly `object`[]\>

Defined in: [testkit/src/index.ts:128](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L128)

###### Returns

`Promise`\<readonly `object`[]\>

###### Implementation of

[`GrantSource`](sharedos-core.md#grantsource).[`load`](sharedos-core.md#load)

## Interfaces

### TestContextOptions

Defined in: [testkit/src/index.ts:237](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L237)

#### Properties

| Property                                                             | Modifier   | Type                                                                                                                                                                                                       | Defined in                                                                                                      |
| -------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| <a id="property-actor"></a> `actor?`                                 | `readonly` | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \} | [testkit/src/index.ts:238](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L238) |
| <a id="property-authority"></a> `authority?`                         | `readonly` | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \} | [testkit/src/index.ts:239](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L239) |
| <a id="property-enabledtoolnamespaces"></a> `enabledToolNamespaces?` | `readonly` | readonly `string`[]                                                                                                                                                                                        | [testkit/src/index.ts:242](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L242) |
| <a id="property-namespaceid"></a> `namespaceId?`                     | `readonly` | `string`                                                                                                                                                                                                   | [testkit/src/index.ts:241](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L241) |
| <a id="property-now"></a> `now?`                                     | `readonly` | `string`                                                                                                                                                                                                   | [testkit/src/index.ts:245](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L245) |
| <a id="property-owner"></a> `owner?`                                 | `readonly` | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \} | [testkit/src/index.ts:240](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L240) |
| <a id="property-purpose"></a> `purpose?`                             | `readonly` | `string`                                                                                                                                                                                                   | [testkit/src/index.ts:243](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L243) |
| <a id="property-traceid"></a> `traceId?`                             | `readonly` | `string`                                                                                                                                                                                                   | [testkit/src/index.ts:244](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L244) |

---

### TestGrantOptions

Defined in: [testkit/src/index.ts:262](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L262)

#### Properties

| Property                                                 | Modifier   | Type                                                                                                                                                                                                       | Defined in                                                                                                      |
| -------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| <a id="property-capabilities"></a> `capabilities`        | `readonly` | readonly `object`[]                                                                                                                                                                                        | [testkit/src/index.ts:267](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L267) |
| <a id="property-delegationdepth"></a> `delegationDepth?` | `readonly` | `number`                                                                                                                                                                                                   | [testkit/src/index.ts:274](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L274) |
| <a id="property-expiresat"></a> `expiresAt?`             | `readonly` | `string`                                                                                                                                                                                                   | [testkit/src/index.ts:271](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L271) |
| <a id="property-id"></a> `id?`                           | `readonly` | `string`                                                                                                                                                                                                   | [testkit/src/index.ts:263](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L263) |
| <a id="property-issuedat"></a> `issuedAt?`               | `readonly` | `string`                                                                                                                                                                                                   | [testkit/src/index.ts:269](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L269) |
| <a id="property-issuer"></a> `issuer?`                   | `readonly` | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \} | [testkit/src/index.ts:266](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L266) |
| <a id="property-maxuses"></a> `maxUses?`                 | `readonly` | `number`                                                                                                                                                                                                   | [testkit/src/index.ts:273](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L273) |
| <a id="property-namespaceid-1"></a> `namespaceId?`       | `readonly` | `string`                                                                                                                                                                                                   | [testkit/src/index.ts:264](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L264) |
| <a id="property-notbefore"></a> `notBefore?`             | `readonly` | `string`                                                                                                                                                                                                   | [testkit/src/index.ts:270](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L270) |
| <a id="property-parentgrantid"></a> `parentGrantId?`     | `readonly` | `string`                                                                                                                                                                                                   | [testkit/src/index.ts:275](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L275) |
| <a id="property-purposes"></a> `purposes?`               | `readonly` | readonly `string`[]                                                                                                                                                                                        | [testkit/src/index.ts:268](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L268) |
| <a id="property-revokedat"></a> `revokedAt?`             | `readonly` | `string`                                                                                                                                                                                                   | [testkit/src/index.ts:272](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L272) |
| <a id="property-subject"></a> `subject?`                 | `readonly` | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \} | [testkit/src/index.ts:265](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L265) |

---

### TestKernel

Defined in: [testkit/src/index.ts:198](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L198)

#### Properties

| Property                                  | Modifier   | Type                                                    | Description                                                                      | Defined in                                                                                                      |
| ----------------------------------------- | ---------- | ------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| <a id="property-audit"></a> `audit`       | `readonly` | [`InMemoryAuditSink`](#inmemoryauditsink)               | -                                                                                | [testkit/src/index.ts:200](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L200) |
| <a id="property-grants"></a> `grants`     | `readonly` | [`InMemoryGrantSource`](#inmemorygrantsource)           | The trusted store the kernel loads authority from; mutate it to grant or revoke. | [testkit/src/index.ts:203](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L203) |
| <a id="property-kernel"></a> `kernel`     | `readonly` | [`SharedOSKernel`](sharedos-core.md#sharedoskernel)     | -                                                                                | [testkit/src/index.ts:199](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L199) |
| <a id="property-messages"></a> `messages` | `readonly` | [`InMemoryMessageTransport`](#inmemorymessagetransport) | -                                                                                | [testkit/src/index.ts:201](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L201) |

---

### TestKernelOptions

Defined in: [testkit/src/index.ts:206](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L206)

#### Properties

| Property                                                       | Modifier   | Type                                                                  | Description                                                           | Defined in                                                                                                      |
| -------------------------------------------------------------- | ---------- | --------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| <a id="property-delegationresolver"></a> `delegationResolver?` | `readonly` | [`DelegationChainResolver`](sharedos-core.md#delegationchainresolver) | Installs ancestor validation so delegated grants can be exercised.    | [testkit/src/index.ts:212](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L212) |
| <a id="property-grants-1"></a> `grants?`                       | `readonly` | readonly `object`[]                                                   | Seed authority for the kernel's trusted grant source.                 | [testkit/src/index.ts:208](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L208) |
| <a id="property-grantsource"></a> `grantSource?`               | `readonly` | [`GrantSource`](sharedos-core.md#grantsource)                         | Replaces the trusted grant source, for example to exercise an outage. | [testkit/src/index.ts:210](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L210) |

## Type Aliases

### ResourceHandler

> **ResourceHandler** = (`operation`) => `Promise`\<[`ResourceResult`](sharedos-contracts.md#resourceresult)>\>

Defined in: [testkit/src/index.ts:179](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L179)

#### Parameters

| Parameter   | Type                                                           |
| ----------- | -------------------------------------------------------------- |
| `operation` | [`ResourceOperation`](sharedos-contracts.md#resourceoperation) |

#### Returns

`Promise`\<[`ResourceResult`](sharedos-contracts.md#resourceresult)\>

## Functions

### createTestContext()

> **createTestContext**(`options?`): `object`

Defined in: [testkit/src/index.ts:248](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L248)

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

Defined in: [testkit/src/index.ts:278](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L278)

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

##### parentGrantId?

> `optional` **parentGrantId?**: `string`

##### revokedAt?

> `optional` **revokedAt?**: `string`

##### subject

> **subject**: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}

---

### createTestKernel()

> **createTestKernel**(`options?`): [`TestKernel`](#testkernel)

Defined in: [testkit/src/index.ts:215](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/testkit/src/index.ts#L215)

#### Parameters

| Parameter | Type                                      |
| --------- | ----------------------------------------- |
| `options` | [`TestKernelOptions`](#testkerneloptions) |

#### Returns

[`TestKernel`](#testkernel)
