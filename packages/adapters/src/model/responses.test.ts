import { afterEach, describe, expect, it, vi } from "vitest";

import { ModelRequestError, type ModelCompletionRequest } from "./client.js";
import { OpenAiResponsesModelClient, type OpenAiResponsesModelClientOptions } from "./responses.js";

const REQUEST: ModelCompletionRequest = {
  messages: [
    { role: "system", content: "be brief" },
    { role: "user", content: "read the workspace" },
    {
      role: "assistant",
      content: "reading it now",
      toolCalls: [{ id: "call-1", name: "files_read", arguments: '{"path":["Workspace"]}' }],
    },
    { role: "tool", toolCallId: "call-1", content: '{"status":"succeeded"}' },
  ],
  tools: [
    { name: "files_read", description: "Read one authorized file", parameters: { type: "object" } },
  ],
};

/** A finished response, with everything this client reads. */
const RESPONSE = {
  id: "resp_1",
  model: "served-model",
  status: "completed",
  output: [
    { type: "reasoning", id: "rs_1", summary: [] },
    {
      type: "message",
      id: "msg_1",
      role: "assistant",
      content: [{ type: "output_text", text: "on it" }],
    },
    {
      type: "function_call",
      id: "fc_1",
      call_id: "call-2",
      name: "files_read",
      arguments: '{"path":["Workspace"]}',
    },
  ],
  usage: { input_tokens: 40, output_tokens: 12 },
};

type Fetch = typeof globalThis.fetch;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** The same answer as a stream of events, in supplied chunks. */
function sse(chunks: readonly string[]): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(new TextEncoder().encode(chunk));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "content-type": "text/event-stream; charset=utf-8" },
  });
}

function event(type: string, payload: unknown): string {
  return `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
}

function client(
  fetch: Fetch,
  options: Partial<OpenAiResponsesModelClientOptions> = {},
): OpenAiResponsesModelClient {
  return new OpenAiResponsesModelClient({
    apiKey: "secret-key",
    model: "gpt-5-codex",
    provider: "openai",
    baseUrl: "https://chatgpt.com/backend-api/codex/",
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

/**
 * Every refusal below is statusless, and a statusless failure is retried once
 * before it is thrown -- a provider's bad moment, as the chat-completions
 * client treats it. The clock is faked so the retry costs the suite nothing;
 * the failure asserted is the one the second attempt produced.
 */
async function refusal(pending: Promise<unknown>): Promise<Error> {
  const outcome = pending.then(
    () => undefined,
    (error: unknown) => error as Error,
  );
  await vi.advanceTimersByTimeAsync(1_500);
  const error = await outcome;
  if (error === undefined) {
    throw new Error("the call resolved instead of refusing");
  }
  return error;
}

describe("the Responses client", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes the conversation as input items and the catalogue as flat tools", async () => {
    const fetch = vi.fn<Fetch>(async () => json(RESPONSE));
    await client(fetch).complete(REQUEST, signal());

    expect(fetch.mock.calls[0]?.[0]).toBe("https://chatgpt.com/backend-api/codex/responses");
    expect(JSON.parse(requestInit(fetch).body as string)).toEqual({
      model: "gpt-5-codex",
      input: [
        { type: "message", role: "system", content: [{ type: "input_text", text: "be brief" }] },
        {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "read the workspace" }],
        },
        // An assistant turn is its text and then its calls, in that order: the
        // provider pairs an output with the call that preceded it.
        {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: "reading it now" }],
        },
        {
          type: "function_call",
          call_id: "call-1",
          name: "files_read",
          arguments: '{"path":["Workspace"]}',
        },
        {
          type: "function_call_output",
          call_id: "call-1",
          output: '{"status":"succeeded"}',
        },
      ],
      tools: [
        {
          type: "function",
          name: "files_read",
          description: "Read one authorized file",
          parameters: { type: "object" },
          strict: false,
        },
      ],
      tool_choice: "auto",
      max_output_tokens: 32_768,
      store: false,
      stream: true,
    });
  });

  it("writes no message item for an assistant turn that was only a call", async () => {
    const fetch = vi.fn<Fetch>(async () => json(RESPONSE));
    await client(fetch).complete(
      {
        messages: [
          { role: "assistant", content: "", toolCalls: [{ id: "c", name: "n", arguments: "{}" }] },
        ],
        tools: [],
      },
      signal(),
    );

    // An empty message is a message the model never wrote.
    const body = JSON.parse(requestInit(fetch).body as string) as Record<string, unknown>;
    expect(body["input"]).toEqual([
      { type: "function_call", call_id: "c", name: "n", arguments: "{}" },
    ]);
    expect(body).not.toHaveProperty("tools");
    expect(body).not.toHaveProperty("tool_choice");
  });

  it("sends no temperature unless one was asked for", async () => {
    const fetch = vi.fn<Fetch>(async () => json(RESPONSE));

    await client(fetch).complete(REQUEST, signal());
    await client(fetch, { temperature: 0.4, maxOutputTokens: 512, store: true }).complete(
      REQUEST,
      signal(),
    );

    // A reasoning model rejects the parameter, and those are the models this
    // endpoint mostly serves.
    expect(JSON.parse(requestInit(fetch).body as string)).not.toHaveProperty("temperature");
    expect(JSON.parse(requestInit(fetch, 1).body as string)).toMatchObject({
      temperature: 0.4,
      max_output_tokens: 512,
      store: true,
    });
  });

  it("reads the reply, the served model, the status, and the usage", async () => {
    const fetch = vi.fn<Fetch>(async () => json(RESPONSE));
    const reply = await client(fetch).complete(REQUEST, signal());

    expect(reply).toEqual({
      text: "on it",
      // The call id, not the item id: it is what an output has to name back.
      toolCalls: [{ id: "call-2", name: "files_read", arguments: '{"path":["Workspace"]}' }],
      model: "served-model",
      finishReason: "completed",
      usage: { inputTokens: 40, outputTokens: 12 },
    });
  });

  it("reads a streamed answer from the event that carries the finished response", async () => {
    const fetch = vi.fn<Fetch>(async () =>
      sse([
        event("response.created", { response: { id: "resp_1", status: "in_progress" } }),
        // Deltas are ignored: the terminal event carries the whole response.
        `event: response.output_text.delta\ndata: ${JSON.stringify({ delta: "on " })}\n\n`,
        event("response.completed", { response: RESPONSE }),
        "data: [DONE]\n\n",
      ]),
    );

    const reply = await client(fetch).complete(REQUEST, signal());

    expect(reply.text).toBe("on it");
    expect(reply.toolCalls).toEqual([
      { id: "call-2", name: "files_read", arguments: '{"path":["Workspace"]}' },
    ]);
    expect((requestInit(fetch).headers as Record<string, string>)["accept"]).toBe(
      "text/event-stream",
    );
  });

  it("reads a stream whose events arrive split across chunks and end without a blank line", async () => {
    const whole = event("response.completed", { response: RESPONSE }).replaceAll("\n", "\r\n");
    const fetch = vi.fn<Fetch>(async () =>
      sse([whole.slice(0, 30), whole.slice(30, whole.length - 4), whole.slice(-4).trimEnd()]),
    );

    const reply = await client(fetch).complete(REQUEST, signal());

    expect(reply.text).toBe("on it");
  });

  it("reads what the provider actually sent, not what was asked for", async () => {
    // Streaming was requested and JSON came back. The content type decides.
    const fetch = vi.fn<Fetch>(async () => json(RESPONSE));
    const streamed = vi.fn<Fetch>(async () =>
      sse([event("response.completed", { response: RESPONSE })]),
    );

    expect((await client(fetch).complete(REQUEST, signal())).text).toBe("on it");
    expect((await client(streamed, { stream: false }).complete(REQUEST, signal())).text).toBe(
      "on it",
    );
    expect((requestInit(streamed).headers as Record<string, string>)["accept"]).toBe(
      "application/json",
    );
    expect(JSON.parse(requestInit(streamed).body as string)).toMatchObject({ stream: false });
  });

  it("reports a reply the provider cut short as truncated, under the provider's own reason", async () => {
    const fetch = vi.fn<Fetch>(async () =>
      json({
        ...RESPONSE,
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
      }),
    );

    const reply = await client(fetch).complete(REQUEST, signal());

    // The driver fails the turn on `truncated`; the record keeps the word the
    // provider used, which is not the one chat-completions uses for the same
    // fact.
    expect(reply.truncated).toBe(true);
    expect(reply.finishReason).toBe("max_output_tokens");
  });

  it("leaves truncated absent on a finished reply", async () => {
    const fetch = vi.fn<Fetch>(async () => json(RESPONSE));

    expect(await client(fetch).complete(REQUEST, signal())).not.toHaveProperty("truncated");
  });

  it("refuses a response the provider failed, which arrives with a 200", async () => {
    const fetch = vi.fn<Fetch>(async () =>
      json({ ...RESPONSE, status: "failed", error: { message: "you sent: SECRET PROMPT" } }),
    );

    vi.useFakeTimers();
    const error = await refusal(client(fetch).complete(REQUEST, signal()));

    // Read as an answer, it would be a model that replied with nothing -- a
    // decision it never made.
    expect(error).toBeInstanceOf(ModelRequestError);
    expect(error.message).toBe("the model provider ended the response as failed");
    expect(error.message).not.toContain("SECRET");
  });

  it("refuses a tool call it cannot read rather than dropping it", async () => {
    const fetch = vi.fn<Fetch>(async () =>
      json({
        ...RESPONSE,
        output: [{ type: "function_call", id: "fc_1", name: "files_read", arguments: "{}" }],
      }),
    );

    // Dropping it would erase an attempt the model made, and an attempt that
    // never reaches the envelope is graded as one that was never tried.
    vi.useFakeTimers();
    expect((await refusal(client(fetch).complete(REQUEST, signal()))).message).toMatch(
      /unreadable tool call/u,
    );
  });

  it("carries past the item kinds it does not use", async () => {
    const fetch = vi.fn<Fetch>(async () =>
      json({
        ...RESPONSE,
        output: [
          { type: "reasoning", summary: [{ type: "summary_text", text: "thinking" }] },
          { type: "web_search_call", id: "ws_1", status: "completed" },
          { type: "message", content: [{ type: "output_text", text: "done" }] },
        ],
      }),
    );

    // A provider's new item kind must not become an unreadable completion, and
    // must not be guessed at either.
    expect((await client(fetch).complete(REQUEST, signal())).text).toBe("done");
  });

  it("refuses a payload that carries no output at all", async () => {
    const fetch = vi.fn<Fetch>(async () => json({ id: "resp_1" }));

    // Accepting it would turn any JSON document -- a proxy's own reply, an
    // error page with a 200 -- into a model that answered with nothing.
    vi.useFakeTimers();
    expect((await refusal(client(fetch).complete(REQUEST, signal()))).message).toBe(
      "the model provider returned an unreadable completion",
    );
  });

  it("refuses a stream that ended without carrying a response", async () => {
    const fetch = vi.fn<Fetch>(async () =>
      sse([`event: response.output_text.delta\ndata: ${JSON.stringify({ delta: "on " })}\n\n`]),
    );

    // A model that said nothing chose to; a stream that was cut off did not.
    vi.useFakeTimers();
    expect((await refusal(client(fetch).complete(REQUEST, signal()))).message).toMatch(
      /stream ended without a response/u,
    );
  });

  it("shares the credential, the retry policy, and the error discipline", async () => {
    const fetch = vi
      .fn<Fetch>()
      .mockResolvedValueOnce(new Response("you sent: SECRET PROMPT", { status: 401 }))
      .mockResolvedValueOnce(json(RESPONSE));
    let token = "access-1";
    const credential = {
      scheme: "subscription_oauth",
      headers: async () => ({ authorization: `Bearer ${token}`, "chatgpt-account-id": "acct-9" }),
      renew: async () => {
        token = "access-2";
        return true;
      },
      describe: () => ({ scheme: "subscription_oauth" }),
    };

    const subscribed = new OpenAiResponsesModelClient({
      credential,
      model: "gpt-5-codex",
      provider: "openai",
      baseUrl: "https://chatgpt.com/backend-api/codex",
      headers: { originator: "sharedos" },
      fetch,
    });
    const reply = await subscribed.complete(REQUEST, signal());

    expect(reply.model).toBe("served-model");
    expect(subscribed.auth).toEqual({ scheme: "subscription_oauth" });
    expect(requestInit(fetch, 1).headers).toEqual({
      originator: "sharedos",
      accept: "text/event-stream",
      "content-type": "application/json",
      authorization: "Bearer access-2",
      "chatgpt-account-id": "acct-9",
    });
  });
});
