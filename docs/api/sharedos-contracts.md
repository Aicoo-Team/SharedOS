[**SharedOS API v0.1.0-alpha.4**](README.md)

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

Defined in: [access.ts:30](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/access.ts#L30)

---

### Address

> **Address** = `z.infer`\<_typeof_ [`AddressSchema`](#addressschema)>\>

Defined in: [address.ts:33](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/address.ts#L33)

---

### AgentAddress

> **AgentAddress** = `z.infer`\<_typeof_ [`AgentAddressSchema`](#agentaddressschema)>\>

Defined in: [address.ts:13](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/address.ts#L13)

---

### AgentCard

> **AgentCard** = `z.infer`\<_typeof_ [`AgentCardSchema`](#agentcardschema)>\>

Defined in: [card.ts:107](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/card.ts#L107)

---

### AgentCardView

> **AgentCardView** = `z.infer`\<_typeof_ [`AgentCardViewSchema`](#agentcardviewschema)>\>

Defined in: [card.ts:31](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/card.ts#L31)

---

### AuthorizationDecision

> **AuthorizationDecision** = `z.infer`\<_typeof_ [`AuthorizationDecisionSchema`](#authorizationdecisionschema)>\>

Defined in: [access.ts:72](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/access.ts#L72)

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

Defined in: [capability.ts:142](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/capability.ts#L142)

---

### CapabilityRequest

> **CapabilityRequest** = `z.infer`\<_typeof_ [`CapabilityRequestSchema`](#capabilityrequestschema)>\>

Defined in: [capability.ts:104](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/capability.ts#L104)

---

### CapabilityRequirement

> **CapabilityRequirement** = `z.infer`\<_typeof_ [`CapabilityRequirementSchema`](#capabilityrequirementschema)>\>

Defined in: [capability.ts:152](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/capability.ts#L152)

---

### ContextCapsule

> **ContextCapsule** = `z.infer`\<_typeof_ [`ContextCapsuleSchema`](#contextcapsuleschema)>\>

Defined in: [context-capsule.ts:99](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/context-capsule.ts#L99)

---

### ContextCapsuleItem

> **ContextCapsuleItem** = `z.infer`\<_typeof_ [`ContextCapsuleItemSchema`](#contextcapsuleitemschema)>\>

Defined in: [context-capsule.ts:87](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/context-capsule.ts#L87)

---

### ContextCapsuleItemKind

> **ContextCapsuleItemKind** = _typeof_ [`CONTEXT_CAPSULE_ITEM_KINDS`](#context_capsule_item_kinds)\[`number`\]

Defined in: [context-capsule.ts:46](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/context-capsule.ts#L46)

---

### ContextCapsulePreview

> **ContextCapsulePreview** = `z.infer`\<_typeof_ [`ContextCapsulePreviewSchema`](#contextcapsulepreviewschema)>\>

Defined in: [context-capsule.ts:124](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/context-capsule.ts#L124)

---

### ContextCapsulePreviewItem

> **ContextCapsulePreviewItem** = `z.infer`\<_typeof_ [`ContextCapsulePreviewItemSchema`](#contextcapsulepreviewitemschema)>\>

Defined in: [context-capsule.ts:125](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/context-capsule.ts#L125)

---

### ContextCapsuleValidation

> **ContextCapsuleValidation** = \{ `ok`: `true`; `value`: [`ContextCapsule`](#contextcapsule); \} \| \{ `error`: [`ProtocolError`](#protocolerror); `ok`: `false`; \}

Defined in: [context-capsule.ts:127](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/context-capsule.ts#L127)

---

### EnabledToolNamespaces

> **EnabledToolNamespaces** = `z.infer`\<_typeof_ [`EnabledToolNamespacesSchema`](#enabledtoolnamespacesschema)>\>

Defined in: [tool.ts:63](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L63)

---

### Escalation

> **Escalation** = `z.infer`\<_typeof_ [`EscalationSchema`](#escalationschema)>\>

Defined in: [execution.ts:93](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/execution.ts#L93)

---

### ExecutionEvent

> **ExecutionEvent** = `z.infer`\<_typeof_ [`ExecutionEventSchema`](#executioneventschema)>\>

Defined in: [execution.ts:56](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/execution.ts#L56)

---

### ExecutionOptions

> **ExecutionOptions** = `z.infer`\<_typeof_ [`ExecutionOptionsSchema`](#executionoptionsschema)>\>

Defined in: [execution.ts:23](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/execution.ts#L23)

---

### ExecutionRequest

> **ExecutionRequest** = `z.infer`\<_typeof_ [`ExecutionRequestSchema`](#executionrequestschema)>\>

Defined in: [execution.ts:40](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/execution.ts#L40)

---

### ExecutionResult

> **ExecutionResult** = `z.infer`\<_typeof_ [`ExecutionResultSchema`](#executionresultschema)>\>

Defined in: [execution.ts:128](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/execution.ts#L128)

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

Defined in: [message.ts:94](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/message.ts#L94)

---

### MessageEnvelope

> **MessageEnvelope** = `z.infer`\<_typeof_ [`MessageEnvelopeSchema`](#messageenvelopeschema)>\>

Defined in: [message.ts:41](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/message.ts#L41)

---

### MessageProvenance

> **MessageProvenance** = `z.infer`\<_typeof_ [`MessageProvenanceSchema`](#messageprovenanceschema)>\>

Defined in: [message.ts:20](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/message.ts#L20)

---

### MessageRequestArguments

> **MessageRequestArguments** = `z.infer`\<_typeof_ [`MessageRequestArgumentsSchema`](#messagerequestargumentsschema)>\>

Defined in: [message.ts:72](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/message.ts#L72)

---

### ProtocolError

> **ProtocolError** = `z.infer`\<_typeof_ [`ProtocolErrorSchema`](#protocolerrorschema)>\>

Defined in: [protocol-error.ts:16](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/protocol-error.ts#L16)

---

### ProtocolVersion

> **ProtocolVersion** = `z.infer`\<_typeof_ [`ProtocolVersionSchema`](#protocolversionschema)>\>

Defined in: [common.ts:5](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/common.ts#L5)

---

### PublishedToolAnnotations

> **PublishedToolAnnotations** = `z.infer`\<_typeof_ [`PublishedToolAnnotationsSchema`](#publishedtoolannotationsschema)>\>

Defined in: [tool.ts:164](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L164)

---

### PublishedToolDefinition

> **PublishedToolDefinition** = `z.infer`\<_typeof_ [`PublishedToolDefinitionSchema`](#publishedtooldefinitionschema)>\>

Defined in: [tool.ts:200](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L200)

---

### PublishedToolMetadata

> **PublishedToolMetadata** = `z.infer`\<_typeof_ [`PublishedToolMetadataSchema`](#publishedtoolmetadataschema)>\>

Defined in: [tool.ts:173](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L173)

---

### ReachResult

> **ReachResult** = `z.infer`\<_typeof_ [`ReachResultSchema`](#reachresultschema)>\>

Defined in: [capability.ts:211](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/capability.ts#L211)

---

### ReachSummary

> **ReachSummary** = `z.infer`\<_typeof_ [`ReachSummarySchema`](#reachsummaryschema)>\>

Defined in: [card.ts:49](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/card.ts#L49)

---

### ReachUnavailableReason

> **ReachUnavailableReason** = `z.infer`\<_typeof_ [`ReachUnavailableReasonSchema`](#reachunavailablereasonschema)>\>

Defined in: [capability.ts:196](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/capability.ts#L196)

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

### ResourceReach

> **ResourceReach** = `z.infer`\<_typeof_ [`ResourceReachSchema`](#resourcereachschema)>\>

Defined in: [capability.ts:177](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/capability.ts#L177)

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

Defined in: [runtime.ts:59](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/runtime.ts#L59)

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

### SharedOSToolCatalog

> **SharedOSToolCatalog** = `z.infer`\<_typeof_ [`SharedOSToolCatalogSchema`](#sharedostoolcatalogschema)>\>

Defined in: [tool.ts:237](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L237)

---

### Timestamp

> **Timestamp** = `z.infer`\<_typeof_ [`TimestampSchema`](#timestampschema)>\>

Defined in: [common.ts:13](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/common.ts#L13)

---

### ToolAnnotations

> **ToolAnnotations** = `z.infer`\<_typeof_ [`ToolAnnotationsSchema`](#toolannotationsschema)>\>

Defined in: [tool.ts:108](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L108)

---

### ToolCall

> **ToolCall** = `z.infer`\<_typeof_ [`ToolCallSchema`](#toolcallschema)>\>

Defined in: [tool.ts:360](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L360)

---

### ToolClass

> **ToolClass** = `z.infer`\<_typeof_ [`ToolClassSchema`](#toolclassschema)>\>

Defined in: [tool.ts:253](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L253)

---

### ToolDefinition

> **ToolDefinition** = `z.infer`\<_typeof_ [`ToolDefinitionSchema`](#tooldefinitionschema)>\>

Defined in: [tool.ts:142](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L142)

---

### ToolName

> **ToolName** = `z.infer`\<_typeof_ [`ToolNameSchema`](#toolnameschema)>\>

Defined in: [tool.ts:35](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L35)

---

### ToolNamespace

> **ToolNamespace** = `z.infer`\<_typeof_ [`ToolNamespaceSchema`](#toolnamespaceschema)>\>

Defined in: [tool.ts:39](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L39)

---

### ToolNamespaceCatalog

> **ToolNamespaceCatalog** = `z.infer`\<_typeof_ [`ToolNamespaceCatalogSchema`](#toolnamespacecatalogschema)>\>

Defined in: [tool.ts:348](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L348)

---

### ToolNamespaceDescriptor

> **ToolNamespaceDescriptor** = `z.infer`\<_typeof_ [`ToolNamespaceDescriptorSchema`](#toolnamespacedescriptorschema)>\>

Defined in: [tool.ts:310](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L310)

---

### ToolNamespaceUpdate

> **ToolNamespaceUpdate** = `z.infer`\<_typeof_ [`ToolNamespaceUpdateSchema`](#toolnamespaceupdateschema)>\>

Defined in: [tool.ts:98](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L98)

---

### ToolPolicy

> **ToolPolicy** = `z.infer`\<_typeof_ [`ToolPolicySchema`](#toolpolicyschema)>\>

Defined in: [tool.ts:291](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L291)

---

### ToolReadWrite

> **ToolReadWrite** = `z.infer`\<_typeof_ [`ToolReadWriteSchema`](#toolreadwriteschema)>\>

Defined in: [tool.ts:50](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L50)

---

### ToolResult

> **ToolResult** = `z.infer`\<_typeof_ [`ToolResultSchema`](#toolresultschema)>\>

Defined in: [tool.ts:384](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L384)

---

### ToolSource

> **ToolSource** = `z.infer`\<_typeof_ [`ToolSourceSchema`](#toolsourceschema)>\>

Defined in: [tool.ts:46](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L46)

## Variables

### AccessContextSchema

> `const` **AccessContextSchema**: `ZodObject`\<\{ `actor`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `authority`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `enabledToolNamespaces`: `ZodEffects`\<`ZodArray`\<`ZodString`, `"many"`>\>, `string`[], `string`[]\>; `namespaceId`: `ZodString`; `now`: `ZodString`; `owner`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `purpose`: `ZodString`; `traceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \}, \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \}\>

Defined in: [access.ts:17](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/access.ts#L17)

The identity, purpose, time, and tool-namespace inputs to a permission
decision.

An access context deliberately carries no authority. Grants are loaded by the
kernel from a trusted `GrantSource` at the moment of the decision, so a
caller cannot present, extend, or replay authority by constructing a context.

---

### AddressSchema

> `const` **AddressSchema**: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>

Defined in: [address.ts:26](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/address.ts#L26)

A structured protocol address; no string suffix or prefix parsing is needed.

---

### AGENT\_CARD\_VIEWS

> `const` **AGENT\_CARD\_VIEWS**: readonly \[`"reach"`, `"identity"`, `"namespaces"`\]

Defined in: [card.ts:27](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/card.ts#L27)

The named shapes an agent card is served in.

A card is a view rather than a record, so these are not filters applied to
one object on the way out: each name is a separate resource a reader is
authorized for, and each answers a different question.

- `reach` — identity together with the resources the subject can be asked
  about. This is the card the directory exists for.
- `identity` — the subject and nothing else. The narrowing that drops reach
  entirely, for a reader allowed to learn that an agent is addressable
  without learning what it holds.
- `namespaces` — identity together with which namespaces the subject reaches
  and how many entries in each, with no paths. A coarser answer than `reach`
  and a _distinct_ view for the reason ADR 0021 gives: projection is
  field-level, so a field that means something different depending on who
  reads it is the record shape a view exists to refuse.

Every view is bounded the same way. See [AgentCardSchema](#agentcardschema).

---

### AgentAddressSchema

> `const` **AgentAddressSchema**: `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>

Defined in: [address.ts:10](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/address.ts#L10)

---

### AgentCardSchema

> `const` **AgentCardSchema**: `ZodDiscriminatedUnion`\<`"view"`, \[`ZodObject`\<\{ `namespaceId`: `ZodString`; `reach`: `ZodArray`\<`ZodObject`\<\{ `actions`: `ZodArray`\<`ZodString`, `"many"`>\>; `namespace`: `ZodString`; `path`: `ZodArray`\<`ZodString`, `"many"`>\>; `scope`: `ZodEnum`\<\[`"exact"`, `"descendants"`\]\>; \}, `"strict"`, `ZodTypeAny`, \{ `actions`: `string`[]; `namespace`: `string`; `path`: `string`[]; `scope`: `"exact"` \| `"descendants"`; \}, \{ `actions`: `string`[]; `namespace`: `string`; `path`: `string`[]; `scope`: `"exact"` \| `"descendants"`; \}\>, `"many"`>\>; `readAt`: `ZodString`; `subject`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `view`: `ZodLiteral`\<`"reach"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `namespaceId`: `string`; `reach`: `object`[]; `readAt`: `string`; `subject`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `view`: `"reach"`; \}, \{ `namespaceId`: `string`; `reach`: `object`[]; `readAt`: `string`; `subject`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `view`: `"reach"`; \}\>, `ZodObject`\<\{ `namespaceId`: `ZodString`; `readAt`: `ZodString`; `subject`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `view`: `ZodLiteral`\<`"identity"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `namespaceId`: `string`; `readAt`: `string`; `subject`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `view`: `"identity"`; \}, \{ `namespaceId`: `string`; `readAt`: `string`; `subject`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `view`: `"identity"`; \}\>, `ZodObject`\<\{ `namespaceId`: `ZodString`; `namespaces`: `ZodArray`\<`ZodObject`\<\{ `actions`: `ZodArray`\<`ZodString`, `"many"`>\>; `entries`: `ZodNumber`; `namespace`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `actions`: `string`[]; `entries`: `number`; `namespace`: `string`; \}, \{ `actions`: `string`[]; `entries`: `number`; `namespace`: `string`; \}\>, `"many"`>\>; `readAt`: `ZodString`; `subject`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `view`: `ZodLiteral`\<`"namespaces"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `namespaceId`: `string`; `namespaces`: `object`[]; `readAt`: `string`; `subject`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `view`: `"namespaces"`; \}, \{ `namespaceId`: `string`; `namespaces`: `object`[]; `readAt`: `string`; `subject`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `view`: `"namespaces"`; \}\>\]\>

Defined in: [card.ts:89](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/card.ts#L89)

The kernel's description of one agent: identity, computed reach, and nothing
a product would want to put beside them.

Reach is derived when the card is read, from the grants in force at that
instant, and is never stored. A stored reach would be the one description of
authority in SharedOS that nothing invalidates: revocation, purpose
withdrawal, expiry and a spent budget all work by not matching at the next
decision, and a column is outside all of them.

A card is bounded by one authority and one world. It shows what the subject
reaches under the authority the _reader_ is operating under, inside the
reader's namespace — not the subject's whole life. It is therefore a lower
bound on truth and never an upper one, which is what makes it safe to serve
to a model: it omits authority the reader's authority did not issue, and an
over-wide entry permits nothing because every operation is authorized
independently.

Display names, avatars, handles, skills and protocol bindings are absent on
purpose. The test is not whether a field is useful but whether it is
authority: reach is what the kernel decides against, and a display name is
not. A host composes those around this answer. See ADR 0021.

---

### AgentCardViewSchema

> `const` **AgentCardViewSchema**: `ZodEnum`\<\[`"reach"`, `"identity"`, `"namespaces"`\]\>

Defined in: [card.ts:29](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/card.ts#L29)

---

### AuthorizationDecisionSchema

> `const` **AuthorizationDecisionSchema**: `ZodObject`\<\{ `allowed`: `ZodBoolean`; `matchedGrantId`: `ZodOptional`\<`ZodString`>\>; `metadata`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `reasonCode`: `ZodString`; `requiredAuthority`: `ZodOptional`\<`ZodObject`\<\{ `capabilities`: `ZodArray`\<`ZodObject`\<\{ `actions`: `ZodArray`\<`ZodString`, `"many"`>\>; `resource`: `ZodObject`\<\{ `namespace`: `ZodString`; `owner`: `ZodOptional`\<...\>; `path`: `ZodArray`\<..., ...\>; \}, `"strict"`, `ZodTypeAny`, \{ `namespace`: `string`; `owner?`: ... \| ... \| ... \| ... \| ...; `path`: ...[]; \}, \{ `namespace`: `string`; `owner?`: ... \| ... \| ... \| ... \| ...; `path`: ...[]; \}\>; `scope`: `ZodEnum`\<\[`"exact"`, `"descendants"`\]\>; \}, `"strict"`, `ZodTypeAny`, \{ `actions`: `string`[]; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: ...; `userId`: ...; \} \| \{ `agentId`: ...; `kind`: ...; \} \| \{ `conversationId`: ...; `kind`: ...; \} \| \{ `kind`: ...; `serviceId`: ...; \}; `path`: `string`[]; \}; `scope`: `"exact"` \| `"descendants"`; \}, \{ `actions`: `string`[]; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: ...; `userId`: ...; \} \| \{ `agentId`: ...; `kind`: ...; \} \| \{ `conversationId`: ...; `kind`: ...; \} \| \{ `kind`: ...; `serviceId`: ...; \}; `path`: `string`[]; \}; `scope`: `"exact"` \| `"descendants"`; \}\>, `"many"`>\>; `constraints`: `ZodOptional`\<`ZodEffects`\<`ZodObject`\<\{ `delegationDepth`: `ZodOptional`\<`ZodNumber`>\>; `expiresAt`: `ZodOptional`\<`ZodString`>\>; `maxUses`: `ZodOptional`\<`ZodNumber`>\>; `notBefore`: `ZodOptional`\<`ZodString`>\>; `purposes`: `ZodOptional`\<`ZodArray`\<..., ...\>\>; \}, `"strict"`, `ZodTypeAny`, \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: ...[]; \}, \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: ...[]; \}\>, \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}, \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}\>\>; `id`: `ZodString`; `metadata`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `namespaceId`: `ZodString`; `owner`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `purpose`: `ZodString`; `requestedAt`: `ZodString`; `requester`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; \}, `"strict"`, `ZodTypeAny`, \{ `capabilities`: `object`[]; `constraints?`: \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}; `id`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `namespaceId`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `requestedAt`: `string`; `requester`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \}, \{ `capabilities`: `object`[]; `constraints?`: \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}; `id`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `namespaceId`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `requestedAt`: `string`; `requester`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \}\>\>; \}, `"strict"`, `ZodTypeAny`, \{ `allowed`: `boolean`; `matchedGrantId?`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `reasonCode`: `string`; `requiredAuthority?`: \{ `capabilities`: `object`[]; `constraints?`: \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}; `id`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `namespaceId`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `requestedAt`: `string`; `requester`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \}; \}, \{ `allowed`: `boolean`; `matchedGrantId?`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `reasonCode`: `string`; `requiredAuthority?`: \{ `capabilities`: `object`[]; `constraints?`: \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}; `id`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `namespaceId`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `requestedAt`: `string`; `requester`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \}; \}\>

Defined in: [access.ts:33](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/access.ts#L33)

A portable explanation of one authorization check.

---

### CapabilityConstraintsSchema

> `const` **CapabilityConstraintsSchema**: `ZodEffects`\<`ZodObject`\<\{ `delegationDepth`: `ZodOptional`\<`ZodNumber`>\>; `expiresAt`: `ZodOptional`\<`ZodString`>\>; `maxUses`: `ZodOptional`\<`ZodNumber`>\>; `notBefore`: `ZodOptional`\<`ZodString`>\>; `purposes`: `ZodOptional`\<`ZodArray`\<`ZodString`, `"many"`>>\>\>; \}, `"strict"`, `ZodTypeAny`, \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}, \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}\>, \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}, \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}\>

Defined in: [capability.ts:48](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/capability.ts#L48)

---

### CapabilityGrantSchema

> `const` **CapabilityGrantSchema**: `ZodEffects`\<`ZodObject`\<\{ `capabilities`: `ZodArray`\<`ZodObject`\<\{ `actions`: `ZodArray`\<`ZodString`, `"many"`>\>; `resource`: `ZodObject`\<\{ `namespace`: `ZodString`; `owner`: `ZodOptional`\<`ZodDiscriminatedUnion`\<`"kind"`, \[..., ..., ..., ...\]\>\>; `path`: `ZodArray`\<`ZodString`, `"many"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}, \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}\>; `scope`: `ZodEnum`\<\[`"exact"`, `"descendants"`\]\>; \}, `"strict"`, `ZodTypeAny`, \{ `actions`: `string`[]; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; `scope`: `"exact"` \| `"descendants"`; \}, \{ `actions`: `string`[]; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; `scope`: `"exact"` \| `"descendants"`; \}\>, `"many"`>\>; `constraints`: `ZodEffects`\<`ZodObject`\<\{ `delegationDepth`: `ZodOptional`\<`ZodNumber`>\>; `expiresAt`: `ZodOptional`\<`ZodString`>\>; `maxUses`: `ZodOptional`\<`ZodNumber`>\>; `notBefore`: `ZodOptional`\<`ZodString`>\>; `purposes`: `ZodOptional`\<`ZodArray`\<`ZodString`, `"many"`>>\>\>; \}, `"strict"`, `ZodTypeAny`, \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}, \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}\>, \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}, \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}\>; `id`: `ZodString`; `issuedAt`: `ZodString`; `issuer`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `metadata`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `namespaceId`: `ZodString`; `parentGrantId`: `ZodOptional`\<`ZodString`>\>; `revokedAt`: `ZodOptional`\<`ZodString`>\>; `subject`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; \}, `"strict"`, `ZodTypeAny`, \{ `capabilities`: `object`[]; `constraints`: \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}; `id`: `string`; `issuedAt`: `string`; `issuer`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `metadata?`: [`JsonObject`](#jsonobject); `namespaceId`: `string`; `parentGrantId?`: `string`; `revokedAt?`: `string`; `subject`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \}, \{ `capabilities`: `object`[]; `constraints`: \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}; `id`: `string`; `issuedAt`: `string`; `issuer`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `metadata?`: [`JsonObject`](#jsonobject); `namespaceId`: `string`; `parentGrantId?`: `string`; `revokedAt?`: `string`; `subject`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \}\>, \{ `capabilities`: `object`[]; `constraints`: \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}; `id`: `string`; `issuedAt`: `string`; `issuer`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `metadata?`: [`JsonObject`](#jsonobject); `namespaceId`: `string`; `parentGrantId?`: `string`; `revokedAt?`: `string`; `subject`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \}, \{ `capabilities`: `object`[]; `constraints`: \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}; `id`: `string`; `issuedAt`: `string`; `issuer`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `metadata?`: [`JsonObject`](#jsonobject); `namespaceId`: `string`; `parentGrantId?`: `string`; `revokedAt?`: `string`; `subject`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \}\>

Defined in: [capability.ts:118](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/capability.ts#L118)

Authority issued to one subject and bounded by explicit constraints.

A grant that was derived from another grant names its immediate ancestor in
`parentGrantId`. The link is a claim, not proof: SharedOS resolves and
validates the complete chain before the grant may authorize anything.

`deriveGrant` in `@aicoo/sharedos-core` is the supported way to produce one.
It only ever emits this single link: a chain embedded in the grant would be
provenance the presenter controls, and the ancestors are re-resolved from the
issuing store at every decision instead.

---

### CapabilityRequestSchema

> `const` **CapabilityRequestSchema**: `ZodObject`\<\{ `capabilities`: `ZodArray`\<`ZodObject`\<\{ `actions`: `ZodArray`\<`ZodString`, `"many"`>\>; `resource`: `ZodObject`\<\{ `namespace`: `ZodString`; `owner`: `ZodOptional`\<`ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<..., ..., ..., ..., ...\>, `ZodObject`\<..., ..., ..., ..., ...\>, `ZodObject`\<..., ..., ..., ..., ...\>, `ZodObject`\<..., ..., ..., ..., ...\>\]\>\>; `path`: `ZodArray`\<`ZodString`, `"many"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}, \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}\>; `scope`: `ZodEnum`\<\[`"exact"`, `"descendants"`\]\>; \}, `"strict"`, `ZodTypeAny`, \{ `actions`: `string`[]; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; `scope`: `"exact"` \| `"descendants"`; \}, \{ `actions`: `string`[]; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; `scope`: `"exact"` \| `"descendants"`; \}\>, `"many"`>\>; `constraints`: `ZodOptional`\<`ZodEffects`\<`ZodObject`\<\{ `delegationDepth`: `ZodOptional`\<`ZodNumber`>\>; `expiresAt`: `ZodOptional`\<`ZodString`>\>; `maxUses`: `ZodOptional`\<`ZodNumber`>\>; `notBefore`: `ZodOptional`\<`ZodString`>\>; `purposes`: `ZodOptional`\<`ZodArray`\<`ZodString`, `"many"`>>\>\>; \}, `"strict"`, `ZodTypeAny`, \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}, \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}\>, \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}, \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}\>\>; `id`: `ZodString`; `metadata`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `namespaceId`: `ZodString`; `owner`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `purpose`: `ZodString`; `requestedAt`: `ZodString`; `requester`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; \}, `"strict"`, `ZodTypeAny`, \{ `capabilities`: `object`[]; `constraints?`: \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}; `id`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `namespaceId`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `requestedAt`: `string`; `requester`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \}, \{ `capabilities`: `object`[]; `constraints?`: \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}; `id`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `namespaceId`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `requestedAt`: `string`; `requester`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \}\>

Defined in: [capability.ts:90](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/capability.ts#L90)

A request for authority. A request is not itself proof of authority.

Two places produce one and none accepts one as input. A denial that matched no
grant describes what would have satisfied it, and an escalation may carry that
description on to whoever resolves it. Both are descriptions: turning one into
usable authority is the host's issuing workflow, which ends in a grant the
next turn loads (ADR 0019).

`id`, `namespaceId`, `requester`, `owner`, and `requestedAt` are minted by the
kernel from the trusted access context, whatever a caller wrote: a request
the caller authored would be a caller-chosen correlation for a decision the
kernel made. `id` is derived from the ask -- namespace, requester, owner,
purpose, constraints, capabilities -- rather than generated, so the same ask
describes itself the same way twice, and `requestedAt` is left out of it so
the identifier survives across turns.

---

### CapabilityRequirementSchema

> `const` **CapabilityRequirementSchema**: `ZodObject`\<\{ `action`: `ZodString`; `resource`: `ZodObject`\<\{ `namespace`: `ZodString`; `owner`: `ZodOptional`\<`ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>\>; `path`: `ZodArray`\<`ZodString`, `"many"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}, \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}\>; \}, `"strict"`, `ZodTypeAny`, \{ `action`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; \}, \{ `action`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; \}\>

Defined in: [capability.ts:145](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/capability.ts#L145)

The exact capability a tool invocation requires.

---

### CapabilitySchema

> `const` **CapabilitySchema**: `ZodObject`\<\{ `actions`: `ZodArray`\<`ZodString`, `"many"`>\>; `resource`: `ZodObject`\<\{ `namespace`: `ZodString`; `owner`: `ZodOptional`\<`ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>\>; `path`: `ZodArray`\<`ZodString`, `"many"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}, \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}\>; `scope`: `ZodEnum`\<\[`"exact"`, `"descendants"`\]\>; \}, `"strict"`, `ZodTypeAny`, \{ `actions`: `string`[]; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; `scope`: `"exact"` \| `"descendants"`; \}, \{ `actions`: `string`[]; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; `scope`: `"exact"` \| `"descendants"`; \}\>

Defined in: [capability.ts:38](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/capability.ts#L38)

A positive capability. SharedOS is deny-by-default when no grant matches.

---

### CONTEXT\_CAPSULE\_ITEM\_KINDS

> `const` **CONTEXT\_CAPSULE\_ITEM\_KINDS**: readonly \[`"requirement"`, `"diff"`, `"file_excerpt"`, `"error"`, `"test_output"`, `"decision"`, `"freeform"`\]

Defined in: [context-capsule.ts:36](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/context-capsule.ts#L36)

What a capsule item is, so a reviewer can judge it without reading it.

---

### ContextCapsuleItemSchema

> `const` **ContextCapsuleItemSchema**: `ZodObject`\<\{ `content`: `ZodString`; `kind`: `ZodEnum`\<\[`"requirement"`, `"diff"`, `"file_excerpt"`, `"error"`, `"test_output"`, `"decision"`, `"freeform"`\]\>; `label`: `ZodString`; `sha256`: `ZodString`; `sourcePath`: `ZodOptional`\<`ZodString`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `content`: `string`; `kind`: `"error"` \| `"requirement"` \| `"diff"` \| `"file_excerpt"` \| `"test_output"` \| `"decision"` \| `"freeform"`; `label`: `string`; `sha256`: `string`; `sourcePath?`: `string`; \}, \{ `content`: `string`; `kind`: `"error"` \| `"requirement"` \| `"diff"` \| `"file_excerpt"` \| `"test_output"` \| `"decision"` \| `"freeform"`; `label`: `string`; `sha256`: `string`; `sourcePath?`: `string`; \}\>

Defined in: [context-capsule.ts:76](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/context-capsule.ts#L76)

---

### ContextCapsulePreviewItemSchema

> `const` **ContextCapsulePreviewItemSchema**: `ZodObject`\<\{ `contentBytes`: `ZodNumber`; `kind`: `ZodString`; `label`: `ZodString`; `sha256`: `ZodString`; `sourcePath`: `ZodOptional`\<`ZodString`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `contentBytes`: `number`; `kind`: `string`; `label`: `string`; `sha256`: `string`; `sourcePath?`: `string`; \}, \{ `contentBytes`: `number`; `kind`: `string`; `label`: `string`; `sha256`: `string`; `sourcePath?`: `string`; \}\>

Defined in: [context-capsule.ts:101](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/context-capsule.ts#L101)

---

### ContextCapsulePreviewSchema

> `const` **ContextCapsulePreviewSchema**: `ZodObject`\<\{ `items`: `ZodArray`\<`ZodObject`\<\{ `contentBytes`: `ZodNumber`; `kind`: `ZodString`; `label`: `ZodString`; `sha256`: `ZodString`; `sourcePath`: `ZodOptional`\<`ZodString`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `contentBytes`: `number`; `kind`: `string`; `label`: `string`; `sha256`: `string`; `sourcePath?`: `string`; \}, \{ `contentBytes`: `number`; `kind`: `string`; `label`: `string`; `sha256`: `string`; `sourcePath?`: `string`; \}\>, `"many"`>\>; `limitations`: `ZodArray`\<`ZodString`, `"many"`>\>; `summary`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `items`: `object`[]; `limitations`: `string`[]; `summary`: `string`; \}, \{ `items`: `object`[]; `limitations`: `string`[]; `summary`: `string`; \}\>

Defined in: [context-capsule.ts:116](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/context-capsule.ts#L116)

The disclosure-free projection of a capsule. It contains every field a
reviewer needs and no item content, so it is safe to render in an approval
prompt, persist alongside a pending request, or send to a client.

---

### ContextCapsuleSchema

> `const` **ContextCapsuleSchema**: `ZodObject`\<\{ `items`: `ZodArray`\<`ZodObject`\<\{ `content`: `ZodString`; `kind`: `ZodEnum`\<\[`"requirement"`, `"diff"`, `"file_excerpt"`, `"error"`, `"test_output"`, `"decision"`, `"freeform"`\]\>; `label`: `ZodString`; `sha256`: `ZodString`; `sourcePath`: `ZodOptional`\<`ZodString`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `content`: `string`; `kind`: `"error"` \| `"requirement"` \| `"diff"` \| `"file_excerpt"` \| `"test_output"` \| `"decision"` \| `"freeform"`; `label`: `string`; `sha256`: `string`; `sourcePath?`: `string`; \}, \{ `content`: `string`; `kind`: `"error"` \| `"requirement"` \| `"diff"` \| `"file_excerpt"` \| `"test_output"` \| `"decision"` \| `"freeform"`; `label`: `string`; `sha256`: `string`; `sourcePath?`: `string`; \}\>, `"many"`>\>; `limitations`: `ZodArray`\<`ZodString`, `"many"`>\>; `objective`: `ZodString`; `summary`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `items`: `object`[]; `limitations`: `string`[]; `objective`: `string`; `summary`: `string`; \}, \{ `items`: `object`[]; `limitations`: `string`[]; `objective`: `string`; `summary`: `string`; \}\>

Defined in: [context-capsule.ts:89](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/context-capsule.ts#L89)

---

### EnabledToolNamespacesSchema

> `const` **EnabledToolNamespacesSchema**: `ZodEffects`\<`ZodArray`\<`ZodString`, `"many"`>\>, `string`[], `string`[]\>

Defined in: [tool.ts:52](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L52)

---

### EscalationSchema

> `const` **EscalationSchema**: `ZodObject`\<\{ `reason`: `ZodString`; `requestedAt`: `ZodString`; `requestedAuthority`: `ZodOptional`\<`ZodObject`\<\{ `capabilities`: `ZodArray`\<`ZodObject`\<\{ `actions`: `ZodArray`\<`ZodString`, `"many"`>\>; `resource`: `ZodObject`\<\{ `namespace`: `ZodString`; `owner`: `ZodOptional`\<...\>; `path`: `ZodArray`\<..., ...\>; \}, `"strict"`, `ZodTypeAny`, \{ `namespace`: `string`; `owner?`: ... \| ... \| ... \| ... \| ...; `path`: ...[]; \}, \{ `namespace`: `string`; `owner?`: ... \| ... \| ... \| ... \| ...; `path`: ...[]; \}\>; `scope`: `ZodEnum`\<\[`"exact"`, `"descendants"`\]\>; \}, `"strict"`, `ZodTypeAny`, \{ `actions`: `string`[]; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: ...; `userId`: ...; \} \| \{ `agentId`: ...; `kind`: ...; \} \| \{ `conversationId`: ...; `kind`: ...; \} \| \{ `kind`: ...; `serviceId`: ...; \}; `path`: `string`[]; \}; `scope`: `"exact"` \| `"descendants"`; \}, \{ `actions`: `string`[]; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: ...; `userId`: ...; \} \| \{ `agentId`: ...; `kind`: ...; \} \| \{ `conversationId`: ...; `kind`: ...; \} \| \{ `kind`: ...; `serviceId`: ...; \}; `path`: `string`[]; \}; `scope`: `"exact"` \| `"descendants"`; \}\>, `"many"`>\>; `constraints`: `ZodOptional`\<`ZodEffects`\<`ZodObject`\<\{ `delegationDepth`: `ZodOptional`\<`ZodNumber`>\>; `expiresAt`: `ZodOptional`\<`ZodString`>\>; `maxUses`: `ZodOptional`\<`ZodNumber`>\>; `notBefore`: `ZodOptional`\<`ZodString`>\>; `purposes`: `ZodOptional`\<`ZodArray`\<..., ...\>\>; \}, `"strict"`, `ZodTypeAny`, \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: ...[]; \}, \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: ...[]; \}\>, \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}, \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}\>\>; `id`: `ZodString`; `metadata`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `namespaceId`: `ZodString`; `owner`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `purpose`: `ZodString`; `requestedAt`: `ZodString`; `requester`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; \}, `"strict"`, `ZodTypeAny`, \{ `capabilities`: `object`[]; `constraints?`: \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}; `id`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `namespaceId`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `requestedAt`: `string`; `requester`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \}, \{ `capabilities`: `object`[]; `constraints?`: \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}; `id`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `namespaceId`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `requestedAt`: `string`; `requester`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \}\>\>; `reviewer`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `status`: `ZodLiteral`\<`"pending"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `reason`: `string`; `requestedAt`: `string`; `requestedAuthority?`: \{ `capabilities`: `object`[]; `constraints?`: \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}; `id`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `namespaceId`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `requestedAt`: `string`; `requester`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \}; `reviewer`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `status`: `"pending"`; \}, \{ `reason`: `string`; `requestedAt`: `string`; `requestedAuthority?`: \{ `capabilities`: `object`[]; `constraints?`: \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: `string`[]; \}; `id`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `namespaceId`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `requestedAt`: `string`; `requester`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \}; `reviewer`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `status`: `"pending"`; \}\>

Defined in: [execution.ts:70](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/execution.ts#L70)

A stopped turn awaiting a human decision.

This is a stub by design. SharedOS records that authority was asked for, who
would decide it, and when -- and nothing else. It does not model review
queues, approval tokens, or resumption, because granting authority is
host-owned control-plane work and an escalation that could be resolved from
inside a turn would be an escalation an agent could grant itself.

`reviewer` is assumed rather than resolved: it is the owner the turn already
runs on behalf of. A host with a real review roster substitutes its own.

---

### ExecutionEventSchema

> `const` **ExecutionEventSchema**: `ZodObject`\<\{ `data`: `ZodType`\<[`JsonValue`](#jsonvalue), `ZodTypeDef`, [`JsonValue`](#jsonvalue)>\>; `eventId`: `ZodString`; `executionId`: `ZodString`; `occurredAt`: `ZodString`; `sequence`: `ZodNumber`; `traceId`: `ZodString`; `type`: `ZodString`; `version`: `ZodLiteral`\<`"1"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `data`: [`JsonValue`](#jsonvalue); `eventId`: `string`; `executionId`: `string`; `occurredAt`: `string`; `sequence`: `number`; `traceId`: `string`; `type`: `string`; `version`: `"1"`; \}, \{ `data`: [`JsonValue`](#jsonvalue); `eventId`: `string`; `executionId`: `string`; `occurredAt`: `string`; `sequence`: `number`; `traceId`: `string`; `type`: `string`; `version`: `"1"`; \}\>

Defined in: [execution.ts:43](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/execution.ts#L43)

An append-only event emitted while executing a request.

---

### ExecutionOptionsSchema

> `const` **ExecutionOptionsSchema**: `ZodObject`\<\{ `maxSteps`: `ZodOptional`\<`ZodNumber`>\>; `maxToolCalls`: `ZodOptional`\<`ZodNumber`>\>; `timeoutMs`: `ZodOptional`\<`ZodNumber`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `maxSteps?`: `number`; `maxToolCalls?`: `number`; `timeoutMs?`: `number`; \}, \{ `maxSteps?`: `number`; `maxToolCalls?`: `number`; `timeoutMs?`: `number`; \}\>

Defined in: [execution.ts:15](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/execution.ts#L15)

---

### ExecutionRequestSchema

> `const` **ExecutionRequestSchema**: `ZodObject`\<\{ `agent`: `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>; `context`: `ZodObject`\<\{ `actor`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `authority`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `enabledToolNamespaces`: `ZodEffects`\<`ZodArray`\<`ZodString`, `"many"`>\>, `string`[], `string`[]\>; `namespaceId`: `ZodString`; `now`: `ZodString`; `owner`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `purpose`: `ZodString`; `traceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \}, \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \}\>; `executionId`: `ZodString`; `message`: `ZodObject`\<\{ `createdAt`: `ZodString`; `id`: `ZodString`; `payload`: `ZodType`\<[`JsonValue`](#jsonvalue), `ZodTypeDef`, [`JsonValue`](#jsonvalue)>\>; `provenance`: `ZodOptional`\<`ZodObject`\<\{ `metadata`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `parentIds`: `ZodArray`\<`ZodString`, `"many"`>\>; `source`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `metadata?`: [`JsonObject`](#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}, \{ `metadata?`: [`JsonObject`](#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}\>\>; `purpose`: `ZodString`; `receiver`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `replyTo`: `ZodOptional`\<`ZodString`>\>; `sender`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `traceId`: `ZodString`; `version`: `ZodLiteral`\<`"1"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `createdAt`: `string`; `id`: `string`; `payload`: [`JsonValue`](#jsonvalue); `provenance?`: \{ `metadata?`: [`JsonObject`](#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}; `purpose`: `string`; `receiver`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `replyTo?`: `string`; `sender`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `traceId`: `string`; `version`: `"1"`; \}, \{ `createdAt`: `string`; `id`: `string`; `payload`: [`JsonValue`](#jsonvalue); `provenance?`: \{ `metadata?`: [`JsonObject`](#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}; `purpose`: `string`; `receiver`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `replyTo?`: `string`; `sender`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `traceId`: `string`; `version`: `"1"`; \}\>; `metadata`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `options`: `ZodOptional`\<`ZodObject`\<\{ `maxSteps`: `ZodOptional`\<`ZodNumber`>\>; `maxToolCalls`: `ZodOptional`\<`ZodNumber`>\>; `timeoutMs`: `ZodOptional`\<`ZodNumber`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `maxSteps?`: `number`; `maxToolCalls?`: `number`; `timeoutMs?`: `number`; \}, \{ `maxSteps?`: `number`; `maxToolCalls?`: `number`; `timeoutMs?`: `number`; \}\>\>; `state`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `tools`: `ZodArray`\<`ZodEffects`\<`ZodObject`\<\{ `annotations`: `ZodOptional`\<`ZodObject`\<\{ `destructive`: `ZodOptional`\<`ZodBoolean`>\>; `idempotent`: `ZodOptional`\<`ZodBoolean`>\>; `readOnly`: `ZodOptional`\<`ZodBoolean`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `destructive?`: `boolean`; `idempotent?`: `boolean`; `readOnly?`: `boolean`; \}, \{ `destructive?`: `boolean`; `idempotent?`: `boolean`; `readOnly?`: `boolean`; \}\>\>; `description`: `ZodString`; `inputSchema`: `ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>\>; `metadata`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `name`: `ZodString`; `namespace`: `ZodString`; `outputSchema`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `readWrite`: `ZodEnum`\<\[`"read"`, `"write"`\]\>; `requiredCapability`: `ZodObject`\<\{ `action`: `ZodString`; `resource`: `ZodObject`\<\{ `namespace`: `ZodString`; `owner`: `ZodOptional`\<...\>; `path`: `ZodArray`\<..., ...\>; \}, `"strict"`, `ZodTypeAny`, \{ `namespace`: `string`; `owner?`: ... \| ... \| ... \| ... \| ...; `path`: ...[]; \}, \{ `namespace`: `string`; `owner?`: ... \| ... \| ... \| ... \| ...; `path`: ...[]; \}\>; \}, `"strict"`, `ZodTypeAny`, \{ `action`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: ...; `userId`: ...; \} \| \{ `agentId`: ...; `kind`: ...; \} \| \{ `conversationId`: ...; `kind`: ...; \} \| \{ `kind`: ...; `serviceId`: ...; \}; `path`: `string`[]; \}; \}, \{ `action`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: ...; `userId`: ...; \} \| \{ `agentId`: ...; `kind`: ...; \} \| \{ `conversationId`: ...; `kind`: ...; \} \| \{ `kind`: ...; `serviceId`: ...; \}; `path`: `string`[]; \}; \}\>; `source`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `annotations?`: \{ `destructive?`: `boolean`; `idempotent?`: `boolean`; `readOnly?`: `boolean`; \}; `description`: `string`; `inputSchema`: [`JsonObject`](#jsonobject); `metadata?`: [`JsonObject`](#jsonobject); `name`: `string`; `namespace`: `string`; `outputSchema?`: [`JsonObject`](#jsonobject); `readWrite`: `"read"` \| `"write"`; `requiredCapability`: \{ `action`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; \}; `source`: `string`; \}, \{ `annotations?`: \{ `destructive?`: `boolean`; `idempotent?`: `boolean`; `readOnly?`: `boolean`; \}; `description`: `string`; `inputSchema`: [`JsonObject`](#jsonobject); `metadata?`: [`JsonObject`](#jsonobject); `name`: `string`; `namespace`: `string`; `outputSchema?`: [`JsonObject`](#jsonobject); `readWrite`: `"read"` \| `"write"`; `requiredCapability`: \{ `action`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; \}; `source`: `string`; \}\>, \{ `annotations?`: \{ `destructive?`: `boolean`; `idempotent?`: `boolean`; `readOnly?`: `boolean`; \}; `description`: `string`; `inputSchema`: [`JsonObject`](#jsonobject); `metadata?`: [`JsonObject`](#jsonobject); `name`: `string`; `namespace`: `string`; `outputSchema?`: [`JsonObject`](#jsonobject); `readWrite`: `"read"` \| `"write"`; `requiredCapability`: \{ `action`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; \}; `source`: `string`; \}, \{ `annotations?`: \{ `destructive?`: `boolean`; `idempotent?`: `boolean`; `readOnly?`: `boolean`; \}; `description`: `string`; `inputSchema`: [`JsonObject`](#jsonobject); `metadata?`: [`JsonObject`](#jsonobject); `name`: `string`; `namespace`: `string`; `outputSchema?`: [`JsonObject`](#jsonobject); `readWrite`: `"read"` \| `"write"`; `requiredCapability`: \{ `action`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; \}; `source`: `string`; \}\>, `"many"`>\>; `version`: `ZodLiteral`\<`"1"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agent`: \{ `agentId`: `string`; `kind`: `"agent"`; \}; `context`: \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \}; `executionId`: `string`; `message`: \{ `createdAt`: `string`; `id`: `string`; `payload`: [`JsonValue`](#jsonvalue); `provenance?`: \{ `metadata?`: [`JsonObject`](#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}; `purpose`: `string`; `receiver`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `replyTo?`: `string`; `sender`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `traceId`: `string`; `version`: `"1"`; \}; `metadata?`: [`JsonObject`](#jsonobject); `options?`: \{ `maxSteps?`: `number`; `maxToolCalls?`: `number`; `timeoutMs?`: `number`; \}; `state?`: [`JsonObject`](#jsonobject); `tools`: `object`[]; `version`: `"1"`; \}, \{ `agent`: \{ `agentId`: `string`; `kind`: `"agent"`; \}; `context`: \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \}; `executionId`: `string`; `message`: \{ `createdAt`: `string`; `id`: `string`; `payload`: [`JsonValue`](#jsonvalue); `provenance?`: \{ `metadata?`: [`JsonObject`](#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}; `purpose`: `string`; `receiver`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `replyTo?`: `string`; `sender`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `traceId`: `string`; `version`: `"1"`; \}; `metadata?`: [`JsonObject`](#jsonobject); `options?`: \{ `maxSteps?`: `number`; `maxToolCalls?`: `number`; `timeoutMs?`: `number`; \}; `state?`: [`JsonObject`](#jsonobject); `tools`: `object`[]; `version`: `"1"`; \}\>

Defined in: [execution.ts:26](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/execution.ts#L26)

One permission-controlled agent turn. Tick scheduling stays with the host.

---

### ExecutionResultSchema

> `const` **ExecutionResultSchema**: `ZodDiscriminatedUnion`\<`"status"`, \[`ZodObject`\<`object` & `object`, `"strict"`, `ZodTypeAny`, \{ `completedAt`: `string`; `events`: `object`[]; `executionId`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `output`: [`JsonValue`](#jsonvalue); `startedAt`: `string`; `status`: `"succeeded"`; `traceId`: `string`; `version`: `"1"`; \}, \{ `completedAt`: `string`; `events`: `object`[]; `executionId`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `output`: [`JsonValue`](#jsonvalue); `startedAt`: `string`; `status`: `"succeeded"`; `traceId`: `string`; `version`: `"1"`; \}\>, `ZodObject`\<`object` & `object`, `"strict"`, `ZodTypeAny`, \{ `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `events`: `object`[]; `executionId`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `startedAt`: `string`; `status`: `"denied"`; `traceId`: `string`; `version`: `"1"`; \}, \{ `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `events`: `object`[]; `executionId`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `startedAt`: `string`; `status`: `"denied"`; `traceId`: `string`; `version`: `"1"`; \}\>, `ZodObject`\<`object` & `object`, `"strict"`, `ZodTypeAny`, \{ `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `events`: `object`[]; `executionId`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `startedAt`: `string`; `status`: `"failed"`; `traceId`: `string`; `version`: `"1"`; \}, \{ `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `events`: `object`[]; `executionId`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `startedAt`: `string`; `status`: `"failed"`; `traceId`: `string`; `version`: `"1"`; \}\>, `ZodObject`\<`object` & `object`, `"strict"`, `ZodTypeAny`, \{ `completedAt`: `string`; `error?`: \{ `code`: `string`; `details?`: [`JsonObject`](#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `events`: `object`[]; `executionId`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `startedAt`: `string`; `status`: `"cancelled"`; `traceId`: `string`; `version`: `"1"`; \}, \{ `completedAt`: `string`; `error?`: \{ `code`: `string`; `details?`: [`JsonObject`](#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `events`: `object`[]; `executionId`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `startedAt`: `string`; `status`: `"cancelled"`; `traceId`: `string`; `version`: `"1"`; \}\>, `ZodObject`\<`object` & `object`, `"strict"`, `ZodTypeAny`, \{ `completedAt`: `string`; `escalation`: \{ `reason`: `string`; `requestedAt`: `string`; `requestedAuthority?`: \{ `capabilities`: `object`[]; `constraints?`: \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: ...[]; \}; `id`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `namespaceId`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `requestedAt`: `string`; `requester`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \}; `reviewer`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `status`: `"pending"`; \}; `events`: `object`[]; `executionId`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `startedAt`: `string`; `status`: `"escalated"`; `traceId`: `string`; `version`: `"1"`; \}, \{ `completedAt`: `string`; `escalation`: \{ `reason`: `string`; `requestedAt`: `string`; `requestedAuthority?`: \{ `capabilities`: `object`[]; `constraints?`: \{ `delegationDepth?`: `number`; `expiresAt?`: `string`; `maxUses?`: `number`; `notBefore?`: `string`; `purposes?`: ...[]; \}; `id`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `namespaceId`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `requestedAt`: `string`; `requester`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \}; `reviewer`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `status`: `"pending"`; \}; `events`: `object`[]; `executionId`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `startedAt`: `string`; `status`: `"escalated"`; `traceId`: `string`; `version`: `"1"`; \}\>\]\>

Defined in: [execution.ts:105](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/execution.ts#L105)

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

### MAX\_CONTEXT\_CAPSULE\_CONTENT\_BYTES

> `const` **MAX\_CONTEXT\_CAPSULE\_CONTENT\_BYTES**: `number`

Defined in: [context-capsule.ts:51](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/context-capsule.ts#L51)

Combined item content, bounded separately from envelope overhead.

---

### MAX\_CONTEXT\_CAPSULE\_ENCODED\_BYTES

> `const` **MAX\_CONTEXT\_CAPSULE\_ENCODED\_BYTES**: `number`

Defined in: [context-capsule.ts:49](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/context-capsule.ts#L49)

Total encoded size of the capsule, so one delegation cannot become a dump.

---

### MAX\_CONTEXT\_CAPSULE\_ITEMS

> `const` **MAX\_CONTEXT\_CAPSULE\_ITEMS**: `12` = `12`

Defined in: [context-capsule.ts:52](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/context-capsule.ts#L52)

---

### MAX\_CONTEXT\_CAPSULE\_LIMITATIONS

> `const` **MAX\_CONTEXT\_CAPSULE\_LIMITATIONS**: `12` = `12`

Defined in: [context-capsule.ts:53](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/context-capsule.ts#L53)

---

### MAX\_EXECUTION\_TIMEOUT\_MS

> `const` **MAX\_EXECUTION\_TIMEOUT\_MS**: `600000` = `600_000`

Defined in: [execution.ts:12](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/execution.ts#L12)

---

### MAX\_EXECUTION\_TOOL\_CALLS

> `const` **MAX\_EXECUTION\_TOOL\_CALLS**: `10000` = `10_000`

Defined in: [execution.ts:13](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/execution.ts#L13)

---

### MessageDeliveryResultSchema

> `const` **MessageDeliveryResultSchema**: `ZodDiscriminatedUnion`\<`"status"`, \[`ZodObject`\<`object` & `object`, `"strict"`, `ZodTypeAny`, \{ `messageId`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `status`: `"accepted"`; `timestamp`: `string`; \}, \{ `messageId`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `status`: `"accepted"`; `timestamp`: `string`; \}\>, `ZodObject`\<`object` & `object`, `"strict"`, `ZodTypeAny`, \{ `messageId`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `status`: `"delivered"`; `timestamp`: `string`; \}, \{ `messageId`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `status`: `"delivered"`; `timestamp`: `string`; \}\>, `ZodObject`\<`object` & `object`, `"strict"`, `ZodTypeAny`, \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `messageId`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `status`: `"denied"`; `timestamp`: `string`; \}, \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `messageId`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `status`: `"denied"`; `timestamp`: `string`; \}\>, `ZodObject`\<`object` & `object`, `"strict"`, `ZodTypeAny`, \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `messageId`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `status`: `"failed"`; `timestamp`: `string`; \}, \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `messageId`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `status`: `"failed"`; `timestamp`: `string`; \}\>\]\>

Defined in: [message.ts:81](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/message.ts#L81)

The transport-neutral outcome of submitting a message for delivery.

---

### MessageEnvelopeSchema

> `const` **MessageEnvelopeSchema**: `ZodObject`\<\{ `createdAt`: `ZodString`; `id`: `ZodString`; `payload`: `ZodType`\<[`JsonValue`](#jsonvalue), `ZodTypeDef`, [`JsonValue`](#jsonvalue)>\>; `provenance`: `ZodOptional`\<`ZodObject`\<\{ `metadata`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `parentIds`: `ZodArray`\<`ZodString`, `"many"`>\>; `source`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `metadata?`: [`JsonObject`](#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}, \{ `metadata?`: [`JsonObject`](#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}\>\>; `purpose`: `ZodString`; `receiver`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `replyTo`: `ZodOptional`\<`ZodString`>\>; `sender`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `traceId`: `ZodString`; `version`: `ZodLiteral`\<`"1"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `createdAt`: `string`; `id`: `string`; `payload`: [`JsonValue`](#jsonvalue); `provenance?`: \{ `metadata?`: [`JsonObject`](#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}; `purpose`: `string`; `receiver`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `replyTo?`: `string`; `sender`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `traceId`: `string`; `version`: `"1"`; \}, \{ `createdAt`: `string`; `id`: `string`; `payload`: [`JsonValue`](#jsonvalue); `provenance?`: \{ `metadata?`: [`JsonObject`](#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}; `purpose`: `string`; `receiver`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `replyTo?`: `string`; `sender`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `traceId`: `string`; `version`: `"1"`; \}\>

Defined in: [message.ts:26](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/message.ts#L26)

A message carries data and one host-bound purpose, never authority. Authority
is supplied separately through AccessContext and evaluated at the point of use.

---

### MessageProvenanceSchema

> `const` **MessageProvenanceSchema**: `ZodObject`\<\{ `metadata`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `parentIds`: `ZodArray`\<`ZodString`, `"many"`>\>; `source`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `metadata?`: [`JsonObject`](#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}, \{ `metadata?`: [`JsonObject`](#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}\>

Defined in: [message.ts:12](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/message.ts#L12)

Hop provenance a host may attach to an envelope. The kernel neither sets nor
reads it; see `docs/open-items.md`.

---

### MessageRequestArgumentsSchema

> `const` **MessageRequestArgumentsSchema**: `ZodObject`\<\{ `payload`: `ZodType`\<[`JsonValue`](#jsonvalue), `ZodTypeDef`, [`JsonValue`](#jsonvalue)>\>; `recipient`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodEffects`\<`ZodEffects`\<`ZodString`, `string`, `string`>\>, `string`, `string`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodEffects`\<`ZodEffects`\<`ZodString`, `string`, `string`>\>, `string`, `string`>\>; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodEffects`\<`ZodEffects`\<`ZodString`, `string`, `string`>\>, `string`, `string`>\>; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodEffects`\<`ZodEffects`\<`ZodString`, `string`, `string`>\>, `string`, `string`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; \}, `"strict"`, `ZodTypeAny`, \{ `payload`: [`JsonValue`](#jsonvalue); `recipient`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \}, \{ `payload`: [`JsonValue`](#jsonvalue); `recipient`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; \}\>

Defined in: [message.ts:65](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/message.ts#L65)

The complete and intentionally narrow message input a model may author.

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

### PublishedToolAnnotationsSchema

> `const` **PublishedToolAnnotationsSchema**: `ZodObject`\<\{ `destructiveHint`: `ZodOptional`\<`ZodBoolean`>\>; `idempotentHint`: `ZodOptional`\<`ZodBoolean`>\>; `openWorldHint`: `ZodOptional`\<`ZodBoolean`>\>; `readOnlyHint`: `ZodOptional`\<`ZodBoolean`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `destructiveHint?`: `boolean`; `idempotentHint?`: `boolean`; `openWorldHint?`: `boolean`; `readOnlyHint?`: `boolean`; \}, \{ `destructiveHint?`: `boolean`; `idempotentHint?`: `boolean`; `openWorldHint?`: `boolean`; `readOnlyHint?`: `boolean`; \}\>

Defined in: [tool.ts:156](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L156)

MCP tool annotation hints, in the vocabulary a harness receives them in.

These are the same three facts [ToolAnnotationsSchema](#toolannotationsschema) carries, renamed
to the MCP wire spelling. They stay a separate type rather than a rename at
the edge because they are a _hint_ surface: advisory metadata a model may use
to decide how to call a tool, and never an authorization input on either side
of the boundary.

`openWorldHint` has no SharedOS equivalent and is therefore never emitted.
Inventing a value for it would put an unfixed field into `catalogHash`.

---

### PublishedToolDefinitionSchema

> `const` **PublishedToolDefinitionSchema**: `ZodObject`\<\{ `annotations`: `ZodOptional`\<`ZodObject`\<\{ `destructiveHint`: `ZodOptional`\<`ZodBoolean`>\>; `idempotentHint`: `ZodOptional`\<`ZodBoolean`>\>; `openWorldHint`: `ZodOptional`\<`ZodBoolean`>\>; `readOnlyHint`: `ZodOptional`\<`ZodBoolean`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `destructiveHint?`: `boolean`; `idempotentHint?`: `boolean`; `openWorldHint?`: `boolean`; `readOnlyHint?`: `boolean`; \}, \{ `destructiveHint?`: `boolean`; `idempotentHint?`: `boolean`; `openWorldHint?`: `boolean`; `readOnlyHint?`: `boolean`; \}\>\>; `description`: `ZodString`; `inputSchema`: `ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>\>; `metadata`: `ZodOptional`\<`ZodObject`\<\{ `namespace`: `ZodOptional`\<`ZodString`>\>; `source`: `ZodOptional`\<`ZodString`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `namespace?`: `string`; `source?`: `string`; \}, \{ `namespace?`: `string`; `source?`: `string`; \}\>\>; `name`: `ZodString`; `outputSchema`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; \}, `"strict"`, `ZodTypeAny`, \{ `annotations?`: \{ `destructiveHint?`: `boolean`; `idempotentHint?`: `boolean`; `openWorldHint?`: `boolean`; `readOnlyHint?`: `boolean`; \}; `description`: `string`; `inputSchema`: [`JsonObject`](#jsonobject); `metadata?`: \{ `namespace?`: `string`; `source?`: `string`; \}; `name`: `string`; `outputSchema?`: [`JsonObject`](#jsonobject); \}, \{ `annotations?`: \{ `destructiveHint?`: `boolean`; `idempotentHint?`: `boolean`; `openWorldHint?`: `boolean`; `readOnlyHint?`: `boolean`; \}; `description`: `string`; `inputSchema`: [`JsonObject`](#jsonobject); `metadata?`: \{ `namespace?`: `string`; `source?`: `string`; \}; `name`: `string`; `outputSchema?`: [`JsonObject`](#jsonobject); \}\>

Defined in: [tool.ts:190](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L190)

Everything a model or harness is allowed to see about one tool.

This is the projection SharedOS publishes across the MCP boundary, and it is
defined by what it omits. `requiredCapability`, `resolveRequirement`, grants,
issuing authority, namespace settings, credentials, and handler references do
not appear here and never cross the boundary: a harness receives the operation
surface, and SharedOS keeps the authority.

`name` is the canonical SharedOS tool ID and is simultaneously the raw MCP
`Tool.name`. There is deliberately no second identity field. A published
catalogue with two names for one tool is a catalogue where authorization and
discovery can disagree, and [ToolNameSchema](#toolnameschema) exists precisely so the
canonical name is always carriable as-is.

---

### PublishedToolMetadataSchema

> `const` **PublishedToolMetadataSchema**: `ZodObject`\<\{ `namespace`: `ZodOptional`\<`ZodString`>\>; `source`: `ZodOptional`\<`ZodString`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `namespace?`: `string`; `source?`: `string`; \}, \{ `namespace?`: `string`; `source?`: `string`; \}\>

Defined in: [tool.ts:167](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L167)

Catalogue provenance a harness may see. Metadata, never proof of authority.

---

### ReachListSchema

> `const` **ReachListSchema**: `ZodArray`\<`ZodObject`\<\{ `actions`: `ZodArray`\<`ZodString`, `"many"`>\>; `namespace`: `ZodString`; `path`: `ZodArray`\<`ZodString`, `"many"`>\>; `scope`: `ZodEnum`\<\[`"exact"`, `"descendants"`\]\>; \}, `"strict"`, `ZodTypeAny`, \{ `actions`: `string`[]; `namespace`: `string`; `path`: `string`[]; `scope`: `"exact"` \| `"descendants"`; \}, \{ `actions`: `string`[]; `namespace`: `string`; `path`: `string`[]; `scope`: `"exact"` \| `"descendants"`; \}\>, `"many"`>\>

Defined in: [capability.ts:180](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/capability.ts#L180)

As many entries as one reach may carry, on a card or on the wire.

---

### ReachResultSchema

> `const` **ReachResultSchema**: `ZodDiscriminatedUnion`\<`"status"`, \[`ZodObject`\<\{ `reach`: `ZodArray`\<`ZodObject`\<\{ `actions`: `ZodArray`\<`ZodString`, `"many"`>\>; `namespace`: `ZodString`; `path`: `ZodArray`\<`ZodString`, `"many"`>\>; `scope`: `ZodEnum`\<\[`"exact"`, `"descendants"`\]\>; \}, `"strict"`, `ZodTypeAny`, \{ `actions`: `string`[]; `namespace`: `string`; `path`: `string`[]; `scope`: `"exact"` \| `"descendants"`; \}, \{ `actions`: `string`[]; `namespace`: `string`; `path`: `string`[]; `scope`: `"exact"` \| `"descendants"`; \}\>, `"many"`>\>; `status`: `ZodLiteral`\<`"computed"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `reach`: `object`[]; `status`: `"computed"`; \}, \{ `reach`: `object`[]; `status`: `"computed"`; \}\>, `ZodObject`\<\{ `reasonCode`: `ZodEnum`\<\[`"authority_unavailable"`, `"usage_store_unavailable"`\]\>; `status`: `ZodLiteral`\<`"unavailable"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `reasonCode`: `"authority_unavailable"` \| `"usage_store_unavailable"`; `status`: `"unavailable"`; \}, \{ `reasonCode`: `"authority_unavailable"` \| `"usage_store_unavailable"`; `status`: `"unavailable"`; \}\>\]\>

Defined in: [capability.ts:207](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/capability.ts#L207)

What asking for a reach answers.

`computed` carries the reachable surface, possibly empty: a context that can
authorize nothing reaches nothing, and that is a true answer. `unavailable`
means no answer could be established, and says why in the vocabulary a denial
uses. The shape crosses the HTTP boundary unchanged, so a remote caller reads
the same result an embedded host does.

---

### ReachSummarySchema

> `const` **ReachSummarySchema**: `ZodObject`\<\{ `actions`: `ZodArray`\<`ZodString`, `"many"`>\>; `entries`: `ZodNumber`; `namespace`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `actions`: `string`[]; `entries`: `number`; `namespace`: `string`; \}, \{ `actions`: `string`[]; `entries`: `number`; `namespace`: `string`; \}\>

Defined in: [card.ts:41](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/card.ts#L41)

One namespace the subject reaches, and how much of it, without paths.

`entries` counts the reach entries collapsed into this row, not resources: a
single `descendants` entry over a whole tree counts once, exactly as it
appears in `reach`. Counting resources would require asking a provider what
exists, which is the lookup a card must never become.

---

### ReachUnavailableReasonSchema

> `const` **ReachUnavailableReasonSchema**: `ZodEnum`\<\[`"authority_unavailable"`, `"usage_store_unavailable"`\]\>

Defined in: [capability.ts:192](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/capability.ts#L192)

Why a reach could not be established.

Both are infrastructure codes the decide path already fails closed with: the
authority behind the reach could not be loaded, or a bounded grant's budget
could not be read. Neither narrows the answer. A reach that silently omitted
a live grant because a dependency is down would look exactly like one that is
true, so the whole answer is withheld under a code the reader can act on
(ADR 0021).

---

### RemoteExecutionRequestSchema

> `const` **RemoteExecutionRequestSchema**: `ZodObject`\<`Omit`\<\{ `agent`: `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>; `context`: `ZodObject`\<\{ `actor`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `authority`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `enabledToolNamespaces`: `ZodEffects`\<`ZodArray`\<`ZodString`, `"many"`>\>, `string`[], `string`[]\>; `namespaceId`: `ZodString`; `now`: `ZodString`; `owner`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `purpose`: `ZodString`; `traceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \}, \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \}\>; `executionId`: `ZodString`; `message`: `ZodObject`\<\{ `createdAt`: `ZodString`; `id`: `ZodString`; `payload`: `ZodType`\<[`JsonValue`](#jsonvalue), `ZodTypeDef`, [`JsonValue`](#jsonvalue)>\>; `provenance`: `ZodOptional`\<`ZodObject`\<\{ `metadata`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `parentIds`: `ZodArray`\<`ZodString`, `"many"`>\>; `source`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `metadata?`: [`JsonObject`](#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}, \{ `metadata?`: [`JsonObject`](#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}\>\>; `purpose`: `ZodString`; `receiver`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `replyTo`: `ZodOptional`\<`ZodString`>\>; `sender`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `traceId`: `ZodString`; `version`: `ZodLiteral`\<`"1"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `createdAt`: `string`; `id`: `string`; `payload`: [`JsonValue`](#jsonvalue); `provenance?`: \{ `metadata?`: [`JsonObject`](#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}; `purpose`: `string`; `receiver`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `replyTo?`: `string`; `sender`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `traceId`: `string`; `version`: `"1"`; \}, \{ `createdAt`: `string`; `id`: `string`; `payload`: [`JsonValue`](#jsonvalue); `provenance?`: \{ `metadata?`: [`JsonObject`](#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}; `purpose`: `string`; `receiver`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `replyTo?`: `string`; `sender`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `traceId`: `string`; `version`: `"1"`; \}\>; `metadata`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `options`: `ZodOptional`\<`ZodObject`\<\{ `maxSteps`: `ZodOptional`\<`ZodNumber`>\>; `maxToolCalls`: `ZodOptional`\<`ZodNumber`>\>; `timeoutMs`: `ZodOptional`\<`ZodNumber`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `maxSteps?`: `number`; `maxToolCalls?`: `number`; `timeoutMs?`: `number`; \}, \{ `maxSteps?`: `number`; `maxToolCalls?`: `number`; `timeoutMs?`: `number`; \}\>\>; `state`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `tools`: `ZodArray`\<`ZodEffects`\<`ZodObject`\<\{ `annotations`: `ZodOptional`\<`ZodObject`\<\{ `destructive`: `ZodOptional`\<...\>; `idempotent`: `ZodOptional`\<...\>; `readOnly`: `ZodOptional`\<...\>; \}, `"strict"`, `ZodTypeAny`, \{ `destructive?`: ... \| ... \| ...; `idempotent?`: ... \| ... \| ...; `readOnly?`: ... \| ... \| ...; \}, \{ `destructive?`: ... \| ... \| ...; `idempotent?`: ... \| ... \| ...; `readOnly?`: ... \| ... \| ...; \}\>\>; `description`: `ZodString`; `inputSchema`: `ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>\>; `metadata`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `name`: `ZodString`; `namespace`: `ZodString`; `outputSchema`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `readWrite`: `ZodEnum`\<\[`"read"`, `"write"`\]\>; `requiredCapability`: `ZodObject`\<\{ `action`: `ZodString`; `resource`: `ZodObject`\<\{ `namespace`: ...; `owner`: ...; `path`: ...; \}, `"strict"`, `ZodTypeAny`, \{ `namespace`: ...; `owner?`: ...; `path`: ...; \}, \{ `namespace`: ...; `owner?`: ...; `path`: ...; \}\>; \}, `"strict"`, `ZodTypeAny`, \{ `action`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: ... \| ... \| ... \| ... \| ...; `path`: ...[]; \}; \}, \{ `action`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: ... \| ... \| ... \| ... \| ...; `path`: ...[]; \}; \}\>; `source`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `annotations?`: \{ `destructive?`: `boolean`; `idempotent?`: `boolean`; `readOnly?`: `boolean`; \}; `description`: `string`; `inputSchema`: [`JsonObject`](#jsonobject); `metadata?`: [`JsonObject`](#jsonobject); `name`: `string`; `namespace`: `string`; `outputSchema?`: [`JsonObject`](#jsonobject); `readWrite`: `"read"` \| `"write"`; `requiredCapability`: \{ `action`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: ...; `userId`: ...; \} \| \{ `agentId`: ...; `kind`: ...; \} \| \{ `conversationId`: ...; `kind`: ...; \} \| \{ `kind`: ...; `serviceId`: ...; \}; `path`: `string`[]; \}; \}; `source`: `string`; \}, \{ `annotations?`: \{ `destructive?`: `boolean`; `idempotent?`: `boolean`; `readOnly?`: `boolean`; \}; `description`: `string`; `inputSchema`: [`JsonObject`](#jsonobject); `metadata?`: [`JsonObject`](#jsonobject); `name`: `string`; `namespace`: `string`; `outputSchema?`: [`JsonObject`](#jsonobject); `readWrite`: `"read"` \| `"write"`; `requiredCapability`: \{ `action`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: ...; `userId`: ...; \} \| \{ `agentId`: ...; `kind`: ...; \} \| \{ `conversationId`: ...; `kind`: ...; \} \| \{ `kind`: ...; `serviceId`: ...; \}; `path`: `string`[]; \}; \}; `source`: `string`; \}\>, \{ `annotations?`: \{ `destructive?`: `boolean`; `idempotent?`: `boolean`; `readOnly?`: `boolean`; \}; `description`: `string`; `inputSchema`: [`JsonObject`](#jsonobject); `metadata?`: [`JsonObject`](#jsonobject); `name`: `string`; `namespace`: `string`; `outputSchema?`: [`JsonObject`](#jsonobject); `readWrite`: `"read"` \| `"write"`; `requiredCapability`: \{ `action`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; \}; `source`: `string`; \}, \{ `annotations?`: \{ `destructive?`: `boolean`; `idempotent?`: `boolean`; `readOnly?`: `boolean`; \}; `description`: `string`; `inputSchema`: [`JsonObject`](#jsonobject); `metadata?`: [`JsonObject`](#jsonobject); `name`: `string`; `namespace`: `string`; `outputSchema?`: [`JsonObject`](#jsonobject); `readWrite`: `"read"` \| `"write"`; `requiredCapability`: \{ `action`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; \}; `source`: `string`; \}\>, `"many"`>\>; `version`: `ZodLiteral`\<`"1"`>\>; \}, `"tools"` \| `"context"`>\>, `"strict"`, `ZodTypeAny`, \{ `agent`: \{ `agentId`: `string`; `kind`: `"agent"`; \}; `executionId`: `string`; `message`: \{ `createdAt`: `string`; `id`: `string`; `payload`: [`JsonValue`](#jsonvalue); `provenance?`: \{ `metadata?`: [`JsonObject`](#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}; `purpose`: `string`; `receiver`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `replyTo?`: `string`; `sender`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `traceId`: `string`; `version`: `"1"`; \}; `metadata?`: [`JsonObject`](#jsonobject); `options?`: \{ `maxSteps?`: `number`; `maxToolCalls?`: `number`; `timeoutMs?`: `number`; \}; `state?`: [`JsonObject`](#jsonobject); `version`: `"1"`; \}, \{ `agent`: \{ `agentId`: `string`; `kind`: `"agent"`; \}; `executionId`: `string`; `message`: \{ `createdAt`: `string`; `id`: `string`; `payload`: [`JsonValue`](#jsonvalue); `provenance?`: \{ `metadata?`: [`JsonObject`](#jsonobject); `parentIds`: `string`[]; `source`: `string`; \}; `purpose`: `string`; `receiver`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `replyTo?`: `string`; `sender`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `traceId`: `string`; `version`: `"1"`; \}; `metadata?`: [`JsonObject`](#jsonobject); `options?`: \{ `maxSteps?`: `number`; `maxToolCalls?`: `number`; `timeoutMs?`: `number`; \}; `state?`: [`JsonObject`](#jsonobject); `version`: `"1"`; \}\>

Defined in: [http.ts:14](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/http.ts#L14)

Turn request accepted over HTTP; authority and visible tools are host-derived.

---

### RemoteResourceOperationSchema

> `const` **RemoteResourceOperationSchema**: `ZodObject`\<`Omit`\<\{ `action`: `ZodString`; `context`: `ZodObject`\<\{ `actor`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `authority`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `enabledToolNamespaces`: `ZodEffects`\<`ZodArray`\<`ZodString`, `"many"`>\>, `string`[], `string`[]\>; `namespaceId`: `ZodString`; `now`: `ZodString`; `owner`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `purpose`: `ZodString`; `traceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \}, \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \}\>; `input`: `ZodOptional`\<`ZodType`\<[`JsonValue`](#jsonvalue), `ZodTypeDef`, [`JsonValue`](#jsonvalue)>>\>\>; `metadata`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `operationId`: `ZodString`; `resource`: `ZodObject`\<\{ `namespace`: `ZodString`; `owner`: `ZodOptional`\<`ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<...\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<...\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<...\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<...\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>\>; `path`: `ZodArray`\<`ZodString`, `"many"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}, \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}\>; \}, `"context"`>\>, `"strict"`, `ZodTypeAny`, \{ `action`: `string`; `input?`: [`JsonValue`](#jsonvalue); `metadata?`: [`JsonObject`](#jsonobject); `operationId`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; \}, \{ `action`: `string`; `input?`: [`JsonValue`](#jsonvalue); `metadata?`: [`JsonObject`](#jsonobject); `operationId`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; \}\>

Defined in: [http.ts:8](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/http.ts#L8)

Resource operation accepted over HTTP; authority is injected by the host.

---

### ResourceOperationSchema

> `const` **ResourceOperationSchema**: `ZodObject`\<\{ `action`: `ZodString`; `context`: `ZodObject`\<\{ `actor`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `authority`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `enabledToolNamespaces`: `ZodEffects`\<`ZodArray`\<`ZodString`, `"many"`>\>, `string`[], `string`[]\>; `namespaceId`: `ZodString`; `now`: `ZodString`; `owner`: `ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>; `purpose`: `ZodString`; `traceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \}, \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \}\>; `input`: `ZodOptional`\<`ZodType`\<[`JsonValue`](#jsonvalue), `ZodTypeDef`, [`JsonValue`](#jsonvalue)>>\>\>; `metadata`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `operationId`: `ZodString`; `resource`: `ZodObject`\<\{ `namespace`: `ZodString`; `owner`: `ZodOptional`\<`ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<\{ `kind`: `ZodLiteral`\<`"human"`>\>; `userId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"human"`; `userId`: `string`; \}, \{ `kind`: `"human"`; `userId`: `string`; \}\>, `ZodObject`\<\{ `agentId`: `ZodString`; `kind`: `ZodLiteral`\<`"agent"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `agentId`: `string`; `kind`: `"agent"`; \}, \{ `agentId`: `string`; `kind`: `"agent"`; \}\>, `ZodObject`\<\{ `conversationId`: `ZodString`; `kind`: `ZodLiteral`\<`"group"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `conversationId`: `string`; `kind`: `"group"`; \}, \{ `conversationId`: `string`; `kind`: `"group"`; \}\>, `ZodObject`\<\{ `kind`: `ZodLiteral`\<`"service"`>\>; `serviceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `kind`: `"service"`; `serviceId`: `string`; \}, \{ `kind`: `"service"`; `serviceId`: `string`; \}\>\]\>\>; `path`: `ZodArray`\<`ZodString`, `"many"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}, \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}\>; \}, `"strict"`, `ZodTypeAny`, \{ `action`: `string`; `context`: \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \}; `input?`: [`JsonValue`](#jsonvalue); `metadata?`: [`JsonObject`](#jsonobject); `operationId`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; \}, \{ `action`: `string`; `context`: \{ `actor`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `authority`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `enabledToolNamespaces`: `string`[]; `namespaceId`: `string`; `now`: `string`; `owner`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `purpose`: `string`; `traceId`: `string`; \}; `input?`: [`JsonValue`](#jsonvalue); `metadata?`: [`JsonObject`](#jsonobject); `operationId`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; \}\>

Defined in: [resource.ts:10](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/resource.ts#L10)

A self-contained request to perform one permission-controlled operation.

---

### ResourceReachSchema

> `const` **ResourceReachSchema**: `ZodObject`\<\{ `actions`: `ZodArray`\<`ZodString`, `"many"`>\>; `namespace`: `ZodString`; `path`: `ZodArray`\<`ZodString`, `"many"`>\>; `scope`: `ZodEnum`\<\[`"exact"`, `"descendants"`\]\>; \}, `"strict"`, `ZodTypeAny`, \{ `actions`: `string`[]; `namespace`: `string`; `path`: `string`[]; `scope`: `"exact"` \| `"descendants"`; \}, \{ `actions`: `string`[]; `namespace`: `string`; `path`: `string`[]; `scope`: `"exact"` \| `"descendants"`; \}\>

Defined in: [capability.ts:168](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/capability.ts#L168)

Where an actor may operate, with the authority stripped out.

A reader needs to know which paths are worth naming — otherwise it guesses
and collects denials — but it must not learn who granted the access, for how
long, or how many uses remain. This carries the shape of the reachable
surface and nothing else. It is descriptive: every call is still authorized
independently, so a stale or over-wide `ResourceReach` cannot permit
anything.

The owner is deliberately absent as well. Reach is always derived under one
access context and describes that context's world; carrying an owner would
invite a reader to treat an entry as portable to another.

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

> `const` **RuntimeTurnOutcomeSchema**: `ZodDiscriminatedUnion`\<`"type"`, \[`ZodObject`\<`object` & `object`, `"strict"`, `ZodTypeAny`, \{ `metadata?`: [`JsonObject`](#jsonobject); `output`: [`JsonValue`](#jsonvalue); `type`: `"complete"`; \}, \{ `metadata?`: [`JsonObject`](#jsonobject); `output`: [`JsonValue`](#jsonvalue); `type`: `"complete"`; \}\>, `ZodObject`\<`object` & `object`, `"strict"`, `ZodTypeAny`, \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](#jsonobject); `type`: `"fail"`; \}, \{ `error`: \{ `code`: `string`; `details?`: [`JsonObject`](#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](#jsonobject); `type`: `"fail"`; \}\>, `ZodObject`\<`object` & `object`, `"strict"`, `ZodTypeAny`, \{ `metadata?`: [`JsonObject`](#jsonobject); `reason`: `string`; `type`: `"escalate"`; \}, \{ `metadata?`: [`JsonObject`](#jsonobject); `reason`: `string`; `type`: `"escalate"`; \}\>\]\>

Defined in: [runtime.ts:43](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/runtime.ts#L43)

The only terminal outcomes a runtime plugin may return for one bounded turn.

`escalate` is a third terminal state rather than a flavour of `fail`. A turn
that stopped because it needed authority it does not hold is a different
event from one that was refused and from one that erred, and collapsing it
into either would make "the agent asked for help" unrecoverable from the
record. It grants nothing: SharedOS records the request, names the reviewer
the host would route it to, and stops.

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

### SharedOSToolCatalogSchema

> `const` **SharedOSToolCatalogSchema**: `ZodEffects`\<`ZodObject`\<\{ `catalogHash`: `ZodString`; `executionId`: `ZodString`; `tools`: `ZodArray`\<`ZodObject`\<\{ `annotations`: `ZodOptional`\<`ZodObject`\<\{ `destructiveHint`: `ZodOptional`\<`ZodBoolean`>\>; `idempotentHint`: `ZodOptional`\<`ZodBoolean`>\>; `openWorldHint`: `ZodOptional`\<`ZodBoolean`>\>; `readOnlyHint`: `ZodOptional`\<`ZodBoolean`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `destructiveHint?`: `boolean`; `idempotentHint?`: `boolean`; `openWorldHint?`: `boolean`; `readOnlyHint?`: `boolean`; \}, \{ `destructiveHint?`: `boolean`; `idempotentHint?`: `boolean`; `openWorldHint?`: `boolean`; `readOnlyHint?`: `boolean`; \}\>\>; `description`: `ZodString`; `inputSchema`: `ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>\>; `metadata`: `ZodOptional`\<`ZodObject`\<\{ `namespace`: `ZodOptional`\<`ZodString`>\>; `source`: `ZodOptional`\<`ZodString`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `namespace?`: `string`; `source?`: `string`; \}, \{ `namespace?`: `string`; `source?`: `string`; \}\>\>; `name`: `ZodString`; `outputSchema`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; \}, `"strict"`, `ZodTypeAny`, \{ `annotations?`: \{ `destructiveHint?`: `boolean`; `idempotentHint?`: `boolean`; `openWorldHint?`: `boolean`; `readOnlyHint?`: `boolean`; \}; `description`: `string`; `inputSchema`: [`JsonObject`](#jsonobject); `metadata?`: \{ `namespace?`: `string`; `source?`: `string`; \}; `name`: `string`; `outputSchema?`: [`JsonObject`](#jsonobject); \}, \{ `annotations?`: \{ `destructiveHint?`: `boolean`; `idempotentHint?`: `boolean`; `openWorldHint?`: `boolean`; `readOnlyHint?`: `boolean`; \}; `description`: `string`; `inputSchema`: [`JsonObject`](#jsonobject); `metadata?`: \{ `namespace?`: `string`; `source?`: `string`; \}; `name`: `string`; `outputSchema?`: [`JsonObject`](#jsonobject); \}\>, `"many"`>\>; `version`: `ZodLiteral`\<`"1"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `catalogHash`: `string`; `executionId`: `string`; `tools`: `object`[]; `version`: `"1"`; \}, \{ `catalogHash`: `string`; `executionId`: `string`; `tools`: `object`[]; `version`: `"1"`; \}\>, \{ `catalogHash`: `string`; `executionId`: `string`; `tools`: `object`[]; `version`: `"1"`; \}, \{ `catalogHash`: `string`; `executionId`: `string`; `tools`: `object`[]; `version`: `"1"`; \}\>

Defined in: [tool.ts:211](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L211)

The effective, permission-filtered catalogue for exactly one turn.

`catalogHash` covers the tools and nothing else, so two harnesses that were
handed the same semantic tool set produce the same hash even though their
`executionId`s, transports, and harness-side aliases differ. That is the whole
point of carrying it: an experiment can then prove the harnesses were compared
on equal terms rather than assuming it.

---

### TimestampSchema

> `const` **TimestampSchema**: `ZodString`

Defined in: [common.ts:12](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/common.ts#L12)

An RFC 3339 timestamp, represented as a string to remain JSON-safe.

---

### ToolAnnotationsSchema

> `const` **ToolAnnotationsSchema**: `ZodObject`\<\{ `destructive`: `ZodOptional`\<`ZodBoolean`>\>; `idempotent`: `ZodOptional`\<`ZodBoolean`>\>; `readOnly`: `ZodOptional`\<`ZodBoolean`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `destructive?`: `boolean`; `idempotent?`: `boolean`; `readOnly?`: `boolean`; \}, \{ `destructive?`: `boolean`; `idempotent?`: `boolean`; `readOnly?`: `boolean`; \}\>

Defined in: [tool.ts:100](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L100)

---

### ToolCallSchema

> `const` **ToolCallSchema**: `ZodObject`\<\{ `arguments`: `ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>\>; `id`: `ZodString`; `requestedAt`: `ZodString`; `tool`: `ZodString`; `traceId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `arguments`: [`JsonObject`](#jsonobject); `id`: `string`; `requestedAt`: `string`; `tool`: `string`; `traceId`: `string`; \}, \{ `arguments`: [`JsonObject`](#jsonobject); `id`: `string`; `requestedAt`: `string`; `tool`: `string`; `traceId`: `string`; \}\>

Defined in: [tool.ts:350](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L350)

---

### ToolClassSchema

> `const` **ToolClassSchema**: `ZodEnum`\<\[`"managed"`, `"harness_local"`, `"external_direct"`\]\>

Defined in: [tool.ts:252](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L252)

How a tool reached the model, and therefore whether SharedOS authorized it.

- `managed`: published by SharedOS and authorized on every call.
- `harness_local`: the harness's own tool -- a patch tool, a bounded shell.
  SharedOS never sees the call.
- `external_direct`: an MCP server the harness was configured with
  independently. SharedOS never sees the call.

Only the managed class is a SharedOS claim. The other two are declared so a
result can be read for what it is: an unclassified run cannot distinguish
"the kernel refused every violation" from "the harness had a shell".

---

### ToolDefinitionSchema

> `const` **ToolDefinitionSchema**: `ZodEffects`\<`ZodObject`\<\{ `annotations`: `ZodOptional`\<`ZodObject`\<\{ `destructive`: `ZodOptional`\<`ZodBoolean`>\>; `idempotent`: `ZodOptional`\<`ZodBoolean`>\>; `readOnly`: `ZodOptional`\<`ZodBoolean`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `destructive?`: `boolean`; `idempotent?`: `boolean`; `readOnly?`: `boolean`; \}, \{ `destructive?`: `boolean`; `idempotent?`: `boolean`; `readOnly?`: `boolean`; \}\>\>; `description`: `ZodString`; `inputSchema`: `ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>\>; `metadata`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `name`: `ZodString`; `namespace`: `ZodString`; `outputSchema`: `ZodOptional`\<`ZodType`\<[`JsonObject`](#jsonobject), `ZodTypeDef`, [`JsonObject`](#jsonobject)>>\>\>; `readWrite`: `ZodEnum`\<\[`"read"`, `"write"`\]\>; `requiredCapability`: `ZodObject`\<\{ `action`: `ZodString`; `resource`: `ZodObject`\<\{ `namespace`: `ZodString`; `owner`: `ZodOptional`\<`ZodDiscriminatedUnion`\<`"kind"`, \[`ZodObject`\<..., ..., ..., ..., ...\>, `ZodObject`\<..., ..., ..., ..., ...\>, `ZodObject`\<..., ..., ..., ..., ...\>, `ZodObject`\<..., ..., ..., ..., ...\>\]\>\>; `path`: `ZodArray`\<`ZodString`, `"many"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}, \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}\>; \}, `"strict"`, `ZodTypeAny`, \{ `action`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; \}, \{ `action`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; \}\>; `source`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `annotations?`: \{ `destructive?`: `boolean`; `idempotent?`: `boolean`; `readOnly?`: `boolean`; \}; `description`: `string`; `inputSchema`: [`JsonObject`](#jsonobject); `metadata?`: [`JsonObject`](#jsonobject); `name`: `string`; `namespace`: `string`; `outputSchema?`: [`JsonObject`](#jsonobject); `readWrite`: `"read"` \| `"write"`; `requiredCapability`: \{ `action`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; \}; `source`: `string`; \}, \{ `annotations?`: \{ `destructive?`: `boolean`; `idempotent?`: `boolean`; `readOnly?`: `boolean`; \}; `description`: `string`; `inputSchema`: [`JsonObject`](#jsonobject); `metadata?`: [`JsonObject`](#jsonobject); `name`: `string`; `namespace`: `string`; `outputSchema?`: [`JsonObject`](#jsonobject); `readWrite`: `"read"` \| `"write"`; `requiredCapability`: \{ `action`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; \}; `source`: `string`; \}\>, \{ `annotations?`: \{ `destructive?`: `boolean`; `idempotent?`: `boolean`; `readOnly?`: `boolean`; \}; `description`: `string`; `inputSchema`: [`JsonObject`](#jsonobject); `metadata?`: [`JsonObject`](#jsonobject); `name`: `string`; `namespace`: `string`; `outputSchema?`: [`JsonObject`](#jsonobject); `readWrite`: `"read"` \| `"write"`; `requiredCapability`: \{ `action`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; \}; `source`: `string`; \}, \{ `annotations?`: \{ `destructive?`: `boolean`; `idempotent?`: `boolean`; `readOnly?`: `boolean`; \}; `description`: `string`; `inputSchema`: [`JsonObject`](#jsonobject); `metadata?`: [`JsonObject`](#jsonobject); `name`: `string`; `namespace`: `string`; `outputSchema?`: [`JsonObject`](#jsonobject); `readWrite`: `"read"` \| `"write"`; `requiredCapability`: \{ `action`: `string`; `resource`: \{ `namespace`: `string`; `owner?`: \{ `kind`: `"human"`; `userId`: `string`; \} \| \{ `agentId`: `string`; `kind`: `"agent"`; \} \| \{ `conversationId`: `string`; `kind`: `"group"`; \} \| \{ `kind`: `"service"`; `serviceId`: `string`; \}; `path`: `string`[]; \}; \}; `source`: `string`; \}\>

Defined in: [tool.ts:111](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L111)

A JSON-Schema-described tool bound to one permission requirement.

---

### ToolNameSchema

> `const` **ToolNameSchema**: `ZodString`

Defined in: [tool.ts:28](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L28)

A canonical SharedOS tool identity.

Deliberately narrower than [IdentifierSchema](#identifierschema). A tool name is not an
opaque host identifier: it is published to external harnesses as the raw MCP
`Tool.name`, so the character set has to be one every harness and transport
carries unchanged. Keeping the two schemas distinct makes the invariant

    ToolDefinition.name = SharedOS canonical tool ID = raw MCP Tool.name

enforceable at registration rather than merely documented.

Names are globally unique across namespaces, so a catalogue that brokers two
providers exposing the same underlying operation still publishes two distinct
names -- `github.search` and `notion.search`, never `search` twice.

A harness is free to rewrite this into an alias of its own
(`mcp__sharedos__files_search`). That alias is presentation, never identity,
and never participates in authorization.

---

### ToolNamespaceCatalogSchema

> `const` **ToolNamespaceCatalogSchema**: `ZodEffects`\<`ZodObject`\<\{ `namespaces`: `ZodArray`\<`ZodEffects`\<`ZodObject`\<\{ `enabled`: `ZodBoolean`; `namespace`: `ZodString`; `sources`: `ZodArray`\<`ZodString`, `"many"`>\>; `toolCount`: `ZodNumber`; \}, `"strict"`, `ZodTypeAny`, \{ `enabled`: `boolean`; `namespace`: `string`; `sources`: `string`[]; `toolCount`: `number`; \}, \{ `enabled`: `boolean`; `namespace`: `string`; `sources`: `string`[]; `toolCount`: `number`; \}\>, \{ `enabled`: `boolean`; `namespace`: `string`; `sources`: `string`[]; `toolCount`: `number`; \}, \{ `enabled`: `boolean`; `namespace`: `string`; `sources`: `string`[]; `toolCount`: `number`; \}\>, `"many"`>\>; `summary`: `ZodObject`\<\{ `disabled`: `ZodNumber`; `enabled`: `ZodNumber`; `total`: `ZodNumber`; \}, `"strict"`, `ZodTypeAny`, \{ `disabled`: `number`; `enabled`: `number`; `total`: `number`; \}, \{ `disabled`: `number`; `enabled`: `number`; `total`: `number`; \}\>; \}, `"strict"`, `ZodTypeAny`, \{ `namespaces`: `object`[]; `summary`: \{ `disabled`: `number`; `enabled`: `number`; `total`: `number`; \}; \}, \{ `namespaces`: `object`[]; `summary`: \{ `disabled`: `number`; `enabled`: `number`; `total`: `number`; \}; \}\>, \{ `namespaces`: `object`[]; `summary`: \{ `disabled`: `number`; `enabled`: `number`; `total`: `number`; \}; \}, \{ `namespaces`: `object`[]; `summary`: \{ `disabled`: `number`; `enabled`: `number`; `total`: `number`; \}; \}\>

Defined in: [tool.ts:312](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L312)

---

### ToolNamespaceDescriptorSchema

> `const` **ToolNamespaceDescriptorSchema**: `ZodEffects`\<`ZodObject`\<\{ `enabled`: `ZodBoolean`; `namespace`: `ZodString`; `sources`: `ZodArray`\<`ZodString`, `"many"`>\>; `toolCount`: `ZodNumber`; \}, `"strict"`, `ZodTypeAny`, \{ `enabled`: `boolean`; `namespace`: `string`; `sources`: `string`[]; `toolCount`: `number`; \}, \{ `enabled`: `boolean`; `namespace`: `string`; `sources`: `string`[]; `toolCount`: `number`; \}\>, \{ `enabled`: `boolean`; `namespace`: `string`; `sources`: `string`[]; `toolCount`: `number`; \}, \{ `enabled`: `boolean`; `namespace`: `string`; `sources`: `string`[]; `toolCount`: `number`; \}\>

Defined in: [tool.ts:293](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L293)

---

### ToolNamespaceSchema

> `const` **ToolNamespaceSchema**: `ZodString` = `IdentifierSchema`

Defined in: [tool.ts:38](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L38)

A logical group of tools that a trusted host may enable for one access context.

---

### ToolNamespaceUpdateSchema

> `const` **ToolNamespaceUpdateSchema**: `ZodEffects`\<`ZodObject`\<\{ `disable`: `ZodOptional`\<`ZodEffects`\<`ZodArray`\<`ZodString`, `"many"`>\>, `string`[], `string`[]\>\>; `enable`: `ZodOptional`\<`ZodEffects`\<`ZodArray`\<`ZodString`, `"many"`>\>, `string`[], `string`[]\>\>; \}, `"strict"`, `ZodTypeAny`, \{ `disable?`: `string`[]; `enable?`: `string`[]; \}, \{ `disable?`: `string`[]; `enable?`: `string`[]; \}\>, \{ `disable?`: `string`[]; `enable?`: `string`[]; \}, \{ `disable?`: `string`[]; `enable?`: `string`[]; \}\>

Defined in: [tool.ts:71](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L71)

An idempotent patch to a host-owned tool namespace selection.

The host applies this atomically and returns the authoritative effective
selection after product policy ceilings have been enforced.

---

### ToolPolicySchema

> `const` **ToolPolicySchema**: `ZodEffects`\<`ZodObject`\<\{ `externalDirect`: `ZodArray`\<`ZodString`, `"many"`>\>; `harnessLocal`: `ZodArray`\<`ZodString`, `"many"`>\>; `managedMcp`: `ZodArray`\<`ZodString`, `"many"`>\>; `mode`: `ZodEnum`\<\[`"strict"`, `"hybrid"`\]\>; \}, `"strict"`, `ZodTypeAny`, \{ `externalDirect`: `string`[]; `harnessLocal`: `string`[]; `managedMcp`: `string`[]; `mode`: `"strict"` \| `"hybrid"`; \}, \{ `externalDirect`: `string`[]; `harnessLocal`: `string`[]; `managedMcp`: `string`[]; `mode`: `"strict"` \| `"hybrid"`; \}\>, \{ `externalDirect`: `string`[]; `harnessLocal`: `string`[]; `managedMcp`: `string`[]; `mode`: `"strict"` \| `"hybrid"`; \}, \{ `externalDirect`: `string`[]; `harnessLocal`: `string`[]; `managedMcp`: `string`[]; `mode`: `"strict"` \| `"hybrid"`; \}\>

Defined in: [tool.ts:267](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L267)

The declared tool surface of one experiment or runtime configuration.

`strict` asserts that every effect available to the harness went through
SharedOS. It is checked, not just declared: a strict policy that also lists
`externalDirect` entries is rejected here rather than producing a run whose
headline claim its own manifest contradicts.

`harnessLocal` is still permitted under `strict`, because a harness with no
local tools at all cannot always be produced -- but the entries have to be
named, so a reader can see exactly which effects were outside the kernel.

---

### ToolReadWriteSchema

> `const` **ToolReadWriteSchema**: `ZodEnum`\<\[`"read"`, `"write"`\]\>

Defined in: [tool.ts:49](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L49)

A conservative catalog classification. Capabilities remain the authorization source.

---

### ToolResultSchema

> `const` **ToolResultSchema**: `ZodDiscriminatedUnion`\<`"status"`, \[`ZodObject`\<`object` & `object`, `"strict"`, `ZodTypeAny`, \{ `callId`: `string`; `completedAt`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `output`: [`JsonValue`](#jsonvalue); `status`: `"succeeded"`; `tool`: `string`; \}, \{ `callId`: `string`; `completedAt`: `string`; `metadata?`: [`JsonObject`](#jsonobject); `output`: [`JsonValue`](#jsonvalue); `status`: `"succeeded"`; `tool`: `string`; \}\>, `ZodObject`\<`object` & `object`, `"strict"`, `ZodTypeAny`, \{ `callId`: `string`; `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](#jsonobject); `status`: `"denied"`; `tool`: `string`; \}, \{ `callId`: `string`; `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](#jsonobject); `status`: `"denied"`; `tool`: `string`; \}\>, `ZodObject`\<`object` & `object`, `"strict"`, `ZodTypeAny`, \{ `callId`: `string`; `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](#jsonobject); `status`: `"failed"`; `tool`: `string`; \}, \{ `callId`: `string`; `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](#jsonobject); `status`: `"failed"`; `tool`: `string`; \}\>\]\>

Defined in: [tool.ts:369](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L369)

---

### ToolSourceSchema

> `const` **ToolSourceSchema**: `ZodString` = `IdentifierSchema`

Defined in: [tool.ts:45](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/tool.ts#L45)

The host-defined origin of a tool, for example `sharedos`, `native`, `mcp`,
or `composio`. This is catalog metadata, never proof of authority.

## Functions

### contextCapsulePreview()

> **contextCapsulePreview**(`value`): \{ `items`: `object`[]; `limitations`: `string`[]; `summary`: `string`; \} \| `undefined`

Defined in: [context-capsule.ts:261](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/context-capsule.ts#L261)

Project a capsule down to what a reviewer may see before approving.

Deliberately tolerant of malformed input: a preview is rendered for a request
that has not been accepted yet, so an unparseable capsule must degrade to a
partial preview rather than throw inside an approval surface. It never copies
item content — that is the one invariant this function has.

#### Parameters

| Parameter | Type      |
| --------- | --------- |
| `value`   | `unknown` |

#### Returns

\{ `items`: `object`[]; `limitations`: `string`[]; `summary`: `string`; \} \| `undefined`

---

### validateContextCapsule()

> **validateContextCapsule**(`value`, `objective`): `Promise`\<[`ContextCapsuleValidation`](#contextcapsulevalidation)>\>

Defined in: [context-capsule.ts:153](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/contracts/src/context-capsule.ts#L153)

Validate an untrusted capsule against the objective it claims to serve.

Every rejection returns its own code rather than one generic parse failure:
the caller reports these to the sender, and "your capsule is invalid" is not
actionable while "context_hash_mismatch" is.

The objective is checked, not just carried. A capsule assembled for one task
must not be replayed against another, because the receiving owner approved
the disclosure for that task.

Async because content integrity is verified with Web Crypto: SharedOS depends
on no Node built-in, and accepting an injected hash function would make the
integrity property optional for the caller who most wants to skip it.

#### Parameters

| Parameter   | Type      |
| ----------- | --------- |
| `value`     | `unknown` |
| `objective` | `string`  |

#### Returns

`Promise`\<[`ContextCapsuleValidation`](#contextcapsulevalidation)\>
