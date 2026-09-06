# @aicoo/sharedos-agent-track

Agent track record derived entirely from kernel-recorded audit events.

```bash
npm install @aicoo/sharedos-agent-track@next
```

An agent's track record is built **entirely from facts the kernel recorded**: how
often it was authorized, how often it escalated, which gate refused it, whether
it probed the edges. Not one line of it is self-reported.

The package provides two integration paths:

1. **Collector** — wrap an `AuditSink` to index events by agent in real time.
2. **Standalone store** — build, serialize, and restore a store independently
   of any sink, from a log file, database, or message queue.

## Quick start

### Standalone store (independent of AuditSink)

```ts
import {
  createTrackRecordStore,
  addEvent,
  addTurnRecord,
  serializeStore,
  deserializeStore,
  analyzeTrackRecord,
} from "@aicoo/sharedos-agent-track";

// Build a store from any source
const store = createTrackRecordStore();
addEvent(store, auditEvent);
addTurnRecord(store, turnRecord);

// Persist to disk
const snapshot = serializeStore(store);
await fs.writeFile("track-records.json", JSON.stringify(snapshot));

// Restore later
const restored = deserializeStore(JSON.parse(await fs.readFile("track-records.json", "utf-8")));
const record = analyzeTrackRecord(restored, "agent-id");
```

### Collector (wraps an AuditSink)

```ts
import { TrackRecordCollector, analyzeTrackRecord } from "@aicoo/sharedos-agent-track";

const collector = new TrackRecordCollector(auditSink);

// Feed events as they happen
await collector.record(auditEvent);
collector.ingestTurnResult("agent-id", executionResult);

// Query
const record = analyzeTrackRecord(collector.getStore(), "agent-id");
```

### As an MCP tool

```ts
import { agentTrackRecordTool } from "@aicoo/sharedos-agent-track";

kernel.registerTool(agentTrackRecordTool(collector));
// Agent can now call: agent.trackRecord({ agentId: "some-agent" })
```

## What it measures

| Metric                | Source                           | Description                                                                            |
| --------------------- | -------------------------------- | -------------------------------------------------------------------------------------- |
| Authorization rate    | `authorization.checked` events   | `allowed / (allowed + denied)` — how often the kernel says yes                         |
| Escalation rate       | Turn records                     | `escalations / totalTurns` — how often the agent asks a human                          |
| Edge-probe score      | Denials + retries + escalations  | 0.0–1.0 score measuring how much the agent tests boundaries                            |
| Gate denial breakdown | `authorization.checked` (denied) | Which gate refused: registration, capability grant, infrastructure, or product ceiling |
| Precedent history     | `authorization.checked` events   | Past authorization decisions: what was tried, what was allowed/denied                  |

### Edge-probing score

The edge-probe score is a weighted combination of three signals:

- **50% denial ratio** — `denials / total authorization attempts`
- **30% retry-after-denial** — repeated attempts at the same tool after denial
- **20% escalation rate** — asking for more authority than granted

A well-behaved agent scores near 0. An agent that constantly probes the fence
scores near 1.

### Gate classification

Denied audit events are classified into four gate categories:

| Gate             | Reason codes                                                                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Registration     | `tool_unavailable`, `namespace_disabled`, `not_registered`                                                                                         |
| Capability grant | `no_matching_grant`, `grant_exhausted`, `issuer`, `subject`, `namespace`, `window`, `purpose`, `verifier`, `capability`, `delegation`, `exhausted` |
| Infrastructure   | `usage_store_unavailable`, `authority_unavailable`, `delegation_chain_*`                                                                           |
| Product ceiling  | `host_policy_denied`, `host_policy_unavailable`                                                                                                    |

## Advanced features

### Time-window aggregation

Compute metrics over rolling time windows to see trends instead of only
point-in-time snapshots.

```ts
import { computeWindowedTrackRecord } from "@aicoo/sharedos-agent-track";

const windowed = computeWindowedTrackRecord(store, "agent-id", "2025-01-01T12:00:00Z");

for (const w of windowed.windows) {
  console.log(`${w.window.label}: auth rate = ${(w.summary.authorizationRate * 100).toFixed(1)}%`);
}
// 1h: auth rate = 95.0%
// 24h: auth rate = 87.3%
// 7d: auth rate = 82.1%
```

### Multi-agent comparison

Compare multiple agents with structured diffs and rankings.

```ts
import { compareTrackRecords } from "@aicoo/sharedos-agent-track";

const comparison = compareTrackRecords(store, ["careful-agent", "probe-agent"]);

// Structured diff
const diff = comparison.pairwise[0];
console.log(`Authorization rate delta: ${diff.metrics.authorizationRate.delta}`);
// Authorization rate delta: 0.818

// Rankings
console.log(`Most trusted: ${comparison.rankings.byAuthorizationRate[0].agentId}`);
console.log(`Highest risk: ${comparison.rankings.byEdgeProbeScore[0].agentId}`);
```

### Threshold alerts

Configure thresholds that flag agents crossing boundaries.

```ts
import { checkAlerts, criticalAlerts } from "@aicoo/sharedos-agent-track";

const alerts = checkAlerts(record, {
  minEdgeProbeScore: 0.5,
  maxAuthorizationRate: 0.6,
  minEscalationRate: 0.3,
  maxTotalDenials: 10,
});

for (const alert of alerts) {
  console.log(`[${alert.severity}] ${alert.message}`);
}
// [warning] Edge-probe score 0.81 exceeds threshold 0.50
// [warning] Authorization rate 18.2% is below threshold 60.0%
// [critical] 9 total denials exceeds threshold 10
```

### Tool-level breakdown

Per-tool authorization rates and denial counts.

```ts
import { computeToolBreakdown } from "@aicoo/sharedos-agent-track";

const breakdown = computeToolBreakdown(store, "agent-id");

for (const tool of breakdown.tools) {
  console.log(`${tool.tool}: ${tool.authorizationRate * 100}% (${tool.denied} denials)`);
}
// files.search: 100% (0 denials)
// files.delete: 0% (3 denials)
```

### Streaming analysis

Incremental metric updates as events arrive, without full recomputation.

```ts
import { StreamingTracker } from "@aicoo/sharedos-agent-track";

const tracker = new StreamingTracker();

// Process events as they arrive
tracker.pushEvent(auditEvent);
tracker.pushTurn(turnRecord);

// Get instant snapshot
const snapshot = tracker.snapshot("agent-id");
console.log(`Edge probe: ${snapshot.edgeProbeScore}`);
```

### Persistent storage adapter

Implement `TrackRecordStoreAdapter` for production storage backends.

```ts
import { InMemoryTrackRecordAdapter, loadStoreFromAdapter } from "@aicoo/sharedos-agent-track";

// Use built-in in-memory adapter (tests / single-process)
const adapter = new InMemoryTrackRecordAdapter();
await adapter.appendEvent("agent-id", event);
await adapter.appendTurn(turnRecord);

// Load into analyzer
const store = await loadStoreFromAdapter(adapter);
const record = analyzeTrackRecord(store, "agent-id");
```

### Export formats

Export to CSV or Prometheus exposition format.

```ts
import { exportCSV, exportPrometheus } from "@aicoo/sharedos-agent-track";

// CSV for spreadsheets
const csv = exportCSV(record);
await fs.writeFile("track-record.csv", csv);

// Prometheus for monitoring
const prom = exportPrometheus(record);
// sharedos_agent_track_authorization_rate{agent_id="agent-a"} 1
// sharedos_agent_track_edge_probe_score{agent_id="agent-a"} 0
```

### Precedent integration

Bridge track records into `@aicoo/sharedos-precedent` for richer auto-decision context.

```ts
import { TrackRecordPrecedentLookup, enrichWithContext } from "@aicoo/sharedos-agent-track";

// Use track record as a PrecedentLookup
const lookup = new TrackRecordPrecedentLookup(store, owner, "ns-1");
const precedents = await lookup.load("ns-1", ["req-1", "req-2"]);

// Enrich auto-decision proposals with track record context
const context = enrichWithContext(store, "agent-id", "files.delete", "delete");
console.log(`Past denials: ${context.pastDenials}, retried: ${context.retriedAfterDenial}`);
```

### Anomaly detection

Detect behavioral deviations using statistical analysis.

```ts
import { detectAnomalies } from "@aicoo/sharedos-agent-track";

const anomalies = detectAnomalies(store, "agent-id", {
  baselineWindow: 50,
  sensitivity: 2.0,
  minEvents: 10,
});

for (const a of anomalies) {
  console.log(`[${a.severity}] ${a.type}: ${a.description}`);
}
// [medium] spike_denials: Denial rate spiked from 10.0% to 45.0%
// [high] unusual_timing: Event timing accelerated from 5.2s to 0.3s average
```

### Reputation protocol

Sign and transfer track records across hosts.

```ts
import {
  createSignedSnapshot,
  verifySignedSnapshot,
  importSignedSnapshot,
} from "@aicoo/sharedos-agent-track";

// Sign a snapshot
const signed = createSignedSnapshot(store, "agent-id", secretKey, "host-1");

// Verify on the receiving end
const valid = verifySignedSnapshot(signed, secretKey); // true

// Import into another host's store
importSignedSnapshot(otherStore, signed, secretKey);
```

## Standalone store API

The store is a plain data structure with no logic. It can be built, serialized,
and restored independently of any kernel or collector.

```ts
import {
  createTrackRecordStore,
  addEvent,
  addTurnRecord,
  serializeStore,
  deserializeStore,
} from "@aicoo/sharedos-agent-track";

// Create
const store = createTrackRecordStore();

// Populate
addEvent(store, event);
addTurnRecord(store, record);

// Serialize (JSON-safe snapshot)
const snapshot = serializeStore(store);
// snapshot = { version: "1", events: { ... }, turns: { ... } }

// Restore
const restored = deserializeStore(snapshot);
```

## The stage moment

Two records side by side: one agent never oversteps, the other constantly tests
the fence.

```
                                 careful-agent           probe-agent
  ----------------------------------------------
  Total turns:                               2                     2
  Tool calls:                                4                     6
  Authorization rate:                   100.0%                 18.2%
  Escalation rate:                        0.0%                100.0%
  Edge-probe score:                       0.00                  0.81

  Gate denials:
    Registration:                            0                     1
    Capability grant:                        0                     8
    Infrastructure:                          0                     0
    Product ceiling:                         0                     0
```

Do you want to give probe-agent write access to the repo?
The answer is already on screen.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Host / AuditSink                                  │
│  (writes every event)                              │
└──────────────┬──────────────────────────────────────┘
               │
               v
┌─────────────────────────────────────────────────────┐
│  TrackRecordCollector (optional)                    │
│  Wraps an AuditSink, indexes events by agent ID    │
│  Also ingests ExecutionResult for turn metrics     │
└──────────────┬──────────────────────────────────────┘
               │
               v
┌─────────────────────────────────────────────────────┐
│  TrackRecordStore                                   │
│  Plain data: Map<agentId, AuditEvent[]>             │
│              Map<agentId, TurnRecord[]>             │
│  Serializable via serializeStore / deserializeStore │
└──────────────┬──────────────────────────────────────┘
               │
               v
┌─────────────────────────────────────────────────────┐
│  analyzeTrackRecord(store, agentId)                 │
│  Pure function — computes AgentTrackRecord          │
│  No side effects, no network calls                  │
└──────────────┬──────────────────────────────────────┘
               │
               v
┌─────────────────────────────────────────────────────┐
│  AgentTrackRecord                                   │
│  { summary, precedents, turns }                     │
└─────────────────────────────────────────────────────┘
```

## Implemented

- [x] Time-window aggregation (1h / 24h / 7d / 30d / all)
- [x] Multi-agent comparison with structured diffs and rankings
- [x] Threshold alerts (configurable severity levels)
- [x] Tool-level breakdown (per-tool stats)
- [x] Persistent storage adapter interface
- [x] Streaming analysis (incremental updates)
- [x] Export formats (CSV + Prometheus)
- [x] Precedent integration (`@aicoo/sharedos-precedent` bridge)
- [x] Anomaly detection (statistical deviation models)
- [x] Agent reputation protocol (cross-host signed snapshots)

## Roadmap

- [ ] Web dashboard for browsing agent history
- [ ] OpenTelemetry trace export

SharedOS is currently an `0.x` prerelease.
