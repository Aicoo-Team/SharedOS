# Release readiness

SharedOS is initialized as a private, testable workspace. It is not yet a public
npm release or a production security boundary. Every leaf package remains
`private: true` until all release gates below are closed deliberately.

## Public release gates

- Choose and add a repository license; propagate it into every package archive.
- Verify Aicoo-Team ownership of the `@sharedos` npm scope and configure trusted
  publishing/provenance.
- Enable and verify a real private vulnerability-reporting channel.
- Align PACT's Node.js floor with SharedOS (`>=20.11`) before integration.

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

## Already enforced in this bootstrap

- Deny-by-default complete capability matching with segment-safe paths.
- Separate recipient-scoped grants for messaging and target-agent execution.
- Server-derived remote authority; request bodies cannot supply grants or tools.
- Permission-filtered tool discovery and exact per-call re-authorization.
- Default-off tool namespaces, context-scoped dynamic providers, atomic
  host-owned settings updates, and invocation-time namespace rechecks.
- Mandatory tool argument parsing and immutable checked calls.
- Sanitized model context without grants or issuing authority.
- Bounded one-turn execution with cooperative cancellation and bounded cleanup.
- Runtime-validated HTTP client responses and shared wire schemas.
- Canonical resource path segments and explicit provider-facing owners.
- Package-level READMEs, distributable source and source maps, exact packed
  dependency versions, and a fresh-consumer runtime/type smoke test.
- A dependency-ordered, `next`-tagged release script with package lint, dry-run,
  registry collision checks, canonical-content recovery, and a tag-triggered
  trusted-publishing workflow. The private package flag remains the final code
  gate until the public release decisions above are closed.
- Private packages, Node 20/22 CI, type checks, tests, build, and executable
  sender-to-receiver quickstart.
