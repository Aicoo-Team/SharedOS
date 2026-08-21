import type { JsonObject, JsonValue } from "@aicoo/sharedos-contracts";

import { CLAUDE_CODE_PROTOCOL_ID } from "./claude-code/protocol.js";
import { CODEX_PROTOCOL_ID } from "./codex/protocol.js";
import { DEEPSEEK_PROTOCOL_ID } from "./deepseek/protocol.js";
import { PI_PROTOCOL_ID } from "./pi/protocol.js";
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

/**
 * Frames in the session-log shape DeepSeek Harness streams.
 *
 * Wrapped in their `session.event` notification rather than left bare, because
 * that is the shape a live SDK runtime emits and a fixture that skipped the
 * envelope would exercise only half of what the parser has to accept.
 */
export const deepseekFrameWriter: HarnessFrameWriter = Object.freeze({
  protocolId: DEEPSEEK_PROTOCOL_ID,

  toolCall(callId: string, tool: string, arguments_: JsonObject): HarnessFrame {
    return sessionEvent("tool/call", {
      turn: 1,
      step: 1,
      callId,
      name: tool,
      // The harness carries model arguments unparsed, so a writer that sent an
      // object would produce frames the real parser rejects.
      arguments: JSON.stringify(arguments_),
    });
  },

  message(text: string): HarnessFrame {
    return sessionEvent("assistant/message", {
      turn: 1,
      step: 1,
      message: { role: "assistant", content: [{ type: "text", text }] },
    });
  },

  /**
   * `turn/end` carries a reason and no payload, so a completed DeepSeek turn
   * has no terminal text of its own and its output comes from the assistant
   * messages that preceded it. The argument is accepted for interface parity
   * and deliberately not smuggled into a field the harness does not send.
   */
  complete(): HarnessFrame {
    return sessionEvent("turn/end", { turn: 1, reason: { kind: "completed" } });
  },
});

function sessionEvent(type: string, data: JsonObject): HarnessFrame {
  return {
    jsonrpc: "2.0",
    method: "session.event",
    params: { sessionId: "session-1", event: { type, seq: 1, time: 0, data } },
  };
}

/** Frames in the RPC message shape Pi speaks. */
export const piFrameWriter: HarnessFrameWriter = Object.freeze({
  protocolId: PI_PROTOCOL_ID,

  toolCall(callId: string, tool: string, arguments_: JsonObject): HarnessFrame {
    return assistantMessage([{ type: "toolCall", id: callId, name: tool, arguments: arguments_ }]);
  },

  message(text: string): HarnessFrame {
    return assistantMessage([{ type: "text", text }]);
  },

  /**
   * `agent_end` reports that the run finished and carries the conversation
   * rather than an outcome payload, so a completed Pi turn takes its output
   * from the assistant messages that preceded it. As with DeepSeek, the
   * argument is accepted for interface parity and not invented onto the wire.
   */
  complete(): HarnessFrame {
    return { type: "agent_end", willRetry: false };
  },
});

function assistantMessage(content: JsonValue): HarnessFrame {
  return {
    type: "message_end",
    message: { role: "assistant", content, stopReason: "toolUse" },
  };
}
