# @aicoo/sharedos-debugger

Diagnose SharedOS authorization denials with actionable next steps.

## Install

The debugger is included in the SDK — no extra install needed:

```typescript
import { diagnoseDenial } from "@aicoo/sharedos";
```

Or install standalone for a lightweight import:

```bash
npm install @aicoo/sharedos-debugger
# or
pnpm add @aicoo/sharedos-debugger
```

## Quick start

```typescript
import { diagnoseDenial } from "@aicoo/sharedos";

const result = await kernel.invokeTool(context, call);

if (result.status === "denied") {
  const diagnosis = diagnoseDenial(result, audit.events);

  console.log(diagnosis.gate);      // "capability_grant"
  console.log(diagnosis.code);      // "no_matching_grant"
  console.log(diagnosis.message);   // "No grant covers this resource and action..."
  console.log(diagnosis.nextStep);  // "Check audit rejectedGrants[]..."
}
```

## What it does

SharedOS returns denials like `tool_unavailable` or `no_matching_grant` but doesn't tell you **which gate** blocked you or **what to do next**. The debugger solves this.

Pass a failed `ToolResult` (and optionally the audit trail) to get:

```typescript
{
  gate: "capability_grant",           // Which gate blocked you
  code: "no_matching_grant",          // The raw error code
  message: "No grant covers this...", // Human-readable explanation
  nextStep: "Check audit rejectedGrants[]...", // What to fix
  metadata: {                         // Optional enrichment from audit
    rejectedGrants: [...],
    summary: "Grant-1 failed: issuer"
  }
}
```

## Four gates

SharedOS denials fall through four gates in order:

| Gate                 | What it checks                                            | Example codes                                    |
| -------------------- | --------------------------------------------------------- | ------------------------------------------------ |
| **Registration**     | Is the tool registered and namespace enabled?             | `tool_unavailable`                               |
| **Capability Grant** | Does a grant cover this actor, resource, action, purpose? | `no_matching_grant`, `grant_exhausted`           |
| **Product Ceiling**  | Does a host ceiling override block the call?              | `host_policy_denied`                             |
| **Infrastructure**   | Did a wiring dependency fail?                             | `usage_store_unavailable`, `authority_unavailable` |

## Batch diagnosis

Diagnose multiple results at once:

```typescript
import { diagnoseBatch } from "@aicoo/sharedos-debugger";

const batch = diagnoseBatch([result1, result2, result3], audit.events);
for (const { result, diagnosis } of batch) {
  console.log(`${result.tool}: ${diagnosis.gate} → ${diagnosis.code}`);
}
```

## Audit enrichment

Pass audit events for deeper diagnosis:

```typescript
const audit = new InMemoryAuditSink();
// ... run your kernel ...
const diagnosis = diagnoseDenial(result, audit.events);

// Enrichment varies by code:
// - tool_unavailable:  metadata.cause (not_registered, namespace_disabled, etc.)
// - no_matching_grant: metadata.rejectedGrants[], metadata.grantsResolved
// - host_policy_denied: metadata.overriddenGrantId
// - infrastructure:   metadata.failClosed, metadata.missingDependency
```

## Lookup table

| Error code                    | Gate             | Fix                                                                     |
| ----------------------------- | ---------------- | ----------------------------------------------------------------------- |
| `tool_unavailable`            | Registration     | Check `metadata.cause`: register tool, enable namespace, or issue grant |
| `no_matching_grant`           | Capability Grant | Walk the 9-item checklist; issue a new grant                            |
| `grant_exhausted`             | Capability Grant | Issue a new grant (spent budgets are not resettable)                    |
| `trace_mismatch`              | Capability Grant | Ensure call.traceId matches AccessContext.traceId                       |
| `host_policy_denied`          | Product Ceiling  | Check which grant was overridden and why                                |
| `usage_store_unavailable`     | Infrastructure   | Wire a GrantUsageStore                                                  |
| `authority_unavailable`       | Infrastructure   | Check GrantSource implementation                                        |
| `delegation_chain_unverified` | Infrastructure   | Wire a DelegationChainResolver                                          |
| `host_policy_unavailable`     | Infrastructure   | Check HostCeiling implementation                                        |
| `delegation_chain_invalid`    | Delegation       | Check which link failed and fix the parent grant                        |

## API

### `diagnoseDenial(result, auditEvents?)`

Returns a `DenialDiagnosis` for a single ToolResult.

### `diagnoseBatch(results, auditEvents?)`

Returns `Array<{ result: ToolResult; diagnosis: DenialDiagnosis }>` for multiple results.

### Types

```typescript
type DenialGate =
  | "registration"
  | "capability_grant"
  | "product_ceiling"
  | "infrastructure"
  | "delegation"
  | "turn"
  | "envelope"
  | "unknown";

interface DenialDiagnosis {
  gate: DenialGate;
  code: string;
  message: string;
  nextStep: string;
  metadata?: JsonObject;
}
```

## Running tests

```bash
pnpm vitest run --reporter=verbose
```

## Demo

See `examples/denial-debugger/` for a full working demo that diagnoses four different denial scenarios:

```bash
pnpm example:denial-debugger
```
