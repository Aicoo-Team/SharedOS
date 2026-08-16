# @aicoo/sharedos-http

A Fetch-compatible HTTP adapter over the SharedOS kernel and turn runtime.

```bash
npm install @aicoo/sharedos-http@next
```

The host-provided context resolver must authenticate the request and construct a
trusted access context. Deployments also provide TLS, body and rate limits,
credential handling, and durable replay protection.

The host also supplies one trusted `TurnExecutionPort`, normally a
`SharedOSExecutor` configured with its selected `RuntimePlugin`. The HTTP request
cannot choose or replace that runtime; exposing runtime choice requires a
separate authenticated host-policy decision.

`GET /v1/tools/namespaces` returns the context-specific namespace catalog.
`PUT /v1/tools/namespaces` applies a standard enable/disable patch through the
kernel's host-provided `ToolNamespaceSettingsStore`; this adapter never stores
user settings itself. Treat both routes as an authenticated management surface;
the turn runtime exposes only the filtered `GET /v1/tools` catalog to models.

SharedOS is currently an `0.x` prerelease.
