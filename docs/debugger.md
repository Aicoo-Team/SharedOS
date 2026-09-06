# "Why was I denied?" Debugger

A diagnostic tool that explains SharedOS denials and tells you exactly what to fix.

## What it does

SharedOS returns denials like `tool_unavailable` or `no_matching_grant` but doesn't tell you **which gate** blocked you or **what to do next**. The debugger solves this.

**Input:** A failed ToolResult + optional audit events

**Output:**

```typescript
{
  gate: "capability_grant",           // Which gate blocked you
  code: "no_matching_grant",          // The error code
  message: "No grant covers this...", // Human-readable explanation
  nextStep: "Check audit rejectedGrants[]...", // What to do next
  metadata: {                         // Optional enrichment
    rejectedGrants: [...],
    summary: "Grant-1 failed: issuer"
  }
}
```

## Four gates

SharedOS denials fall through four gates in order:

| Gate                 | What it checks                                            | Example codes                                                                     |
| -------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **Registration**     | Is the tool registered and namespace enabled?             | `tool_unavailable`                                                                |
| **Capability Grant** | Does a grant cover this actor, resource, action, purpose? | `no_matching_grant`, `grant_exhausted`, `trace_mismatch`                          |
| **Product Ceiling**  | Does a host ceiling override block the call?              | `host_policy_denied`                                                              |
| **Infrastructure**   | Did a wiring dependency fail?                             | `usage_store_unavailable`, `authority_unavailable`, `delegation_chain_unverified` |

## Files

| File                                    | Purpose                                                |
| --------------------------------------- | ------------------------------------------------------ |
| `packages/testkit/src/diagnose.ts`      | Core diagnoser: `diagnoseDenial()` + `diagnoseBatch()` |
| `packages/testkit/src/diagnose.test.ts` | 25 tests                                               |
| `packages/testkit/src/index.ts`         | Exports for diagnose module                            |
| `examples/denial-debugger/src/index.ts` | Demo showing four gates                                |
| `docs/errors.md`                        | Quick diagnosis lookup table                           |

## Usage

```typescript
import { diagnoseDenial } from "@aicoo/sharedos-testkit";

const result = await kernel.invokeTool(ctx, call);
if (result.status === "denied") {
  const diagnosis = diagnoseDenial(result, audit.events);
  console.log(diagnosis.gate); // "capability_grant"
  console.log(diagnosis.nextStep); // "Check audit rejectedGrants[]..."
}
```

## Lookup table

| Error code                    | Gate             | Fix                                                                     |
| ----------------------------- | ---------------- | ----------------------------------------------------------------------- |
| `tool_unavailable`            | Registration     | Check `metadata.cause`: register tool, enable namespace, or issue grant |
| `no_matching_grant`           | Capability Grant | Walk the 9-item checklist; issue a new grant                            |
| `grant_exhausted`             | Capability Grant | Wire GrantUsageStore or issue a new grant                               |
| `trace_mismatch`              | Capability Grant | Ensure actor matches grant subject                                      |
| `host_policy_denied`          | Product Ceiling  | Check which grant was overridden and why                                |
| `usage_store_unavailable`     | Infrastructure   | Wire a GrantUsageStore                                                  |
| `authority_unavailable`       | Infrastructure   | Check GrantSource implementation                                        |
| `delegation_chain_unverified` | Infrastructure   | Wire a DelegationResolver                                               |
| `host_policy_unavailable`     | Infrastructure   | Check HostCeiling implementation                                        |
| `delegation_chain_invalid`    | Delegation       | Check which link failed and fix the parent grant                        |

## Audit enrichment

The debugger enriches diagnoses from audit events:

- **`cause`** on `tool_unavailable` — distinguishes `not_registered`, `namespace_disabled`, `no_matching_grant`, `host_policy_denied`
- **`rejectedGrants`** on `no_matching_grant` — shows which grants failed and why
- **`grantsResolved`** — count of grants evaluated
- **`failClosed`** on infrastructure denials — confirms fail-closed behavior
- **`missingDependency`** — identifies what wiring is missing
- **`overriddenGrantId`** on `host_policy_denied` — shows which grant was overridden

## Gate override logic

When `tool_unavailable` has audit enrichment, the debugger overrides the gate:

| `metadata.cause`     | Overridden gate  | Why                                |
| -------------------- | ---------------- | ---------------------------------- |
| `not_registered`     | registration     | Tool doesn't exist                 |
| `namespace_disabled` | registration     | Namespace is off                   |
| `no_matching_grant`  | capability_grant | Tool exists but no grant covers it |
| `host_policy_denied` | product_ceiling  | Host ceiling blocked discovery     |

## Demo output

```
$ pnpm example:denial-debugger

=== "Why was I denied?" Debugger ===

--- 1. Tool not registered ---
  Gate:     registration ✓
  Code:     tool_unavailable
  Message:  Tool is not registered, its namespace is disabled, or no grant makes it discoverable.
  Fix:      Check audit metadata.cause: 'not_registered' → registerTool(); 'namespace_disabled' → enable namespace via PUT /v1/tools/namespaces; otherwise → issue a grant covering this tool.
  Metadata: {
  "cause": "not_registered",
  "summary": "Tool is not registered on this kernel.",
  "auditSource": "kernel"
}

--- 2. Namespace disabled ---
  Gate:     registration ✓
  Code:     tool_unavailable
  Message:  Tool is not registered, its namespace is disabled, or no grant makes it discoverable.
  Fix:      Check audit metadata.cause: 'not_registered' → registerTool(); 'namespace_disabled' → enable namespace via PUT /v1/tools/namespaces; otherwise → issue a grant covering this tool.
  Metadata: {
  "cause": "namespace_disabled",
  "summary": "Tool's namespace is disabled for this context.",
  "auditSource": "kernel"
}

--- 3. Path not covered by grant ---
  Gate:     capability_grant ✓
  Code:     no_matching_grant
  Message:  No grant covers this resource and action. Walk the 9-item checklist: authority=issuer, actor=subject, purpose match, window, namespace, path, action, verifier, single-grant rule.
  Fix:      Check audit rejectedGrants[] to see which grant failed and why (issuer/subject/namespace/window/purpose/capability). Issue a new grant covering the exact resource+action.
  Metadata: {
  "auditSource": "kernel"
}

--- 4. Wrong actor (no grants) ---
  Gate:     capability_grant ✓
  Code:     tool_unavailable
  Message:  Tool is not registered, its namespace is disabled, or no grant makes it discoverable.
  Fix:      Check audit metadata.cause: 'not_registered' → registerTool(); 'namespace_disabled' → enable namespace via PUT /v1/tools/namespaces; otherwise → issue a grant covering this tool.
  Metadata: {
  "cause": "no_matching_grant",
  "summary": "Tool exists but no grant makes it discoverable for this context.",
  "auditSource": "kernel"
}

=== Summary: four denials, four gates ===

  ✓ 1. Tool not registered              → gate: registration         code: tool_unavailable
  ✓ 2. Namespace disabled               → gate: registration         code: tool_unavailable
  ✓ 3. Path not covered by grant        → gate: capability_grant     code: no_matching_grant
  ✓ 4. Wrong actor (no grants)          → gate: capability_grant     code: tool_unavailable

=== Audit trail ===

  Total audit events: 10
  authority.resolved succeeded  reason=—
  tool.invoked denied nonexistent.tool reason=tool_unavailable
  authority.resolved succeeded  reason=—
  tool.invoked denied files.search reason=tool_unavailable
  authority.resolved succeeded  reason=—
  authorization.checked denied files reason=no_matching_grant
  tool.invoked denied files.search reason=no_matching_grant
  authority.resolved succeeded  reason=—
  authorization.checked denied files reason=no_matching_grant
  tool.invoked denied files.search reason=tool_unavailable
```

## Tests

25 tests covering:

- Non-denial passthrough
- All 10 denial codes → correct gate
- Audit enrichment for each code
- Gate override for `tool_unavailable` with different causes
- Batch diagnosis
- Empty audit events
- Multiple audit events (uses last denial)

Run: `pnpm test -- --run`
