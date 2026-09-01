import type {
  AccessContext,
  CapabilityRequest,
  CapabilityRequirement,
} from "@aicoo/sharedos-contracts";
import { CapabilityRequestSchema } from "@aicoo/sharedos-contracts";

import { sha256Hex } from "./hashing.js";
import { canonicalJson } from "./internal.js";

/**
 * The half of a capability request a caller may author: what is being asked
 * for, and nothing about who asked or when.
 *
 * The other half -- `id`, `namespaceId`, `requester`, `owner`, `requestedAt` --
 * is minted from the trusted access context by {@link mintCapabilityRequest},
 * because a request the caller authored would be a caller-chosen correlation
 * for a decision the kernel made.
 */
export type CapabilityRequestPayload = Pick<
  CapabilityRequest,
  "capabilities" | "purpose" | "constraints" | "metadata"
>;

/**
 * Stamp a payload with the identity of the turn that produced it.
 *
 * `id` is derived from the stamped fields rather than generated. A random
 * identifier would make a conformance cell that cannot state what it observed:
 * the row would have to either ignore the field or re-derive it, and a manifest
 * that ignores a field is a manifest that does not check it. Deriving it also
 * makes the same ask, recorded twice in one turn, the same request.
 *
 * Answers `undefined` when the result would not satisfy the contract -- a
 * context whose instant is not an RFC 3339 timestamp, a payload with no
 * capabilities. A description that cannot be expressed is simply absent; the
 * denial it would have travelled on is still a denial, and a caller that asked
 * for one explicitly is told rather than given a half-built request.
 */
export async function mintCapabilityRequest(
  context: AccessContext,
  payload: CapabilityRequestPayload,
): Promise<CapabilityRequest | undefined> {
  const stamped = {
    namespaceId: context.namespaceId,
    requester: context.actor,
    owner: context.owner,
    capabilities: payload.capabilities,
    purpose: payload.purpose,
    ...(payload.constraints === undefined ? {} : { constraints: payload.constraints }),
    requestedAt: context.now,
    ...(payload.metadata === undefined ? {} : { metadata: payload.metadata }),
  };
  const parsed = CapabilityRequestSchema.safeParse({
    ...stamped,
    id: await sha256Hex(canonicalJson(stamped)),
  });
  return parsed.success ? parsed.data : undefined;
}

/**
 * The authority that would have satisfied a request nothing granted.
 *
 * Built entirely from what the caller already held: the resource and action it
 * just named, and the owner, namespace, purpose and instant that were already
 * in its own access context. No provider is consulted, so the same description
 * is produced for a path that does not exist and for one the actor merely
 * cannot reach. That is the property that keeps a denial from becoming an
 * existence oracle, and it is why this must never be populated from anything a
 * provider knows.
 *
 * The capability is the narrowest one that would have matched: this resource,
 * this action, exact scope. A wider description would name authority the denial
 * did not establish was needed.
 */
export async function describeRequiredCapability(
  context: AccessContext,
  request: CapabilityRequirement,
): Promise<CapabilityRequest | undefined> {
  return mintCapabilityRequest(context, {
    capabilities: [{ resource: request.resource, actions: [request.action], scope: "exact" }],
    purpose: context.purpose,
  });
}
