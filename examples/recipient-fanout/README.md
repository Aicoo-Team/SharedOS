# Recipient-scoped single-use messaging

When one agent asks N recipients a question, that is N authorizations, not one.
Issue N grants, each with one exact `messageSendCapability(recipient, owner)` and
`constraints.maxUses: 1`. A single grant covering every recipient would share one
usage budget across them, so the first send would spend the rest.

```bash
pnpm example:recipient-fanout
```

```text
1. three colleagues, three single-use tickets, one turn

  SENT   colleague-0    ticket spent 1/1   reply from colleague-0
  SENT   colleague-1    ticket spent 1/1   reply from colleague-1
  SENT   colleague-2    ticket spent 1/1   reply from colleague-2

  deliveries: 3, all distinct: true

2. the same question asked twice of one colleague

  DENY   colleague-0    caller is told tool_unavailable, audit says grant_exhausted

  A spent bounded grant is not reach, so the replay is refused at discovery.
  The caller learns nothing about the ticket. deliveries: 1

3. a colleague nobody issued a ticket for

  DENY   colleague-1    no_matching_grant   colleague-0's ticket spent 0/1

  Refused on the recipient, not on discovery: the asker still holds an unspent
  ticket, so the tool is visible. deliveries: 0

4. the owner revokes one ticket; the other is untouched

  DENY   colleague-0    revoked   no_matching_grant
  SENT   colleague-1    ticket untouched

  deliveries: 1

5. no usage store, so a single-use ticket cannot be counted

  DENY   colleague-0    tool_unavailable
  DENY   colleague-1    tool_unavailable

  Fails closed before the transport is reached. deliveries: 0
```

Each scene builds its own kernel, tickets, and usage store, because a spent
ticket stays spent — that is the property, so it cannot be undone between scenes.
Every scene runs inside one authority lease opened with `openTurnAuthority`, the
shape `SharedOSExecutor` runs every turn in. The lease holds the grant set only:
usage is read and consumed per decision, so a ticket cannot be spent twice even
inside a single turn.

Scenes 2 and 3 are the two refusals worth telling apart. A replay is refused at
**discovery**, because a bounded grant whose budget is spent is not reach — the
caller is told `tool_unavailable` and learns nothing about the ticket, while the
trusted audit event carries `grant_exhausted`. A wrong recipient is refused at
the **capability check** with `no_matching_grant`, because the asker still holds
an unspent ticket and so the tool is visible. A consumer that needs to tell
"spent" from "never granted" reads audit, not the refusal.

The same behaviours are pinned as regression tests in
[`message-fanout.test.ts`](../../packages/core/src/message-fanout.test.ts), which
additionally races each recipient's request against a duplicate at 1 and 25
recipients. Under that race, which refusal the loser is handed depends on whether
it cleared discovery before the winner consumed, so the concurrent case pins the
outcome and the ordered case pins the code:

```bash
pnpm exec vitest run packages/core/src/message-fanout.test.ts
```

These are authorization and dispatch tests, not a latency benchmark or a claim
that 25 model turns ran.

## Host responsibilities

- Load grants from the trusted `GrantSource`; put only the question in the
  message payload. A payload never supplies authority.
- Install a `GrantUsageStore` with atomic consumption. The example uses the
  in-memory implementation; production persistence belongs to the host. Scene 5
  shows what happens without one: it fails closed before the transport.
- Match `AccessContext.authority` to the grant issuer and give each grant a unique
  ID within its namespace.
- Open one authority lease per turn and close it on every exit path. A store edit
  made during a turn lands on the next one, which is why the revocation scene
  revokes before opening its turn.
- Start each recipient's actual turn separately using that recipient's own
  grants. The example reply router echoes the recipient to isolate dispatch and
  correlation behavior; it does not execute a department model or file read.
- Issue a new ticket deliberately for a subsequent review. Do not silently
  replenish an exhausted grant in a retry loop.
- Check the returned `status`, including `denied`, rather than relying on HTTP
  status alone when using the HTTP adapter.

## Next

- [`examples/fleet-delegation`](../fleet-delegation/README.md) — the same rules
  read through delegation rather than through send tickets
- [Reason and error codes](../../docs/errors.md)
- [Permission model](../../docs/security/permission-model.md)
