# Fleet delegation example

One robot delegates part of its mandate to another, and cannot pass on more than
it holds.

```bash
pnpm example:fleet-delegation
```

Everything here is the real kernel. The only thing the example invents is
vocabulary: `fleet/cell-3/arm-1` is a resource path and `grip` is an action,
exactly as `files/Memory/notes.md` and `read` are elsewhere. SharedOS does not
know what an arm is, which is the point — a host names its own resources and the
same authorization rules apply.

That makes it the clearest way to read the delegation model, because nothing in
it can be mistaken for a feature of a notes product.

```text
ALLOW  the exact thing it was given                   cell-3/arm-1·grip
DENY   an action it was not given                      cell-3/arm-1·release
DENY   a different arm in the same cell                cell-3/arm-2·grip
DENY   a neighbouring cell (prefix, not parent)        cell-30/arm-1·grip
DENY   grip(arm-1) + move(arm-2) => move(arm-1)?       cell-3/arm-1·move
```

Each line is a rule that a "looks narrower" comparison would get wrong:

- **`cell-30` is not inside `cell-3`.** Paths are compared segment by segment,
  never as string prefixes.
- **Two grants do not combine.** Holding `grip` on one arm and `move` on another
  does not produce `move` on the first. One requirement must be satisfied by one
  grant, or the cross-product becomes the permission model.
- **A bounded grant cannot be delegated at all.** Sharing one `maxUses` budget
  across a chain needs accounting that spans grants, so `deriveGrant` refuses
  rather than handing each delegate its own copy of the budget.

The last two steps are the ones that matter operationally. The operator revokes
the _first_ robot's shift grant, and the call that was allowed in step 3 is now
denied — without anyone rewriting the second robot's grant. Revocation is
checked when authority is used, not when it was handed over, which is what makes
an emergency stop mean something.

Then it prints the audit trail, because after an incident the question is not
whether the fleet stopped but which authority permitted each motion.

## Next

- [`examples/reference-host`](../reference-host/README.md) — the host ports a
  product has to implement
- [Permission model](../../docs/security/permission-model.md) — the normative
  invariants these lines demonstrate
