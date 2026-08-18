import type {
  JsonObject,
  JsonValue,
  ProtocolError,
  ToolDefinition,
  ToolResult,
} from "@aicoo/sharedos-contracts";
import type { RuntimeVisibleContext } from "@aicoo/sharedos-runtime";

/** One raw protocol frame, in whatever shape the harness speaks. */
export type HarnessFrame = JsonObject;

/**
 * What one frame means once the vendor protocol has interpreted it.
 *
 * `message` is assistant prose. It is kept rather than discarded so a harness
 * whose terminal frame carries no text still produces a turn output.
 */
export type HarnessStep =
  | {
      readonly type: "tool_call";
      readonly callId: string;
      readonly tool: string;
      readonly arguments: JsonObject;
    }
  | { readonly type: "message"; readonly text: string }
  | { readonly type: "complete"; readonly output?: JsonValue; readonly metadata?: JsonObject }
  | { readonly type: "failed"; readonly error: ProtocolError };

/** Everything a harness needs to start one turn. */
export interface HarnessTurnRequest {
  readonly executionId: string;
  readonly prompt: string;
  /** The permission-filtered catalogue, already in the harness's own shape. */
  readonly tools: JsonValue;
  /** The sanitised context. It carries no grants and no issuing authority. */
  readonly context: RuntimeVisibleContext;
  readonly metadata?: JsonObject;
}

/** One open harness turn. Reads and writes are frames, never SharedOS types. */
export interface HarnessChannel {
  /** The next frame, or `undefined` once the harness has finished speaking. */
  read(signal: AbortSignal): Promise<HarnessFrame | undefined>;
  write(frame: HarnessFrame, signal: AbortSignal): Promise<void>;
  close(): Promise<void>;
}

/**
 * How a harness is reached: a subprocess, an HTTP session, or a recorded
 * transcript. Keeping this separate from the protocol is what lets one adapter
 * be exercised deterministically and then run live without changing the
 * translation code under test.
 */
export interface HarnessTransport {
  open(request: HarnessTurnRequest, signal: AbortSignal): Promise<HarnessChannel>;
}

/**
 * The translation between SharedOS and one vendor's wire shapes.
 *
 * This is the whole adapter. Everything else -- the turn loop, per-call
 * re-authorization, the permission-filtered catalogue, audit -- is supplied by
 * the SharedOS execution envelope and is not reimplemented per vendor.
 */
export interface HarnessProtocol {
  readonly id: string;
  /** Render the permission-filtered catalogue in the harness's own tool shape. */
  describeTools(tools: readonly ToolDefinition[]): JsonValue;
  /**
   * Everything one frame means, in order. Frames carrying nothing relevant --
   * progress notices, token counts, thinking blocks -- yield an empty array,
   * and a frame carrying several tool calls yields one step each.
   */
  interpret(frame: HarnessFrame): readonly HarnessStep[];
  encodeToolResult(result: ToolResult): HarnessFrame;
}

/** Whether a harness can actually be run here, and if not, why not. */
export interface HarnessAvailability {
  readonly harness: string;
  readonly available: boolean;
  readonly reason?: string;
  readonly detail?: JsonObject;
}

/** What a harness needs before it can run: an executable, credentials, or both. */
export interface HarnessRequirements {
  readonly harness: string;
  /** Executable expected on PATH. */
  readonly executable: string;
  /** Environment variables, any one of which satisfies the credential need. */
  readonly credentialVariables: readonly string[];
  /** True when the harness can authenticate from a stored session instead. */
  readonly credentialsOptional: boolean;
}
