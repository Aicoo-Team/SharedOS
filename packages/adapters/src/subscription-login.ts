import { readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { z } from "zod";

import {
  accountCodeFromIdToken,
  ModelCredentialError,
  OPENAI_SUBSCRIPTION_PROFILE,
  revokeSubscriptionLogin,
  SubscriptionOAuthCredential,
  type RevocationOptions,
  type SubscriptionOAuthCredentialOptions,
  type SubscriptionRevocation,
  type SubscriptionTokens,
} from "./model/index.js";

/**
 * Obtaining a subscription login, and reading the one a vendor CLI left behind.
 *
 * Two ways in, and neither holds a secret of SharedOS's own. A login some
 * vendor command already performed is read off disk. A login nobody has
 * performed yet is obtained by device code -- `requestDeviceAuthorization`,
 * host-neutral, in the main entry point -- which needs no browser on this
 * machine and no vendor CLI installed.
 *
 * One way out, in two halves that are not interchangeable.
 * {@link logoutCodexSubscription} tells the provider first and forgets the file
 * second, because only the first of those ends the session: a login this
 * machine has deleted is still a working login anywhere a copy of the refresh
 * token survives.
 *
 * Both end at the same {@link SubscriptionTokens}, so what consumes a login
 * cannot tell which produced it (ADR 0020).
 *
 * What stays true either way: SharedOS is a public client with no secret, it
 * never sees a password -- the provider's own page does -- and a login it
 * obtained is revoked exactly where the provider documents, because there is
 * nothing else holding it open.
 *
 * Node only. Published from `@aicoo/sharedos-adapters/node` so the main entry
 * point stays host-neutral.
 */

/** Where `codex login` writes its session, and how to point elsewhere. */
export interface StoredLoginOptions {
  /** The login file itself. Overrides every other way of finding it. */
  readonly path?: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
}

/**
 * The path Codex keeps its login at.
 *
 * `CODEX_HOME` is honoured because Codex honours it: a host that moved the
 * directory has one login, not two, and reading the default would silently
 * find the wrong file or none.
 */
export function codexLoginPath(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const home = environment["CODEX_HOME"];
  return join(home !== undefined && home !== "" ? home : join(homedir(), ".codex"), "auth.json");
}

/**
 * What Codex writes, of which only the tokens are read.
 *
 * Loose on purpose: the file is the vendor's, its shape is theirs to change,
 * and a field this does not know about is preserved rather than dropped when
 * the file is written back.
 */
const CodexLoginSchema = z.object({
  tokens: z
    .object({
      access_token: z.string().min(1),
      refresh_token: z.string().min(1).optional(),
      id_token: z.string().min(1).optional(),
      account_id: z.string().min(1).optional(),
    })
    .optional(),
});

/**
 * The subscription tokens in a stored Codex login, if there are any.
 *
 * `undefined` covers every ordinary way of not being logged in -- no file, an
 * unreadable one, a file holding an API key instead of a session -- because
 * none of them is an error here. A caller decides what an absent login means;
 * `native-conformance.mjs` reports the column unavailable, exactly as it does
 * for an absent binary.
 *
 * No expiry is returned. Codex's file records when the session was last
 * refreshed, not when the access token stops working, and deriving one from the
 * other would be inventing a fact: the credential therefore renews when the
 * provider says 401 rather than in anticipation. A host that knows its
 * provider's token lifetime can say so through
 * {@link SubscriptionOAuthCredentialOptions.tokens} itself.
 */
export async function readCodexLogin(
  options: StoredLoginOptions = {},
): Promise<SubscriptionTokens | undefined> {
  const parsed = CodexLoginSchema.safeParse(await readLoginFile(loginPath(options)));
  const tokens = parsed.success ? parsed.data.tokens : undefined;
  if (tokens === undefined) {
    return undefined;
  }
  const accountCode = tokens.account_id ?? accountCodeFromIdToken(tokens.id_token);
  return {
    accessToken: tokens.access_token,
    ...(tokens.refresh_token === undefined ? {} : { refreshToken: tokens.refresh_token }),
    ...(accountCode === undefined ? {} : { accountCode }),
  };
}

export type CodexSubscriptionCredentialOptions = StoredLoginOptions &
  Omit<SubscriptionOAuthCredentialOptions, "profile" | "tokens" | "onRefresh"> & {
    /**
     * Whether a renewed token is written back to the login file. Default true.
     *
     * The provider rotates the refresh token on every exchange, so a run that
     * does not write back leaves the file holding a token that has already been
     * spent -- and the next `codex` invocation, or the next run, finds a login
     * it cannot renew. Turn it off only for a read-only copy of a login.
     */
    readonly persist?: boolean;
  };

/**
 * A Codex subscription in the model seat, from the login already on this
 * machine.
 *
 * `undefined` when there is no login to read, which is a precondition rather
 * than a failure -- the same answer `probeHarness` gives for a missing binary.
 */
export async function createCodexSubscriptionCredential(
  options: CodexSubscriptionCredentialOptions = {},
): Promise<SubscriptionOAuthCredential | undefined> {
  const tokens = await readCodexLogin(options);
  if (tokens === undefined) {
    return undefined;
  }
  const path = loginPath(options);
  const { path: _path, env: _env, persist, ...credential } = options;
  return new SubscriptionOAuthCredential({
    ...credential,
    profile: OPENAI_SUBSCRIPTION_PROFILE,
    tokens,
    ...(persist === false ? {} : { onRefresh: (renewed) => writeCodexLogin(path, renewed) }),
  });
}

export interface SubscriptionLogoutOptions extends StoredLoginOptions, RevocationOptions {
  /**
   * Forget the login even when the provider could not be told. Default false.
   *
   * The default refuses to forget, and it is the safer of the two: a file this
   * deleted while the revocation failed is a live session with nothing left
   * pointing at it, which cannot be retried and cannot be audited. Force it for
   * the case where that is the lesser problem -- a machine being decommissioned,
   * an endpoint that is down -- and the failure comes back in the result rather
   * than being swallowed.
   */
  readonly force?: boolean;
}

/** What a log-out actually managed to do. */
export interface SubscriptionLogout {
  /** Which token the provider was handed back, or that there was none. */
  readonly revoked: SubscriptionRevocation;
  /** Whether a session was removed from the login file. */
  readonly forgotten: boolean;
  /** Present when `force` forgot a login the provider was never told about. */
  readonly failure?: ModelCredentialError;
}

/**
 * End a subscription login: at the provider, then here.
 *
 * That order is the whole design. Revoking first means a failure leaves the
 * login intact and the log-out retryable; forgetting first would leave a live
 * session that this machine can no longer name, let alone revoke.
 *
 * A machine with no login to end is not an error. It reports that nothing was
 * revoked and nothing was forgotten, which is the honest answer and the one a
 * script can print without pretending something happened.
 */
export async function logoutCodexSubscription(
  options: SubscriptionLogoutOptions = {},
): Promise<SubscriptionLogout> {
  const tokens = await readCodexLogin(options);
  if (tokens === undefined) {
    return { revoked: "nothing", forgotten: false };
  }

  let revoked: SubscriptionRevocation = "nothing";
  let failure: ModelCredentialError | undefined;
  try {
    revoked = await revokeSubscriptionLogin(tokens, options);
  } catch (error) {
    if (options.force !== true) {
      throw error;
    }
    failure =
      error instanceof ModelCredentialError
        ? error
        : new ModelCredentialError(
            `the login could not be revoked: ${error instanceof Error ? error.message : String(error)}`,
          );
  }

  const forgotten = await forgetCodexLogin(options);
  return { revoked, forgotten, ...(failure === undefined ? {} : { failure }) };
}

/**
 * Remove the stored session, and nothing else in the file.
 *
 * The vendor's login file is not only a session: it can hold an API key, which
 * is a different credential a person did not ask to lose. So the session is
 * removed and the rest of the file is written back unchanged, rather than the
 * file being deleted.
 *
 * `false` means there was nothing to forget -- no file, or a file with no
 * session -- and nothing was written.
 */
export async function forgetCodexLogin(options: StoredLoginOptions = {}): Promise<boolean> {
  return rewriteLoginFile(loginPath(options), (existing) => {
    if (existing["tokens"] === undefined && existing["last_refresh"] === undefined) {
      return undefined;
    }
    const { tokens: _tokens, last_refresh: _lastRefresh, ...rest } = existing;
    return rest;
  });
}

/** Write a login where the vendor's own tools will find it. */
export async function saveCodexLogin(
  tokens: SubscriptionTokens,
  options: StoredLoginOptions = {},
): Promise<string> {
  const path = loginPath(options);
  await writeCodexLogin(path, tokens);
  return path;
}

/**
 * Put a renewed session back where the vendor keeps it.
 *
 * Every field the file already had is preserved: this rewrites the session, and
 * the rest of the file is the vendor's business.
 */
async function writeCodexLogin(path: string, tokens: SubscriptionTokens): Promise<void> {
  await rewriteLoginFile(path, (existing) => {
    const session = (existing["tokens"] ?? {}) as Record<string, unknown>;
    return {
      ...existing,
      tokens: {
        ...session,
        access_token: tokens.accessToken,
        ...(tokens.refreshToken === undefined ? {} : { refresh_token: tokens.refreshToken }),
        ...(tokens.accountCode === undefined ? {} : { account_id: tokens.accountCode }),
      },
      last_refresh: new Date().toISOString(),
    };
  });
}

/**
 * Read the login file, change it, and put it back atomically.
 *
 * Written through a temporary file in the same directory and renamed over the
 * original, because the alternative is a truncated login: a process that dies
 * mid-write would leave the user unable to renew and unable to see why. A
 * transform that returns `undefined` means there was nothing to do, and nothing
 * is written -- which is how forgetting a login that was never there avoids
 * creating a file to hold its absence.
 */
async function rewriteLoginFile(
  path: string,
  transform: (existing: Record<string, unknown>) => Record<string, unknown> | undefined,
): Promise<boolean> {
  const updated = transform(((await readLoginFile(path)) ?? {}) as Record<string, unknown>);
  if (updated === undefined) {
    return false;
  }
  const temporary = join(dirname(path), `.auth.json.${String(process.pid)}.tmp`);
  // 0600 on the temporary file, not on the rename: the file holds a live
  // session from the instant it is written, and widening it for even one
  // syscall is a window nothing here needs to open.
  await writeFile(temporary, `${JSON.stringify(updated, undefined, 2)}\n`, { mode: 0o600 });
  await rename(temporary, path);
  return true;
}

async function readLoginFile(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    // Missing, unreadable, or not JSON. All three mean the same thing to a
    // caller -- there is no login here -- and none of them is worth a stack
    // trace that names a path holding a secret.
    return undefined;
  }
}

function loginPath(options: StoredLoginOptions): string {
  return options.path ?? codexLoginPath(options.env ?? process.env);
}
