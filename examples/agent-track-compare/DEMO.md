# Agent Track Record — 3-Minute Demo Script

## Setup

```bash
pnpm --filter @aicoo/sharedos-example-agent-track-compare start:demo
```

## The Story

Two agents. Same repo. One plays nice. One tests the fence.

---

## ACT 1: Two agents, same repo (0:00 — 0:40)

**Narration:**
> "We have two AI agents with access to the same codebase. One stays within its permissions. The other constantly tries to do things it shouldn't."

The terminal shows tool calls happening in real time:

```
  careful-agent:
    files.search   → succeeded
    files.read     → failed
    files.search   → succeeded
    files.read     → failed
    files.search   → succeeded

  probe-agent:
    files.search   → succeeded
    files.delete   → denied
    files.write    → denied
    files.delete   → denied
    files.delete   → denied
    files.write    → denied
    files.delete   → denied
    files.search   → succeeded
```

---

## ACT 2: The Reveal (0:40 — 2:00)

**Narration:**
> "Every one of those decisions was recorded by the kernel. Let's ask it what it saw."

The side-by-side comparison appears:

```
                             careful-agent         probe-agent
  ────────────────────────────────────────────────────────────
  Authorization rate:               100.0%               33.3%
  Edge-probe score:                   0.00                0.33
  Escalation rate:                    0.0%                0.0%
  Total denials:                         0                   4
```

**Narration:**
> "Careful agent: 100% authorization rate, zero edge-probe score. It stays within its grants. Probe agent: 33% authorization rate, constantly hitting denial walls."

Tool breakdown appears:

```
  Tool breakdown (probe-agent):
    files.delete       0% allowed  4 denied
    files.search     100% allowed  0 denied
```

**Narration:**
> "We can see exactly which tools it's targeting. Four delete attempts, all denied."

---

## ACT 3: The Punchline (2:00 — 2:30)

**Narration:**
> "So — do you want to give probe-agent write access to the repo?"

Pause. Let the audience read the output.

**Narration:**
> "The answer is already on screen."

---

## ACT 4: Code (2:30 — 3:00)

**Narration:**
> "And it takes five lines of code to integrate."

```ts
const collector = new TrackRecordCollector(auditSink);
kernel.registerTool(agentTrackRecordTool(collector));
// ... tool calls happen ...
const record = analyzeTrackRecord(collector.getStore(), agentId);
// record.summary.edgeProbeScore → 0.81
```

---

## Key talking points

| Point | What to say |
|-------|-------------|
| **No self-reporting** | Every metric comes from kernel audit events, not the agent |
| **Edge-probe score** | Measures how much an agent tests boundaries (0 = well-behaved, 1 = constant probing) |
| **Tool breakdown** | Shows exactly which tools an agent is targeting |
| **Integration** | 5 lines. Wraps existing AuditSink. Zero overhead. |
| **Live kernel** | This isn't simulated — it's running against a real SharedOS kernel with real grants |

---

## Likely Q&A

**Q: "How does it get the data?"**
> From kernel audit events. The `TrackRecordCollector` wraps the `AuditSink`. Every authorization decision, every tool invocation is recorded by the kernel. We just index it.

**Q: "What if an agent lies about its history?"**
> It can't. Every field is derived from events the kernel wrote. The agent never reports its own behavior.

**Q: "Does it add latency?"**
> Near-zero. The collector is a passthrough sink — it clones the event and adds it to a Map. Analysis is a pure function over that Map.

**Q: "How do you handle large volumes?"**
> Two options: `StreamingTracker` does incremental updates (no recomputation), or the persistent adapter interface lets you plug in SQLite/Postgres for durable storage.

**Q: "Can I customize the edge-probe formula?"**
> Yes. The weights are tunable: 50% denial ratio, 30% retry-after-denial, 20% escalation rate. You can adjust for your threat model.

**Q: "What's the edge-probe score of 0.33 for probe-agent?"**
> It's lower than you might expect because the agent only made 8 tool calls. With more attempts and retries, the score climbs toward 1.0. The signal is denial ratio + retry pattern + escalation rate.
