# ADR 0009: Load authority from a trusted grant source, never from a context

- Status: Accepted
- Date: 2026-08-18

## Context

`AccessContext` was documented as a trusted, host-constructed boundary that
carried `grants` inline. Every kernel decision then evaluated whatever authority
that object happened to hold.

Two problems follow. The first is a security shape: the one field that decides
what an actor may do travelled inside an ordinary parameter object, so any code
path that could construct or mutate a context could also mint authority. The
guarantee rested entirely on hosts never deserializing a context from an
untrusted source, which is a rule that cannot be enforced by the type system.

The second is that the paper's Section 4 conformance manifest contains the row
"Make the grant store unavailable → Fail closed". With authority inlined there
is no store to make unavailable at decision time. The nearest existing behaviour
was `usage_store_unavailable`, which is a _usage counter_ failure against an
already-resolved authority set. Reporting it as the grant-store row would have
claimed a guarantee the code did not implement.

## Decision

`grants` is removed from `AccessContext`. A context now carries identity,
purpose, trace, tool namespaces, and time only.

Authority enters SharedOS through one required port:

```ts
interface GrantSource {
  load(context: AccessContext, signal: AbortSignal): Promise<readonly CapabilityGrant[]>;
}
```

`SharedOSKernel` requires a `GrantSource` and resolves authority itself, once
per kernel operation, through `TrustedAuthorityResolver`. The resolver validates
what the source returned and collapses every failure mode to one outcome:

| Situation                                               | Code                     |
| ------------------------------------------------------- | ------------------------ |
| the source threw                                        | `grant_source_failed`    |
| a grant does not satisfy `CapabilityGrantSchema`        | `invalid_grant_material` |
| a grant is outside the context's namespace/actor/issuer | `grant_scope_mismatch`   |
| more grants than `MAX_RESOLVED_GRANTS`                  | `grant_limit_exceeded`   |

Any of them denies the operation with reason `authority_unavailable` before a
provider, tool handler, or message transport is consulted.

Resolved authority is held in a `ResolvedAuthority` wrapper (`{ context, grants }`)
rather than merged back into the context. Because the wrapper is not assignable
to `AccessContext`, authority cannot reach a `ResourceProvider`, `ToolHandler`,
`MessageTransport`, `ContextToolProvider`, or `RuntimePlugin` by accident; the
compiler rejects it.

Infrastructure-caused denials are named once, in
`INFRASTRUCTURE_DENIAL_REASONS` (`authority_unavailable`,
`delegation_chain_unverified`, `usage_store_unavailable`), and audit records for
them carry `failClosed: true`. An experiment must exclude these from denial
rates: they are SharedOS failing to establish a fact, not a policy decision.

## Consequences

- Authority is re-resolved for every kernel operation, so revoking a grant takes
  effect at the next decision inside a running turn. Hosts that need caching
  implement it inside their `GrantSource` and own the staleness window.
- A grant source that answers with a superset (for example, every grant in a
  namespace) fails closed rather than being silently filtered. Pre-filtering is
  part of the contract.
- The kernel performs one authority load per operation, so a turn with N tool
  calls performs N + 2 loads. This is deliberate: correctness under mid-turn
  revocation is worth more than a cached decision, and the cost is measurable in
  the systems-cost benchmarks.
- Breaking change for every embedder: `new SharedOSKernel()` no longer compiles,
  and a context literal with `grants` no longer parses. The repository is
  pre-1.0 and the alpha packages absorb it.
- `packages/http` needs no change. Its host-side `resolveContext` simply stops
  returning authority, which removes the possibility of a transport supplying
  grants at all.

## Rejected alternatives

**Keep `grants` on the context and have the kernel ignore it.** Rejected as a
trap: a field that looks authoritative but is not will eventually be populated
by a host that assumes it works.

**Offer `GrantSource` as an optional kernel option.** Rejected because an
optional boundary is not a boundary. The conformance row must be able to state
that authority _always_ comes from the trusted source.

**Resolve authority once per turn in the executor.** Rejected because it puts
the boundary above the kernel, leaves direct kernel callers unprotected, and
makes mid-turn revocation unobservable.

**Report an authority outage as a provider failure.** Rejected because no
provider ran. It is a denial; what makes it distinguishable from a policy denial
is the reason code and the `failClosed` audit marker, not a different status.
