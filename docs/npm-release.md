# npm release runbook

SharedOS publishes eleven public ESM packages at one synchronized prerelease
version. `@aicoo/sharedos` is the recommended entry point; the other packages let
hosts choose a smaller dependency surface. Prereleases use the `next` dist-tag,
so an alpha never becomes `latest` accidentally.

The initial public distribution lives under the existing `@aicoo` npm
organization. A future move to another scope, such as `@systemind/sharedos`, is
a new package identity rather than an in-place rename: publish the new package,
deprecate the old one with a migration message, and support an overlap window.

## Package set and order

1. `@aicoo/sharedos-contracts`
2. `@aicoo/sharedos-core`
3. `@aicoo/sharedos-os`
4. `@aicoo/sharedos-runtime`
5. `@aicoo/sharedos-client`
6. `@aicoo/sharedos-http`
7. `@aicoo/sharedos-testkit`
8. `@aicoo/sharedos-mcp`
9. `@aicoo/sharedos-adapters`
10. `@aicoo/sharedos-conformance`
11. `@aicoo/sharedos`

The order is the one in `scripts/package-set.mjs`, and it is a dependency
order: every package appears after everything it depends on, so a run that
stops part-way never leaves a package on the registry ahead of one it needs.
`pnpm release:check` refuses to run against an order that breaks this, and
`pnpm test:release` checks it against the package manifests.

The release script publishes in that order. If a run stops after only
some packages reach npm, rerunning it verifies the registry archive's npm
integrity, skips packages whose canonical packed contents match, and resumes the
missing packages. It refuses to reuse a version when the contents differ.

## How the first publication was done

`0.1.0-alpha.0` was published by hand from a clean, tagged `main` checkout,
because npm trusted publishers can only be attached after each package exists.
What it needed still holds for any manual publication: an npm account with 2FA
that holds publish access in the `aicoo` organization, the release metadata and
workflow merged to `main`, and the license and security-reporting contact
(Apache-2.0 and `founders@aicoo.io`) approved.

The transition to trusted publishing is:

1. configure every package's trusted publisher on npm as GitHub Actions,
   `Aicoo-Team/SharedOS`, workflow `release.yml`;
2. publish the next prerelease entirely through its tag, which is the
   end-to-end OIDC test — a tag for a version whose contents are already on
   the registry verifies and skips, and exercises no `npm publish`;
3. require 2FA and disallow token publishing after that verification.

The repository and the packages are public, so npm provenance attestations are
available to the workflow. Whether each step above has been completed is
recorded on npm, not here; check a package's publishing settings before
assuming the tag alone will publish.

## Validate a release candidate

From a clean checkout:

```bash
pnpm install --frozen-lockfile
pnpm release:check
```

This runs, in order: the package-set checks (one shared version, dependency
order, release metadata, embedded version constants, per-package licenses);
`pnpm check` — formatting, type checks, tests, the release-script tests, the
generated API reference, and the conformance manifest; `pnpm pack:preview` —
package builds, tarballs with `workspace:*` rewritten to exact versions and
their contents checked (README, license, entry points and sources present; no
test or build-cache files), and the fresh-consumer runtime and TypeScript smoke
tests; package lint; a comparison of each tarball against what the registry
already holds; and an `npm publish --dry-run` per tarball. It does not publish.

## Publishing a prerelease

After the release PR is merged, tag that exact commit. A manual publication
needs an npm account that controls `@aicoo`; never paste an npm token or OTP
into an issue, pull request, shell history, or chat.

```bash
git switch main
git pull --ff-only
git tag -a v0.1.0-alpha.3 -m "SharedOS v0.1.0-alpha.3"
SHAREDOS_RELEASE_CONFIRM=v0.1.0-alpha.3 pnpm release:publish
```

`release:publish` requires a clean worktree, the exact version tag on `HEAD`,
and that commit to be contained in `origin/main`. It always publishes with
public access to the official npm registry under the `next` dist-tag, skips a
package whose identical contents are already published, and verifies every
package on the registry afterwards.

Pushing the tag runs `release.yml`, which repeats the verification and
publishes whatever the tag's version is missing on the registry:

```bash
git push origin v0.1.0-alpha.3
```

With trusted publishing configured, pushing the tag is the whole release and
no long-lived npm token belongs in GitHub Actions. Until then, the manual
publication above comes first and the workflow verifies and skips.

## Verify the registry

```bash
npm view @aicoo/sharedos@next version dist.integrity
npm install @aicoo/sharedos@next
npm audit signatures
```

Releases land under `next`, so `latest` stays wherever the first publication
put it, and a plain `npm install @aicoo/sharedos` resolves to the oldest
release. `pnpm release:promote-latest <version>` points `latest` at one
already-published version for every package (`--dry-run` previews it); it is a
deliberate step, never part of a release. A stable release still needs a
separate decision on API compatibility, support window, security hardening,
and migration policy.
