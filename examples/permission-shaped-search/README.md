# Permission-shaped search example

One query can correctly produce different answers for different agents. This
example gives three agents one, two, and three reachable file roots, then runs
the same `files.search` query for each of them.

```bash
pnpm example:permission-shaped-search
```

```text
BEFORE  Maya   1 row   Company
BEFORE  Kenji  2 rows  Company + Product
BEFORE  Noor   3 rows  Company + Finance + Product
DENY    Maya → Finance  no_matching_grant
AFTER   Maya   2 rows  Company + Finance
```

The example does not retrieve every document and filter the array afterward.
It asks `kernel.reach(context)` which roots are worth naming, and every exact
`files.search` call is authorized again before the provider runs. The explicit
Finance probe demonstrates the boundary: without a matching grant, the
provider is never invoked.

Issuing the additional grant changes Maya's next turn. Existing turns keep the
authority snapshot they were admitted with; a store-side change is observed at
the next turn boundary.

The provider output is deliberately a host-owned shape. SharedOS validates the
`files.search` input and controls invocation, but does not currently specify an
output schema for file search results.

## Next

- [Tool and provider model](../../docs/tools.md)
- [Permission model](../../docs/security/permission-model.md)
- [Quickstart example](../quickstart/README.md)
