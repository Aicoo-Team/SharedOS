import {
  JsonObjectSchema,
  type JsonObject,
  type JsonValue,
  type ProtocolError,
  type ToolResult,
} from "@aicoo/sharedos-contracts";

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
  const parsed = JsonObjectSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
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
