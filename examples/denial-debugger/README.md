# The "why was I denied" debugger

Four failures that look identical — all return `tool_unavailable` — four completely different diagnoses, each pointing at a next step you can actually take.

## What this demonstrates

| Scenario             | Gate                | Root cause                           |
| -------------------- | ------------------- | ------------------------------------ |
| Tool not registered  | 📋 Registration     | Kernel doesn't know the tool exists  |
| No grant covers it   | 🔑 Capability Grant | Tool exists, but no permission       |
| Host ceiling blocked | 🏗️ Product Ceiling  | Grant existed, policy overrode it    |
| Missing wiring       | ⚙️ Infrastructure   | `maxUses` grant without `usageStore` |

## The debugger

`diagnoseDenial(result, auditEvents)` from `@aicoo/sharedos-testkit` reads the audit trail and tells you which gate refused:

- **Registration** — Is the tool registered and its namespace enabled?
- **Capability Grant** — Does a grant cover this actor, resource, action?
- **Ceiling** — Does host policy override the grant?
- **Infrastructure** — Did a wiring dependency fail?

## Run

```bash
pnpm example:denial-debugger
```

## Output

```
── 1. Tool not registered ──
  Gate:      📋 registration
  Detail:    Tool is not registered on this kernel.

── 2. No grant covers it ──
  Gate:      🔑 capability_grant
  Detail:    Tool exists but no grant makes it discoverable for this context.

── 3. Host ceiling blocked it ──
  Gate:      🏗️ product_ceiling
  Detail:    Tool exists but host ceiling policy blocked discovery.

── 4. Missing wiring (usageStore) ──
  Gate:      ⚙️ infrastructure
  Detail:    Tool exists but the grant's usage store is not wired. Fail-closed.
```

Show it to anyone who has written permission code and watch them want it.
