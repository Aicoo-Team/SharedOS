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

`ExecutionResult` adds `cancelled` for a deadline or host cancellation.

Over HTTP all four are **200**. A `403` means the request never reached the
kernel's decision. Client code that only checks the HTTP status will read
denials as successes.

## Authorization reason codes

`AuthorizationDecision.reasonCode`, and the `reason` field on
`authorization.checked` audit events.

| Code                           | Means                                                             | Fix                                              |
| ------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------ |
| `allowed`                      | A grant matched                                                   | —                                                |
| `no_matching_grant`            | Nothing in `context.grants` covers this resource and action       | See the checklist below                          |
| `grant_exhausted`              | A matching grant exists but its `maxUses` is spent                | Issue a new grant; usage is not resettable       |
| `invalid_context`              | The `AccessContext` failed its schema                             | A host bug. Build the context server-side        |
| `invalid_request`              | The resource or action failed its schema                          | Check path segments and action naming            |
| `usage_store_unavailable`      | The grant has `maxUses` and there is no `usageStore`, or it threw | Supply `CapabilityAuthorizer({ usageStore })`    |
| `delegation_chain_unavailable` | The grant was derived and there is no `chainResolver`             | Supply `CapabilityAuthorizer({ chainResolver })` |
| `delegation_chain_broken`      | An ancestor is missing, revoked, or expired                       | Working as intended — upstream authority ended   |

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
7. **The action is not listed.** `actions` has no wildcard expansion.
8. **A `grantVerifier` returned false or threw.** A throw is treated as false.
9. **The capability is spread across grants.** One requirement must be satisfied
   by one grant. Path from one and action from another is refused deliberately.

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

## Tool invocation

| Code                                 | Status | Means                                                                  |
| ------------------------------------ | ------ | ---------------------------------------------------------------------- |
| `tool_unavailable`                   | denied | Not registered, namespace off, or not discoverable — see above         |
| `tool_not_available`                 | denied | A runtime asked for a tool outside its permission-filtered turn        |
| `no_matching_grant`                  | denied | The exact argument-selected resource is not authorized                 |
| `invalid_tool_arguments`             | failed | `parseArguments` rejected the call                                     |
| `invalid_tool_requirement`           | failed | `resolveRequirement` returned something outside the declared ceiling   |
| `tool_requirement_resolution_failed` | failed | `resolveRequirement` threw                                             |
| `tool_catalog_unavailable`           | failed | A `ContextToolProvider` threw. The catalog is never partially returned |
| `tool_execution_failed`              | failed | Your `invoke` threw                                                    |
| `invalid_tool_result`                | failed | Your handler returned something that is not a `ToolResult`             |
| `trace_mismatch`                     | failed | `call.traceId` does not match the context                              |

## Resources

| Code                          | Status | Means                                                                                          |
| ----------------------------- | ------ | ---------------------------------------------------------------------------------------------- |
| `resource_provider_not_found` | failed | No provider registered for that namespace                                                      |
| `resource_execution_failed`   | failed | Your provider threw                                                                            |
| `invalid_resource_result`     | failed | Your provider returned a malformed `ResourceResult`, or one whose `operationId` does not match |

## Messages

| Code                                    | Status | Means                                               |
| --------------------------------------- | ------ | --------------------------------------------------- |
| `message_transport_not_configured`      | failed | No `messageTransport` was supplied to the kernel    |
| `message_context_mismatch`              | failed | The envelope disagrees with the context             |
| `receiver_mismatch`                     | failed | The delivered receiver is not the addressed one     |
| `message_requirement_resolution_failed` | failed | The capability resolver threw                       |
| `message_delivery_failed`               | failed | Your transport threw                                |
| `invalid_message_receipt`               | failed | Your transport returned a malformed delivery result |

## Turns

| Code                       | Status    | Means                                                         |
| -------------------------- | --------- | ------------------------------------------------------------- |
| `actor_mismatch`           | denied    | The turn's agent is not the admitted one                      |
| `no_matching_grant`        | denied    | No `sharedos.execution` / `invoke` grant for the target agent |
| `step_limit_exceeded`      | failed    | `StandardRuntime` hit its driver step budget                  |
| `tool_call_limit_exceeded` | failed    | The envelope's `maxToolCalls` was reached                     |
| `driver_failed`            | failed    | Your `AgentTurnDriver` threw                                  |
| `invalid_driver_decision`  | failed    | The driver returned something that is not a valid decision    |
| `runtime_failed`           | failed    | A `RuntimePlugin` threw                                       |
| `invalid_runtime_outcome`  | failed    | A plugin returned a malformed outcome                         |
| `turn_cancelled`           | cancelled | Deadline expired, or the host aborted                         |

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

## Delegation refusals

`deriveGrant` returns `{ ok: false, reason }` rather than clamping — a silently
narrowed delegation reads as accepted, and the delegator then believes it passed
on more than it did.

| Reason                         | Means                                                                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `namespace_mismatch`           | The child names a different world                                                                                                           |
| `issuer_is_not_the_holder`     | Only the parent's subject may pass it on                                                                                                    |
| `parent_not_delegable`         | The parent has no `delegationDepth`, or it is already zero                                                                                  |
| `depth_exhausted`              | The child asked for a longer chain than was received                                                                                        |
| `capability_not_within_parent` | Wider or sibling path, an unheld action, an exact parent widened into a subtree, or one child capability assembled from several parent ones |
| `purpose_not_within_parent`    | A purpose the parent does not carry                                                                                                         |
| `window_not_within_parent`     | A validity window outside the parent's                                                                                                      |
| `bounded_parent_not_delegable` | A `maxUses` parent. Sharing one budget across a chain needs cross-grant accounting, so it is refused rather than multiplied                 |
| `empty_capabilities`           | Nothing was actually delegated                                                                                                              |

## Execution events

`ExecutionResult.events`, append-only and ordered by `sequence`.

| Type             | When                                               |
| ---------------- | -------------------------------------------------- |
| `turn.started`   | Admission passed; the runtime is about to run      |
| `tool.requested` | The runtime asked for a call, before authorization |
| `tool.completed` | Any outcome — succeeded, denied, or failed         |
| `runtime.event`  | A plugin's own event, wrapped rather than trusted  |
| `turn.completed` | The runtime finished                               |
| `turn.failed`    | The runtime or driver failed                       |
| `turn.denied`    | Admission or context validation refused the turn   |
| `turn.cancelled` | Deadline expired or the host cancelled             |

## Audit events

| Type                               | Outcomes                        |
| ---------------------------------- | ------------------------------- |
| `authorization.checked`            | `allowed`, `denied`             |
| `resource.invoked`                 | `succeeded`, `denied`, `failed` |
| `tool.invoked`                     | `succeeded`, `denied`, `failed` |
| `tool.catalog.listed`              | `succeeded`                     |
| `tool.namespace.catalog.listed`    | `succeeded`                     |
| `tool.namespace.selection.updated` | `succeeded`, `failed`           |
| `message.sent`                     | `succeeded`, `denied`, `failed` |

Every event carries `version`, `type`, `outcome`, `at`, `traceId`,
`namespaceId`, `actor`, `authority`, `owner`, `purpose`, and where applicable
`resource`, `action`, `grantId`, `operationId`, `tool`, `messageId`,
`receiver`, `reason`, and `metadata`.

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
