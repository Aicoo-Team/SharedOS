# ADR 0020: SharedOS may obtain a subscription login, by device code

- Status: Accepted
- Date: 2026-08-30
- Amends: the "SharedOS runs no authorization flow" decision in
  `docs/adr/0019-subscription-credentials-in-the-model-seat.md`

## Context

ADR 0019 made a host's subscription usable in the model seat and drew one line
firmly: SharedOS reads a login, it does not perform one. The login came from
`codex login`, and `createCodexSubscriptionCredential` read the file that
command left behind.

That line put a vendor CLI on the critical path of a SharedOS run. Installing
Codex to authenticate a seat that then never uses Codex is a strange dependency
for a host-neutral library, and on the machines where the model column is most
useful -- a container, a CI runner, a box reached over SSH -- it is a dependency
that also has to be logged in interactively before it is any use.

There is a flow that removes it, and the provider already supports it: device
authorization. The person authorizing does so on whatever device has a browser;
the machine being authorized only polls.

Finding it required correcting a wrong answer, and the correction is the
interesting part. The OpenID discovery document at
`https://auth.openai.com/.well-known/openid-configuration` advertises
`grant_types_supported: ["authorization_code", "refresh_token"]` and no
`device_authorization_endpoint`, from which this repository first concluded that
the provider had no device login at all. It has one. It is simply not RFC 8628,
and it is not described by that document: the endpoints live under the issuer's
account server at `/api/accounts/deviceauth/*`, and the vendor's own client
(`codex-rs/login/src/device_code_auth.rs`) is the specification.

The differences from the RFC are not cosmetic. A client written to the standard
fails at the first request.

| RFC 8628                               | This provider                                                                                        |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `device_authorization_endpoint`        | `{issuer}/api/accounts/deviceauth/usercode`                                                          |
| Polls the token endpoint               | Polls `{issuer}/api/accounts/deviceauth/token`                                                       |
| Pending is `400 authorization_pending` | Pending is `403` or `404`                                                                            |
| A finished poll returns tokens         | A finished poll returns an authorization code, and the PKCE verifier the **server** generated for it |
| One grant                              | Two: the poll, then an ordinary code exchange at `{issuer}/oauth/token`                              |

## Decision

**SharedOS obtains a subscription login by device code, and by nothing else.**
`requestDeviceAuthorization` returns the user code, the page to type it into,
and a `wait` that polls until the person is done; what it produces is the same
`SubscriptionTokens` a stored vendor login yields, so nothing downstream --
`SubscriptionOAuthCredential`, the model clients, the store -- can tell which
produced it. `pnpm login:subscription` is the whole operator surface, and it
writes the login where the vendor's own tools look for it.

**The flow is written to the vendor's implementation, not to the RFC**, because
for this grant the implementation is the specification. That is recorded in the
profile and in the module rather than left for a reader to rediscover from a
404, and the profile carries an `issuerUrl` from which every path is derived --
one field, because the provider treats it as one: the route chosen for the
issuer is reused for the device endpoints, the callback, and the exchange.

**Encodings are declared per grant.** The same token endpoint takes a refresh as
JSON and a code exchange as `application/x-www-form-urlencoded`, which is what
the vendor's client does. Assuming the two matched would send one of them in a
shape no client has ever tested against that server.

**What SharedOS still never does.** It holds no client secret -- the client is
public, and PKCE is what makes that safe. It never sees a password: the
provider's own page does. It opens no browser and starts no listener, because a
device login needs neither. And it puts no token, and no account code, into any
record: ADR 0019's `describe()` contract is unchanged.

## What this is not

It is not a general OAuth client. There is one grant here because there is one
that works; a provider with a different device protocol, or with RFC 8628, is a
second profile and a second reader, and should be written when there is a
provider to test it against rather than in anticipation of one.

It is not a way around the provider's own gate. Device login is off by default
on a ChatGPT account and is enabled by a person in their security settings, or
by an admin for a workspace. The provider answers a request from an account that
has not enabled it with a `404`, and this reports that as the refused capability
it is rather than as a missing route -- the difference between someone changing
a setting and someone filing a bug.

## Consequences

- A model seat can be authenticated on a machine with no browser and no vendor
  CLI. `pnpm login:subscription`, a code typed on a phone, and
  `SHAREDOS_MODEL_AUTH=codex-subscription` is the whole path.
- SharedOS now writes the vendor's login file rather than only reading it. It
  already did on renewal (ADR 0019); this makes it the file's first author too,
  and the same atomic write and `0600` mode apply.
- One more thing can go stale when the vendor changes: these endpoints are not a
  published contract, and a client written to an implementation follows that
  implementation. The endpoints are named in one profile and one module, and a
  provider that moves them fails loudly at the first request rather than
  silently later.
- ADR 0019's statement that SharedOS "runs no authorization flow" no longer
  holds and is amended here. Everything else it decided -- authentication is not
  authority, headers resolve at the instant of the call, no secret reaches a
  record -- is untouched.

## Rejected alternatives

**RFC 8628, generically.** Written first, against the discovery document's
silence, and deleted when the provider's actual protocol turned up. It would
have been correct code for a grant this provider does not serve, and a reader
would reasonably have assumed it was the one being used.

**The loopback browser login.** Also written, also deleted. It works -- it is
what the vendor's browser login does -- but it needs a port, a listener, a
`state` check, and a browser on the machine being authorized, and every one of
those is a thing that can go wrong in exchange for reaching the same tokens the
device flow reaches with none of them.

**Driving `codex login` as a subprocess.** The dependency this exists to remove,
with an interactive prompt and a parsed stdout added on top.
