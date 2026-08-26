# Changelog

All notable changes to SharedOS are recorded here. The packages share one
version and are published together under npm's `next` dist-tag.

SharedOS is a `0.x` prerelease: contracts may change between prereleases, and
each entry calls out what a host has to update.

## 0.1.0-alpha.3

### Changed — breaking

- **Messages now have one policy-bound reason: `purpose`.** The redundant
  `MessageEnvelope.intent` field is removed, and strict parsing rejects legacy
  envelopes that still carry it. Outbound sends execute as their sender; an
  inbound turn executes as its recipient and resolves that recipient's
  execution, file, and tool authority independently. See ADR 0015.

- **`grants` is removed from `AccessContext`.** Authority now enters SharedOS
  through one required port, `GrantSource`, which `SharedOSKernel` calls once per
  turn. A context names who is asking, on whose authority, and for what; it
  carries no authority of its own, so nothing a caller assembles can become one.
  Resolved authority is a `ResolvedAuthority` wrapper that is deliberately not
  assignable to `AccessContext`, so grants cannot reach a provider, tool handler,
  transport, or runtime by accident. A source that throws, returns unparseable
  material, or answers outside the context's scope denies with
  `authority_unavailable` before anything else runs.
- **A derived grant names one parent, not a chain.** `CapabilityGrant.delegation`
  (`{ parentGrantId, depth, chain }`) is replaced by a single optional
  `parentGrantId`, and ancestors are re-resolved from the issuing store at every
  decision through a `DelegationChainResolver`. An embedded chain is provenance
  the presenter controls; re-resolution is what makes revocation mean something.
  `CapabilityAuthorizer({ chainResolver })` is now `{ delegationResolver }`, and
  `GrantChainResolver` is now `DelegationChainResolver` with `resolve` in place
  of `get`.
- **Delegation reason codes are renamed**, from `delegation_chain_unavailable` /
  `delegation_chain_broken` to `delegation_chain_unverified` /
  `delegation_chain_invalid`. The distinction is now load-bearing: unverified
  means SharedOS could not establish the chain, and is grouped with
  `authority_unavailable` and `usage_store_unavailable` in
  `INFRASTRUCTURE_DENIAL_REASONS`, whose audit records carry `failClosed: true`.
  Exclude them before computing any denial rate.
- **A bounded (`maxUses`) parent is refused at both boundaries**, as
  `bounded_parent_not_delegable`. Usage counters are per grant, so comparing a
  child's ceiling against its parent's reads as attenuation without bounding
  total consumption. `deriveGrant` already refused; the chain check now agrees.
- **`tool_not_available` is gone.** The execution envelope and the kernel emit
  one code for one refusal, `tool_unavailable`; which boundary refused is
  `OperationRecord.source`. An owner-crossing tool requirement is now `denied`
  with `invalid_request` rather than `failed` with `invalid_tool_requirement`.
- **`ExecutionResult` gains `escalated`**, a third terminal state carrying an
  `Escalation` and no `error`. Code that switched on `succeeded` / `failed` /
  `denied` / `cancelled` and reached for `.error` no longer compiles.
- `deriveGrant` drops two refusal reasons that could never fire
  (`namespace_mismatch`, `issuer_is_not_the_holder`) and adds three that can:
  `issued_before_parent`, `id_collides_with_parent`, and — on the issuing side
  only — a refusal to pin an owner onto an unowned parent capability.

### Added

- `messages.request`, a canonical recipient-scoped request/reply tool. The model
  supplies only a recipient and JSON-safe payload; trusted context supplies the
  sender, purpose, trace, timestamp, and message id. `MessageTransport` and
  `MessageRequestRouter` remain host ports for durable delivery and reply
  lookup—SharedOS does not own a queue, receiver wake-up, or scheduler. Direct
  send and the request tool share one post-authorization delivery path, so a
  bounded send grant is consumed exactly once.

- A quickstart with two working programs, an HTTP API reference covering every
  route and status code, a tool catalog covering the twelve `files` tools and
  how to register your own, and a reason/error code reference. None of this was
  documented outside the source before.
- A conformance suite: every kernel guarantee is an attempted violation run by a
  scripted adversary, graded per runtime, with the case set and the world it runs
  against hashed separately. `pnpm conformance` regenerates it.
- Escalation as a recorded outcome, per-turn authority resolution, and one
  refusal vocabulary across both enforcement boundaries. See ADRs 0008–0013.
- `@aicoo/sharedos-mcp`: the permission-filtered catalogue served as an MCP
  server, which is the boundary a vendor harness actually connects to, plus
  Codex, Claude Code, DeepSeek Harness, and Pi adapters in
  `@aicoo/sharedos-adapters`. See ADR 0014.
- What enforcement costs, measured on both paths and reported in
  `docs/conformance/systems-cost.md`. `pnpm bench` regenerates it, against a
  monotonic clock added for the purpose — wall time is not a duration.
- `pnpm release:promote-latest <version>` moves the `latest` dist-tag across the
  whole package set in one command, refusing to act unless every package has
  published that version.

### Fixed

- Five embedded build constants — the DeepSeek, Pi, and MCP adapter versions
  among them — were left at `0.1.0-alpha.0` while their packages moved. They
  name the build that produced an execution record, so a stale one misattributes
  evidence. `release:check` guarded two of the seven and now guards all of them.
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
