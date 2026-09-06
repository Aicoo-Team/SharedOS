# Demo Script — "Why Was I Denied?" Debugger

**Time:** 3 min demo + 2 min Q&A

---

## Setup (before presentation)

```bash
cd /home/omkar/Desktop/OS/SharedOS
pnpm build
```

---

## Script

### Opening (30 sec)

> "Every SharedOS host hits the same wall: a tool call returns `tool_unavailable` or `no_matching_grant`. That's it. No explanation. No next step. You stare at the audit trail for 17 minutes wondering what went wrong."

> "We built a debugger that reads the audit trail and tells you exactly which gate blocked you and what to fix."

### The Problem — Before (30 sec)

> "Here's what a denial looks like without the debugger:"

```bash
node examples/denial-debugger/dist/before.js
```

Output:
```
── Without the debugger ──

  result.status: denied
  result.error.code: tool_unavailable
  result.error.message: The requested tool is not available

  ...that's all you get. Good luck figuring out what went wrong.
```

> "That's all you get. `tool_unavailable`. Could mean the tool isn't registered. Could mean the namespace is off. Could mean no grant covers it. Could mean the host ceiling came down. You don't know."

### The Solution — After (90 sec)

> "Now watch what happens when we run the debugger on four identical-looking failures:"

```bash
node examples/denial-debugger/dist/index.js
```

**Walk through each scenario as it appears:**

1. **"Tool not registered"**
   > "Scenario 1: the tool doesn't exist. Gate: registration. Next step: register the tool."

2. **"No grant covers it"**
   > "Scenario 2: the tool exists, but nobody gave you permission. Gate: capability_grant. Next step: issue a grant."

3. **"Host ceiling blocked it"**
   > "Scenario 3: a grant existed, but product policy overrode it. Gate: product_ceiling. Next step: check the host's allowedTools policy."

4. **"Missing wiring"**
   > "Scenario 4: the grant needs maxUses but the store isn't wired. Gate: infrastructure. Next step: wire a GrantUsageStore."

> "Four failures. All look the same. Four completely different diagnoses. Each points at a next step you can actually take."

### The Code (30 sec)

> "It's one function:"

```typescript
import { diagnoseDenial } from "@aicoo/sharedos";

const result = await kernel.invokeTool(ctx, call);
if (result.status === "denied") {
  const diagnosis = diagnoseDenial(result, audit.events);
  console.log(diagnosis.nextStep);
}
```

> "No extra install. It's already in the SDK."

### Closing (10 sec)

> "No more staring at `tool_unavailable` wondering what went wrong. The debugger tells you."

---

## Q&A Prep

**Likely questions:**

1. **"How does it know?"**
   > It reads the audit events. Each denial records metadata — `cause`, `rejectedGrants`, `missingDependency`. The debugger maps that to a gate and a fix.

2. **"Does it work in production?"**
   > Yes. The debugger is pure function — no side effects, no state. It reads audit events you already have.

3. **"What about new denial codes?"**
   > The lookup table is extensible. Unknown codes get a passthrough pointing at `docs/errors.md`.

4. **"Why not just better error messages?"**
   > The kernel can't know what you're trying to do — it only sees the denial. The debugger has the full audit trail and can connect the dots.

5. **"Can I use it in tests?"**
   > Yes. `diagnoseBatch()` lets you run multiple calls and see all diagnoses at once.
