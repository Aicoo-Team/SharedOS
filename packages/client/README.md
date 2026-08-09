# @sharedos/client

Runtime-validated HTTP client for a SharedOS service.

```bash
npm install @sharedos/client
```

```ts
import { SharedOSClient } from "@sharedos/client";

const client = new SharedOSClient({ baseUrl: "https://sharedos.example" });
const tools = await client.listTools();
```

SharedOS is currently an `0.x` prerelease.
