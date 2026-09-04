# Changelog

All notable changes to SharedOS are recorded here. The packages share one
version and are published together under npm's `next` dist-tag.

SharedOS is a `0.x` prerelease: contracts may change between prereleases, and
each entry calls out what a host has to update.

## 0.1.0-alpha.4

### Changed — breaking

- **`tool.catalog.listed` no longer lists tool names.** Its `metadata` carried
  `visibleTools`, one name per tool the listing returned. It is gone. The event
  now records what the listing was computed from and what it came to, as
  identifiers and a count: `catalogHash`, the catalogue the caller was shown,
  computed exactly as `listPublishedTools` computes it so an execution's
  manifest and the audit record match on one value; `enabledNamespaces`, the
  caller's own filter; `hostPolicyVersion`, the version the turn's
  `PolicySource` stated, when one loaded; and `withheldCount`. `authorityHash`
  stays at the top level. `failClosed: true` now also appears on a `succeeded`
  listing when at least one tool was withheld by an outage rather than by a
  decision, which the count alone could not say.

  **A consumer reading `visibleTools` from audit rebuilds from the identifiers
  instead.** The names a listing returned are what
  `listPublishedTools` returned, and `catalogHash` says whether two listings
  returned the same ones; an attempted call on a withheld tool is still
  recorded on `tool.invoked` with its own `cause`. ADR 0023 records the shape.

- **`requiredCapability` on a denial is now `requiredAuthority`, and `Escalation.request`
  is now `requestedAuthority`.** 0.1.0-alpha.3 shipped `AuthorizationDecision.requiredCapability`,
  the `CapabilityRequest` a `no_matching_grant` denial describes, and `Escalation.request`, with
  `EscalationOptions.request` carrying one into `SharedOSKernel.recordEscalation`. Both are
  renamed: one concept in two roles, each ending in the noun this repository uses for what grants
  confer — and not `requiredCapability`, because `ToolDefinition.requiredCapability` already means
  something else in the same package, a bare `CapabilityRequirement` rather than the fuller
  `CapabilityRequest` these carry, and it is the field a reader meets first. What they carry is
  unchanged: a description and not an offer, minted from the trusted context, granting nothing.
  `AuditEvent` gains a top-level `requestedAuthority`, written on `escalation.requested` when the
  escalation named a capability. ADR 0019 is rewritten around the new names.

  **A host reading `requiredCapability` off a decision, or passing `request` to
  `recordEscalation`, renames both; a consumer of audit events admits `requestedAuthority`.** The
  schemas are `.strict()`, so nothing here is additive for a reader: a consumer built against
  alpha.3 rejects `requestedAuthority` on an `ExecutionResult`'s escalation as an unknown key
  rather than ignoring it, and surfaces a malformed-response error with nothing to explain it.
  Upgrade every consumer of these types in step with the host that writes them.
  `ProtocolVersionSchema` is deliberately left at `"1"`: it is one literal shared by
  `ExecutionRequest`, `ExecutionEvent`, `ExecutionResult`, `MessageEnvelope`, and
  `RuntimeManifest`, so moving it would re-stamp four objects that did not change in order to
  signal one renamed field on a fifth. The bump rides the next release with its own reason to
  move; `docs/open-items.md` holds the row, and ADR 0019 records the decision and the failure mode
  it accepts.

- **A host ceiling is consulted per candidate grant, before consumption, and its audit flag
  moves to `authority.resolved`.** 0.1.0-alpha.3 installed `hostCeiling` on
  `CapabilityAuthorizer` and consulted it once, on the decision a grant had already produced: a
  policy refusal had spent a `maxUses` grant by the time it was refused, and a second grant that
  policy would have allowed was never tried. It is now consulted per matching grant and before
  consumption. A refused call does not spend the grant, a refusal ends that grant's candidacy
  rather than the decision, and when nothing is left the reason follows a fixed precedence: the
  fail-closed delegation denials, then `host_policy_denied`, then `grant_exhausted`, then
  `no_matching_grant`. Discovery consults the same port, so a catalogue is never offered on
  authority invocation would refuse.

  `narrow` gains a fourth argument, `policy`, the value the turn's `PolicySource` loaded (under
  _Added_); a ceiling written against alpha.3 still compiles and runs, since the parameter is
  trailing and admits `undefined`. A throw from `narrow` is reported to the new
  `CapabilityAuthorizerOptions.onProviderError` as `kind: "policy"` — the same shape
  `SharedOSKernelOptions.onProviderError` takes, declared on the authorizer because that is where
  the ceiling is installed; pass one function to both. A malformed return — an `async narrow`, or
  a branch that falls off the end, both yield something whose `allowed` is `undefined` — fails
  closed as `host_policy_unavailable` rather than being read as a denial, and a refusal whose
  `reasonCode` is anything but `host_policy_denied` has it replaced, so a ceiling cannot re-emit
  the misattribution the separate code ends.

  **Audit record:** the `hostCeiling: true` key alpha.3 wrote on `authorization.checked` when a
  ceiling was installed is gone from that event. Every `authority.resolved` event now carries
  `hostCeiling: "installed" | "absent"` and `hostPolicy: "loaded" | "unavailable" | "absent"`,
  where `absent` means no source is installed. A host comparing either event's `metadata` with
  `toEqual` sees the change. The manifest gains a `host-policy-denied` row, passing in all six
  columns: a grant covers the frozen path, so the refusal that would otherwise read
  `no_matching_grant` reads `host_policy_denied`, and the same ceiling withholds every mutation
  tool from discovery, so the row also asserts that what the ceiling refuses at invocation is
  absent from the catalogue. Both boundaries appear in one cell, `envelope` and `kernel`.

### Changed — behaviour

- **`authorization.checked` now carries the decision's own metadata.** Until now
  the event's `metadata` held only the two keys the kernel states, `consumed` and
  `failClosed`, and alpha.3's `hostCeiling` flag, which moves to `authority.resolved` (under
  _Changed — breaking_). It now also carries whatever the decision carried: a
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

- The conformance judge is at version 4: a row graded on how the turn ended
  is no longer failed when the delegate never asked for that ending. For an
  `escalate` terminal the ending is elected by the delegate, and a live column
  is a real model that may answer the prompt and stop; version 3 reported that
  choice as a SharedOS failure, and asymmetrically -- a column that issued
  nothing at all was already `not exercised` on the control guard, so the more
  cooperative column graded worse for the same behaviour. The judge now reads
  the ask from the record: `sharedos.escalate` among the operations (a delegate
  that did not recognise the name and forwarded the call) or the new
  `escalation.asked` runtime event (one that did). Neither trace grades
  `not exercised` and says so in the cell; either trace with an unmet ending is
  still `fail`. Only the `escalate` terminal is treated this way. No scripted
  cell moves, and the case-set and world-set hashes are unchanged; artifacts
  graded under version 3 and version 4 are not cell-comparable on the
  escalation row.

- **The ask is announced before the turn ends on it.** Every path that honours
  `sharedos.escalate` ends the turn without forwarding the call, so a working
  ask left no operation in the record -- and neither would one the envelope
  then failed to honour. The standard loop, the MCP latch and the conformance
  adversary now emit `escalation.asked` through `RuntimeHost.emit` the moment
  the affordance is recognised, carrying the tool name and reason; it lands in
  the record as a `runtime.event` whatever the turn then does. Announcing is
  for the record only: a host that will not take the event does not change
  what the delegate decided. It is the delegate's own claim and can only make
  a row grade harder, never credit a pass. Distinct from the kernel's
  `escalation.requested` audit event, which records an escalation the envelope
  honoured. Additive; a host reading `runtime.event` sees one more type.

### Added

- **The native harness's translation cost is measured, and its layer can be
  read on its own.** `pnpm bench` now prices the model driver's
  parse-and-translate per call beside the four vendor adapters', through the
  driver's own functions rather than a copy: `decodeChatCompletion`,
  `encodeModelMessage`, `readModelToolCall` and `modelToolResultMessage` are
  exported from `@aicoo/sharedos-adapters`, extracted unchanged from
  `ModelClient` and `ModelDriver`, and `ToolNameCodec` accepts any `{ name }`
  list. `docs/conformance/systems-cost.md` gains a `model.chat-completions`
  row, 123 µs per call on the reference machine, where it read _not measured_.
  Additive for a host; nothing the driver does on a turn changed.

- **A turn is told where it may operate, and a remote caller can ask.**
  `SharedOSKernel.reach(context)` answers the turn's own reach: the namespace,
  path, actions and scope of every place some grant would authorize something at
  this instant, with no grant id, issuer, expiry or budget -- the derivation
  `readAgentCard` performs for a subject, pointed at the caller. The execution
  envelope reads it once per turn and hands it to the runtime as
  `RuntimeVisibleContext.reach`, narrowed by `reachThroughTools` to the
  namespaces the turn's catalogue operates on, so a driver can tell a model where
  to look without the host reading raw grants to write a prompt. `ReachResult`
  moves to `@aicoo/sharedos-contracts` as a schema and gains
  `authority_unavailable` beside `usage_store_unavailable`; a reach that cannot
  be established is handed to the runtime as `unavailable` rather than as an
  empty list, and the turn still runs -- a call that depends on the unreadable
  budget fails closed on its own, as before. `GET /v1/reach` and
  `SharedOSClient.reach()` serve the same answer to a caller driving its own
  loop over the API. **Host note:** `TurnKernel` now requires `reach`; a host
  passing `SharedOSKernel` is unaffected, a narrow test double adds one member.
  The narrowing is keyed on the resource namespace a tool requires a capability
  over, not on `enabledToolNamespaces`, because tool namespaces and resource
  namespaces are different vocabularies (`messages` operates on
  `sharedos.messaging`) and the resource plane is not gated by tool namespaces;
  the kernel's answer and the HTTP route are therefore grant reach, unfiltered.
  ADR 0021 records the decisions; PRs #12 and #13 are superseded.

- **A conformance row for the route lease.** `route-lease-revoked` sends twice
  on one turn's authority with the host's route lease revoked between the
  dispatches, so a send the kernel authorized is refused at delivery and
  terminates rather than delivering. See ADR 0025.

- **`@aicoo/sharedos-precedent` decides whether an auto-decision may stand in for a person.** A new opt-in package: `PrecedentKey` and `precedentKeyDigest` give the mechanism a typed key instead of a string-encoded one, `PrecedentLookup` keeps the rows host-side, and `admitAutoDecision` applies ADR 0022's R1-R4 to a proposal a host's matcher already made. It never widens: a refusal carries no width to read, R2 reuses `capabilityIsWithin` (now exported from `@aicoo/sharedos-core`), R3 takes the tightest envelope with `delegationDepth: 0`, and R4 marks every decision so a matcher's whole output can be revoked at once. Nothing here is an `AuthorizationDecision`, and `escalation.auto_decided` joins `AuditEventType`.

- **One ordering for a constraint envelope.** `tightestConstraints` and
  `constraintsAreWithin` in `@aicoo/sharedos-core` are the meet and the
  containment check over `purposes`, `notBefore`, and `expiresAt`. Delegation's
  attenuation and derivation checks and precedent R3 all read the same one, so
  the three places that each spelled it out cannot drift. One alignment falls
  out: a present timestamp that does not parse now violates its field on either
  side, where attenuation previously ignored a malformed child bound beneath an
  unbounded parent.

- **SharedOS can describe an agent, not only address and authorize one.**
  `SharedOSKernel.readAgentCard(context, subject, { view })` serves a card made
  of identity and computed reach and nothing else. Reach is derived at read
  time, by `CapabilityAuthorizer.reach`, from the grants in force at that
  instant, and is never stored: a stored reach is the one description of
  authority nothing invalidates, because revocation, purpose withdrawal, expiry
  and a spent budget all work by not matching at the next decision. Reading a
  card is itself authorized over `sharedos` / `["directory", <subject>]` /
  `read` (`agentCardCapability`, `directoryCapability`); without that gate the
  directory answers "does this agent exist", and through reach "what resources
  exist and where", in one call rather than one refusal at a time. Nothing is
  consumed, and the subject's grants are not loaded until a reader has been
  authorized to ask about that subject. A card is a view rather than a record:
  `identity` and `namespaces` are narrower resources beneath the subject's own
  path, so a less-authorized reader is served a narrower card and is told which
  views it may still ask for. The card carries no grant id, issuer, expiry or
  budget, and no display name, avatar or skill -- a host composes those around
  it. Reach is grant reach: the host ceiling is not consulted, so a card can name
  a path product policy refuses, and the refusal names the ceiling. A bounded
  grant whose usage store is missing or throws refuses the card
  `usage_store_unavailable` rather than narrowing it (`CapabilityAuthorizer.reach`
  answers a `ReachResult`, a contract type in `@aicoo/sharedos-contracts`); a
  spent budget still omits the grant. **Host note:** a `GrantSource` is now called with a context whose actor is
  not the caller, so one that reads an ambient session user instead of
  `context.actor` answers with the wrong principal's grants; SharedOS refuses
  such a card as `grant_scope_mismatch` rather than serving it, but a source
  that filters by session and returns nothing understates silently. See ADR 0021.

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

- **A `repo` resource namespace, beside `files`.** `createRepoTools` and
  `registerStandardOsTools(kernel, { files, repo })` publish `repo.status`,
  `repo.diff`, `repo.log`, `repo.stage`, and `repo.commit` over a host-owned Git
  provider. A `files` grant over a working tree grants nothing under `repo` and
  the reverse, so committing is authority a host issues rather than a
  consequence of file-write authority. See ADR 0024.

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

- **The host ceiling is a port the kernel calls, not a convention hosts apply
  upstream.** `CapabilityAuthorizer({ hostCeiling })` installs a `HostCeiling`,
  one synchronous `narrow(decision, request, context)` consulted only after a
  grant has matched, on an already-`allowed` decision, on both the `authorize`
  and the `canDiscover` path -- so a tool a ceiling refuses at invocation is
  also absent from the catalogue. Step 10 of the permission model's
  authorization algorithm is now true of the code. It cannot widen anything: a
  denial is never shown to it, its allow arm is pinned to the decision it was
  handed, and an allow that does not carry the same `matchedGrantId` is a
  malfunction that fails closed. Its refusal is `host_policy_denied`, a policy
  denial in its own bucket -- not infrastructure, and not merged with
  `no_matching_grant`, which says no such authority exists. A throw is
  `host_policy_unavailable`, which joins `INFRASTRUCTURE_DENIAL_REASONS`. The
  synchronous signature is the enforcement of "deterministic and cheap": a
  synchronous return cannot await a network or model call. It is optional, and a
  kernel constructed without one behaves exactly as it did, down to the audit
  record; when one is installed the kernel records that, so a deployment that
  denies everything through policy is legible rather than reading as one where
  nobody was granted anything. ADR 0020's `PolicySource` is not implemented and
  carries a row in `docs/open-items.md`. Hosts applying a ceiling today keep the
  same logic and move the call site; withholding a grant instead still produces
  `no_matching_grant` and still misattributes the refusal.
- **A denial for want of a grant names the authority that would have satisfied
  it.** `AuthorizationDecision` gains an optional `requiredCapability`, a
  `CapabilityRequest` populated only on `no_matching_grant`, where the
  authorizer already holds every field: the resource and action the caller
  named, and the owner, namespace, purpose and instant from its own access
  context. It is a description and not an offer -- it grants nothing, no port
  accepts one back as authority, `allowed` stays `false`, and a host that
  ignores it behaves exactly as before. It is never built from anything a
  provider knows, so the same description is produced for a path that is absent
  and for one the actor cannot reach; it is not an existence oracle. The other
  denials deliberately carry none. See ADR 0019.
- **An escalation may carry the capability it is asking for.** `Escalation`
  gains an optional `request` and `SharedOSKernel.recordEscalation` accepts one
  through `EscalationOptions.request`, typically the `requiredCapability` a
  denial just described; the `escalation.requested` audit event records it, so a
  reviewer receives a capability instead of a sentence to reconstruct one from.
  `id`, `namespaceId`, `requester`, `owner`, and `requestedAt` are minted from
  the trusted context and overwrite whatever the caller supplied -- a request
  the caller authored would be a caller-chosen correlation for a decision the
  kernel made -- and `id` is derived from those fields rather than generated, so
  one ask describes itself the same way twice. Nothing else changes: there is no
  third decision value, no consent port, no queue, and no resumption;
  `Escalation.status` is still always `pending` and nothing inside SharedOS
  advances it. `CapabilityRequest` stops being a type with no port and leaves
  `docs/open-items.md`.
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
