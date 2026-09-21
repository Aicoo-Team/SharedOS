# npm release runbook

SharedOS publishes twelve public ESM packages at one synchronized prerelease
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
3. `@aicoo/sharedos-precedent`
4. `@aicoo/sharedos-os`
5. `@aicoo/sharedos-runtime`
6. `@aicoo/sharedos-client`
7. `@aicoo/sharedos-http`
8. `@aicoo/sharedos-testkit`
9. `@aicoo/sharedos-mcp`
10. `@aicoo/sharedos-adapters`
11. `@aicoo/sharedos-conformance`
12. `@aicoo/sharedos`

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

## Trusted publishing

All twelve packages have a GitHub Actions trusted publisher on npm —
repository `Aicoo-Team/SharedOS`, workflow `release.yml` — configured on
2026-09-08. `release.yml` sets `id-token: write` and passes no npm token, so
OIDC is the workflow's only credential, and it is also what attaches
provenance: `--provenance` appears nowhere because trusted publishing does it.

A trusted publisher can only be attached **after a package exists on the
registry**. Any package added to the set in a future release therefore has to
be published by hand once and configured immediately after. Until it is, its
publish 404s, and because `scripts/release.mjs` runs the loop without a
`try`/`catch`, the run stops there: every package later in the order is never
published by CI and gets hand-published without provenance. That is what
happened to `@aicoo/sharedos-mcp` at `0.1.0-alpha.3` and to
`@aicoo/sharedos-precedent` at `0.1.0-alpha.4`.

Read or set the configuration with `npm trust`, which needs npm 11.15.0 or
newer and a credential that satisfies 2FA — a granular access token with the
bypass-2FA option is refused, as are the account endpoints generally:

```bash
npm trust list @aicoo/sharedos-mcp
npm trust github @aicoo/sharedos-mcp \
  --file release.yml --repo Aicoo-Team/SharedOS --allow-publish
```

`npm trust github` is also the better audit of the two: it reports `409
Conflict` when a matching publisher already exists, so one command either
closes the gap or proves there was none.

A green workflow run over a version whose contents are already on the registry
is **not** an end-to-end OIDC test. That version takes the `state ===
"matching"` branch, skips every `npm publish`, and exercises no credential at
all.

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

After the release PR is merged, tag that exact commit and push the tag. With
every package's trusted publisher configured, that is the whole release:

```bash
git switch main
git pull --ff-only
git tag -a v1.0.0-preview -m "SharedOS v1.0.0-preview"
git push origin v1.0.0-preview
```

`release.yml` first checks that the tag names the version in
`packages/sdk/package.json` and stops if it does not, so the tag belongs on the
release commit and nowhere else. It then runs `release:publish`, which requires
a clean worktree, the exact version tag on `HEAD`, and that commit to be
contained in `origin/main`. It publishes with public access under the `next`
dist-tag, skips a package whose identical contents are already published, and
verifies every package on the registry afterwards.

**Push the tag before publishing anything by hand.** Publishing by hand first
leaves the workflow nothing to do — it skips every package as already matching
— and no package gets a provenance attestation. Hand-publish only what the
workflow could not reach, from a clean tagged checkout, with an npm account
that controls `@aicoo`:

```bash
SHAREDOS_RELEASE_CONFIRM=v1.0.0-preview pnpm release:publish
```

Never paste an npm token, OTP, or recovery code into an issue, pull request,
shell history, or chat.

## Verify the registry

```bash
npm view @aicoo/sharedos@next version dist.integrity
npm install @aicoo/sharedos@next
npm audit signatures
```

Confirm that the workflow, not a hand publish, put each package there — a
package with no `dist.attestations` was published without provenance and is a
trusted-publisher gap to close before the next release:

```bash
for p in contracts core precedent os runtime client http testkit mcp adapters conformance; do
  printf '%-14s ' "$p"
  curl -s "https://registry.npmjs.org/@aicoo%2fsharedos-$p/1.0.0-preview" \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).dist?.attestations?"provenance":"NONE"))'
done
```

Releases land under `next`, so `latest` stays wherever the first publication
put it, and a plain `npm install @aicoo/sharedos` resolves to the oldest
release. `pnpm release:promote-latest <version>` points `latest` at one
already-published version for every package (`--dry-run` previews it); it is a
deliberate step, never part of a release. A stable release still needs a
separate decision on API compatibility, support window, security hardening,
and migration policy.
