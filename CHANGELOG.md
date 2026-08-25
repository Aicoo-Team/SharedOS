# Changelog

All notable changes to SharedOS are recorded here. The packages share one
version and are published together under npm's `next` dist-tag.

SharedOS is a `0.x` prerelease: contracts may change between prereleases, and
each entry calls out what a host has to update.

## Unreleased

### Added

- `RuntimeVisibleContext.reach` and `kernel.reach(context)`: a runtime can now
  discover the shape of its own scope — namespace, path, actions, scope —
  without being shown a grant, an issuer, an expiry, or a use count. A tool's
  `requiredCapability` is the ceiling it could ever need, so the catalog could
  never answer "where may I look"; a model either guessed paths and collected
  denials, or the host read raw grants and injected them into the prompt, at
  exactly the boundary designed to keep grants away from the model. Only
  currently eligible grants contribute, and asking never consumes one.

- A quickstart with two working programs, an HTTP API reference covering every
  route and status code, a tool catalog covering the twelve `files` tools and
  how to register your own, and a reason/error code reference. None of this was
  documented outside the source before.
- `pnpm release:promote-latest <version>` moves the `latest` dist-tag across the
  whole package set in one command, refusing to act unless every package has
  published that version.

### Fixed

- The client example in the host integration guide passed a `token` option that
  `SharedOSClientOptions` has never had. It is `headers`, which accepts a value
  or an async function.
- Publish verification retried the same registry URL with default caching, so a
  CDN edge holding a pre-publish `404` made the whole window unwinnable and a
  successful release reported failure. It now backs off up to five minutes and
  requests an uncached response each time.

## 0.1.0-alpha.2

### Added

- `deriveGrant` and `GrantChainResolver` in `@aicoo/sharedos-core`: a grant
  holder can pass on a strictly narrower slice of what it holds without the
  resource owner writing the row. Every axis — path, actions, scope, purpose,
  time window, and chain length — is checked separately, and a request that is
  not within the parent is refused rather than clamped. The chain is bound at
  use time, so a later revocation or expiry upstream still invalidates
  everything derived from it. ([#8](https://github.com/Aicoo-Team/SharedOS/pull/8))
- `examples/fleet-delegation`, a runnable delegation walkthrough in
  workcell vocabulary. ([#8](https://github.com/Aicoo-Team/SharedOS/pull/8))
- `examples/reference-host`, a working host: a filesystem `files` provider
  covering all twelve actions with path-escape defences, durable SQLite stores
  for bounded uses, revocation, namespace settings and audit, and an
  `AgentTurnDriver` over a live model.

### Changed

- `@aicoo/sharedos-contracts` owns the context capsule that crosses an agent
  boundary. ([#9](https://github.com/Aicoo-Team/SharedOS/pull/9))

### Host notes

- `CapabilityAuthorizer` accepts `chainResolver`. A host that issues derived
  grants must supply one; without it, derived grants are denied with
  `delegation_chain_unavailable`.
- A bounded (`maxUses`) grant cannot be delegated. Sharing one use budget
  across a chain needs usage accounting that spans grants, so `deriveGrant`
  refuses with `bounded_parent_not_delegable` instead of multiplying the
  budget by the number of delegates.

## 0.1.0-alpha.1

### Added

- Pluggable runtimes inside a fixed security envelope: `RuntimePlugin`,
  `RuntimeRegistry`, `SharedOSExecutor`, and `StandardRuntime`
  ([ADR 0007](docs/adr/0007-pluggable-runtime-security-envelope.md)).
- The `@aicoo/sharedos-http` transport adapter and the `@aicoo/sharedos-client`
  typed client over the same contracts.

## 0.1.0-alpha.0

First public prerelease of the eight `@aicoo/sharedos-*` packages under
Apache-2.0.
