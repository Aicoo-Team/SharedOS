import type {
  AccessContext,
  AuthorizationDecision,
  Capability,
  CapabilityGrant,
  CapabilityRequest,
  JsonObject,
  ResourceRef,
} from "@aicoo/sharedos-contracts";

import type { ResolvedAuthority } from "./authority.js";
import { describeRequiredCapability } from "./capability-request.js";
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
  | "host_policy_denied"
  | "delegation_chain_invalid"
  | "authority_unavailable"
  | "delegation_chain_unverified"
  | "host_policy_unavailable"
  | "usage_store_unavailable";

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
  "host_policy_unavailable",
  "usage_store_unavailable",
];

export function isInfrastructureDenial(reasonCode: string): boolean {
  return (INFRASTRUCTURE_DENIAL_REASONS as readonly string[]).includes(reasonCode);
}

/**
 * A decision that allowed, and the grant that produced it.
 *
 * Named apart from {@link AuthorizationDecision} so a port can be given the
 * allow arm alone. A denial is not assignable to it, which is how
 * {@link HostCeiling} is prevented from ever seeing one.
 */
export interface AllowedDecision {
  readonly allowed: true;
  readonly reasonCode: "allowed";
  readonly matchedGrantId: string;
  readonly metadata?: JsonObject;
}

/** A decision that refused, and the one code saying what was refused. */
export interface DeniedDecision {
  readonly allowed: false;
  readonly reasonCode: Exclude<AuthorizationReasonCode, "allowed">;
  readonly requiredCapability?: CapabilityRequest;
  readonly metadata?: JsonObject;
}

/**
 * A refusal by host policy, the one input to a decision no grant expresses.
 *
 * The only denial a ceiling may author. Its code is fixed here rather than
 * taken from the ceiling, so the vocabulary stays SharedOS's: a host cannot
 * invent a reason code by returning one, and cannot borrow `no_matching_grant`
 * to make its own refusal look like an absent grant.
 */
export interface HostPolicyDenial {
  readonly allowed: false;
  readonly reasonCode: "host_policy_denied";
  readonly metadata?: JsonObject;
}

/**
 * The only two things a ceiling may say: the decision it was handed, or no.
 *
 * Widening is inexpressible rather than forbidden. A ceiling is handed an
 * {@link AllowedDecision} and can therefore never receive a denial to turn
 * into an allow; the allow arm it may return is pinned to `reasonCode:
 * "allowed"` and requires a `matchedGrantId`, which {@link CapabilityAuthorizer}
 * checks is the one it handed over. Anything else is a malfunction and fails
 * closed as `host_policy_unavailable`.
 */
export type HostCeilingVerdict = AllowedDecision | HostPolicyDenial;

/**
 * Product or organization policy, applied where step 10 of the permission
 * model already puts it.
 *
 * Consulted only after a grant has matched, on an already-`allowed` decision,
 * on both the `authorize` and the `canDiscover` path -- so a tool the ceiling
 * refuses at invocation is also absent from the catalogue. It cannot widen
 * anything: see {@link HostCeilingVerdict}.
 *
 * The signature is synchronous, and that is the enforcement. "Deterministic and
 * cheap" cannot be asserted in prose and then relied on; a synchronous return
 * cannot await a network call or a model call, so the constraint is carried by
 * the type. A timeout was rejected for the same reason it would fail as a
 * conformance signal: what it admits depends on how fast the machine is. A host
 * whose policy lives in a database loads it on its own schedule and closes over
 * the result -- ADR 0020's `PolicySource`, which moves that load to the turn
 * boundary beside the grant set, is not implemented yet and carries a row in
 * `docs/open-items.md`.
 *
 * A throw fails closed and is recorded as `host_policy_unavailable`, an
 * infrastructure denial consistent with every other unavailable trusted
 * component. A refusal is recorded as `host_policy_denied`, which is a policy
 * denial and its own bucket: not merged with `no_matching_grant`, which says no
 * such authority exists, and not counted as infrastructure. Which component
 * refused is `OperationRecord.source` and lives only there.
 *
 * It is optional. A kernel constructed without one behaves exactly as it does
 * today. See ADR 0020.
 */
export interface HostCeiling {
  narrow(
    decision: AllowedDecision,
    request: AuthorizationRequest,
    context: AccessContext,
  ): HostCeilingVerdict;
}

export interface GrantUsageStore {
  getUsage(namespaceId: string, grantId: string): Promise<number>;
  tryConsume(namespaceId: string, grantId: string, maximumUses: number): Promise<boolean>;
}

export interface CapabilityGrantVerifier {
  verify(grant: CapabilityGrant, context: AccessContext): Promise<boolean>;
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
   * Host policy that may reduce, but never increase, granted authority.
   *
   * Absent by default, and an absent ceiling changes nothing: the decision the
   * grants produced is the decision returned, code for code.
   */
  readonly hostCeiling?: HostCeiling;
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

  constructor(options: CapabilityAuthorizerOptions = {}) {
    this.#usageStore = options.usageStore;
    this.#grantVerifier = options.grantVerifier;
    this.#delegationResolver = options.delegationResolver;
    this.#maxDelegationChainLength = options.maxDelegationChainLength;
    this.#hostCeiling = options.hostCeiling;
  }

  /**
   * Whether host policy is consulted on the decisions this authorizer makes.
   *
   * Read by {@link SharedOSKernel} so the choice is not silent: a deployment
   * that denies everything through policy is then legible in the record rather
   * than reading as a deployment where nobody was granted anything.
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
    return this.#decide(authority, ceiling, capabilityIntersectsCeiling, false, options.now);
  }

  /**
   * Steps 4 through 11 of the permission model, in that order.
   *
   * The grants decide first and the host ceiling decides last, on what the
   * grants allowed. That order is what makes a ceiling unable to widen: it is
   * only ever shown a decision that already matched a grant.
   */
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
  ): Promise<AuthorizationDecision> {
    const context = structuredClone(authority.context);
    const decision = await this.#decideOnGrants(
      context,
      authority,
      request,
      matches,
      consume,
      operationNow,
    );
    return decision.allowed ? this.#narrow(decision, request, context) : decision;
  }

  /**
   * The host ceiling, applied to a decision the grants already allowed.
   *
   * A denial is never shown to it, and the decision it may hand back is the one
   * it was given. A returned allow that does not carry the `matchedGrantId` it
   * was handed is a malfunction rather than a wider decision, and fails closed
   * as `host_policy_unavailable` -- the same code a throw produces, because both
   * mean the port could not be relied on. That is what makes widening
   * inexpressible instead of merely forbidden.
   */
  #narrow(
    decision: AllowedDecision,
    request: AuthorizationRequest,
    context: AccessContext,
  ): AllowedDecision | DeniedDecision {
    if (this.#hostCeiling === undefined) {
      return decision;
    }

    // Reading the verdict is inside the try as well as producing it: a host
    // outside TypeScript can answer with nothing at all, and a throw on the
    // property access is the port failing, not the kernel.
    try {
      const verdict: HostCeilingVerdict = this.#hostCeiling.narrow(
        decision,
        structuredClone(request),
        structuredClone(context),
      );
      if (verdict.allowed === false) {
        return {
          allowed: false,
          reasonCode: "host_policy_denied",
          ...(verdict.metadata === undefined ? {} : { metadata: verdict.metadata }),
        };
      }
      if (verdict.allowed === true) {
        return verdict.matchedGrantId === decision.matchedGrantId
          ? decision
          : deny("host_policy_unavailable");
      }
    } catch {
      return deny("host_policy_unavailable");
    }
    // Unreachable through the type, and reached only by a host that answered
    // with neither arm. That is a broken port, not a permissive one.
    return deny("host_policy_unavailable");
  }

  async #decideOnGrants(
    context: AccessContext,
    authority: ResolvedAuthority,
    request: AuthorizationRequest,
    matches: (
      capability: Capability,
      request: AuthorizationRequest,
      context: AccessContext,
    ) => boolean,
    consume: boolean,
    operationNow: string | undefined,
  ): Promise<AllowedDecision | DeniedDecision> {
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

    if (foundExhaustedGrant) {
      return deny("grant_exhausted");
    }

    // The one denial that describes what would have satisfied it. A grant
    // exists for `grant_exhausted` and issuing another is not the remedy, and an
    // infrastructure denial names a fact SharedOS could not establish; only
    // "nothing granted this" is answered by authority that does not yet exist.
    // See ADR 0019.
    const requiredCapability = await describeRequiredCapability(context, request);
    return {
      ...deny("no_matching_grant"),
      ...(requiredCapability === undefined ? {} : { requiredCapability }),
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

function allow(grantId: string): AllowedDecision {
  return { allowed: true, reasonCode: "allowed", matchedGrantId: grantId };
}

function deny(
  reasonCode: Exclude<AuthorizationReasonCode, "allowed">,
  metadata?: JsonObject,
): DeniedDecision {
  return { allowed: false, reasonCode, ...(metadata === undefined ? {} : { metadata }) };
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
