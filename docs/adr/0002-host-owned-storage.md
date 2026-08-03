# ADR 0002: Keep production storage in the host

- Status: Accepted
- Date: 2026-08-03

## Context

Memory, workspace, messages, grants, and audit records need durable storage in a
product. Aicoo already has a database and embedding infrastructure. PACT needs a
fresh isolated world for each experiment. Future hosts may use files, SQLite,
Postgres, a vector store, or a remote data service.

If SharedOS embeds one storage technology, its permission model becomes coupled
to one product and PACT cannot reproduce production execution against an
isolated world. If storage semantics are entirely left to hosts, however, hosts
can accidentally bypass authorization or disagree about what a memory or
workspace operation means.

## Decision

SharedOS owns resource contracts, capability names, authorization order,
provider interfaces, and audit requirements. The host owns production data and
implements the providers.

In particular:

- Memory capability semantics belong to SharedOS.
- Memory records, embeddings, retention, deletion, and databases belong to the
  host.
- Workspace operations and permission checks belong to SharedOS.
- Notes, files, folders, and sandbox state belong to the host.
- Tool registration and invocation gates belong to SharedOS.
- OAuth credentials, MCP sessions, and concrete connectors belong to the host.

`@sharedos/testkit` may provide in-memory implementations for tests and examples.
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
portable memory and workspace semantics and make permission enforcement
inconsistent.
