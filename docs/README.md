# SharedOS documentation

- [API reference](api/README.md) — generated reference for every public package

## Start here

- [Host integration guide](host-integration.md): practical embedded and remote
  setup for files, live tools, grants, one-turn execution, and production ports.
- [Architecture](architecture.md): responsibilities, packages, fixed security
  envelope, pluggable runtimes, resource providers, and deployment shapes.
- [Permission model](security/permission-model.md): normative authorization
  invariants and grant evaluation.
- [Threat model](security/threat-model.md): trust boundaries, attack surfaces,
  required controls, and non-goals.
- [Release readiness](release-readiness.md): explicit npm and production gates.
- [npm release runbook](npm-release.md): package validation, first publication,
  trusted publishing, and registry verification.

## Host integrations

- [Aicoo](integrations/aicoo.md): embedded adoption and provider migration.
- [Pulse migration](integrations/pulse-migration.md): concrete files, tools, and
  one-turn cutover plan.
- [PACT](integrations/pact.md): isolated worlds, execution adapters, and the
  experiment scheduler boundary.

## Architecture decisions

- [ADR 0001: Library-first runtime](adr/0001-library-first-runtime.md)
- [ADR 0002: Host-owned storage](adr/0002-host-owned-storage.md)
- [ADR 0003: Scheduler boundary](adr/0003-scheduler-boundary.md)
- [ADR 0004: Canonical resource path segments](adr/0004-canonical-resource-path-segments.md)
- [ADR 0005: Files are the canonical resource plane](adr/0005-files-resource-plane.md)
- [ADR 0006: Tool namespace control plane](adr/0006-tool-namespace-control-plane.md)
- [ADR 0007: Pluggable runtimes inside a fixed security envelope](adr/0007-pluggable-runtime-security-envelope.md)
- [ADR 0011: Escalation is a terminal outcome, not a denial](adr/0011-escalation-terminal-outcome.md)
- [ADR 0012: One refusal vocabulary at both enforcement boundaries](adr/0012-one-refusal-vocabulary.md)

## Project governance

- [Contributing](../CONTRIBUTING.md)
- [Security policy](../SECURITY.md)

The repository is in `0.x` development. If code and documentation disagree on a
security invariant, treat that as a defect: do not weaken enforcement silently.
