import type {
  HarnessChannel,
  HarnessFrame,
  HarnessTransport,
  HarnessTurnRequest,
} from "./harness.js";

/**
 * A recorded harness conversation.
 *
 * Batches are released one tool result at a time: the first batch is emitted
 * when the turn opens, and each later batch is unlocked by the adapter writing
 * a result back. That is the shape of every tool-using harness, so a transcript
 * exercises the same code path a live session does.
 */
export interface HarnessTranscript {
  readonly batches: readonly (readonly HarnessFrame[])[];
}

/**
 * Replays a recorded conversation through the real protocol translation.
 *
 * This is how an adapter is verified without the vendor's CLI or credentials
 * present. The frames are the vendor's, the parsing is the adapter's, and the
 * only thing left unexercised is the transport that would have carried them.
 */
export class TranscriptTransport implements HarnessTransport {
  readonly opened: HarnessTurnRequest[] = [];
  readonly written: HarnessFrame[] = [];
  readonly #transcript: HarnessTranscript;

  constructor(transcript: HarnessTranscript) {
    if (transcript.batches.length === 0) {
      throw new TypeError("A harness transcript needs at least one frame batch");
    }
    this.#transcript = { batches: transcript.batches.map((batch) => [...batch]) };
  }

  async open(request: HarnessTurnRequest): Promise<HarnessChannel> {
    await Promise.resolve();
    this.opened.push(structuredClone(request));
    return new TranscriptChannel(this.#transcript, this.written);
  }
}

class TranscriptChannel implements HarnessChannel {
  #batch = 0;
  #index = 0;
  #unlocked = 0;
  readonly #transcript: HarnessTranscript;
  readonly #written: HarnessFrame[];

  constructor(transcript: HarnessTranscript, written: HarnessFrame[]) {
    this.#transcript = transcript;
    this.#written = written;
  }

  async read(): Promise<HarnessFrame | undefined> {
    await Promise.resolve();
    for (;;) {
      const batch = this.#transcript.batches[this.#batch];
      if (batch === undefined) {
        return undefined;
      }
      const frame = batch[this.#index];
      if (frame !== undefined) {
        this.#index += 1;
        return structuredClone(frame);
      }
      // The batch is spent. A real harness would now be waiting for a result,
      // so the recording only continues once one has been written.
      if (this.#unlocked === 0) {
        return undefined;
      }
      this.#unlocked -= 1;
      this.#batch += 1;
      this.#index = 0;
    }
  }

  async write(frame: HarnessFrame): Promise<void> {
    await Promise.resolve();
    this.#written.push(structuredClone(frame));
    this.#unlocked += 1;
  }

  async close(): Promise<void> {
    await Promise.resolve();
  }
}
