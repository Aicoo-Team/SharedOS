# @sharedos/sdk

The complete SharedOS SDK entry point. Install this package when one dependency
is more convenient than selecting individual SharedOS layers.

```bash
npm install @sharedos/sdk@next
```

```ts
import { CapabilityAuthorizer, SharedOSKernel, TurnExecutor } from "@sharedos/sdk";
```

SharedOS is currently an `0.x` prerelease. Production hosts must provide trusted
identity and grant resolution, durable replay protection, provider isolation,
and durable audit storage.

Security reports: founders@aicoo.io
