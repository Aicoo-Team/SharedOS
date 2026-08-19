# ADR 0005: Files are the canonical resource plane

- Status: Accepted
- Date: 2026-08-07

## Context

The initial SharedOS bootstrap exposed `memory.*` and `workspace.*` as separate
resource namespaces. That model assumes memory is a separate database beside a
mutable workspace.

The host model SharedOS must support is file-as-memory. A representative host
stores raw capture, memory, workspace, and curated wiki content in one
notes-and-folders file plane. `Memory/Self/MEMORY.md`, identity files,
relationship shards, and daily logs are ordinary files. Search indexes, embeddings, compaction, and context mounting
are derived behavior over those files.

Separate resource namespaces create two identities for the same content. They
can make a file readable through one path but searchable through another, split
audit history, and let an index become an unintended source of authority.

## Decision

`files` is the only standard persistent-resource namespace in SharedOS.

Standard tools are:

- `files.list`, `files.stat`, `files.read`, `files.search`, `files.grep`;
- `files.create`, `files.replace`, `files.append`, `files.delete`;
- `files.snapshot.create`, `files.snapshot.list`, `files.snapshot.restore`.

Create, replace, append, and delete are separate actions. A broad `write`
action is not standard because it cannot express create-only or append-only
authority. Replace, append, delete, and snapshot restore accept version guards
where applicable; production providers own atomic enforcement.

Memory is a semantic role, path convention, index, or runtime mount over files.
A memory search must authorize the real source file scope and return source
identity and revision metadata. It cannot rely on an independent `memory`
grant. Raw, Memory, Workspace, and Wiki are host-defined roots, not SharedOS
resource namespaces.

The `memory.*` and `workspace.*` standard aliases are removed during `0.x`.
Hosts may register higher-level memory tools such as compaction or context
mounting, but those tools must resolve back to `files` requirements before any
read or side effect.

Move and copy are intentionally not standardized yet. They touch both source
and destination resources, while the current tool contract resolves one
capability requirement. SharedOS must first support and audit an atomic set of
requirements without allowing independent grants to form an unintended
cross-product.

## Consequences

### Positive

- One file has one resource identity for read, search, mutation, snapshot, and
  audit.
- File-backed memory remains directly inspectable and editable by users.
- Search indexes and embeddings cannot bypass source-file grants.
- Hosts can expose different roots and storage engines without changing the
  permission model.
- Create-only, append-only, replace, and delete authority are distinguishable.

### Costs

- Early adopters must rename standard tools and grants.
- Providers must map file paths to their stable host records and include
  version/source metadata in results.
- Multi-resource operations require a later kernel contract.
- Context selection, compaction, and knowledge promotion remain host behavior
  until separate portable contracts are justified.

## Migration

1. Replace `memory` and `workspace` resource grants with `files` grants whose
   paths include the host root, for example `Memory/Self/MEMORY.md`.
2. Replace standard tool names with `files.*` names.
3. Map old `write` grants deliberately to `create`, `replace`, and/or `append`;
   never expand them automatically to `delete`.
4. Make semantic search filter its index by the same namespace, owner, and path
   scope before ranking or counting results.
5. Remove compatibility aliases after shadow comparisons show no widened
   decisions.
