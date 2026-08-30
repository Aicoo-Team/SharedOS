import { describe, expect, it, vi } from "vitest";

import {
  accountCodeFromIdToken,
  apiKeyCredential,
  ModelCredentialError,
  OPENAI_SUBSCRIPTION_PROFILE,
  SubscriptionOAuthCredential,
  type SubscriptionOAuthCredentialOptions,
  type SubscriptionOAuthProfile,
  type SubscriptionTokens,
} from "./credential.js";

type Fetch = typeof globalThis.fetch;

const NOW = "2026-08-30T12:00:00.000Z";

const TOKENS: SubscriptionTokens = {
  accessToken: "access-1",
  refreshToken: "refresh-1",
  expiresAt: "2026-08-30T13:00:00.000Z",
  accountCode: "acct-9",
};

function tokenResponse(body: Record<string, unknown> = {}, status = 200): Response {
  return new Response(JSON.stringify({ access_token: "access-2", expires_in: 3_600, ...body }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function credential(
  fetch: Fetch,
  options: Partial<SubscriptionOAuthCredentialOptions> = {},
): SubscriptionOAuthCredential {
  return new SubscriptionOAuthCredential({
    profile: OPENAI_SUBSCRIPTION_PROFILE,
    tokens: TOKENS,
    now: () => NOW,
    fetch,
    ...options,
  });
}

const signal = (): AbortSignal => new AbortController().signal;

function idToken(claims: unknown): string {
  const payload = btoa(JSON.stringify(claims)).replaceAll("+", "-").replaceAll("/", "_");
  return `header.${payload.replaceAll("=", "")}.signature`;
}

describe("a static key credential", () => {
  it("presents the key and nothing else", async () => {
    const key = apiKeyCredential("secret-key");

    expect(await key.headers(signal())).toEqual({ authorization: "Bearer secret-key" });
    expect(key.describe()).toEqual({ scheme: "api_key" });
  });

  it("cannot renew, because a constant has nothing to renew to", () => {
    // A 401 against a static key is a configuration error. The client reads the
    // absence of `renew` as "do not try again", which is the right answer.
    expect(apiKeyCredential("secret-key").renew).toBeUndefined();
  });

  it("refuses a blank key", () => {
    expect(() => apiKeyCredential("   ")).toThrow(/API key/u);
  });
});

describe("a subscription credential", () => {
  it("presents the token and the account the plan bills", async () => {
    const fetch = vi.fn<Fetch>();

    expect(await credential(fetch).headers(signal())).toEqual({
      authorization: "Bearer access-1",
      "chatgpt-account-id": "acct-9",
    });
    // A token still inside its window is presented as it stands: no exchange.
    expect(fetch).not.toHaveBeenCalled();
  });

  it("omits the account header for a login that named no account", async () => {
    const fetch = vi.fn<Fetch>();
    const tokens = { accessToken: "access-1", expiresAt: "2026-08-30T13:00:00.000Z" };

    expect(await credential(fetch, { tokens }).headers(signal())).toEqual({
      authorization: "Bearer access-1",
    });
  });

  it("carries the constant headers a provider requires", async () => {
    const profile: SubscriptionOAuthProfile = {
      ...OPENAI_SUBSCRIPTION_PROFILE,
      headers: { originator: "sharedos" },
    };

    expect(await credential(vi.fn<Fetch>(), { profile }).headers(signal())).toMatchObject({
      originator: "sharedos",
    });
  });

  it("renews a token whose window closes within the skew, before the call is made", async () => {
    const fetch = vi.fn<Fetch>(async () => tokenResponse());
    // Sixty seconds left, and the default skew is sixty seconds: a token that is
    // valid when the request is written can be expired when it is read.
    const tokens = { ...TOKENS, expiresAt: "2026-08-30T12:01:00.000Z" };

    const headers = await credential(fetch, { tokens }).headers(signal());

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(headers["authorization"]).toBe("Bearer access-2");
  });

  it("exchanges the refresh token the way the profile says", async () => {
    const fetch = vi.fn<Fetch>(async () => tokenResponse());
    const expired = { ...TOKENS, expiresAt: "2026-08-30T11:00:00.000Z" };

    await credential(fetch, { tokens: expired }).headers(signal());

    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe("https://auth.openai.com/oauth/token");
    expect((init?.headers as Record<string, string>)["content-type"]).toBe("application/json");
    expect(JSON.parse(init?.body as string)).toEqual({
      grant_type: "refresh_token",
      refresh_token: "refresh-1",
      client_id: OPENAI_SUBSCRIPTION_PROFILE.clientId,
    });
  });

  it("form-encodes for a profile that does not ask for JSON, as RFC 6749 says", async () => {
    const fetch = vi.fn<Fetch>(async () => tokenResponse());
    const profile: SubscriptionOAuthProfile = {
      id: "plain",
      tokenUrl: "https://issuer.example/token",
      clientId: "client-1",
      accountHeader: "x-account",
    };

    await credential(fetch, { profile }).renew(signal());

    const init = fetch.mock.calls[0]?.[1];
    expect((init?.headers as Record<string, string>)["content-type"]).toBe(
      "application/x-www-form-urlencoded",
    );
    expect(Object.fromEntries(new URLSearchParams(init?.body as string))).toEqual({
      grant_type: "refresh_token",
      refresh_token: "refresh-1",
      client_id: "client-1",
    });
  });

  it("dates the new window from when the exchange was asked for", async () => {
    const fetch = vi.fn<Fetch>(async () => tokenResponse({ expires_in: 60 }));
    const subscription = credential(fetch);

    await subscription.renew(signal());

    expect(subscription.tokens.expiresAt).toBe("2026-08-30T12:01:00.000Z");
  });

  it("takes a rotated refresh token, and keeps the old one when none comes back", async () => {
    const rotating = credential(
      vi.fn<Fetch>(async () => tokenResponse({ refresh_token: "refresh-2" })),
    );
    const keeping = credential(vi.fn<Fetch>(async () => tokenResponse()));

    await rotating.renew(signal());
    await keeping.renew(signal());

    // Dropping an unrotated refresh token would leave a login that renewed once
    // and can never renew again.
    expect(rotating.tokens.refreshToken).toBe("refresh-2");
    expect(keeping.tokens.refreshToken).toBe("refresh-1");
  });

  it("hands the whole renewed session to the host's store", async () => {
    const onRefresh = vi.fn();
    const fetch = vi.fn<Fetch>(async () => tokenResponse({ refresh_token: "refresh-2" }));

    await credential(fetch, { onRefresh }).renew(signal());

    expect(onRefresh).toHaveBeenCalledWith({
      accessToken: "access-2",
      refreshToken: "refresh-2",
      expiresAt: "2026-08-30T13:00:00.000Z",
      accountCode: "acct-9",
    });
  });

  it("does not fail the call when the host's store does", async () => {
    const fetch = vi.fn<Fetch>(async () => tokenResponse());
    const onRefresh = vi.fn(() => {
      throw new Error("the keychain is locked");
    });

    // The token in hand is good. A store that cannot be written is a problem for
    // the next process, not for this call.
    await expect(credential(fetch, { onRefresh }).renew(signal())).resolves.toBe(true);
  });

  it("reads the account code out of an id token when the response names none", async () => {
    const fetch = vi.fn<Fetch>(async () =>
      tokenResponse({
        id_token: idToken({ "https://api.openai.com/auth": { chatgpt_account_id: "acct-11" } }),
      }),
    );
    const subscription = credential(fetch, {
      tokens: { accessToken: "access-1", refreshToken: "refresh-1" },
    });

    await subscription.renew(signal());

    expect(await subscription.headers(signal())).toMatchObject({ "chatgpt-account-id": "acct-11" });
  });

  it("exchanges once for every caller that arrives during the exchange", async () => {
    let release: ((response: Response) => void) | undefined;
    const fetch = vi.fn<Fetch>(
      async () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );
    const expired = { ...TOKENS, expiresAt: "2026-08-30T11:00:00.000Z" };
    const subscription = credential(fetch, { tokens: expired });

    const first = subscription.headers(signal());
    const second = subscription.headers(signal());
    await Promise.resolve();
    release?.(tokenResponse());

    expect((await first)["authorization"]).toBe("Bearer access-2");
    expect((await second)["authorization"]).toBe("Bearer access-2");
    // A second exchange would present a refresh token the first one just spent.
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("lets one caller's abort end its own wait and no one else's", async () => {
    let release: ((response: Response) => void) | undefined;
    const fetch = vi.fn<Fetch>(
      async () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );
    const expired = { ...TOKENS, expiresAt: "2026-08-30T11:00:00.000Z" };
    const subscription = credential(fetch, { tokens: expired });
    const leaving = new AbortController();

    const abandoned = subscription.headers(leaving.signal).then(
      () => "resolved",
      (error: unknown) => error,
    );
    const waiting = subscription.headers(signal());
    await Promise.resolve();
    leaving.abort(new Error("turn closed"));
    release?.(tokenResponse());

    expect(((await abandoned) as Error).message).toBe("turn closed");
    expect((await waiting)["authorization"]).toBe("Bearer access-2");
    // And the spent refresh token's replacement was kept, not discarded with
    // the caller that walked away.
    expect(subscription.tokens.accessToken).toBe("access-2");
  });

  it("reports that nothing changed when there is nothing to renew from", async () => {
    const fetch = vi.fn<Fetch>();
    const subscription = credential(fetch, { tokens: { accessToken: "access-1" } });

    // The client reads `false` as "do not try again": renewing a login with no
    // refresh token would be a request that cannot be formed.
    expect(await subscription.renew(signal())).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not renew in anticipation when the provider never said when the token ends", async () => {
    const fetch = vi.fn<Fetch>();
    const tokens = { accessToken: "access-1", refreshToken: "refresh-1" };

    await credential(fetch, { tokens }).headers(signal());

    // An absent expiry is unknown, not past. Spending a refresh token on every
    // call of a login whose provider simply never said would be worse than
    // taking the 401 that a dead token really produces.
    expect(fetch).not.toHaveBeenCalled();
  });

  it("treats an expiry it cannot read the same way", async () => {
    const fetch = vi.fn<Fetch>();
    const tokens = { ...TOKENS, expiresAt: "whenever" };

    await credential(fetch, { tokens }).headers(signal());

    expect(fetch).not.toHaveBeenCalled();
  });

  it("surfaces the token endpoint's status and never its body", async () => {
    const fetch = vi.fn<Fetch>(async () =>
      tokenResponse({ error: "invalid_grant for refresh-1" }, 400),
    );

    const error = await credential(fetch)
      .renew(signal())
      .then(
        () => undefined,
        (thrown: unknown) => thrown as ModelCredentialError,
      );

    expect(error).toBeInstanceOf(ModelCredentialError);
    expect(error?.status).toBe(400);
    expect(error?.message).toBe("the subscription token endpoint answered 400");
    expect(error?.message).not.toContain("refresh-1");
  });

  it("refuses a token response it cannot read rather than presenting undefined", async () => {
    const fetch = vi.fn<Fetch>(
      async () =>
        new Response("{}", { status: 200, headers: { "content-type": "application/json" } }),
    );

    await expect(credential(fetch).renew(signal())).rejects.toThrow(/unreadable token/u);
  });

  it("names an unreachable token endpoint without naming what was sent to it", async () => {
    const fetch = vi.fn<Fetch>(async () => {
      throw new Error("ECONNREFUSED");
    });

    await expect(credential(fetch).renew(signal())).rejects.toThrow(
      /token endpoint could not be reached: ECONNREFUSED/u,
    );
  });

  it("describes the seat without naming the account or the token", () => {
    const described = credential(vi.fn<Fetch>()).describe();

    expect(described).toEqual({
      scheme: "subscription_oauth",
      issuer: "openai-chatgpt",
      accountScoped: true,
    });
    expect(JSON.stringify(described)).not.toContain("acct-9");
    expect(JSON.stringify(described)).not.toContain("access-1");
  });

  it("refuses to be built without an access token", () => {
    expect(() => credential(vi.fn<Fetch>(), { tokens: { accessToken: "  " } })).toThrow(
      /access token/u,
    );
  });
});

describe("reading an account code out of an id token", () => {
  it("finds the claim OpenAI puts it in", () => {
    const token = idToken({ "https://api.openai.com/auth": { chatgpt_account_id: "acct-3" } });

    expect(accountCodeFromIdToken(token)).toBe("acct-3");
  });

  it("returns nothing for a token that is absent, unsegmented, or carries no claim", () => {
    // None of these is an error. The code is a routing hint, and a login that
    // does not carry one is an ordinary login.
    expect(accountCodeFromIdToken(undefined)).toBeUndefined();
    expect(accountCodeFromIdToken("not-a-token")).toBeUndefined();
    expect(accountCodeFromIdToken(idToken({ sub: "user-1" }))).toBeUndefined();
    expect(accountCodeFromIdToken("header.@@@.signature")).toBeUndefined();
  });
});
