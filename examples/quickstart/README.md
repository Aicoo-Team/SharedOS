# Quickstart example

The smallest complete call sequence: one Bob → Alice turn, executed by the real
kernel.

```bash
pnpm example:quickstart
```

```text
{
  visibleTools: [ 'files.search' ],
  status: 'succeeded',
  output: { fileResult: { hits: [Array] } }
}
```

Roughly 115 lines, and every line is one of the five things a turn needs:

1. An `AccessContext` built from trusted state for Alice, the executing
   recipient. Grants are loaded separately from the trusted source.
2. A `ResourceProvider` — here an in-memory stub standing in for storage.
3. An execution grant, because invoking Alice's agent is its own capability and
   a message addressed to her is not enough.
4. An `AgentTurnDriver` — here a scripted one, so the run is deterministic.
5. `SharedOSExecutor`, which admits the turn, hands the driver a filtered
   catalog, and re-authorizes the exact file search before it runs.

`visibleTools` is the part worth reading twice. Twelve `files` tools are
registered; the grant covers `search`, so the driver is shown one. The other
eleven are not hidden from the model by instruction — they are absent from what
it was given.

The executor takes injected `clock` and `createId` functions here, which is how
a test or an evaluation harness makes a turn reproducible.

Bob remains the message sender, but the turn executes as Alice and uses Alice's
independently loaded execution and file grants. Sender identity is provenance;
it never becomes recipient authority.

## Next

- [`examples/reference-host`](../reference-host/README.md) replaces the stubs
  with a real filesystem provider, durable SQLite stores, and a live model.
- [`examples/fleet-delegation`](../fleet-delegation/README.md) shows the
  delegation rules in vocabulary that is not a document product.
- The [quickstart guide](../../docs/quickstart.md) is the same material written
  against the published packages, with no clone required.
