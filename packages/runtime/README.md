# @sharedos/runtime

One bounded, permission-controlled SharedOS agent turn.

```bash
npm install @sharedos/runtime@next
```

The runtime admits the target agent, mounts a sanitized context, exposes only
authorized tools, rechecks each call, and applies step, timeout, and cancellation
bounds. Product heartbeats and benchmark scheduling remain host responsibilities.

SharedOS is currently an `0.x` prerelease.
