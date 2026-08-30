import type { JsonObject } from "@aicoo/sharedos-contracts";
import { z } from "zod";

/**
 * What one model call presents to prove it may be made.
 *
 * Deliberately not "an API key". A key is one way a provider recognises a
 * caller; a subscription is another, and the two differ in a way the client
 * cannot paper over: a key is a constant, and a subscription token expires,
 * is renewed against a token endpoint, and names the account the call is billed
 * to in a header of the provider's choosing.
 *
 * This is authentication and nothing else. Nothing a credential returns is
 * SharedOS authority: the catalogue this turn sees, the calls it may make, and
 * the audit it leaves are all resolved from the `GrantSource` before any of
 * this is consulted, and a credential that authenticates perfectly still
 * reaches exactly the tools the grant chain allows. A subscription that pays
 * for the model does not vouch for the agent using it.
 */
export interface ModelCredential {
  /**
   * How a call authenticates, in one word, for the record. Never the secret.
   */
  readonly scheme: string;
  /**
   * The headers one call presents, resolved at the instant of that call.
   *
   * Resolved per call rather than once at construction because a subscription
   * token has a validity window: a client that captured its headers when it was
   * built would keep presenting a token that had since expired. The rule is the
   * one ADR 0016 states for authority -- the operation's clock may only take
   * away -- so a token whose window has closed by the time the call is made is
   * renewed here, and a window that has not opened yet is never widened.
   */
  headers(signal: AbortSignal): Promise<Readonly<Record<string, string>>>;
  /**
   * One chance to renew, after the provider refused the call as
   * unauthenticated.
   *
   * `false` means nothing changed and the caller should not try again: there was
   * no refresh token, or the renewal returned the same access token. Absent
   * entirely on a credential that cannot renew, which is what a static key is.
   */
  renew?(signal: AbortSignal): Promise<boolean>;
  /**
   * What may be recorded about how this call authenticated.
   *
   * Identifiers and shapes, never a token and never the account code itself.
   * A record naming the paying account would put a stable, personal identifier
   * into artifacts that get committed and compared; that the seat was
   * account-scoped is the fact a reader of the record needs, and it is the
   * weaker claim.
   */
  describe(): JsonObject;
}

/** A credential that could not be presented or renewed. Carries no token. */
export class ModelCredentialError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ModelCredentialError";
    if (status !== undefined) {
      this.status = status;
    }
  }
}

/**
 * A constant key in an `authorization` header: what a metered API account is.
 *
 * It cannot renew, and the omission is the point. A 401 against a static key is
 * a configuration error, and retrying it would ask the same wrong question
 * twice.
 */
export function apiKeyCredential(apiKey: string): ModelCredential {
  if (apiKey.trim() === "") {
    throw new TypeError("A model client needs an API key");
  }
  const headers = Object.freeze({ authorization: `Bearer ${apiKey}` });
  return Object.freeze({
    scheme: "api_key",
    headers: (): Promise<Readonly<Record<string, string>>> => Promise.resolve(headers),
    describe: (): JsonObject => ({ scheme: "api_key" }),
  });
}

/**
 * Where a subscription provider's tokens come from and how its account code
 * travels.
 *
 * A profile is configuration, not code: adding a second subscription provider
 * is a second one of these, and no second credential class.
 */
export interface SubscriptionOAuthProfile {
  /** Names the issuer on every record this credential's turns produce. */
  readonly id: string;
  /** The OAuth token endpoint, which is where a refresh is exchanged. */
  readonly tokenUrl: string;
  /** The public client the login was performed by. */
  readonly clientId: string;
  /**
   * The header the provider reads the subscription's account code from.
   *
   * Subscription plans are billed per account, and the access token alone does
   * not always say which one: a login that covers several workspaces issues one
   * token and expects the account to be named alongside it.
   */
  readonly accountHeader: string;
  /** How the token endpoint wants its request body. RFC 6749 says `form`. */
  readonly encoding?: "form" | "json";
  /** Constant headers the provider requires on a subscription call. */
  readonly headers?: Readonly<Record<string, string>>;
}

/**
 * The OpenAI login a `codex login` session leaves behind.
 *
 * The client id is the public one Codex authorizes with; there is no secret in
 * a PKCE flow, which is what makes it publishable here.
 *
 * What this profile does *not* claim is that ChatGPT's own Codex backend can be
 * driven from {@link OpenAiCompatibleModelClient}. That endpoint speaks the
 * Responses API, and this client speaks chat-completions; the profile
 * authenticates a subscription against any chat-completions endpoint that
 * accepts these tokens, and pointing `baseUrl` at the Codex backend would fail
 * on the wire shape rather than on the credential.
 */
export const OPENAI_SUBSCRIPTION_PROFILE: SubscriptionOAuthProfile = Object.freeze({
  id: "openai-chatgpt",
  tokenUrl: "https://auth.openai.com/oauth/token",
  clientId: "app_EMoamEEZ73f0CkXaXp7hrann",
  accountHeader: "chatgpt-account-id",
  encoding: "json",
});

/**
 * One subscription login, as it is held between calls and persisted between
 * runs.
 *
 * JSON-safe on purpose: a host stores this wherever it stores secrets, and the
 * refresh token rotates, so the shape that comes out of a renewal is the shape
 * that has to go back to the store.
 */
export interface SubscriptionTokens {
  readonly accessToken: string;
  /** Absent on a login that cannot be renewed; the credential then cannot either. */
  readonly refreshToken?: string;
  /** RFC 3339. Absent when the provider did not say when it ends. */
  readonly expiresAt?: string;
  /**
   * The subscription account this login pays from, when the login carried one.
   *
   * Called a code rather than an id because that is what it is to SharedOS: an
   * opaque string copied into a header. Nothing here parses it, compares it, or
   * treats it as identity.
   */
  readonly accountCode?: string;
}

export interface SubscriptionOAuthCredentialOptions {
  readonly profile: SubscriptionOAuthProfile;
  readonly tokens: SubscriptionTokens;
  /** Overrides the account code the login carried, for a multi-account login. */
  readonly accountCode?: string;
  /**
   * How long before expiry a token is renewed anyway. Default 60s.
   *
   * A token that is valid when the request is written can still be expired when
   * the provider reads it. The skew renews early rather than discovering that
   * as a failed turn.
   */
  readonly refreshSkewMs?: number;
  /** How long one token exchange may take. Default 30s. */
  readonly requestTimeoutMs?: number;
  /**
   * Where renewed tokens go.
   *
   * Providers rotate the refresh token on every exchange, so a host that does
   * not persist what comes back has a login that works until the process exits
   * and then cannot be renewed at all. SharedOS stores nothing itself: this is
   * the host's sink, called with the whole set, and a failure in it is not
   * allowed to fail the model call that triggered it.
   */
  readonly onRefresh?: (tokens: SubscriptionTokens) => void | Promise<void>;
  /** The clock, RFC 3339. Injected for tests, which must not depend on real time. */
  readonly now?: () => string;
  /** Injected for tests, which must never reach a network. */
  readonly fetch?: typeof globalThis.fetch;
}

const DEFAULT_REFRESH_SKEW_MS = 60_000;
const DEFAULT_TOKEN_REQUEST_TIMEOUT_MS = 30_000;

/**
 * The fields a token endpoint answers a refresh with that are read here.
 *
 * Parsed rather than cast, for the reason the completion schema is: the
 * response is remote input, and a credential that trusted its shape would turn
 * a provider's bad day into an `undefined` presented as a bearer token.
 */
const TokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().int().positive().optional(),
  id_token: z.string().min(1).optional(),
  account_id: z.string().min(1).optional(),
});

/**
 * A subscription in the model seat.
 *
 * The provider recognises the caller as a person with a plan rather than as an
 * account with a meter, so what is presented is an access token that expires
 * and the code of the account the call is billed to. Both come from a login the
 * host already performed -- `codex login` and its equivalents -- and neither is
 * minted here: SharedOS does not run an authorization flow, has no client
 * secret, and never sees the user's password.
 *
 * Renewal is the only thing this does beyond copying headers, and it is done
 * for one reason: a turn that begins inside the validity window can outlive it,
 * and a model call refused halfway through a turn is recorded as a failed turn
 * that says nothing about SharedOS.
 */
export class SubscriptionOAuthCredential implements ModelCredential {
  readonly scheme = "subscription_oauth";
  readonly #profile: SubscriptionOAuthProfile;
  readonly #refreshSkewMs: number;
  readonly #requestTimeoutMs: number;
  readonly #onRefresh: SubscriptionOAuthCredentialOptions["onRefresh"];
  readonly #now: () => string;
  readonly #fetch: typeof globalThis.fetch;
  #tokens: SubscriptionTokens;
  #accountCode: string | undefined;
  /**
   * The exchange in flight, shared by every caller that arrives during it.
   *
   * A turn issues one call at a time, but a host may run several turns on one
   * credential, and letting each start its own exchange would spend refresh
   * tokens the provider has already rotated -- the second exchange presenting a
   * token the first one just replaced.
   */
  #exchange: Promise<SubscriptionTokens> | undefined;

  constructor(options: SubscriptionOAuthCredentialOptions) {
    if (options.tokens.accessToken.trim() === "") {
      throw new TypeError("A subscription credential needs an access token");
    }
    this.#profile = options.profile;
    this.#tokens = options.tokens;
    this.#accountCode = options.accountCode ?? options.tokens.accountCode;
    this.#refreshSkewMs = options.refreshSkewMs ?? DEFAULT_REFRESH_SKEW_MS;
    this.#requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_TOKEN_REQUEST_TIMEOUT_MS;
    this.#onRefresh = options.onRefresh;
    this.#now = options.now ?? ((): string => new Date().toISOString());
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  /** The tokens as they now stand, for a host persisting them itself. */
  get tokens(): SubscriptionTokens {
    return this.#tokens;
  }

  async headers(signal: AbortSignal): Promise<Readonly<Record<string, string>>> {
    if (this.#expiringAt(this.#now())) {
      // Expiry narrows, so it is judged at the instant of the call. A login
      // with nothing to renew from is presented as it stands rather than
      // refused here: the provider is the one that decides an expired token is
      // expired, and refusing it here would turn a possibly-live token into a
      // certainly-failed turn.
      await this.#renewIfPossible(signal);
    }
    return {
      ...this.#profile.headers,
      authorization: `Bearer ${this.#tokens.accessToken}`,
      ...(this.#accountCode === undefined
        ? {}
        : { [this.#profile.accountHeader]: this.#accountCode }),
    };
  }

  async renew(signal: AbortSignal): Promise<boolean> {
    const before = this.#tokens.accessToken;
    await this.#renewIfPossible(signal);
    return this.#tokens.accessToken !== before;
  }

  describe(): JsonObject {
    return {
      scheme: this.scheme,
      issuer: this.#profile.id,
      /** That the seat was account-scoped, never which account. */
      accountScoped: this.#accountCode !== undefined,
    };
  }

  /**
   * Whether the token's window has closed, or closes within the skew.
   *
   * An expiry that cannot be read is treated as unknown rather than as past.
   * Renewing on an unreadable field would spend a refresh token on every call
   * of a login whose provider simply never said; a token that really is dead
   * still arrives as a 401, which `renew` answers.
   */
  #expiringAt(now: string): boolean {
    const expiresAt = this.#tokens.expiresAt;
    if (expiresAt === undefined) {
      return false;
    }
    const deadline = Date.parse(expiresAt);
    const instant = Date.parse(now);
    if (Number.isNaN(deadline) || Number.isNaN(instant)) {
      return false;
    }
    return deadline - instant <= this.#refreshSkewMs;
  }

  async #renewIfPossible(signal: AbortSignal): Promise<void> {
    if (this.#tokens.refreshToken === undefined) {
      return;
    }
    // The exchange is not given the caller's signal: it is shared, and one
    // caller's turn ending must not cancel an exchange another caller is
    // waiting on. Each caller stops waiting on its own abort instead.
    this.#exchange ??= this.#exchangeRefreshToken(this.#tokens.refreshToken).finally(() => {
      this.#exchange = undefined;
    });
    // The exchange keeps its own result rather than handing it to whoever
    // awaited: a refresh token is spent once, and a caller that aborted before
    // the answer arrived must not take the renewed session down with it.
    await untilAborted(this.#exchange, signal);
  }

  async #exchangeRefreshToken(refreshToken: string): Promise<SubscriptionTokens> {
    const encoding = this.#profile.encoding ?? "form";
    const parameters = {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: this.#profile.clientId,
    };
    const requestedAt = this.#now();

    let response: Response;
    try {
      response = await this.#fetch(this.#profile.tokenUrl, {
        method: "POST",
        headers: {
          "content-type":
            encoding === "json" ? "application/json" : "application/x-www-form-urlencoded",
          accept: "application/json",
        },
        body:
          encoding === "json"
            ? JSON.stringify(parameters)
            : new URLSearchParams(parameters).toString(),
        signal: AbortSignal.timeout(this.#requestTimeoutMs),
      });
    } catch (error) {
      throw new ModelCredentialError(
        `the subscription token endpoint could not be reached: ${describe(error)}`,
      );
    }

    if (!response.ok) {
      // Read and discarded, like the completion client does with a provider
      // error: a token endpoint quotes the request back, and the request is a
      // refresh token.
      await response.text().catch(() => "");
      throw new ModelCredentialError(
        `the subscription token endpoint answered ${String(response.status)}`,
        response.status,
      );
    }

    const parsed = TokenResponseSchema.safeParse(await response.json().catch(() => undefined));
    if (!parsed.success) {
      throw new ModelCredentialError(
        "the subscription token endpoint returned an unreadable token",
      );
    }

    const renewed: SubscriptionTokens = {
      accessToken: parsed.data.access_token,
      // A provider that rotates the refresh token replaces it; one that does not
      // keeps the login working rather than dropping the only way to renew.
      refreshToken: parsed.data.refresh_token ?? refreshToken,
      ...expiryOf(parsed.data.expires_in, requestedAt),
      // The code in force, not only the one this response happened to repeat: a
      // provider that names the account once and not again must not leave the
      // host persisting a session that has forgotten which account it pays.
      ...accountOf(
        parsed.data.account_id ?? accountCodeFromIdToken(parsed.data.id_token) ?? this.#accountCode,
      ),
    };
    this.#tokens = renewed;
    this.#accountCode = renewed.accountCode ?? this.#accountCode;
    // The sink is the host's code. A store that is full, locked, or read-only is
    // a reason to warn on the next renewal, not a reason to fail the turn that
    // has a working token in hand. Caught around the call and not only on its
    // promise, because a sink that throws synchronously throws before there is
    // a promise to catch on.
    try {
      await this.#onRefresh?.(renewed);
    } catch {
      // Deliberately swallowed. See above.
    }
    return renewed;
  }
}

function expiryOf(expiresIn: number | undefined, requestedAt: string): Partial<SubscriptionTokens> {
  const instant = Date.parse(requestedAt);
  if (expiresIn === undefined || Number.isNaN(instant)) {
    return {};
  }
  return { expiresAt: new Date(instant + expiresIn * 1_000).toISOString() };
}

function accountOf(accountCode: string | undefined): Partial<SubscriptionTokens> {
  return accountCode === undefined ? {} : { accountCode };
}

/**
 * The account code an OpenAI id token carries, when it carries one.
 *
 * The claim is read, not verified. Nothing here checks the signature, and it
 * would prove nothing worth having if it did: the code is copied into a header
 * for the provider to route on, and the provider is the one that decides
 * whether this login may spend that account. Treating it as identity, or as
 * authority, is exactly the mistake this comment exists to prevent.
 *
 * Absent for a token that is unreadable, unsegmented, or carries no such claim
 * -- all of which are ordinary, and none of which are errors here.
 */
export function accountCodeFromIdToken(idToken: string | undefined): string | undefined {
  const payload = idToken?.split(".")[1];
  if (payload === undefined) {
    return undefined;
  }
  let claims: unknown;
  try {
    claims = JSON.parse(base64UrlDecode(payload));
  } catch {
    return undefined;
  }
  const parsed = IdTokenClaimsSchema.safeParse(claims);
  return parsed.success
    ? parsed.data["https://api.openai.com/auth"]?.chatgpt_account_id
    : undefined;
}

const IdTokenClaimsSchema = z.object({
  "https://api.openai.com/auth": z
    .object({ chatgpt_account_id: z.string().min(1).optional() })
    .optional(),
});

function base64UrlDecode(value: string): string {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/");
  return new TextDecoder().decode(
    Uint8Array.from(atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "=")), (character) =>
      character.charCodeAt(0),
    ),
  );
}

/**
 * Wait for shared work, but no longer than the caller's own turn.
 *
 * The work itself is not cancelled: another caller may still be waiting on it,
 * and a refresh token that was spent has been spent whether or not this turn
 * still cares about the answer.
 */
function untilAborted<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  if (!signal.aborted) {
    return Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason as Error), { once: true });
      }),
    ]);
  }
  return Promise.reject(signal.reason as Error);
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
