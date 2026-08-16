# Release readiness

SharedOS is a private-source, publicly distributed prerelease. It is not yet a
production security boundary. Prerelease packages use the `next` dist-tag and
carry the Apache-2.0 license.

## Distribution gates

- Verify ownership of the `@sharedos` npm scope and perform the first manual
  publication as `0.1.0-alpha.0`.
- Configure GitHub trusted publishing for every package after its first
  publication, then verify OIDC with the next prerelease.
- Align PACT's Node.js floor with SharedOS (`>=20.11`) before integration.

Completed distribution gates: Apache-2.0 is present in every package archive,
the package set is fixed and package-linted, prereleases cannot become `latest`
accidentally, and `founders@aicoo.io` is the private vulnerability-reporting
contact.

## Production security gates

- Define a durable replay/freshness port for execution IDs, message IDs, tool
  call IDs, and resource operation IDs. Implement atomic Aicoo and isolated PACT
  adapters and reject same-key/different-input replays.
- Use a trusted grant store or verifier and a durable compare-and-set usage store
  for bounded grants. The kernel intentionally fails bounded grants closed when
  no usage store is supplied.
- Persist provider side effects and audit outcomes with a transactional outbox or
  equivalent protocol; wire `onAuditError` to operational alerting.
- Prove every production provider honors `AbortSignal` before committing side
  effects and enforces namespace/owner filtering inside its query.
- Add authentication, payload/rate limits, connector egress controls, secret
  handling, and host-specific policy ceilings at deployment boundaries.
- Run Aicoo and PACT adapter conformance suites covering allow, deny, expiry,
  revocation, bounded-use races, cross-world isolation, replay, cancellation,
  and malformed provider responses.
- Require every non-standard runtime adapter to prove broker-only tool effects,
  step/tool-call/deadline handling, concurrent-run isolation, cancellation, and
  stable manifest provenance. Run untrusted adapters outside the host process.

## Already enforced in this bootstrap

- Deny-by-default complete capability matching with segment-safe paths.
- Separate recipient-scoped grants for messaging and target-agent execution.
- Server-derived remote authority; request bodies cannot supply grants or tools.
- Permission-filtered tool discovery and exact per-call re-authorization.
- Default-off tool namespaces, context-scoped dynamic providers, atomic
  host-owned settings updates, and invocation-time namespace rechecks.
- Mandatory tool argument parsing and immutable checked calls.
- Sanitized model context without grants or issuing authority.
- Fixed runtime security envelope, trusted runtime selection, wrapped plugin
  events, authoritative manifest provenance, and a closed per-turn broker.
- Bounded one-turn execution with step/tool-call/deadline limits, cooperative
  cancellation, and bounded cleanup.
- Runtime-validated HTTP client responses and shared wire schemas.
- Canonical resource path segments and explicit provider-facing owners.
- Package-level READMEs, distributable source and source maps, exact packed
  dependency versions, and a fresh-consumer runtime/type smoke test.
- A dependency-ordered, `next`-tagged release script with package lint, dry-run,
  registry collision checks, canonical-content recovery, and a tag-triggered
  trusted-publishing workflow.
- Apache-2.0 public prerelease metadata, Node 20/22 CI, type checks, tests,
  build, and executable sender-to-receiver quickstart.
