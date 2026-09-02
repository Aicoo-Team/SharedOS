# Reason and error codes

Every refusal in SharedOS is a code, not a thrown exception. This page is what
each one means and what to do about it.

## Denied is not failed

Three statuses appear across `ToolResult`, `ResourceResult`,
`MessageDeliveryResult`, and `ExecutionResult`:

| Status      | Meaning                                            | Retry?                    |
| ----------- | -------------------------------------------------- | ------------------------- |
| `succeeded` | It happened                                        | —                         |
| `denied`    | Authorization refused it. Nothing ran              | No — change the grant     |
| `failed`    | It was allowed, and something broke while doing it | Maybe — check `retryable` |

`ExecutionResult` adds `cancelled` for a deadline or host cancellation, and
`escalated` for a turn that stopped and asked for a human. An escalated result
carries an `escalation`, not an `error`: a denial is a decision SharedOS made,
and an escalation is one it declined to make. Counting them together inflates
every denial rate by the cases where the system correctly asked.

Over HTTP all four are **200**. A `403` means the request never reached the
kernel's decision. Client code that only checks the HTTP status will read
denials as successes.

## Authorization reason codes

`AuthorizationDecision.reasonCode`, and the `reason` field on
`authorization.checked` audit events.

| Code                          | Means                                                              | Fix                                                    |
| ----------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------ |
| `allowed`                     | A grant matched                                                    | —                                                      |
| `no_matching_grant`           | Nothing the `GrantSource` returned covers this resource and action | See the checklist below                                |
| `grant_exhausted`             | A matching grant exists but its `maxUses` is spent                 | Issue a new grant; usage is not resettable             |
| `invalid_context`             | The `AccessContext` failed its schema                              | A host bug. Build the context server-side              |
| `invalid_request`             | The resource or action failed its schema, or names another world   | Check path segments, action naming, and the owner      |
| `authority_unavailable`       | The `GrantSource` threw, or answered with unusable material        | Fail-closed. See the authority table below             |
| `usage_store_unavailable`     | The grant has `maxUses` and there is no `usageStore`, or it threw  | Supply `CapabilityAuthorizer({ usageStore })`          |
| `delegation_chain_unverified` | The chain could not be established at all                          | Supply `CapabilityAuthorizer({ delegationResolver })`  |
| `delegation_chain_invalid`    | The chain resolved and broke a rule — often a revoked ancestor     | Usually working as intended — upstream authority ended |

The last three are SharedOS failing to establish a fact, not a policy decision.
They are named once, in `INFRASTRUCTURE_DENIAL_REASONS`, and their audit records
carry `failClosed: true`. Exclude them before computing any denial rate.

Two of them are usually not faults at all but omissions, and say so:
`usage_store_unavailable` and `delegation_chain_unverified` add
`missingDependency: "usageStore" | "delegationResolver"` to the audit record when
the authorizer was built without the port the grant needed. A `maxUses` grant
with no `usageStore`, or a derived grant with no `delegationResolver`, denies
every time and looks exactly like a permission problem. It is a wiring problem;
see [host integration](host-integration.md#ports-a-grant-can-need).

`authority_unavailable` collapses four situations on purpose, so that no caller
can tell a broken store from a rejected one:

| Situation                                               | Internal code            |
| ------------------------------------------------------- | ------------------------ |
| the source threw                                        | `grant_source_failed`    |
| a grant does not satisfy `CapabilityGrantSchema`        | `invalid_grant_material` |
| a grant is outside the context's namespace/actor/issuer | `grant_scope_mismatch`   |
| more grants than `MAX_RESOLVED_GRANTS`                  | `grant_limit_exceeded`   |

A source that answers with a superset fails closed rather than being quietly
filtered: pre-filtering to (namespace, actor, authority) is part of the
contract. Which of the three the grant broke, and which grant it was, is on the
`authority.resolved` audit event as `rejectedGrants` — the caller still sees one
code.

### When you get `no_matching_grant` and expected otherwise

Walk these in order. Every one of them produces the identical code.

1. **`context.authority` does not equal `grant.issuer`.** The most common cause.
   `authority` is _whose grants are being exercised_, not who owns the data. For
   a grant Alice issued it is Alice; for a grant Bob derived from it, it is Bob.
2. **`context.actor` does not equal `grant.subject`.** The grant was issued to
   someone else.
3. **`context.purpose` is not in `constraints.purposes`.** Purpose is matched
   exactly, not by prefix.
4. **`context.now` is outside `notBefore` / `expiresAt`.**
5. **`namespaceId` differs.** Grants never cross worlds or tenants.
6. **The path is not covered.** `scope: "exact"` matches only that path.
   `scope: "descendants"` matches the path and below — and segments are compared
   as segments, so `cell-3` never covers `cell-30`.
7. **The action is not listed.** Actions are matched literally, with one
   exception: a grant whose `actions` contains the literal `"*"` covers every
   action on its resource. Nothing else expands — `snapshot:*` is an ordinary
   string that matches nothing — and `"*"` in a _request_ matches only a grant
   that lists it.
8. **A `grantVerifier` returned false or threw.** A throw is treated as false.
9. **The capability is spread across grants.** One requirement must be satisfied
   by one grant. Path from one and action from another is refused deliberately.

**You do not have to walk the list by hand.** The reason code is the same for
all nine because a caller may not learn which one it was; the host may. Every
denial records a `rejectedGrants` array on its `authorization.checked` audit
event, naming each resolved grant and the first condition it failed:

```text
authorization.checked  denied  files/Work/Finance  no_matching_grant
  grantsResolved: 2
  rejectedGrants: [ { grantId: "grant-17", reason: "issuer" },
                    { grantId: "grant-19", reason: "capability" } ]
```

`reason` is one of `issuer`, `subject`, `namespace`, `window`, `purpose`,
`verifier`, `capability`, `delegation`, or `exhausted`. `grantsResolved: 0` with
no rejections is a different fault from every grant being rejected: the store
returned nothing for this context at all.

Three of the nine — `namespace`, `subject`, and `issuer` — are checked earlier,
when authority is resolved, and refuse the whole set rather than one grant. Those
appear on the `authority.resolved` event instead, under the same key, beside
`authority: "grant_scope_mismatch"`.

## `tool_unavailable` covers three different situations

`kernel.invokeTool` returns `denied` with `tool_unavailable` — and the same
message — when the tool is not registered for this context, when its namespace
is disabled, _and_ when no grant makes it discoverable. That is deliberate: the
caller learns it cannot use the tool, not which of the three reasons applies.

**The specific reason is in the audit trail.** An `authorization.checked` event
is recorded immediately before, carrying the real reason code:

```text
authorization.checked  denied  files/Work/Finance  <- grant_exhausted
tool.invoked           denied  files.read         <- tool_unavailable
```

If you are debugging a `tool_unavailable` and have no audit sink wired, wire one
first.

**Both boundaries use this one code.** The execution envelope refuses a tool
outside the turn's permission-filtered catalogue with `tool_unavailable`, the
same code the kernel uses. Which boundary refused is recorded separately, as
`OperationRecord.source`: a code says what was refused, a source says who
refused it. The earlier `tool_not_available` is gone rather than aliased — two
names for one refusal is the defect.

An owner-crossing requirement is the other pair worth keeping apart:
`invalid_request` is a denial, checked before the tool's declared ceiling and
answered by the authorizer, so it produces an authorization decision;
`invalid_tool_requirement` says the tool misbehaved, not that the request was
impermissible.

## Tool invocation

| Code                                 | Status | Means                                                                                                |
| ------------------------------------ | ------ | ---------------------------------------------------------------------------------------------------- |
| `tool_unavailable`                   | denied | Not registered, namespace off, or not discoverable — see above                                       |
| `no_matching_grant`                  | denied | The exact argument-selected resource is not authorized                                               |
| `invalid_request`                    | denied | The resolved requirement names a world other than the caller's own                                   |
| `invalid_tool_arguments`             | failed | `parseArguments` rejected the call                                                                   |
| `invalid_tool_requirement`           | failed | `resolveRequirement` returned something outside the declared ceiling                                 |
| `tool_requirement_resolution_failed` | failed | `resolveRequirement` threw                                                                           |
| `tool_catalog_unavailable`           | failed | A `ContextToolProvider` threw. The catalog is never partially returned                               |
| `tool_execution_failed`              | failed | Your `invoke` threw                                                                                  |
| `invalid_tool_result`                | failed | Your handler returned something that is not a `ToolResult`                                           |
| `trace_mismatch`                     | denied | `call.traceId` does not match the context                                                            |
| `step_limit_exceeded`                | denied | The call names a step at or past the envelope's `maxSteps`. This call is refused; the turn continues |
| `tool_call_limit_exceeded`           | denied | The envelope's `maxToolCalls` is spent. This call is refused; the turn continues                     |

A budget refuses a call; it does not end a turn. The envelope answers the call
that crosses `maxSteps` or `maxToolCalls` with `denied`, the runtime receives an
ordinary tool result, and the turn may still complete. The one budget that ends
a turn is `StandardRuntime`'s own loop: a driver that is still asking for tools
when the loop's last step is spent fails the turn with `step_limit_exceeded`
(see [turns](#turns)). Which boundary refused is `OperationRecord.source`, as
for `tool_unavailable`.

## Resources

| Code                          | Status | Means                                                                                          |
| ----------------------------- | ------ | ---------------------------------------------------------------------------------------------- |
| `resource_provider_not_found` | failed | No provider registered for that namespace                                                      |
| `resource_execution_failed`   | failed | Your provider threw                                                                            |
| `invalid_resource_result`     | failed | Your provider returned a malformed `ResourceResult`, or one whose `operationId` does not match |

## Messages

| Code                                    | Status | Means                                                               |
| --------------------------------------- | ------ | ------------------------------------------------------------------- |
| `message_transport_not_configured`      | failed | No `messageTransport` was supplied to the kernel                    |
| `message_context_mismatch`              | denied | The envelope's sender, purpose, or trace disagrees with the context |
| `message_requirement_resolution_failed` | failed | The capability resolver threw                                       |
| `message_delivery_failed`               | failed | Your transport threw                                                |
| `invalid_message_receipt`               | failed | Your transport returned a malformed delivery result                 |
| `message_request_not_prepared`          | failed | The request tool did not prepare the authorized call                |
| `message_request_not_accepted`          | failed | The transport did not accept the request                            |
| `message_reply_resolution_failed`       | failed | The host router could not resolve the durable reply                 |
| `invalid_message_reply`                 | failed | The resolved reply did not preserve request context                 |

## Turns

| Code                       | Status    | Means                                                                                                                                                                                                                                                     |
| -------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `actor_mismatch`           | denied    | The turn's agent is not the admitted one                                                                                                                                                                                                                  |
| `receiver_mismatch`        | denied    | The delivered message's receiver is not the executing agent                                                                                                                                                                                               |
| `message_context_mismatch` | denied    | The delivered message's trace or purpose disagrees with the context                                                                                                                                                                                       |
| `no_matching_grant`        | denied    | No `sharedos.execution` / `invoke` grant for the target agent                                                                                                                                                                                             |
| `escalation_requested`     | escalated | The runtime stopped and asked for a human. Nothing was granted                                                                                                                                                                                            |
| `step_limit_exceeded`      | failed    | `StandardRuntime` spent its own steps while the driver was still asking for tools. The envelope's budgets refuse calls instead — see [tool invocation](#tool-invocation)                                                                                  |
| `driver_failed`            | failed    | Your `AgentTurnDriver` threw                                                                                                                                                                                                                              |
| `invalid_driver_decision`  | failed    | The driver returned something that is not a valid decision                                                                                                                                                                                                |
| `runtime_failed`           | failed    | A `RuntimePlugin` threw                                                                                                                                                                                                                                   |
| `invalid_runtime_outcome`  | failed    | A plugin returned a malformed outcome                                                                                                                                                                                                                     |
| `tool_unavailable`         | failed    | A plugin returned `escalate` on a turn whose catalogue does not offer `sharedos.escalate`. The envelope refuses the outcome as it refuses a call outside the catalogue, under the same code; nothing reaches the kernel and nothing is audited (ADR 0017) |
| `turn_cancelled`           | cancelled | Deadline expired, or the host aborted                                                                                                                                                                                                                     |

## Adapters and the MCP harness path

Codes from `@aicoo/sharedos-adapters`. The `harness_*` and `model_*` codes are
how a driver or plugin ends its turn, so they surface as a `failed`
`ExecutionResult`; `escalation_pending` is a tool result on the MCP path.

| Code                                  | Status | Means                                                                                                                                                                                                                                                                    |
| ------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `escalation_pending`                  | denied | A `tools/call` made after the turn asked for a human. The bridge refuses it in band and nothing further runs on that turn (ADR 0018). An agent without the escalation grant gets `tool_unavailable`                                                                      |
| `harness_not_started`                 | failed | The vendor CLI could not be spawned                                                                                                                                                                                                                                      |
| `harness_exited_without_outcome`      | failed | The CLI exited non-zero without a terminal frame                                                                                                                                                                                                                         |
| `harness_ended_without_outcome`       | failed | The harness closed its channel before completing the turn                                                                                                                                                                                                                |
| `harness_frame_limit_exceeded`        | failed | Too many frames without an outcome (`maxIgnoredFrames`)                                                                                                                                                                                                                  |
| `harness_arguments_unparseable`       | failed | Codex or DeepSeek Harness sent tool arguments that are not a JSON object                                                                                                                                                                                                 |
| `harness_command_rejected`            | failed | Pi rejected a command. Retryable                                                                                                                                                                                                                                         |
| `harness_failed`                      | failed | The harness reported its own failure. Retryable; Codex and Claude Code substitute the vendor's own code when the frame names one                                                                                                                                         |
| `model_call_failed`                   | failed | `ModelDriver`'s provider call threw, other than by cancellation                                                                                                                                                                                                          |
| `model_output_truncated`              | failed | The provider cut `ModelDriver`'s reply at the output-token ceiling (`finish_reason: length`). Nothing in a cut-off reply is a decision the model finished making, so none of it is released                                                                              |
| `model_malformed_call_limit_exceeded` | failed | The model made more than `maxMalformedCalls` (default 8) calls whose arguments were not a JSON object. Each was refused in place as `invalid_tool_arguments` and answered back to the model, never sent as `{}`; the turn's metadata counts them as `malformedToolCalls` |

## HTTP

| Status | Code                     | Means                                           |
| ------ | ------------------------ | ----------------------------------------------- |
| 400    | `invalid_json`           | Body is not JSON                                |
| 400    | `invalid_request`        | Body does not match the v1 contract             |
| 403    | `permission_denied`      | An error carrying that code reached the handler |
| 404    | `not_found`              | Unknown path                                    |
| 405    | `method_not_allowed`     | Wrong verb                                      |
| 500    | `invalid_access_context` | `resolveContext` returned an invalid context    |
| 500    | `internal_error`         | Anything else; details never leak               |

## Delegation

Delegation has two boundaries and each has its own vocabulary. `deriveGrant`
refuses to **issue**; the chain check refuses to **honour**. A host that hits the
first has a bug in what it is trying to hand out; a host that hits the second
has a grant that was fine when written and is not fine now.

### Refused at issue — `deriveGrant`

`deriveGrant` returns `{ ok: false, reason }` rather than clamping — a silently
narrowed delegation reads as accepted, and the delegator then believes it passed
on more than it did.

| Reason                         | Means                                                                                                                                                             |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `empty_capabilities`           | Nothing was actually delegated                                                                                                                                    |
| `id_collides_with_parent`      | The derived grant reuses the parent's id                                                                                                                          |
| `parent_not_delegable`         | The parent has no `delegationDepth`, or it is already zero                                                                                                        |
| `depth_exhausted`              | The child asked for a longer chain than was received                                                                                                              |
| `capability_not_within_parent` | Wider or sibling path, an unheld action, an exact parent widened into a subtree, an owner pinned onto an unowned parent, or one capability assembled from several |
| `purpose_not_within_parent`    | A purpose the parent does not carry                                                                                                                               |
| `window_not_within_parent`     | A validity window outside the parent's                                                                                                                            |
| `issued_before_parent`         | The child is dated earlier than the grant that authorized it                                                                                                      |
| `bounded_parent_not_delegable` | A `maxUses` parent. Sharing one budget across a chain needs cross-grant accounting, so it is refused rather than multiplied                                       |

### Refused at use — the chain check

Reported as `delegation_chain_invalid`, with the failing link's code and grant id
in `AuthorizationDecision.metadata`.

| Code                           | Means                                                                   |
| ------------------------------ | ----------------------------------------------------------------------- |
| `issuer_not_parent_subject`    | The child's issuer is not who the parent was issued to                  |
| `namespace_mismatch`           | Parent and child are in different worlds                                |
| `parent_inactive`              | An ancestor is revoked, expired, or out of purpose                      |
| `capability_widened`           | A child capability is not contained in one parent capability            |
| `constraints_widened`          | Window, purposes, or issue order widened — an omitted constraint counts |
| `delegation_not_permitted`     | The parent declares no delegation budget                                |
| `delegation_depth_exceeded`    | The child's budget is not strictly smaller                              |
| `bounded_parent_not_delegable` | The parent is bounded by `maxUses`                                      |
| `chain_cycle`                  | The chain leads back to a grant already walked                          |
| `chain_too_long`               | More links than `DEFAULT_MAX_DELEGATION_CHAIN_LENGTH`                   |

And as `delegation_chain_unverified`, when the chain could not be established at
all: `resolver_unavailable` (none installed), `parent_not_found`, or
`resolver_failed`. Unverified outranks invalid when several grants fail
differently, so an outage is never reported as a policy decision.

## Execution events

`ExecutionResult.events`, append-only and ordered by `sequence`.

| Type             | When                                                                                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `turn.started`   | Admission passed; the runtime is about to run                                                                                                                                        |
| `tool.requested` | The runtime asked for a call, before authorization                                                                                                                                   |
| `tool.completed` | Any outcome — succeeded, denied, or failed                                                                                                                                           |
| `runtime.event`  | A plugin's own event, wrapped rather than trusted                                                                                                                                    |
| `turn.completed` | The runtime finished                                                                                                                                                                 |
| `turn.escalated` | The runtime stopped and asked for a human; the result is `escalated`                                                                                                                 |
| `turn.failed`    | The turn ended in failure; `source` says who ended it — `envelope` (it refused the runtime's outcome, or the runtime threw) or `runtime` (a failure the runtime reported as its own) |
| `turn.denied`    | Admission or context validation refused the turn                                                                                                                                     |
| `turn.cancelled` | Deadline expired or the host cancelled                                                                                                                                               |

## Audit events

| Type                               | Outcomes                        | When                                                            |
| ---------------------------------- | ------------------------------- | --------------------------------------------------------------- |
| `authority.resolved`               | `succeeded`, `failed`           | A turn loaded its authority, once; `failed` is fail-closed      |
| `authorization.checked`            | `allowed`, `denied`             | One decision, before any tool, resource, message, or turn       |
| `escalation.requested`             | `escalated`                     | A turn ended by asking for a human; nothing was granted         |
| `resource.invoked`                 | `succeeded`, `denied`, `failed` | A direct resource operation                                     |
| `tool.invoked`                     | `succeeded`, `denied`, `failed` | A tool call                                                     |
| `tool.catalog.listed`              | `succeeded`, `denied`           | A catalogue was computed; `denied` is an empty one, fail-closed |
| `tool.namespace.catalog.listed`    | `succeeded`                     | The management-plane namespace catalogue was read               |
| `tool.namespace.selection.updated` | `succeeded`, `failed`           | A namespace patch was applied                                   |
| `message.sent`                     | `succeeded`, `denied`, `failed` | A message was delivered through the transport                   |

`authority.resolved` opens a turn: a turn resolves authority once, and this is
the event that records which grants it resolved to. It carries `authorityHash`
and, in `metadata`, the `grantIds` and `grantCount` behind that hash — so every
later decision in the turn, which carries the same hash, can be traced back to
the exact authority set it was made against. A failure records
`authority_unavailable` and `failClosed`, because a source that could not answer
denies rather than widening.

`escalation.requested` is the audit record of a turn that stopped and asked a
human. Its outcome is `escalated`, which is deliberately not `denied`: a denial
is a decision SharedOS made, an escalation is one it declined to make. Counting
them together inflates every denial rate by the cases where the system correctly
asked for help.

Every event carries `version`, `type`, `outcome`, `at`, `traceId`,
`namespaceId`, `actor`, `authority`, `owner`, `purpose`, and where applicable
`resource`, `action`, `grantId`, `authorityHash`, `operationId`, `tool`,
`messageId`, `receiver`, `reason`, and `metadata`.

`authorityHash` names the exact authority set a decision was made against. A
turn resolves authority once, so the `authority.resolved` event that opened it
and every `authorization.checked` and `tool.catalog.listed` event inside it
carry the same value (ADR 0010); a consumer reconstructing a turn can pin every
decision to that one load.

`metadata` keys a host may rely on: `authority.resolved` carries `grantIds` and
`grantCount` (or `failClosed: true` and `authority`, the internal code, when it
failed); `authorization.checked` carries `consumed`, whether a bounded use was
spent, and `failClosed: true` on an infrastructure denial; `tool.catalog.listed`
carries `visibleTools`, the names the caller was shown (empty, with
`failClosed: true`, when denied); `escalation.requested` carries `detail` (the
reason the runtime gave), `reviewer`, `reviewerAssumed`, and `resolution`.

This vocabulary is a compatibility surface. Hosts persist these events under
closed schemas of their own, so a new type, outcome, or top-level field is a
contract change to record here; a new `metadata` key or `reason` string is
not.

Wire `onAuditError` to alerting. A dropped audit write must not pass silently —
it is the only record that separates "was allowed to" from "did it and nobody
stopped it".

## Contract limits

Rejected by the schemas, so they hold identically on both boundaries.

| Limit                       | Value                | Limit                  | Value               |
| --------------------------- | -------------------- | ---------------------- | ------------------- |
| Turn timeout                | ≤ 600,000 ms         | Tool calls per turn    | ≤ 10,000            |
| Steps per turn              | ≤ 1,000              | Tools per request      | ≤ 512               |
| Path segments               | ≤ 64                 | Segment length         | ≤ 256 chars         |
| Capabilities per grant      | ≤ 64                 | Actions per capability | ≤ 64                |
| Purposes per grant          | ≤ 64                 | Purpose length         | ≤ 512 chars         |
| Delegation chain            | ≤ 16                 | Namespaces per catalog | ≤ 256               |
| Search query / grep pattern | ≤ 8,192 chars        | Search results         | ≤ 100               |
| Grep context                | ≤ 100 lines per side | Tool description       | ≤ 8,192 chars       |
| Capsule encoded             | ≤ 128 KB             | Capsule item content   | ≤ 96 KB, ≤ 12 items |

Path segments additionally reject separators, traversal markers, and control
characters. A filesystem-backed provider must **still** resolve beneath its own
root and reject link escapes — the contract cannot see your disk.
