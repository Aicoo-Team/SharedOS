**SharedOS API v0.1.0-alpha.0**

---

# API reference

This reference is generated from the eight public SharedOS package entry points.
It documents the same symbols that consumers can import from each package root;
private workspace packages, examples, tests, and implementation-only modules are
not included.

## Choose a package

| Package                     | Use it for                                                     |
| --------------------------- | -------------------------------------------------------------- |
| `@aicoo/sharedos-contracts` | JSON-safe protocol types and runtime-validation schemas        |
| `@aicoo/sharedos-core`      | Deny-by-default authorization, registries, dispatch, and audit |
| `@aicoo/sharedos-os`        | Standard permission-controlled `files` tools and adapters      |
| `@aicoo/sharedos-runtime`   | One-turn execution, runtime plugins, and the standard runtime  |
| `@aicoo/sharedos-http`      | Fetch-compatible HTTP service adapter                          |
| `@aicoo/sharedos-client`    | Runtime-validated HTTP client                                  |
| `@aicoo/sharedos`           | Convenience re-export of the production packages               |
| `@aicoo/sharedos-testkit`   | Deterministic in-memory fixtures for tests and examples        |

The SDK adds no independent symbols, so re-exported definitions appear once on
their owning package pages rather than being duplicated on the SDK page.

SharedOS separates compile-time TypeScript types from runtime validation. Parse
untrusted values with the exported schemas at process and network boundaries;
do not treat a type assertion as validation or authority.

## Authoring model

Package READMEs explain when and why to use an API. TSDoc comments beside public
declarations explain individual symbols, parameters, return values, errors, and
security constraints. TypeDoc then follows each `src/index.ts` barrel and turns
those sources into this reference. Edit the README or source comment—not files
under `docs/api`, which are generated.

## Generate the reference

```bash
pnpm docs:api
```

The command reads each package's `src/index.ts`, so the reference follows the
actual public export surface. Generated files live in `docs/api`. To verify that
the committed reference is current without modifying it, run:

```bash
pnpm docs:api:check
```

Package READMEs provide task-oriented introductions and examples. The pages
below provide the complete generated signatures and member-level reference.

## Packages

| Package                                                | Description                                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------------------------- |
| [@aicoo/sharedos](sharedos.md)                         | Permission-controlled state and delegation SDK with pluggable agent runtimes    |
| [@aicoo/sharedos-client](sharedos-client.md)           | Runtime-validated HTTP client for SharedOS                                      |
| [@aicoo/sharedos-conformance](sharedos-conformance.md) | Standard execution records and infrastructure conformance evidence for SharedOS |
| [@aicoo/sharedos-contracts](sharedos-contracts.md)     | JSON-safe protocol contracts for SharedOS                                       |
| [@aicoo/sharedos-core](sharedos-core.md)               | Deny-by-default capability kernel for SharedOS                                  |
| [@aicoo/sharedos-http](sharedos-http.md)               | Fetch-compatible HTTP adapter for SharedOS                                      |
| [@aicoo/sharedos-os](sharedos-os.md)                   | Standard permission-controlled file capabilities for SharedOS                   |
| [@aicoo/sharedos-runtime](sharedos-runtime.md)         | Fixed SharedOS security envelope with standard and pluggable one-turn runtimes  |
| [@aicoo/sharedos-testkit](sharedos-testkit.md)         | In-memory conformance helpers for SharedOS hosts                                |
