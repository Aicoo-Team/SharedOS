# Changelog

All notable changes to SharedOS are recorded here. The packages share one
version and are published together under npm's `next` dist-tag.

SharedOS is a `0.x` prerelease: contracts may change between prereleases, and
each entry calls out what a host has to update.

## 0.1.0-alpha.3

### Changed — breaking

- **The conformance manifest's reference column is renamed.** `EMBEDDED_COLUMN`
  is now `ADVERSARY_COLUMN`, with id `adversary-embedded` and label `Adversary`
  in place of `sharedos-embedded` / `Standard`. The column is unchanged — the
  scripted `HostileRuntime` in the seat, owning its outcome — and the rename
  says what it is: the reference adversary, not the harness SharedOS ships.
  `Standard` now names that harness (below). Code importing the old constant
  changes the name; a reader of `kernel-conformance.json`, or of a live
  artifact, matches the column on its new id.

- **`InMemoryGrantChainResolver` and `UnavailableGrantChainResolver` in
  `@aicoo/sharedos-testkit` are renamed** `InMemoryDelegationChainResolver` and
  `UnavailableDelegationChainResolver`, after the port they implement. The port
  was renamed from `GrantChainResolver` to `DelegationChainResolver` in this
  release and the fixtures kept the old name. Rename the import; nothing else
  changes.

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

- **The model driver decides truncation from `ModelReply.truncated`**, which
  says the provider ended the reply rather than the model choosing to, instead
  of comparing `finishReason` against `"length"`. That comparison was
  chat-completions' spelling of the fact; the Responses API spells it as an
  `incomplete` status, and a driver keyed on one vocabulary would grade a
  cut-off reply from the other as a decision the model finished making. Both
  shipped clients set the field, and `finishReason` still records the
  provider's own word unnormalised. A host with its own `ModelClient`, or a
  hand-written `ModelTranscript` that reported `finishReason: "length"`, states
  the fact in `truncated` now, or the turn completes where it used to fail.
- The conformance judge is at version 3: a failed turn that the envelope ended
  names `envelope` as its enforcement point, read from the `turn.failed`
  event's new `source`, where version 2 named a boundary for denied turns
  only. Statuses are graded as before; a manifest or artifact produced under
  version 2 differs from one under version 3 in that field alone.
- `turn.failed` carries `source` beside `code`: `envelope` when the envelope
  refused the runtime's outcome or the runtime threw, `runtime` when the
  envelope relayed a failure the runtime reported as its own. Additive; the
  event's shape is otherwise unchanged.
- A failure an adapter ends its turn with — `harness_*`, `model_*` — now carries
  `retryable: false` on the driver path as it already did on the MCP path; the
  field was simply absent before. Nothing an adapter fails on is retryable:
  asking the harness or the model again asks the same thing.

- `codexMcpConfig` now emits `default_tools_approval_mode = "approve"` beside
  `required = true`, the setting the conformance launch has always passed as an
  override. Codex's default `auto` mode asks a human before any tool that is not
  read-only; a run with no human then refuses every write inside Codex with the
  kernel never consulted. The approval is scoped to the SharedOS server, and what
  secures a call is the kernel re-authorizing it. A host that wants Codex's own
  prompt as well can override the key.
- The four MCP harness specs derive their server name from
  `SHAREDOS_MCP_SERVER_NAME` and, for Claude Code's `--allowedTools` and Codex's
  `-c` overrides, from the connection's `name`, instead of the literal
  `sharedos`; a spec given another `serverName` is now launched under it.
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

- **The native harness can run on a subscription.** `ModelCredential` in
  `@aicoo/sharedos-adapters` is how a model client authenticates, and
  `OpenAiCompatibleModelClient` now takes an `apiKey` or a `credential`, never
  both. `apiKeyCredential` is the constant key it always had.
  `SubscriptionOAuthCredential` is the case a string could not express: an
  access token that expires, renewed against the provider's token endpoint with
  a refresh token the exchange rotates, presented alongside the code of the
  account the plan bills, in a header the provider names. Headers are resolved
  at the instant of each call rather than when the client was built, so a turn
  cannot outlive the window it started in (ADR 0016's rule, one layer out), and
  a 401 buys exactly one renewal and one retry. `createCodexSubscriptionCredential`
  in `@aicoo/sharedos-adapters/node` reads the login `codex login` already
  stored and writes renewed sessions back, because the refresh token rotates and
  a run that does not persist it leaves the vendor's own CLI unable to log in.
  SharedOS runs no authorization flow, holds no client secret, and sees no
  password. A credential authenticates and grants nothing: the catalogue, the
  calls, and the audit are still resolved from the `GrantSource` first, and the
  account code is copied into a header and never read as identity or authority.
  A turn now records how its seat authenticated, as `auth` on the driver's
  metadata -- scheme, issuer, and whether the seat was account-scoped, never a
  token and never the account code. `scripts/native-conformance.mjs` takes
  `SHAREDOS_MODEL_AUTH=codex-subscription` and reports an absent login the way
  it reports an absent binary. Hosts on an API key change nothing. See ADR 0019.
- **The model seat speaks a second wire shape.** `OpenAiResponsesModelClient`
  is OpenAI's Responses API, which is what a ChatGPT subscription's endpoint
  speaks and what `OpenAiCompatibleModelClient` could not reach. Both extend
  the new `ModelHttpClient`, which holds everything that is not the wire shape
  -- the credential, the per-request deadline, the retry policy, the one
  re-authentication, and the rule that a provider's error body never reaches a
  caller -- so the second shape is an encoder and a reader rather than a second
  copy of the policy. It writes a conversation as Responses input items (a tool
  call and the text around it are separate items, a result is an item of its
  own), declares tools flat and non-strict, reads a streamed answer from the
  event carrying the finished response rather than reassembling deltas, and
  picks its reader from the response's own content type. Two defaults differ
  and both are deliberate: no `temperature` unless a caller asks for one, since
  a reasoning model rejects it, and a 32,768-token ceiling, since reasoning
  tokens count against it. `scripts/native-conformance.mjs` takes
  `SHAREDOS_MODEL_WIRE=responses`, which is the default under
  `codex-subscription` and carries the endpoint, model, and provider defaults
  that go with it.
- **The native harness has a committed conformance column.** `Standard`
  (`MODEL_SCRIPTED_COLUMN`, id `model-scripted`) is `ModelRuntime` —
  `StandardRuntime` with the model driver in the seat and the
  permission-filtered catalogue rendered into the model's tool-call shape —
  with a transcript where the provider would be. `movesToModelTranscript`
  writes each declared attempt as a model reply in the wire alphabet a provider
  accepts, and the driver's real codec, argument parsing, escalation
  recognition, and step accounting read it back; what is left out is the model.
  It is graded under `modelLimits`, as the live model column is, so the shipped
  loop carries a driver's limits in a committed cell rather than standing in
  for the kernel it runs on: the inspection row and the ungranted-escalation
  row read `not applicable`, and the step-ceiling row `pass (driver)`. The
  manifest goes from five columns to six; every hash is unchanged, because
  neither the case set nor the world set moved.
- `TranscriptModelClient` in `@aicoo/sharedos-adapters`: a `ModelClient` that
  replays a supplied `ModelTranscript` through the real `ModelDriver`, the
  counterpart of `TranscriptTransport` for a vendor harness. A spent transcript
  fails the turn `model_call_failed` rather than completing on the recording's
  behalf, so a script that ends too early is a visible result and not a model
  choosing to stop.
- A conformance row for an escalation the turn was not granted. A runtime that
  ends its turn with `escalate` while the catalogue does not offer the
  affordance is refused by the envelope: the turn fails `tool_unavailable`,
  and nothing is recorded or audited. Only a plugin that owns its outcome can
  make the attempt, so the row runs on the adversary column and every driven,
  MCP, and model column declares it `not applicable` -- the first use of
  `ColumnLimits.unsupported`. The case-set and world-set hashes move.
- `DriverRuntime` in `@aicoo/sharedos-adapters`: the one implementation behind
  `HarnessRuntime` and `ModelRuntime`, which are now its two named forms. A host
  installing another driver under its own identity uses it directly.
- `escalationOffered(tools)` in `@aicoo/sharedos-runtime`: the catalogue gate on
  honouring `sharedos.escalate`, shared by the three adapters and the executor
  instead of each spelling the check.

- `canonicalActor` in `@aicoo/sharedos-mcp`: the one string form of an
  `Address` an execution token carries as `actor`, `<kind>:<id>`, from the same
  pair `addressPath` derives for a recipient-scoped grant. The form was
  described in a docblock example and defined nowhere.

- `MCP_HARNESS_IDS` in `@aicoo/sharedos-mcp`, the one list `McpHarnessId` is
  derived from, and `CODEX_HARNESS_ID`, `CLAUDE_CODE_HARNESS_ID`,
  `DEEPSEEK_HARNESS_ID`, `PI_HARNESS_ID` in `@aicoo/sharedos-adapters`: each
  adapter's manifest, requirements, and MCP spec now name the harness from one
  constant, checked against that list.
- `codexMcpServerSettings` in `@aicoo/sharedos-mcp`: the settings a Codex MCP
  server entry carries, as key and TOML value. `codexMcpConfig` renders it as a
  table and the Codex conformance launch passes it as `-c` overrides, so the two
  cannot disagree.
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
  be refused `tool_unavailable`. The envelope holds the same gate from outside:
  `SharedOSExecutor` fails a turn `tool_unavailable` when any runtime plugin
  returns `escalate` on a turn whose catalogue does not offer the affordance,
  recording nothing, since nothing reached the kernel. The reason is recorded
  as given, cut to the outcome's 512-character bound rather than replaced when
  it runs past it.
  Asking for a human is an affordance a host grants, so a host that publishes
  no escalation grant has agents that cannot ask. See ADR 0017.
- An optional `step` on `AgentTurnDecision.tool_call`. A driver that says
  nothing is bounded exactly as before; one that names a step is refused for it
  if the envelope disagrees, because declaring a step is a claim and not a
  permission. The claim reaches forward only: `StandardRuntime` refuses a step
  behind its own position as `invalid_driver_decision`. Below the ceiling the
  record carries the step as declared; who declared it is the conformance
  report's to say. See ADR 0017.
- The same ending over MCP, where the harness rather than SharedOS owns the
  loop. A `tools/call` for the escalation affordance is recognised before it
  becomes an operation: `EscalationLatch` wraps the one invoker every MCP call
  already passes through, answers the ask, and the turn settles as `escalate`
  once the harness has wound down. Calls made after the ask are refused in band
  as `denied` with `escalation_pending`, rather than by closing the bridge --
  closing it surfaces as a JSON-RPC internal error, which carries nothing about
  authority and which harnesses retry into a frame limit. The grant is checked
  first, so an agent without it gets `tool_unavailable`. See ADR 0018.
- `createEscalationTool()` in `@aicoo/sharedos-runtime`: the handler a host
  registers so `sharedos.escalate` is catalogued. The definition was exported
  and every host wrote the same failing handler by hand; the conformance world
  and the adapter tests now register this one. It is never meant to run -- a
  driver ends the turn on the name -- and fails with
  `escalation_not_terminated` if a driver forwards the call anyway.
- What enforcement costs, measured on both paths and reported in
  `docs/conformance/systems-cost.md`. `pnpm bench` regenerates it, against a
  monotonic clock added for the purpose — wall time is not a duration.
- `pnpm release:promote-latest <version>` moves the `latest` dist-tag across the
  whole package set in one command, refusing to act unless every package has
  published that version.

### Removed

- `release:check:private`, and the `--allow-private` flag on
  `scripts/release.mjs` behind it. The flag required every package to be
  `private: true` under an `UNLICENSED` license, the preparation state the
  packages left before `0.1.0-alpha.0` was published; with all eleven public
  and Apache-2.0, the command could only throw. `release:check` is the one
  release check.
- `MCP_HARNESSES` from `@aicoo/sharedos-adapters/node`. Nothing read it: the
  conformance script names the four specs it runs, and a host picks one.
- `strictToolPolicy` and `ListToolsParamsSchema` from `@aicoo/sharedos-mcp`.
  Neither had a caller; `declareToolPolicy({ mode: "strict" })` is what the
  helper built, and the `tools/list` handler takes no parameters.
- The `config.toml` the Codex conformance spec wrote into its temporary
  workspace. Codex reads `$CODEX_HOME/config.toml`, never the working
  directory, and the launch has always passed the connection as `-c`
  overrides, so the file was written and never read. `codexMcpConfig` stays,
  for a host that configures a persistent Codex.
- The MCP harness runtime's own `turn_cancelled` outcome. Under
  `SharedOSExecutor` it was unreachable -- the executor races the plugin
  against the signal, and its own `cancelled` result wins -- and it gave the
  code a second shape, `retryable: false` against the executor's `true`. A run
  whose signal is aborted now rejects with the signal's reason, as any aborted
  operation does; `docs/errors.md` no longer lists the code under Adapters.

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
  An eighth, the version the MCP server reports in `initialize.serverInfo` when
  built without `serverInfo`, was still `0.1.0-alpha.0`; it is now
  `MCP_SERVER_VERSION`, exported from `@aicoo/sharedos-mcp` and guarded too.
- The publish order listed `@aicoo/sharedos-conformance` ahead of
  `@aicoo/sharedos-mcp` and `@aicoo/sharedos-adapters`, both of which it depends
  on, so a run that stopped part-way could leave it on the registry with
  unpublished dependencies. `scripts/package-set.mjs` is now in dependency
  order, `release:check` refuses an order that is not, and `test:release`
  checks the order against the manifests.
- `SharedOSClientOptions.token` and `SharedOSCallOptions.purpose` were
  undocumented: the HTTP reference listed only `headers`, and an earlier note
  here said `token` had never existed. Both have been there since the client was
  written. `token` is a value or an async function sent as a Bearer
  `authorization` header, `headers` carries anything else, and per-call
  `purpose` sets `x-sharedos-purpose`, the header the quickstart's
  `resolveContext` reads. All three are now in the HTTP reference and the
  client README.
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
