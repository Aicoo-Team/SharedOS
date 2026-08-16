[**SharedOS API v0.1.0-alpha.0**](README.md)

---

[SharedOS API](README.md) / @sharedos/sdk

# @sharedos/sdk

The complete SharedOS SDK entry point. Install this package when one dependency
is more convenient than selecting individual SharedOS layers.

```bash
npm install @sharedos/sdk@next
```

```ts
import {
  CapabilityAuthorizer,
  RuntimeRegistry,
  SharedOSExecutor,
  SharedOSKernel,
  StandardRuntime,
} from "@sharedos/sdk";
```

`StandardRuntime` is the included bounded driver loop. Hosts can install a
complete alternative harness through `RuntimePlugin`; `SharedOSExecutor` keeps
admission, filtered tool discovery, exact-call authorization, cancellation, and
runtime provenance outside the replaceable plugin.

`@sharedos/sdk` adds no independent API symbols. It re-exports the production
surface of `@sharedos/contracts`, `@sharedos/core`, `@sharedos/http`,
`@sharedos/os`, and `@sharedos/runtime`, plus the client classes and options.
The generated reference documents those symbols on their owning package pages
instead of duplicating their definitions on the SDK page.

SharedOS is currently an `0.x` prerelease. Production hosts must provide trusted
identity and grant resolution, durable replay protection, provider isolation,
and durable audit storage.

Security reports: founders@aicoo.io
