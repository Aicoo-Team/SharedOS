# Security policy

SharedOS is a security-sensitive permission and execution layer. We appreciate
responsible reports that help protect agents, users, host data, and external
tool accounts.

## Supported versions

SharedOS is currently in pre-release development and has no stable supported
release line. Security fixes are made on the latest repository revision. Do not
assume `0.x` APIs or deployments are production hardened unless a release says
so explicitly.

| Version                     | Supported                   |
| --------------------------- | --------------------------- |
| Latest pre-release revision | Yes, on a best-effort basis |
| Older unreleased revisions  | No                          |

This table will be replaced with a formal maintenance window before a stable
release.

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability.

During the private bootstrap, authorized collaborators should contact the
Aicoo-Team repository owners through the team's existing private channel and
request a dedicated secure thread. Include:

- the affected package, version or commit;
- the security invariant that can be bypassed;
- a minimal reproduction or proof of concept;
- realistic impact and required attacker access;
- any suggested mitigation;
- whether the issue is already public or under active exploitation.

GitHub private vulnerability reporting is not enabled for this repository yet.
Enabling and verifying it—or publishing another concrete security contact—is a
release gate before any external distribution. Do not include secrets,
production user data, live credentials, or destructive payloads in the initial
message.

Maintainers will acknowledge the report, validate impact, coordinate a fix and
release, and agree on disclosure timing with the reporter. Response times may
vary while the project is pre-release; urgent exploitation evidence should be
clearly marked.

## High-priority areas

Reports are especially valuable when they demonstrate:

- authorization without a complete active grant;
- forged or caller-supplied grants being accepted as trusted authority;
- cross-tenant or cross-world memory, workspace, message, or audit access;
- grant expiry, revocation, purpose, or bounded-use bypass;
- tool discovery or invocation escaping its registered capability;
- message content or model output creating authority;
- replay or idempotency failure causing duplicate side effects;
- credential leakage through contracts, model context, errors, or audit events;
- SSRF, path traversal, or MCP connector escape;
- PACT execution receiving hidden evaluator or gold state.

The normative project expectations are documented in the
[permission model](docs/security/permission-model.md) and
[threat model](docs/security/threat-model.md).

## Safe research guidelines

- Test only against repositories, fixtures, and deployments you are authorized
  to use.
- Prefer `@sharedos/testkit` and synthetic data.
- Do not access, modify, retain, or disclose another user's data.
- Do not disrupt availability or trigger real external side effects.
- Stop testing and report privately if you encounter secrets or production data.

Good-faith research that follows these guidelines is welcome. This policy does
not authorize testing of third-party services, Aicoo production systems, or host
deployments.

## Security requirements for contributors

Permission changes require allow and deny tests. Protocol inputs must be
validated at trust boundaries. Messages, model output, retrieved content, and
remote payloads are untrusted. New side effects require explicit capability and
audit design before implementation.

Never commit secrets, private keys, access tokens, production data, or real user
content.
