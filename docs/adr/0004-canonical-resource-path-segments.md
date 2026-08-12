# ADR 0004: Canonical resource path segments

- Status: Accepted
- Date: 2026-08-06

## Context

SharedOS authorizes resource descendants by comparing structured path segments.
The initial schemas allowed traversal markers, embedded path separators, and
control characters inside a segment. Segment-wise authorization was therefore
correct as an abstract comparison, but a filesystem adapter that joined those
segments could reinterpret `..`, `/`, or `\` and escape the authorized path.

Requiring every provider to independently rediscover the same validation rule
would make a central authorization guarantee depend on adapter consistency.

## Decision

SharedOS defines one exported `PathSegmentSchema` for all resource and standard
OS paths. A segment is trimmed, non-empty, at most 256 characters, and cannot be
`.` or `..`, contain `/` or `\`, or contain ASCII control characters.

Filesystem providers remain responsible for resolving beneath a configured
root, rejecting symlink escapes, and avoiding platform-specific aliasing. The
central schema establishes the minimum portable vocabulary; it does not replace
provider containment checks.

Generic resource dispatch also materializes an omitted resource owner from the
trusted access context before authorization, audit, and provider invocation.
Providers therefore receive the same explicit owner that the kernel evaluated.

## Consequences

- Previously accepted ambiguous paths are now rejected at protocol boundaries.
- File, embedded, and HTTP paths use the same segment rules.
- Providers have fewer unsafe representations to handle but still enforce
  storage-specific containment.
- This is a deliberate `0.x` protocol tightening and requires synchronized
  package versions.

## Rejected alternatives

- **Validate only in filesystem adapters.** This leaves non-filesystem hosts
  with different path semantics and makes omissions easy.
- **Normalize traversal after authorization.** Normalization can change the
  authorized resource and creates a time-of-check/time-of-use mismatch.
- **Treat paths as slash-delimited strings.** This loses segment boundaries and
  reintroduces raw-prefix authorization errors.
