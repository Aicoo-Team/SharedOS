import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ModelRequestError,
  OpenAiCompatibleModelClient,
  parseToolArguments,
  type ModelCompletionRequest,
  type OpenAiCompatibleModelClientOptions,
} from "./client.js";
import { ModelCredentialError, type ModelCredential } from "./credential.js";

const REQUEST: ModelCompletionRequest = {
  messages: [
    { role: "system", content: "be brief" },
    { role: "user", content: "read the workspace" },
    {
      role: "assistant",
      content: "",
      toolCalls: [{ id: "call-1", name: "files_read", arguments: '{"path":["Workspace"]}' }],
    },
    { role: "tool", toolCallId: "call-1", content: '{"status":"succeeded"}' },
  ],
  tools: [
    { name: "files_read", description: "Read one authorized file", parameters: { type: "object" } },
  ],
};

/** A completion in the chat-completions wire shape, with everything the client reads. */
const COMPLETION = {
  id: "chatcmpl-1",
  model: "served-model",
  choices: [
    {
      index: 0,
      finish_reason: "tool_calls",
      message: {
        role: "assistant",
        content: null,
        tool_calls: [
          { id: "call-2", type: "function", function: { name: "files_read", arguments: "{}" } },
        ],
      },
    },
  ],
  usage: { prompt_tokens: 40, completion_tokens: 12, total_tokens: 52 },
};

function respond(body: unknown, status = 200): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

type Fetch = typeof globalThis.fetch;

function client(
  fetch: Fetch,
  options: Partial<OpenAiCompatibleModelClientOptions> = {},
): OpenAiCompatibleModelClient {
  return new OpenAiCompatibleModelClient({
    apiKey: "secret-key",
    model: "requested-model",
    provider: "test-provider",
    baseUrl: "https://provider.example/v1/",
    fetch,
    ...options,
  });
}

function requestInit(fetch: ReturnType<typeof vi.fn<Fetch>>, call = 0): RequestInit {
  const init = fetch.mock.calls[call]?.[1];
  if (init === undefined) {
    throw new Error(`fetch was not called ${String(call + 1)} time(s)`);
  }
  return init;
}

const signal = (): AbortSignal => new AbortController().signal;

describe("the chat-completions client", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("speaks the chat-completions wire shape to the configured endpoint", async () => {
    const fetch = vi.fn<Fetch>(async () => respond(COMPLETION));
    await client(fetch).complete(REQUEST, signal());

    expect(fetch).toHaveBeenCalledTimes(1);
    // One trailing slash on the base URL, none in the request: the root is
    // normalised so a host cannot produce `//chat/completions` by configuration.
    expect(fetch.mock.calls[0]?.[0]).toBe("https://provider.example/v1/chat/completions");
    const init = requestInit(fetch);
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({
      "content-type": "application/json",
      authorization: "Bearer secret-key",
    });
    expect(JSON.parse(init.body as string)).toEqual({
      model: "requested-model",
      messages: [
        { role: "system", content: "be brief" },
        { role: "user", content: "read the workspace" },
        {
          role: "assistant",
          content: "",
          tool_calls: [
            {
              id: "call-1",
              type: "function",
              function: { name: "files_read", arguments: '{"path":["Workspace"]}' },
            },
          ],
        },
        { role: "tool", tool_call_id: "call-1", content: '{"status":"succeeded"}' },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "files_read",
            description: "Read one authorized file",
            parameters: { type: "object" },
          },
        },
      ],
      tool_choice: "auto",
      max_tokens: 4_096,
      temperature: 0,
    });
  });

  it("offers no tools field at all when there is nothing to offer", async () => {
    const fetch = vi.fn<Fetch>(async () => respond(COMPLETION));
    await client(fetch, { maxOutputTokens: 256, temperature: 0.5 }).complete(
      { messages: REQUEST.messages, tools: [] },
      signal(),
    );

    // An empty `tools` array is rejected by some providers; `tool_choice`
    // without tools by others. Neither is sent.
    const body = JSON.parse(requestInit(fetch).body as string) as Record<string, unknown>;
    expect(body).not.toHaveProperty("tools");
    expect(body).not.toHaveProperty("tool_choice");
    expect(body).toMatchObject({ max_tokens: 256, temperature: 0.5 });
  });

  it("reads the reply, the served model, the finish reason, and the usage", async () => {
    const fetch = vi.fn<Fetch>(async () => respond(COMPLETION));
    const reply = await client(fetch).complete(REQUEST, signal());

    expect(reply).toEqual({
      text: "",
      toolCalls: [{ id: "call-2", name: "files_read", arguments: "{}" }],
      model: "served-model",
      finishReason: "tool_calls",
      usage: { inputTokens: 40, outputTokens: 12 },
    });
  });

  it("reads a completion that reports neither a finish reason nor usage", async () => {
    const fetch = vi.fn<Fetch>(async () =>
      respond({ choices: [{ message: { content: "all done" } }] }),
    );
    const reply = await client(fetch).complete(REQUEST, signal());

    // Absent, not invented. The driver treats an absent finish reason as the
    // provider having said nothing, which is different from `stop`.
    expect(reply).toEqual({ text: "all done", toolCalls: [] });
  });

  it("retries a rate limit once and takes the answer", async () => {
    vi.useFakeTimers();
    const fetch = vi
      .fn<Fetch>()
      .mockResolvedValueOnce(respond("slow down", 429))
      .mockResolvedValueOnce(respond(COMPLETION));

    const pending = client(fetch).complete(REQUEST, signal());
    await vi.advanceTimersByTimeAsync(1_500);
    const reply = await pending;

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(reply.model).toBe("served-model");
  });

  it("retries a server error once and then gives up", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn<Fetch>(async () => respond("upstream fell over", 503));

    const pending = client(fetch).complete(REQUEST, signal());
    // The rejection is observed before the clock moves, so an unhandled
    // rejection cannot fire between the second attempt and the assertion.
    const outcome = pending.then(
      () => "resolved",
      (error: unknown) => error,
    );
    await vi.advanceTimersByTimeAsync(1_500);
    const error = await outcome;

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(error).toBeInstanceOf(ModelRequestError);
    expect((error as ModelRequestError).status).toBe(503);
  });

  it("does not retry a client error, because the same question gets the same answer", async () => {
    const fetch = vi.fn<Fetch>(async () => respond("bad request", 400));

    await expect(client(fetch).complete(REQUEST, signal())).rejects.toMatchObject({
      name: "ModelRequestError",
      status: 400,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("surfaces the status and never the provider's body", async () => {
    // A provider error can quote the request back, and the request carries the
    // turn's prompt and arguments. The status is what a caller can act on.
    const fetch = vi.fn<Fetch>(async () =>
      respond('{"error":"you sent: SECRET PROMPT CONTENTS"}', 400),
    );

    const error = await client(fetch)
      .complete(REQUEST, signal())
      .then(
        () => undefined,
        (thrown: unknown) => thrown as Error,
      );

    expect(error?.message).toBe("the model provider answered 400");
    expect(error?.message).not.toContain("SECRET");
  });

  it("refuses a completion it cannot read rather than casting it", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn<Fetch>(async () => respond({ choices: [] }));

    const pending = client(fetch).complete(REQUEST, signal());
    const outcome = pending.then(
      () => "resolved",
      (error: unknown) => error,
    );
    await vi.advanceTimersByTimeAsync(1_500);
    const error = await outcome;

    // Unreadable is retried once like any statusless failure -- a provider's
    // bad moment -- and then refused as its own error, not as a parse crash.
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(error).toBeInstanceOf(ModelRequestError);
    expect((error as Error).message).toBe("the model provider returned an unreadable completion");
  });

  it("ends a hung request at its own deadline, independently of the turn's", async () => {
    // A fetch that answers only once its signal fires. The per-request deadline
    // is what fires it: the turn's signal is never aborted here.
    const fetch = vi.fn<Fetch>(
      (_url, init) =>
        new Promise((resolve) => {
          init?.signal?.addEventListener("abort", () => resolve(respond(COMPLETION)));
        }),
    );
    const turn = new AbortController();

    await client(fetch, { requestTimeoutMs: 10 }).complete(REQUEST, turn.signal);

    const sent = requestInit(fetch).signal;
    expect(sent?.aborted).toBe(true);
    expect((sent?.reason as Error).name).toBe("TimeoutError");
    expect(turn.signal.aborted).toBe(false);
  });

  it("lets the turn's abort win over a pending retry", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn<Fetch>(async () => respond("slow down", 429));
    const turn = new AbortController();

    const pending = client(fetch).complete(REQUEST, turn.signal);
    const outcome = pending.then(
      () => "resolved",
      (error: unknown) => error,
    );
    await vi.advanceTimersByTimeAsync(100);
    turn.abort(new Error("turn closed"));
    const error = await outcome;

    // Aborted mid-delay: the retry never happens, and the abort reason is
    // rethrown as-is rather than wrapped as a model failure.
    expect(fetch).toHaveBeenCalledTimes(1);
    expect((error as Error).message).toBe("turn closed");
    expect(error).not.toBeInstanceOf(ModelRequestError);
  });

  it("refuses to be built without a key", () => {
    expect(() => client(vi.fn<Fetch>(), { apiKey: "  " })).toThrow(/API key/u);
  });
});

describe("the chat-completions client on a credential", () => {
  /** A credential whose renewals are observable and whose secret changes. */
  function subscription(renewals: readonly boolean[] = [true]): ModelCredential & {
    readonly renew: ReturnType<typeof vi.fn>;
  } {
    let token = "access-1";
    let renewal = 0;
    const renew = vi.fn(async () => {
      const changed = renewals[renewal] ?? false;
      renewal += 1;
      if (changed) {
        token = `access-${String(renewal + 1)}`;
      }
      return changed;
    });
    return {
      scheme: "subscription_oauth",
      headers: async () => ({ authorization: `Bearer ${token}`, "chatgpt-account-id": "acct-9" }),
      renew,
      describe: () => ({ scheme: "subscription_oauth", issuer: "openai-chatgpt" }),
    };
  }

  /** The same client, authenticating by credential rather than by key. */
  function onCredential(fetch: Fetch, credential: ModelCredential): OpenAiCompatibleModelClient {
    return new OpenAiCompatibleModelClient({
      credential,
      model: "requested-model",
      provider: "test-provider",
      baseUrl: "https://provider.example/v1/",
      fetch,
    });
  }

  it("presents whatever the credential says, resolved for that call", async () => {
    const fetch = vi.fn<Fetch>(async () => respond(COMPLETION));

    await onCredential(fetch, subscription()).complete(REQUEST, signal());

    expect(requestInit(fetch).headers).toEqual({
      "content-type": "application/json",
      authorization: "Bearer access-1",
      "chatgpt-account-id": "acct-9",
    });
  });

  it("renews once on a 401 and asks again with the new token", async () => {
    const fetch = vi
      .fn<Fetch>()
      .mockResolvedValueOnce(respond("expired", 401))
      .mockResolvedValueOnce(respond(COMPLETION));
    const credential = subscription();

    const reply = await onCredential(fetch, credential).complete(REQUEST, signal());

    expect(credential.renew).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect((requestInit(fetch, 1).headers as Record<string, string>)["authorization"]).toBe(
      "Bearer access-2",
    );
    expect(reply.model).toBe("served-model");
  });

  it("renews at most once, whatever the second answer is", async () => {
    const fetch = vi.fn<Fetch>(async () => respond("expired", 401));
    const credential = subscription([true, true]);

    await expect(onCredential(fetch, credential).complete(REQUEST, signal())).rejects.toMatchObject(
      { status: 401 },
    );

    // A provider that refuses a freshly renewed token is refusing the account,
    // not the token. Renewing again would spend refresh tokens against a
    // provider that has already said no.
    expect(credential.renew).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not ask again when the credential says nothing changed", async () => {
    const fetch = vi.fn<Fetch>(async () => respond("expired", 401));
    const credential = subscription([false]);

    await expect(onCredential(fetch, credential).complete(REQUEST, signal())).rejects.toMatchObject(
      { status: 401 },
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("keeps the provider's 401 as the answer when the renewal itself fails", async () => {
    const fetch = vi.fn<Fetch>(async () => respond("expired", 401));
    const credential = {
      ...subscription(),
      renew: async (): Promise<boolean> => {
        throw new ModelCredentialError("the subscription token endpoint answered 400", 400);
      },
    };

    const error = await onCredential(fetch, credential)
      .complete(REQUEST, signal())
      .then(
        () => undefined,
        (thrown: unknown) => thrown as ModelRequestError,
      );

    // The failure a caller can act on is the one the model call got. The
    // renewal error would name the token endpoint instead, which is a different
    // question from why this turn has no answer.
    expect(error).toBeInstanceOf(ModelRequestError);
    expect(error?.status).toBe(401);
  });

  it("does not renew a static key, because a 401 on a constant is a misconfiguration", async () => {
    const fetch = vi.fn<Fetch>(async () => respond("wrong key", 401));

    await expect(client(fetch).complete(REQUEST, signal())).rejects.toMatchObject({ status: 401 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("reports how it authenticated, without the secret", () => {
    expect(client(vi.fn<Fetch>()).auth).toEqual({ scheme: "api_key" });
    expect(onCredential(vi.fn<Fetch>(), subscription()).auth).toEqual({
      scheme: "subscription_oauth",
      issuer: "openai-chatgpt",
    });
  });

  it("refuses two ways to authenticate, and refuses none", () => {
    // Whichever lost would be a credential a host configured and this client
    // silently ignored.
    expect(() => client(vi.fn<Fetch>(), { credential: subscription() })).toThrow(/not both/u);
    expect(
      () =>
        new OpenAiCompatibleModelClient({
          model: "requested-model",
          provider: "test-provider",
          baseUrl: "https://provider.example/v1/",
          fetch: vi.fn<Fetch>(),
        }),
    ).toThrow(/API key or a credential/u);
  });
});

describe("tool argument parsing", () => {
  it("reads an object, and treats an empty blob as no arguments", () => {
    expect(parseToolArguments('{"path":["Workspace"]}')).toEqual({ path: ["Workspace"] });
    expect(parseToolArguments("")).toEqual({});
    expect(parseToolArguments("   ")).toEqual({});
  });

  it("returns undefined for anything that is not a JSON object", () => {
    expect(parseToolArguments("not json")).toBeUndefined();
    expect(parseToolArguments("[1, 2]")).toBeUndefined();
    expect(parseToolArguments('"a string"')).toBeUndefined();
    expect(parseToolArguments("null")).toBeUndefined();
  });
});
