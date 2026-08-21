# Permission model

This document defines the security invariants that every SharedOS package and
host adapter must preserve. Schema details can evolve during `0.x`; these
invariants cannot change without an ADR and protocol review.

## Core principle

SharedOS is deny-by-default. A requested operation is allowed only when a
trusted, active capability grant matches the complete request.

```text
message / model request  !=  authority
capability request       !=  authority
verified active grant     =  possible authority, after policy evaluation
```

Messages and model output are untrusted input even when they come from a known
agent. They may state intent and purpose, but cannot contain self-validating
authority.

## Actors and authority

- **Actor**: the principal attempting an operation.
- **Subject**: the principal to whom a grant was issued; it must match the actor
  for direct use.
- **Issuer / authority**: the principal that issued or attests the grant.
- **Owner**: the principal whose resource is being accessed.
- **Host ceiling**: product or organization policy that can reduce, but never
  increase, granted authority.
- **Namespace / world**: the tenant or experiment isolation boundary within
  which identifiers and resources resolve.

A model is not an authority. A tool registry is not an authority. Authentication
proves which principal is calling but does not authorize a resource operation.

## Capabilities and resources

A capability binds these fields together:

- resource namespace and structured path;
- resource owner;
- one or more actions;
- exact or descendant scope.

Canonical resource namespaces include `files`, `sharedos.messaging`,
`sharedos.execution`, and host-registered external tool namespaces. A file path
identifies the smallest stable resource scope, such as
`["Memory", "project-x"]`, `["Workspace", "public", "summary.md"]`, or a
single file. Messaging uses a structured recipient address instead.

The execution namespace/world is a separate isolation boundary and must be
bound to every resolution. A resource identifier from one world cannot resolve
in another world even if its resource namespace, path, and owner text are the
same.

Writes are never implied by reads. Search is never implied by list. Registering
a tool does not imply permission to discover or invoke it. Wildcard actions, if
enabled by a host, require the same complete resource and constraint match.

## Grant shape and constraints

A grant includes:

- a stable grant ID;
- subject and issuer;
- one or more complete capabilities;
- issuance and optional activation time;
- expiry and revocation state;
- optional allowed purposes;
- optional maximum uses;
- optional delegation depth;
- host metadata that does not itself alter authority.

The host must either load grants from a trusted store or verify their authenticity
through a configured verifier. An HTTP caller cannot make a request authorized
by attaching an arbitrary grant object to its payload.

`CapabilityRequest` expresses requested authority for a consent workflow. It is
not usable authority until an eligible issuer turns it into a trusted grant.

## Where authority comes from

An `AccessContext` carries identity, purpose, trace, enabled tool namespaces,
and time. It carries no grants. Authority is loaded by the kernel from a
required `GrantSource`, once per operation, and is held beside the context in a
`ResolvedAuthority` that no provider, tool handler, transport, or runtime can
receive.

A `GrantSource` must answer from the issuing store with exactly the grants
issued to the context's actor by the context's authority inside the context's
namespace. Material outside that scope, material that fails the grant contract,
and an unreachable store are all the same outcome: authority is unavailable and
the operation is denied before any provider runs.

```text
Need authority
     |
     v
Trusted grant source
     |
     +-- available ------> evaluate grants
     |
     +-- unavailable ----> DENY (authority_unavailable, failClosed)
```

## Authorization algorithm

For each concrete resource or tool operation, the kernel evaluates:

1. Validate the protocol object and namespace/world binding.
2. Establish the authenticated actor independently from untrusted payload.
3. Load authority from the trusted grant source, or deny.
4. Ensure the request owner matches the access context owner.
5. Ignore grants whose subject or issuer does not match the access context.
6. Ignore grants that are not active, have expired, or have been revoked.
7. Match the declared purpose when the grant restricts purposes.
8. Match resource namespace, owner, path scope, and exact action together.
9. Validate the delegation chain of a derived grant, or deny.
10. Apply the host ceiling and any non-grant policy constraints.
11. Atomically consume a bounded grant only for execution, not discovery.
12. Return an explicit decision and append an audit event.

If no complete grant matches, deny. If trusted grant state, a delegation
ancestor, or an atomic usage store is unavailable, fail closed.

### Denials SharedOS caused

Fail-closed behaviour makes an infrastructure failure look like a denial at the
call site. The reason codes listed in `INFRASTRUCTURE_DENIAL_REASONS`
(`authority_unavailable`, `delegation_chain_unverified`,
`usage_store_unavailable`) mark that case, and their audit records carry
`failClosed: true`. A measurement must separate them from policy denials before
computing any rate.

### One refusal, one code

The execution envelope and the kernel both refuse, and they use the same
vocabulary for the same refusal: a tool outside the permission-filtered
catalogue is `tool_unavailable` at either boundary. Which one refused is
recorded separately, as `OperationRecord.source`, because a code says what was
refused and a source says who refused it.

Two codes that are easy to confuse are kept apart deliberately:

- `invalid_request` -- the request names a resource outside this world. This is
  a denial, checked before the tool's own ceiling and answered by the
  authorizer, so it carries a recorded authorization decision.
- `invalid_tool_requirement` -- the tool resolved a capability outside the
  ceiling it declared. This says the tool misbehaved, not that the request was
  impermissible.

See `docs/adr/0012-one-refusal-vocabulary.md`.

### No permission cross-products

Independent grant fields must not be unioned into a new synthetic authority.

Suppose one grant allows:

```text
files/Memory/project-x: search, read
purpose: prepare-update
```

and another allows:

```text
files/Workspace/public/summary.md: replace
purpose: publish-summary
```

They do not combine into permission to replace a file under
`files/Memory/project-x`, nor to replace a file for `prepare-update`. The full
requested tuple must match a complete capability under a compatible grant. A
set of valid grants may provide a union of complete authorities, never a
cross-product of their individual fields.

### Path scope

An `exact` capability matches only the same path. A `descendants` capability
matches the same path and children by path segment, never by a raw string
prefix. For example, `projects/x` can contain `projects/x/reports`; it must not
match `projects/x-secret`.

## Purpose

Purpose is a structured policy and audit constraint, not a claim that SharedOS
can infer a model's true motivation. The caller declares a purpose; a grant may
allow specific values; SharedOS propagates the chosen value through the trace
and rejects incompatible values.

Hosts may add workflow-specific evidence or approval before accepting a purpose.
They must not silently substitute a broader purpose after a denial.

## Delegation

Delegation is explicit and bounded. A subject cannot mint authority merely by
forwarding a message or copying a grant. A derived grant names its immediate
ancestor in `parentGrantId`, and SharedOS validates the complete chain before
the grant authorizes anything:

- every link has a verifiable issuer-to-subject relationship;
- each derived grant is no broader in resource, action, purpose, time, uses, or
  namespace than its parent;
- delegation depth decreases at each link, and a parent without delegation
  budget cannot be reissued at all;
- revocation and expiry of an ancestor invalidate the usable chain;
- the full chain or a tamper-evident reference is retained in provenance.

Ancestors are loaded from a trusted `DelegationChainResolver`, never from the
presented grant or the access context. A chain that cannot be established is
denied as `delegation_chain_unverified`; a chain that resolves and breaks a rule
above is denied as `delegation_chain_invalid`. Both carry the failing link into
the audit record. A host that issues delegated grants must install a resolver;
without one, `parentGrantId` authorizes nothing.

`delegationDepth` is therefore a ceiling on reissue, not a permission to reissue
without a validated parent. See `docs/adr/0008-delegation-chain-validation.md`.

## Messaging

A `MessageEnvelope` contains sender, receiver, intent, purpose, payload, trace,
time, and provenance. It intentionally contains no grants.

Sending or receiving a message and performing the requested work are separate
authorization decisions. A recipient may accept the message yet be denied
access to the file or tool named inside it. Replying can also require its own
`sharedos.messaging` + `send` capability. Opening a target agent turn requires a
separate recipient-scoped `sharedos.execution` + `invoke` capability.

## Tools and MCP

Tool usability requires three independent facts:

1. the trusted registry or context-specific provider registered the tool;
2. the trusted access context enables the tool's logical namespace;
3. an active capability grant covers the required resource and action.

The kernel enforces them in two phases:

1. **Discovery:** return only definitions in enabled namespaces whose required
   capability the actor can currently exercise. Discovery does not consume
   `maxUses`.
2. **Invocation:** recheck namespace enablement and authorize the exact
   registered definition and resource immediately before execution. Invocation
   atomically consumes a bounded use.

Never trust a model-supplied tool name, required capability, annotations, or
schema. Resolve the definition from the host registry, reject ambiguity, validate
arguments with the handler's mandatory runtime parser, then authorize and invoke
the same immutable parsed call. A read-only annotation is descriptive metadata
and cannot replace the capability action.

Likewise, a tool's `namespace`, `source`, and `readWrite` fields are catalog
metadata, not authority. Enabling `calendar` only makes qualifying calendar
tools eligible for discovery; it does not grant read, create, update, or delete
access to any calendar or event.

Namespace settings come from the authenticated host, never from model output.
An empty effective selection means all namespaces are disabled. Standard
updates are idempotent enable/disable patches applied atomically by a host-owned
settings store. The host may narrow the returned selection according to product
or organization policy and must load that authoritative selection into future
access contexts.

The full namespace catalog is management-plane metadata. Hosts expose it only
to an authenticated principal allowed to manage that selection and must not add
disabled connector metadata to the model's turn context. The runtime gives the
model only `listTools` output after namespace and capability filtering.

External and MCP tools follow the same gates as built-in OS capabilities. The
host additionally protects credentials, validates destinations, and prevents a
connector from escaping its configured account or tenant. Dynamic tools are
resolved for one access context and must not be installed by mutating a
process-global registry shared across users.

## Files, indexes, and memory views

The file provider receives an already authorized context plus the exact
operation. It must:

- resolve only within the bound namespace/world and owner;
- return only the fields authorized by the operation;
- avoid widening a search to inaccessible siblings;
- honor cancellation before committing a side effect;
- enforce the host's durable replay/idempotency policy before writes;
- report actual affected resource identifiers for audit;
- treat stored content as untrusted data, not policy instructions.

Memory, workspace, raw material, and wiki content are file paths or mounted
views over the same file plane; they are not independent stores of authority.
Search indexes and embeddings are derived from files and remain inside the same
isolation boundary as their sources. A filtered final result does not make a
cross-tenant search safe if the search itself leaked ranking, counts, timing,
or embeddings.

## Time, revocation, and bounded use

Expiry and revocation are checked at point of use, not only when a turn begins.
Long-running turns must re-authorize each external side effect. Hosts supply a
trusted clock or trusted timestamp policy.

`maxUses` requires an atomic compare-and-set store shared by all executing
instances. The kernel has no implicit process-local fallback: a bounded grant
fails closed unless the host explicitly supplies a store. The exported in-memory
store is suitable only for tests or a guaranteed single-process host.

Because authority is re-loaded from the trusted source for every kernel
operation, a revocation recorded mid-turn takes effect at the next decision in
that same turn. A host that caches inside its `GrantSource` owns the resulting
staleness window and must keep it inside its revocation SLA.

## Audit requirements

Every decision should be reconstructable from tamper-evident records containing:

- decision and reason code;
- actor, authority/issuer, owner, and matched grant ID when allowed;
- namespace/world, resource, action, and purpose;
- execution, operation, message, tool call, and trace identifiers as applicable;
- time and sequence;
- provider result category and affected resources, without leaking secrets.

Denials are first-class events. Audit storage belongs to the host, while event
shape and required provenance belong to SharedOS.

If outcome audit persistence fails after a provider has committed a side effect,
the kernel preserves the provider's typed result so callers do not retry an
already-completed operation because observability returned 500. Production
hosts must use a transactional outbox or equivalent durable audit design and
surface the `onAuditError` signal operationally.

## Review checklist

Any permission-related change must answer:

- What is the exact resource-action-purpose tuple?
- Where is the authenticated actor established?
- How is the world/tenant boundary bound and checked?
- Can two grants accidentally combine into broader authority?
- Is expiry/revocation checked at the side effect?
- Is bounded use atomic across instances?
- Are discovery and invocation both gated?
- Are allow and deny paths tested?
- Can the audit trail explain the decision without exposing secrets?
