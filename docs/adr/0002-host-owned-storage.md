# ADR 0002: Keep production storage in the host

- Status: Accepted
- Date: 2026-08-03

## Context

Files, derived indexes, messages, grants, and audit records need durable storage
in a product. Aicoo already has a database and embedding infrastructure. PACT
needs a fresh isolated world for each experiment. Future hosts may use a native
filesystem, SQLite, Postgres, a vector store, or a remote data service.

If SharedOS embeds one storage technology, its permission model becomes coupled
to one product and PACT cannot reproduce production execution against an
isolated world. If storage semantics are entirely left to hosts, however, hosts
can accidentally bypass authorization or disagree about what a file operation
means.

## Decision

SharedOS owns resource contracts, capability names, authorization order,
provider interfaces, and audit requirements. The host owns production data and
implements the providers.

In particular:

- File capability semantics and portable operations belong to SharedOS.
- Notes, folders, file content, retention, deletion, and databases belong to
  the host.
- Memory and workspace are file roles, roots, indexes, or mounted views; their
  storage and indexing belong to the host while their source-file authority is
  preserved by SharedOS.
- Tool registration and invocation gates belong to SharedOS.
- OAuth credentials, MCP sessions, and concrete connectors belong to the host.

`@aicoo/sharedos-testkit` may provide in-memory implementations for tests and examples.
They are not a recommended production data layer.

## Consequences

### Positive

- Aicoo can reuse its existing data without making SharedOS import Drizzle,
  Azure, or its schema.
- PACT can create a hermetic world without seeing product or gold data.
- Storage vendors can change without changing permission semantics.
- SharedOS can publish provider conformance tests.

### Costs

- Host adapters are trusted computing-base components and need review.
- Transactionality across providers is a host-level concern unless a future
  contract explicitly standardizes it.
- SharedOS cannot guarantee durability when a host provider violates its
  contract.

## Rejected alternatives

**SharedOS-owned database schema.** Rejected because it would force product data
migration and couple the core to a persistence stack.

**Opaque host tools for every resource.** Rejected because it would discard
portable file semantics and make permission enforcement inconsistent.

ADR 0005 later tightened the standard resource plane to the canonical `files`
namespace. That refinement preserves this ADR's host-owned-storage boundary.
