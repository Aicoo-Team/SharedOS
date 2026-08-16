# @aicoo/sharedos-os

Standard permission-controlled file tool adapters for SharedOS.

```bash
npm install @aicoo/sharedos-os@next
```

Hosts provide storage implementations; this package provides one canonical
`files` namespace, portable argument schemas, canonical resource paths, exact
per-call capability resolution, and tool definitions. Memory is represented by
files under host-defined paths, not by a second storage namespace.

The standard handlers also use `files` as their logical tool namespace and
`sharedos` as their catalog source. Hosts must explicitly include `files` in an
effective namespace selection before those handlers can be discovered.
Filesystem providers must still enforce root containment and reject symlink
escapes.

SharedOS is currently an `0.x` prerelease.
