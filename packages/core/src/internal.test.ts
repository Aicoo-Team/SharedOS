import { JsonObjectSchema } from "@aicoo/sharedos-contracts";
import { describe, expect, it } from "vitest";

import { readJsonObject } from "./internal.js";

class Plain {
  readonly own = 1;
}

/** Every own name at every depth, so a dropped or an added key is seen, not just a changed value. */
function shape(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  const entries = Object.getOwnPropertyNames(value).map((key) => [
    key,
    shape((value as Record<string, unknown>)[key]),
  ]);
  return { proto: Object.getPrototypeOf(value)?.constructor?.name ?? null, entries };
}

describe("readJsonObject", () => {
  const inherited = Object.create({ inherited: "yes" }) as Record<string, unknown>;
  inherited["own"] = 1;
  const hidden = Object.defineProperty({ shown: 1 }, "hidden", { value: 2, enumerable: false });
  const getter = Object.defineProperty({}, "computed", { get: () => "read", enumerable: true });
  const nullProto = Object.assign(Object.create(null) as Record<string, unknown>, { a: 1 });
  const sparse = [1, , 3]; // eslint-disable-line no-sparse-arrays
  const values: readonly [string, unknown][] = [
    ["plain", { path: ["Workspace"], n: 1, ok: true, none: null }],
    ["nested", { a: { b: [1, { c: [[]] }] }, d: {} }],
    ["negative zero and the largest double", { z: -0, big: 1.5e308 }],
    ["infinity", { n: Number.POSITIVE_INFINITY }],
    ["negative infinity nested", { a: [{ n: Number.NEGATIVE_INFINITY }] }],
    ["nan", { n: Number.NaN }],
    ["undefined value", { a: undefined }],
    ["undefined value nested", { a: { b: undefined } }],
    ["bigint", { n: 1n }],
    ["symbol value", { s: Symbol("s") }],
    ["function value", { f: () => 1 }],
    ["date", { at: new Date(0) }],
    ["map", { m: new Map() }],
    ["set", { s: new Set() }],
    ["promise", { p: Promise.resolve(1) }],
    ["thenable with catch", { p: { then: () => 1, catch: () => 1 } }],
    ["then without catch, as a record of a function", { p: { then: () => 1 } }],
    ["then and catch that are not functions", { p: { then: 1, catch: 2 } }],
    ["class instance", { o: new Plain() }],
    ["inherited enumerable key", { o: inherited }],
    ["null prototype", { o: nullProto }],
    ["non-enumerable own key", { o: hidden }],
    ["enumerable getter", { o: getter }],
    ["string object", { o: new String("xy") }],
    ["number object", { o: new Number(5) }],
    ["regexp", { o: /x/u }],
    ["error", { o: new Error("x") }],
    ["typed array", { o: new Uint8Array([1, 2]) }],
    ["sparse array", { a: sparse }],
    ["array with undefined", { a: [1, undefined] }],
    ["frozen", Object.freeze({ a: Object.freeze([1]) })],
    ["__proto__ own key at the top", JSON.parse('{"__proto__":{"x":1},"y":2}') as unknown],
    [
      "__proto__ own key nested",
      JSON.parse('{"a":{"__proto__":1,"b":[{"__proto__":2,"c":3}]}}') as unknown,
    ],
    ["__proto__ own key with a refused value", JSON.parse('{"__proto__":1e999}') as unknown],
    ["prototype-ish names as ordinary keys", { constructor: 1, toString: 2, hasOwnProperty: 3 }],
    ["integer-like keys", { "1": "x", b: "y", "0": "z" }],
    ["empty key", { "": "" }],
    ["deep", { deep: JSON.parse(`${"[".repeat(64)}1${"]".repeat(64)}`) as unknown }],
    ["top-level null", null],
    ["top-level array", [1, 2]],
    ["top-level string", "a string"],
    ["top-level number", 1],
    ["top-level undefined", undefined],
    ["top-level date", new Date(0)],
    ["top-level map", new Map()],
    ["top-level promise", Promise.resolve({})],
    ["top-level class instance", new Plain()],
    ["top-level string object", new String("xy")],
    ["top-level typed array", new Uint8Array([1])],
  ];

  it.each(values)("gives the verdict and the value JsonObjectSchema gives: %s", (_label, value) => {
    const expected = JsonObjectSchema.safeParse(value);
    const actual = readJsonObject(value);
    expect(actual === undefined).toBe(!expected.success);
    if (expected.success) {
      expect(actual).toEqual(expected.data);
      expect(shape(actual)).toEqual(shape(expected.data));
    }
  });

  it("hands back a copy, never the parser's own containers", () => {
    const inner = [1];
    const value = { a: inner, b: { c: 1 } };
    const read = readJsonObject(value);
    expect(read).toEqual(value);
    expect(read).not.toBe(value);
    expect(read?.["a"]).not.toBe(inner);
    expect(read?.["b"]).not.toBe(value.b);
  });
});
