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

Canonical resource namespaces include `memory`, `workspace`,
`sharedos.messaging`, `sharedos.execution`, and host-registered external tool
namespaces. Paths identify the smallest stable resource scope, such as
`project-x`, a specific folder, or a structured recipient address.

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

## Authorization algorithm

For each concrete resource or tool operation, the kernel evaluates:

1. Validate the protocol object and namespace/world binding.
2. Establish the authenticated actor independently from untrusted payload.
3. Ensure the request owner matches the access context owner.
4. Ignore grants whose subject or issuer does not match the access context.
5. Ignore grants that are not active, have expired, or have been revoked.
6. Match the declared purpose when the grant restricts purposes.
7. Match resource namespace, owner, path scope, and exact action together.
8. Apply the host ceiling and any non-grant policy constraints.
9. Atomically consume a bounded grant only for execution, not discovery.
10. Return an explicit decision and append an audit event.

If no complete grant matches, deny. If trusted grant state or an atomic usage
store is unavailable, fail closed.

### No permission cross-products

Independent grant fields must not be unioned into a new synthetic authority.

Suppose one grant allows:

```text
memory/project-x: search, read
purpose: prepare-update
```

and another allows:

```text
workspace/public: write
purpose: publish-summary
```

They do not combine into permission to write `memory/project-x`, nor to write
for `prepare-update`. The full requested tuple must match a complete capability
under a compatible grant. A set of valid grants may provide a union of complete
authorities, never a cross-product of their individual fields.

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
forwarding a message or copying a grant. When delegation is supported:

- every link has a verifiable issuer-to-subject relationship;
- each derived grant is no broader in resource, action, purpose, time, uses, or
  namespace than its parent;
- delegation depth decreases at each link;
- revocation and expiry of an ancestor invalidate the usable chain;
- the full chain or a tamper-evident reference is retained in provenance.

Until chain validation is implemented and tested, `delegationDepth` must not be
interpreted as automatic permission to reissue a grant.

## Messaging

A `MessageEnvelope` contains sender, receiver, intent, purpose, payload, trace,
time, and provenance. It intentionally contains no grants.

Sending or receiving a message and performing the requested work are separate
authorization decisions. A recipient may accept the message yet be denied
access to the memory or tool named inside it. Replying can also require its own
`sharedos.messaging` + `send` capability. Opening a target agent turn requires a
separate recipient-scoped `sharedos.execution` + `invoke` capability.

## Tools and MCP

Tool security uses two gates:

1. **Discovery:** return only definitions whose required capability the actor
   can currently exercise. Discovery does not consume `maxUses`.
2. **Invocation:** authorize the exact registered definition and resource again
   immediately before execution. Invocation atomically consumes a bounded use.

Never trust a model-supplied tool name, required capability, annotations, or
schema. Resolve the definition from the host registry, reject ambiguity, validate
arguments with the handler's mandatory runtime parser, then authorize and invoke
the same immutable parsed call. A read-only annotation is descriptive metadata
and cannot replace the capability action.

External and MCP tools follow the same gates as built-in OS capabilities. The
host additionally protects credentials, validates destinations, and prevents a
connector from escaping its configured account or tenant.

## Memory and workspace

Memory and workspace providers receive an already authorized context plus the
exact operation. They must:

- resolve only within the bound namespace/world and owner;
- return only the fields authorized by the operation;
- avoid widening a search to inaccessible siblings;
- honor cancellation before committing a side effect;
- enforce the host's durable replay/idempotency policy before writes;
- report actual affected resource identifiers for audit;
- treat stored content as untrusted data, not policy instructions.

Search indexes and embeddings are part of the same isolation boundary as source
records. A filtered final result does not make a cross-tenant search safe if the
search itself leaked ranking, counts, timing, or embeddings.

## Time, revocation, and bounded use

Expiry and revocation are checked at point of use, not only when a turn begins.
Long-running turns must re-authorize each external side effect. Hosts supply a
trusted clock or trusted timestamp policy.

`maxUses` requires an atomic compare-and-set store shared by all executing
instances. The kernel has no implicit process-local fallback: a bounded grant
fails closed unless the host explicitly supplies a store. The exported in-memory
store is suitable only for tests or a guaranteed single-process host.

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
