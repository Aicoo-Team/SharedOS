[**SharedOS API v0.1.0-alpha.3**](README.md)

---

[SharedOS API](README.md) / @aicoo/sharedos-client

# @aicoo/sharedos-client

Runtime-validated HTTP client for a SharedOS service.

```bash
npm install @aicoo/sharedos-client@next
```

```ts
import { SharedOSClient } from "@aicoo/sharedos-client";

const client = new SharedOSClient({ baseUrl: "https://sharedos.example" });
const tools = await client.listTools();
const namespaces = await client.listToolNamespaces();
await client.updateToolNamespaces({ enable: ["calendar"] });
```

Enabling a namespace changes tool availability only. Each returned or invoked
tool still requires its declared capability grant.

Options are `{ baseUrl, token?, fetch?, headers? }`. `token` — a string or an
async function returning one — is sent as `authorization: Bearer <token>`;
`headers`, a value or an async function, carries anything else, and `token`
wins when both name the `authorization` header. Every method also takes
`{ signal?, headers?, purpose? }`; `purpose` is sent as `x-sharedos-purpose`
for the server's `resolveContext` to read. Neither header is authority: the
server derives the `AccessContext` from its own authenticated state, and every
operation still needs a matching grant.

SharedOS is currently an `0.x` prerelease.

## Classes

### SharedOSClient

Defined in: [packages/client/src/index.ts:61](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/client/src/index.ts#L61)

#### Constructors

##### Constructor

> **new SharedOSClient**(`options`): [`SharedOSClient`](#sharedosclient)

Defined in: [packages/client/src/index.ts:67](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/client/src/index.ts#L67)

###### Parameters

| Parameter | Type                                              |
| --------- | ------------------------------------------------- |
| `options` | [`SharedOSClientOptions`](#sharedosclientoptions) |

###### Returns

[`SharedOSClient`](#sharedosclient)

#### Methods

##### authorize()

> **authorize**(`request`, `options?`): `Promise`\<\{ `allowed`: `boolean`; `matchedGrantId?`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `reasonCode`: `string`; `requiredCapability?`: \{ `capabilities`: `object`[]; `constraints?`: \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}; `id`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `namespaceId`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `requestedAt`: `string`; `requester`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \}; \}\>

Defined in: [packages/client/src/index.ts:78](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/client/src/index.ts#L78)

###### Parameters

| Parameter                     | Type                                                                                                                                                                                                                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `request`                     | \{ `action`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; \} |
| `request.action`              | `string`                                                                                                                                                                                                                                                                                                      |
| `request.resource?`           | \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}                                        |
| `request.resource.namespace?` | `string`                                                                                                                                                                                                                                                                                                      |
| `request.resource.owner?`     | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                    |
| `request.resource.path?`      | `string`[]                                                                                                                                                                                                                                                                                                    |
| `options?`                    | [`SharedOSCallOptions`](#sharedoscalloptions)                                                                                                                                                                                                                                                                 |

###### Returns

`Promise`\<\{ `allowed`: `boolean`; `matchedGrantId?`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `reasonCode`: `string`; `requiredCapability?`: \{ `capabilities`: `object`[]; `constraints?`: \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}; `id`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `namespaceId`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `requestedAt`: `string`; `requester`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \}; \}\>

##### executeTurn()

> **executeTurn**(`request`, `options?`): `Promise`\<\{ `completedAt`: `string`; `events`: `object`[]; `executionId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `output`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `startedAt`: `string`; `status`: `"succeeded"`; `traceId`: `string`; `version`: `"1"`; \} \| \{ `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `events`: `object`[]; `executionId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `startedAt`: `string`; `status`: `"denied"`; `traceId`: `string`; `version`: `"1"`; \} \| \{ `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `events`: `object`[]; `executionId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `startedAt`: `string`; `status`: `"failed"`; `traceId`: `string`; `version`: `"1"`; \} \| \{ `completedAt`: `string`; `error?`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `events`: `object`[]; `executionId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `startedAt`: `string`; `status`: `"cancelled"`; `traceId`: `string`; `version`: `"1"`; \} \| \{ `completedAt`: `string`; `escalation`: \{ `reason`: `string`; `request?`: \{ `capabilities`: `object`[]; `constraints?`: \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}; `id`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `namespaceId`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `requestedAt`: `string`; `requester`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \}; `requestedAt`: `string`; `reviewer`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `status`: `"pending"`; \}; `events`: `object`[]; `executionId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `startedAt`: `string`; `status`: `"escalated"`; `traceId`: `string`; `version`: `"1"`; \}\>

Defined in: [packages/client/src/index.ts:134](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/client/src/index.ts#L134)

###### Parameters

| Parameter                               | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `request`                               | \{ `agent`: \{ `agentId`: `string`; `kind`: `"agent"`; \}; `executionId`: `string`; `message`: \{ `createdAt`: `string`; `id`: `string`; `payload`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `provenance?`: \{ `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}; `purpose`: `string`; `receiver`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `replyTo?`: `string`; `sender`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `traceId`: `string`; `version`: `"1"`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `options?`: \{ `maxSteps?`: `number`; `maxToolCalls?`: `number`; `timeoutMs?`: `number`; \}; `state?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `version`: `"1"`; \} |
| `request.agent`                         | \{ `agentId`: `string`; `kind`: `"agent"`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `request.agent.agentId?`                | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `request.agent.kind?`                   | `"agent"`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `request.executionId?`                  | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `request.message?`                      | \{ `createdAt`: `string`; `id`: `string`; `payload`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `provenance?`: \{ `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}; `purpose`: `string`; `receiver`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `replyTo?`: `string`; `sender`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `traceId`: `string`; `version`: `"1"`; \}                                                                                                                                                                                                                                                                                                                                              |
| `request.message.createdAt?`            | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `request.message.id?`                   | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `request.message.payload?`              | [`JsonValue`](sharedos-contracts.md#jsonvalue)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `request.message.provenance?`           | \{ `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `request.message.provenance.metadata?`  | [`JsonObject`](sharedos-contracts.md#jsonobject)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `request.message.provenance.parentIds?` | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `request.message.provenance.source?`    | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `request.message.purpose?`              | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `request.message.receiver?`             | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `request.message.replyTo?`              | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `request.message.sender?`               | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `request.message.traceId?`              | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `request.message.version?`              | `"1"`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `request.metadata?`                     | [`JsonObject`](sharedos-contracts.md#jsonobject)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `request.options?`                      | \{ `maxSteps?`: `number`; `maxToolCalls?`: `number`; `timeoutMs?`: `number`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `request.options.maxSteps?`             | `number`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `request.options.maxToolCalls?`         | `number`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `request.options.timeoutMs?`            | `number`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `request.state?`                        | [`JsonObject`](sharedos-contracts.md#jsonobject)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `request.version?`                      | `"1"`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `options?`                              | [`SharedOSCallOptions`](#sharedoscalloptions)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

###### Returns

`Promise`\<\{ `completedAt`: `string`; `events`: `object`[]; `executionId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `output`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `startedAt`: `string`; `status`: `"succeeded"`; `traceId`: `string`; `version`: `"1"`; \} \| \{ `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `events`: `object`[]; `executionId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `startedAt`: `string`; `status`: `"denied"`; `traceId`: `string`; `version`: `"1"`; \} \| \{ `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `events`: `object`[]; `executionId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `startedAt`: `string`; `status`: `"failed"`; `traceId`: `string`; `version`: `"1"`; \} \| \{ `completedAt`: `string`; `error?`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `events`: `object`[]; `executionId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `startedAt`: `string`; `status`: `"cancelled"`; `traceId`: `string`; `version`: `"1"`; \} \| \{ `completedAt`: `string`; `escalation`: \{ `reason`: `string`; `request?`: \{ `capabilities`: `object`[]; `constraints?`: \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}; `id`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `namespaceId`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `requestedAt`: `string`; `requester`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \}; `requestedAt`: `string`; `reviewer`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `status`: `"pending"`; \}; `events`: `object`[]; `executionId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `startedAt`: `string`; `status`: `"escalated"`; `traceId`: `string`; `version`: `"1"`; \}\>

##### health()

> **health**(`options?`): `Promise`\<\{ `protocolVersion`: `"1"`; `status`: `"ok"`; \}\>

Defined in: [packages/client/src/index.ts:74](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/client/src/index.ts#L74)

###### Parameters

| Parameter  | Type                                          |
| ---------- | --------------------------------------------- |
| `options?` | [`SharedOSCallOptions`](#sharedoscalloptions) |

###### Returns

`Promise`\<\{ `protocolVersion`: `"1"`; `status`: `"ok"`; \}\>

##### invokeResource()

> **invokeResource**(`operation`, `options?`): `Promise`\<\{ `completedAt`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `operationId`: `string`; `output`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `status`: `"succeeded"`; \} \| \{ `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `operationId`: `string`; `status`: `"denied"`; \} \| \{ `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `operationId`: `string`; `status`: `"failed"`; \}\>

Defined in: [packages/client/src/index.ts:115](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/client/src/index.ts#L115)

###### Parameters

| Parameter                       | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `operation`                     | \{ `action`: `string`; `input?`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `operationId`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; \} |
| `operation.action`              | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `operation.input?`              | [`JsonValue`](sharedos-contracts.md#jsonvalue)                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `operation.metadata?`           | [`JsonObject`](sharedos-contracts.md#jsonobject)                                                                                                                                                                                                                                                                                                                                                                                                                |
| `operation.operationId?`        | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `operation.resource?`           | \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}                                                                                                                                                                                          |
| `operation.resource.namespace?` | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `operation.resource.owner?`     | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                      |
| `operation.resource.path?`      | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `options?`                      | [`SharedOSCallOptions`](#sharedoscalloptions)                                                                                                                                                                                                                                                                                                                                                                                                                   |

###### Returns

`Promise`\<\{ `completedAt`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `operationId`: `string`; `output`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `status`: `"succeeded"`; \} \| \{ `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `operationId`: `string`; `status`: `"denied"`; \} \| \{ `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `operationId`: `string`; `status`: `"failed"`; \}\>

##### invokeTool()

> **invokeTool**(`call`, `options?`): `Promise`\<\{ `callId`: `string`; `completedAt`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `output`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `status`: `"succeeded"`; `tool`: `string`; \} \| \{ `callId`: `string`; `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"denied"`; `tool`: `string`; \} \| \{ `callId`: `string`; `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"failed"`; `tool`: `string`; \}\>

Defined in: [packages/client/src/index.ts:111](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/client/src/index.ts#L111)

###### Parameters

| Parameter           | Type                                                                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `call`              | \{ `arguments`: [`JsonObject`](sharedos-contracts.md#jsonobject); `id`: `string`; `requestedAt`: `string`; `tool`: `string`; `traceId`: `string`; \} |
| `call.arguments`    | [`JsonObject`](sharedos-contracts.md#jsonobject)                                                                                                     |
| `call.id?`          | `string`                                                                                                                                             |
| `call.requestedAt?` | `string`                                                                                                                                             |
| `call.tool?`        | `string`                                                                                                                                             |
| `call.traceId?`     | `string`                                                                                                                                             |
| `options?`          | [`SharedOSCallOptions`](#sharedoscalloptions)                                                                                                        |

###### Returns

`Promise`\<\{ `callId`: `string`; `completedAt`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `output`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `status`: `"succeeded"`; `tool`: `string`; \} \| \{ `callId`: `string`; `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"denied"`; `tool`: `string`; \} \| \{ `callId`: `string`; `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"failed"`; `tool`: `string`; \}\>

##### listToolNamespaces()

> **listToolNamespaces**(`options?`): `Promise`\<\{ `namespaces`: `object`[]; `summary`: \{ `disabled`: `number`; `enabled`: `number`; `total`: `number`; \}; \}\>

Defined in: [packages/client/src/index.ts:89](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/client/src/index.ts#L89)

###### Parameters

| Parameter  | Type                                          |
| ---------- | --------------------------------------------- |
| `options?` | [`SharedOSCallOptions`](#sharedoscalloptions) |

###### Returns

`Promise`\<\{ `namespaces`: `object`[]; `summary`: \{ `disabled`: `number`; `enabled`: `number`; `total`: `number`; \}; \}\>

##### listTools()

> **listTools**(`options?`): `Promise`\<readonly `object`[]\>

Defined in: [packages/client/src/index.ts:85](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/client/src/index.ts#L85)

###### Parameters

| Parameter  | Type                                          |
| ---------- | --------------------------------------------- |
| `options?` | [`SharedOSCallOptions`](#sharedoscalloptions) |

###### Returns

`Promise`\<readonly `object`[]\>

##### sendMessage()

> **sendMessage**(`envelope`, `options?`): `Promise`\<\{ `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"accepted"`; `timestamp`: `string`; \} \| \{ `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"delivered"`; `timestamp`: `string`; \} \| \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"denied"`; `timestamp`: `string`; \} \| \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"failed"`; `timestamp`: `string`; \}\>

Defined in: [packages/client/src/index.ts:127](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/client/src/index.ts#L127)

###### Parameters

| Parameter                        | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `envelope`                       | \{ `createdAt`: `string`; `id`: `string`; `payload`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `provenance?`: \{ `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}; `purpose`: `string`; `receiver`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `replyTo?`: `string`; `sender`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `traceId`: `string`; `version`: `"1"`; \} |
| `envelope.createdAt`             | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `envelope.id?`                   | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `envelope.payload?`              | [`JsonValue`](sharedos-contracts.md#jsonvalue)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `envelope.provenance?`           | \{ `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `envelope.provenance.metadata?`  | [`JsonObject`](sharedos-contracts.md#jsonobject)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `envelope.provenance.parentIds?` | `string`[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `envelope.provenance.source?`    | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `envelope.purpose?`              | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `envelope.receiver?`             | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `envelope.replyTo?`              | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `envelope.sender?`               | \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `envelope.traceId?`              | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `envelope.version?`              | `"1"`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `options?`                       | [`SharedOSCallOptions`](#sharedoscalloptions)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

###### Returns

`Promise`\<\{ `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"accepted"`; `timestamp`: `string`; \} \| \{ `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"delivered"`; `timestamp`: `string`; \} \| \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"denied"`; `timestamp`: `string`; \} \| \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `messageId`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"failed"`; `timestamp`: `string`; \}\>

##### updateToolNamespaces()

> **updateToolNamespaces**(`update`, `options?`): `Promise`\<\{ `namespaces`: `object`[]; `summary`: \{ `disabled`: `number`; `enabled`: `number`; `total`: `number`; \}; \}\>

Defined in: [packages/client/src/index.ts:98](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/client/src/index.ts#L98)

###### Parameters

| Parameter         | Type                                                 |
| ----------------- | ---------------------------------------------------- |
| `update`          | \{ `disable?`: `string`[]; `enable?`: `string`[]; \} |
| `update.disable?` | `string`[]                                           |
| `update.enable?`  | `string`[]                                           |
| `options?`        | [`SharedOSCallOptions`](#sharedoscalloptions)        |

###### Returns

`Promise`\<\{ `namespaces`: `object`[]; `summary`: \{ `disabled`: `number`; `enabled`: `number`; `total`: `number`; \}; \}\>

---

### SharedOSClientError

Defined in: [packages/client/src/index.ts:47](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/client/src/index.ts#L47)

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new SharedOSClientError**(`args`): [`SharedOSClientError`](#sharedosclienterror)

Defined in: [packages/client/src/index.ts:52](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/client/src/index.ts#L52)

###### Parameters

| Parameter         | Type                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------- |
| `args`            | \{ `code`: `string`; `message`: `string`; `requestId?`: `string`; `status`: `number`; \} |
| `args.code`       | `string`                                                                                 |
| `args.message`    | `string`                                                                                 |
| `args.requestId?` | `string`                                                                                 |
| `args.status`     | `number`                                                                                 |

###### Returns

[`SharedOSClientError`](#sharedosclienterror)

###### Overrides

`Error.constructor`

#### Properties

| Property                                                | Modifier   | Type                    | Description                                                                                                                                                                                                                                                                                                                                                                                                                                       | Inherited from          | Defined in                                                                                                           |
| ------------------------------------------------------- | ---------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------- |
| <a id="property-cause"></a> `cause?`                    | `public`   | `unknown`               | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `Error.cause`           | node\_modules/.pnpm/typescript@5.9.3/node\_modules/typescript/lib/lib.es2022.error.d.ts:26                           |
| <a id="property-code"></a> `code`                       | `readonly` | `string`                | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | -                       | [packages/client/src/index.ts:49](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/client/src/index.ts#L49) |
| <a id="property-message"></a> `message`                 | `public`   | `string`                | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `Error.message`         | node\_modules/.pnpm/typescript@5.9.3/node\_modules/typescript/lib/lib.es5.d.ts:1077                                  |
| <a id="property-name"></a> `name`                       | `public`   | `string`                | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `Error.name`            | node\_modules/.pnpm/typescript@5.9.3/node\_modules/typescript/lib/lib.es5.d.ts:1076                                  |
| <a id="property-requestid"></a> `requestId`             | `readonly` | `string` \| `undefined` | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | -                       | [packages/client/src/index.ts:50](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/client/src/index.ts#L50) |
| <a id="property-stack"></a> `stack?`                    | `public`   | `string`                | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `Error.stack`           | node\_modules/.pnpm/typescript@5.9.3/node\_modules/typescript/lib/lib.es5.d.ts:1078                                  |
| <a id="property-status"></a> `status`                   | `readonly` | `number`                | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | -                       | [packages/client/src/index.ts:48](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/client/src/index.ts#L48) |
| <a id="property-stacktracelimit"></a> `stackTraceLimit` | `static`   | `number`                | The `Error.stackTraceLimit` property specifies the number of stack frames collected by a stack trace (whether generated by `new Error().stack` or `Error.captureStackTrace(obj)`). The default value is `10` but may be set to any valid JavaScript number. Changes will affect any stack trace captured _after_ the value has been changed. If set to a non-number value, or set to a negative number, stack traces will not capture any frames. | `Error.stackTraceLimit` | node\_modules/.pnpm/@types+node@22.20.1/node\_modules/@types/node/globals.d.ts:68                                    |

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

## Interfaces

### SharedOSCallOptions

Defined in: [packages/client/src/index.ts:39](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/client/src/index.ts#L39)

#### Properties

| Property                                 | Type          | Defined in                                                                                                           |
| ---------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------- |
| <a id="property-headers"></a> `headers?` | `HeadersInit` | [packages/client/src/index.ts:42](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/client/src/index.ts#L42) |
| <a id="property-purpose"></a> `purpose?` | `string`      | [packages/client/src/index.ts:40](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/client/src/index.ts#L40) |
| <a id="property-signal"></a> `signal?`   | `AbortSignal` | [packages/client/src/index.ts:41](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/client/src/index.ts#L41) |

---

### SharedOSClientOptions

Defined in: [packages/client/src/index.ts:32](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/client/src/index.ts#L32)

#### Properties

| Property                                   | Type                                                                                           | Defined in                                                                                                           |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| <a id="property-baseurl"></a> `baseUrl`    | `string`                                                                                       | [packages/client/src/index.ts:33](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/client/src/index.ts#L33) |
| <a id="property-fetch"></a> `fetch?`       | \{(`input`, `init?`): `Promise`\<`Response`\>; (`input`, `init?`): `Promise`\<`Response`\>; \} | [packages/client/src/index.ts:35](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/client/src/index.ts#L35) |
| <a id="property-headers-1"></a> `headers?` | `HeadersInit` \| (() => HeadersInit \| Promise\<HeadersInit\>)                                 | [packages/client/src/index.ts:36](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/client/src/index.ts#L36) |
| <a id="property-token"></a> `token?`       | `string` \| (() => `string` \| `Promise`\<`string`\>)                                          | [packages/client/src/index.ts:34](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/client/src/index.ts#L34) |

## Type Aliases

### RemoteExecutionRequest

> **RemoteExecutionRequest** = `z.infer`\<_typeof_ [`RemoteExecutionRequestSchema`](sharedos-contracts.md#remoteexecutionrequestschema)>\>

Defined in: packages/contracts/dist/http.d.ts:1128

---

### RemoteResourceOperation

> **RemoteResourceOperation** = `z.infer`\<_typeof_ [`RemoteResourceOperationSchema`](sharedos-contracts.md#remoteresourceoperationschema)>\>

Defined in: packages/contracts/dist/http.d.ts:334

---

### SharedOSHealth

> **SharedOSHealth** = `z.infer`\<_typeof_ [`SharedOSHealthSchema`](sharedos-contracts.md#sharedoshealthschema)>\>

Defined in: packages/contracts/dist/http.d.ts:1139
