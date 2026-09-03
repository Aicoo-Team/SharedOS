import type {
  Address,
  Capability,
  CapabilityRequest,
  ResourceRef,
} from "@aicoo/sharedos-contracts";
import { canonicalJson, hashJson } from "@aicoo/sharedos-core";

/**
 * The shape a precedent is filed under, as a structure rather than a string.
 *
 * The c2c plane this replaces string-encoded a structured key into two fields
 * meant for something else: `relationshipCluster` carried `c2c:<principalId>`
 * and `queryFingerprint` carried a JSON tuple, where the escalation plane wrote
 * a computed cluster and a SHA-256 of normalized intent. One table, two
 * grammars, and nothing that could tell them apart. Declaring the key makes
 * that inexpressible -- there is no field here a second encoding could hide in,
 * and {@link precedentKeyDigest} is the only fingerprint.
 *
 * The five dimensions are the ones that decide whether this is the same
 * question. `requestedAt` is deliberately not among them: see
 * {@link precedentKeyDigest}.
 */
export interface PrecedentKey {
  readonly namespaceId: string;
  /** Whose answer this is. A precedent is one owner's record, never a pool. */
  readonly owner: Address;
  /** Who was asking. Only an allow reads this; see `admitAutoDecision`. */
  readonly requester: Address;
  readonly purpose: string;
  /**
   * The effective capability asked for: what the owner was actually answering
   * about, not the grant set that answer produced.
   *
   * A host that holds authority down outside its grant set -- a tool map, an
   * allow-list, an ADR 0020 ceiling -- has an effective authority narrower than
   * its grants. Keying on the grants would record that a human approved
   * authority the host was quietly withholding, and the next proposal would
   * cite that record to justify the wider thing. See ADR 0022.
   */
  readonly capabilities: readonly Capability[];
}

/**
 * The key of the request in front of us, or of the one a precedent recorded.
 *
 * Reads only the dimensions above and drops `id`, `requestedAt`, `constraints`
 * and `metadata`. Dropping the requested constraints cannot widen anything: R3
 * takes the envelope from the precedents, so what a requester asked to be
 * bounded by never reaches the issued grant.
 */
export function precedentKey(request: CapabilityRequest): PrecedentKey {
  return {
    namespaceId: request.namespaceId,
    owner: request.owner,
    requester: request.requester,
    purpose: request.purpose,
    capabilities: request.capabilities,
  };
}

/**
 * A deterministic fingerprint of one key, and the only thing exactness is
 * derived from.
 *
 * ADR 0022 proposed re-deriving `CapabilityRequest.id` and comparing. The id
 * is time-invariant since ADR 0019 -- `mintCapabilityRequest` keeps
 * `requestedAt` out of the hashed material, so one ask keeps one id across
 * turns -- but it is still not this key: the id hashes the constraints the
 * requester asked to be bounded by, and R3 takes the envelope from the
 * precedents, not from the ask. Keying on the id would make a request that
 * asked for a shorter expiry a different question from one that did not. The
 * key reads only what decides whether it is the same question, which is what
 * "the same question" has to mean.
 *
 * Normalisation is what makes two hosts agree. Object keys are already ordered
 * by `canonicalJson`; on top of that an unowned resource is resolved against
 * the key's owner (they denote the same resource once the owner is known),
 * actions are deduplicated and sorted, and the capability list is deduplicated
 * and sorted by its own canonical form. Order of declaration is not part of the
 * question being asked.
 *
 * `version` is hashed with the rest so a later change to what a key contains
 * cannot collide with a digest computed under this one.
 */
export async function precedentKeyDigest(key: PrecedentKey): Promise<string> {
  return hashJson({
    version: PRECEDENT_KEY_VERSION,
    namespaceId: key.namespaceId,
    owner: key.owner,
    requester: key.requester,
    purpose: key.purpose,
    capabilities: normalizedCapabilities(key),
  });
}

/** The key shape this digest is over. Hashed, so versions cannot collide. */
export const PRECEDENT_KEY_VERSION = "1";

function normalizedCapabilities(key: PrecedentKey): readonly unknown[] {
  const canonical = key.capabilities.map((capability) => ({
    resource: normalizedResource(capability.resource, key.owner),
    actions: [...new Set(capability.actions)].sort(),
    scope: capability.scope,
  }));
  return dedupeSorted(canonical);
}

function normalizedResource(resource: ResourceRef, owner: Address): unknown {
  return {
    namespace: resource.namespace,
    path: [...resource.path],
    owner: resource.owner ?? owner,
  };
}

/** Sort and deduplicate by the same canonical form the digest is taken over. */
function dedupeSorted(values: readonly unknown[]): readonly unknown[] {
  const byForm = new Map<string, unknown>();
  for (const value of values) {
    byForm.set(canonicalJson(value), value);
  }
  return [...byForm.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, value]) => value);
}
