# npm release runbook

SharedOS publishes eight public ESM packages at one synchronized prerelease
version. `@sharedos/sdk` is the recommended entry point; the other packages let
hosts choose a smaller dependency surface. Prereleases use the `next` dist-tag,
so an alpha never becomes `latest` accidentally.

## Package set and order

1. `@sharedos/contracts`
2. `@sharedos/core`
3. `@sharedos/os`
4. `@sharedos/runtime`
5. `@sharedos/client`
6. `@sharedos/http`
7. `@sharedos/testkit`
8. `@sharedos/sdk`

The release script publishes in dependency order. If a run stops after only
some packages reach npm, rerunning it verifies the registry archive's npm
integrity, skips packages whose canonical packed contents match, and resumes the
missing packages. It refuses to reuse a version when the contents differ.

## One-time bootstrap

Before the first public release, a maintainer must:

1. approve the repository license and security-reporting contact (Apache-2.0
   and `founders@aicoo.io` for the initial release);
2. enable 2FA on an npm account;
3. create or control the npm organization named `sharedos` and grant that
   account publish access;
4. merge the release metadata and workflow to `main`;
5. perform the first publication from a clean, tagged `main` checkout, because
   npm trusted publishers can only be attached after each package exists;
6. configure every package's trusted publisher as GitHub Actions,
   `Aicoo-Team/SharedOS`, workflow `release.yml`;
7. push the first version tag; its workflow verifies the published package
   contents but skips publishing the already-existing version;
8. publish the next prerelease (for example `0.1.0-alpha.1`) through its tag to
   verify OIDC end to end;
9. require 2FA and disallow token publishing after that verification.

The repository is currently private. npm supports trusted publishing from a
private GitHub repository, but npm provenance attestations require the source
repository and package both to be public. Make the repository public before the
release if public provenance is a requirement.

## Validate a release candidate

From a clean checkout:

```bash
pnpm install --frozen-lockfile
pnpm release:check
```

This command runs formatting, type checks, tests, package builds, package lint,
tarball allowlist checks, fresh runtime and TypeScript consumer tests, npm
publish dry-runs, version collision checks, and packed-content comparisons.
It does not publish.

## First publication

After the release PR is merged, tag that exact commit and authenticate using an
npm account that controls `@sharedos`. Never paste an npm token or OTP into an
issue, pull request, shell history, or chat.

```bash
git switch main
git pull --ff-only
git tag -a v0.1.0-alpha.0 -m "SharedOS v0.1.0-alpha.0"
SHAREDOS_RELEASE_CONFIRM=v0.1.0-alpha.0 pnpm release:publish
```

`release:publish` requires a clean worktree, the exact version tag on `HEAD`,
and that commit to be contained in `origin/main`. It always publishes with
public access to the official npm registry under the `next` dist-tag.

After all eight packages exist, configure `release.yml` as their trusted
publisher on npm and then push the tag:

```bash
git push origin v0.1.0-alpha.0
```

The first tag workflow verifies and skips packages with identical canonical
contents. That proves the GitHub release path is reproducible, but it does not
exercise OIDC because no `npm publish` call is needed. Publish the next
prerelease entirely through a tag after trusted publishing is configured; that
is the end-to-end OIDC test. Subsequent releases follow the same versioned
commit and matching-tag flow, and no long-lived npm token belongs in GitHub
Actions.

## Verify the registry

```bash
npm view @sharedos/sdk@next version dist.integrity
npm install @sharedos/sdk@next
npm audit signatures
```

Do not promote an alpha to `latest`. A stable release needs a separate decision
on API compatibility, support window, security hardening, and migration policy.
