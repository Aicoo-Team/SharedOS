import type { JsonObject } from "@aicoo/sharedos-contracts";

export { parseToolArguments } from "../internal.js";

import { apiKeyCredential, type ModelCredential } from "./credential.js";

/**
 * One tool call a model asked for, exactly as it came off the wire.
 *
 * The name is the provider's alphabet, not SharedOS's, and the arguments are
 * still an unparsed string. Neither is normalised here: a client's job is to
 * carry what the model said, and deciding what an unparseable argument blob or
 * an unrecognised name means is a policy question that belongs to the driver.
 */
export interface ModelToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: string;
}

/** A tool offered to the model, already rendered into the provider's alphabet. */
export interface ModelTool {
  readonly name: string;
  readonly description: string;
  readonly parameters: JsonObject;
}

/**
 * One turn of conversation.
 *
 * `assistant` carries the tool calls the model asked for and `tool` carries one
 * result back, because a chat-completions provider requires the pair to appear
 * in that order and requires every call in an assistant message to be answered
 * before the next one is sent.
 */
export type ModelMessage =
  | { readonly role: "system" | "user"; readonly content: string }
  | {
      readonly role: "assistant";
      readonly content: string;
      readonly toolCalls: readonly ModelToolCall[];
    }
  | { readonly role: "tool"; readonly toolCallId: string; readonly content: string };

export interface ModelCompletionRequest {
  readonly messages: readonly ModelMessage[];
  readonly tools: readonly ModelTool[];
}

/** What a provider billed for one reply, when it said. */
export interface ModelUsage {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
}

/** What the model answered with. */
export interface ModelReply {
  readonly text: string;
  readonly toolCalls: readonly ModelToolCall[];
  /**
   * Why generation stopped, in the provider's own vocabulary.
   *
   * Recorded verbatim and never normalised, so two providers that end a reply
   * for the same reason under different words stay distinguishable in the
   * record. What the driver acts on is {@link truncated}, which is the same
   * fact stated once for every wire shape.
   */
  readonly finishReason?: string;
  /**
   * Whether the provider ended the reply rather than the model choosing to.
   *
   * A completion cut off at the output ceiling looks, without this, exactly
   * like a completion the model chose to end: its calls may be half-written and
   * its silence is not a decision. The driver fails the turn on it rather than
   * grading the cut, so every client has to state it -- `finish_reason:
   * "length"` on chat-completions, an `incomplete` status on the Responses API
   * -- and a client that leaves it absent is claiming the model finished.
   */
  readonly truncated?: boolean;
  /** Absent when the provider reported no usage; never estimated. */
  readonly usage?: ModelUsage;
  /**
   * The model the provider says actually answered.
   *
   * Recorded separately from the one that was asked for because they differ:
   * DeepSeek maps an unrecognised name onto a default rather than rejecting it,
   * so a run configured for one model can be served by another. The record
   * should say what answered, which is the weaker claim and the honest one.
   */
  readonly model?: string;
}

/**
 * A model API in the SharedOS driver seat.
 *
 * Deliberately narrower than any provider SDK: one call, tools in, tool calls
 * out. Everything that decides whether a call is allowed to happen -- the
 * catalogue, the turn loop, per-call re-authorization, audit -- stays in the
 * execution envelope, so a second provider is a second implementation of this
 * interface and no new enforcement path.
 */
export interface ModelClient {
  /** The model this client was configured to ask for. */
  readonly model: string;
  /** The provider that serves it, recorded alongside the model on every turn. */
  readonly provider: string;
  /**
   * How this client authenticates, when it authenticates at all.
   *
   * Carried onto the turn's metadata for the same reason the served model is: a
   * run on a metered API key and a run on somebody's subscription are different
   * claims about where the answers came from, and a record that cannot tell
   * them apart cannot say which one it is evidence of. It holds identifiers and
   * shapes only -- see {@link ModelCredential.describe} -- and a client that
   * presents nothing, such as a transcript, leaves it absent.
   */
  readonly auth?: JsonObject;
  complete(request: ModelCompletionRequest, signal: AbortSignal): Promise<ModelReply>;
}

/** A model call that did not produce an answer. Carries no response body. */
export class ModelRequestError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ModelRequestError";
    if (status !== undefined) {
      this.status = status;
    }
  }
}

export interface ModelHttpClientOptions {
  /** A metered account's key. Supply this or {@link credential}, never both. */
  readonly apiKey?: string;
  /**
   * How calls authenticate, for anything a constant key cannot express.
   *
   * A subscription is the case this exists for: an access token that expires,
   * renewed against the provider's token endpoint, presented alongside the code
   * of the account the plan bills. See {@link SubscriptionOAuthCredential}.
   */
  readonly credential?: ModelCredential;
  readonly model: string;
  /** Names the provider on every record this client's turns produce. */
  readonly provider: string;
  /** The API root, without a trailing slash. */
  readonly baseUrl: string;
  /**
   * Constant headers this endpoint requires, beyond the content type.
   *
   * A subscription endpoint often wants more than a token -- a client
   * originator, a beta opt-in -- and which ones is the operator's knowledge of
   * their provider rather than something this package should assert. The
   * credential's own headers win over these: a static configuration must not be
   * able to override the token or the account the call is billed to.
   */
  readonly headers?: Readonly<Record<string, string>>;
  /** How long one model call may take, independently of the turn's own budget. */
  readonly requestTimeoutMs?: number;
  /** Injected for tests, which must never reach a network. */
  readonly fetch?: typeof globalThis.fetch;
}

const DEFAULT_REQUEST_TIMEOUT_MS = 120_000;
/**
 * One retry, on the failures that are worth retrying.
 *
 * A conformance run is dozens of turns and a single 429 would otherwise leave a
 * row reported `not exercised` -- indistinguishable, in the manifest, from a
 * model that chose not to make the call. Retrying a rate limit is recovering
 * evidence; retrying a 400 would only be asking the same wrong question twice.
 */
const RETRYABLE_ATTEMPTS = 2;
const RETRY_DELAY_MS = 1_500;

/**
 * Everything a model client does that is not its provider's wire shape.
 *
 * Authentication, the per-request deadline, the retry policy, the single
 * re-authentication, and the rule that a provider's error body never leaves
 * this file are the same regardless of which API is being spoken -- and they
 * are the parts that decide whether a failed turn is honest evidence. Holding
 * them once means a second wire shape is an encoder and a reader, not a second
 * copy of the policy that would drift from the first.
 *
 * A subclass supplies three things: where to post, how to render a request, and
 * how to read a response.
 */
export abstract class ModelHttpClient implements ModelClient {
  readonly model: string;
  readonly provider: string;
  readonly #credential: ModelCredential;
  readonly #baseUrl: string;
  readonly #headers: Readonly<Record<string, string>>;
  readonly #requestTimeoutMs: number;
  readonly #fetch: typeof globalThis.fetch;

  protected constructor(options: ModelHttpClientOptions) {
    if (options.apiKey !== undefined && options.credential !== undefined) {
      // Two ways to authenticate is one too many: whichever lost would be a
      // credential a host configured and this client silently ignored.
      throw new TypeError("A model client takes an API key or a credential, not both");
    }
    if (options.apiKey === undefined && options.credential === undefined) {
      throw new TypeError("A model client needs an API key or a credential");
    }
    this.model = options.model;
    this.provider = options.provider;
    this.#credential = options.credential ?? apiKeyCredential(options.apiKey ?? "");
    this.#baseUrl = options.baseUrl.replace(/\/+$/u, "");
    this.#headers = options.headers ?? {};
    this.#requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  /**
   * How this client authenticates, asked of the credential rather than captured
   * when the client was built.
   *
   * A subscription can learn which account it pays from only when the provider
   * first says so, and a description taken at construction would then record
   * the turn as unscoped for the life of the process.
   */
  get auth(): JsonObject {
    return this.#credential.describe();
  }

  /** Where this wire shape posts, as a path under the configured root. */
  protected abstract readonly path: string;

  /** One turn of conversation, in the provider's request shape. */
  protected abstract encode(request: ModelCompletionRequest): JsonObject;

  /**
   * The provider's answer, read into a reply.
   *
   * Given the whole `Response` rather than a parsed body because how the answer
   * arrives is part of the wire shape: one JSON document for chat-completions,
   * a stream of events for a Responses endpoint that only streams.
   */
  protected abstract read(response: Response): Promise<ModelReply>;

  async complete(request: ModelCompletionRequest, signal: AbortSignal): Promise<ModelReply> {
    const body = JSON.stringify(this.encode(request));

    try {
      return await this.#attempt(body, signal);
    } catch (error) {
      // A credential that can renew gets exactly one chance to, and only on the
      // status that means the credential was the problem. Renewing on a 403
      // would retry a subscription that authenticated fine and is not entitled
      // to this model, and renewing more than once would spend refresh tokens
      // against a provider that has already said no.
      if (
        signal.aborted ||
        !(error instanceof ModelRequestError) ||
        error.status !== 401 ||
        !(await this.#renew(signal))
      ) {
        throw error;
      }
      return await this.#attempt(body, signal);
    }
  }

  /** Renew, treating a credential that cannot as a credential that did not. */
  async #renew(signal: AbortSignal): Promise<boolean> {
    try {
      return (await this.#credential.renew?.(signal)) ?? false;
    } catch (error) {
      if (signal.aborted) {
        throw error;
      }
      // The renewal failed on its own terms. The call keeps the provider's
      // 401 as its answer, which is the failure a caller can act on; the
      // renewal error would name the token endpoint instead.
      return false;
    }
  }

  async #attempt(body: string, signal: AbortSignal): Promise<ModelReply> {
    let lastError: ModelRequestError | undefined;
    for (let attempt = 1; attempt <= RETRYABLE_ATTEMPTS; attempt += 1) {
      try {
        return await this.#request(body, signal);
      } catch (error) {
        if (signal.aborted) {
          throw error;
        }
        const failure =
          error instanceof ModelRequestError
            ? error
            : new ModelRequestError(`the model call failed: ${describe(error)}`);
        if (attempt === RETRYABLE_ATTEMPTS || !isRetryable(failure)) {
          throw failure;
        }
        lastError = failure;
        await delay(RETRY_DELAY_MS, signal);
      }
    }

    throw lastError ?? new ModelRequestError("the model call failed");
  }

  async #request(body: string, signal: AbortSignal): Promise<ModelReply> {
    // Resolved per call, not per client. A subscription token expires while a
    // turn is running, and the instant that decides whether it still holds is
    // the one the call is made at.
    const authorization = await this.#credential.headers(signal);
    // Two deadlines, not one. The turn's signal ends the whole execution; this
    // one ends a single hung request so a stalled connection is a failed call
    // rather than a failed run. Started after the credential has answered, so a
    // slow token exchange does not spend the request's budget.
    const deadline = AbortSignal.timeout(this.#requestTimeoutMs);
    const response = await this.#fetch(`${this.#baseUrl}${this.path}`, {
      method: "POST",
      headers: {
        ...this.#headers,
        "content-type": "application/json",
        ...authorization,
      },
      body,
      // Both deadlines reach the body as well as the headers, so a stream that
      // stalls half way through is ended by the same timeout that would have
      // ended a stalled request.
      signal: AbortSignal.any([signal, deadline]),
    });

    if (!response.ok) {
      // The body is read and discarded rather than surfaced. A provider error
      // can quote the request back, and the request carries the turn's prompt
      // and arguments; the status is what a caller can act on anyway.
      await response.text().catch(() => "");
      throw new ModelRequestError(
        `the model provider answered ${String(response.status)}`,
        response.status,
      );
    }

    return this.read(response);
  }
}

function isRetryable(error: ModelRequestError): boolean {
  return error.status === undefined || error.status === 429 || error.status >= 500;
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(signal.reason as Error);
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
