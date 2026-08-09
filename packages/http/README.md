# @sharedos/http

A Fetch-compatible HTTP adapter over the SharedOS kernel and turn runtime.

```bash
npm install @sharedos/http
```

The host-provided context resolver must authenticate the request and construct a
trusted access context. Deployments also provide TLS, body and rate limits,
credential handling, and durable replay protection.

SharedOS is currently an `0.x` prerelease.
