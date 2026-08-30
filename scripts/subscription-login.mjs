/**
 * Sign in to a model subscription, or sign out of one, without the vendor's CLI.
 *
 * Signing in is a device login: the provider issues a short code, you type it
 * into a page on any device with a browser, and this waits. Nothing is typed
 * here, no password is seen here, and no vendor binary has to be installed --
 * the login this writes is the same file `codex login` writes, so the tools
 * that read it, including `SHAREDOS_MODEL_AUTH=codex-subscription` in
 * `conformance:native`, find it where they already look.
 *
 * Signing out tells the provider first and deletes the stored session second,
 * because only the first of those ends anything: a login deleted from this
 * machine still works anywhere a copy of it survives.
 *
 * Device login is off by default on a ChatGPT account. Turn it on first, under
 * the account's security settings (a workspace admin turns it on for a
 * workspace); until then the provider answers the first request with a 404 and
 * this says so.
 *
 * Usage:
 *   node scripts/subscription-login.mjs
 *   node scripts/subscription-login.mjs --logout
 *   node scripts/subscription-login.mjs --logout --local
 *   node scripts/subscription-login.mjs --path ./auth.json
 */
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const loggingOut = args.includes("--logout");
const localOnly = args.includes("--local");
const pathIndex = args.indexOf("--path");
const path = pathIndex === -1 ? undefined : args[pathIndex + 1];
const where = path === undefined ? {} : { path };

if (pathIndex !== -1 && path === undefined) {
  fail("--path needs a file to write the login to.", 2);
}
if (localOnly && !loggingOut) {
  fail("--local only means something with --logout.", 2);
}

const adapters = await load("index.js");
const node = await load("node.js");
// Resolved once, and the same way the library resolves it, so every message
// names the file that was actually touched rather than the default.
const target = path ?? node.codexLoginPath(process.env);

if (loggingOut) {
  await logout();
} else {
  await login();
}

async function logout() {
  if (localOnly) {
    // Named `--local` rather than `--force` in the output as well as the flag:
    // what it does is forget, and calling that a log-out would be the mistake
    // this whole path exists to avoid.
    const forgotten = await node.forgetCodexLogin(where);
    console.log(
      forgotten
        ? `Removed the stored session from ${target}.`
        : `No stored session was found in ${target}. Nothing was removed.`,
    );
    console.log(
      "\nThe provider was not told, so that login still works wherever a copy of it exists.",
    );
    console.log("Revoke it properly with `--logout`, or from the account's security settings.");
    return;
  }

  let outcome;
  try {
    outcome = await node.logoutCodexSubscription(where);
  } catch (error) {
    console.error(`\n${message(error)}`);
    console.error(
      "\nThe stored login was left in place so this can be retried. Use `--logout --local` to",
    );
    console.error("remove it anyway, and revoke it from the account's security settings.");
    process.exit(1);
  }

  if (outcome.revoked === "nothing" && !outcome.forgotten) {
    console.log(`No login was found in ${target}. Nothing to end.`);
    return;
  }
  console.log(`Revoked the ${outcome.revoked.replace("_", " ")} at the provider.`);
  console.log(
    outcome.forgotten
      ? `Removed the stored session from ${target}.`
      : "There was no stored session to remove.",
  );
}

async function login() {
  // Ctrl-C ends the wait rather than the process mid-write: a login half
  // written is a login that cannot be renewed.
  const stopping = new AbortController();
  process.on("SIGINT", () => {
    stopping.abort(new Error("login cancelled"));
  });

  let pending;
  try {
    pending = await adapters.requestDeviceAuthorization();
  } catch (error) {
    fail(message(error), 1);
  }

  console.log("\nSign in to your subscription:\n");
  console.log(`  1. Open  ${pending.verificationUri}`);
  console.log(`  2. Enter this one-time code:  ${pending.userCode}`);
  console.log(`\nWaiting until ${pending.expiresAt}. Press Ctrl-C to stop.`);

  try {
    const tokens = await pending.wait(stopping.signal);
    const written = await node.saveCodexLogin(tokens, where);
    // The account code, never the tokens. This output ends up in scrollback, in
    // CI logs, and in whatever someone pastes into an issue.
    console.log(
      `\nSigned in${tokens.accountCode === undefined ? "" : ` to account ${tokens.accountCode}`}.`,
    );
    console.log(`Login written to ${written}`);
    console.log("\nRun the model column on it with:");
    console.log("  SHAREDOS_MODEL_AUTH=codex-subscription pnpm conformance:native --harness model");
  } catch (error) {
    fail(message(error), 1);
  }
}

async function load(entry) {
  try {
    return await import(join(root, "packages", "adapters", "dist", entry));
  } catch {
    return fail("The adapters package is not built. Run `pnpm build` first.", 2);
  }
}

function message(error) {
  return error instanceof Error ? error.message : String(error);
}

function fail(text, code) {
  console.error(text.startsWith("\n") ? text : `\n${text}`);
  process.exit(code);
}
