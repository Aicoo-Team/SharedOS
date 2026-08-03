# ADR 0001: Use a library-first runtime

- Status: Accepted
- Date: 2026-08-03

## Context

SharedOS must provide the same permission and execution semantics to Aicoo,
PACT, and future hosts. Aicoo already has product routes, authentication,
persistence, tools, and model integrations. Requiring it to call a new service
for every agent action would add deployment and transaction complexity before a
process boundary is needed.

At the same time, external runtimes and separately deployed hosts need an HTTP
integration path. If HTTP handlers become the primary implementation, embedded
and remote execution can drift into different authorization systems.

## Decision

SharedOS is library-first:

1. JSON-safe contracts live in `@sharedos/contracts`.
2. Deterministic authorization and routing live in `@sharedos/core`.
3. One-turn orchestration lives in `@sharedos/runtime`.
4. `@sharedos/http` is an adapter over that runtime, not a second runtime.
5. `@sharedos/client` is a typed transport client over the same contracts.

Aicoo should initially embed the runtime and supply host adapters. Hosts that
need process isolation can expose the HTTP adapter without changing core
semantics.

## Consequences

### Positive

- Embedded callers avoid an unnecessary network hop.
- A single permission kernel serves both deployment shapes.
- Hosts can keep existing transaction and storage ownership.
- Contract conformance can be tested independently from transport.

### Costs

- Public package boundaries require careful dependency discipline.
- HTTP concerns such as authentication, rate limiting, and serialization remain
  adapter responsibilities.
- Host adapters must be tested against the same conformance suite.

## Rejected alternatives

**Service-first microservice.** Rejected as the initial shape because it would
couple adoption to an operational migration and could duplicate product
transactions.

**Host-specific copies.** Rejected because authorization behavior would drift
between Aicoo, PACT, and external callers.
