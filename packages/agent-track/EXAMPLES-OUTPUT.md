# @aicoo/sharedos-agent-track — Example Output Log

**Date:** 2025-01-05
**Package:** `@aicoo/sharedos-agent-track@0.1.0-alpha.4`
**Build:** `pnpm build` clean | **Tests:** 30 passing | **Format:** clean

---

## Stage Moment Demo

The core demo — two agents side by side. The track record makes the answer
visible before a single question is asked.

```bash
pnpm --filter @aicoo/sharedos-example-agent-track-compare start
```

```
  [stored] agent-track-records.json (10.0 KB)
  [restored] 2 agents, 27 events

================================================================
  AGENT TRACK RECORD
================================================================

                                 careful-agent           probe-agent
  ----------------------------------------------
  Total turns:                               2                     2
  Tool calls:                                4                     4
  Authorization rate:                   100.0%                 18.2%
  Escalation rate:                        0.0%                100.0%
  Edge-probe score:                       0.00                  0.81

  Gate denials:
    Registration:                            0                     1
    Capability grant:                        0                     8
    Infrastructure:                          0                     0
    Product ceiling:                         0                     0

  Precedents:
    careful-agent:         5 allowed, 0 denied
    probe-agent:           2 allowed, 9 denied

================================================================

  Do you want to give probe-agent write access to the repo?
  -> The answer is already on screen.
```

---

## Feature Examples

```bash
pnpm --filter @aicoo/sharedos-example-agent-track-compare start:features
```

### 01 — Time-Window Aggregation

Rolling 1h / 24h / 7d / 30d / all windows for trend analysis.

```
  TIME-WINDOW AGGREGATION
  --------------------------------------------------
  1h     auth:  100.0%  probe: 0.00  (1 events)
  24h    auth:   69.2%  probe: 0.00  (26 events)
  7d     auth:   63.0%  probe: 0.00  (200 events)
  30d    auth:   63.0%  probe: 0.00  (200 events)
  all    auth:  100.0%  probe: 0.00  (0 events)
```

### 02 — Multi-Agent Comparison

Structured diffs and rankings across multiple agents.

```
  MULTI-AGENT COMPARISON
  --------------------------------------------------
  Pairwise diff (agent-a vs agent-b):
    Authorization rate: 100% vs 50% (delta: 50%)
    Edge-probe score:  0.00 vs 0.72

  Rankings by authorization rate:
    agent-a      100.0%
    agent-b      50.0%
    agent-c      33.3%

  Rankings by edge-probe score (highest = most risky):
    agent-c      0.77
    agent-b      0.72
    agent-a      0.00
```

### 03 — Threshold Alerts

Configurable thresholds with severity levels.

```
  THRESHOLD ALERTS
  --------------------------------------------------
  [~] Edge-probe score 0.57 exceeds threshold 0.30
  [~] Authorization rate 25.0% is below threshold 50.0%
  [i] Escalation rate 100.0% exceeds threshold 10.0%
  [!] 6 total denials exceeds threshold 5

  Critical alerts: 1
    6 total denials exceeds threshold 3
```

### 04 — Tool-Level Breakdown

Per-tool authorization rates and denial counts.

```
  TOOL-LEVEL BREAKDOWN
  --------------------------------------------------
  Unique tools attempted: 4
  Unique tools denied:    3
  Most attempted tool:    files.search
  Most denied tool:       files.delete

  Per-tool stats:
    files.search     100% allowed  0 denials
    files.read        67% allowed  1 denials
    files.delete       0% allowed  3 denials
    admin.users        0% allowed  1 denials
```

### 05 — Persistent Storage Adapter

`TrackRecordStoreAdapter` interface + signed reputation snapshots.

```
  PERSISTENT STORAGE ADAPTER
  --------------------------------------------------
  Agents stored: agent-1
  Auth rate: 67%
  Snapshot: 1, 1 agents
  After import: agent-1

  REPUTATION PROTOCOL
  --------------------------------------------------
  Signed by: host-1
  Signature: d06676393327715d...
  Valid: true
  Tampered:  false (expected false)
  Imported: true
```

### 06 — Streaming Analysis

Incremental metric updates without full recomputation.

```
  STREAMING ANALYSIS
  --------------------------------------------------
  After event 4:
    good-agent:  auth 100%  probe 0.00  (3A/0D)
    risky-agent: auth 100%  probe 0.00  (1A/0D)

  After event 8:
    good-agent:  auth 100%  probe 0.00  (3A/0D)
    risky-agent: auth 20%  probe 0.40  (1A/4D)

  Tracked agents: good-agent, risky-agent
```

### 07 — Export Formats

CSV and Prometheus exposition format.

```
  EXPORT FORMATS
  --------------------------------------------------
  --- CSV (single agent) ---
  agentId,metric,value
  "agent-a",window_from,"2025-01-01T00:00:00Z"
  "agent-a",window_to,"2025-01-01T00:00:00Z"
  "agent-a",totalTurns,0
  "agent-a",totalToolCalls,0
  "agent-a",authorizationRate,0.6666666666666666
  "agent-a",escalationRate,0
  "agent-a",edgeProbeScore,0.16666666666666666

  --- CSV (comparison) ---
  agentId,totalTurns,totalToolCalls,authorizationRate,escalationRate,edgeProbeScore,...
  "agent-a",0,0,0.6666666666666666,0,0.16666666666666666,0,1,0,0,2,1
  "agent-b",0,0,0.3333333333333333,0,0.3333333333333333,0,2,0,0,1,2

  --- Prometheus ---
  # HELP sharedos_agent_track_authorization_rate Authorization rate (allowed / total)
  # TYPE sharedos_agent_track_authorization_rate gauge
  sharedos_agent_track_authorization_rate{agent_id="agent-a"} 0.6666666666666666
  sharedos_agent_track_authorization_rate{agent_id="agent-b"} 0.3333333333333333
```

### 08 — Precedent Integration

Bridges track records into `@aicoo/sharedos-precedent`.

```
  PRECEDENT INTEGRATION
  --------------------------------------------------
  Loaded 2 precedents for grant IDs g3, g4
    refused: g3 at 2025-01-01T00:00:00Z
    refused: g4 at 2025-01-01T00:00:00Z

  Track record context for files.delete:
    Tool auth rate: 0%
    Past denials:   3
    Past allowances: 0
    Retried:        false
    Edge probe:     0.30
```

### 09 — Anomaly Detection

Statistical deviation detection across four anomaly types.

```
  ANOMALY DETECTION
  --------------------------------------------------
  [!!!] spike_denials
       Denial rate spiked from 8.6% to 100.0%
       current: 1.000  baseline: 0.086  deviation: 0.914
  [!!!] escalation_surge
       Escalation rate surged from 0.0% to 100.0%
       current: 1.000  baseline: 0.000  deviation: 1.000
```

---

## Summary

| #   | Feature                           | Example File               | Status  |
| --- | --------------------------------- | -------------------------- | ------- |
| 01  | Time-window aggregation           | `01-time-windows.ts`       | Passing |
| 02  | Multi-agent comparison            | `02-comparison.ts`         | Passing |
| 03  | Threshold alerts                  | `03-alerts.ts`             | Passing |
| 04  | Tool-level breakdown              | `04-tool-breakdown.ts`     | Passing |
| 05  | Storage adapter + reputation      | `05-storage-reputation.ts` | Passing |
| 06  | Streaming analysis                | `06-streaming.ts`          | Passing |
| 07  | Export formats (CSV + Prometheus) | `07-exports.ts`            | Passing |
| 08  | Precedent integration             | `08-precedent.ts`          | Passing |
| 09  | Anomaly detection                 | `09-anomaly.ts`            | Passing |

All 9 feature examples run successfully. The stage moment demo demonstrates
the core value proposition: two agents side by side, the answer on screen.
