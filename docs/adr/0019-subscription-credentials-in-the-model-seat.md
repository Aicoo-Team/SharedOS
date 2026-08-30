# ADR 0019: A subscription authenticates the model seat, and grants nothing

- Status: Accepted
- Date: 2026-08-30

## Context

The native SharedOS harness — `ModelRuntime` with `ModelDriver` in the delegate
seat — reached its provider one way: a constant key in an `authorization`
header, held in `OpenAiCompatibleModelClient` as a private string. That is what
a metered API account is, and for a metered API account nothing else is needed.

It is not what a subscription is. The plans people actually hold — the login
`codex login` performs, and its equivalents — authenticate differently in three
ways at once:

- The secret **expires**. An access token is minted with a validity window, and
  a turn that begins inside the window can end outside it.
- The secret is **renewed** against a token endpoint, and the refresh token is
  **rotated** by the exchange, so the credential that authenticated a run is not
  the credential that will authenticate the next one.
- The secret does not say **which account pays**. A login covering several
  workspaces issues one token and expects the account code alongside it, in a
  header the provider names.

None of that can be expressed by a string field. A host holding a subscription
had one option: mint a key from a metered account instead, and run the column on
a different provider relationship than the one it was trying to measure.

There is a second, quieter reason. An account code is close enough to a grant to
be mistaken for one. It names a paying account, it travels on every call, and a
provider routes on it — so it wants to be described, in code and in records, in
a way that cannot be read as authority.

## Decision

**Authentication becomes a port.** `ModelCredential` has three members:
`headers` for one call, an optional `renew`, and `describe` for the record.
`OpenAiCompatibleModelClient` takes an `apiKey` or a `credential`, never both,
and an `apiKey` is now the trivial implementation rather than a special case.
A second subscription provider is a second `SubscriptionOAuthProfile` — a token
URL, a client id, an account header — and no second client.

**The wire shape is a second axis, and it is not the credential's.** A
subscription reaches OpenAI's Responses API and a metered key usually reaches a
chat-completions endpoint, but which of those a client speaks is a fact about
the endpoint, not about how the call authenticates. So `ModelHttpClient` holds
everything that is not the wire shape -- the credential, the per-request
deadline, the retry policy, the one re-authentication, and the rule that a
provider's error body never reaches a caller -- and each shape is an encoder and
a reader over it: `OpenAiCompatibleModelClient` and `OpenAiResponsesModelClient`.
Duplicating the policy per shape is the thing this exists to prevent, since the
policy is what decides whether a failed turn is honest evidence.

**One fact, stated once per wire shape.** `ModelReply.truncated` says the
provider ended the reply rather than the model choosing to, and it is what the
driver fails the turn on. The rule used to be a string comparison against
`finish_reason: "length"`, which is chat-completions' spelling; the Responses
API spells the same fact as an `incomplete` status with a reason beside it, and
a driver keyed on the other vocabulary would have graded a cut-off reply as a
decision the model finished making. `finishReason` still records the provider's
own word, unnormalised, so the record keeps what was actually said.

**A credential is authentication and nothing else.** Nothing it returns is
SharedOS authority. The catalogue a turn sees, the calls it may make, and the
audit it leaves are resolved from the `GrantSource` before any credential is
consulted, and a credential that authenticates perfectly still reaches exactly
the tools the grant chain allows. The account code is copied into a header and
never parsed, compared, or treated as identity; the id token it can be read from
is not verified, because a claim that decides nothing here needs no proof.

**Headers are resolved at the instant of the call**, not at the instant the
client was built. This is ADR 0016's rule applied one layer out: the operation's
clock may only take authority away. A token whose window has closed by the time
a call is made is renewed before the call; a window that has not opened yet is
never widened. A 401 buys exactly one renewal and one retry — a provider that
refuses a freshly renewed token is refusing the account, not the token.

**What a turn records is the scheme, not the secret.** `describe` publishes the
scheme, the issuer, and whether the seat was account-scoped. `ModelDriver` puts
it on the turn's metadata as `auth`. The account code is deliberately withheld:
it is a stable personal identifier, conformance artifacts are committed and
compared, and that the seat was account-scoped is the fact a reader of the
record actually needs.

**SharedOS runs no authorization flow.** It opens no browser, holds no client
secret, and never sees a password. The login is performed by the vendor's own
command and read off disk by
`createCodexSubscriptionCredential`, in `@aicoo/sharedos-adapters/node`. Renewed
sessions are written back, because the refresh token rotates and a run that does
not persist what came back leaves the vendor's own CLI unable to log in.

## What this is not

It is not a client for everything a Responses endpoint can do. The seat needs
one request and one answer: a conversation in, tool calls out. Reasoning
summaries, provider-run tools, and every other item kind are carried past rather
than interpreted; streamed deltas are ignored in favour of the terminal event
that carries the whole response; and nothing is streamed onward to the host --
`AgentTurnDriver` is asked for a decision, not for tokens.

It is not a promise about a provider's private endpoint. `chatgpt.com`'s Codex
backend is not a documented public API, and what it requires beyond a token and
an account code is the operator's knowledge of their provider: constant headers
go in through `headers` rather than being asserted here. What is claimed is
narrower and testable -- the request this writes is the Responses shape, and the
answer it reads is the Responses shape.

It is not authority delegation between accounts. A subscription pays for tokens.
Which agent may spend them, on what, and with what tools, remains a question for
the grant chain, and the answer is unchanged by who is paying.

## Consequences

- A host with a subscription can run the native harness column on the
  relationship it actually holds. `scripts/native-conformance.mjs` takes
  `SHAREDOS_MODEL_AUTH=codex-subscription` and reports an absent login exactly
  as it reports an absent binary: the column does not run, and its absence is
  not a result about SharedOS.
- A turn now says how its seat authenticated. `auth` is on the driver's turn
  metadata, and the native runner names the scheme in the run's availability
  detail. It deliberately stops there: `SystemIdentity` projects a turn's model
  and provider and nothing else, and widening what a conformance record
  identifies is a separate decision from making the fact available to a host.
- Existing hosts change nothing. `apiKey` still works, still refuses a blank
  key, and still does not retry a 401 — renewing a constant would ask the same
  wrong question twice.
- The refresh token in a host's store is now written by SharedOS as well as by
  the vendor. A host that does not want that passes `persist: false` and keeps
  the rotation itself.
- A client that reports neither `truncated` nor a cut reply is claiming the
  model finished. Both shipped clients set it; a host with its own `ModelClient`
  -- or a hand-written transcript that used to say `finishReason: "length"` --
  states the fact in the field now, or its turn completes where it used to
  fail.

## Rejected alternatives

**A second client class for subscriptions.** It would duplicate the wire shape,
the retry policy, the truncation rule, and the schema -- everything except the
header -- so a fix to any of them would have to be made twice, and a column
would be comparing two implementations rather than two credentials. The second
client that does exist is split the other way: the same policy, a different wire
shape.

**Normalising every provider's finish reason onto one vocabulary.** It would
have made the driver's old string comparison work unchanged, at the cost of a
record that says `length` where the provider said `max_output_tokens`. The
record keeps the provider's word, and the driver reads a field that means the
same thing everywhere.

**Reading the account code as identity.** Tempting, because it is stable and
already present. Rejected because it would put a personal identifier into the
authorization path, where it would eventually be compared against something; a
provider's billing code is not an actor, and SharedOS already has one.

**Refreshing on a fixed schedule, or on every call.** Both spend refresh tokens
the provider rotates, and a login file rewritten on every call is a login file
corrupted by the first crash. Renewal happens when the window says so and when
the provider says 401, and the exchange is shared by every caller that arrives
during it.

**Deriving an expiry from the vendor's `last_refresh`.** Codex records when the
session was last renewed, not when the access token stops working. Turning one
into the other would be inventing a fact and then acting on it; an unknown
expiry stays unknown, and a dead token is discovered the way the provider
reports it.
