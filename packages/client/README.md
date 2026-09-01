# @aicoo/sharedos-client

Runtime-validated HTTP client for a SharedOS service.

```bash
npm install @aicoo/sharedos-client@next
```

```ts
import { SharedOSClient } from "@aicoo/sharedos-client";

const client = new SharedOSClient({ baseUrl: "https://sharedos.example" });
const tools = await client.listTools();
const namespaces = await client.listToolNamespaces();
await client.updateToolNamespaces({ enable: ["calendar"] });
```

Enabling a namespace changes tool availability only. Each returned or invoked
tool still requires its declared capability grant.

Options are `{ baseUrl, token?, fetch?, headers? }`. `token` — a string or an
async function returning one — is sent as `authorization: Bearer <token>`;
`headers`, a value or an async function, carries anything else, and `token`
wins when both name the `authorization` header. Every method also takes
`{ signal?, headers?, purpose? }`; `purpose` is sent as `x-sharedos-purpose`
for the server's `resolveContext` to read. Neither header is authority: the
server derives the `AccessContext` from its own authenticated state, and every
operation still needs a matching grant.

SharedOS is currently an `0.x` prerelease.
