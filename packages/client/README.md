# @sharedos/client

Runtime-validated HTTP client for a SharedOS service.

```bash
npm install @sharedos/client@next
```

```ts
import { SharedOSClient } from "@sharedos/client";

const client = new SharedOSClient({ baseUrl: "https://sharedos.example" });
const tools = await client.listTools();
const namespaces = await client.listToolNamespaces();
await client.updateToolNamespaces({ enable: ["calendar"] });
```

Enabling a namespace changes tool availability only. Each returned or invoked
tool still requires its declared capability grant.

SharedOS is currently an `0.x` prerelease.
