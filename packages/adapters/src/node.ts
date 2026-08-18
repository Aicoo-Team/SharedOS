import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { delimiter, join } from "node:path";
import { createInterface, type Interface } from "node:readline";

import { CLAUDE_CODE_REQUIREMENTS } from "./claude-code/index.js";
import { CODEX_REQUIREMENTS } from "./codex/index.js";
import type {
  HarnessAvailability,
  HarnessChannel,
  HarnessFrame,
  HarnessRequirements,
  HarnessTransport,
  HarnessTurnRequest,
} from "./harness.js";

export interface ChildProcessTransportOptions {
  readonly command: string;
  readonly args?: readonly string[];
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string>>;
  /**
   * Builds the opening frame written to the harness's stdin.
   *
   * The turn's prompt, tool catalogue, and sanitised context all arrive through
   * here, so a vendor whose CLI takes them as arguments instead supplies its own
   * `args` and returns `undefined`.
   */
  readonly openingFrame?: (request: HarnessTurnRequest) => HarnessFrame | undefined;
}

/**
 * A harness reached as a subprocess speaking JSON lines on stdin and stdout.
 *
 * Both Codex and Claude Code expose exactly this: a long-running process, one
 * JSON object per line each way. Keeping it separate from the protocol means an
 * adapter can be exercised against a recorded transcript and then run live
 * without any change to the translation code that was tested.
 *
 * Node only. It is published from `@aicoo/sharedos-adapters/node` so the main
 * entry point stays host-neutral.
 */
export class ChildProcessTransport implements HarnessTransport {
  readonly #options: ChildProcessTransportOptions;

  constructor(options: ChildProcessTransportOptions) {
    this.#options = options;
  }

  async open(request: HarnessTurnRequest, signal: AbortSignal): Promise<HarnessChannel> {
    if (signal.aborted) {
      throw signal.reason ?? new Error("turn aborted before the harness started");
    }
    const child = spawn(this.#options.command, [...(this.#options.args ?? [])], {
      ...(this.#options.cwd === undefined ? {} : { cwd: this.#options.cwd }),
      env: { ...process.env, ...this.#options.env },
      stdio: ["pipe", "pipe", "pipe"],
    }) as ChildProcessWithoutNullStreams;

    const channel = new ChildProcessChannel(child);
    const opening = this.#options.openingFrame?.(request);
    if (opening !== undefined) {
      await channel.write(opening);
    }
    return channel;
  }
}

class ChildProcessChannel implements HarnessChannel {
  readonly #child: ChildProcessWithoutNullStreams;
  readonly #lines: Interface;
  readonly #buffered: HarnessFrame[] = [];
  readonly #waiting: ((frame: HarnessFrame | undefined) => void)[] = [];
  #ended = false;
  #stderr = "";

  constructor(child: ChildProcessWithoutNullStreams) {
    this.#child = child;
    this.#lines = createInterface({ input: child.stdout });
    this.#lines.on("line", (line) => this.#push(line));
    this.#lines.on("close", () => this.#end());
    child.on("error", () => this.#end());
    child.on("close", () => this.#end());
    child.stderr.setEncoding("utf8");
    // Kept for diagnosis only. A harness that dies mid-turn must surface as a
    // failed turn, never as a silent completion.
    child.stderr.on("data", (chunk: string) => {
      this.#stderr = `${this.#stderr}${chunk}`.slice(-4_096);
    });
  }

  get stderr(): string {
    return this.#stderr;
  }

  async read(signal: AbortSignal): Promise<HarnessFrame | undefined> {
    const buffered = this.#buffered.shift();
    if (buffered !== undefined) {
      return buffered;
    }
    if (this.#ended) {
      return undefined;
    }
    return new Promise<HarnessFrame | undefined>((resolve, reject) => {
      const onAbort = (): void => reject(signal.reason ?? new Error("turn aborted"));
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
      this.#waiting.push((frame) => {
        signal.removeEventListener("abort", onAbort);
        resolve(frame);
      });
    });
  }

  async write(frame: HarnessFrame): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.#child.stdin.write(`${JSON.stringify(frame)}\n`, (error) =>
        error === null || error === undefined ? resolve() : reject(error),
      );
    });
  }

  async close(): Promise<void> {
    this.#lines.close();
    this.#child.stdin.end();
    if (this.#child.exitCode === null && this.#child.signalCode === null) {
      this.#child.kill();
    }
    this.#end();
    await Promise.resolve();
  }

  #push(line: string): void {
    const trimmed = line.trim();
    if (trimmed === "") {
      return;
    }
    let frame: HarnessFrame;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        return;
      }
      frame = parsed as HarnessFrame;
    } catch {
      // Harnesses print human-readable banners alongside their protocol. A line
      // that is not a frame is not an error.
      return;
    }
    const waiting = this.#waiting.shift();
    if (waiting === undefined) {
      this.#buffered.push(frame);
    } else {
      waiting(frame);
    }
  }

  #end(): void {
    if (this.#ended) {
      return;
    }
    this.#ended = true;
    while (this.#waiting.length > 0) {
      this.#waiting.shift()?.(undefined);
    }
  }
}

/**
 * Whether a harness can be run here.
 *
 * The conformance suite calls this before opening a column, so a missing CLI is
 * reported as a column that was not exercised rather than as a failing one. An
 * absent harness is not evidence about SharedOS.
 */
export async function probeHarness(
  requirements: HarnessRequirements,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): Promise<HarnessAvailability> {
  const executable = await findExecutable(requirements.executable, environment["PATH"]);
  if (executable === undefined) {
    return {
      harness: requirements.harness,
      available: false,
      reason: `The ${requirements.executable} executable is not on PATH.`,
    };
  }

  const credential = requirements.credentialVariables.find(
    (name) => (environment[name] ?? "") !== "",
  );
  if (credential === undefined && !requirements.credentialsOptional) {
    return {
      harness: requirements.harness,
      available: false,
      reason: `None of ${requirements.credentialVariables.join(", ")} is set.`,
      detail: { executable },
    };
  }

  return {
    harness: requirements.harness,
    available: true,
    detail: {
      executable,
      credential: credential ?? "none; relying on a stored session",
    },
  };
}

export function probeCodex(
  environment?: Readonly<Record<string, string | undefined>>,
): Promise<HarnessAvailability> {
  return probeHarness(CODEX_REQUIREMENTS, environment);
}

export function probeClaudeCode(
  environment?: Readonly<Record<string, string | undefined>>,
): Promise<HarnessAvailability> {
  return probeHarness(CLAUDE_CODE_REQUIREMENTS, environment);
}

async function findExecutable(name: string, path: string | undefined): Promise<string | undefined> {
  for (const directory of (path ?? "").split(delimiter).filter((entry) => entry !== "")) {
    const candidate = join(directory, name);
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      continue;
    }
  }
  return undefined;
}
