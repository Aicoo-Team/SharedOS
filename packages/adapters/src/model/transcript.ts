import type { ModelClient, ModelCompletionRequest, ModelReply } from "./client.js";

/**
 * A model conversation, supplied by its caller.
 *
 * One reply per model call. The first reply answers the opening prompt, and
 * each later reply is released only once every tool call in the reply before
 * it has been answered -- which is what the driver already requires of a live
 * provider, so a transcript exercises the same code path a live model does.
 */
export interface ModelTranscript {
  readonly replies: readonly ModelReply[];
}

export interface TranscriptModelClientOptions {
  /** What the record names as the model; defaults to `transcript`. */
  readonly model?: string;
  /** What the record names as the provider; defaults to `transcript`. */
  readonly provider?: string;
}

/**
 * Replays a supplied conversation through the real model driver.
 *
 * This is how the native harness is verified without a provider or a
 * credential present, and it is the exact counterpart of `TranscriptTransport`
 * for a vendor harness. The replies are the caller's, written in the model's
 * own tool-call shape; the name decoding, argument parsing, escalation
 * recognition, and step accounting are the driver's; and the only thing left
 * unexercised is the provider that would have produced the replies.
 *
 * A spent transcript is an error rather than a completion. A live provider
 * always answers; a recording that has run out has nothing to say, and
 * answering "done" on its behalf would grade a script that ended too early as
 * a model choosing to stop. The driver fails the turn `model_call_failed`,
 * which is the visible result.
 */
export class TranscriptModelClient implements ModelClient {
  readonly model: string;
  readonly provider: string;
  /** Every request the driver made, in order, for a test to read back. */
  readonly seen: ModelCompletionRequest[] = [];
  readonly #replies: readonly ModelReply[];
  #index = 0;

  constructor(transcript: ModelTranscript, options: TranscriptModelClientOptions = {}) {
    if (transcript.replies.length === 0) {
      throw new TypeError("A model transcript needs at least one reply");
    }
    this.#replies = transcript.replies.map((reply) => structuredClone(reply));
    this.model = options.model ?? "transcript";
    this.provider = options.provider ?? "transcript";
  }

  async complete(request: ModelCompletionRequest, signal: AbortSignal): Promise<ModelReply> {
    // A live provider would have its request cancelled; a recording has nothing
    // to cancel, so it answers the way a cancelled request does -- by refusing
    // -- and an aborted turn reads as aborted rather than as one more reply.
    if (signal.aborted) {
      throw signal.reason instanceof Error ? signal.reason : new Error(String(signal.reason));
    }
    this.seen.push(structuredClone(request));
    const reply = this.#replies[this.#index];
    if (reply === undefined) {
      throw new Error(
        `the model transcript is spent: ${String(this.#replies.length)} replies were supplied and a ${ordinal(this.#index + 1)} was asked for`,
      );
    }
    this.#index += 1;
    return structuredClone(reply);
  }
}

function ordinal(n: number): string {
  const suffix =
    n % 100 >= 11 && n % 100 <= 13
      ? "th"
      : n % 10 === 1
        ? "st"
        : n % 10 === 2
          ? "nd"
          : n % 10 === 3
            ? "rd"
            : "th";
  return `${String(n)}${suffix}`;
}
