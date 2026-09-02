import type { AccessContext, Capability, CapabilityRequest } from "@aicoo/sharedos-contracts";
import { CapabilityRequestSchema } from "@aicoo/sharedos-contracts";

import type { AuthorizationRequest } from "./authorization.js";
import { hashJson } from "./hashing.js";

/**
 * What a caller may say about the authority it asks for.
 *
 * Everything else on a {@link CapabilityRequest} is the kernel's to state. A
 * whole request is accepted here too -- the `requiredAuthority` a denial
 * described is the usual one -- and the `id`, `namespaceId`, `requester`,
 * `owner`, and `requestedAt` it carries are discarded and minted again from the
 * trusted context. That is why `{ requestedAuthority: denial.requiredAuthority }`
 * comes back with the identifier it went in with: both were minted from the
 * same ask.
 */
export type CapabilityRequestPayload = Pick<
  CapabilityRequest,
  "capabilities" | "purpose" | "constraints" | "metadata"
>;

/** The ask alone. Whatever else a caller wrote beside it is dropped, not refused. */
const ASK_SCHEMA = CapabilityRequestSchema.pick({
  capabilities: true,
  purpose: true,
  constraints: true,
  metadata: true,
}).strip();

/**
 * Mint a request for authority from the trusted context and what was asked.
 *
 * `namespaceId`, `requester`, `owner`, and `requestedAt` come from the context
 * and nothing else: a request the caller authored would be a caller-chosen
 * correlation for a decision the kernel made (ADR 0019).
 *
 * `id` is derived rather than generated -- SHA-256 over the namespace,
 * requester, owner, purpose, constraints, and capabilities -- so the same ask
 * describes itself the same way twice. `requestedAt` is deliberately not part
 * of it: it is the instant of the authority a decision was made against, stable
 * within a turn but moving between turns that describe the same missing
 * authority, and moving on every conformance run. Hashing only the ask is what
 * gives one missing authority one identifier across turns, and what keeps a
 * conformance cell able to state the value it observed rather than that a field
 * was present. `metadata` is not part of it either: it annotates an ask, and
 * does not make it a different one.
 *
 * `undefined` when what was asked is not a valid ask -- no capabilities, a
 * purpose the schema refuses -- so the caller decides whether that is a thrown
 * contract violation or a field to omit.
 */
export async function mintCapabilityRequest(
  context: AccessContext,
  payload: CapabilityRequestPayload,
): Promise<CapabilityRequest | undefined> {
  const asked = ASK_SCHEMA.safeParse(payload);
  if (!asked.success) {
    return undefined;
  }
  const identity = {
    namespaceId: context.namespaceId,
    requester: context.actor,
    owner: context.owner,
    capabilities: asked.data.capabilities,
    purpose: asked.data.purpose,
    ...(asked.data.constraints === undefined ? {} : { constraints: asked.data.constraints }),
  };
  // Through JSON, so an own property holding `undefined` -- which
  // `structuredClone` keeps and `canonicalJson` emits -- does not give a caller
  // that passed `owner: undefined` and one that omitted the key two identifiers
  // for one ask. Everything here is JSON-safe by schema, so nothing else moves.
  const normalized = JSON.parse(JSON.stringify(identity)) as typeof identity;
  const minted = CapabilityRequestSchema.safeParse({
    id: `capreq-${await hashJson(normalized)}`,
    ...normalized,
    requestedAt: context.now,
    ...(asked.data.metadata === undefined ? {} : { metadata: asked.data.metadata }),
  });
  return minted.success ? minted.data : undefined;
}

/**
 * The authority that would have satisfied a request nothing matched.
 *
 * Every field is already in hand at the point of denial -- the caller named the
 * resource and the action, and its own context names the requester, the owner,
 * the namespace, and the purpose -- so nothing is resolved and no port is
 * called. That is what keeps this affordable on a denial path and what keeps it
 * from revealing anything: it restates the request rather than answering a
 * question about the world (ADR 0019).
 *
 * Exactly one capability, always. The schema's bound of 64 is there for a
 * host-built consent request that legitimately asks for several; this describes
 * the one resource and one action the caller named, and a second entry could
 * only be a guess at what else it might have wanted.
 */
export async function describeRequiredAuthority(
  context: AccessContext,
  request: AuthorizationRequest,
): Promise<CapabilityRequest | undefined> {
  const capability: Capability = {
    resource: {
      namespace: request.resource.namespace,
      path: [...request.resource.path],
      ...(request.resource.owner === undefined ? {} : { owner: request.resource.owner }),
    },
    actions: [request.action],
    scope: "exact",
  };
  return mintCapabilityRequest(context, { capabilities: [capability], purpose: context.purpose });
}
