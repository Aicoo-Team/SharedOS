# Authorization debugger example

## Why Was I Denied?

### One-line description

A host-side SharedOS debugger that explains which authorization gate refused an agent action, suggests the correct remedy, and demonstrates that revoking a grant takes effect immediately.

## What problem does it solve?

SharedOS intentionally does not reveal sensitive authorization details to an agent. Several failures therefore look identical to the caller:

```text
tool_unavailable
```

However, an Aicoo operator or developer needs to know whether:

1. The tool was never registered.
2. The tool namespace is disabled.
3. The agent lacks a capability grant.
4. Organization policy overrode a valid grant.

Our debugger reads the trusted SharedOS audit stream and translates those cases into human-readable diagnoses and suggested fixes.

## What did we build?

The project creates:

- A SharedOS kernel using the published npm package.
- A `meeting-assistant` agent identity.
- A host-owned, in-memory private meeting-note provider.
- A trusted grant source that cannot be modified through an agent message.
- A host product ceiling representing an organization-wide policy freeze.
- An audit sink that records authorization and tool events.
- A debugger that converts audit causes into gate names, explanations, and remedies.
- A live `deepseek-v4-flash` model turn using SharedOS's `OpenAiCompatibleModelClient`, `ModelDriver`, `ModelRuntime`, and `SharedOSExecutor`.
- A live revocation demonstration using the same running kernel.

## Is an AI model connected?

**Yes. The live demo connects `deepseek-v4-flash` through SharedOS's official model adapter.**

The execution path is:

```text
DeepSeek API → ModelDriver → ModelRuntime → SharedOSExecutor
             → permission-filtered catalog → kernel.invokeTool
```

DeepSeek receives only the catalog SharedOS computed for this actor (`files.read`). The model deliberately calls that same tool twice: once for the granted meeting-note path and once for an ungranted salary path. SharedOS translates each wire name and re-authorizes each exact path independently. The meeting note succeeds, the salary path is denied, both results return to DeepSeek, and the model accurately reports the boundary.

The served model name is returned by the provider and can be recorded honestly rather than merely assuming the requested model ran.

An offline deterministic driver remains available through `npm run demo:offline` so the authorization demo can still run if the network or model provider is unavailable. It uses the same kernel, grants, tool, and revocation path.

## Is this connected to the production Aicoo platform?

No. It is an external npm consumer project, as required by the hackathon onboarding instructions. It does not use production credentials or real user information.

The local meeting note represents a host resource. In Aicoo, the same pattern can protect:

- Meeting notes
- Calendar availability
- Emails
- Project documents
- MCP and external tools

Only the host provider changes. SharedOS authorization and the debugger remain the same.

## What is real in the demo?

The following are real SharedOS behavior, not manually printed simulations:

- Tool registration checks
- Namespace enablement checks
- Capability matching
- Host product-ceiling enforcement
- Permission-filtered tool discovery
- Exact invocation-time reauthorization
- File-tool execution through a registered resource provider
- Live DeepSeek tool selection, agent-turn admission, and execution
- Audit-event generation
- Trusted grant loading
- Live revocation

The program derives every displayed gate from the latest SharedOS audit event's `metadata.cause`.

The meeting note content and grant persistence are in memory because SharedOS deliberately leaves storage to the host.

## Live stage sequence

### 1. Registration refusal

The agent requests an unknown tool.

```text
Gate: REGISTRATION
Audit cause: not_registered
```

### 2. Namespace refusal

`files.read` is registered, but the `files` namespace is disabled.

```text
Gate: NAMESPACE
Audit cause: namespace_disabled
```

### 3. Capability refusal

The tool is registered and enabled, but no grant covers the meeting note.

```text
Gate: CAPABILITY GRANT
Audit cause: no_matching_grant
```

### 4. Product-ceiling refusal

A valid grant exists, but organization policy freezes access.

```text
Gate: PRODUCT CEILING
Audit cause: host_policy_denied
```

### 5. Successful access and agent turn

The freeze is lifted. SharedOS gives DeepSeek a catalog containing only `files.read`. DeepSeek calls it for both the narrowly authorized meeting note and an unauthorized salary file. Invocation-time reauthorization allows the meeting note, denies the salary path with `no_matching_grant`, and the model reports both outcomes without inventing restricted content.

### 6. Live revocation

Before revocation, the agent's permission-filtered catalog contains `files.read`. The host removes the file grant from its trusted store without restarting or clearing a cache. A fresh catalog becomes empty immediately, and the same meeting-note read is refused on retry.

```text
DENIED → GRANTED → ALLOWED → REVOKED → DENIED
```

## Why does the initial denial matter?

The agent starts without permission because SharedOS is deny-by-default. A message saying “please read this private note” cannot grant authority. Only the trusted host grant source can provide it.

Showing both failure and success proves that:

- The provider works—the successful control operation rules out a fake always-blocked demo.
- The initial denial came from authorization rather than broken code.
- The message did not grant itself authority.
- Revocation affects the next operation immediately.

## Architecture

```text
DeepSeek `deepseek-v4-flash`
                         │
                   ModelDriver / ModelRuntime
                         │ permission-filtered files.read
                         ▼
                 SharedOS security kernel
              ┌──────────┼───────────┐
              │          │           │
       trusted grants  host ceiling  namespace settings
              │          │           │
              └──────────┼───────────┘
                         │
              allowed ───┴─── denied
                 │              │
       meeting-note provider   AuditSink
                                │
                                ▼
                    Why Was I Denied? debugger
```

## How to run

The committed example is deterministic and makes no network calls:

```bash
pnpm example:authorization-debugger
```

To exercise the optional model path from this example package, set `API` to a DeepSeek key before running it directly. Never commit credentials.

## Honest limitations

- The live model depends on DeepSeek network/API availability; a deterministic offline fallback is included.
- Storage and grants are in memory and reset when the process exits.
- The meeting note is sample data.
- The debugger currently renders terminal output rather than a production UI.

These limitations are outside the demonstrated security semantics. A production Aicoo integration would connect its authenticated identity, durable grant store, audit store, resource providers, and chosen model runtime.

## What this example proves

Four refusals can safely look like `tool_unavailable` to a caller while a trusted operator uses `AuditSink` metadata to distinguish registration, namespace, capability, and host-ceiling failures. It also demonstrates point-of-use path checks and live revocation without storing an authorization cache.
