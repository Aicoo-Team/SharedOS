import { z } from "zod";

import {
  ModelCredentialError,
  OPENAI_SUBSCRIPTION_PROFILE,
  postJson,
  requestTokenGrant,
  type SubscriptionOAuthProfile,
  type SubscriptionTokens,
  type TokenGrantOptions,
} from "./credential.js";

/**
 * Device login: authorizing on a machine that has no browser.
 *
 * The provider issues a short code, the person opens a page on whatever device
 * they do have and types it in, and this polls until they have finished.
 * Nothing is typed into SharedOS and nothing here ever sees a password.
 *
 * This is the provider's own device-authorization protocol, not RFC 8628. The
 * difference is not cosmetic and is worth stating where a reader will look for
 * it: the endpoints live under the issuer's account server rather than at a
 * `device_authorization_endpoint`, the poll is answered with `403`/`404` while
 * the login is pending rather than with `authorization_pending`, and what a
 * finished poll returns is not a token at all -- it is an authorization code,
 * together with the PKCE verifier the *server* generated for it, which is then
 * exchanged at the ordinary token endpoint. A client written to the RFC would
 * fail at the first request, which is exactly what happens if you go looking
 * for the grant in the OpenID discovery document.
 *
 * Everything here is taken from the vendor's own implementation
 * (`codex-rs/login/src/device_code_auth.rs`) rather than from a specification,
 * because for this flow the implementation is the specification.
 */

/** What the account server answers a user-code request with. */
const UserCodeSchema = z.object({
  device_auth_id: z.string().min(1),
  // The provider spells it both ways; its own client accepts either.
  user_code: z.string().min(1).optional(),
  usercode: z.string().min(1).optional(),
  // And sends the interval as a string about as often as a number.
  interval: z.union([z.number().int().positive(), z.string().regex(/^\d+$/u)]).optional(),
});

/**
 * What a finished poll answers with.
 *
 * The verifier is the server's, not this client's. In an ordinary PKCE login
 * the client invents the verifier and keeps it secret until the exchange; here
 * the person authorizing is on a different device entirely, so the server holds
 * both halves and hands them over once it is satisfied. It is carried straight
 * into the exchange and never stored.
 */
const DeviceCodeSchema = z.object({
  authorization_code: z.string().min(1),
  code_verifier: z.string().min(1),
});

/** The provider's own ceiling: a user code is dead a quarter of an hour later. */
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1_000;
const DEFAULT_INTERVAL_MS = 5_000;

export interface DeviceAuthorizationOptions extends TokenGrantOptions {
  /** Default {@link OPENAI_SUBSCRIPTION_PROFILE}. */
  readonly profile?: SubscriptionOAuthProfile;
  /** A floor under the provider's polling interval. */
  readonly minimumIntervalMs?: number;
  /** How long the person has. Default 15 minutes, which is the provider's. */
  readonly timeoutMs?: number;
}

/**
 * A login a person has been asked to complete somewhere else.
 *
 * Two phases rather than one call, because between them something has to be put
 * in front of a human. A single function that polled internally would have to
 * print, and where that text goes is not a library's decision.
 */
export interface DeviceAuthorization {
  /** Short, and theirs to type. */
  readonly userCode: string;
  /** The page they type it into. */
  readonly verificationUri: string;
  /** RFC 3339. After this they start again. */
  readonly expiresAt: string;
  /** How often this asks, as the provider asked it to. */
  readonly intervalMs: number;
  /** Poll until they finish, the code dies, or the caller gives up. */
  wait(signal: AbortSignal): Promise<SubscriptionTokens>;
}

/**
 * Ask the provider to start a device login.
 *
 * The tokens this eventually produces are the same {@link SubscriptionTokens} a
 * stored vendor login yields, so what consumes them --
 * {@link SubscriptionOAuthCredential}, and the store a host keeps them in --
 * cannot tell which flow obtained them.
 */
export async function requestDeviceAuthorization(
  options: DeviceAuthorizationOptions = {},
): Promise<DeviceAuthorization> {
  const profile = options.profile ?? OPENAI_SUBSCRIPTION_PROFILE;
  const issuer = issuerOf(profile);
  const requestedAt = (options.now ?? nowIso)();

  const response = await postJson(
    `${issuer}/api/accounts/deviceauth/usercode`,
    { client_id: profile.clientId },
    options,
    "the device authorization endpoint",
  );
  if (!response.ok) {
    // A 404 here is not a missing route, it is a refused capability: the
    // provider gates device login per account, and saying so is the difference
    // between a person enabling a setting and a person filing a bug.
    await response.text().catch(() => "");
    throw new ModelCredentialError(
      response.status === 404
        ? "device login is not enabled for this account; a person or a workspace admin turns it on in the provider's security settings"
        : `the device authorization endpoint answered ${String(response.status)}`,
      response.status,
    );
  }

  const parsed = UserCodeSchema.safeParse(await response.json().catch(() => undefined));
  const userCode = parsed.success ? (parsed.data.user_code ?? parsed.data.usercode) : undefined;
  if (!parsed.success || userCode === undefined) {
    throw new ModelCredentialError("the device authorization endpoint returned an unreadable code");
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const intervalMs = Math.max(intervalOf(parsed.data.interval), options.minimumIntervalMs ?? 0);

  const expiresAt = instantAfter(requestedAt, timeoutMs);
  return {
    userCode,
    verificationUri: `${issuer}/codex/device`,
    expiresAt,
    intervalMs,
    wait: (signal: AbortSignal): Promise<SubscriptionTokens> =>
      wait(
        { deviceAuthId: parsed.data.device_auth_id, userCode, intervalMs },
        { ...options, profile, issuer, expiresAt },
        signal,
      ),
  };
}

/**
 * Ask, wait, ask again, and exchange what a finished login hands back.
 *
 * `403` and `404` are the ordinary state of a login nobody has finished yet, so
 * neither ends the wait. Anything else does: a login that will not succeed
 * should not be polled until its code expires.
 */
async function wait(
  device: { readonly deviceAuthId: string; readonly userCode: string; readonly intervalMs: number },
  context: DeviceAuthorizationOptions & {
    readonly profile: SubscriptionOAuthProfile;
    readonly issuer: string;
    readonly expiresAt: string;
  },
  signal: AbortSignal,
): Promise<SubscriptionTokens> {
  const now = context.now ?? nowIso;

  for (;;) {
    throwIfAborted(signal);
    if (Date.parse(now()) >= Date.parse(context.expiresAt)) {
      throw new ModelCredentialError("the device code expired before the login was authorized");
    }

    let response: Response;
    try {
      response = await postJson(
        `${context.issuer}/api/accounts/deviceauth/token`,
        { device_auth_id: device.deviceAuthId, user_code: device.userCode },
        context,
        "the device authorization endpoint",
      );
    } catch (error) {
      // A dropped packet is not a failed login. Somebody has already typed the
      // code by now, and ending their login on one unreachable poll -- of the
      // dozens this makes over a quarter of an hour -- would be this client
      // giving up on their behalf. Only a transport failure is retried, which
      // is the one this can tell apart: it carries no status, because no server
      // answered. The deadline above is what stops the retrying.
      if (!(error instanceof ModelCredentialError) || error.status !== undefined) {
        throw error;
      }
      await sleep(device.intervalMs, signal);
      continue;
    }

    if (response.ok) {
      const parsed = DeviceCodeSchema.safeParse(await response.json().catch(() => undefined));
      if (!parsed.success) {
        throw new ModelCredentialError("the device login returned an unreadable authorization");
      }
      return exchange(parsed.data.authorization_code, parsed.data.code_verifier, context);
    }

    await response.text().catch(() => "");
    if (response.status !== 403 && response.status !== 404) {
      throw new ModelCredentialError(
        `the device login failed: the provider answered ${String(response.status)}`,
        response.status,
      );
    }
    await sleep(device.intervalMs, signal);
  }
}

/**
 * Trade a finished device login for the tokens themselves.
 *
 * An ordinary authorization-code exchange, with two things worth naming. The
 * verifier is the server's rather than this client's -- see
 * {@link DeviceCodeSchema} -- and the redirect URI is where the provider would
 * have sent a browser. Nothing listens on it and nothing in this flow ever
 * opens one; it is sent because the code was issued against it, and an exchange
 * that named a different one would be refused.
 *
 * The encoding is the profile's for a code exchange, which is not always the
 * one it uses for a refresh: the provider this was written against takes a
 * refresh as JSON and this as a form.
 */
async function exchange(
  code: string,
  verifier: string,
  context: DeviceAuthorizationOptions & {
    readonly profile: SubscriptionOAuthProfile;
    readonly issuer: string;
  },
): Promise<SubscriptionTokens> {
  const { profile } = context;
  const encoding = context.encoding ?? profile.codeExchangeEncoding ?? profile.encoding;
  const grant = await requestTokenGrant(
    profile,
    {
      grant_type: "authorization_code",
      code,
      redirect_uri: `${context.issuer}/deviceauth/callback`,
      client_id: profile.clientId,
      code_verifier: verifier,
    },
    { ...context, ...(encoding === undefined ? {} : { encoding }) },
  );
  if (!grant.granted) {
    throw new ModelCredentialError(
      `the device login could not be completed: the token endpoint answered ${String(grant.status)}${grant.code === undefined ? "" : ` (${grant.code})`}`,
      grant.status,
    );
  }
  return grant.tokens;
}

function issuerOf(profile: SubscriptionOAuthProfile): string {
  const issuer = profile.issuerUrl;
  if (issuer === undefined) {
    // Named rather than guessed. A provider without an issuer root in its
    // profile has no device login here, and posting to a likely path would
    // report that as a 404 from a broken client.
    throw new ModelCredentialError(`the ${profile.id} profile declares no device login`);
  }
  return issuer.replace(/\/+$/u, "");
}

function intervalOf(interval: number | string | undefined): number {
  if (typeof interval === "number") {
    return interval * 1_000;
  }
  const parsed = interval === undefined ? Number.NaN : Number.parseInt(interval, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? DEFAULT_INTERVAL_MS : parsed * 1_000;
}

function instantAfter(instant: string, ms: number): string {
  const parsed = Date.parse(instant);
  return new Date((Number.isNaN(parsed) ? Date.now() : parsed) + ms).toISOString();
}

function nowIso(): string {
  return new Date().toISOString();
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw signal.reason instanceof Error ? signal.reason : new Error(String(signal.reason));
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(signal.reason instanceof Error ? signal.reason : new Error(String(signal.reason)));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
