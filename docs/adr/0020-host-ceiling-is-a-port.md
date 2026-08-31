# ADR 0020: The host ceiling is a port, not a convention

- Status: Proposed
- Date: 2026-08-31

## Context

`docs/security/permission-model.md` lists ten steps the kernel evaluates for
each operation. Step 10 is:

> Apply the host ceiling and any non-grant policy constraints.

There is no such call site. `CapabilityAuthorizer.#decide` returns `allow` as
soon as an eligible grant matches a capability and any bounded use is consumed,
and `SharedOSKernel` audits that decision and proceeds. The only "ceiling" in
the kernel is the one a _tool_ declares for itself, which ADR 0012 keeps
deliberately separate and answers with `invalid_tool_requirement`.

The step is not wrong about what hosts need — it is wrong about where they do
it. A host with product or organization policy applies it outside the kernel,
before or after asking. Pulse states this in its own adapter:

> `toolAccess.allowedTools` is intentionally NOT translated. [...] It stays a
> Pulse-side ceiling applied while the tool map is built, so effective authority
> is `Pulse ceiling ∩ SharedOS grants`.

That comment is honest and the decision behind it is right — importing a
union-shaped legacy field as grants would manufacture a permission
cross-product. But the consequence is a second enforcement point that the kernel
cannot see. Three things follow, and all three are invisible today:

- **The audit record is incomplete.** A call the host's ceiling refused never
  reaches the kernel, so nothing records that a decision was made or why.
- **Denial rates are wrong in a way no measurement can detect.** "No grant
  exists" and "a grant exists and product policy overrode it" are different
  facts about a deployment. Today the first is recorded and the second is not
  recorded at all.
- **Conformance cannot reach it.** ADR 0013 makes the matrix the case set, and a
  ceiling applied in host code before the kernel is called has no cell.

SharedOS already has three narrowing mechanisms, and the reason none of them is
this one is worth stating, because a fourth that overlaps them would be worse
than none:

| existing                               | what it narrows                                     | when it can be computed |
| -------------------------------------- | --------------------------------------------------- | ----------------------- |
| `AccessContext.enabledToolNamespaces`  | whole tool namespaces, on or off                    | before any request      |
| `ToolNamespaceSettingsStore`           | the persisted namespace selection, after org policy | at settings write       |
| a tool's declared `requiredCapability` | what that tool may resolve to                       | at registration         |

All three are static with respect to the request: each is fully determined
before the arguments of a particular call are known, and each can be applied
once while a catalogue is built. A ceiling that has to read _this_ request —
which file, which recipient, which argument — cannot be any of them.

## Decision

The host ceiling becomes a port the kernel calls, in the position step 10
already assigns it.

```ts
export interface HostCeiling {
  narrow(
    decision: AuthorizationDecision,
    request: AuthorizationRequest,
    context: AccessContext,
    signal: AbortSignal,
  ): Promise<AuthorizationDecision>;
}
```

- It is consulted **only after a grant has matched**, on an `allowed` decision.
  A denial is never shown to it, so a ceiling cannot turn one into an allow.
- It may return only the decision it was given or a denial. A returned `allowed`
  that does not carry the `matchedGrantId` it was handed is treated as a
  malfunction and fails closed, so widening is not expressible rather than
  merely forbidden.
- Its denial carries `host_ceiling_denied`, a reason code of its own, so it is
  separable from `no_matching_grant` in every count. It is not an infrastructure
  denial: it is a policy decision the deployment made deliberately.
- A throw fails closed and is recorded as an infrastructure denial, consistent
  with every other unavailable trusted component.
- It is optional. A kernel constructed without one behaves exactly as it does
  today.

Discovery uses the same port. `canDiscover` consults it too, so a catalogue is
not offered on authority that invocation would refuse — the property ADR 0016
established for expiry, for the same reason.

## Consequences

- The permission model's step 10 becomes true of the code. Until now it
  described an intention.
- A deployment can answer "how often does our own policy override a grant we
  issued", which is the question that tells an operator their grants are wider
  than their policy.
- `AuditOutcome` gains no new value: a ceiling denial is a denial. What is new
  is that it is recorded at all, and distinguishable by reason code.
- Hosts that apply a ceiling today keep the same logic and move the call site.
  Pulse's `toolAccess.allowedTools` intersection is the first candidate, and it
  stops being invisible without becoming a grant.
- Judgment layers that are not expressible as grants — a relationship model, a
  content-sensitivity check, an org-wide freeze — get a home that cannot widen
  authority, instead of wrapping the kernel where they can do anything.
- Conformance gains a row for a grant-allowed, ceiling-denied call, and the
  reason code makes it checkable rather than inferred from an absent effect.

## Rejected alternatives

**Leave it a convention.** Rejected. The convention already produced a second
enforcement point in the first real host, with no audit and no test. Every
further host will build its own, and each will be correct in isolation and
invisible in aggregate.

**Filter the grants in `GrantSource` instead.** Rejected on two grounds. A
ceiling that depends on the request cannot be applied when authority is loaded,
because the request is not known yet. And it would make the authority snapshot
depend on the request, so `AuthoritySnapshot.hash` would stop identifying "the
authority this turn holds" and start identifying "the authority this call was
allowed", which is the property ADR 0010 relies on for one snapshot per turn.

**Reuse `ToolNamespaceSettingsStore`.** Rejected: it narrows a persisted
namespace selection at settings-write time and cannot read a call's arguments.
Widening it into a per-request hook would give one interface two unrelated
jobs and two different lifetimes.

**Let the ceiling return an escalation.** Rejected here and answered in
ADR 0019. A ceiling says no; whether a no is worth asking a human about is the
host's decision, made on the denial it receives, using the capability that
denial describes.
