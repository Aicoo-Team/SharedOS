/**
 * Sign in to a model subscription, without the vendor's CLI.
 *
 * The provider issues a short code, you type it into a page on any device with
 * a browser, and this waits. Nothing is typed here, no password is seen here,
 * and no vendor binary has to be installed: the login this writes is the same
 * file `codex login` writes, so the tools that read it -- including
 * `SHAREDOS_MODEL_AUTH=codex-subscription` in `conformance:native` -- find it
 * where they already look.
 *
 * Device login is off by default on a ChatGPT account. Turn it on first, under
 * the account's security settings (a workspace admin turns it on for a
 * workspace); until then the provider answers the first request with a 404 and
 * this says so.
 *
 * Usage:
 *   node scripts/subscription-login.mjs
 *   node scripts/subscription-login.mjs --path ./auth.json
 */
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const pathIndex = args.indexOf("--path");
const path = pathIndex === -1 ? undefined : args[pathIndex + 1];
if (pathIndex !== -1 && path === undefined) {
  console.error("--path needs a file to write the login to.");
  process.exit(2);
}

let requestDeviceAuthorization;
let saveCodexLogin;
try {
  ({ requestDeviceAuthorization } = await import(
    join(root, "packages", "adapters", "dist", "index.js")
  ));
  ({ saveCodexLogin } = await import(join(root, "packages", "adapters", "dist", "node.js")));
} catch {
  console.error("The adapters package is not built. Run `pnpm build` first.");
  process.exit(2);
}

// Ctrl-C ends the wait rather than the process mid-write: a login half-written
// is a login that cannot be renewed.
const stopping = new AbortController();
process.on("SIGINT", () => {
  stopping.abort(new Error("login cancelled"));
});

let login;
try {
  login = await requestDeviceAuthorization();
} catch (error) {
  console.error(`\n${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

console.log("\nSign in to your subscription:\n");
console.log(`  1. Open  ${login.verificationUri}`);
console.log(`  2. Enter this one-time code:  ${login.userCode}`);
console.log(`\nWaiting until ${login.expiresAt}. Press Ctrl-C to stop.`);

try {
  const tokens = await login.wait(stopping.signal);
  const written = await saveCodexLogin(tokens, path === undefined ? {} : { path });
  // The account code, never the tokens. This output ends up in scrollback, in
  // CI logs, and in whatever someone pastes into an issue.
  console.log(
    `\nSigned in${tokens.accountCode === undefined ? "" : ` to account ${tokens.accountCode}`}.`,
  );
  console.log(`Login written to ${written}`);
  console.log("\nRun the model column on it with:");
  console.log("  SHAREDOS_MODEL_AUTH=codex-subscription pnpm conformance:native --harness model");
} catch (error) {
  console.error(`\n${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
