# Changelog

All notable changes to SharedOS are recorded here. The packages share one
version and are published together under npm's `next` dist-tag.

SharedOS is a `0.x` prerelease: contracts may change between prereleases, and
each entry calls out what a host has to update.

## Unreleased

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
