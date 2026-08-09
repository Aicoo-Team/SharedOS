# @sharedos/os

Standard permission-controlled file tool adapters for SharedOS.

```bash
npm install @sharedos/os @sharedos/core @sharedos/contracts
```

Hosts provide storage implementations; this package provides one canonical
`files` namespace, portable argument schemas, canonical resource paths, exact
per-call capability resolution, and tool definitions. Memory is represented by
files under host-defined paths, not by a second storage namespace.
Filesystem providers must still enforce root containment and reject symlink
escapes.

SharedOS is currently an `0.x` prerelease.
