# @aicoo/sharedos-testkit

Deterministic in-memory fixtures and recording providers for SharedOS tests.

```bash
npm install --save-dev @aicoo/sharedos-testkit@next
```

This package is for tests, examples, and isolated experimental worlds. Its
in-memory stores are not durable or multi-instance-safe production storage.
`InMemoryToolNamespaceSettingsStore` can exercise the namespace control plane
without becoming a production settings backend.

A store that is down is a stand-in too: `UnavailableGrantSource`,
`UnavailableDelegationChainResolver` and `UnavailableGrantUsageStore` fail every
call, so a test can show a decision failing closed.
`revoke` and `expire` on the two grant stores edit a grant in place, the way a
host store would, and throw on an id the store does not hold.

SharedOS is currently an `0.x` prerelease.
