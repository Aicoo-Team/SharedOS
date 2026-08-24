[**SharedOS API v0.1.0-alpha.2**](README.md)

---

[SharedOS API](README.md) / @aicoo/sharedos

# @aicoo/sharedos

The complete SharedOS SDK entry point. Install this package when one dependency
is more convenient than selecting individual SharedOS layers.

```bash
npm install @aicoo/sharedos@next
```

```ts
import {
  CapabilityAuthorizer,
  RuntimeRegistry,
  SharedOSExecutor,
  SharedOSKernel,
  StandardRuntime,
} from "@aicoo/sharedos";
```

`StandardRuntime` is the included bounded driver loop. Hosts can install a
complete alternative harness through `RuntimePlugin`; `SharedOSExecutor` keeps
admission, filtered tool discovery, exact-call authorization, cancellation, and
runtime provenance outside the replaceable plugin.

`@aicoo/sharedos` adds no independent API symbols. It re-exports the production
surface of `@aicoo/sharedos-contracts`, `@aicoo/sharedos-core`, `@aicoo/sharedos-http`,
`@aicoo/sharedos-os`, and `@aicoo/sharedos-runtime`, plus the client classes and options.
The generated reference documents those symbols on their owning package pages
instead of duplicating their definitions on the SDK page.

SharedOS is currently an `0.x` prerelease. Production hosts must provide trusted
identity and grant resolution, durable replay protection, provider isolation,
and durable audit storage.

Security reports: founders@aicoo.io
