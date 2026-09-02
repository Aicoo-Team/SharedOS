import type {
  AccessContext,
  Address,
  AgentCard,
  AgentCardView,
  Capability,
  CapabilityRequest,
  ReachSummary,
  ResourceReach,
} from "@aicoo/sharedos-contracts";
import { AgentCardSchema } from "@aicoo/sharedos-contracts";

import type { AuthorizationRequest } from "./authorization.js";
import { addressPath } from "./message-service.js";

/** Kernel affordances live in one namespace; the directory is the second one. */
export const DIRECTORY_NAMESPACE = "sharedos";
/** The resource every card hangs beneath, and the one a host grants over. */
export const DIRECTORY_RESOURCE_ROOT: readonly string[] = Object.freeze(["directory"]);
export const DIRECTORY_READ_ACTION = "read";

/**
 * The resource one view of one subject's card is served from.
 *
 * The widest card -- identity together with reach -- is the subject's own path,
 * so a grant written per subject with `exact` scope serves it. Each narrower
 * view is a *distinct resource* beneath it, which is how a less-authorized
 * reader gets less without any redaction pass: a grant over
 * `["directory", "agent", "bob", "identity"]` serves a name and cannot be
 * substituted for the card, and a `descendants` grant over the subject or over
 * `["directory"]` covers every view of what it covers.
 *
 * Expressing the views as resources rather than as fields is a deliberate
 * departure from ADR 0021, which writes them as PR #35's field-level governed
 * views. #35 is unmerged, and the two land in the same place: a view is named,
 * matching is exact and never substitutive, and the coarse answer is its own
 * name rather than a filter inside `reach`.
 */
export function agentCardPath(subject: Address, view: AgentCardView = "reach"): string[] {
  const path = [...DIRECTORY_RESOURCE_ROOT, ...addressPath(subject)];
  return view === "reach" ? path : [...path, view];
}

/**
 * The capability a reader needs to be served one view of one subject's card.
 *
 * Issued per subject. A host that wants a reader to see a whole directory
 * issues {@link directoryCapability} instead.
 */
export function agentCardCapability(
  subject: Address,
  owner: Address,
  view: AgentCardView = "reach",
): Capability {
  return {
    resource: { namespace: DIRECTORY_NAMESPACE, path: agentCardPath(subject, view), owner },
    actions: [DIRECTORY_READ_ACTION],
    scope: "exact",
  };
}

/**
 * The capability a reader needs to be served every card in a world.
 *
 * This is the enumeration grant, and it is meant to look like one. Holding it
 * is what makes the directory answer "does this agent exist" in bulk, which is
 * the reason reading a card is gated at all: without a gate every actor that
 * can reach the kernel holds this implicitly.
 */
export function directoryCapability(owner: Address): Capability {
  return {
    resource: { namespace: DIRECTORY_NAMESPACE, path: [...DIRECTORY_RESOURCE_ROOT], owner },
    actions: [DIRECTORY_READ_ACTION],
    scope: "descendants",
  };
}

/** The authorization one card read is decided on. */
export function agentCardRequest(
  subject: Address,
  owner: Address,
  view: AgentCardView,
): AuthorizationRequest {
  return {
    resource: { namespace: DIRECTORY_NAMESPACE, path: agentCardPath(subject, view), owner },
    action: DIRECTORY_READ_ACTION,
  };
}

/**
 * The context a subject's own grants are loaded under, derived from the
 * reader's.
 *
 * Computing a *subject's* reach needs grants that are not the caller's, and a
 * `GrantSource` answers for `context.actor`. So the kernel derives a second
 * context from the reader's own -- same `namespaceId`, same `now`, same
 * `authority`, same purpose and trace -- with `actor` set to the subject. That
 * is not a workaround for the contract; it is the contract doing the bounding:
 *
 * - **One authority.** `AccessContext.authority` already scopes what a
 *   `GrantSource` may answer with, so a card shows what the subject holds
 *   *under the authority the reader is itself operating under*, not the
 *   subject's whole life. It costs no new field.
 * - **One world.** The derived context carries the reader's `namespaceId`, so a
 *   card read in one namespace never describes reach in another.
 *
 * The obligation this puts on a host is the one thing about cards that needs
 * saying loudly: a `GrantSource` that reads an ambient session user instead of
 * `context.actor` now answers with the wrong principal's grants. SharedOS
 * catches the loud form of that mistake -- `TrustedAuthorityResolver` refuses a
 * grant whose subject is not `context.actor`, so a source that hands back the
 * reader's grants fails closed as `grant_scope_mismatch` rather than serving a
 * card of the wrong agent. It cannot catch the quiet form: a source that
 * filters by session and finds nothing answers with an empty grant set, and an
 * empty card is a card that understates.
 *
 * The `ResolvedAuthority` this produces is used for exactly one thing, shaping
 * reach, and authorizes nothing. ADR 0009's wrapper is what makes that
 * checkable rather than promised: it is not assignable to `AccessContext`, so a
 * subject's grants cannot reach a provider, a handler, or a runtime by
 * accident.
 */
export function subjectCardContext(reader: AccessContext, subject: Address): AccessContext {
  return { ...structuredClone(reader), actor: structuredClone(subject) };
}

/**
 * Which namespaces a reach touches and how much of each, with no paths.
 *
 * The coarse view's whole content. `entries` counts reach entries rather than
 * resources: collapsing a `descendants` entry into a resource count would mean
 * asking a provider what exists, which is the lookup a card must never become.
 */
export function summarizeReach(reach: readonly ResourceReach[]): ReachSummary[] {
  const byNamespace = new Map<string, { actions: Set<string>; entries: number }>();
  for (const entry of reach) {
    const row = byNamespace.get(entry.namespace) ?? { actions: new Set<string>(), entries: 0 };
    for (const action of entry.actions) {
      row.actions.add(action);
    }
    row.entries += 1;
    byNamespace.set(entry.namespace, row);
  }

  return [...byNamespace.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([namespace, row]) => ({
      namespace,
      actions: [...row.actions].sort(),
      entries: row.entries,
    }));
}

/**
 * Compose the served view, and hold it to the card contract.
 *
 * The projection happens here and nowhere else: a view is built from the fields
 * it declares rather than assembled whole and redacted, so there is no shape in
 * which a wider card exists on its way to a narrower reader. `identity` never
 * receives a reach at all, because the kernel does not load the subject's
 * grants for it.
 *
 * A card that does not parse is a defect in this function rather than anything
 * a caller did, and it throws rather than serving a half-built one.
 */
export function composeAgentCard(
  view: AgentCardView,
  subject: Address,
  context: AccessContext,
  reach: readonly ResourceReach[],
): AgentCard {
  const identity = {
    subject: structuredClone(subject),
    namespaceId: context.namespaceId,
    readAt: context.now,
  };
  const candidate =
    view === "identity"
      ? { view, ...identity }
      : view === "namespaces"
        ? { view, ...identity, namespaces: summarizeReach(reach) }
        : { view, ...identity, reach: [...reach] };

  const parsed = AgentCardSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new TypeError("agent card does not match the SharedOS v1 contract");
  }
  return parsed.data;
}

/** A card the reader was authorized for, in the shape it was authorized for. */
export interface AgentCardServed {
  readonly status: "served";
  readonly card: AgentCard;
}

/**
 * A card read that was refused, and what the reader may still ask for.
 *
 * `reasonCode` is the authorizer's own vocabulary and nothing new: a reader
 * holding no directory grant is told `no_matching_grant`, exactly as it would
 * be for a path that does not exist. That is the point -- an absent agent and
 * an agent this reader may not ask about are refused identically, so the
 * directory is not an existence oracle one refusal at a time either.
 *
 * `servableViews` names only views this same reader is already authorized for,
 * so it discloses nothing the reader did not hold. It exists so a reader
 * holding a narrow view learns what it may still ask for instead of concluding
 * the subject is unreachable.
 */
export interface AgentCardRefusal {
  readonly status: "refused";
  readonly reasonCode: string;
  readonly servableViews: readonly AgentCardView[];
  /** Present when the authorizer described the authority that would have served this view. */
  readonly requiredAuthority?: CapabilityRequest;
}

export type AgentCardRead = AgentCardServed | AgentCardRefusal;
