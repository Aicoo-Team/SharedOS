# Changelog

All notable changes to SharedOS are recorded here. The packages share one
version and are published together under npm's `next` dist-tag.

SharedOS is a `0.x` prerelease: contracts may change between prereleases, and
each entry calls out what a host has to update.

## 0.1.0-alpha.3

### Changed — breaking

- **`tool.catalog.listed` no longer lists tool names.** Its `metadata` carried
  `visibleTools`, and in this release's earlier shape `withheld`, one
  `{ tool, cause }` per tool a listing did not return. Both are gone. The event
  now records what the listing was computed from and what it came to, as
  identifiers and a count: `catalogHash`, the catalogue the caller was shown,
  computed exactly as `listPublishedTools` computes it so an execution's
  manifest and the audit record match on one value; `enabledNamespaces`, the
  caller's own filter; `hostPolicyVersion`, the version the turn's
  `PolicySource` stated, when one loaded; and `withheldCount`. `authorityHash`
  stays at the top level. `failClosed: true` now also appears on a `succeeded`
  listing when at least one tool was withheld by an outage rather than by a
  decision, which the count alone could not say.

  **A consumer reading `visibleTools` or `withheld` from audit rebuilds from the
  identifiers instead.** The names a listing returned are what
  `listPublishedTools` returned, and `catalogHash` says whether two listings
  returned the same ones; an attempted call on a withheld tool is still
  recorded on `tool.invoked` with its own `cause`. ADR 0023 records the shape.

- **Optional fields were added to strict schemas, and the protocol version did
  not move.** `AuthorizationDecision.requiredAuthority`,
  `Escalation.requestedAuthority`, and `AuditEvent.requestedAuthority` are
  optional and additive for anything that _writes_
  them. Nothing in this repository's contracts is additive for a reader: the
  schemas are `.strict()`, so a consumer built against an earlier release
  rejects the unknown key rather than ignoring it. An older client parsing a
  newer host's `ExecutionResult` fails on `escalation.requestedAuthority`; one
  parsing an
  `AuthorizationDecision` fails on `requiredAuthority`. Both surface as a
  malformed-response error with nothing to explain it.

  **Upgrade every consumer of these types in step with the host that writes
  them.** `ProtocolVersionSchema` is deliberately left at `"1"`: it is one
  literal shared by `ExecutionRequest`, `ExecutionEvent`, `ExecutionResult`,
  `MessageEnvelope`, and `RuntimeManifest`, so moving it would re-stamp four
  objects that did not change in order to signal one optional field on a fifth.
  A reader re-pinning because `MessageEnvelope` said `"2"` would find nothing
  about a message had changed. The bump rides the next release with its own
  reason to move; `docs/open-items.md` holds the row, and ADR 0019 records the
  decision and the failure mode it accepts.

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

- **`authorization.checked` now carries the decision's own metadata.** Until now
  the event's `metadata` held only the two keys the kernel states, `consumed` and
  `failClosed`. It now also carries whatever the decision carried: a
  `HostCeiling`'s own keys, and — new to audit, though it has existed on the
  decision all along — the `delegation` detail (`code` and `grantId`) behind a
  `delegation_chain_invalid` or `delegation_chain_unverified` denial. Hosts
  persist audit events under closed schemas of their own, so this is a change to
  record. The kernel's two keys are stripped from the decision's copy rather than
  overwritten, so no port can set them.

- **`GrantSource` returns the grants the actor holds and applies no policy.**
  The host guide previously instructed the opposite — apply the ceiling in the
  source, by not returning the grant it forbids. That is the one refusal path
  that misreports itself: the kernel records `no_matching_grant` while the grant
  sits in the store. Policy moves to the `HostCeiling` above. Nothing in the code
  enforces this, and nothing can — SharedOS never sees what a source withheld —
  so it is a contract, and the `hostCeiling` flag on every authority load is the
  most a reader gets: it says whether a policy port exists, not whether the
  source stopped filtering.

  The trade is worth stating: `AuthoritySnapshot.hash` now identifies _authority
  held_, not authority usable. A snapshot may list grants a ceiling will refuse,
  so an auditor reading one alone overstates what a turn could do and has to read
  the decisions as well.

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

- **Every refusal reaches audit, and the record names the boundary that made
  it.** The execution envelope made no audit call of its own: a tool name the
  turn's catalogue never offered, a spent step or tool-call budget, a context
  mismatch, and how a turn ended existed only in `ExecutionResult.events` — a
  required field hosts pay for on the wire whose every consumer in this
  repository is the conformance package. A host with an audit sink could not see
  the clearest attempted violation the system produces (ADR 0023).

  `AuditEventType` gains one value, `turn.ended`: one event per turn, at the
  terminal, carrying the outcome and reason. Not one per transition — that would
  triple the audit volume of every successful turn to say nothing more, and a
  `turn.denied` would double-count against the `authorization.checked` admission
  already produced. A cancelled turn is `failed` with reason `turn_cancelled`;
  `AuditOutcome` is unchanged. `SharedOSKernel` gains `recordTurnEnd` and
  `recordRefusedCall`, and the envelope calls them through the same optional
  `TurnKernel` members `recordEscalation` already uses, so **hosts wire
  nothing new** — a second `AuditSink` option would be one a host can forget to
  pass twice, and the failure mode of forgetting is a turn that enforces
  correctly and records nothing.

  Two `metadata` keys carry the rest. `source` is `kernel` or `envelope` on every
  operation and terminal event; it is required by the change rather than
  incidental, because the rule "it is in audit, therefore the kernel refused it"
  held only while the envelope recorded nothing. `cause` disambiguates
  `tool_unavailable` — `not_registered`, `namespace_disabled`, the discovery
  decision's own code, or `not_offered` from the envelope — while `reason` stays
  the code the caller was given, so one refusal keeps one name. `errors.md` has
  promised that disambiguation all along and delivered it for one of the three
  situations; it now holds for all of them, including a policy refusal, which
  could otherwise only ever appear on a decision event.

  `tool.catalog.listed` gains `withheldCount`, with `failClosed: true` when what
  it withheld, it withheld by an outage. Discovery refusals had no code on
  either side before — the caller is not told and the record said nothing
  either. The listing's other new keys are under _Changed — breaking_.

  Kept out deliberately: the MCP transport's `unauthorized` refusal, which
  happens before an `AccessContext` exists and would need a fabricated principal
  to record; the thrown error behind any refusal, which stays on the diagnostic
  hooks; payloads, unchanged; and the parser detail behind
  `invalid_tool_arguments`, which quotes the value that failed.

- **Host policy is a port the kernel calls, so its refusals are recorded.**
  `CapabilityAuthorizer` accepts a `hostCeiling`: product or organization policy
  consulted on a grant that would otherwise allow. Its refusal is
  `host_policy_denied`, carrying the `grantId` it overrode — a bucket of its
  own, separate from `no_matching_grant`, and not marked `failClosed`, because a
  deliberate refusal is not an outage. Until now a host narrowed authority by
  withholding the grant, which made the kernel record "nobody authorized this"
  about a call a grant did authorize, so no deployment could answer how often
  its own policy overrode a grant it issued (ADR 0020).

  It may only narrow, and by construction rather than by rule. `narrow` takes
  an `AllowedDecision` — the allow arm alone — and returns a
  `HostCeilingVerdict`: that decision, or a `HostPolicyDenial` whose
  `reasonCode` is fixed to `host_policy_denied`. A denial cannot be passed in
  and a code cannot be authored, at the type level. At runtime it is never shown
  a denial; an `allowed` result naming a grant it was not shown fails closed as
  `host_policy_unavailable`, as does a throw, and as does a malformed return —
  an `async narrow` or a branch that falls off the end both yield something whose
  `allowed` is `undefined`, and reading that as a denial would file a broken port
  as a deliberate refusal. A refusal's `reasonCode`, should a host outside
  TypeScript return another, is replaced with `host_policy_denied` so a ceiling
  cannot re-emit the very misattribution the separate code ends. Its `metadata` is preserved except for `consumed` and
  `failClosed`, which the kernel states itself, and except for anything that is
  not a JSON object, which is dropped whole.

  A throw is reported to `CapabilityAuthorizerOptions.onProviderError` — the same
  shape `SharedOSKernelOptions.onProviderError` takes, declared on the authorizer
  because that is where the ceiling is installed and the kernel's hook cannot
  reach it. Pass one function to both. Reports carry `kind: "policy"`, a new
  `ProviderErrorKind` value.

  Synchronous, deliberately: the signature structurally forbids a network call,
  a database read, or a model call on the authorization path, which a timeout
  would permit while punishing a slow machine. A host with a remote policy
  service loads it into memory and refreshes it on its own schedule.

  Consulted per matching grant and before consumption. A refused call does not
  spend a `maxUses` grant, and a refusal ends that grant's candidacy rather than
  the decision — two grants can cover one request and differ in ways policy
  distinguishes. When nothing is left, the reason follows a fixed precedence:
  the fail-closed delegation denials, then `host_policy_denied`, then
  `grant_exhausted`, then `no_matching_grant`. Discovery consults the same port,
  so a catalogue is never offered on authority invocation would refuse.

  The manifest gains a row for it, passing in all six columns. A grant covers
  the frozen path, so the refusal that would otherwise read `no_matching_grant`
  reads `host_policy_denied` instead — and the same ceiling withholds every
  mutation tool from discovery, so the row also asserts the agreement ADR 0016
  requires: what the ceiling refuses at invocation is absent from the catalogue.
  Both boundaries appear in one cell, `envelope` and `kernel`. The case-set and
  world-set hashes move with it.

  Every `authority.resolved` event now carries `hostCeiling: "installed"` or
  `"absent"`. Without it an audit stream containing no policy denials cannot be
  told apart from one produced by a deployment that has no policy port. It says a
  ceiling exists, not that the `GrantSource` stopped filtering — a host can do
  both, and audit cannot tell.

- **The ceiling's policy can be loaded per turn, beside the grant set.**
  `SharedOSKernelOptions.policySource` installs a `PolicySource`, one
  asynchronous `load(context, signal)` the kernel calls once per turn, in flight
  beside the grant load, and holds on the turn's authority lease as
  `ResolvedAuthority.hostPolicy`. It resolves to a `LoadedPolicy`,
  `{ policy, version }`. `HostCeiling.narrow` gains a fourth argument, `policy`,
  which is the `policy` that source loaded — exactly as loaded, not cloned or
  validated, because SharedOS does not know its shape and reads nothing from it
  — and is `undefined` when no source is installed, so a ceiling that closes
  over its own state is unchanged. `HostCeiling<Policy>` and
  `PolicySource<Policy>` take the type as a parameter for the host's own
  documentation; the pairing is not checked. This is the second port ADR 0020
  defined, and the reason the synchronous signature can serve a policy that
  lives in a database: it is read once at the turn boundary, the way authority
  is, and never on the authorization path.

  `version` is the one thing about a policy SharedOS reads: the source's own
  name for what it loaded — a revision, an etag, the hash of the table it read —
  recorded as `hostPolicyVersion` on every `tool.catalog.listed` event in the
  turn, beside `authorityHash`. An opaque value has no canonical form to hash,
  and the record needs to pin a catalogue to the policy state it was decided
  against, so the source says.

  It fails closed the way the grant source does. A throw, or a result that is
  not a `LoadedPolicy`, is reported once to
  `SharedOSKernelOptions.onProviderError` as `kind: "policy"` and the turn's
  policy is held `unavailable` for its whole length: every decision the ceiling
  would have been consulted on is refused `host_policy_unavailable` without
  `narrow` being called, on both paths and before any bounded use is consumed.
  A kernel with no ceiling ignores it. A cancelled load re-throws the abort.

  **Host notes.** Nothing changes for a host that installs no source. A
  `HostCeiling` written before this release still compiles and still runs: the
  new parameter is trailing and admits `undefined`. Every `authority.resolved`
  event gains `hostPolicy: "loaded" | "unavailable" | "absent"` beside
  `hostCeiling`, where `absent` means no source is installed; a host comparing
  that event's `metadata` with `toEqual` sees the new key. The `PolicySource`
  row leaves `docs/open-items.md`.

- **A denial says which capability would have satisfied it, and an escalation
  can carry that.** `AuthorizationDecision` gains an optional
  `requiredAuthority: CapabilityRequest` on a `no_matching_grant` denial, and
  `Escalation` gains an optional `requestedAuthority` that
  `SharedOSKernel.recordEscalation` accepts through its options and records on
  the `escalation.requested` audit event. A host running a consent workflow can
  now name the capability an approval is about instead of reconstructing the
  resource, action, owner, and purpose from a sentence a model wrote — the step
  that mints real authority, and the one SharedOS could neither see nor test.
  `CapabilityRequest` had existed since the first release with no port
  (ADR 0019).

  What `recordEscalation` records is minted, not copied. `requestedAuthority`
  is read as the ask — capabilities, purpose, constraints, metadata — and
  `id`, `namespaceId`, `requester`, `owner`, and `requestedAt` come from the
  trusted context whatever the caller wrote, because a request the caller
  authored would be a caller-chosen correlation for a decision the kernel made.
  The `id` is derived from the ask, so `{ requestedAuthority:
denial.requiredAuthority }` comes back under the identifier it went in with.
  An ask the contract refuses throws a `TypeError`. `mintCapabilityRequest` is
  exported from `@aicoo/sharedos-core` for a host assembling a consent request
  of its own.

  It grants nothing. No port accepts one as input, `allowed` stays `false`, and
  a host that ignores both fields behaves exactly as before. The description is
  built from what the caller already named — the request's resource and action,
  and the context's requester, owner, namespace, purpose, and instant — so it
  restates the request rather than revealing whether a path or a grant exists.
  Its `id` is derived from those fields _other than_ the instant, rather than
  being random, so one missing authority has one identifier however often and
  whenever it is described.

  Deliberately narrow, and the boundaries are the contract. It is absent from
  `grant_exhausted`, from the infrastructure denials, and from a policy denial,
  because for none of them is issuing a grant the remedy. It is absent from
  discovery: `canDiscover` is asked about a tool's declared capability, which
  ADR 0016 allows to be broader than any call, so a description there would ask
  for more authority than an operation needed.

  The names are `requiredAuthority` on a decision and `requestedAuthority` on an
  escalation and its audit event: one concept in two roles, both ending in the
  noun this repository uses for what grants confer. Not `requiredCapability` —
  `ToolDefinition.requiredCapability` already means something else in the same
  package, a bare `CapabilityRequirement` rather than the fuller
  `CapabilityRequest` these carry, and it is the field a reader meets first.

  `AuditEvent` gains a top-level `requestedAuthority` field, which is a contract change to
  the audit vocabulary: hosts persist these events under closed schemas of their
  own. It appears on `escalation.requested` and only when the escalation named a
  capability.

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
- **`SharedOSKernelOptions.onProviderError`**, so a contained throw is
  diagnosable. A provider, tool handler, transport, or router that throws is
  answered with a fixed reason code -- `tool_execution_failed`,
  `resource_execution_failed`, `message_delivery_failed`, and the four other
  codes the seven contained call sites return --
  and the error itself was discarded, so nothing said which provider broke or
  where. It now reaches this optional hook, whole and unwrapped, with a
  `ProviderErrorContext` naming the `kind` of port (`tool`, `tool_catalog`,
  `resource`, `message`), the `reasonCode` returned in its place, the trace and
  namespace, and whichever of `operationId`, `tool`, `resource`, and `action`
  that path has. One hook rather than one per port: `kind` is what a host
  branches on to route them differently, and a port added later is covered by
  the hook every host already installed. `reasonCode` is the same code audit
  recorded and the same one the agent was told, so a log line joins to both.

  Nothing reaches the wire: every message and audit event is unchanged, and a
  kernel with no hook installed takes the same decisions. The hook is
  observational -- one that throws is ignored -- and synchronous, unlike
  `onAuditError`, which is awaited because it fires after the side effect; this
  one fires mid-flight, where awaiting a host's logger would put its latency on
  every failed call. A cancelled operation is not reported.

  The one behavioural change: a `ContextToolProvider` whose `listTools` throws is
  still wrapped into one catalogue-failure sentence, but the provider's error is
  now that wrapper's `cause` rather than being destroyed. That is visible without
  the hook -- a logger or reporting SDK that walks `cause` will print the
  provider's message where it previously printed nothing -- so it is a change to
  what a host may see, not a no-op.

  Four symbols join the public surface of `@aicoo/sharedos-core`, and through it
  `@aicoo/sharedos`: `ProviderErrorContext`, `ProviderErrorKind`,
  `ProviderErrorReporter`, and `reportContainedError`. The last is the swallow
  guard itself, exported so `@aicoo/sharedos-runtime` and any host offering a
  hook of the same shape share one implementation of the promise rather than
  each making their own.

  Not covered, and stated so it is not mistaken for done: the four authority
  ports still discard theirs, and they are not equally bad. `GrantSource`,
  `GrantUsageStore`, and `DelegationChainResolver` fail closed under their own
  `failClosed` reason codes, so the failure is classified even though the cause
  is gone. `CapabilityGrantVerifier` is the one to watch: a throw from `verify`
  is treated as `false`, so the grant becomes invisible and the denial reads
  `no_matching_grant` -- indistinguishable from an actor who was never granted
  the capability, and not marked `failClosed`.

- **`onTurnError`**, on `SharedOSExecutorOptions` and `StandardRuntimeOptions`,
  so a contained throw is diagnosable. Both layers catch one and end the turn on
  a terminal code -- the envelope's `runtime_failed`, the standard loop's
  `driver_failed` -- and both discarded the error, leaving an operator a code and
  no stack. It is now handed to this optional hook, whole and unwrapped,
  alongside the turn's `executionId` and `traceId`; `TurnExecutor` forwards it to
  both, so one sink covers both. Nothing about the wire changes: each
  `ProtocolError.message` is the same fixed string, no event carries the throw,
  and a turn with no hook installed behaves exactly as before. The hook is
  observational -- one that throws is ignored -- and a cancelled turn does not
  reach it. Note that `runtime_failed` is also what a throw from
  `openTurnAuthority`, `admitTurn`, or `listTools` ends a turn as, so read the
  stack rather than the code to tell a plugin's failure from a host port's.
- A conformance row for a runtime plugin that throws out of its turn. The
  envelope contains the throw rather than letting it reach the host: the turn
  ends `failed` with `runtime_failed`, the `turn.failed` event names the
  envelope as what ended it, and the record still carries the call the turn
  made before it. The receipts survive only because the adversary emits them as
  they happen -- a crash carries no terminal metadata to return them on -- and
  the row pins that too. Only a plugin that owns its outcome can throw on
  purpose, so the row runs on the adversary column and every driven, MCP, and
  model column declares it `not applicable`. The case-set and world-set hashes
  move.
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
- **A denial now explains itself to the host.** The reason codes still collapse
  for the caller — `no_matching_grant` covers nine causes and
  `authority_unavailable` covers four, so that no caller can map the permission
  topology by reading refusals — but the operator who wired the store and issued
  the grant is not the caller. `authorization.checked` now carries
  `grantsResolved` and a `rejectedGrants` array naming every resolved grant and
  the first condition it failed (`issuer`, `subject`, `namespace`, `window`,
  `purpose`, `verifier`, `capability`, `delegation`, `exhausted`), and
  `authority.resolved` carries the same key for the three conditions checked
  before the grant loop runs. `usage_store_unavailable` and
  `delegation_chain_unverified` additionally carry
  `missingDependency: "usageStore" | "delegationResolver"`, which distinguishes
  a permission problem from a wiring one: a `maxUses` grant with no usage store,
  or a derived grant with no delegation resolver, denies every call it should
  have allowed and is otherwise indistinguishable from an absent grant.

  **Host notes.** Nothing is added to `AuthorizationDecision`, so no response
  body changes. `CapabilityAuthorizer` gains an optional
  `AuthorizeOptions.onExplain` callback for hosts that call it directly;
  `SharedOSKernel` supplies its own and needs no change. The `unavailable`
  variant of `AuthorityResolution` gains an optional `detail`, so a host that
  compares a resolution with `toEqual` rather than `toMatchObject` will see the
  new field. Discovery checks do not explain: catalog filtering denies on nearly
  every tool by design, and routing that through the record would bury the
  denials somebody was looking for.

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
- **A `repo` resource namespace, beside `files`.** `createRepoTools` and
  `registerStandardOsTools(kernel, { files, repo })` publish `repo.status`,
  `repo.diff`, `repo.log`, `repo.stage`, and `repo.commit` over a host-owned Git
  provider. A `files` grant over a working tree grants nothing under `repo` and
  the reverse, so committing is authority a host issues rather than a
  consequence of file-write authority. See ADR 0024.

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
