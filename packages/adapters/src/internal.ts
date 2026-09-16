import type { JsonObject, JsonValue, ProtocolError, ToolResult } from "@aicoo/sharedos-contracts";
import { hashJson } from "@aicoo/sharedos-core";
import { parseJsonObject, protocolError } from "@aicoo/sharedos-core/internal";

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
 * What a runtime handed the seat as text before the turn began, as one identity.
 *
 * `instructions` is what the seat is told about where it is -- a model driver's
 * system message, an MCP server's initialize instructions -- and `prompt` is the
 * task. Hashed together, in one shape, by both shipped runtimes, so the same
 * words carry the same hash whichever runtime said them, and two runs of one
 * column can be checked to have told the seat the same thing before a moved
 * cell is credited to the model. A reworded prompt is a different question, and
 * the record is where that has to be visible: the catalogue already carries a
 * hash for the same reason, and the prompt is the other thing the model reads.
 *
 * It covers what SharedOS said, and only that. A CLI's own system prompt is
 * added on the far side of the wire and never seen here, so it is not claimed.
 */
export async function handedPromptHash(
  instructions: string | undefined,
  prompt: string,
): Promise<string> {
  return hashJson({ instructions: instructions ?? null, prompt });
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
  const error = protocolError(code, message);
  return metadata === undefined ? { type: "fail", error } : { type: "fail", error, metadata };
}

/**
 * Argument blobs are model or harness output, so they are parsed rather than
 * trusted: an empty blob is an empty object, anything that is not a JSON
 * object is refused as `undefined`. The walk is core's `parseJsonObject`,
 * which gives `JsonObjectSchema`'s verdict without the schema's cost.
 */
export function parseToolArguments(raw: string): JsonObject | undefined {
  if (raw.trim() === "") {
    return {};
  }
  return parseJsonObject(raw);
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
