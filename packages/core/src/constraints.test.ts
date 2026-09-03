import { describe, expect, it } from "vitest";

import {
  constraintEnvelopeViolation,
  constraintsAreWithin,
  tightestConstraints,
} from "./constraints.js";

const JAN = "2026-01-01T00:00:00.000Z";
const FEB = "2026-02-01T00:00:00.000Z";
const JUN = "2026-06-01T00:00:00.000Z";
const OCT = "2026-10-01T00:00:00.000Z";
const DEC = "2026-12-31T00:00:00.000Z";

describe("tightestConstraints", () => {
  it("takes the earliest expiry, latest start, fewest uses, shallowest depth, and the purpose intersection", () => {
    expect(
      tightestConstraints([
        { expiresAt: DEC, notBefore: JAN, maxUses: 10, delegationDepth: 2, purposes: ["b", "a"] },
        { expiresAt: OCT, notBefore: FEB, maxUses: 3, delegationDepth: 1, purposes: ["a", "c"] },
      ]),
    ).toEqual({ purposes: ["a"], notBefore: FEB, expiresAt: OCT, maxUses: 3, delegationDepth: 1 });
  });

  it("is unbounded over no sets, and skips a bound a set does not name", () => {
    expect(tightestConstraints([])).toEqual({});
    expect(tightestConstraints([{ expiresAt: OCT }, {}, { maxUses: 2 }])).toEqual({
      expiresAt: OCT,
      maxUses: 2,
    });
  });

  it("keeps purposes sorted", () => {
    expect(tightestConstraints([{ purposes: ["c", "a", "b"] }])).toEqual({
      purposes: ["a", "b", "c"],
    });
  });

  it("has no envelope when purposes intersect to nothing", () => {
    expect(tightestConstraints([{ purposes: ["a"] }, { purposes: ["b"] }])).toBeUndefined();
  });

  it("has no envelope when the latest start is past the earliest expiry", () => {
    expect(tightestConstraints([{ expiresAt: FEB }, { notBefore: JUN }])).toBeUndefined();
  });

  it("has no envelope when a bound cannot be read", () => {
    expect(tightestConstraints([{ expiresAt: DEC }, { expiresAt: "soon" }])).toBeUndefined();
    expect(tightestConstraints([{ notBefore: "later" }])).toBeUndefined();
  });
});

describe("constraintEnvelopeViolation", () => {
  it("admits anything under an absent bound", () => {
    expect(
      constraintEnvelopeViolation({ purposes: ["a"], notBefore: JAN, expiresAt: DEC }, {}),
    ).toBeUndefined();
    expect(constraintEnvelopeViolation({}, {})).toBeUndefined();
  });

  it("admits an equal envelope, and a tighter one", () => {
    const outer = { purposes: ["a", "b"], notBefore: JAN, expiresAt: DEC };
    expect(constraintEnvelopeViolation(outer, outer)).toBeUndefined();
    expect(
      constraintEnvelopeViolation({ purposes: ["a"], notBefore: FEB, expiresAt: OCT }, outer),
    ).toBeUndefined();
  });

  it("requires a bound the outer envelope names", () => {
    expect(constraintEnvelopeViolation({}, { purposes: ["a"] })).toBe("purposes");
    expect(constraintEnvelopeViolation({}, { notBefore: JAN })).toBe("notBefore");
    expect(constraintEnvelopeViolation({}, { expiresAt: DEC })).toBe("expiresAt");
  });

  it("names the field that reaches outside, purposes before the window", () => {
    const outer = { purposes: ["a"], notBefore: FEB, expiresAt: OCT };
    expect(
      constraintEnvelopeViolation({ purposes: ["a", "b"], notBefore: JAN, expiresAt: DEC }, outer),
    ).toBe("purposes");
    expect(
      constraintEnvelopeViolation({ purposes: ["a"], notBefore: JAN, expiresAt: DEC }, outer),
    ).toBe("notBefore");
    expect(
      constraintEnvelopeViolation({ purposes: ["a"], notBefore: JUN, expiresAt: DEC }, outer),
    ).toBe("expiresAt");
  });

  it("treats an unreadable timestamp on either side as a violation, even under no bound", () => {
    expect(constraintEnvelopeViolation({ expiresAt: "soon" }, {})).toBe("expiresAt");
    expect(constraintEnvelopeViolation({ notBefore: JAN }, { notBefore: "earlier" })).toBe(
      "notBefore",
    );
    expect(constraintEnvelopeViolation({}, { expiresAt: "soon" })).toBe("expiresAt");
  });

  it("is what constraintsAreWithin answers", () => {
    expect(constraintsAreWithin({ expiresAt: OCT }, { expiresAt: DEC })).toBe(true);
    expect(constraintsAreWithin({ expiresAt: DEC }, { expiresAt: OCT })).toBe(false);
  });
});
