# Permission-shaped search

One query can correctly produce different answers for different agents. This
example gives three agents one, two, and three reachable file roots, then runs
the same `files.search` query on behalf of each of them.

```bash
pnpm example:permission-shaped-search
```

```text
1. what each agent's turn can reach, and what comes back

  maya    1 root    Company                       1 hit
  kenji   2 roots   Company + Product             2 hits
  noor    3 roots   Company + Finance + Product   3 hits

2. maya names Team/Finance directly, which no grant of hers covers

  DENY   Team/Finance   reason no_matching_grant   provider invoked 0 more times

3. the owner issues maya a Finance grant — no restart, no cache clear

  maya    2 roots   Company + Finance             2 hits
```

Nothing here retrieves every document and filters the array afterward. Each turn
asks `kernel.reach(context)` which roots are worth naming, and every exact
`files.search` call is authorized again before the provider runs. The two are
separate gates on purpose: reach decides what is worth asking about, and the call
is still refused if it names something reach did not offer.

Step 2 is that second gate stated as a call rather than as a claim. Maya names
`Team/Finance` directly, and the example counts the host provider's invocations
across the attempt: the count does not move. A search that was refused is a
search that never ran, which is what separates this from a filter over rows that
were already fetched.

Step 3 changes authority in the owner's store, not in a cache. Maya's next turn
widens from one root to two. A turn already under way keeps the authority
snapshot it was admitted with — each turn here opens one lease with
`openTurnAuthority` and closes it — so a store edit is observed at the next turn
boundary rather than midway through a turn that was already decided.

The provider's output shape is deliberately the host's own. SharedOS validates
the `files.search` input and controls invocation, but does not specify an output
schema for file search results.

The same scenario is pinned as a regression test in
[`permission-shaped-search.test.ts`](../../packages/os/src/permission-shaped-search.test.ts),
which additionally asserts that the denied call never reaches the provider:

```bash
pnpm exec vitest run packages/os/src/permission-shaped-search.test.ts
```

## Next

- [`examples/fleet-delegation`](../fleet-delegation/README.md) — the same rules
  read through delegation rather than through search
- [Tool and provider model](../../docs/tools.md)
- [Permission model](../../docs/security/permission-model.md)
