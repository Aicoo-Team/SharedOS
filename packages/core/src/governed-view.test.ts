import { describe, expect, it } from "vitest";

import { projectGovernedView } from "./governed-view.js";

const VIEW = { name: "free-busy", fields: ["freeBusy", "location"] };

describe("projectGovernedView", () => {
  it("keeps only the declared fields of a record", () => {
    const projected = projectGovernedView(VIEW, {
      title: "Board sync",
      attendees: ["alice"],
      location: "Boardroom 2",
      freeBusy: "busy",
    });

    expect(projected).toEqual({ ok: true, output: { freeBusy: "busy", location: "Boardroom 2" } });
  });

  it("serves a declared field that is absent as absent, not as an error", () => {
    // The field list is an allowlist over what exists, not a schema the record
    // must satisfy.
    expect(projectGovernedView(VIEW, { freeBusy: "free" })).toEqual({
      ok: true,
      output: { freeBusy: "free" },
    });
  });

  it("projects every element of an array of records", () => {
    const projected = projectGovernedView(VIEW, [
      { title: "a", freeBusy: "busy" },
      { title: "b", freeBusy: "free" },
    ]);

    expect(projected).toEqual({
      ok: true,
      output: [{ freeBusy: "busy" }, { freeBusy: "free" }],
    });
  });

  it("fails closed on a representation that is not a record", () => {
    expect(projectGovernedView(VIEW, "retention: 90 days").ok).toBe(false);
    expect(projectGovernedView(VIEW, 42).ok).toBe(false);
    expect(projectGovernedView(VIEW, null).ok).toBe(false);
    // One non-record element refuses the whole array: partial projection is
    // partial disclosure.
    expect(projectGovernedView(VIEW, [{ freeBusy: "busy" }, "raw"]).ok).toBe(false);
  });

  it("never serves fields the view does not declare, own-property or not", () => {
    const projected = projectGovernedView(
      { name: "narrow", fields: ["toString"] },
      { freeBusy: "busy" },
    );

    // An inherited property is not part of the record and must not be invented.
    expect(projected).toEqual({ ok: true, output: {} });
  });
});
