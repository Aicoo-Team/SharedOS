# ADR 0015: One message purpose and recipient-owned execution

- Status: Accepted
- Date: 2026-08-26

## Context

The message contract carried both `purpose` and `intent`. They described the
same reason for a message, but only `purpose` participated in access context,
grant matching, turn validation, and audit. Keeping a second model-authored
field created an apparent policy channel that authorization did not use.

Inbound execution also bound the turn context actor to the message sender. That
worked only when an agent executed its own outbound message. For an actual
request from Bob to Alice, it either ran Alice's turn as Bob or rejected the
request before admission. Neither result represents the authority of the agent
that is executing.

Finally, `sendMessage()` authorized and delivered a complete host-authored
envelope, but the model had no narrow operation for requesting another agent's
work. Letting a model author the sender, purpose, trace, or message identifier
would make untrusted output choose trusted correlation and policy context.

## Decision

### One purpose

`MessageEnvelope` has one host-bound `purpose` and no `intent` field. The
purpose is copied from the trusted `AccessContext`; it remains part of grant
matching, turn validation, and audit. Payload data cannot replace or modify it.

This is a breaking prerelease contract change. `MessageEnvelopeSchema` is
strict, so an old envelope that still contains `intent` fails parsing rather
than silently carrying an unused policy-like field.

### Sender-owned sends, recipient-owned turns

The actor depends on which boundary is executing:

- For an outbound `sendMessage()` call, `context.actor` must be the envelope's
  sender. The purpose and trace must also match the context.
- For an inbound turn, `context.actor` must be the executing `request.agent`,
  and the message receiver must be that same agent. The sender is untrusted
  input to the recipient's turn and does not become its actor.

The message purpose and trace still have to match the recipient turn's trusted
context. A requester therefore needs a recipient-scoped
`sharedos.messaging/send` grant to send, while the recipient needs a separate
`sharedos.execution/invoke` grant to execute. File and tool operations inside
the recipient's turn use the recipient actor's independently resolved grants.
A message never transfers the requester's authority.

### A narrow model-authored request

The canonical `messages.request` tool accepts exactly two model-authored
arguments:

```json
{
  "recipient": { "kind": "agent", "agentId": "alice" },
  "payload": { "question": "What is the Atlas status?" }
}
```

The trusted runtime supplies the sender, purpose, trace, timestamp, and message
identifier. The argument schema rejects `sender`, `purpose`, `traceId`,
`messageId`, `intent`, and `replyTo`. Message identifiers are created by a
trusted kernel option rather than copied from the tool-call id.

The tool resolves a recipient-scoped send requirement, consumes that exact
capability once, and then uses the same post-authorization delivery path as
direct `sendMessage()`. Delivery is not authorized twice. The transport receipt
must preserve the trusted message id.

After accepted delivery, a host-owned `MessageRequestRouter` resolves the
durable reply. SharedOS accepts it only when `replyTo` names the immutable
request id, sender and receiver are reversed, and purpose and trace are
unchanged. Only the reply payload is returned to the model.

### Host ports, not a messaging platform

`MessageTransport` and `MessageRequestRouter` are host ports. A host may back
them with a durable log, inbox, queue, or network, and its scheduler may wake the
recipient and execute another SharedOS turn. SharedOS defines authorization,
correlation, validation, cancellation, typed outcomes, and audit at the
boundary; it does not own a production queue, receiver wake-up, request/reply
coordinator, retry policy, or multi-turn scheduler.

The request tool is exposed only when both ports are configured. Tool discovery
still requires the `messages` namespace and a matching recipient-scoped send
capability; invocation re-authorizes the exact recipient.

## Consequences

- Hosts must remove `intent` from persisted fixtures and wire payloads and use
  `purpose` as the only policy-bound reason for a message.
- A host constructing an inbound turn uses the recipient as `context.actor` and
  resolves that recipient's authority. It does not impersonate the sender.
- Requester send authority, recipient execution authority, and the recipient's
  file or tool authority are independently grantable and auditable.
- Direct host-authored delivery remains available through `sendMessage()`.
  Model-authored request/reply uses `messages.request` and cannot choose trusted
  envelope fields.
- Durable delivery, wake-up, and scheduling remain replaceable host behavior,
  so SharedOS stays host-neutral and one-turn scoped.

## Rejected alternatives

**Keep both `intent` and `purpose`.** Rejected because two names for one reason
invite drift, and only one of them is an authorization axis. A model-authored
description can live in `payload` without looking like policy.

**Run the recipient turn as the sender.** Rejected because the receiving model
would discover and invoke tools using the requester's identity rather than its
own. Sender identity is provenance, not recipient authority.

**Let the model author a complete envelope.** Rejected because sender, purpose,
trace, and correlation identifiers are trusted execution context. Exposing them
as arguments would let untrusted output select policy and provenance.

**Call `sendMessage()` from the request tool.** Rejected because the generic
tool boundary has already authorized and consumed the exact send capability.
Calling the public method would consume a bounded grant twice.

**Put a queue and scheduler in SharedOS.** Rejected because persistence,
delivery policy, recipient wake-up, retries, and multi-turn topology are host
concerns. Standardizing their authorization boundary does not require owning
their lifecycle.
