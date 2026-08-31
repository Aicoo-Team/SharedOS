# ADR 0019: A grant may serve a typed view instead of the record

- Status: Accepted
- Date: 2026-09-01

## Context

Authorization in SharedOS has been all-or-nothing per resource: a grant that
covers a record serves the record whole, and a grant that does not covers none
of it. The conformance manifest carried the gap as a declared, unimplemented
row — `typed_governed_views`, "SharedOS has no view layer" — because there was
nothing between a raw record and a denial for a row about narrowing disclosure
to measure.

The gap is not hypothetical. A calendar entry answers "is Alice free at three?"
with one field; serving the whole entry to answer it also serves the title, the
attendee list, and the notes. Container-level structure (mounts, namespaces,
path scopes) cannot express this: the unit of disclosure is a field of one
record, and the coarsest structure that can withhold a field is a projection of
the record itself.

Two constraints shape where such a projection may live.

**The definition is authority.** A field list that arrived with the request
would be disclosure the presenter controls; a field list the provider applied
would make enforcement a courtesy of the host's storage. The only place a view
definition can bind is the same place every other bound binds: the capability,
inside a grant, loaded from the trusted source.

**The projection is enforcement.** If the provider served the narrowed shape,
the kernel could not tell a projection from a lie, and a provider bug would
widen disclosure silently. The provider must stay ignorant of views, and
whatever it returns must be incapable of widening what leaves the kernel.

## Decision

A `Capability` may carry a typed governed view: a name and a declared field
list (`GovernedViewSchema`). A capability carrying one authorizes the named
view of its resource and nothing rawer.

**Matching is exact and never substitutive.** A request naming a view is
satisfied only by a capability declaring that view; a request naming none is
satisfied only by a capability declaring none. A raw capability has no field
list to serve a view from, and a view-bound capability was issued precisely so
the record behind it is never served whole. When a raw request's only covering
authority is view-bound — eligible, delegation-valid, the same checks a match
would pass — the refusal is `view_required`, with the servable view names in
the decision metadata: the refusal says what the caller may still do. A full
match that failed on its own terms (an exhausted grant) outranks the advice.

**The kernel projects, after the provider answers.** The allowed decision
carries the matched capability's view, and the kernel projects the provider's
result down to the declared fields before anything leaves the boundary
(`projectGovernedView` in `@aicoo/sharedos-core`). The provider answers the raw
operation exactly as it would answer a raw read. A declared field absent from
the record is absent from the view — the field list is an allowlist over what
exists, not a schema the record must satisfy — and a representation that is not
a record (or an array of records) fails closed with `view_projection_failed`,
because partial projection is partial disclosure. The projection is measured
under its own span, `kernel.view.project`, and the systems-cost bench reports
it as its own component.

**A view attenuates across delegation.** A raw parent may issue a view-bound
child. A child that drops its parent's view, renames it, or grows its field
list is refused (`capability_not_within_parent`) at both boundaries — the chain
check and `deriveGrant` — exactly as a widened path or action set is. A field
subset narrows further and is allowed.

**The audit stream carries names, never values.** A served view rides the
call's own `tool.invoked` event as `{ view: { name, fields } }`. Field names
say what was disclosed; the served content stays out of the evidence exactly as
every other payload does.

`files.read` gains an optional `view` argument — the only shipped tool surface
that names one — and the conformance row is implemented: the raw read of a
record behind a granted view is refused `view_required`, the named view is
served as the projection, and naming the view against any other resource grants
nothing.

## Consequences

- The security–utility axis the coarse structures bound at container level now
  reaches field level, and the cost of doing so is a measured number rather
  than an estimate.
- A view's name is advice-visible: a `view_required` refusal names the views
  that would serve. This discloses that a view-bound grant exists, which is the
  designed trade — the alternative is a caller that can never discover the
  affordance it was granted.
- The projection is shape-blind beyond "record or array of records". A view
  over a representation that nests its fields deeper projects to an empty
  record rather than reaching inside; typed per-namespace view vocabularies
  (free/busy as a semantic, not a field) remain future work and are not claimed.
- `replay_freshness` remains the manifest's one declared, unimplemented row.
