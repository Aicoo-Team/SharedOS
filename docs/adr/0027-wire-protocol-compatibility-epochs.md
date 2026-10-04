# ADR 0027: One wire protocol compatibility epoch

- Status: Accepted
- Date: 2026-10-04
- Supersedes: ADR 0019's protocol-version deferral

## Context

ADR 0019 added optional authority descriptions while retaining protocol `"1"`.
A writer could omit them, but an older strict reader could not accept them.
Equal version stamps consequently stopped implying compatible contracts.
`packages/contracts/src/compatibility.test.ts` freezes the older authorization
reader and reproduces its unknown-key rejection.

HTTP also has responses without body versions. Audit events, published catalogues
and execution records had independent `"1"` literals. Package and runtime build
numbers cannot describe which wire reader can consume those objects.

## Decision

Use one global, exact-match compatibility epoch, `PROTOCOL_VERSION`. This change
moves it to `"2"`, including all contract changes already made under `"1"`.
Every SharedOS versioned envelope, manifest, audit event, catalogue and execution
record uses `ProtocolVersionSchema`. Nested unversioned contracts inherit the
epoch of their enclosing object or transport. A standalone unversioned contract
must be accompanied by that epoch in its transport or persisted container.

A global bump deliberately re-stamps unchanged envelopes. The stamp describes
compatibility of the complete SharedOS contract set, not whether each object
changed. Each build supports one epoch; there is no downgrade, field stripping,
dual writer, or fallback to another epoch.

### Breaking changes and strictness

A breaking wire change is any change to valid emitted data that a supported
reader rejects, or to accepted requests or promised semantics that a supported
writer relies on. This includes:

- Adding an object field, even optional, to a strict schema; adding an enum or
  discriminated-union variant an existing reader does not accept.
- Removing, renaming or requiring a field; changing its type, meaning, default,
  constraints, identity, correlation or ordering guarantee.
- Changing authority scope, expiry, revocation, replay, consumption, commitment
  or refusal semantics on which peers rely, even with identical JSON shapes.
- Changing a standard tool's published arguments, results or policy contract.

Authority-bearing input remains strict at every level. Outputs remain strict
too: an unknown key within a supported epoch is malformed data. Optional means
a writer may omit a known field; it does not make adding that field compatible
with older readers.

Existing JSON extension slots, including host metadata and tool-defined opaque
payloads, permit new entries under their existing contracts without a bump.
They must never hide new authority or redefine standard semantics. The HTTP
error envelope is a frozen bootstrap contract: `error.code` is already an open
string, so new codes are compatible; its fields and meaning cannot change.
Bug fixes restoring documented behavior, build-only changes, and new operations
that do not change existing contracts need no bump.

### Detection and reporting

HTTP operations use `/v2/...`; `/health` remains stable. Paths identify the epoch
for requests without versioned bodies. Clients also send
`x-sharedos-protocol-version: 2`. Servers reject unsupported versioned paths or
conflicting headers before resolving context or invoking an API. Direct HTTP
writers may omit the header because the path pins the epoch. Versioned bodies
and nested messages must agree.

Every HTTP response, including errors and health, carries that version header.
Unsupported requests receive HTTP 426 with
`error.code = "unsupported_protocol_version"` and a message naming the received
and supported epoch. The existing error envelope lets older clients read this
code without knowing v2 contracts. There are no `/v1` aliases.

The client checks the header before reading JSON or validating a response.
A missing, invalid or unsupported header, or conflicting versioned body, raises
`SharedOSClientError` with `code = "unsupported_protocol_version"`. Malformed
data within epoch 2 remains `invalid_response`. This also explains an old
server's unversioned 404 when a v2 client requests `/v2`. A v1 client built before
this decision cannot acquire header checking retroactively, but its `/v1`
requests to a new server receive the readable 426 error.

Runtime registration and execution reject unsupported manifest/request stamps
with `UnsupportedProtocolVersionError`, a `TypeError` with a stable code.
Version schemas supply explicit received/supported-version diagnostics.
Execution-record assembly checks source evidence epochs rather than relabeling old
requests, results or audit events. Persisted records retain their original
epoch; read them with a historical reader or an explicit host-owned migration.
Never stamp historical evidence with a newer epoch.

MCP's date-based `protocolVersion` describes MCP itself and stays independent.
Initialization, discovery and tool results advertise the SharedOS epoch in
`_meta["sharedos/protocolVersion"]`. SharedOS-aware clients may pin it in
initialize and tool-call metadata. Unsupported pins return JSON-RPC
invalid-params with `data.code = "unsupported_protocol_version"` before
invocation. Catalogues are validated before publication or invocation.
Ordinary MCP clients need no SharedOS negotiation: they consume MCP objects and
the published tool schemas. A host selecting a SharedOS-aware harness must check
its pin. Metadata is advisory identity, never authority; initialization never
substitutes for tool authorization.

### Upgrades and version identities

| Reader/client | Writer/server | Result                                                                                        |
| ------------- | ------------- | --------------------------------------------------------------------------------------------- |
| Epoch 2       | Epoch 2       | Strict validation; compatible contract set                                                    |
| Epoch 1       | Epoch 2       | HTTP `/v1` receives 426; stamped objects fail version validation                              |
| Epoch 2       | Epoch 1       | Missing/old HTTP header is an explicit version error; old manifests and evidence are rejected |
| Epoch 2       | Future epoch  | Explicit unsupported version; no best-effort parsing                                          |

Upgrade communicating hosts, clients, runtime plugins and evidence consumers
together, or isolate them on separate endpoints/storage readers during rollout.
Mixed-epoch rolling compatibility is not promised. Hosts may keep an old service
running separately; this implementation does not synthesize a v1 facade.

Package SemVer identifies the synchronized SharedOS release/build.
`SHAREDOS_VERSION` must still match that release; release tooling advances package
versions for the next breaking preview/release. It is independent of epoch `"2"`:
many compatible package releases can share an epoch, and npm major 2 is not
required just because the wire epoch is 2. A runtime manifest's `version`
identifies that plugin's implementation; its `protocolVersion` declares the
SharedOS epoch it implements. Conformance records both build and epoch so
compatibility and provenance remain separately inspectable.

### Rules for upcoming architecture changes

Lease, replay, commit, revocation and tool-policy PRs must enumerate changes to
wire schemas and observable guarantees, apply the breaking criteria above, and
include compatible and incompatible reader/writer fixtures before merge.

- Lease identity, duration and renewal fields or changed expiry guarantees are
  breaking; an internal host lease with no changed public guarantee is not.
- Replay/idempotency keys, durable replay results and altered duplicate handling
  are breaking. An old operation id must not become a replay grant.
- Commit receipts, new terminal states and changed partial-effect guarantees are
  breaking. Committed or uncertain effects must not become old failure states.
- Revocation epochs, tokens, reason variants and changed snapshot-versus-live
  enforcement guarantees are breaking. Old evidence must not imply live checks.
- Tool-policy fields, new modes or published policy variants, and changed
  enforcement guarantees are breaking. Unknown policy remains rejected.

Unpublished PRs landing in the same release may share one epoch bump, with the
final contract set and migration documented together. Once epoch 2 is published,
the next reader-breaking change moves the global epoch again, updates HTTP
paths/stamps/manifests/records together, and documents migration. Publication,
not branch order, fixes an epoch's contracts. Preview status never permits a
breaking published change under the same epoch.

## Alternatives and consequences

Per-contract versions avoid re-stamping unchanged objects, but require a version
matrix across nested decisions, escalations, events, catalogues and records.
They also leave unversioned HTTP bodies needing their own envelope. This cost
is unjustified for a synchronized package family.

Negotiation or multiple supported epochs could enable rolling upgrades, but
would require actual translators and security review of lost authority,
revocation and commit information. Advertising support without those readers
and writers would reproduce this bug. We do not build that machinery now.

Tolerant output readers would make some additive fields compatible, but would
not address union variants or semantic breaks and would introduce a second
schema policy. Weakening input validation would be unsafe. One epoch and strict
schemas give up mixed-epoch interoperability for a clear, testable boundary.
