import { z } from "zod";

export type JsonPrimitive = string | number | boolean | null;
export interface JsonObject {
  [key: string]: JsonValue;
}
export type JsonArray = JsonValue[];
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

const JsonNumberSchema = z.number().finite();

/**
 * Any value that can round-trip through JSON without custom serialization.
 * In particular, this rejects undefined, bigint, Date, NaN, and Infinity.
 */
export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    JsonNumberSchema,
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(JsonValueSchema),
  ]),
);

export const JsonObjectSchema: z.ZodType<JsonObject> = z.record(JsonValueSchema);

/**
 * Whether a value is shaped like a JSON object: a non-null object that is not
 * an array. It checks the shape of the top level only, which is what a reader
 * needs before indexing into a value it was handed as `unknown` or as a
 * `JsonValue`; it does not walk the children, so it is not a substitute for
 * {@link JsonObjectSchema} at a trust boundary.
 */
export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
