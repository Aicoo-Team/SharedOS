import type {
  AccessContext,
  AuthorizationDecision,
  Capability,
  CapabilityGrant,
  CapabilityRequest,
  JsonObject,
  ResourceRef,
} from "@aicoo/sharedos-contracts";

import type { HostPolicy, PolicyResolution, ResolvedAuthority } from "./authority.js";
import { reportContainedError, type ProviderErrorReporter } from "./diagnostics.js";
import { hashJson } from "./hashing.js";
import {
  type DelegationChainResolver,
  type DelegationValidation,
  validateDelegationChain,
} from "./delegation.js";
import {
  addressesEqual,
  type GrantInstants,
  grantIsActive,
  parseTimestamp,
  pathIsWithin,
  pathsEqual,
} from "./internal.js";

export { addressesEqual };

export interface AuthorizationRequest {
  readonly resource: ResourceRef;
  readonly action: string;
}

export type AuthorizationReasonCode =
  | "allowed"
  | "invalid_context"
  | "invalid_request"
  | "no_matching_grant"
  | "grant_exhausted"
  | "delegation_chain_invalid"
  | "authority_unavailable"
  | "delegation_chain_unverified"
  | "usage_store_unavailable"
  | "host_policy_denied"
  | "host_policy_unavailable";

/**
 * Denials caused by SharedOS being unable to establish a fact, not by policy.
 *
 * Fail-closed behaviour makes these look like denials at the call site. An
 * experiment must separate them from expected permission denials before
 * computing any rate, so they are named once here and marked `failClosed` in
 * the audit record.
 */
export const INFRASTRUCTURE_DENIAL_REASONS: readonly AuthorizationReasonCode[] = [
  "authority_unavailable",
  "delegation_chain_unverified",
  "usage_store_unavailable",
  "host_policy_unavailable",
];

export function isInfrastructureDenial(reasonCode: string): boolean {
  return (INFRASTRUCTURE_DENIAL_REASONS as readonly string[]).includes(reasonCode);
}

export interface GrantUsageStore {
  getUsage(namespaceId: string, grantId: string): Promise<number>;
  tryConsume(namespaceId: string, grantId: string, maximumUses: number): Promise<boolean>;
}

export interface CapabilityGrantVerifier {
  verify(grant: CapabilityGrant, context: AccessContext): Promise<boolean>;
}

/**
 * Product or organization policy, consulted on a grant that would otherwise
 * allow.
 *
 * A host narrows what its agents may do for reasons no grant expresses -- a
 * relationship model, a content-sensitivity check, an org-wide freeze. Doing
 * that outside the kernel makes it a second enforcement point SharedOS cannot
 * see: the refusal reaches no audit sink and no conformance cell, and the
 * denial counts a deployment produces say "nobody authorized this" about calls a
 * grant did authorize. This is where that judgment goes instead (ADR 0020).
 *
 * **Synchronous, and that is the contract.** A synchronous return structurally
 * forbids the network call, the database read, and the model call. A ceiling
 * needing a remote policy service is not this port: a per-call round trip here
 * is a latency and availability change to every operation SharedOS mediates.
 * Load the policy into memory and refresh it on your own schedule, which is what
 * correctness would require anyway.
 *
 * **It may only narrow.** It is never shown a denial, so it cannot turn one into
 * an allow. It may return the decision it was given or a denial, and nothing
 * else is read from what it returns: an `allowed` result carrying a different
 * `matchedGrantId` is treated as a malfunction and fails closed, and a denial's
 * `reasonCode` is replaced with `host_policy_denied` so one refusal vocabulary
 * survives (ADR 0012). Say more in `metadata`, which is preserved -- except that
 * audit drops the `consumed` and `failClosed` keys the kernel states itself, and
 * anything that is not a JSON object is dropped whole.
 *
 * **It is consulted before a bounded use is consumed**, so a call policy stopped
 * does not spend a `maxUses` grant: that counter records what an actor did.
 *
 * **It is consulted per matching grant, not once per request.** A refusal ends
 * that grant's candidacy and the walk continues, because two grants can match
 * one request and differ in ways policy distinguishes. Decide from `request` and
 * `context`; `decision.matchedGrantId` is there so a refusal can record which
 * grant it overrode, and a ceiling that branches on it is describing grant
 * issuance rather than a ceiling.
 *
 * **Discovery consults it too**, so a catalogue is not offered on authority that
 * invocation would refuse -- the agreement ADR 0016 established for expiry. Note
 * what it is asked there: a tool's *declared* ceiling, which ADR 0012 allows to
 * be broader than the argument-selected resource of any particular call.
 *
 * **Its policy arrives as the fourth argument.** When the kernel was given a
 * `PolicySource`, `policy` is what that source loaded for this turn, handed
 * back exactly as loaded -- not cloned, because SharedOS does not know its
 * shape -- and the same value for every decision in the turn. When it was not,
 * `policy` is `undefined` and the ceiling decides over state it closes over.
 * The pairing is the host's: SharedOS cannot check that the type a ceiling
 * expects is the type its source produces, which is why the parameter admits
 * `undefined` rather than promising a value. A turn whose policy could not be
 * loaded never reaches `narrow`: every decision the ceiling would have been
 * consulted on is refused `host_policy_unavailable` instead.
 *
 * A throw fails closed as `host_policy_unavailable`, an infrastructure denial
 * like every other unavailable trusted component.
 */
export interface HostCeiling<Policy = HostPolicy> {
  narrow(
    decision: AuthorizationDecision,
    request: AuthorizationRequest,
    context: AccessContext,
    policy: Policy | undefined,
  ): AuthorizationDecision;
}

/**
 * The instant one decision is made at, when it is not the turn's own.
 *
 * `ResolvedAuthority.context` carries the instant the turn's authority was
 * resolved, and that is what a turn is admitted against. A caller that knows the
 * instant of the *operation* -- `SharedOSKernel` does, because the executor
 * stamps a live context onto every call -- names it here, and a grant whose
 * validity window has closed since admission is refused without re-reading the
 * store. Omitting it decides at the turn's instant, which is what a kernel call
 * outside any turn is. See `grantIsActive` in `internal.ts` for which removals
 * move and which do not, and ADR 0016 for why.
 */
export interface AuthorizationInstantOptions {
  readonly now?: string;
}

export interface AuthorizeOptions extends AuthorizationInstantOptions {
  /**
   * Consumption is reserved for execution. Discovery calls must leave this
   * false so merely viewing a catalog cannot spend a bounded grant.
   */
  readonly consume?: boolean;
}

export interface CapabilityAuthorizerOptions {
  readonly usageStore?: GrantUsageStore;
  readonly grantVerifier?: CapabilityGrantVerifier;
  /**
   * Trusted ancestor lookup for delegated grants. Without it, a grant that
   * claims a parent can never authorize anything.
   */
  readonly delegationResolver?: DelegationChainResolver;
  readonly maxDelegationChainLength?: number;
  /**
   * Product or organization policy the kernel consults. See {@link HostCeiling}.
   *
   * Installed by whoever constructs the authorizer, which is the party that
   * already chooses the `GrantSource`. That is not a new privilege: anyone who
   * decides what authority exists can already decide it is none.
   *
   * The per-turn policy it decides against, when it has one, comes from
   * `SharedOSKernelOptions.policySource` -- on the kernel rather than here,
   * because the load is a turn-boundary event and the kernel owns the turn
   * boundary. The authorizer only carries what was loaded to the ceiling.
   */
  readonly hostCeiling?: HostCeiling;
  /**
   * Where a throw from {@link HostCeiling.narrow} is reported.
   *
   * The same shape `SharedOSKernelOptions.onProviderError` takes, and a host
   * wanting both passes one function to both: the ceiling is installed here
   * rather than on the kernel, so the kernel's hook cannot reach it. Without
   * this, a ceiling that fails denies every operation in the deployment as
   * `host_policy_unavailable` and says nothing about why.
   */
  readonly onProviderError?: ProviderErrorReporter;
}

/**
 * An atomic, process-local usage store suitable for tests and single-process
 * hosts. Distributed hosts should inject a durable compare-and-set store.
 */
export class InMemoryGrantUsageStore implements GrantUsageStore {
  readonly #usageByNamespace = new Map<string, Map<string, number>>();

  async getUsage(namespaceId: string, grantId: string): Promise<number> {
    return this.#usageByNamespace.get(namespaceId)?.get(grantId) ?? 0;
  }

  async tryConsume(namespaceId: string, grantId: string, maximumUses: number): Promise<boolean> {
    let namespaceUsage = this.#usageByNamespace.get(namespaceId);
    if (namespaceUsage === undefined) {
      namespaceUsage = new Map<string, number>();
      this.#usageByNamespace.set(namespaceId, namespaceUsage);
    }

    const current = namespaceUsage.get(grantId) ?? 0;
    if (current >= maximumUses) {
      return false;
    }

    namespaceUsage.set(grantId, current + 1);
    return true;
  }
}

export class CapabilityAuthorizer {
  readonly #usageStore: GrantUsageStore | undefined;
  readonly #grantVerifier: CapabilityGrantVerifier | undefined;
  readonly #delegationResolver: DelegationChainResolver | undefined;
  readonly #maxDelegationChainLength: number | undefined;
  readonly #hostCeiling: HostCeiling | undefined;
  readonly #onProviderError: ProviderErrorReporter | undefined;

  constructor(options: CapabilityAuthorizerOptions = {}) {
    this.#usageStore = options.usageStore;
    this.#grantVerifier = options.grantVerifier;
    this.#delegationResolver = options.delegationResolver;
    this.#maxDelegationChainLength = options.maxDelegationChainLength;
    this.#hostCeiling = options.hostCeiling;
    this.#onProviderError = options.onProviderError;
  }

  /**
   * Whether a host ceiling is installed.
   *
   * Read by the kernel so `authority.resolved` can say so. Without it, an audit
   * stream containing no `host_policy_denied` is ambiguous between a deployment
   * with no policy port and one whose port never fired, and that ambiguity is
   * the difference between a count and a guess (ADR 0020).
   */
  get hasHostCeiling(): boolean {
    return this.#hostCeiling !== undefined;
  }

  async authorize(
    authority: ResolvedAuthority,
    request: AuthorizationRequest,
    options: AuthorizeOptions = {},
  ): Promise<AuthorizationDecision> {
    return this.#decide(
      authority,
      request,
      capabilityMatches,
      options.consume ?? false,
      options.now,
      // Describes what was missing when nothing matched; see
      // `describeRequiredCapability`.
      true,
    );
  }

  /**
   * Non-consuming catalog check. A narrow grant can discover a tool whose
   * declared resource is a broader ceiling; invocation still checks the exact
   * argument-selected resource.
   */
  async canDiscover(
    authority: ResolvedAuthority,
    ceiling: AuthorizationRequest,
    options: AuthorizationInstantOptions = {},
  ): Promise<AuthorizationDecision> {
    // The last argument is `false`: a discovery check is made against a tool's
    // declared capability, which may be a broader ceiling than any call, so a
    // description built here would name authority no operation needed.
    return this.#decide(authority, ceiling, capabilityIntersectsCeiling, false, options.now, false);
  }

  async #decide(
    authority: ResolvedAuthority,
    request: AuthorizationRequest,
    matches: (
      capability: Capability,
      request: AuthorizationRequest,
      context: AccessContext,
    ) => boolean,
    consume: boolean,
    operationNow: string | undefined,
    describeMissing: boolean,
  ): Promise<AuthorizationDecision> {
    const context = structuredClone(authority.context);
    const grants = structuredClone([...authority.grants]);
    request = structuredClone(request);
    const admittedAt = parseTimestamp(context.now);
    // An unparsable operation instant is a broken context, not an absent one:
    // falling back to the turn's instant would silently decide at a moment the
    // caller did not ask for, which is the one thing naming an instant is for.
    const now = operationNow === undefined ? admittedAt : parseTimestamp(operationNow);
    if (
      admittedAt === undefined ||
      now === undefined ||
      context.purpose.length === 0 ||
      context.traceId.length === 0
    ) {
      return deny("invalid_context");
    }
    const at: GrantInstants = { admittedAt, now };

    if (
      request.action.length === 0 ||
      request.resource.namespace.length === 0 ||
      !resourceBelongsToContext(request.resource, context)
    ) {
      return deny("invalid_request");
    }

    let foundExhaustedGrant = false;
    let policyDenial: AuthorizationDecision | undefined;
    let delegationFailure: DelegationFailure | undefined;

    for (const grant of grants) {
      if (!(await this.#grantIsEligible(context, grant, at))) {
        continue;
      }

      const capability = grant.capabilities.find((candidate) =>
        matches(candidate, request, context),
      );
      if (capability === undefined) {
        continue;
      }

      const delegation = await this.#validateDelegation(context, grant, at);
      if (delegation.status !== "valid") {
        delegationFailure = worstDelegationFailure(delegationFailure, {
          status: delegation.status,
          code: delegation.code,
          grantId: delegation.grantId,
        });
        continue;
      }

      // Last gate before consumption, so a call policy refuses does not spend a
      // bounded use. The walk continues rather than stopping: two grants can
      // match one request and differ in ways a policy distinguishes, and
      // stopping here would deny a call the next grant would have allowed.
      const narrowed = this.#applyCeiling(grant.id, request, context, authority.hostPolicy);
      if (narrowed.reasonCode === "host_policy_unavailable") {
        return narrowed;
      }
      if (!narrowed.allowed) {
        policyDenial ??= narrowed;
        continue;
      }

      const maximumUses = grant.constraints.maxUses;
      if (maximumUses === undefined) {
        return allow(grant.id);
      }

      if (this.#usageStore === undefined) {
        return deny("usage_store_unavailable");
      }

      try {
        const available = consume
          ? await this.#usageStore.tryConsume(context.namespaceId, grant.id, maximumUses)
          : (await this.#usageStore.getUsage(context.namespaceId, grant.id)) < maximumUses;

        if (available) {
          return allow(grant.id);
        }

        foundExhaustedGrant = true;
      } catch {
        return deny("usage_store_unavailable");
      }
    }

    if (delegationFailure !== undefined) {
      return deny(
        delegationFailure.status === "unverified"
          ? "delegation_chain_unverified"
          : "delegation_chain_invalid",
        { delegation: { code: delegationFailure.code, grantId: delegationFailure.grantId } },
      );
    }

    // Above exhaustion because under-counting policy denials is the defect the
    // ceiling exists to fix. Below both delegation outcomes, for two reasons
    // rather than one: an unverified chain is fail-closed, and reporting a
    // deliberate refusal in its place would hide an infrastructure failure
    // behind a policy label; an invalid chain is not fail-closed, but it says
    // the grant is not valid authority at all, which is upstream of whether
    // policy would have allowed it.
    if (policyDenial !== undefined) {
      return policyDenial;
    }

    if (foundExhaustedGrant) {
      return deny("grant_exhausted");
    }

    const missing = deny("no_matching_grant");
    return describeMissing
      ? { ...missing, requiredAuthority: await describeRequiredAuthority(context, request) }
      : missing;
  }

  /**
   * Hand one would-be allow to the host ceiling, and read only what it may say.
   *
   * The returned decision is rebuilt here rather than passed through, so a
   * ceiling cannot widen by construction rather than by prohibition: an
   * `allowed` result is answered with a decision built here, and one naming a
   * different grant than the one it was shown is a malfunction that fails
   * closed. A denial keeps only its metadata; its reason code is replaced,
   * because a ceiling free to return `no_matching_grant` could reintroduce the
   * misattribution the separate code exists to end (ADR 0020).
   *
   * The *shape* of what came back is checked before any field is read, and that
   * is not defensive clutter. Two mistakes a host makes without a type error --
   * writing `async narrow`, or falling off the end of a branch that meant to
   * allow -- both yield something whose `allowed` is `undefined`. Read
   * optimistically, the first would be recorded as a deliberate
   * `host_policy_denied`, inflating the one count this port exists to make
   * trustworthy, and the second would throw past every call site and end the
   * turn with no audit event at all. Both are malfunctions, so both fail closed.
   *
   * A turn whose policy could not be loaded is refused here without consulting
   * the ceiling, under the same code a broken ceiling produces: the port is
   * unavailable either way, and it was reported once, at the turn boundary,
   * rather than on each decision it fails.
   */
  #applyCeiling(
    grantId: string,
    request: AuthorizationRequest,
    context: AccessContext,
    hostPolicy: PolicyResolution | undefined,
  ): AuthorizationDecision {
    if (this.#hostCeiling === undefined) {
      return allow(grantId);
    }
    if (hostPolicy?.status === "unavailable") {
      return deny("host_policy_unavailable");
    }

    let narrowed: unknown;
    try {
      narrowed = this.#hostCeiling.narrow(
        allow(grantId),
        structuredClone(request),
        structuredClone(context),
        hostPolicy?.policy,
      );
    } catch (error) {
      reportContainedError(this.#onProviderError, error, {
        kind: "policy",
        reasonCode: "host_policy_unavailable",
        traceId: context.traceId,
        namespaceId: context.namespaceId,
        resource: request.resource,
        action: request.action,
      });
      return deny("host_policy_unavailable");
    }

    if (!isVerdict(narrowed)) {
      return deny("host_policy_unavailable");
    }

    if (narrowed.allowed) {
      return narrowed.matchedGrantId === grantId ? allow(grantId) : deny("host_policy_unavailable");
    }

    return {
      allowed: false,
      reasonCode: "host_policy_denied",
      matchedGrantId: grantId,
      ...(isJsonObject(narrowed.metadata) ? { metadata: narrowed.metadata } : {}),
    };
  }

  async #validateDelegation(
    context: AccessContext,
    grant: CapabilityGrant,
    at: GrantInstants,
  ): Promise<DelegationValidation> {
    return validateDelegationChain(grant, context, at.now, {
      admittedAt: at.admittedAt,
      ...(this.#delegationResolver === undefined ? {} : { resolver: this.#delegationResolver }),
      ...(this.#maxDelegationChainLength === undefined
        ? {}
        : { maxChainLength: this.#maxDelegationChainLength }),
    });
  }

  async #grantIsEligible(
    context: AccessContext,
    grant: CapabilityGrant,
    at: GrantInstants,
  ): Promise<boolean> {
    if (
      !addressesEqual(grant.subject, context.actor) ||
      !addressesEqual(grant.issuer, context.authority) ||
      grant.namespaceId !== context.namespaceId ||
      !grantIsActive(grant, context.purpose, at)
    ) {
      return false;
    }

    if (this.#grantVerifier !== undefined) {
      try {
        if (!(await this.#grantVerifier.verify(grant, context))) {
          return false;
        }
      } catch {
        return false;
      }
    }

    return true;
  }
}

interface DelegationFailure {
  readonly status: "invalid" | "unverified";
  readonly code: string;
  readonly grantId: string;
}

/** An unverifiable chain outranks an invalid one so failures stay fail-closed. */
function worstDelegationFailure(
  current: DelegationFailure | undefined,
  candidate: DelegationFailure,
): DelegationFailure {
  if (
    current === undefined ||
    (current.status === "invalid" && candidate.status === "unverified")
  ) {
    return candidate;
  }
  return current;
}

function allow(grantId: string): AuthorizationDecision {
  return { allowed: true, reasonCode: "allowed", matchedGrantId: grantId };
}

function deny(
  reasonCode: Exclude<AuthorizationReasonCode, "allowed">,
  metadata?: JsonObject,
): AuthorizationDecision {
  return { allowed: false, reasonCode, ...(metadata === undefined ? {} : { metadata }) };
}

/**
 * Whether a host port returned something that can be read as a decision.
 *
 * Only `allowed` is required, because it is the only field read before the
 * shape has been established; `matchedGrantId` and `metadata` are each checked
 * where they are used. A `Promise`, `undefined`, or a bare string all fail here,
 * which is the point -- see {@link CapabilityAuthorizer} on why an unchecked
 * read of `allowed` is worse than a throw.
 */
function isVerdict(value: unknown): value is AuthorizationDecision {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { allowed?: unknown }).allowed === "boolean"
  );
}

/**
 * Whether a value may be carried into an audit event as metadata.
 *
 * `JsonObject` is a compile-time claim, and a ceiling is host code that may have
 * no compiler in front of it. Anything else is dropped rather than refused: the
 * refusal it annotates is still a true and useful record without it, and letting
 * a function or a `Date` reach `structuredClone` inside the audit path would
 * turn a policy denial into a thrown turn.
 */
function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
 *
 * The identifier is derived rather than random, and `requestedAt` is
 * deliberately not part of what it is derived from. `requestedAt` is the instant
 * of the authority the decision was made against -- the turn's admission instant
 * inside a turn, since `context` comes from the authority lease and not from the
 * operation -- so it is stable within a turn but moves between turns describing
 * the same missing authority, and it moves on every conformance run. Hashing
 * only the authority itself is what gives one missing authority one identifier
 * across turns, and what keeps a conformance cell able to state the value it
 * observed rather than that a field was present.
 */
async function describeRequiredAuthority(
  context: AccessContext,
  request: AuthorizationRequest,
): Promise<CapabilityRequest> {
  const capability: Capability = {
    // Rebuilt key by key rather than spread. `structuredClone` keeps an own
    // property whose value is `undefined`, and `canonicalJson` emits one, so a
    // caller that passed `owner: undefined` and one that omitted the key would
    // hash to two different identifiers for one missing authority -- defeating
    // the deduplication the derived identifier exists to give.
    resource: {
      namespace: request.resource.namespace,
      path: [...request.resource.path],
      ...(request.resource.owner === undefined ? {} : { owner: request.resource.owner }),
    },
    actions: [request.action],
    scope: "exact",
  };
  const identity = {
    namespaceId: context.namespaceId,
    requester: context.actor,
    owner: context.owner,
    capabilities: [capability],
    purpose: context.purpose,
  };
  return {
    id: `capreq-${await hashJson(identity)}`,
    ...identity,
    requestedAt: context.now,
  };
}

export function capabilityMatches(
  capability: Capability,
  request: AuthorizationRequest,
  context: AccessContext,
): boolean {
  const grantedResource = capability.resource;
  const requestedResource = request.resource;

  if (
    grantedResource.namespace !== requestedResource.namespace ||
    (!capability.actions.includes(request.action) && !capability.actions.includes("*"))
  ) {
    return false;
  }

  const grantedOwner = grantedResource.owner ?? context.owner;
  const requestedOwner = requestedResource.owner ?? context.owner;
  if (!addressesEqual(grantedOwner, requestedOwner)) {
    return false;
  }

  if (capability.scope === "exact") {
    return pathsEqual(grantedResource.path, requestedResource.path);
  }

  return pathIsWithin(grantedResource.path, requestedResource.path);
}

export function capabilityIntersectsCeiling(
  capability: Capability,
  ceiling: AuthorizationRequest,
  context: AccessContext,
): boolean {
  const grantedResource = capability.resource;
  const ceilingResource = ceiling.resource;

  if (
    grantedResource.namespace !== ceilingResource.namespace ||
    (!capability.actions.includes(ceiling.action) && !capability.actions.includes("*"))
  ) {
    return false;
  }

  const grantedOwner = grantedResource.owner ?? context.owner;
  const ceilingOwner = ceilingResource.owner ?? context.owner;
  if (!addressesEqual(grantedOwner, ceilingOwner)) {
    return false;
  }

  if (capability.scope === "exact") {
    return pathIsWithin(ceilingResource.path, grantedResource.path);
  }

  return (
    pathIsWithin(grantedResource.path, ceilingResource.path) ||
    pathIsWithin(ceilingResource.path, grantedResource.path)
  );
}

function resourceBelongsToContext(resource: ResourceRef, context: AccessContext): boolean {
  return resource.owner === undefined || addressesEqual(resource.owner, context.owner);
}
