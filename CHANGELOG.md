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

- **Repository tooling, not a published contract.** `pnpm conformance:live` is
  now `pnpm conformance:native`, over `scripts/native-conformance.mjs`, writing
  `native-conformance.json` and reading `SHAREDOS_NATIVE_CONFIG`. "Live" named
  when a run happened rather than what it measured, and both live scripts drive
  a real model over a real wire; what separates this one is that each vendor CLI
  runs on its own stdio protocol, natively, where `mcp-conformance.mjs` reaches
  the same binaries through MCP. The column ids `codex-live` and `model-live`
  deliberately do not move: they are keys in artifacts already on disk.

  The script also takes `--config` and `--harness`, as the MCP one already did.
  Declaring `credentialVariables` makes the pinned key required, so a harness
  that cannot reach it reports unavailable instead of authenticating somewhere
  else -- on the operator's own subscription, say, producing a column that
  cannot be published beside the others.

### Changed — behaviour

- **A grant that expires while a turn is running is now refused inside that
  turn**, at the next decision, rather than at the next turn. Revocation,
  purpose withdrawal, `issuedAt`, and `notBefore` are unchanged: they are still
  decided at the instant the turn's authority was resolved, and are still
  observed by the next turn. The rule separating them is directional — the
  operation's clock may only take authority away, never hand any back — so a
  turn still carries the grant set it was admitted with and can never gain more
  while it runs. An ancestor follows the same split. See ADR 0016.

  Nothing about a turn's authority load changes: no store is re-read,
  `cost.authorityLoads` stays at 1 per turn, and a decision an expiry refused
  names the same authority snapshot hash as the decision before it. Hosts
  issuing short-lived grants should expect them to stop working part-way through
  a long turn, which is what they asked for; hosts relying on a turn outliving
  its grants' validity windows must widen those windows.

  `CapabilityAuthorizer.authorize` and `canDiscover` take the operation instant
  as a new optional `now`, and `validateDelegationChain` takes the admission
  instant as a new optional `admittedAt`. Both default to the previous
  behaviour, so a host calling either directly is unaffected until it opts in.

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
- A conformance row for a validity window closing mid-turn, and the clock it
  needs. Nothing can expire during a turn when time does not move, so a
  condition may now arm `expiresAfterOperations`, which advances the world's
  clock one step per mediated operation — indexed on the operations the kernel
  recorded rather than on wall time, so repeats stay byte-identical. It is
  opt-in per condition and every other condition still runs on the frozen
  instant. The row is separate from `revoked-mid-turn` rather than a second
  condition on it, because the two make the identical call at the identical
  position and require opposite answers.
- Escalation as a recorded outcome, per-turn authority resolution, and one
  refusal vocabulary across both enforcement boundaries. See ADRs 0008–0013.
- `@aicoo/sharedos-mcp`: the permission-filtered catalogue served as an MCP
  server, which is the boundary a vendor harness actually connects to, plus
  Codex, Claude Code, DeepSeek Harness, and Pi adapters in
  `@aicoo/sharedos-adapters`. See ADR 0014.
- `ModelDriver` in `@aicoo/sharedos-adapters`: a model API in the delegate seat,
  with no vendor CLI between it and the envelope. `StandardRuntime` still owns
  the loop, still stops at `maxSteps`, and still re-authorizes every call; what
  changes is only who occupies the seat. Dotted SharedOS names are mapped per
  turn, from the catalogue rather than by guess, onto the `^[a-zA-Z0-9_-]+$` a
  chat-completions provider constrains function names to — and a name the map
  does not hold is passed through anyway, so a model that invents a tool
  outside its catalogue reaches the envelope to be refused instead of being
  filtered out where nothing records it. The provider's `finish_reason` and
  `usage` are read off every completion: a reply cut off at the output-token
  ceiling fails the turn as `model_output_truncated` rather than being graded
  as a decision the model finished making, and the turn's token spend reaches
  the execution record as `cost.inputTokens` / `cost.outputTokens`. A `fail`
  decision now carries `metadata` as `complete` does, so a failed turn keeps
  the model that answered and what it cost. A call whose arguments do not
  parse is refused by the driver as `invalid_tool_arguments` and answered back
  to the model, never sent as `{}` -- an empty object is a call the model did
  not make, and a tool with every parameter optional would have run it. The
  turn's metadata counts them as `malformedToolCalls`; past `maxMalformedCalls`
  (default 8) the turn fails as `model_malformed_call_limit_exceeded`.
- A `model-live` conformance column built on that driver, which separates what
  a model does from what a vendor's scaffolding makes it do — the axis every
  other live column confounds. It is an addition to the scripted column and
  never a replacement: a model chooses, so an attempt it declines leaves no
  operation and the cell reports not exercised rather than pass.
- Escalation as something the occupant of the delegate seat can ask for, rather
  than an outcome only a host-written runtime could reach. `AgentTurnDecision`
  gains an escalate variant, and the ask itself is published as
  `sharedos.escalate`: catalogued and permission-filtered like any other tool,
  invisible to an agent holding no grant over it, and never invoked -- a driver
  whose turn's catalogue offers it recognises the name and ends the turn on it,
  and a call naming it on a turn that was never granted it is passed through to
  be refused `tool_unavailable`. Asking for a human is an affordance a host
  grants, so a host that publishes no escalation grant has agents that cannot
  ask. See ADR 0017.
- An optional `step` on `AgentTurnDecision.tool_call`. A driver that says
  nothing is bounded exactly as before; one that names a step is refused for it
  if the envelope disagrees, because declaring a step is a claim and not a
  permission. See ADR 0017.
- What enforcement costs, measured on both paths and reported in
  `docs/conformance/systems-cost.md`. `pnpm bench` regenerates it, against a
  monotonic clock added for the purpose — wall time is not a duration.
- `pnpm release:promote-latest <version>` moves the `latest` dist-tag across the
  whole package set in one command, refusing to act unless every package has
  published that version.

### Fixed

- Catalogue comparability is compared per case and per column instead of pooled
  across a whole run. The check warned whenever a run had served more than one
  catalogue, which was right while a run served exactly one and wrong as soon as
  the tool set became permission-filtered per case. Two columns are comparable
  when each saw the same catalogue for the same case, so that is what is now
  checked, and the warning names the first case where two columns actually
  diverged. `catalogHashByCase` goes into the artifact beside the pooled list,
  because a pooled list cannot show a reader that two columns saw the same tools
  for the same row.

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
