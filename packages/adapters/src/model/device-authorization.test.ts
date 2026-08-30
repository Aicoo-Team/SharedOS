import { afterEach, describe, expect, it, vi } from "vitest";

import { ModelCredentialError, OPENAI_SUBSCRIPTION_PROFILE } from "./credential.js";
import { requestDeviceAuthorization } from "./device-authorization.js";

type Fetch = typeof globalThis.fetch;

const NOW = "2026-08-30T12:00:00.000Z";
const ISSUER = "https://auth.openai.com";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function idToken(claims: unknown): string {
  const payload = btoa(JSON.stringify(claims)).replaceAll("+", "-").replaceAll("/", "_");
  return `header.${payload.replaceAll("=", "")}.signature`;
}

const USER_CODE = { device_auth_id: "dev-1", user_code: "ABCD-1234", interval: 1 };
const AUTHORIZED = { authorization_code: "auth-code-1", code_verifier: "verifier-1" };
const TOKENS = {
  access_token: "access-1",
  refresh_token: "refresh-1",
  expires_in: 3_600,
  id_token: idToken({ "https://api.openai.com/auth": { chatgpt_account_id: "acct-9" } }),
};

function begin(fetch: Fetch, options = {}) {
  return requestDeviceAuthorization({ fetch, now: () => NOW, ...options });
}

const signal = (): AbortSignal => new AbortController().signal;

function body(fetch: ReturnType<typeof vi.fn<Fetch>>, call: number): unknown {
  const raw = fetch.mock.calls[call]?.[1]?.body;
  if (typeof raw !== "string") {
    throw new Error(`fetch call ${String(call)} carried no body`);
  }
  return raw.startsWith("{") ? JSON.parse(raw) : Object.fromEntries(new URLSearchParams(raw));
}

describe("starting a device login", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks the issuer's account server, and says where the person types the code", async () => {
    const fetch = vi.fn<Fetch>(async () => json(USER_CODE));

    const login = await begin(fetch);

    expect(fetch.mock.calls[0]?.[0]).toBe(`${ISSUER}/api/accounts/deviceauth/usercode`);
    expect(body(fetch, 0)).toEqual({ client_id: OPENAI_SUBSCRIPTION_PROFILE.clientId });
    expect(login.userCode).toBe("ABCD-1234");
    expect(login.verificationUri).toBe(`${ISSUER}/codex/device`);
    expect(login.intervalMs).toBe(1_000);
    // The provider's own ceiling: a quarter of an hour, then they start again.
    expect(login.expiresAt).toBe("2026-08-30T12:15:00.000Z");
  });

  it("reads the spellings the provider actually sends", async () => {
    // Its own client accepts `usercode` and an interval that arrived as a
    // string, so a reader that insisted on one shape would fail on a live
    // response rather than on a bad one.
    const fetch = vi.fn<Fetch>(async () =>
      json({ device_auth_id: "dev-1", usercode: "WXYZ-9876", interval: "7" }),
    );

    const login = await begin(fetch);

    expect(login.userCode).toBe("WXYZ-9876");
    expect(login.intervalMs).toBe(7_000);
  });

  it("names the setting when the provider has device login switched off", async () => {
    const fetch = vi.fn<Fetch>(async () => json({ detail: "not found" }, 404));

    // A 404 here is a refused capability, not a missing route. The difference
    // is a person enabling a setting instead of filing a bug.
    await expect(begin(fetch)).rejects.toThrow(/device login is not enabled for this account/u);
  });

  it("surfaces any other status without the body", async () => {
    const fetch = vi.fn<Fetch>(async () => json({ error: "you sent: SECRET" }, 500));

    const error = await begin(fetch).then(
      () => undefined,
      (thrown: unknown) => thrown as ModelCredentialError,
    );

    expect(error?.message).toBe("the device authorization endpoint answered 500");
    expect(error?.status).toBe(500);
  });

  it("refuses a response it cannot read rather than polling for nothing", async () => {
    const fetch = vi.fn<Fetch>(async () => json({ device_auth_id: "dev-1" }));

    await expect(begin(fetch)).rejects.toThrow(/unreadable code/u);
  });

  it("refuses a profile that declares no device login", async () => {
    const profile = { ...OPENAI_SUBSCRIPTION_PROFILE, issuerUrl: undefined };

    await expect(begin(vi.fn<Fetch>(), { profile })).rejects.toThrow(/declares no device login/u);
  });
});

describe("waiting for a device login", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("polls while the person is still typing, then exchanges what it is handed", async () => {
    const fetch = vi
      .fn<Fetch>()
      .mockResolvedValueOnce(json(USER_CODE))
      // Pending is spelled 403 and 404 here, not `authorization_pending`.
      .mockResolvedValueOnce(json({}, 403))
      .mockResolvedValueOnce(json({}, 404))
      .mockResolvedValueOnce(json(AUTHORIZED))
      .mockResolvedValueOnce(json(TOKENS));
    vi.useFakeTimers();

    const login = await begin(fetch);
    const pending = login.wait(signal());
    await vi.advanceTimersByTimeAsync(2_000);
    const tokens = await pending;

    expect(fetch.mock.calls[1]?.[0]).toBe(`${ISSUER}/api/accounts/deviceauth/token`);
    expect(body(fetch, 1)).toEqual({ device_auth_id: "dev-1", user_code: "ABCD-1234" });
    // The verifier is the server's, handed over once it is satisfied, and the
    // redirect is the one the code was issued against even though nothing
    // listens on it.
    expect(body(fetch, 4)).toEqual({
      grant_type: "authorization_code",
      code: "auth-code-1",
      redirect_uri: `${ISSUER}/deviceauth/callback`,
      client_id: OPENAI_SUBSCRIPTION_PROFILE.clientId,
      code_verifier: "verifier-1",
    });
    expect(tokens).toEqual({
      accessToken: "access-1",
      refreshToken: "refresh-1",
      expiresAt: "2026-08-30T13:00:00.000Z",
      accountCode: "acct-9",
    });
  });

  it("exchanges the code as a form even though a refresh goes as JSON", async () => {
    const fetch = vi
      .fn<Fetch>()
      .mockResolvedValueOnce(json(USER_CODE))
      .mockResolvedValueOnce(json(AUTHORIZED))
      .mockResolvedValueOnce(json(TOKENS));

    const login = await begin(fetch);
    await login.wait(signal());

    // The provider's own client posts these two grants to one endpoint in two
    // encodings; assuming they matched would send one of them in a shape no
    // client has tested.
    const headers = fetch.mock.calls[2]?.[1]?.headers as Record<string, string>;
    expect(headers["content-type"]).toBe("application/x-www-form-urlencoded");
  });

  it("stops when the code has expired rather than polling a dead login", async () => {
    const fetch = vi.fn<Fetch>().mockResolvedValueOnce(json(USER_CODE));
    let clock = NOW;

    const login = await requestDeviceAuthorization({ fetch, now: () => clock });
    clock = "2026-08-30T12:20:00.000Z";

    await expect(login.wait(signal())).rejects.toThrow(/expired before the login was authorized/u);
    // The poll never happened: the code was already dead when the wait began.
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("stops on a status that is not the provider's way of saying `not yet`", async () => {
    const fetch = vi
      .fn<Fetch>()
      .mockResolvedValueOnce(json(USER_CODE))
      .mockResolvedValueOnce(json({ error: "you sent: SECRET" }, 500));

    const error = await begin(fetch)
      .then((login) => login.wait(signal()))
      .then(
        () => undefined,
        (thrown: unknown) => thrown as ModelCredentialError,
      );

    expect(error?.message).toBe("the device login failed: the provider answered 500");
    expect(error?.message).not.toContain("SECRET");
  });

  it("refuses an authorization it cannot read", async () => {
    const fetch = vi
      .fn<Fetch>()
      .mockResolvedValueOnce(json(USER_CODE))
      .mockResolvedValueOnce(json({ authorization_code: "auth-code-1" }));

    await expect(begin(fetch).then((login) => login.wait(signal()))).rejects.toThrow(
      /unreadable authorization/u,
    );
  });

  it("gives up when the caller does", async () => {
    const fetch = vi
      .fn<Fetch>()
      .mockResolvedValueOnce(json(USER_CODE))
      .mockResolvedValue(json({}, 403));
    vi.useFakeTimers();
    const giving = new AbortController();

    const login = await begin(fetch);
    const outcome = login.wait(giving.signal).then(
      () => new Error("the wait resolved instead of stopping"),
      (error: unknown) => error as Error,
    );
    await vi.advanceTimersByTimeAsync(1_000);
    giving.abort(new Error("stopped waiting"));

    expect((await outcome).message).toBe("stopped waiting");
  });
});
