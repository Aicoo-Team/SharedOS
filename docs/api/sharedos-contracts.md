[**SharedOS API v0.1.0-alpha.0**](README.md)

---

[SharedOS API](README.md) / @aicoo/sharedos-contracts

# @aicoo/sharedos-contracts

Strict, JSON-safe SharedOS protocol schemas and TypeScript types.

```bash
npm install @aicoo/sharedos-contracts@next
```

Use this package for addresses, capabilities, messages, resources, tools,
runtime manifests/events/outcomes, execution results, and HTTP wire contracts.
External boundaries should parse untrusted values with the exported schemas
rather than relying on type casts.

Tool definitions include a logical namespace, source, read/write catalog class,
and exact capability requirement. Access contexts carry the trusted effective
namespace selection; `ToolNamespaceUpdateSchema` defines portable, idempotent
enable/disable patches.

SharedOS is currently an `0.x` prerelease.

## Interfaces

### JsonObject

Defined in: [json.ts:4](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/json.ts#L4)

#### Indexable

> \[`key`: `string`\]: [`JsonValue`](#jsonvalue)

## Type Aliases

### AccessContext

> **AccessContext** = `z.infer`\<_typeof_ [`AccessContextSchema`](#accesscontextschema)>\>

Defined in: [access.ts:24](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/access.ts#L24)

---

### Address

> **Address** = `z.infer`\<_typeof_ [`AddressSchema`](#addressschema)>\>

Defined in: [address.ts:33](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/address.ts#L33)

---

### AgentAddress

> **AgentAddress** = `z.infer`\<_typeof_ [`AgentAddressSchema`](#agentaddressschema)>\>

Defined in: [address.ts:13](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/address.ts#L13)

---

### AuthorizationDecision

> **AuthorizationDecision** = `z.infer`\<_typeof_ [`AuthorizationDecisionSchema`](#authorizationdecisionschema)>\>

Defined in: [access.ts:36](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/access.ts#L36)

---

### Capability

> **Capability** = `z.infer`\<_typeof_ [`CapabilitySchema`](#capabilityschema)>\>

Defined in: [capability.ts:46](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/capability.ts#L46)

---

### CapabilityConstraints

> **CapabilityConstraints** = `z.infer`\<_typeof_ [`CapabilityConstraintsSchema`](#capabilityconstraintsschema)>\>

Defined in: [capability.ts:71](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/capability.ts#L71)

---

### CapabilityGrant

> **CapabilityGrant** = `z.infer`\<_typeof_ [`CapabilityGrantSchema`](#capabilitygrantschema)>\>

Defined in: [capability.ts:127](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/capability.ts#L127)

---

### CapabilityRequest

> **CapabilityRequest** = `z.infer`\<_typeof_ [`CapabilityRequestSchema`](#capabilityrequestschema)>\>

Defined in: [capability.ts:88](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/capability.ts#L88)

---

### CapabilityRequirement

> **CapabilityRequirement** = `z.infer`\<_typeof_ [`CapabilityRequirementSchema`](#capabilityrequirementschema)>\>

Defined in: [capability.ts:137](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/capability.ts#L137)

---

### EnabledToolNamespaces

> **EnabledToolNamespaces** = `z.infer`\<_typeof_ [`EnabledToolNamespacesSchema`](#enabledtoolnamespacesschema)>\>

Defined in: [tool.ts:34](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L34)

---

### ExecutionEvent

> **ExecutionEvent** = `z.infer`\<_typeof_ [`ExecutionEventSchema`](#executioneventschema)>\>

Defined in: [execution.ts:55](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/execution.ts#L55)

---

### ExecutionOptions

> **ExecutionOptions** = `z.infer`\<_typeof_ [`ExecutionOptionsSchema`](#executionoptionsschema)>\>

Defined in: [execution.ts:22](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/execution.ts#L22)

---

### ExecutionRequest

> **ExecutionRequest** = `z.infer`\<_typeof_ [`ExecutionRequestSchema`](#executionrequestschema)>\>

Defined in: [execution.ts:39](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/execution.ts#L39)

---

### ExecutionResult

> **ExecutionResult** = `z.infer`\<_typeof_ [`ExecutionResultSchema`](#executionresultschema)>\>

Defined in: [execution.ts:86](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/execution.ts#L86)

---

### GrantDelegation

> **GrantDelegation** = `z.infer`\<_typeof_ [`GrantDelegationSchema`](#grantdelegationschema)>\>

Defined in: [capability.ts:109](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/capability.ts#L109)

---

### GroupAddress

> **GroupAddress** = `z.infer`\<_typeof_ [`GroupAddressSchema`](#groupaddressschema)>\>

Defined in: [address.ts:18](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/address.ts#L18)

---

### HumanAddress

> **HumanAddress** = `z.infer`\<_typeof_ [`HumanAddressSchema`](#humanaddressschema)>\>

Defined in: [address.ts:8](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/address.ts#L8)

---

### Identifier

> **Identifier** = `z.infer`\<_typeof_ [`IdentifierSchema`](#identifierschema)>\>

Defined in: [common.ts:9](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/common.ts#L9)

---

### JsonArray

> **JsonArray** = [`JsonValue`](#jsonvalue)[]

Defined in: [json.ts:7](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/json.ts#L7)

---

### JsonPrimitive

> **JsonPrimitive** = `string` \| `number` \| `boolean` \| `null`

Defined in: [json.ts:3](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/json.ts#L3)

---

### JsonValue

> **JsonValue** = [`JsonPrimitive`](#jsonprimitive) \| [`JsonObject`](#jsonobject) \| [`JsonArray`](#jsonarray)

Defined in: [json.ts:8](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/json.ts#L8)

---

### MessageDeliveryResult

> **MessageDeliveryResult** = `z.infer`\<_typeof_ [`MessageDeliveryResultSchema`](#messagedeliveryresultschema)>\>

Defined in: [message.ts:60](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/message.ts#L60)

---

### MessageEnvelope

> **MessageEnvelope** = `z.infer`\<_typeof_ [`MessageEnvelopeSchema`](#messageenvelopeschema)>\>

Defined in: [message.ts:38](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/message.ts#L38)

---

### MessageProvenance

> **MessageProvenance** = `z.infer`\<_typeof_ [`MessageProvenanceSchema`](#messageprovenanceschema)>\>

Defined in: [message.ts:16](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/message.ts#L16)

---

### ProtocolError

> **ProtocolError** = `z.infer`\<_typeof_ [`ProtocolErrorSchema`](#protocolerrorschema)>\>

Defined in: [protocol-error.ts:16](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/protocol-error.ts#L16)

---

### ProtocolVersion

> **ProtocolVersion** = `z.infer`\<_typeof_ [`ProtocolVersionSchema`](#protocolversionschema)>\>

Defined in: [common.ts:5](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/common.ts#L5)

---

### RemoteExecutionRequest

> **RemoteExecutionRequest** = `z.infer`\<_typeof_ [`RemoteExecutionRequestSchema`](#remoteexecutionrequestschema)>\>

Defined in: [http.ts:18](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/http.ts#L18)

---

### RemoteResourceOperation

> **RemoteResourceOperation** = `z.infer`\<_typeof_ [`RemoteResourceOperationSchema`](#remoteresourceoperationschema)>\>

Defined in: [http.ts:11](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/http.ts#L11)

---

### ResourceOperation

> **ResourceOperation** = `z.infer`\<_typeof_ [`ResourceOperationSchema`](#resourceoperationschema)>\>

Defined in: [resource.ts:21](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/resource.ts#L21)

---

### ResourceRef

> **ResourceRef** = `z.infer`\<_typeof_ [`ResourceRefSchema`](#resourcerefschema)>\>

Defined in: [capability.ts:35](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/capability.ts#L35)

---

### ResourceResult

> **ResourceResult** = `z.infer`\<_typeof_ [`ResourceResultSchema`](#resourceresultschema)>\>

Defined in: [resource.ts:44](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/resource.ts#L44)

---

### RuntimeEvent

> **RuntimeEvent** = `z.infer`\<_typeof_ [`RuntimeEventSchema`](#runtimeeventschema)>\>

Defined in: [runtime.ts:27](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/runtime.ts#L27)

---

### RuntimeManifest

> **RuntimeManifest** = `z.infer`\<_typeof_ [`RuntimeManifestSchema`](#runtimemanifestschema)>\>

Defined in: [runtime.ts:17](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/runtime.ts#L17)

---

### RuntimeTurnOutcome

> **RuntimeTurnOutcome** = `z.infer`\<_typeof_ [`RuntimeTurnOutcomeSchema`](#runtimeturnoutcomeschema)>\>

Defined in: [runtime.ts:45](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/runtime.ts#L45)

---

### ServiceAddress

> **ServiceAddress** = `z.infer`\<_typeof_ [`ServiceAddressSchema`](#serviceaddressschema)>\>

Defined in: [address.ts:23](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/address.ts#L23)

---

### SharedOSApiErrorResponse

> **SharedOSApiErrorResponse** = `z.infer`\<_typeof_ [`SharedOSApiErrorResponseSchema`](#sharedosapierrorresponseschema)>\>

Defined in: [http.ts:39](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/http.ts#L39)

---

### SharedOSHealth

> **SharedOSHealth** = `z.infer`\<_typeof_ [`SharedOSHealthSchema`](#sharedoshealthschema)>\>

Defined in: [http.ts:26](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/http.ts#L26)

---

### Timestamp

> **Timestamp** = `z.infer`\<_typeof_ [`TimestampSchema`](#timestampschema)>\>

Defined in: [common.ts:13](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/common.ts#L13)

---

### ToolAnnotations

> **ToolAnnotations** = `z.infer`\<_typeof_ [`ToolAnnotationsSchema`](#toolannotationsschema)>\>

Defined in: [tool.ts:79](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L79)

---

### ToolCall

> **ToolCall** = `z.infer`\<_typeof_ [`ToolCallSchema`](#toolcallschema)>\>

Defined in: [tool.ts:182](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L182)

---

### ToolDefinition

> **ToolDefinition** = `z.infer`\<_typeof_ [`ToolDefinitionSchema`](#tooldefinitionschema)>\>

Defined in: [tool.ts:113](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L113)

---

### ToolNamespace

> **ToolNamespace** = `z.infer`\<_typeof_ [`ToolNamespaceSchema`](#toolnamespaceschema)>\>

Defined in: [tool.ts:10](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L10)

---

### ToolNamespaceCatalog

> **ToolNamespaceCatalog** = `z.infer`\<_typeof_ [`ToolNamespaceCatalogSchema`](#toolnamespacecatalogschema)>\>

Defined in: [tool.ts:170](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L170)

---

### ToolNamespaceDescriptor

> **ToolNamespaceDescriptor** = `z.infer`\<_typeof_ [`ToolNamespaceDescriptorSchema`](#toolnamespacedescriptorschema)>\>

Defined in: [tool.ts:132](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L132)

---

### ToolNamespaceUpdate

> **ToolNamespaceUpdate** = `z.infer`\<_typeof_ [`ToolNamespaceUpdateSchema`](#toolnamespaceupdateschema)>\>

Defined in: [tool.ts:69](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L69)

---

### ToolReadWrite

> **ToolReadWrite** = `z.infer`\<_typeof_ [`ToolReadWriteSchema`](#toolreadwriteschema)>\>

Defined in: [tool.ts:21](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L21)

---

### ToolResult

> **ToolResult** = `z.infer`\<_typeof_ [`ToolResultSchema`](#toolresultschema)>\>

Defined in: [tool.ts:206](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L206)

---

### ToolSource

> **ToolSource** = `z.infer`\<_typeof_ [`ToolSourceSchema`](#toolsourceschema)>\>

Defined in: [tool.ts:17](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L17)

## Variables

### AccessContextSchema

> `const` **AccessContextSchema**: `ZodObject`\<\{ `actor`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `authority`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `enabledToolNamespaces`: `ZodEffects`\<`ZodArray`\<`ZodString`, `"many"`>\>, `string`[], `string`[]\>; `grants`: `ZodArray`\<`ZodObject`\<\{ `capabilities`: `ZodArray`\<`ZodObject`\<\{ `actions`: `ZodArray`\<`ZodString`, `"many"`>\>; `resource`: `ZodObject`\<\{ `namespace`: `ZodString`; `owner`: `ZodOptional`\<...\>; `path`: `ZodArray`\<..., ...\>; \}, `"strict"`, `ZodTypeAny`, \{ `namespace`: `string`; `owner?`: ... \| ... \| ... \| ... \| ...; `path`: ...[]; \}, \{ `namespace`: `string`; `owner?`: ... \| ... \| ... \| ... \| ...; `path`: ...[]; \}\>; `scope`: `ZodEnum`\<\[`"exact"`, `"descendants"`\]\>; \}, `"strict"`, `ZodTypeAny`, \{ `actions`: `string`[]; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: ...; `userId`: ...; \} \| \{ `agentId`: ...; `kind`: ...; \} \| \{ `conversationId`: ...; `kind`: ...; \} \| \{ `kind`: ...; `serviceId`: ...; \}; `path`: `string`[]; \}; `scope`: `"exact"` \| `"descendants"`; \}, \{ `actions`: `string`[]; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: ...; `userId`: ...; \} \| \{ `agentId`: ...; `kind`: ...; \} \| \{ `conversationId`: ...; `kind`: ...; \} \| \{ `kind`: ...; `serviceId`: ...; \}; `path`: `string`[]; \}; `scope`: `"exact"` \| `"descendants"`; \}\>, `"many"`>\>; `constraints`: `ZodEffects`\<`ZodObject`\<\{ `delegationDepth`: `ZodOptional`\<`ZodNumber`>\>; `expiresAt`: `ZodOptional`\<`ZodString`>\>; `maxUses`: `ZodOptional`\<`ZodNumber`>\>; `notBefore`: `ZodOptional`\<`ZodString`>\>; `purposes`: `ZodOptional`\<`ZodArray`\<`ZodString`, `"many"`>>\>\>; \}, `"strict"`, `ZodTypeAny`, \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}, \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}\>, \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}, \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}\>; `delegation`: `ZodOptional`\<`ZodObject`\<\{ `chain`: `ZodArray`\<`ZodString`, `"many"`>\>; `depth`: `ZodNumber`; `parentGrantId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `chain`: `string`[]; `depth`: `number`; `parentGrantId`: `string`; \}, \{ `chain`: `string`[]; `depth`: `number`; `parentGrantId`: `string`; \}\>\>; `id`: `ZodString`; `issuedAt`: `ZodString`; `issuer`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `metadata`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `namespaceId`: `ZodString`; `revokedAt`: `ZodOptional`\<`ZodString`>\>; `subject`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; \}, `"strict"`, `ZodTypeAny`, \{ `capabilities`: `object`[]; `constraints`: \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}; `delegation?`: \{ `chain`: `string`[]; `depth`: `number`; `parentGrantId`: `string`; \}; `id`: `string`; `issuedAt`: `string`; `issuer`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `metadata?`: [`JsonObject`](#jsonobject); `namespaceId`: `string`; `revokedAt?`: `string`; `subject`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \}, \{ `capabilities`: `object`[]; `constraints`: \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}; `delegation?`: \{ `chain`: `string`[]; `depth`: `number`; `parentGrantId`: `string`; \}; `id`: `string`; `issuedAt`: `string`; `issuer`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `metadata?`: [`JsonObject`](#jsonobject); `namespaceId`: `string`; `revokedAt?`: `string`; `subject`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \}\>, `"many"`>\>; `namespaceId`: `ZodString`; `now`: `ZodString`; `owner`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `purpose`: `ZodString`; `traceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `grants`: `object`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \}, \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `grants`: `object`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \}\>

Defined in: [access.ts:10](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/access.ts#L10)

All inputs needed for a deterministic permission decision.

---

### AddressSchema

> `const` **AddressSchema**: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>

Defined in: [address.ts:26](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/address.ts#L26)

A structured protocol address; no string suffix or prefix parsing is needed.

---

### AgentAddressSchema

> `const` **AgentAddressSchema**: `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>

Defined in: [address.ts:10](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/address.ts#L10)

---

### AuthorizationDecisionSchema

> `const` **AuthorizationDecisionSchema**: `ZodObject`\<\{ `allowed`: `ZodBoolean`; `matchedGrantId`: `ZodOptional`\<`ZodString`>\>; `metadata`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `reasonCode`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `allowed`: `boolean`; `matchedGrantId?`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `reasonCode`: `string`; \}, \{ `allowed`: `boolean`; `matchedGrantId?`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `reasonCode`: `string`; \}\>

Defined in: [access.ts:27](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/access.ts#L27)

A portable explanation of one authorization check.

---

### CapabilityConstraintsSchema

> `const` **CapabilityConstraintsSchema**: `ZodEffects`\<`ZodObject`\<\{ `delegationDepth`: `ZodOptional`\<`ZodNumber`>\>; `expiresAt`: `ZodOptional`\<`ZodString`>\>; `maxUses`: `ZodOptional`\<`ZodNumber`>\>; `notBefore`: `ZodOptional`\<`ZodString`>\>; `purposes`: `ZodOptional`\<`ZodArray`\<`ZodString`, `"many"`>>\>\>; \}, `"strict"`, `ZodTypeAny`, \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}, \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}\>, \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}, \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}\>

Defined in: [capability.ts:48](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/capability.ts#L48)

---

### CapabilityGrantSchema

> `const` **CapabilityGrantSchema**: `ZodObject`\<\{ `capabilities`: `ZodArray`\<`ZodObject`\<\{ `actions`: `ZodArray`\<`ZodString`, `"many"`>\>; `resource`: `ZodObject`\<\{ `namespace`: `ZodString`; `owner`: `ZodOptional`\<`ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<..., ..., ..., ..., ...\>, `ZodObject`\<..., ..., ..., ..., ...\>, `ZodObject`\<..., ..., ..., ..., ...\>, `ZodObject`\<..., ..., ..., ..., ...\>\]\>\>; `path`: `ZodArray`\<`ZodString`, `"many"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}, \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}\>; `scope`: `ZodEnum`\<\[`"exact"`, `"descendants"`\]\>; \}, `"strict"`, `ZodTypeAny`, \{ `actions`: `string`[]; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; `scope`: `"exact"` \| `"descendants"`; \}, \{ `actions`: `string`[]; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; `scope`: `"exact"` \| `"descendants"`; \}\>, `"many"`>\>; `constraints`: `ZodEffects`\<`ZodObject`\<\{ `delegationDepth`: `ZodOptional`\<`ZodNumber`>\>; `expiresAt`: `ZodOptional`\<`ZodString`>\>; `maxUses`: `ZodOptional`\<`ZodNumber`>\>; `notBefore`: `ZodOptional`\<`ZodString`>\>; `purposes`: `ZodOptional`\<`ZodArray`\<`ZodString`, `"many"`>>\>\>; \}, `"strict"`, `ZodTypeAny`, \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}, \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}\>, \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}, \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}\>; `delegation`: `ZodOptional`\<`ZodObject`\<\{ `chain`: `ZodArray`\<`ZodString`, `"many"`>\>; `depth`: `ZodNumber`; `parentGrantId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `chain`: `string`[]; `depth`: `number`; `parentGrantId`: `string`; \}, \{ `chain`: `string`[]; `depth`: `number`; `parentGrantId`: `string`; \}\>\>; `id`: `ZodString`; `issuedAt`: `ZodString`; `issuer`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `metadata`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `namespaceId`: `ZodString`; `revokedAt`: `ZodOptional`\<`ZodString`>\>; `subject`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; \}, `"strict"`, `ZodTypeAny`, \{ `capabilities`: `object`[]; `constraints`: \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}; `delegation?`: \{ `chain`: `string`[]; `depth`: `number`; `parentGrantId`: `string`; \}; `id`: `string`; `issuedAt`: `string`; `issuer`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `metadata?`: [`JsonObject`](#jsonobject); `namespaceId`: `string`; `revokedAt?`: `string`; `subject`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \}, \{ `capabilities`: `object`[]; `constraints`: \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}; `delegation?`: \{ `chain`: `string`[]; `depth`: `number`; `parentGrantId`: `string`; \}; `id`: `string`; `issuedAt`: `string`; `issuer`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `metadata?`: [`JsonObject`](#jsonobject); `namespaceId`: `string`; `revokedAt?`: `string`; `subject`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \}\>

Defined in: [capability.ts:111](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/capability.ts#L111)

---

### CapabilityRequestSchema

> `const` **CapabilityRequestSchema**: `ZodObject`\<\{ `capabilities`: `ZodArray`\<`ZodObject`\<\{ `actions`: `ZodArray`\<`ZodString`, `"many"`>\>; `resource`: `ZodObject`\<\{ `namespace`: `ZodString`; `owner`: `ZodOptional`\<`ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<..., ..., ..., ..., ...\>, `ZodObject`\<..., ..., ..., ..., ...\>, `ZodObject`\<..., ..., ..., ..., ...\>, `ZodObject`\<..., ..., ..., ..., ...\>\]\>\>; `path`: `ZodArray`\<`ZodString`, `"many"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}, \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}\>; `scope`: `ZodEnum`\<\[`"exact"`, `"descendants"`\]\>; \}, `"strict"`, `ZodTypeAny`, \{ `actions`: `string`[]; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; `scope`: `"exact"` \| `"descendants"`; \}, \{ `actions`: `string`[]; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; `scope`: `"exact"` \| `"descendants"`; \}\>, `"many"`>\>; `constraints`: `ZodOptional`\<`ZodEffects`\<`ZodObject`\<\{ `delegationDepth`: `ZodOptional`\<`ZodNumber`>\>; `expiresAt`: `ZodOptional`\<`ZodString`>\>; `maxUses`: `ZodOptional`\<`ZodNumber`>\>; `notBefore`: `ZodOptional`\<`ZodString`>\>; `purposes`: `ZodOptional`\<`ZodArray`\<`ZodString`, `"many"`>>\>\>; \}, `"strict"`, `ZodTypeAny`, \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}, \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}\>, \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}, \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}\>\>; `id`: `ZodString`; `metadata`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `namespaceId`: `ZodString`; `owner`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `purpose`: `ZodString`; `requestedAt`: `ZodString`; `requester`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; \}, `"strict"`, `ZodTypeAny`, \{ `capabilities`: `object`[]; `constraints?`: \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}; `id`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `namespaceId`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `requestedAt`: `string`; `requester`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \}, \{ `capabilities`: `object`[]; `constraints?`: \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}; `id`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `namespaceId`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `requestedAt`: `string`; `requester`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \}\>

Defined in: [capability.ts:74](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/capability.ts#L74)

A request for authority. A request is not itself proof of authority.

---

### CapabilityRequirementSchema

> `const` **CapabilityRequirementSchema**: `ZodObject`\<\{ `action`: `ZodString`; `resource`: `ZodObject`\<\{ `namespace`: `ZodString`; `owner`: `ZodOptional`\<`ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>\>; `path`: `ZodArray`\<`ZodString`, `"many"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}, \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}\>; \}, `"strict"`, `ZodTypeAny`, \{ `action`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; \}, \{ `action`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; \}\>

Defined in: [capability.ts:130](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/capability.ts#L130)

The exact capability a tool invocation requires.

---

### CapabilitySchema

> `const` **CapabilitySchema**: `ZodObject`\<\{ `actions`: `ZodArray`\<`ZodString`, `"many"`>\>; `resource`: `ZodObject`\<\{ `namespace`: `ZodString`; `owner`: `ZodOptional`\<`ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>\>; `path`: `ZodArray`\<`ZodString`, `"many"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}, \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}\>; `scope`: `ZodEnum`\<\[`"exact"`, `"descendants"`\]\>; \}, `"strict"`, `ZodTypeAny`, \{ `actions`: `string`[]; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; `scope`: `"exact"` \| `"descendants"`; \}, \{ `actions`: `string`[]; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; `scope`: `"exact"` \| `"descendants"`; \}\>

Defined in: [capability.ts:38](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/capability.ts#L38)

A positive capability. SharedOS is deny-by-default when no grant matches.

---

### EnabledToolNamespacesSchema

> `const` **EnabledToolNamespacesSchema**: `ZodEffects`\<`ZodArray`\<`ZodString`, `"many"`>\>, `string`[], `string`[]\>

Defined in: [tool.ts:23](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L23)

---

### ExecutionEventSchema

> `const` **ExecutionEventSchema**: `ZodObject`\<\{ `data`: `ZodType`\<[`JsonValue`](#jsonvalue), `ZodTypeDef`, [`JsonValue`](#jsonvalue)>\>; `eventId`: `ZodString`; `executionId`: `ZodString`; `occurredAt`: `ZodString`; `sequence`: `ZodNumber`; `traceId`: `ZodString`; `type`: `ZodString`; `version`: `ZodLiteral`\<`"1"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `data`: [`JsonValue`](#jsonvalue); `eventId`: `string`; `executionId`: `string`; `occurredAt`: `string`; `sequence`: `number`; `traceId`: `string`; `type`: `string`; `version`: `"1"`; \}, \{ `data`: [`JsonValue`](#jsonvalue); `eventId`: `string`; `executionId`: `string`; `occurredAt`: `string`; `sequence`: `number`; `traceId`: `string`; `type`: `string`; `version`: `"1"`; \}\>

Defined in: [execution.ts:42](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/execution.ts#L42)

An append-only event emitted while executing a request.

---

### ExecutionOptionsSchema

> `const` **ExecutionOptionsSchema**: `ZodObject`\<\{ `maxSteps`: `ZodOptional`\<`ZodNumber`>\>; `maxToolCalls`: `ZodOptional`\<`ZodNumber`>\>; `timeoutMs`: `ZodOptional`\<`ZodNumber`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `maxSteps?`: `number`; `maxToolCalls?`: `number`; `timeoutMs?`: `number`; \}, \{ `maxSteps?`: `number`; `maxToolCalls?`: `number`; `timeoutMs?`: `number`; \}\>

Defined in: [execution.ts:14](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/execution.ts#L14)

---

### ExecutionRequestSchema

> `const` **ExecutionRequestSchema**: `ZodObject`\<\{ `agent`: `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>; `context`: `ZodObject`\<\{ `actor`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `authority`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `enabledToolNamespaces`: `ZodEffects`\<`ZodArray`\<`ZodString`, `"many"`>\>, `string`[], `string`[]\>; `grants`: `ZodArray`\<`ZodObject`\<\{ `capabilities`: `ZodArray`\<`ZodObject`\<\{ `actions`: `ZodArray`\<..., ...\>; `resource`: `ZodObject`\<..., ..., ..., ..., ...\>; `scope`: `ZodEnum`\<...\>; \}, `"strict"`, `ZodTypeAny`, \{ `actions`: ...[]; `resource`: \{ `namespace`: ...; `owner?`: ...; `path`: ...; \}; `scope`: ... \| ...; \}, \{ `actions`: ...[]; `resource`: \{ `namespace`: ...; `owner?`: ...; `path`: ...; \}; `scope`: ... \| ...; \}\>, `"many"`>\>; `constraints`: `ZodEffects`\<`ZodObject`\<\{ `delegationDepth`: `ZodOptional`\<...\>; `expiresAt`: `ZodOptional`\<...\>; `maxUses`: `ZodOptional`\<...\>; `notBefore`: `ZodOptional`\<...\>; `purposes`: `ZodOptional`\<...\>; \}, `"strict"`, `ZodTypeAny`, \{ `delegationDepth?`: ... \| ...; `expiresAt?`: ... \| ...; `maxUses?`: ... \| ...; `notBefore?`: ... \| ...; `purposes?`: ... \| ...; \}, \{ `delegationDepth?`: ... \| ...; `expiresAt?`: ... \| ...; `maxUses?`: ... \| ...; `notBefore?`: ... \| ...; `purposes?`: ... \| ...; \}\>, \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: ...[]; \}, \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: ...[]; \}\>; `delegation`: `ZodOptional`\<`ZodObject`\<\{ `chain`: `ZodArray`\<..., ...\>; `depth`: `ZodNumber`; `parentGrantId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `chain`: ...[]; `depth`: `number`; `parentGrantId`: `string`; \}, \{ `chain`: ...[]; `depth`: `number`; `parentGrantId`: `string`; \}\>\>; `id`: `ZodString`; `issuedAt`: `ZodString`; `issuer`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: ...; `userId`: ...; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: ...; `userId`: ...; \}, \{ `kind`: ...; `userId`: ...; \}\>, `ZodObject`\<\{ `agentId`: ...; `kind`: ...; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: ...; `kind`: ...; \}, \{ `agentId`: ...; `kind`: ...; \}\>, `ZodObject`\<\{ `conversationId`: ...; `kind`: ...; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: ...; `kind`: ...; \}, \{ `conversationId`: ...; `kind`: ...; \}\>, `ZodObject`\<\{ `kind`: ...; `serviceId`: ...; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: ...; `serviceId`: ...; \}, \{ `kind`: ...; `serviceId`: ...; \}\>\]\>; `metadata`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `namespaceId`: `ZodString`; `revokedAt`: `ZodOptional`\<`ZodString`>\>; `subject`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: ...; `userId`: ...; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: ...; `userId`: ...; \}, \{ `kind`: ...; `userId`: ...; \}\>, `ZodObject`\<\{ `agentId`: ...; `kind`: ...; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: ...; `kind`: ...; \}, \{ `agentId`: ...; `kind`: ...; \}\>, `ZodObject`\<\{ `conversationId`: ...; `kind`: ...; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: ...; `kind`: ...; \}, \{ `conversationId`: ...; `kind`: ...; \}\>, `ZodObject`\<\{ `kind`: ...; `serviceId`: ...; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: ...; `serviceId`: ...; \}, \{ `kind`: ...; `serviceId`: ...; \}\>\]\>; \}, `"strict"`, `ZodTypeAny`, \{ `capabilities`: `object`[]; `constraints`: \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}; `delegation?`: \{ `chain`: `string`[]; `depth`: `number`; `parentGrantId`: `string`; \}; `id`: `string`; `issuedAt`: `string`; `issuer`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `metadata?`: [`JsonObject`](#jsonobject); `namespaceId`: `string`; `revokedAt?`: `string`; `subject`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \}, \{ `capabilities`: `object`[]; `constraints`: \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}; `delegation?`: \{ `chain`: `string`[]; `depth`: `number`; `parentGrantId`: `string`; \}; `id`: `string`; `issuedAt`: `string`; `issuer`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `metadata?`: [`JsonObject`](#jsonobject); `namespaceId`: `string`; `revokedAt?`: `string`; `subject`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \}\>, `"many"`>\>; `namespaceId`: `ZodString`; `now`: `ZodString`; `owner`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `purpose`: `ZodString`; `traceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `grants`: `object`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \}, \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `grants`: `object`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \}\>; `executionId`: `ZodString`; `message`: `ZodObject`\<\{ `createdAt`: `ZodString`; `id`: `ZodString`; `intent`: `ZodString`; `payload`: `ZodType`\<[`JsonValue`](#jsonvalue), `ZodTypeDef`, [`JsonValue`](#jsonvalue)>\>; `provenance`: `ZodOptional`\<`ZodObject`\<\{ `metadata`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `parentIds`: `ZodArray`\<`ZodString`, `"many"`>\>; `source`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `metadata?`: [`JsonObject`](#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}, \{ `metadata?`: [`JsonObject`](#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}\>\>; `purpose`: `ZodString`; `receiver`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `replyTo`: `ZodOptional`\<`ZodString`>\>; `sender`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `traceId`: `ZodString`; `version`: `ZodLiteral`\<`"1"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `createdAt`: `string`; `id`: `string`; `intent`: `string`; `payload`: [`JsonValue`](#jsonvalue); `provenance?`: \{ `metadata?`: [`JsonObject`](#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}; `purpose`: `string`; `receiver`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `replyTo?`: `string`; `sender`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `traceId`: `string`; `version`: `"1"`; \}, \{ `createdAt`: `string`; `id`: `string`; `intent`: `string`; `payload`: [`JsonValue`](#jsonvalue); `provenance?`: \{ `metadata?`: [`JsonObject`](#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}; `purpose`: `string`; `receiver`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `replyTo?`: `string`; `sender`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `traceId`: `string`; `version`: `"1"`; \}\>; `metadata`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `options`: `ZodOptional`\<`ZodObject`\<\{ `maxSteps`: `ZodOptional`\<`ZodNumber`>\>; `maxToolCalls`: `ZodOptional`\<`ZodNumber`>\>; `timeoutMs`: `ZodOptional`\<`ZodNumber`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `maxSteps?`: `number`; `maxToolCalls?`: `number`; `timeoutMs?`: `number`; \}, \{ `maxSteps?`: `number`; `maxToolCalls?`: `number`; `timeoutMs?`: `number`; \}\>\>; `state`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `tools`: `ZodArray`\<`ZodEffects`\<`ZodObject`\<\{ `annotations`: `ZodOptional`\<`ZodObject`\<\{ `destructive`: `ZodOptional`\<`ZodBoolean`>\>; `idempotent`: `ZodOptional`\<`ZodBoolean`>\>; `readOnly`: `ZodOptional`\<`ZodBoolean`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `destructive?`: `boolean`; `idempotent?`: `boolean`; `readOnly?`: `boolean`; \}, \{ `destructive?`: `boolean`; `idempotent?`: `boolean`; `readOnly?`: `boolean`; \}\>\>; `description`: `ZodString`; `inputSchema`: `ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>\>; `metadata`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `name`: `ZodString`; `namespace`: `ZodString`; `outputSchema`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `readWrite`: `ZodEnum`\<\[`"read"`, `"write"`\]\>; `requiredCapability`: `ZodObject`\<\{ `action`: `ZodString`; `resource`: `ZodObject`\<\{ `namespace`: `ZodString`; `owner`: `ZodOptional`\<...\>; `path`: `ZodArray`\<..., ...\>; \}, `"strict"`, `ZodTypeAny`, \{ `namespace`: `string`; `owner?`: ... \| ... \| ... \| ... \| ...; `path`: ...[]; \}, \{ `namespace`: `string`; `owner?`: ... \| ... \| ... \| ... \| ...; `path`: ...[]; \}\>; \}, `"strict"`, `ZodTypeAny`, \{ `action`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: ...; `userId`: ...; \} \| \{ `agentId`: ...; `kind`: ...; \} \| \{ `conversationId`: ...; `kind`: ...; \} \| \{ `kind`: ...; `serviceId`: ...; \}; `path`: `string`[]; \}; \}, \{ `action`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: ...; `userId`: ...; \} \| \{ `agentId`: ...; `kind`: ...; \} \| \{ `conversationId`: ...; `kind`: ...; \} \| \{ `kind`: ...; `serviceId`: ...; \}; `path`: `string`[]; \}; \}\>; `source`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `annotations?`: \{ `destructive?`: `boolean`; `idempotent?`: `boolean`; `readOnly?`: `boolean`; \}; `description`: `string`; `inputSchema`: [`JsonObject`](#jsonobject); `metadata?`: [`JsonObject`](#jsonobject); `name`: `string`; `namespace`: `string`; `outputSchema?`: [`JsonObject`](#jsonobject); `readWrite`: `"read"` \| `"write"`; `requiredCapability`: \{ `action`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; \}; `source`: `string`; \}, \{ `annotations?`: \{ `destructive?`: `boolean`; `idempotent?`: `boolean`; `readOnly?`: `boolean`; \}; `description`: `string`; `inputSchema`: [`JsonObject`](#jsonobject); `metadata?`: [`JsonObject`](#jsonobject); `name`: `string`; `namespace`: `string`; `outputSchema?`: [`JsonObject`](#jsonobject); `readWrite`: `"read"` \| `"write"`; `requiredCapability`: \{ `action`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; \}; `source`: `string`; \}\>, \{ `annotations?`: \{ `destructive?`: `boolean`; `idempotent?`: `boolean`; `readOnly?`: `boolean`; \}; `description`: `string`; `inputSchema`: [`JsonObject`](#jsonobject); `metadata?`: [`JsonObject`](#jsonobject); `name`: `string`; `namespace`: `string`; `outputSchema?`: [`JsonObject`](#jsonobject); `readWrite`: `"read"` \| `"write"`; `requiredCapability`: \{ `action`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; \}; `source`: `string`; \}, \{ `annotations?`: \{ `destructive?`: `boolean`; `idempotent?`: `boolean`; `readOnly?`: `boolean`; \}; `description`: `string`; `inputSchema`: [`JsonObject`](#jsonobject); `metadata?`: [`JsonObject`](#jsonobject); `name`: `string`; `namespace`: `string`; `outputSchema?`: [`JsonObject`](#jsonobject); `readWrite`: `"read"` \| `"write"`; `requiredCapability`: \{ `action`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; \}; `source`: `string`; \}\>, `"many"`>\>; `version`: `ZodLiteral`\<`"1"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agent`: \{ `agentId`: `string`; `kind`: `"agent"`; \}; `context`: \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `grants`: `object`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \}; `executionId`: `string`; `message`: \{ `createdAt`: `string`; `id`: `string`; `intent`: `string`; `payload`: [`JsonValue`](#jsonvalue); `provenance?`: \{ `metadata?`: [`JsonObject`](#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}; `purpose`: `string`; `receiver`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `replyTo?`: `string`; `sender`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `traceId`: `string`; `version`: `"1"`; \}; `metadata?`: [`JsonObject`](#jsonobject); `options?`: \{ `maxSteps?`: `number`; `maxToolCalls?`: `number`; `timeoutMs?`: `number`; \}; `state?`: [`JsonObject`](#jsonobject); `tools`: `object`[]; `version`: `"1"`; \}, \{ `agent`: \{ `agentId`: `string`; `kind`: `"agent"`; \}; `context`: \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `grants`: `object`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \}; `executionId`: `string`; `message`: \{ `createdAt`: `string`; `id`: `string`; `intent`: `string`; `payload`: [`JsonValue`](#jsonvalue); `provenance?`: \{ `metadata?`: [`JsonObject`](#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}; `purpose`: `string`; `receiver`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `replyTo?`: `string`; `sender`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `traceId`: `string`; `version`: `"1"`; \}; `metadata?`: [`JsonObject`](#jsonobject); `options?`: \{ `maxSteps?`: `number`; `maxToolCalls?`: `number`; `timeoutMs?`: `number`; \}; `state?`: [`JsonObject`](#jsonobject); `tools`: `object`[]; `version`: `"1"`; \}\>

Defined in: [execution.ts:25](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/execution.ts#L25)

One permission-controlled agent turn. Tick scheduling stays with the host.

---

### ExecutionResultSchema

> `const` **ExecutionResultSchema**: `ZodDiscriminatedUnion`\<`"status"`, \[`ZodObject`\<`object` & `object`, `"strict"`, `ZodTypeAny`, \{ `completedAt`: `string`; `events`: `object`[]; `executionId`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `output`: [`JsonValue`](#jsonvalue); `startedAt`: `string`; `status`: `"succeeded"`; `traceId`: `string`; `version`: `"1"`; \}, \{ `completedAt`: `string`; `events`: `object`[]; `executionId`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `output`: [`JsonValue`](#jsonvalue); `startedAt`: `string`; `status`: `"succeeded"`; `traceId`: `string`; `version`: `"1"`; \}\>, `ZodObject`\<`object` & `object`, `"strict"`, `ZodTypeAny`, \{ `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `events`: `object`[]; `executionId`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `startedAt`: `string`; `status`: `"denied"`; `traceId`: `string`; `version`: `"1"`; \}, \{ `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `events`: `object`[]; `executionId`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `startedAt`: `string`; `status`: `"denied"`; `traceId`: `string`; `version`: `"1"`; \}\>, `ZodObject`\<`object` & `object`, `"strict"`, `ZodTypeAny`, \{ `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `events`: `object`[]; `executionId`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `startedAt`: `string`; `status`: `"failed"`; `traceId`: `string`; `version`: `"1"`; \}, \{ `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `events`: `object`[]; `executionId`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `startedAt`: `string`; `status`: `"failed"`; `traceId`: `string`; `version`: `"1"`; \}\>, `ZodObject`\<`object` & `object`, `"strict"`, `ZodTypeAny`, \{ `completedAt`: `string`; `error?`: \{ `code`: `string`; `details?`: [`JsonObject`](#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `events`: `object`[]; `executionId`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `startedAt`: `string`; `status`: `"cancelled"`; `traceId`: `string`; `version`: `"1"`; \}, \{ `completedAt`: `string`; `error?`: \{ `code`: `string`; `details?`: [`JsonObject`](#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `events`: `object`[]; `executionId`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `startedAt`: `string`; `status`: `"cancelled"`; `traceId`: `string`; `version`: `"1"`; \}\>\]\>

Defined in: [execution.ts:67](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/execution.ts#L67)

---

### GrantDelegationSchema

> `const` **GrantDelegationSchema**: `ZodObject`\<\{ `chain`: `ZodArray`\<`ZodString`, `"many"`>\>; `depth`: `ZodNumber`; `parentGrantId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `chain`: `string`[]; `depth`: `number`; `parentGrantId`: `string`; \}, \{ `chain`: `string`[]; `depth`: `number`; `parentGrantId`: `string`; \}\>

Defined in: [capability.ts:100](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/capability.ts#L100)

Where a derived grant came from.

`chain` is ordered root-first and ends with the immediate parent, so a
verifier can re-check every ancestor without walking links one at a time.
It is provenance, not authority: the constraints on a derived grant are
already narrowed at derivation, and the chain exists so a _later_ revocation
or expiry upstream can still invalidate what was derived from it.

---

### GroupAddressSchema

> `const` **GroupAddressSchema**: `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>

Defined in: [address.ts:15](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/address.ts#L15)

---

### HumanAddressSchema

> `const` **HumanAddressSchema**: `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>

Defined in: [address.ts:5](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/address.ts#L5)

---

### IdentifierSchema

> `const` **IdentifierSchema**: `ZodString`

Defined in: [common.ts:8](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/common.ts#L8)

An opaque identifier. Callers choose its format; SharedOS only requires stability.

---

### JsonArraySchema

> `const` **JsonArraySchema**: `z.ZodType`\<[`JsonArray`](#jsonarray)>\>

Defined in: [json.ts:28](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/json.ts#L28)

---

### JsonObjectSchema

> `const` **JsonObjectSchema**: `z.ZodType`\<[`JsonObject`](#jsonobject)>\>

Defined in: [json.ts:27](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/json.ts#L27)

---

### JsonValueSchema

> `const` **JsonValueSchema**: `z.ZodType`\<[`JsonValue`](#jsonvalue)>\>

Defined in: [json.ts:16](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/json.ts#L16)

Any value that can round-trip through JSON without custom serialization.
In particular, this rejects undefined, bigint, Date, NaN, and Infinity.

---

### MAX\_EXECUTION\_TIMEOUT\_MS

> `const` **MAX\_EXECUTION\_TIMEOUT\_MS**: `600000` = `600_000`

Defined in: [execution.ts:11](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/execution.ts#L11)

---

### MAX\_EXECUTION\_TOOL\_CALLS

> `const` **MAX\_EXECUTION\_TOOL\_CALLS**: `10000` = `10_000`

Defined in: [execution.ts:12](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/execution.ts#L12)

---

### MessageDeliveryResultSchema

> `const` **MessageDeliveryResultSchema**: `ZodDiscriminatedUnion`\<`"status"`, \[`ZodObject`\<`object` & `object`, `"strict"`, `ZodTypeAny`, \{ `messageId`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `status`: `"accepted"`; `timestamp`: `string`; \}, \{ `messageId`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `status`: `"accepted"`; `timestamp`: `string`; \}\>, `ZodObject`\<`object` & `object`, `"strict"`, `ZodTypeAny`, \{ `messageId`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `status`: `"delivered"`; `timestamp`: `string`; \}, \{ `messageId`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `status`: `"delivered"`; `timestamp`: `string`; \}\>, `ZodObject`\<`object` & `object`, `"strict"`, `ZodTypeAny`, \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `messageId`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `status`: `"denied"`; `timestamp`: `string`; \}, \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `messageId`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `status`: `"denied"`; `timestamp`: `string`; \}\>, `ZodObject`\<`object` & `object`, `"strict"`, `ZodTypeAny`, \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `messageId`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `status`: `"failed"`; `timestamp`: `string`; \}, \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `messageId`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `status`: `"failed"`; `timestamp`: `string`; \}\>\]\>

Defined in: [message.ts:47](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/message.ts#L47)

The transport-neutral outcome of submitting a message for delivery.

---

### MessageEnvelopeSchema

> `const` **MessageEnvelopeSchema**: `ZodObject`\<\{ `createdAt`: `ZodString`; `id`: `ZodString`; `intent`: `ZodString`; `payload`: `ZodType`\<[`JsonValue`](#jsonvalue), `ZodTypeDef`, [`JsonValue`](#jsonvalue)>\>; `provenance`: `ZodOptional`\<`ZodObject`\<\{ `metadata`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `parentIds`: `ZodArray`\<`ZodString`, `"many"`>\>; `source`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `metadata?`: [`JsonObject`](#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}, \{ `metadata?`: [`JsonObject`](#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}\>\>; `purpose`: `ZodString`; `receiver`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `replyTo`: `ZodOptional`\<`ZodString`>\>; `sender`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `traceId`: `ZodString`; `version`: `ZodLiteral`\<`"1"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `createdAt`: `string`; `id`: `string`; `intent`: `string`; `payload`: [`JsonValue`](#jsonvalue); `provenance?`: \{ `metadata?`: [`JsonObject`](#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}; `purpose`: `string`; `receiver`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `replyTo?`: `string`; `sender`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `traceId`: `string`; `version`: `"1"`; \}, \{ `createdAt`: `string`; `id`: `string`; `intent`: `string`; `payload`: [`JsonValue`](#jsonvalue); `provenance?`: \{ `metadata?`: [`JsonObject`](#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}; `purpose`: `string`; `receiver`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `replyTo?`: `string`; `sender`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `traceId`: `string`; `version`: `"1"`; \}\>

Defined in: [message.ts:22](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/message.ts#L22)

A message carries intent and context, never authority. Authority is supplied
separately through AccessContext and evaluated at the point of use.

---

### MessageProvenanceSchema

> `const` **MessageProvenanceSchema**: `ZodObject`\<\{ `metadata`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `parentIds`: `ZodArray`\<`ZodString`, `"many"`>\>; `source`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `metadata?`: [`JsonObject`](#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}, \{ `metadata?`: [`JsonObject`](#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}\>

Defined in: [message.ts:8](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/message.ts#L8)

---

### PathSegmentSchema

> `const` **PathSegmentSchema**: `ZodString`

Defined in: [capability.ts:15](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/capability.ts#L15)

One opaque resource-path segment.

Separators, traversal markers, and control characters are rejected here so
every host receives the same canonical path vocabulary. Filesystem-backed
providers must still resolve beneath their configured root and reject
symlink escapes.

---

### ProtocolErrorSchema

> `const` **ProtocolErrorSchema**: `ZodObject`\<\{ `code`: `ZodString`; `details`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `message`: `ZodString`; `retryable`: `ZodOptional`\<`ZodBoolean`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `code`: `string`; `details?`: [`JsonObject`](#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}, \{ `code`: `string`; `details?`: [`JsonObject`](#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}\>

Defined in: [protocol-error.ts:7](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/protocol-error.ts#L7)

A machine-readable error that is safe to return over npm and HTTP APIs.

---

### ProtocolVersionSchema

> `const` **ProtocolVersionSchema**: `ZodLiteral`\<`"1"`>\>

Defined in: [common.ts:4](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/common.ts#L4)

The wire protocol version implemented by this package.

---

### RemoteExecutionRequestSchema

> `const` **RemoteExecutionRequestSchema**: `ZodObject`\<`Omit`\<\{ `agent`: `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>; `context`: `ZodObject`\<\{ `actor`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `authority`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `enabledToolNamespaces`: `ZodEffects`\<`ZodArray`\<`ZodString`, `"many"`>\>, `string`[], `string`[]\>; `grants`: `ZodArray`\<`ZodObject`\<\{ `capabilities`: `ZodArray`\<`ZodObject`\<\{ `actions`: ...; `resource`: ...; `scope`: ...; \}, `"strict"`, `ZodTypeAny`, \{ `actions`: ...; `resource`: ...; `scope`: ...; \}, \{ `actions`: ...; `resource`: ...; `scope`: ...; \}\>, `"many"`>\>; `constraints`: `ZodEffects`\<`ZodObject`\<\{ `delegationDepth`: ...; `expiresAt`: ...; `maxUses`: ...; `notBefore`: ...; `purposes`: ...; \}, `"strict"`, `ZodTypeAny`, \{ `delegationDepth?`: ...; `expiresAt?`: ...; `maxUses?`: ...; `notBefore?`: ...; `purposes?`: ...; \}, \{ `delegationDepth?`: ...; `expiresAt?`: ...; `maxUses?`: ...; `notBefore?`: ...; `purposes?`: ...; \}\>, \{ `delegationDepth?`: ... \| ...; `expiresAt?`: ... \| ...; `maxUses?`: ... \| ...; `notBefore?`: ... \| ...; `purposes?`: ... \| ...; \}, \{ `delegationDepth?`: ... \| ...; `expiresAt?`: ... \| ...; `maxUses?`: ... \| ...; `notBefore?`: ... \| ...; `purposes?`: ... \| ...; \}\>; `delegation`: `ZodOptional`\<`ZodObject`\<\{ `chain`: ...; `depth`: ...; `parentGrantId`: ...; \}, `"strict"`, `ZodTypeAny`, \{ `chain`: ...; `depth`: ...; `parentGrantId`: ...; \}, \{ `chain`: ...; `depth`: ...; `parentGrantId`: ...; \}\>\>; `id`: `ZodString`; `issuedAt`: `ZodString`; `issuer`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<..., ..., ..., ..., ...\>, `ZodObject`\<..., ..., ..., ..., ...\>, `ZodObject`\<..., ..., ..., ..., ...\>, `ZodObject`\<..., ..., ..., ..., ...\>\]\>; `metadata`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `namespaceId`: `ZodString`; `revokedAt`: `ZodOptional`\<`ZodString`>\>; `subject`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<..., ..., ..., ..., ...\>, `ZodObject`\<..., ..., ..., ..., ...\>, `ZodObject`\<..., ..., ..., ..., ...\>, `ZodObject`\<..., ..., ..., ..., ...\>\]\>; \}, `"strict"`, `ZodTypeAny`, \{ `capabilities`: `object`[]; `constraints`: \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: ...[]; \}; `delegation?`: \{ `chain`: ...[]; `depth`: `number`; `parentGrantId`: `string`; \}; `id`: `string`; `issuedAt`: `string`; `issuer`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `metadata?`: [`JsonObject`](#jsonobject); `namespaceId`: `string`; `revokedAt?`: `string`; `subject`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \}, \{ `capabilities`: `object`[]; `constraints`: \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: ...[]; \}; `delegation?`: \{ `chain`: ...[]; `depth`: `number`; `parentGrantId`: `string`; \}; `id`: `string`; `issuedAt`: `string`; `issuer`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `metadata?`: [`JsonObject`](#jsonobject); `namespaceId`: `string`; `revokedAt?`: `string`; `subject`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \}\>, `"many"`>\>; `namespaceId`: `ZodString`; `now`: `ZodString`; `owner`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `purpose`: `ZodString`; `traceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `grants`: `object`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \}, \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `grants`: `object`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \}\>; `executionId`: `ZodString`; `message`: `ZodObject`\<\{ `createdAt`: `ZodString`; `id`: `ZodString`; `intent`: `ZodString`; `payload`: `ZodType`\<[`JsonValue`](#jsonvalue), `ZodTypeDef`, [`JsonValue`](#jsonvalue)>\>; `provenance`: `ZodOptional`\<`ZodObject`\<\{ `metadata`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `parentIds`: `ZodArray`\<`ZodString`, `"many"`>\>; `source`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `metadata?`: [`JsonObject`](#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}, \{ `metadata?`: [`JsonObject`](#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}\>\>; `purpose`: `ZodString`; `receiver`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `replyTo`: `ZodOptional`\<`ZodString`>\>; `sender`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `traceId`: `ZodString`; `version`: `ZodLiteral`\<`"1"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `createdAt`: `string`; `id`: `string`; `intent`: `string`; `payload`: [`JsonValue`](#jsonvalue); `provenance?`: \{ `metadata?`: [`JsonObject`](#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}; `purpose`: `string`; `receiver`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `replyTo?`: `string`; `sender`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `traceId`: `string`; `version`: `"1"`; \}, \{ `createdAt`: `string`; `id`: `string`; `intent`: `string`; `payload`: [`JsonValue`](#jsonvalue); `provenance?`: \{ `metadata?`: [`JsonObject`](#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}; `purpose`: `string`; `receiver`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `replyTo?`: `string`; `sender`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `traceId`: `string`; `version`: `"1"`; \}\>; `metadata`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `options`: `ZodOptional`\<`ZodObject`\<\{ `maxSteps`: `ZodOptional`\<`ZodNumber`>\>; `maxToolCalls`: `ZodOptional`\<`ZodNumber`>\>; `timeoutMs`: `ZodOptional`\<`ZodNumber`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `maxSteps?`: `number`; `maxToolCalls?`: `number`; `timeoutMs?`: `number`; \}, \{ `maxSteps?`: `number`; `maxToolCalls?`: `number`; `timeoutMs?`: `number`; \}\>\>; `state`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `tools`: `ZodArray`\<`ZodEffects`\<`ZodObject`\<\{ `annotations`: `ZodOptional`\<`ZodObject`\<\{ `destructive`: `ZodOptional`\<...\>; `idempotent`: `ZodOptional`\<...\>; `readOnly`: `ZodOptional`\<...\>; \}, `"strict"`, `ZodTypeAny`, \{ `destructive?`: ... \| ... \| ...; `idempotent?`: ... \| ... \| ...; `readOnly?`: ... \| ... \| ...; \}, \{ `destructive?`: ... \| ... \| ...; `idempotent?`: ... \| ... \| ...; `readOnly?`: ... \| ... \| ...; \}\>\>; `description`: `ZodString`; `inputSchema`: `ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>\>; `metadata`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `name`: `ZodString`; `namespace`: `ZodString`; `outputSchema`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `readWrite`: `ZodEnum`\<\[`"read"`, `"write"`\]\>; `requiredCapability`: `ZodObject`\<\{ `action`: `ZodString`; `resource`: `ZodObject`\<\{ `namespace`: ...; `owner`: ...; `path`: ...; \}, `"strict"`, `ZodTypeAny`, \{ `namespace`: ...; `owner?`: ...; `path`: ...; \}, \{ `namespace`: ...; `owner?`: ...; `path`: ...; \}\>; \}, `"strict"`, `ZodTypeAny`, \{ `action`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: ... \| ... \| ... \| ... \| ...; `path`: ...[]; \}; \}, \{ `action`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: ... \| ... \| ... \| ... \| ...; `path`: ...[]; \}; \}\>; `source`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `annotations?`: \{ `destructive?`: `boolean`; `idempotent?`: `boolean`; `readOnly?`: `boolean`; \}; `description`: `string`; `inputSchema`: [`JsonObject`](#jsonobject); `metadata?`: [`JsonObject`](#jsonobject); `name`: `string`; `namespace`: `string`; `outputSchema?`: [`JsonObject`](#jsonobject); `readWrite`: `"read"` \| `"write"`; `requiredCapability`: \{ `action`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: ...; `userId`: ...; \} \| \{ `agentId`: ...; `kind`: ...; \} \| \{ `conversationId`: ...; `kind`: ...; \} \| \{ `kind`: ...; `serviceId`: ...; \}; `path`: `string`[]; \}; \}; `source`: `string`; \}, \{ `annotations?`: \{ `destructive?`: `boolean`; `idempotent?`: `boolean`; `readOnly?`: `boolean`; \}; `description`: `string`; `inputSchema`: [`JsonObject`](#jsonobject); `metadata?`: [`JsonObject`](#jsonobject); `name`: `string`; `namespace`: `string`; `outputSchema?`: [`JsonObject`](#jsonobject); `readWrite`: `"read"` \| `"write"`; `requiredCapability`: \{ `action`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: ...; `userId`: ...; \} \| \{ `agentId`: ...; `kind`: ...; \} \| \{ `conversationId`: ...; `kind`: ...; \} \| \{ `kind`: ...; `serviceId`: ...; \}; `path`: `string`[]; \}; \}; `source`: `string`; \}\>, \{ `annotations?`: \{ `destructive?`: `boolean`; `idempotent?`: `boolean`; `readOnly?`: `boolean`; \}; `description`: `string`; `inputSchema`: [`JsonObject`](#jsonobject); `metadata?`: [`JsonObject`](#jsonobject); `name`: `string`; `namespace`: `string`; `outputSchema?`: [`JsonObject`](#jsonobject); `readWrite`: `"read"` \| `"write"`; `requiredCapability`: \{ `action`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; \}; `source`: `string`; \}, \{ `annotations?`: \{ `destructive?`: `boolean`; `idempotent?`: `boolean`; `readOnly?`: `boolean`; \}; `description`: `string`; `inputSchema`: [`JsonObject`](#jsonobject); `metadata?`: [`JsonObject`](#jsonobject); `name`: `string`; `namespace`: `string`; `outputSchema?`: [`JsonObject`](#jsonobject); `readWrite`: `"read"` \| `"write"`; `requiredCapability`: \{ `action`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; \}; `source`: `string`; \}\>, `"many"`>\>; `version`: `ZodLiteral`\<`"1"`>\>; \}, `"context"` \| `"tools"`>\>, `"strict"`, `ZodTypeAny`, \{ `agent`: \{ `agentId`: `string`; `kind`: `"agent"`; \}; `executionId`: `string`; `message`: \{ `createdAt`: `string`; `id`: `string`; `intent`: `string`; `payload`: [`JsonValue`](#jsonvalue); `provenance?`: \{ `metadata?`: [`JsonObject`](#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}; `purpose`: `string`; `receiver`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `replyTo?`: `string`; `sender`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `traceId`: `string`; `version`: `"1"`; \}; `metadata?`: [`JsonObject`](#jsonobject); `options?`: \{ `maxSteps?`: `number`; `maxToolCalls?`: `number`; `timeoutMs?`: `number`; \}; `state?`: [`JsonObject`](#jsonobject); `version`: `"1"`; \}, \{ `agent`: \{ `agentId`: `string`; `kind`: `"agent"`; \}; `executionId`: `string`; `message`: \{ `createdAt`: `string`; `id`: `string`; `intent`: `string`; `payload`: [`JsonValue`](#jsonvalue); `provenance?`: \{ `metadata?`: [`JsonObject`](#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}; `purpose`: `string`; `receiver`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `replyTo?`: `string`; `sender`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `traceId`: `string`; `version`: `"1"`; \}; `metadata?`: [`JsonObject`](#jsonobject); `options?`: \{ `maxSteps?`: `number`; `maxToolCalls?`: `number`; `timeoutMs?`: `number`; \}; `state?`: [`JsonObject`](#jsonobject); `version`: `"1"`; \}\>

Defined in: [http.ts:14](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/http.ts#L14)

Turn request accepted over HTTP; authority and visible tools are host-derived.

---

### RemoteResourceOperationSchema

> `const` **RemoteResourceOperationSchema**: `ZodObject`\<`Omit`\<\{ `action`: `ZodString`; `context`: `ZodObject`\<\{ `actor`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `authority`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `enabledToolNamespaces`: `ZodEffects`\<`ZodArray`\<`ZodString`, `"many"`>\>, `string`[], `string`[]\>; `grants`: `ZodArray`\<`ZodObject`\<\{ `capabilities`: `ZodArray`\<`ZodObject`\<\{ `actions`: ...; `resource`: ...; `scope`: ...; \}, `"strict"`, `ZodTypeAny`, \{ `actions`: ...; `resource`: ...; `scope`: ...; \}, \{ `actions`: ...; `resource`: ...; `scope`: ...; \}\>, `"many"`>\>; `constraints`: `ZodEffects`\<`ZodObject`\<\{ `delegationDepth`: ...; `expiresAt`: ...; `maxUses`: ...; `notBefore`: ...; `purposes`: ...; \}, `"strict"`, `ZodTypeAny`, \{ `delegationDepth?`: ...; `expiresAt?`: ...; `maxUses?`: ...; `notBefore?`: ...; `purposes?`: ...; \}, \{ `delegationDepth?`: ...; `expiresAt?`: ...; `maxUses?`: ...; `notBefore?`: ...; `purposes?`: ...; \}\>, \{ `delegationDepth?`: ... \| ...; `expiresAt?`: ... \| ...; `maxUses?`: ... \| ...; `notBefore?`: ... \| ...; `purposes?`: ... \| ...; \}, \{ `delegationDepth?`: ... \| ...; `expiresAt?`: ... \| ...; `maxUses?`: ... \| ...; `notBefore?`: ... \| ...; `purposes?`: ... \| ...; \}\>; `delegation`: `ZodOptional`\<`ZodObject`\<\{ `chain`: ...; `depth`: ...; `parentGrantId`: ...; \}, `"strict"`, `ZodTypeAny`, \{ `chain`: ...; `depth`: ...; `parentGrantId`: ...; \}, \{ `chain`: ...; `depth`: ...; `parentGrantId`: ...; \}\>\>; `id`: `ZodString`; `issuedAt`: `ZodString`; `issuer`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<..., ..., ..., ..., ...\>, `ZodObject`\<..., ..., ..., ..., ...\>, `ZodObject`\<..., ..., ..., ..., ...\>, `ZodObject`\<..., ..., ..., ..., ...\>\]\>; `metadata`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `namespaceId`: `ZodString`; `revokedAt`: `ZodOptional`\<`ZodString`>\>; `subject`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<..., ..., ..., ..., ...\>, `ZodObject`\<..., ..., ..., ..., ...\>, `ZodObject`\<..., ..., ..., ..., ...\>, `ZodObject`\<..., ..., ..., ..., ...\>\]\>; \}, `"strict"`, `ZodTypeAny`, \{ `capabilities`: `object`[]; `constraints`: \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: ...[]; \}; `delegation?`: \{ `chain`: ...[]; `depth`: `number`; `parentGrantId`: `string`; \}; `id`: `string`; `issuedAt`: `string`; `issuer`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `metadata?`: [`JsonObject`](#jsonobject); `namespaceId`: `string`; `revokedAt?`: `string`; `subject`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \}, \{ `capabilities`: `object`[]; `constraints`: \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: ...[]; \}; `delegation?`: \{ `chain`: ...[]; `depth`: `number`; `parentGrantId`: `string`; \}; `id`: `string`; `issuedAt`: `string`; `issuer`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `metadata?`: [`JsonObject`](#jsonobject); `namespaceId`: `string`; `revokedAt?`: `string`; `subject`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \}\>, `"many"`>\>; `namespaceId`: `ZodString`; `now`: `ZodString`; `owner`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `purpose`: `ZodString`; `traceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `grants`: `object`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \}, \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `grants`: `object`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \}\>; `input`: `ZodOptional`\<`ZodType`\<[`JsonValue`](#jsonvalue), `ZodTypeDef`, [`JsonValue`](#jsonvalue)>>\>\>; `metadata`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `operationId`: `ZodString`; `resource`: `ZodObject`\<\{ `namespace`: `ZodString`; `owner`: `ZodOptional`\<`ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<...\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<...\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<...\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<...\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>\>; `path`: `ZodArray`\<`ZodString`, `"many"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}, \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}\>; \}, `"context"`>\>, `"strict"`, `ZodTypeAny`, \{ `action`: `string`; `input?`: [`JsonValue`](#jsonvalue); `metadata?`: [`JsonObject`](#jsonobject); `operationId`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; \}, \{ `action`: `string`; `input?`: [`JsonValue`](#jsonvalue); `metadata?`: [`JsonObject`](#jsonobject); `operationId`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; \}\>

Defined in: [http.ts:8](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/http.ts#L8)

Resource operation accepted over HTTP; authority is injected by the host.

---

### ResourceOperationSchema

> `const` **ResourceOperationSchema**: `ZodObject`\<\{ `action`: `ZodString`; `context`: `ZodObject`\<\{ `actor`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `authority`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `enabledToolNamespaces`: `ZodEffects`\<`ZodArray`\<`ZodString`, `"many"`>\>, `string`[], `string`[]\>; `grants`: `ZodArray`\<`ZodObject`\<\{ `capabilities`: `ZodArray`\<`ZodObject`\<\{ `actions`: `ZodArray`\<..., ...\>; `resource`: `ZodObject`\<..., ..., ..., ..., ...\>; `scope`: `ZodEnum`\<...\>; \}, `"strict"`, `ZodTypeAny`, \{ `actions`: ...[]; `resource`: \{ `namespace`: ...; `owner?`: ...; `path`: ...; \}; `scope`: ... \| ...; \}, \{ `actions`: ...[]; `resource`: \{ `namespace`: ...; `owner?`: ...; `path`: ...; \}; `scope`: ... \| ...; \}\>, `"many"`>\>; `constraints`: `ZodEffects`\<`ZodObject`\<\{ `delegationDepth`: `ZodOptional`\<...\>; `expiresAt`: `ZodOptional`\<...\>; `maxUses`: `ZodOptional`\<...\>; `notBefore`: `ZodOptional`\<...\>; `purposes`: `ZodOptional`\<...\>; \}, `"strict"`, `ZodTypeAny`, \{ `delegationDepth?`: ... \| ...; `expiresAt?`: ... \| ...; `maxUses?`: ... \| ...; `notBefore?`: ... \| ...; `purposes?`: ... \| ...; \}, \{ `delegationDepth?`: ... \| ...; `expiresAt?`: ... \| ...; `maxUses?`: ... \| ...; `notBefore?`: ... \| ...; `purposes?`: ... \| ...; \}\>, \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: ...[]; \}, \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: ...[]; \}\>; `delegation`: `ZodOptional`\<`ZodObject`\<\{ `chain`: `ZodArray`\<..., ...\>; `depth`: `ZodNumber`; `parentGrantId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `chain`: ...[]; `depth`: `number`; `parentGrantId`: `string`; \}, \{ `chain`: ...[]; `depth`: `number`; `parentGrantId`: `string`; \}\>\>; `id`: `ZodString`; `issuedAt`: `ZodString`; `issuer`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: ...; `userId`: ...; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: ...; `userId`: ...; \}, \{ `kind`: ...; `userId`: ...; \}\>, `ZodObject`\<\{ `agentId`: ...; `kind`: ...; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: ...; `kind`: ...; \}, \{ `agentId`: ...; `kind`: ...; \}\>, `ZodObject`\<\{ `conversationId`: ...; `kind`: ...; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: ...; `kind`: ...; \}, \{ `conversationId`: ...; `kind`: ...; \}\>, `ZodObject`\<\{ `kind`: ...; `serviceId`: ...; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: ...; `serviceId`: ...; \}, \{ `kind`: ...; `serviceId`: ...; \}\>\]\>; `metadata`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `namespaceId`: `ZodString`; `revokedAt`: `ZodOptional`\<`ZodString`>\>; `subject`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: ...; `userId`: ...; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: ...; `userId`: ...; \}, \{ `kind`: ...; `userId`: ...; \}\>, `ZodObject`\<\{ `agentId`: ...; `kind`: ...; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: ...; `kind`: ...; \}, \{ `agentId`: ...; `kind`: ...; \}\>, `ZodObject`\<\{ `conversationId`: ...; `kind`: ...; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: ...; `kind`: ...; \}, \{ `conversationId`: ...; `kind`: ...; \}\>, `ZodObject`\<\{ `kind`: ...; `serviceId`: ...; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: ...; `serviceId`: ...; \}, \{ `kind`: ...; `serviceId`: ...; \}\>\]\>; \}, `"strict"`, `ZodTypeAny`, \{ `capabilities`: `object`[]; `constraints`: \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}; `delegation?`: \{ `chain`: `string`[]; `depth`: `number`; `parentGrantId`: `string`; \}; `id`: `string`; `issuedAt`: `string`; `issuer`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `metadata?`: [`JsonObject`](#jsonobject); `namespaceId`: `string`; `revokedAt?`: `string`; `subject`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \}, \{ `capabilities`: `object`[]; `constraints`: \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}; `delegation?`: \{ `chain`: `string`[]; `depth`: `number`; `parentGrantId`: `string`; \}; `id`: `string`; `issuedAt`: `string`; `issuer`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `metadata?`: [`JsonObject`](#jsonobject); `namespaceId`: `string`; `revokedAt?`: `string`; `subject`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \}\>, `"many"`>\>; `namespaceId`: `ZodString`; `now`: `ZodString`; `owner`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `purpose`: `ZodString`; `traceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `grants`: `object`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \}, \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `grants`: `object`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \}\>; `input`: `ZodOptional`\<`ZodType`\<[`JsonValue`](#jsonvalue), `ZodTypeDef`, [`JsonValue`](#jsonvalue)>>\>\>; `metadata`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `operationId`: `ZodString`; `resource`: `ZodObject`\<\{ `namespace`: `ZodString`; `owner`: `ZodOptional`\<`ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>\>; `path`: `ZodArray`\<`ZodString`, `"many"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}, \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}\>; \}, `"strict"`, `ZodTypeAny`, \{ `action`: `string`; `context`: \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `grants`: `object`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \}; `input?`: [`JsonValue`](#jsonvalue); `metadata?`: [`JsonObject`](#jsonobject); `operationId`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; \}, \{ `action`: `string`; `context`: \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `grants`: `object`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \}; `input?`: [`JsonValue`](#jsonvalue); `metadata?`: [`JsonObject`](#jsonobject); `operationId`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; \}\>

Defined in: [resource.ts:10](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/resource.ts#L10)

A self-contained request to perform one permission-controlled operation.

---

### ResourceRefSchema

> `const` **ResourceRefSchema**: `ZodObject`\<\{ `namespace`: `ZodString`; `owner`: `ZodOptional`\<`ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>\>; `path`: `ZodArray`\<`ZodString`, `"many"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}, \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}\>

Defined in: [capability.ts:27](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/capability.ts#L27)

A host-independent reference to a resource exposed through SharedOS.

---

### ResourceResultSchema

> `const` **ResourceResultSchema**: `ZodDiscriminatedUnion`\<`"status"`, \[`ZodObject`\<`object` & `object`, `"strict"`, `ZodTypeAny`, \{ `completedAt`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `operationId`: `string`; `output`: [`JsonValue`](#jsonvalue); `status`: `"succeeded"`; \}, \{ `completedAt`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `operationId`: `string`; `output`: [`JsonValue`](#jsonvalue); `status`: `"succeeded"`; \}\>, `ZodObject`\<`object` & `object`, `"strict"`, `ZodTypeAny`, \{ `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](#jsonobject); `operationId`: `string`; `status`: `"denied"`; \}, \{ `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](#jsonobject); `operationId`: `string`; `status`: `"denied"`; \}\>, `ZodObject`\<`object` & `object`, `"strict"`, `ZodTypeAny`, \{ `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](#jsonobject); `operationId`: `string`; `status`: `"failed"`; \}, \{ `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](#jsonobject); `operationId`: `string`; `status`: `"failed"`; \}\>\]\>

Defined in: [resource.ts:29](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/resource.ts#L29)

---

### RuntimeEventSchema

> `const` **RuntimeEventSchema**: `ZodObject`\<\{ `data`: `ZodType`\<[`JsonValue`](#jsonvalue), `ZodTypeDef`, [`JsonValue`](#jsonvalue)>\>; `type`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `data`: [`JsonValue`](#jsonvalue); `type`: `string`; \}, \{ `data`: [`JsonValue`](#jsonvalue); `type`: `string`; \}\>

Defined in: [runtime.ts:20](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/runtime.ts#L20)

A runtime-originated observation. The SharedOS envelope assigns its audit identity.

---

### RuntimeManifestSchema

> `const` **RuntimeManifestSchema**: `ZodObject`\<\{ `id`: `ZodString`; `metadata`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `protocolVersion`: `ZodLiteral`\<`"1"`>\>; `version`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `id`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `protocolVersion`: `"1"`; `version`: `string`; \}, \{ `id`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `protocolVersion`: `"1"`; `version`: `string`; \}\>

Defined in: [runtime.ts:8](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/runtime.ts#L8)

Stable, JSON-safe provenance for one installed runtime implementation.

---

### RuntimeTurnOutcomeSchema

> `const` **RuntimeTurnOutcomeSchema**: `ZodDiscriminatedUnion`\<`"type"`, \[`ZodObject`\<`object` & `object`, `"strict"`, `ZodTypeAny`, \{ `metadata?`: [`JsonObject`](#jsonobject); `output`: [`JsonValue`](#jsonvalue); `type`: `"complete"`; \}, \{ `metadata?`: [`JsonObject`](#jsonobject); `output`: [`JsonValue`](#jsonvalue); `type`: `"complete"`; \}\>, `ZodObject`\<`object` & `object`, `"strict"`, `ZodTypeAny`, \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](#jsonobject); `type`: `"fail"`; \}, \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](#jsonobject); `type`: `"fail"`; \}\>\]\>

Defined in: [runtime.ts:34](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/runtime.ts#L34)

The only terminal outcomes a runtime plugin may return for one bounded turn.

---

### ServiceAddressSchema

> `const` **ServiceAddressSchema**: `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>

Defined in: [address.ts:20](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/address.ts#L20)

---

### SharedOSApiErrorResponseSchema

> `const` **SharedOSApiErrorResponseSchema**: `ZodObject`\<\{ `error`: `ZodObject`\<\{ `code`: `ZodString`; `message`: `ZodString`; `requestId`: `ZodOptional`\<`ZodString`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `code`: `string`; `message`: `string`; `requestId?`: `string`; \}, \{ `code`: `string`; `message`: `string`; `requestId?`: `string`; \}\>; \}, `"strict"`, `ZodTypeAny`, \{ `error`: \{ `code`: `string`; `message`: `string`; `requestId?`: `string`; \}; \}, \{ `error`: \{ `code`: `string`; `message`: `string`; `requestId?`: `string`; \}; \}\>

Defined in: [http.ts:28](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/http.ts#L28)

---

### SharedOSHealthSchema

> `const` **SharedOSHealthSchema**: `ZodObject`\<\{ `protocolVersion`: `ZodLiteral`\<`"1"`>\>; `status`: `ZodLiteral`\<`"ok"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `protocolVersion`: `"1"`; `status`: `"ok"`; \}, \{ `protocolVersion`: `"1"`; `status`: `"ok"`; \}\>

Defined in: [http.ts:20](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/http.ts#L20)

---

### TimestampSchema

> `const` **TimestampSchema**: `ZodString`

Defined in: [common.ts:12](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/common.ts#L12)

An RFC 3339 timestamp, represented as a string to remain JSON-safe.

---

### ToolAnnotationsSchema

> `const` **ToolAnnotationsSchema**: `ZodObject`\<\{ `destructive`: `ZodOptional`\<`ZodBoolean`>\>; `idempotent`: `ZodOptional`\<`ZodBoolean`>\>; `readOnly`: `ZodOptional`\<`ZodBoolean`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `destructive?`: `boolean`; `idempotent?`: `boolean`; `readOnly?`: `boolean`; \}, \{ `destructive?`: `boolean`; `idempotent?`: `boolean`; `readOnly?`: `boolean`; \}\>

Defined in: [tool.ts:71](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L71)

---

### ToolCallSchema

> `const` **ToolCallSchema**: `ZodObject`\<\{ `arguments`: `ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>\>; `id`: `ZodString`; `requestedAt`: `ZodString`; `tool`: `ZodString`; `traceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `arguments`: [`JsonObject`](#jsonobject); `id`: `string`; `requestedAt`: `string`; `tool`: `string`; `traceId`: `string`; \}, \{ `arguments`: [`JsonObject`](#jsonobject); `id`: `string`; `requestedAt`: `string`; `tool`: `string`; `traceId`: `string`; \}\>

Defined in: [tool.ts:172](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L172)

---

### ToolDefinitionSchema

> `const` **ToolDefinitionSchema**: `ZodEffects`\<`ZodObject`\<\{ `annotations`: `ZodOptional`\<`ZodObject`\<\{ `destructive`: `ZodOptional`\<`ZodBoolean`>\>; `idempotent`: `ZodOptional`\<`ZodBoolean`>\>; `readOnly`: `ZodOptional`\<`ZodBoolean`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `destructive?`: `boolean`; `idempotent?`: `boolean`; `readOnly?`: `boolean`; \}, \{ `destructive?`: `boolean`; `idempotent?`: `boolean`; `readOnly?`: `boolean`; \}\>\>; `description`: `ZodString`; `inputSchema`: `ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>\>; `metadata`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `name`: `ZodString`; `namespace`: `ZodString`; `outputSchema`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `readWrite`: `ZodEnum`\<\[`"read"`, `"write"`\]\>; `requiredCapability`: `ZodObject`\<\{ `action`: `ZodString`; `resource`: `ZodObject`\<\{ `namespace`: `ZodString`; `owner`: `ZodOptional`\<`ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<..., ..., ..., ..., ...\>, `ZodObject`\<..., ..., ..., ..., ...\>, `ZodObject`\<..., ..., ..., ..., ...\>, `ZodObject`\<..., ..., ..., ..., ...\>\]\>\>; `path`: `ZodArray`\<`ZodString`, `"many"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}, \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}\>; \}, `"strict"`, `ZodTypeAny`, \{ `action`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; \}, \{ `action`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; \}\>; `source`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `annotations?`: \{ `destructive?`: `boolean`; `idempotent?`: `boolean`; `readOnly?`: `boolean`; \}; `description`: `string`; `inputSchema`: [`JsonObject`](#jsonobject); `metadata?`: [`JsonObject`](#jsonobject); `name`: `string`; `namespace`: `string`; `outputSchema?`: [`JsonObject`](#jsonobject); `readWrite`: `"read"` \| `"write"`; `requiredCapability`: \{ `action`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; \}; `source`: `string`; \}, \{ `annotations?`: \{ `destructive?`: `boolean`; `idempotent?`: `boolean`; `readOnly?`: `boolean`; \}; `description`: `string`; `inputSchema`: [`JsonObject`](#jsonobject); `metadata?`: [`JsonObject`](#jsonobject); `name`: `string`; `namespace`: `string`; `outputSchema?`: [`JsonObject`](#jsonobject); `readWrite`: `"read"` \| `"write"`; `requiredCapability`: \{ `action`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; \}; `source`: `string`; \}\>, \{ `annotations?`: \{ `destructive?`: `boolean`; `idempotent?`: `boolean`; `readOnly?`: `boolean`; \}; `description`: `string`; `inputSchema`: [`JsonObject`](#jsonobject); `metadata?`: [`JsonObject`](#jsonobject); `name`: `string`; `namespace`: `string`; `outputSchema?`: [`JsonObject`](#jsonobject); `readWrite`: `"read"` \| `"write"`; `requiredCapability`: \{ `action`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; \}; `source`: `string`; \}, \{ `annotations?`: \{ `destructive?`: `boolean`; `idempotent?`: `boolean`; `readOnly?`: `boolean`; \}; `description`: `string`; `inputSchema`: [`JsonObject`](#jsonobject); `metadata?`: [`JsonObject`](#jsonobject); `name`: `string`; `namespace`: `string`; `outputSchema?`: [`JsonObject`](#jsonobject); `readWrite`: `"read"` \| `"write"`; `requiredCapability`: \{ `action`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; \}; `source`: `string`; \}\>

Defined in: [tool.ts:82](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L82)

A JSON-Schema-described tool bound to one permission requirement.

---

### ToolNamespaceCatalogSchema

> `const` **ToolNamespaceCatalogSchema**: `ZodEffects`\<`ZodObject`\<\{ `namespaces`: `ZodArray`\<`ZodEffects`\<`ZodObject`\<\{ `enabled`: `ZodBoolean`; `namespace`: `ZodString`; `sources`: `ZodArray`\<`ZodString`, `"many"`>\>; `toolCount`: `ZodNumber`; \}, `"strict"`, `ZodTypeAny`, \{ `enabled`: `boolean`; `namespace`: `string`; `sources`: `string`[]; `toolCount`: `number`; \}, \{ `enabled`: `boolean`; `namespace`: `string`; `sources`: `string`[]; `toolCount`: `number`; \}\>, \{ `enabled`: `boolean`; `namespace`: `string`; `sources`: `string`[]; `toolCount`: `number`; \}, \{ `enabled`: `boolean`; `namespace`: `string`; `sources`: `string`[]; `toolCount`: `number`; \}\>, `"many"`>\>; `summary`: `ZodObject`\<\{ `disabled`: `ZodNumber`; `enabled`: `ZodNumber`; `total`: `ZodNumber`; \}, `"strict"`, `ZodTypeAny`, \{ `disabled`: `number`; `enabled`: `number`; `total`: `number`; \}, \{ `disabled`: `number`; `enabled`: `number`; `total`: `number`; \}\>; \}, `"strict"`, `ZodTypeAny`, \{ `namespaces`: `object`[]; `summary`: \{ `disabled`: `number`; `enabled`: `number`; `total`: `number`; \}; \}, \{ `namespaces`: `object`[]; `summary`: \{ `disabled`: `number`; `enabled`: `number`; `total`: `number`; \}; \}\>, \{ `namespaces`: `object`[]; `summary`: \{ `disabled`: `number`; `enabled`: `number`; `total`: `number`; \}; \}, \{ `namespaces`: `object`[]; `summary`: \{ `disabled`: `number`; `enabled`: `number`; `total`: `number`; \}; \}\>

Defined in: [tool.ts:134](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L134)

---

### ToolNamespaceDescriptorSchema

> `const` **ToolNamespaceDescriptorSchema**: `ZodEffects`\<`ZodObject`\<\{ `enabled`: `ZodBoolean`; `namespace`: `ZodString`; `sources`: `ZodArray`\<`ZodString`, `"many"`>\>; `toolCount`: `ZodNumber`; \}, `"strict"`, `ZodTypeAny`, \{ `enabled`: `boolean`; `namespace`: `string`; `sources`: `string`[]; `toolCount`: `number`; \}, \{ `enabled`: `boolean`; `namespace`: `string`; `sources`: `string`[]; `toolCount`: `number`; \}\>, \{ `enabled`: `boolean`; `namespace`: `string`; `sources`: `string`[]; `toolCount`: `number`; \}, \{ `enabled`: `boolean`; `namespace`: `string`; `sources`: `string`[]; `toolCount`: `number`; \}\>

Defined in: [tool.ts:115](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L115)

---

### ToolNamespaceSchema

> `const` **ToolNamespaceSchema**: `ZodString` = `IdentifierSchema`

Defined in: [tool.ts:9](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L9)

A logical group of tools that a trusted host may enable for one access context.

---

### ToolNamespaceUpdateSchema

> `const` **ToolNamespaceUpdateSchema**: `ZodEffects`\<`ZodObject`\<\{ `disable`: `ZodOptional`\<`ZodEffects`\<`ZodArray`\<`ZodString`, `"many"`>\>, `string`[], `string`[]\>\>; `enable`: `ZodOptional`\<`ZodEffects`\<`ZodArray`\<`ZodString`, `"many"`>\>, `string`[], `string`[]\>\>; \}, `"strict"`, `ZodTypeAny`, \{ `disable?`: `string`[]; `enable?`: `string`[]; \}, \{ `disable?`: `string`[]; `enable?`: `string`[]; \}\>, \{ `disable?`: `string`[]; `enable?`: `string`[]; \}, \{ `disable?`: `string`[]; `enable?`: `string`[]; \}\>

Defined in: [tool.ts:42](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L42)

An idempotent patch to a host-owned tool namespace selection.

The host applies this atomically and returns the authoritative effective
selection after product policy ceilings have been enforced.

---

### ToolReadWriteSchema

> `const` **ToolReadWriteSchema**: `ZodEnum`\<\[`"read"`, `"write"`\]\>

Defined in: [tool.ts:20](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L20)

A conservative catalog classification. Capabilities remain the authorization source.

---

### ToolResultSchema

> `const` **ToolResultSchema**: `ZodDiscriminatedUnion`\<`"status"`, \[`ZodObject`\<`object` & `object`, `"strict"`, `ZodTypeAny`, \{ `callId`: `string`; `completedAt`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `output`: [`JsonValue`](#jsonvalue); `status`: `"succeeded"`; `tool`: `string`; \}, \{ `callId`: `string`; `completedAt`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `output`: [`JsonValue`](#jsonvalue); `status`: `"succeeded"`; `tool`: `string`; \}\>, `ZodObject`\<`object` & `object`, `"strict"`, `ZodTypeAny`, \{ `callId`: `string`; `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](#jsonobject); `status`: `"denied"`; `tool`: `string`; \}, \{ `callId`: `string`; `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](#jsonobject); `status`: `"denied"`; `tool`: `string`; \}\>, `ZodObject`\<`object` & `object`, `"strict"`, `ZodTypeAny`, \{ `callId`: `string`; `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](#jsonobject); `status`: `"failed"`; `tool`: `string`; \}, \{ `callId`: `string`; `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](#jsonobject); `status`: `"failed"`; `tool`: `string`; \}\>\]\>

Defined in: [tool.ts:191](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L191)

---

### ToolSourceSchema

> `const` **ToolSourceSchema**: `ZodString` = `IdentifierSchema`

Defined in: [tool.ts:16](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L16)

The host-defined origin of a tool, for example `sharedos`, `native`, `mcp`,
or `composio`. This is catalog metadata, never proof of authority.
