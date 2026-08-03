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
export const JsonArraySchema: z.ZodType<JsonArray> = z.array(JsonValueSchema);
