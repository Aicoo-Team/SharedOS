import type { AccessContext, CapabilityGrant } from "@aicoo/sharedos-contracts";
import { CapabilityGrantSchema } from "@aicoo/sharedos-contracts";

import { sha256Hex } from "./hashing.js";
import { addressesEqual, canonicalJson } from "./internal.js";

/** The largest authority set SharedOS will evaluate for one decision. */
export const MAX_RESOLVED_GRANTS = 256;

/**
 * The fuse over per-operation authority resolution. Off.
 *
 * SharedOS originally re-loaded authority from the trusted source for every
 * kernel operation, so a grant removed from the store part-way through a turn
 * was refused at the next decision inside that same turn. That path is retained
 * in {@link SharedOSKernel} and is re-enabled by setting this to `true`.
 *
 * It is off because a turn must decide against one *grant set*. Authority is
 * resolved once, at the turn boundary, and a store-side edit -- a revocation, a
 * withdrawn purpose -- is observed by the *next* turn. A request therefore
 * carries the authority it was admitted with, rather than having authority
 * resolved underneath it while it runs.
 *
 * The fuse no longer covers expiry. ADR 0016 settled the question this constant
 * used to carry as a TBD: expiry is a property the grant already held when the
 * turn began, so honouring it part-way through costs no store read and leaks no
 * store state, and `grantIsActive` in `internal.ts` now evaluates it against the
 * instant of the operation while every other removal stays at the instant the
 * turn's authority was resolved. Nothing about that needs this fuse, which is
 * why it stays off.
 *
 * What remains behind it is exactly one behaviour: seeing a store edit without
 * waiting for the next turn. A host cannot set it: it is an exported constant,
 * a build-time switch for this package's maintainers, and turning it on means
 * patching the package. Whether it becomes a kernel option, with the store read
 * per operation that implies, is an open item (`docs/open-items.md`).
 */
export const MID_TURN_AUTHORITY_REFRESH = false;

/**
 * The identity a turn's frozen authority is held against.
 *
 * `now` is excluded because the turn instant is precisely what a lease freezes,
 * and `enabledToolNamespaces` is excluded because namespace enablement is host
 * state that stays live per operation and is never read by an authorization
 * decision. Every other field an authorization decision reads is in the key, so
 * a lease can never answer for a context it was not resolved for.
 */
export function turnAuthorityKey(context: AccessContext): string {
  return canonicalJson({
    namespaceId: context.namespaceId,
    actor: context.actor,
    authority: context.authority,
    owner: context.owner,
    purpose: context.purpose,
    traceId: context.traceId,
  });
}

/**
 * A handle on one turn's frozen authority.
 *
 * The handle reports whether authority could be established at the turn
 * boundary so a caller can refuse admission, and carries the snapshot the whole
 * turn will be decided against. It deliberately exposes no grants: like
 * {@link ResolvedAuthority}, it is not assignable to an `AccessContext`, so it
 * cannot reach a provider, tool handler, transport, or runtime.
 *
 * `close` is idempotent and must run on every path out of the turn, including
 * cancellation. An unclosed lease keeps a stale authority state answering for
 * any later operation that presents the same turn identity.
 */
export type TurnAuthorityScope = {
  readonly status: "resolved" | "unavailable";
  /** Present when authority was established. */
  readonly snapshot?: AuthoritySnapshot;
  /** Present when it was not. */
  readonly code?: AuthorityUnavailableCode;
  close(): void;
};

/**
 * The trusted boundary that loads authoritative grants.
 *
 * This is the only way authority enters SharedOS. An implementation must answer
 * from the issuing store rather than from anything the caller supplied, and it
 * must return exactly the active grants issued to `context.actor` by
 * `context.authority` inside `context.namespaceId`. Returning material outside
 * that scope, or material that does not satisfy the grant contract, is treated
 * as an unavailable source rather than as partial authority.
 *
 * Throwing is the correct response to an outage. SharedOS converts it into a
 * fail-closed denial; it never falls back to a cached or caller-supplied set.
 */
export interface GrantSource {
  load(context: AccessContext, signal: AbortSignal): Promise<readonly CapabilityGrant[]>;
}

/**
 * What a turn's host policy is, to SharedOS: nothing it reads.
 *
 * Whatever a {@link PolicySource} loaded, carried beside the resolved authority
 * and handed back to the host's own `HostCeiling` as the fourth argument of
 * `narrow`. It is never cloned, validated, hashed, or audited: a policy may be
 * a compiled matcher or a table with methods on it, and SharedOS decides nothing
 * from it -- the ceiling does. A host pairs the two ports itself, and the
 * pairing is the host's to get right (ADR 0020).
 */
export type HostPolicy = unknown;

/**
 * The trusted boundary that loads host policy, once per turn, beside the grant
 * set.
 *
 * A `HostCeiling` is synchronous by contract, so it can only decide against
 * state it already holds. This is where that state comes from when it lives in
 * a store: one asynchronous load at the turn boundary, in the same place and at
 * the same moment authority is resolved, and every decision inside the turn
 * made against the result without reading the store again. A ceiling whose
 * policy is fixed before a run starts needs no source at all and closes over
 * its own state; the port exists so a policy that lives in a database is not
 * forced back outside the kernel by the signature (ADR 0020).
 *
 * Throwing is the correct response to an outage. SharedOS fails the turn's
 * policy closed: every decision a ceiling would have been consulted on is
 * refused `host_policy_unavailable`, the error goes to
 * `SharedOSKernelOptions.onProviderError`, and nothing falls back to a cached
 * or caller-supplied policy.
 */
export interface PolicySource<Policy = HostPolicy> {
  load(context: AccessContext, signal: AbortSignal): Promise<Policy>;
}

/**
 * The policy one turn decides against, or the fact that it could not be
 * loaded.
 *
 * Held beside the grant set for the length of the turn, so a source that failed
 * at the boundary stays failed for every decision in the turn rather than being
 * retried on each and possibly changing its mind -- the same rule an
 * unavailable {@link GrantSource} is held to.
 */
export type PolicyResolution<Policy = HostPolicy> =
  { readonly status: "loaded"; readonly policy: Policy } | { readonly status: "unavailable" };

/** Why authority could not be established for one decision. */
export type AuthorityUnavailableCode =
  | "grant_source_failed"
  | "invalid_grant_material"
  | "grant_scope_mismatch"
  | "grant_limit_exceeded";

/**
 * A content identifier for exactly the authority one decision was made against.
 *
 * With {@link MID_TURN_AUTHORITY_REFRESH} off, a turn resolves authority once
 * and every decision in it names the same snapshot -- including a decision that
 * refused an expired grant, because expiry narrows what a snapshot authorizes
 * without changing which snapshot it is. The per-decision field is
 * kept rather than collapsed to a per-turn one because a host may still make
 * kernel calls outside any turn, and because re-enabling the fuse must not
 * change the shape of the evidence.
 */
export interface AuthoritySnapshot {
  /** SHA-256 over the canonical, order-independent form of the grant set. */
  readonly hash: string;
  readonly grantIds: readonly string[];
  readonly grantCount: number;
  readonly loadedAt: string;
}

/**
 * An access context together with the authority a trusted source produced for
 * it.
 *
 * Authority is deliberately held beside the context rather than merged into it,
 * so a resolved authority can never be passed to a provider, tool handler,
 * message transport, or runtime that expects an `AccessContext`.
 */
export interface ResolvedAuthority {
  readonly context: AccessContext;
  readonly grants: readonly CapabilityGrant[];
  readonly snapshot: AuthoritySnapshot;
  /**
   * The host policy loaded for this turn, when a {@link PolicySource} is
   * installed. Absent when none is, and the ceiling -- if one is installed --
   * decides over state it closes over. Not part of {@link AuthoritySnapshot}:
   * policy is not authority, and an opaque value has no canonical form to hash.
   */
  readonly hostPolicy?: PolicyResolution;
}

export type AuthorityResolution =
  | { readonly status: "resolved"; readonly authority: ResolvedAuthority }
  | { readonly status: "unavailable"; readonly code: AuthorityUnavailableCode };

/**
 * Loads and validates authority for one access context.
 *
 * Every failure mode collapses to `unavailable`, so a decision is never made
 * against a partially trusted authority set.
 */
export class TrustedAuthorityResolver {
  static readonly #maxCachedSnapshots = 64;
  readonly #source: GrantSource;
  readonly #snapshotHashes = new Map<string, string>();

  constructor(source: GrantSource) {
    if (source === null || typeof source !== "object" || typeof source.load !== "function") {
      throw new TypeError("SharedOS requires a grant source that provides a load function");
    }
    this.#source = source;
  }

  async resolve(context: AccessContext, signal: AbortSignal): Promise<AuthorityResolution> {
    let loaded: readonly CapabilityGrant[];
    try {
      loaded = await this.#source.load(structuredClone(context), signal);
    } catch (error) {
      if (signal.aborted) {
        throw signal.reason ?? error;
      }
      return { status: "unavailable", code: "grant_source_failed" };
    }

    if (!Array.isArray(loaded)) {
      return { status: "unavailable", code: "invalid_grant_material" };
    }
    if (loaded.length > MAX_RESOLVED_GRANTS) {
      return { status: "unavailable", code: "grant_limit_exceeded" };
    }

    const grants: CapabilityGrant[] = [];
    for (const candidate of loaded) {
      const parsed = CapabilityGrantSchema.safeParse(candidate);
      if (!parsed.success) {
        return { status: "unavailable", code: "invalid_grant_material" };
      }
      if (!grantIsInScope(parsed.data, context)) {
        return { status: "unavailable", code: "grant_scope_mismatch" };
      }
      grants.push(parsed.data);
    }

    return {
      status: "resolved",
      authority: { context, grants, snapshot: await this.#snapshot(grants, context.now) },
    };
  }

  /**
   * Hashing is memoized by canonical form, so a turn that keeps reading the
   * same unchanged authority pays for one digest rather than one per call.
   */
  async #snapshot(
    grants: readonly CapabilityGrant[],
    loadedAt: string,
  ): Promise<AuthoritySnapshot> {
    const canonical = canonicalJson([...grants.map(canonicalJson)].sort());
    let hash = this.#snapshotHashes.get(canonical);
    if (hash === undefined) {
      hash = await sha256Hex(canonical);
      if (this.#snapshotHashes.size >= TrustedAuthorityResolver.#maxCachedSnapshots) {
        this.#snapshotHashes.clear();
      }
      this.#snapshotHashes.set(canonical, hash);
    }

    return {
      hash,
      grantIds: [...grants.map(({ id }) => id)].sort(),
      grantCount: grants.length,
      loadedAt,
    };
  }
}

function grantIsInScope(grant: CapabilityGrant, context: AccessContext): boolean {
  return (
    grant.namespaceId === context.namespaceId &&
    addressesEqual(grant.subject, context.actor) &&
    addressesEqual(grant.issuer, context.authority)
  );
}
