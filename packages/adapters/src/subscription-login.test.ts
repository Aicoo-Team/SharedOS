import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  codexLoginPath,
  createCodexSubscriptionCredential,
  readCodexLogin,
} from "./subscription-login.js";

type Fetch = typeof globalThis.fetch;

const signal = (): AbortSignal => new AbortController().signal;

function idToken(claims: unknown): string {
  const payload = btoa(JSON.stringify(claims)).replaceAll("+", "-").replaceAll("/", "_");
  return `header.${payload.replaceAll("=", "")}.signature`;
}

/** A login file in the shape `codex login` leaves behind. */
async function login(contents: unknown): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "sharedos-login-"));
  const path = join(directory, "auth.json");
  await writeFile(path, typeof contents === "string" ? contents : JSON.stringify(contents));
  return path;
}

const SESSION = {
  OPENAI_API_KEY: null,
  tokens: {
    id_token: idToken({ "https://api.openai.com/auth": { chatgpt_account_id: "acct-claim" } }),
    access_token: "access-1",
    refresh_token: "refresh-1",
    account_id: "acct-9",
  },
  last_refresh: "2026-08-01T00:00:00.000Z",
};

function tokenResponse(body: Record<string, unknown> = {}): Response {
  return new Response(JSON.stringify({ access_token: "access-2", expires_in: 3_600, ...body }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("finding a stored Codex login", () => {
  it("honours CODEX_HOME, because Codex does", () => {
    expect(codexLoginPath({ CODEX_HOME: "/srv/codex" })).toBe("/srv/codex/auth.json");
    expect(codexLoginPath({ HOME: "/home/who" })).toMatch(/\.codex\/auth\.json$/u);
  });

  it("reads the session, and no expiry it was not told", async () => {
    const path = await login(SESSION);

    // Codex records when the session was last refreshed, not when the access
    // token stops working. Deriving one from the other would be inventing a
    // fact: the credential renews on a 401 instead.
    expect(await readCodexLogin({ path })).toEqual({
      accessToken: "access-1",
      refreshToken: "refresh-1",
      accountCode: "acct-9",
    });
  });

  it("falls back to the id token's claim for the account code", async () => {
    const path = await login({ tokens: { ...SESSION.tokens, account_id: undefined } });

    expect(await readCodexLogin({ path })).toMatchObject({ accountCode: "acct-claim" });
  });

  it("reports no login for a file that is missing, unreadable, or holds no session", async () => {
    // None of these is an error. A caller decides what an absent login means.
    expect(
      await readCodexLogin({ path: join(tmpdir(), "sharedos-absent", "auth.json") }),
    ).toBeUndefined();
    expect(await readCodexLogin({ path: await login("{not json") })).toBeUndefined();
    expect(await readCodexLogin({ path: await login({ OPENAI_API_KEY: "sk-1" }) })).toBeUndefined();
  });
});

describe("a Codex subscription credential", () => {
  it("is absent when there is no login to read", async () => {
    const credential = await createCodexSubscriptionCredential({
      path: join(tmpdir(), "sharedos-absent", "auth.json"),
    });

    expect(credential).toBeUndefined();
  });

  it("presents the login's token and the account it pays from", async () => {
    const path = await login(SESSION);
    const credential = await createCodexSubscriptionCredential({ path, fetch: vi.fn<Fetch>() });

    expect(await credential?.headers(signal())).toEqual({
      authorization: "Bearer access-1",
      "chatgpt-account-id": "acct-9",
    });
  });

  it("writes a renewed session back, keeping every field it did not touch", async () => {
    const path = await login(SESSION);
    const fetch = vi.fn<Fetch>(async () => tokenResponse({ refresh_token: "refresh-2" }));
    const credential = await createCodexSubscriptionCredential({ path, fetch });

    await credential?.renew(signal());

    // The provider rotates the refresh token on every exchange. A run that did
    // not write back would leave the file holding one that has been spent, and
    // the next `codex` invocation unable to renew at all.
    const written = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
    expect(written["tokens"]).toMatchObject({
      access_token: "access-2",
      refresh_token: "refresh-2",
      account_id: "acct-9",
      id_token: SESSION.tokens.id_token,
    });
    expect(written["OPENAI_API_KEY"]).toBeNull();
    expect(written["last_refresh"]).not.toBe(SESSION.last_refresh);
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  });

  it("leaves the file alone when the host asked it to", async () => {
    const path = await login(SESSION);
    const fetch = vi.fn<Fetch>(async () => tokenResponse());
    const credential = await createCodexSubscriptionCredential({ path, fetch, persist: false });

    await credential?.renew(signal());

    expect(JSON.parse(await readFile(path, "utf8"))).toEqual(SESSION);
  });
});
