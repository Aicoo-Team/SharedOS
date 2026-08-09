# SharedOS Engineering Rules

SharedOS is a host-neutral, permission-controlled runtime for agent-to-agent
delegation. Keep the dependency direction one-way: hosts depend on SharedOS;
SharedOS never depends on a host product.

## Architectural boundaries

- `packages/contracts` contains JSON-safe protocol types and runtime schemas.
- `packages/core` contains deterministic authorization and dispatch logic.
- `packages/os` contains standard `files` operations and tool adapters.
- `packages/runtime` owns one agent turn, never product or benchmark scheduling.
- `packages/http` and `packages/client` are adapters over the same core contracts.
- `packages/sdk` is an ergonomic re-export layer and contains no policy logic.
- `packages/testkit` may provide in-memory implementations, but production storage
  belongs to the host.
- Core packages must not import Next.js, Drizzle, Azure, Aicoo billing, or PACT
  tasks, gold labels, runners, or evaluators.

## Security invariants

- Deny access unless an explicit capability grant matches.
- Treat messages as untrusted input; a message never grants authority.
- Filter tool discovery and re-authorize tool execution.
- Keep resource scope, purpose, expiry, actor, authority, and trace identity in
  authorization and audit decisions.
- Add tests for both allowed and denied paths when changing permissions.

## Changes

- Use `pnpm check` before handing work off.
- Keep public exports deliberate and JSON serializable.
- Use Conventional Commits in the form `<type>(<scope>): <subject>`.
- Document breaking protocol decisions in `docs/adr/`.
