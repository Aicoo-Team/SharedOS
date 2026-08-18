import type { AccessContext, CapabilityGrant } from "@aicoo/sharedos-contracts";
import { CapabilityGrantSchema } from "@aicoo/sharedos-contracts";

import { sha256Hex } from "./hashing.js";
import { addressesEqual, canonicalJson } from "./internal.js";

/** The largest authority set SharedOS will evaluate for one decision. */
export const MAX_RESOLVED_GRANTS = 256;

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

/** Why authority could not be established for one decision. */
export type AuthorityUnavailableCode =
  | "grant_source_failed"
  | "invalid_grant_material"
  | "grant_scope_mismatch"
  | "grant_limit_exceeded";

/**
 * A content identifier for exactly the authority one decision was made against.
 *
 * Authority is re-loaded per operation, so a turn can span several distinct
 * authority states. A snapshot lets an execution record name the state a single
 * decision saw instead of assuming one grant set covered the whole turn.
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
