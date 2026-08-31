import { describe, expect, it } from "vitest";

import type { Span } from "@aicoo/sharedos-core";

import {
  attributable,
  benchAttempts,
  benchMoves,
  renderSystemsCostReport,
  runSystemsCostBench,
  summarize,
  timerOverhead,
} from "./bench.js";
import { CANONICAL_CONFORMANCE_CASES } from "./suite.js";

function span(name: string, durationMs: number, callId?: string): Span {
  return { name, durationMs, attributes: callId === undefined ? {} : { callId } };
}

describe("summarize", () => {
  it("reports a percentile that was actually observed", () => {
    const distribution = summarize([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    expect(distribution.n).toBe(10);
    expect(distribution.p50Ms).toBe(5);
    // Nearest-rank, so the p95 of ten observations is the tenth, not a number
    // interpolated into the gap between the ninth and it.
    expect(distribution.p95Ms).toBe(10);
    expect(distribution.minMs).toBe(1);
    expect(distribution.maxMs).toBe(10);
  });

  it("derives throughput from the mean, not the median", () => {
    // A stream of these takes 1 ms + 1 ms + 100 ms, so it is not 1000/second.
    const distribution = summarize([1, 1, 100]);

    expect(distribution.p50Ms).toBe(1);
    expect(Math.round(distribution.opsPerSecond)).toBe(29);
  });

  it("refuses to describe an empty sample", () => {
    expect(() => summarize([])).toThrow(TypeError);
  });
});

describe("attributable", () => {
  it("subtracts foreign work by call id", () => {
    const spans = [
      span("outer", 10, "call-1"),
      span("foreign", 4, "call-1"),
      span("outer", 6, "call-2"),
      span("foreign", 1, "call-2"),
    ];

    expect(attributable(spans, "outer", "foreign")).toEqual([6, 5]);
  });

  it("keeps a span whole when the foreign work never happened", () => {
    // A call refused before the provider has nothing to subtract, and the whole
    // span is SharedOS's.
    const spans = [span("outer", 3, "call-1"), span("foreign", 9, "call-other")];

    expect(attributable(spans, "outer", "foreign")).toEqual([3]);
  });

  it("does not let a slow provider produce a negative cost", () => {
    const spans = [span("outer", 1, "call-1"), span("foreign", 5, "call-1")];

    expect(attributable(spans, "outer", "foreign")).toEqual([0]);
  });

  it("attributes each call separately when several are in flight", () => {
    // The correlation is a join, not a stack, which is the property that keeps
    // it correct under concurrency.
    const spans = [
      span("foreign", 2, "call-2"),
      span("outer", 8, "call-1"),
      span("foreign", 3, "call-1"),
      span("outer", 8, "call-2"),
    ];

    expect(attributable(spans, "outer", "foreign")).toEqual([5, 6]);
  });
});

describe("the bench workload", () => {
  it("is the declared baseline case set, without the rows that end the turn", () => {
    const moves = benchMoves();
    const ids = new Set(moves.map(({ id }) => id));

    expect(moves.length).toBeGreaterThan(0);
    for (const move of moves) {
      expect(move.terminal).toBeUndefined();
    }
    for (const kase of CANONICAL_CONFORMANCE_CASES) {
      if (kase.notImplemented !== undefined) {
        expect(ids.has(kase.move.id)).toBe(false);
      }
    }
  });

  it("issues both refusals and controls, so the figure is not the cheapest path", () => {
    const roles = new Set(benchAttempts(benchMoves()).map(({ role }) => role));

    expect(roles.has("attack")).toBe(true);
    expect(roles.has("control")).toBe(true);
  });
});

describe("timerOverhead", () => {
  it("reports what taking a measurement costs, rather than assuming it is free", () => {
    const overhead = timerOverhead(256);

    expect(overhead.n).toBe(256);
    expect(overhead.p50Ms).toBeGreaterThanOrEqual(0);
  });
});

describe("runSystemsCostBench", () => {
  it("fills every declared row on both paths, with no model in any span", async () => {
    const report = await runSystemsCostBench({ warmupTurns: 2, measuredTurns: 3 });

    expect(report.measures.map(({ id }) => id)).toEqual([
      "capability-authorization.in-process",
      "capability-authorization.mcp-toolshare",
      "execution-record-write.in-process",
      "governed-view-construction.in-process",
      "governed-view-construction.mcp-toolshare",
      "end-to-end.in-process",
      "end-to-end.mcp-toolshare",
    ]);
    for (const measure of report.measures) {
      expect(measure.latency.n).toBeGreaterThan(0);
      // Structural, from the absence of a model call inside the span.
      expect(measure.tokens).toBe(0);
    }
  }, 120_000);

  it("counts wire bytes only where there is a transport to count them on", async () => {
    const report = await runSystemsCostBench({ warmupTurns: 2, measuredTurns: 3 });

    for (const measure of report.measures) {
      if (measure.path === "in-process") {
        expect(measure.wireBytes).toBeNull();
      }
    }
    const toolshare = report.measures.find(({ id }) => id === "end-to-end.mcp-toolshare");
    expect(toolshare?.wireBytes?.meanBytes).toBeGreaterThan(0);
  }, 120_000);

  it("keeps one authority load per turn, whatever the call count", async () => {
    const report = await runSystemsCostBench({ warmupTurns: 2, measuredTurns: 3 });

    expect(report.structural.authorityLoadsPerTurn).toBe(1);
    expect(report.structural.toolCallsPerTurn).toBeGreaterThan(1);
  }, 120_000);

  it("accounts for a mediated call segment by segment", async () => {
    const report = await runSystemsCostBench({ warmupTurns: 2, measuredTurns: 3 });

    for (const breakdown of report.breakdown) {
      const named = breakdown.segments.reduce(
        (sum, segment) => sum + segment.latency.meanMs * segment.latency.n,
        0,
      );
      const whole = breakdown.whole.meanMs * breakdown.whole.n;
      const remainder = breakdown.remainder.meanMs * breakdown.remainder.n;
      // The segments and the remainder account for the whole span, so the
      // remainder is a subtraction rather than a name for the unmeasured.
      expect(named + remainder).toBeGreaterThan(whole * 0.9);
      expect(named + remainder).toBeLessThan(whole * 1.1);
    }
  }, 120_000);

  it("renders a document that states its n and its basis", async () => {
    const report = await runSystemsCostBench({ warmupTurns: 2, measuredTurns: 3 });
    const markdown = renderSystemsCostReport(report);

    expect(markdown).toContain("# Systems cost");
    expect(markdown).toContain("| Component | Path | p50 | p95 |");
    expect(markdown).toContain("Std's `—` is the absence of a translation layer");
    for (const measure of report.measures) {
      expect(markdown).toContain(measure.basis);
    }
  }, 120_000);
});
