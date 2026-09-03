import type {
  Address,
  Capability,
  CapabilityConstraints,
  CapabilityRequest,
  JsonObject,
} from "@aicoo/sharedos-contracts";
import { CapabilityConstraintsSchema } from "@aicoo/sharedos-contracts";
import { addressesEqual, capabilityIsWithin, tightestConstraints } from "@aicoo/sharedos-core";

import { precedentKey, precedentKeyDigest } from "./key.js";
import type { ApprovedPrecedent, Precedent, PrecedentLookup } from "./lookup.js";

/**
 * The reserved metadata key an auto-decided grant carries.
 *
 * Reserved and validated rather than left to opaque host metadata, and that is
 * consistent with ADR 0008 refusing to put the delegation parent there: 0008's
 * objection was to *authority* resting on an unvalidated field. This one grants
 * nothing and removes nothing. It is a handle, and the only thing that has to
 * be true of a handle is that it is present -- which only a validated key makes
 * checkable.
 */
export const AUTO_DECIDED_METADATA_KEY = "autoDecided";

/**
 * What a host declares about the matcher behind a proposal.
 *
 * `matcher` is the class handle R4 exists for: a product will improve its
 * matcher, some improvement will be wrong, and the difference between that
 * being an incident and being a rollback is whether an operator can select
 * everything one matcher produced and revoke it in one action. Name the matcher
 * and its version, not the request -- "the thing to revoke" is a generation of
 * matcher, never a single decision.
 */
export interface AutoDecidedMarker {
  readonly matcher: string;
}

/**
 * The marker as it reaches the grant and the audit event, with the citation the
 * kernel derived rather than the host asserted.
 */
export interface AutoDecidedRecord extends AutoDecidedMarker {
  readonly citedRequestIds: readonly string[];
  /** Whether the cited evidence was the identical question. R1's axis. */
  readonly match: PrecedentMatch;
}

/**
 * Whether the cited precedents are the same question or merely a similar one.
 *
 * Derived here, never declared: a host that could assert "this was exact" would
 * be self-reporting the very thing R1 gates, and a rule enforced against a
 * self-report is a rule enforced against honest hosts only.
 */
export type PrecedentMatch = "exact" | "fuzzy";

/**
 * What the host wants to happen, carrying no score, confidence, or match type.
 *
 * A field the kernel is handed and must ignore is a field a host will
 * eventually expect it to honour -- ADR 0009 rejected a context carrying
 * `grants` the kernel ignored for exactly that reason -- so the proposal has
 * nowhere to put one.
 */
export type ProposedAutoDecision =
  | { readonly allowed: false }
  | { readonly allowed: true; readonly capabilities: readonly Capability[] };

export interface AutoDecisionProposal {
  /** The escalation now in front of the control plane. */
  readonly request: CapabilityRequest;
  /** The precedents the host's matcher chose, by `CapabilityRequest.id`. */
  readonly citedRequestIds: readonly string[];
  readonly proposed: ProposedAutoDecision;
  readonly marker: AutoDecidedMarker;
}

/** Why a proposal may not be decided without a human. */
export type PrecedentInadmissibleReason =
  | "no_precedent_cited"
  | "auto_decision_unmarked"
  | "empty_proposed_capability"
  | "precedent_unavailable"
  | "precedent_not_this_owner"
  | "precedent_not_this_requester"
  | "allow_cites_refusal"
  | "wider_than_precedent"
  | "wider_than_request"
  | "envelope_unsatisfiable";

interface AdmittedCommon {
  readonly citedRequestIds: readonly string[];
  readonly match: PrecedentMatch;
  /** R4, ready to put on the grant and on the audit event. */
  readonly metadata: JsonObject;
}

/**
 * An auto-decision that refuses.
 *
 * It issues nothing, so its marker reaches only the audit event. A refusal
 * still has to be markable: an operator revoking everything one matcher
 * produced has to be able to find the requests it silently closed as well as
 * the grants it opened.
 */
export interface AdmittedDeny extends AdmittedCommon {
  readonly allowed: false;
}

/**
 * An auto-decision that allows, at a width the kernel bounded.
 *
 * `allowed: true` and nothing else: this is not a third `AuthorizationDecision`
 * value and is deliberately not assignable to one. It describes a grant for the
 * host's store to issue, which the next turn loads through `GrantSource` like
 * any other. Nothing here is authority, no port accepts one back as authority,
 * and no turn is resumed by it.
 */
export interface AdmittedAllow extends AdmittedCommon {
  readonly allowed: true;
  /**
   * True when fuzzy evidence carried it, which is ADR 0022's `allow_narrowed`.
   *
   * Not a decision value. It serialises as an ordinary allow; what differs is
   * that the capability below was additionally bounded by what this request
   * actually asked for, because resemblance may not authorize more than the
   * question in front of us needs.
   */
  readonly narrowed: boolean;
  readonly capabilities: readonly Capability[];
  /** R3's tightest envelope across every precedent cited. */
  readonly constraints: CapabilityConstraints;
}

export type AdmittedAutoDecision = AdmittedDeny | AdmittedAllow;

export type PrecedentAdmission =
  | { readonly admitted: true; readonly decision: AdmittedAutoDecision }
  | { readonly admitted: false; readonly reason: PrecedentInadmissibleReason };

/**
 * Decide whether one finished proposal may be decided without a human.
 *
 * The host proposes however it likes -- exact key match, Jaccard over tool
 * names, embeddings, a model trained on its own history. This does not rank,
 * score, learn, or improve; it answers one question about a proposal that is
 * already made, against R1 through R4 of ADR 0022. That separation is the whole
 * point: a product's matching can get better every quarter without the kernel
 * ever having to trust a similarity score, and what a security review reads is
 * four rules rather than a model.
 *
 * **R1 -- fuzzy evidence may only narrow.** A deny is admissible on either
 * evidence: refusing something resembling what this owner has refused takes
 * nothing away that was not already absent, and its worst case is an escalation
 * the owner never sees, which is today's case for every request. An allow is
 * the only outcome that creates authority, so only an exact key match may
 * authorize at the full width a human approved; a fuzzy allow is additionally
 * bounded by the capabilities this request asked for and comes back
 * `narrowed`.
 *
 * **R2 -- never wider than the precedents cited.** Checked with
 * `capabilityIsWithin`, the same predicate the delegation chain uses, applied
 * once per cited precedent rather than against a constructed intersection --
 * the same guarantee without an intersection algebra the contract would then
 * have to define and test. Cited precedents that are disjoint make every
 * proposal inadmissible, which is the correct answer.
 *
 * **R3 -- the tightest envelope.** Minimum expiry, latest start, minimum
 * bounded use, the intersection of allowed purposes, and `delegationDepth: 0`.
 * A machine-made grant that can be delegated is one whose blast radius is
 * decided by somebody else. This bounds one auto-decision, never a class: n
 * auto-decisions citing a k-use precedent carry n*k uses between them, exactly
 * as ADR 0008 already found for delegation. What bounds the class is R4.
 *
 * **R4 -- every auto-decision is marked.** A proposal that declares no marker
 * is inadmissible, and the marker returned carries the derived citation.
 * Honouring it at issue is the host's, as ADR 0011 already divides resolution.
 *
 * Refusing a proposal is not an event. The escalation it concerns is already
 * recorded and already waiting for a human; manufacturing a second one would
 * double-count in every denominator. Inadmissible means the auto-decision does
 * not happen and the request stays where it was.
 */
export async function admitAutoDecision(
  proposal: AutoDecisionProposal,
  lookup: PrecedentLookup,
): Promise<PrecedentAdmission> {
  const matcher = proposal.marker?.matcher;
  if (typeof matcher !== "string" || matcher.trim().length === 0) {
    return inadmissible("auto_decision_unmarked");
  }

  // Citing one precedent twice is one citation. Deduplicating here keeps a
  // repeated id from being an extra row the store never returns.
  const citedRequestIds = [...new Set(proposal.citedRequestIds)];
  if (citedRequestIds.length === 0) {
    return inadmissible("no_precedent_cited");
  }
  if (proposal.proposed.allowed && proposal.proposed.capabilities.length === 0) {
    return inadmissible("empty_proposed_capability");
  }

  const request = proposal.request;
  let loaded: readonly Precedent[];
  try {
    loaded = await lookup.load(request.namespaceId, citedRequestIds);
  } catch {
    return inadmissible("precedent_unavailable");
  }

  const precedents = citedPrecedents(loaded, citedRequestIds);
  if (precedents === undefined) {
    return inadmissible("precedent_unavailable");
  }

  // A precedent is one owner's answer inside one namespace. `capabilityIsWithin`
  // compares owners too, but only the allow arm reaches it -- so a deny citing
  // some other owner's refusal has to be refused here or not at all.
  for (const precedent of precedents) {
    if (
      precedent.key.namespaceId !== request.namespaceId ||
      !addressesEqual(precedent.key.owner, request.owner)
    ) {
      return inadmissible("precedent_not_this_owner");
    }
  }

  const match = await matchKind(request, precedents);
  const record: AutoDecidedRecord = { matcher, citedRequestIds, match };
  const common: AdmittedCommon = {
    citedRequestIds,
    match,
    metadata: { [AUTO_DECIDED_METADATA_KEY]: autoDecidedJson(record) },
  };

  if (!proposal.proposed.allowed) {
    return { admitted: true, decision: { ...common, allowed: false } };
  }

  return admitAllow(proposal.proposed.capabilities, request, precedents, common);
}

function admitAllow(
  proposed: readonly Capability[],
  request: CapabilityRequest,
  precedents: readonly Precedent[],
  common: AdmittedCommon,
): PrecedentAdmission {
  const approved: ApprovedPrecedent[] = [];
  for (const precedent of precedents) {
    // A refusal has no width, which is why `RefusedPrecedent` has no
    // capabilities to read. Narrowing this to the approved arm is what makes
    // "a denial cannot become an allow" structural rather than a rule.
    if (precedent.outcome !== "approved") {
      return inadmissible("allow_cites_refusal");
    }
    // `capabilityIsWithin` compares owner, namespace, actions and path -- it
    // has no opinion on who is asking, because a delegation chain has already
    // settled that elsewhere. Here nothing else settles it: an owner who
    // allowed agent A to read a path did not thereby allow agent B, and
    // admitting one on the other's precedent would be authority nobody granted.
    // Implied by the key on an exact match; on a fuzzy one it has to be said.
    if (!addressesEqual(precedent.key.requester, request.requester)) {
      return inadmissible("precedent_not_this_requester");
    }
    approved.push(precedent);
  }

  // `capabilityIsWithin` resolves an unowned resource against a context owner,
  // and the owner is the only field of one it reads. Both sides are already
  // pinned to this owner, so the resolution is the same on each.
  const owner: { readonly owner: Address } = { owner: request.owner };
  const withinEvery = proposed.every((capability) =>
    approved.every((precedent) =>
      precedent.capabilities.some((allowed) => capabilityIsWithin(capability, allowed, owner)),
    ),
  );
  if (!withinEvery) {
    return inadmissible("wider_than_precedent");
  }

  const narrowed = common.match === "fuzzy";
  if (
    narrowed &&
    !proposed.every((capability) =>
      request.capabilities.some((asked) => capabilityIsWithin(capability, asked, owner)),
    )
  ) {
    return inadmissible("wider_than_request");
  }

  const constraints = tightestEnvelope(approved);
  if (constraints === undefined) {
    return inadmissible("envelope_unsatisfiable");
  }

  return {
    admitted: true,
    decision: {
      ...common,
      allowed: true,
      narrowed,
      capabilities: proposed.map(clonedCapability),
      constraints,
    },
  };
}

/**
 * The narrowest bound every cited precedent can live with, or `undefined` when
 * no such bound exists.
 *
 * An absent constraint on a precedent is not a bound of zero: an approval with
 * no expiry does not stop a co-cited approval's expiry from being the tightest
 * one. `notBefore` is not in ADR 0022's list, and is taken as the latest of the
 * cited starts here because leaving it out would let an auto-decision begin
 * before the human decision it leans on -- tightening, never widening, so the
 * rule R3 states is untouched.
 *
 * Disjoint bounds have no envelope. Purposes that intersect to nothing, or a
 * window whose start is past its end, is refused rather than clamped: an empty
 * envelope is a proposal no cited human decision supports.
 *
 * The meet itself is `tightestConstraints` in `@aicoo/sharedos-core`, the same
 * ordering delegation checks containment against, so "tighter" means one thing
 * whether a person delegated or a matcher proposed.
 */
function tightestEnvelope(
  precedents: readonly ApprovedPrecedent[],
): CapabilityConstraints | undefined {
  const envelope = tightestConstraints(precedents.map(({ constraints }) => constraints));
  if (envelope === undefined) {
    return undefined;
  }
  const parsed = CapabilityConstraintsSchema.safeParse({
    ...envelope,
    // An auto-issued grant may not be passed on. A machine-made grant that can
    // be delegated is a machine-made grant whose blast radius is decided by
    // somebody else.
    delegationDepth: 0,
  });
  return parsed.success ? parsed.data : undefined;
}

/**
 * Exactly the rows that were cited, in the order they were cited, or
 * `undefined` when the store answered with anything else.
 *
 * A missing row, a duplicate, or a row nobody asked for all fail closed. The
 * lookup is trusted to be authoritative; an answer that does not match the
 * question means it was not.
 */
function citedPrecedents(
  loaded: readonly Precedent[],
  citedRequestIds: readonly string[],
): readonly Precedent[] | undefined {
  if (loaded.length !== citedRequestIds.length) {
    return undefined;
  }
  const byId = new Map(loaded.map((precedent) => [precedent.requestId, precedent]));
  if (byId.size !== loaded.length) {
    return undefined;
  }
  const precedents: Precedent[] = [];
  for (const requestId of citedRequestIds) {
    const precedent = byId.get(requestId);
    if (precedent === undefined) {
      return undefined;
    }
    precedents.push(precedent);
  }
  return precedents;
}

/**
 * `exact` only when every cited precedent is the identical question.
 *
 * A citation mixing one identical precedent with a similar one is fuzzy
 * evidence: the similar row is still evidence the proposal leans on, and R1 is
 * about what the whole citation supports rather than about its best member.
 */
async function matchKind(
  request: CapabilityRequest,
  precedents: readonly Precedent[],
): Promise<PrecedentMatch> {
  const digest = await precedentKeyDigest(precedentKey(request));
  const digests = await Promise.all(
    precedents.map(async (precedent) => precedentKeyDigest(precedent.key)),
  );
  return digests.every((candidate) => candidate === digest) ? "exact" : "fuzzy";
}

function autoDecidedJson(record: AutoDecidedRecord): JsonObject {
  return {
    matcher: record.matcher,
    citedRequestIds: [...record.citedRequestIds],
    match: record.match,
  };
}

/**
 * The marker on a grant, or `undefined` when it carries none.
 *
 * The reading half of R4: an operator selecting everything one matcher produced
 * asks this of each grant's `metadata` rather than parsing a convention. A
 * grant with no marker was decided by a person, which is the distinction the
 * whole rule exists to keep drawable.
 */
export function readAutoDecided(metadata: JsonObject | undefined): AutoDecidedRecord | undefined {
  const value = metadata?.[AUTO_DECIDED_METADATA_KEY];
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const matcher = value["matcher"];
  const citedRequestIds = value["citedRequestIds"];
  const match = value["match"];
  if (
    typeof matcher !== "string" ||
    !Array.isArray(citedRequestIds) ||
    !citedRequestIds.every((id): id is string => typeof id === "string") ||
    (match !== "exact" && match !== "fuzzy")
  ) {
    return undefined;
  }
  return { matcher, citedRequestIds: [...citedRequestIds], match };
}

function clonedCapability(capability: Capability): Capability {
  return {
    ...capability,
    actions: [...capability.actions],
    resource: { ...capability.resource, path: [...capability.resource.path] },
  };
}

function inadmissible(reason: PrecedentInadmissibleReason): PrecedentAdmission {
  return { admitted: false, reason };
}
