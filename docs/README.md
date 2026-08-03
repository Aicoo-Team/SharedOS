# SharedOS documentation

## Start here

- [Architecture](architecture.md): responsibilities, packages, execution flow,
  resource providers, and deployment shapes.
- [Permission model](security/permission-model.md): normative authorization
  invariants and grant evaluation.
- [Threat model](security/threat-model.md): trust boundaries, attack surfaces,
  required controls, and non-goals.
- [Release readiness](release-readiness.md): explicit npm and production gates.

## Host integrations

- [Aicoo](integrations/aicoo.md): embedded adoption and provider migration.
- [PACT](integrations/pact.md): isolated worlds, execution adapters, and the
  experiment scheduler boundary.

## Architecture decisions

- [ADR 0001: Library-first runtime](adr/0001-library-first-runtime.md)
- [ADR 0002: Host-owned storage](adr/0002-host-owned-storage.md)
- [ADR 0003: Scheduler boundary](adr/0003-scheduler-boundary.md)

## Project governance

- [Contributing](../CONTRIBUTING.md)
- [Security policy](../SECURITY.md)

The repository is in `0.x` development. If code and documentation disagree on a
security invariant, treat that as a defect: do not weaken enforcement silently.
