import type { JsonObject, JsonValue } from "@aicoo/sharedos-contracts";

import { CLAUDE_CODE_PROTOCOL_ID } from "./claude-code/protocol.js";
import { CODEX_PROTOCOL_ID } from "./codex/protocol.js";
import type { HarnessFrame } from "./harness.js";

/**
 * The inverse of {@link HarnessProtocol.interpret}: frames a harness would send.
 *
 * A `HarnessProtocol` only ever reads. That is correct for production, where
 * the frames come from the vendor, and it leaves no way to *build* a recorded
 * conversation for a harness to be replayed against. Writing those frames by
 * hand per test is how a fixture drifts from the shape the parser expects, so
 * the two live side by side and are exercised against each other.
 *
 * A writer is deliberately not part of `HarnessProtocol`. Requiring every
 * adapter to implement an encoder that production never calls would put dead
 * code in the security-relevant path.
 */
export interface HarnessFrameWriter {
  /** The protocol these frames belong to; must match the reading protocol's id. */
  readonly protocolId: string;
  toolCall(callId: string, tool: string, arguments_: JsonObject): HarnessFrame;
  message(text: string): HarnessFrame;
  complete(output?: JsonValue): HarnessFrame;
}

/** Frames in the OpenAI Responses function-calling shape Codex speaks. */
export const codexFrameWriter: HarnessFrameWriter = Object.freeze({
  protocolId: CODEX_PROTOCOL_ID,

  toolCall(callId: string, tool: string, arguments_: JsonObject): HarnessFrame {
    return {
      type: "function_call",
      call_id: callId,
      name: tool,
      // Responses carries arguments as a JSON-encoded string, so a writer that
      // sent an object would produce frames the real parser rejects.
      arguments: JSON.stringify(arguments_),
    };
  },

  message(text: string): HarnessFrame {
    return { type: "message", content: [{ type: "output_text", text }] };
  },

  complete(output?: JsonValue): HarnessFrame {
    return {
      type: "response.completed",
      response: output === undefined ? {} : { output_text: JSON.stringify(output) },
    };
  },
});

/** Frames in the Anthropic content-block shape Claude Code speaks. */
export const claudeCodeFrameWriter: HarnessFrameWriter = Object.freeze({
  protocolId: CLAUDE_CODE_PROTOCOL_ID,

  toolCall(callId: string, tool: string, arguments_: JsonObject): HarnessFrame {
    return {
      type: "assistant",
      message: {
        role: "assistant",
        content: [{ type: "tool_use", id: callId, name: tool, input: arguments_ }],
      },
    };
  },

  message(text: string): HarnessFrame {
    return { type: "assistant", message: { role: "assistant", content: [{ type: "text", text }] } };
  },

  complete(output?: JsonValue): HarnessFrame {
    return {
      type: "result",
      subtype: "success",
      is_error: false,
      ...(output === undefined ? {} : { result: JSON.stringify(output) }),
    };
  },
});
