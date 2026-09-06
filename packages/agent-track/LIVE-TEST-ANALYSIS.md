# Live Integration Test — Limitations Analysis

## What happened

Ran the agent-track package against a real SharedOS kernel with real tool
invocations. Found 4 architectural issues.

## Issue 1: Collector wrapping doesn't work

**Symptom:** Track record store was empty — no events captured.

**Root cause:** `createTestKernel()` creates its own `InMemoryAuditSink`
internally and passes it to the kernel. Wrapping that sink with
`TrackRecordCollector` after creation doesn't help — the kernel still
writes to the original sink.

**Fix:** The collector must BE the kernel's audit sink, not wrap it.
Changed to creating the kernel manually with the collector as the
`audit` option.

```ts
// WRONG — collector never sees events
const { kernel, audit } = createTestKernel({ grants });
const collector = new TrackRecordCollector(audit);

// RIGHT — collector IS the audit sink
const collector = new TrackRecordCollector({ async record() {} });
const kernel = new SharedOSKernel({ ..., audit: collector });
```

## Issue 2: Tool name missing from authorization events

**Symptom:** `tool` field shows as "unknown" in track records. Per-tool
breakdown shows `unknown` as the tool name.

**Root cause:** The kernel's `authorization.checked` audit event records
`resource` and `action` but NOT `tool`. The `tool` field is only set on
`tool.invoked` events.

**Kernel code:**

```ts
// authorization.checked — NO tool field
auditEvent(context, {
  type: "authorization.checked",
  outcome: decision.allowed ? "allowed" : "denied",
  resource: request.resource, // { namespace, path, owner }
  action: request.action, // "search", "delete", etc.
});

// tool.invoked — HAS tool field
auditEvent(context, {
  type: "tool.invoked",
  outcome: result.status,
  tool: call.tool, // "files.search", "files.delete", etc.
});
```

**Fix:** The analyzer must correlate `authorization.checked` events with
`tool.invoked` events to extract the tool name. The `resource.path`
field on authorization events can serve as a proxy when tool.invoked
events aren't available.

## Issue 3: MCP tool needs its own grant

**Symptom:** `agent.trackRecord` not discoverable in the tool catalog.

**Root cause:** Every tool needs a matching grant to be discoverable.
The track record tool declares:

```ts
requiredCapability: {
  resource: { namespace: "agent", path: ["trackRecord"] },
  action: "read",
}
```

Without a grant for `agent / trackRecord / read`, the tool is filtered
out of the catalog.

**Fix:** Hosts must issue a grant for the track record tool. This is
correct behavior — the tool reads sensitive data and should be
permission-gated. Documented in the README.

## Issue 4: Edge-probe score doesn't use tool-level data

**Symptom:** Edge-probe score was 0.25 for probe-agent (should be higher).

**Root cause:** The score computation uses only aggregate denial counts,
not per-tool retry patterns. With only 2 denials across different tools,
the retry signal is weak.

**Fix:** Improve the retry detection to consider cross-tool patterns
(e.g., trying tools in the same namespace after denial).

## Summary

| #   | Issue              | Severity | Fix                                           |
| --- | ------------------ | -------- | --------------------------------------------- |
| 1   | Collector wrapping | Critical | Kernel must use collector as audit sink       |
| 2   | Tool name missing  | High     | Correlate authorization + tool.invoked events |
| 3   | MCP tool grant     | Medium   | Document grant requirement                    |
| 4   | Edge-probe score   | Low      | Improve retry detection                       |
