[**SharedOS API v0.1.0-alpha.4**](README.md)

---

[SharedOS API](README.md) / @aicoo/sharedos-debugger

# @aicoo/sharedos-debugger

Diagnose SharedOS authorization denials with actionable next steps.

```typescript
import { diagnoseDenial } from "@aicoo/sharedos";
```

Or install standalone for a lightweight import:

```bash
npm install @aicoo/sharedos-debugger@next
```

SharedOS returns denials like `tool_unavailable` or `no_matching_grant` but
doesn't tell you which gate blocked you or what to do next. The debugger
reads the audit trail and produces a `DenialDiagnosis` naming the gate,
explaining the refusal, and suggesting a fix.

SharedOS is currently an `0.x` prerelease.

## Type Aliases

### DenialGate

> **DenialGate** = `"registration"` \| `"capability_grant"` \| `"product_ceiling"` \| `"infrastructure"` \| `"delegation"` \| `"turn"` \| `"envelope"` \| `"unknown"`

Defined in: [debugger/src/diagnose.ts:8](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/debugger/src/diagnose.ts#L8)

---

## Interfaces

### DenialDiagnosis

Defined in: [debugger/src/diagnose.ts:18](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/debugger/src/diagnose.ts#L18)

#### Properties

| Property                                   | Modifier   | Type                                             | Description                                                           | Defined in                                                                                                          |
| ------------------------------------------ | ---------- | ------------------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| <a id="property-code"></a> `code`          | `readonly` | `string`                                         | The raw refusal code from the ToolResult error.                       | [debugger/src/diagnose.ts:22](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/debugger/src/diagnose.ts#L22) |
| <a id="property-gate"></a> `gate`          | `readonly` | [`DenialGate`](#denialgate)                      | Which of the four gates (plus delegation/envelope) refused this call. | [debugger/src/diagnose.ts:20](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/debugger/src/diagnose.ts#L20) |
| <a id="property-message"></a> `message`    | `readonly` | `string`                                         | Human-readable explanation of what happened.                          | [debugger/src/diagnose.ts:24](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/debugger/src/diagnose.ts#L24) |
| <a id="property-metadata"></a> `metadata?` | `readonly` | [`JsonObject`](sharedos-contracts.md#jsonobject) | Audit metadata if available (rejectedGrants, cause, etc).             | [debugger/src/diagnose.ts:28](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/debugger/src/diagnose.ts#L28) |
| <a id="property-nextstep"></a> `nextStep`  | `readonly` | `string`                                         | Actionable next step to fix the issue.                                | [debugger/src/diagnose.ts:26](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/debugger/src/diagnose.ts#L26) |

---

## Functions

### diagnoseBatch()

> **diagnoseBatch**(`results`, `auditEvents?`): `object`[]

Defined in: [debugger/src/diagnose.ts:366](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/debugger/src/diagnose.ts#L366)

Diagnose a batch of tool results and group by gate.
Useful for the demo: run 4 calls, show 4 different diagnoses.

#### Parameters

| Parameter      | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `results`      | readonly (\{ `callId`: `string`; `completedAt`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `output`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `status`: `"succeeded"`; `tool`: `string`; \} \| \{ `callId`: `string`; `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"denied"`; `tool`: `string`; \} \| \{ `callId`: `string`; `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"failed"`; `tool`: `string`; \})[] |
| `auditEvents?` | readonly [`AuditEvent`](sharedos-core.md#auditevent)[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

#### Returns

`object`[]

---

### diagnoseDenial()

> **diagnoseDenial**(`result`, `auditEvents?`): [`DenialDiagnosis`](#denialdiagnosis)

Defined in: [debugger/src/diagnose.ts:176](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/debugger/src/diagnose.ts#L176)

Diagnose a SharedOS denial and produce a human-readable explanation.

#### Parameters

| Parameter      | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Description                                                                      |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `result`       | \{ `callId`: `string`; `completedAt`: `string`; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `output`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `status`: `"succeeded"`; `tool`: `string`; \} \| \{ `callId`: `string`; `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"denied"`; `tool`: `string`; \} \| \{ `callId`: `string`; `completedAt`: `string`; `error`: \{ `code`: `string`; `details?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `message`: `string`; `retryable?`: `boolean`; \}; `metadata?`: [`JsonObject`](sharedos-contracts.md#jsonobject); `status`: `"failed"`; `tool`: `string`; \} | A ToolResult with status "denied" (or any result; non-denials get a passthrough) |
| `auditEvents?` | readonly [`AuditEvent`](sharedos-core.md#auditevent)[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Optional audit trail for deeper diagnosis (rejectedGrants, cause, etc.)          |

#### Returns

[`DenialDiagnosis`](#denialdiagnosis)

A DenialDiagnosis naming the gate, explaining the refusal, and suggesting a fix
