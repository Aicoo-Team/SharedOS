# ADR 0026: The effective catalogue is resolved once per turn

- Status: Accepted
- Date: 2026-09-08
- Extends: `docs/adr/0010-per-turn-authority.md`

## Context

Three places in this repository already state that a SharedOS catalogue is
resolved once per turn.

`OpenToolBridge.catalog` computes it once and says why: "A catalogue that could
change between `tools/list` and `tools/call` would make `catalogHash` a claim
about a moment rather than about the turn." `McpToolServer` answers `initialize`
with `capabilities.tools.listChanged: false`, justified as "A SharedOS catalogue
is resolved once per turn and cannot change underneath a running harness" -- a
promise on the wire, made to every MCP client. And an execution token binds
`catalogHash` into its claims so a stale sandbox cannot reconnect and "call tools
it was never shown".

The kernel does not do it. `SharedOSKernel.#resolveToolRegistry` re-derives the
effective registry on every operation that needs one -- `listTools`,
`listToolNamespaces`, `updateToolNamespaces` and `invokeTool` -- and the comment
in `#invokeTool` states it plainly: "it is re-derived per call".

Nothing about a static registry can differ between two of those derivations. A
`ContextToolProvider` can. It is an async port, called with the turn's
`AccessContext`, and it exists so that a user's own MCP catalogue never mutates a
registry shared with concurrent users. It is also live: the MCP server behind it
reconnects, the host behind it re-reads its own configuration. Two resolutions
inside one turn may legitimately disagree, and today the kernel will answer the
turn's second call from the second one.

What that costs is narrower than it first looks, because the MCP layer closes
part of the window by construction. The bridge is built with the turn's
definitions and memoizes its catalogue, and `tools/call` resolves the requested
name against that memoized set, so a tool a provider adds or drops mid-turn is
refused at that boundary before the kernel is asked.

What survives is a definition that changed rather than appeared: the same name in
both resolutions, carrying a different `requiredCapability`, `parseArguments` or
`resolveRequirement`. The name check passes, and `#invokeTool` then runs
`canDiscover` and executes against the definition it just resolved. The model was
shown, and `catalogHash` recorded, a tool requiring one capability; the call was
decided against another. Authority is not bypassed -- the grant check still runs,
against whatever the new definition names -- but the turn's record identifies a
catalogue that is not the one the call was answered against. A host calling the
kernel directly has no bridge in front of it, so for that host the add and remove
cases are open too.

The claim is also not checkable. `catalogHash` is recorded on
`tool.catalog.listed` and on no other event, so "every call in this turn was
answered against the catalogue that was recorded" is asserted in a comment rather
than visible in the trail.

The performance argument for resolving once has already been settled separately
and is deliberately not part of this decision. Sharing the registered entries
instead of re-registering them took catalogue resolution from 79% of a mediated
call to 45%, and one call from 8.23 ms to 2.44 ms, with no change to when the
catalogue is resolved. What is left here is the semantics.

## Decision

The effective tool registry is resolved once per turn and held for the turn's
length, on the lease ADR 0010 already opens.

**It rides the authority lease.** `openTurnAuthority` resolves a turn's authority
once and holds it in a ref-counted lease keyed by `turnAuthorityKey(context)`.
The resolved registry is held on that same lease: derived on first need inside
the turn, answered from thereafter, released when the lease is released. No new
port, no new option, and nothing for a host to thread through.

**An operation with no lease resolves its own catalogue**, which is a turn of one
operation -- the same degrade ADR 0010 already defines for authority, and the
reason the guarantee does not depend on a caller remembering to pass a scope. A
guarantee a host has to opt into is not a guarantee; it is the shape of the step
ceiling that holds in-process and silently does not hold over MCP.

**The existing key is the right key.** It excludes `now`, which is exactly what
makes "the catalogue this turn was resolved for" a statement about the turn
rather than about an instant. It excludes `enabledToolNamespaces`, and it can,
because what is held is the unfiltered registry.

Two things are deliberately not held.

**Not the permission filter.** `listTools` re-runs `canDiscover` per definition
and `#invokeTool` re-checks discovery and invocation, both against authority
resolved at `context.now`. Expiry is instant-bound under ADR 0016, so a grant
that lapses part-way through a turn still refuses part-way through it. Pinning
what tools exist is not pinning who may use them, and a provider withdrawing a
tool was never the revocation mechanism -- grants are, and those stay live.

**Not namespace enablement.** The held registry is unfiltered and the namespace
check runs per operation over it, so `updateToolNamespaces` keeps taking effect
within the turn it is called in.

## Consequences

- The three claims above become true rather than aspirational. The handshake's
  `listChanged` of `false` is honest, and `catalogHash` identifies the catalogue
  every call in the turn was answered against rather than the one the listing
  happened to see.
- A `ContextToolProvider` is called once per turn instead of once per operation.
  A provider that is slow, remote or rate-limited stops being multiplied by the
  turn's call count.
- A provider written to vary within a turn no longer can. That is the behaviour
  being removed, and a provider relying on it is relying on the window this ADR
  closes.
- A provider that varies on `enabledToolNamespaces` reads the value the
  resolution carried, not the operation's. This is the one case where the held
  registry is observably staler than today's, and it follows from a key that
  deliberately excludes namespace enablement.
- Catalogue resolution leaves the per-call cost path entirely; what remains of it
  is per turn. Measured, the segment falls from 1.33 ms to 14.3 µs and from 45%
  of a mediated call to under 1%, and a whole call from 2.44 ms to 968 µs
  (`docs/conformance/systems-cost.md`). It is a consequence and not the
  argument: the cost case was already settled by the registry copy, above.
- The conformance suite gains the row it did not have.
  `catalogue-moved-mid-turn` publishes `notion.search` for the turn's listing and
  then moves its declared capability onto an action no grant carries, so a second
  listing answers differently from the first. Its probe -- a call inside the
  granted tree, made after the move -- passes in all six columns with this
  decision and fails in all six without it, which is what makes the row evidence
  rather than a description of intent. Its attack, the same tool outside the
  granted tree, is still denied `no_matching_grant`: what the turn holds is the
  catalogue, not the decision.
- Making the claim checkable in audit is a change to what is recorded, and was
  not this decision. It has since been taken: `tool.invoked` carries the
  `catalogHash` its turn published, so the two events join on a value rather than
  on a reader's inference from time order.

## Rejected alternatives

**An opt-in turn scope the host threads through.** The kernel would hand back a
scope at `admitTurn` and callers would pass it to `listTools` and `invokeTool`.
Rejected: it makes the property hold only for hosts that remember, which is
precisely how the step ceiling came to hold in-process and not over MCP. The
lease already exists and already has the right lifetime.

**A process-global cache keyed on a hash of the `AccessContext`.** Rejected
twice over. It requires guessing which context fields a provider varies on, and a
wrong guess serves one user's catalogue to another -- silently, once, in the
direction of over-exposure. `ContextToolProvider` exists to prevent exactly that,
so a global cache behind it would reintroduce the bug the port was added to
remove.

**Hold the permission-filtered catalogue rather than the registry.** Cheaper
still, and wrong: it freezes authority for the turn, which contradicts ADR 0016
and would let a call succeed against a grant that had already expired.

**Let a provider declare whether it is stable for a turn.** Rejected. A
guarantee that depends on a port's self-report is not a guarantee, and the port
is host-supplied code.

**Leave it, and document that the catalogue may change mid-turn.** Rejected. It
would mean retracting `listChanged: false` from the MCP handshake, unbinding
`catalogHash` from the execution token, and telling hosts that the identifier
their audit trail carries names a moment they cannot locate.
