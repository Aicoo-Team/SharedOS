import type { JsonObject, JsonValue, ProtocolError, ToolResult } from "@aicoo/sharedos-contracts";

/** The prompt a turn's message becomes when a driver is given no `prompt` override. */
export function defaultPrompt(request: {
  readonly message: { readonly payload: JsonValue };
}): string {
  const payload: JsonValue = request.message.payload;
  if (typeof payload === "string") {
    return payload;
  }
  if (payload !== null && typeof payload === "object" && !Array.isArray(payload)) {
    const text = (payload as JsonObject)["text"];
    if (typeof text === "string") {
      return text;
    }
  }
  return JSON.stringify(payload);
}

/**
 * A failed ending, in the one shape a driver decision and a runtime outcome
 * both accept. Never retryable: what an adapter fails on is the harness's or
 * the model's doing, and asking again asks the same thing.
 */
export function failed(
  code: string,
  message: string,
  metadata?: JsonObject,
): { readonly type: "fail"; readonly error: ProtocolError; readonly metadata?: JsonObject } {
  const error: ProtocolError = { code, message, retryable: false };
  return metadata === undefined ? { type: "fail", error } : { type: "fail", error, metadata };
}

/**
 * Argument blobs are model or harness output, so they are parsed rather than
 * trusted: an empty blob is an empty object, anything that is not a JSON
 * object is refused as `undefined`.
 *
 * What `JSON.parse` returns is read by a walk of its own rather than by
 * `JsonObjectSchema`. The verdict and the value are the schema's; the schema
 * reached them by trying every branch of the value union at every node, which
 * cost sixty-odd times the parse and was most of what a string-carrying
 * adapter spent per call.
 */
export function parseToolArguments(raw: string): JsonObject | undefined {
  if (raw.trim() === "") {
    return {};
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const read = readParsedJson(value);
  return read === REFUSED ? undefined : (read as JsonObject);
}

const REFUSED: unique symbol = Symbol("refused");

/**
 * What `JSON.parse` returned, as `JsonObjectSchema` would have returned it.
 *
 * The parser's grammar already guarantees strings, booleans, `null`, arrays
 * and plain objects, so the walk checks the two places where its output and
 * the schema's verdict part. A number literal too large for a double comes
 * back as an infinity, which the schema refuses because it cannot round-trip.
 * A `"__proto__"` key comes back as an own property, which the schema drops
 * at every depth rather than refuses, and so does this. Anything the parser
 * cannot produce is refused rather than presumed about.
 *
 * The value comes back as it was when nothing had to be dropped; a copy is
 * made only of the containers on the path to a dropped key.
 */
function readParsedJson(value: unknown): JsonValue | typeof REFUSED {
  switch (typeof value) {
    case "string":
    case "boolean":
      return value;
    case "number":
      return Number.isFinite(value) ? value : REFUSED;
    case "object":
      break;
    default:
      return REFUSED;
  }
  if (value === null) {
    return null;
  }
  if (Array.isArray(value)) {
    let copy: JsonValue[] | undefined;
    for (let index = 0; index < value.length; index += 1) {
      const item = readParsedJson(value[index]);
      if (item === REFUSED) {
        return REFUSED;
      }
      if (copy !== undefined) {
        copy.push(item);
      } else if (item !== value[index]) {
        copy = value.slice(0, index) as JsonValue[];
        copy.push(item);
      }
    }
    return copy ?? (value as JsonValue[]);
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  let copy: JsonObject | undefined;
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index] as string;
    const item = readParsedJson(record[key]);
    if (item === REFUSED) {
      return REFUSED;
    }
    if (key === "__proto__") {
      copy ??= copyKeys(record, keys, index);
    } else if (copy !== undefined) {
      copy[key] = item;
    } else if (item !== record[key]) {
      copy = copyKeys(record, keys, index);
      copy[key] = item;
    }
  }
  return copy ?? (record as JsonObject);
}

/** The first `count` keys of a record the walk has already accepted as they are. */
function copyKeys(
  record: Record<string, unknown>,
  keys: readonly string[],
  count: number,
): JsonObject {
  const copy: JsonObject = {};
  for (let index = 0; index < count; index += 1) {
    const key = keys[index] as string;
    copy[key] = record[key] as JsonValue;
  }
  return copy;
}

/**
 * A tool result as the JSON body a harness or a model reads back.
 *
 * A refusal is a result carrying its reason code, not a transport error: the
 * caller needs to know it was refused and why, so it can choose differently;
 * hiding the refusal behind a crash would make it retry blindly.
 */
export function toolResultBody(result: ToolResult): JsonValue {
  return result.status === "succeeded"
    ? { status: result.status, output: result.output }
    : { status: result.status, error: { code: result.error.code, message: result.error.message } };
}
