/**
 * One robot delegates part of its mandate to another, and cannot pass on more
 * than it holds.
 *
 * Everything here is the real kernel. The only thing this file invents is the
 * vocabulary: `fleet/cell-3/arm-1` is a resource path and `grip` is an action,
 * exactly as `files/Memory/notes.md` and `read` are elsewhere. SharedOS does
 * not know what an arm is, which is the point — a host names its own resources
 * and the same authorization rules apply.
 *
 * Run: pnpm example:fleet-delegation
 */
import type { AccessContext, CapabilityGrant, ResourceRef } from "@aicoo/sharedos-contracts";
import {
  CapabilityAuthorizer,
  deriveGrant,
  type DelegationChainResolver,
  type ResolvedAuthority,
} from "@aicoo/sharedos-core";

const NOW = "2026-08-20T09:00:00.000Z";
const SHIFT_END = "2026-08-20T17:00:00.000Z";

const OPERATOR = { kind: "human", userId: "operator-lin" } as const;
const ROBOT_A = { kind: "agent", agentId: "robot-a" } as const;
const ROBOT_B = { kind: "agent", agentId: "robot-b" } as const;

/**
 * The operator's ledger, standing in for a host's grant store. Ancestors are
 * read back from here at every decision and never from the grant presented, so
 * revoking a parent below takes effect without rewriting the child.
 */
const ledger = new Map<string, CapabilityGrant>();
const delegationResolver: DelegationChainResolver = {
  async resolve(namespaceId, grantId) {
    const grant = ledger.get(grantId);
    return grant?.namespaceId === namespaceId ? grant : undefined;
  },
};
const authorizer = new CapabilityAuthorizer({ delegationResolver });

function record(grant: CapabilityGrant): CapabilityGrant {
  ledger.set(grant.id, grant);
  return grant;
}

function arm(id: string): ResourceRef {
  return { namespace: "fleet", path: ["cell-3", id], owner: OPERATOR };
}

/**
 * Authority as a kernel would hand it to the authorizer: a context that carries
 * no grants, plus the set a trusted source answered with for that turn.
 */
function turn(actor: AccessContext["actor"], authority: AccessContext["authority"]) {
  const context: AccessContext = {
    namespaceId: "line-7",
    enabledToolNamespaces: [],
    actor,
    authority,
    owner: OPERATOR,
    purpose: "pick-and-place",
    traceId: "shift-2026-08-20",
    now: NOW,
  };
  return (grants: CapabilityGrant[]): ResolvedAuthority => ({
    context,
    grants,
    snapshot: {
      hash: grants.map(({ id }) => id).join("+"),
      grantIds: grants.map(({ id }) => id),
      grantCount: grants.length,
      loadedAt: NOW,
    },
  });
}

function describe(address: AccessContext["actor"]): string {
  switch (address.kind) {
    case "human":
      return address.userId;
    case "agent":
      return address.agentId;
    case "group":
      return address.conversationId;
    case "service":
      return address.serviceId;
  }
}

const audit: string[] = [];

async function attempt(
  label: string,
  authority: ResolvedAuthority,
  resource: ResourceRef,
  action: string,
): Promise<void> {
  const { context } = authority;
  const decision = await authorizer.authorize(authority, { resource, action });
  const verdict = decision.allowed ? "ALLOW" : "DENY ";
  const detail = decision.allowed
    ? `via ${decision.matchedGrantId}`
    : `reason ${decision.reasonCode}`;
  const target = `${resource.path.join("/")}·${action}`;

  console.log(`  ${verdict}  ${label.padEnd(46)} ${target.padEnd(24)} ${detail}`);
  audit.push(
    JSON.stringify({
      actor: context.actor,
      authority: context.authority,
      resource: { namespace: resource.namespace, path: resource.path },
      action,
      allowed: decision.allowed,
      matchedGrantId: decision.matchedGrantId ?? null,
      reasonCode: decision.reasonCode,
      traceId: context.traceId,
    }),
  );
}

async function main(): Promise<void> {
  console.log("\nSharedOS — delegation on a robot line\n");

  // 1. The operator gives robot A the whole of cell 3 until end of shift, and
  //    permission to pass some of it on exactly once.
  const toRobotA = record({
    id: "grant-shift-a",
    namespaceId: "line-7",
    subject: ROBOT_A,
    issuer: OPERATOR,
    capabilities: [
      {
        resource: { namespace: "fleet", path: ["cell-3"], owner: OPERATOR },
        actions: ["move", "grip", "release"],
        scope: "descendants",
      },
    ],
    constraints: { purposes: ["pick-and-place"], expiresAt: SHIFT_END, delegationDepth: 1 },
    issuedAt: "2026-08-20T08:00:00.000Z",
  });
  console.log("1. operator -> robot-a: cell-3/** move,grip,release until 17:00, redelegable once");

  // 2. Robot A hands robot B the gripper on arm-1 only, and only gripping.
  //    Nothing here consults a database: narrowing is decided from the parent.
  const delegation = deriveGrant(toRobotA, {
    id: "grant-a-to-b",
    subject: ROBOT_B,
    capabilities: [{ resource: arm("arm-1"), actions: ["grip"], scope: "exact" }],
    issuedAt: NOW,
  });
  if (!delegation.ok) throw new Error(`delegation refused: ${delegation.reason}`);
  const toRobotB = record(delegation.grant);
  console.log(
    `2. robot-a -> robot-b: cell-3/arm-1 grip only` +
      `  (issuer=${describe(toRobotB.issuer)}, parent=${toRobotB.parentGrantId}, ` +
      `expires ${toRobotB.constraints.expiresAt}, redelegable ${toRobotB.constraints.delegationDepth} more times)\n`,
  );

  const asB = turn(ROBOT_B, ROBOT_A);
  const bHolds = asB([toRobotB]);

  console.log("3. what robot-b tries:\n");
  await attempt("the exact thing it was given", bHolds, arm("arm-1"), "grip");
  await attempt("an action it was not given", bHolds, arm("arm-1"), "release");
  await attempt("a different arm in the same cell", bHolds, arm("arm-2"), "grip");
  await attempt(
    "a neighbouring cell (prefix, not parent)",
    bHolds,
    {
      namespace: "fleet",
      path: ["cell-30", "arm-1"],
      owner: OPERATOR,
    },
    "grip",
  );

  // 4. Two separate grants never combine into a third authority.
  const alsoMayReport = record({
    id: "grant-b-report",
    namespaceId: "line-7",
    subject: ROBOT_B,
    issuer: OPERATOR,
    capabilities: [
      {
        resource: { namespace: "fleet", path: ["cell-3", "arm-2"], owner: OPERATOR },
        actions: ["move"],
        scope: "exact",
      },
    ],
    constraints: { purposes: ["pick-and-place"] },
    issuedAt: NOW,
  });
  console.log("\n4. robot-b is separately granted: cell-3/arm-2 move\n");
  await attempt(
    "grip(arm-1) + move(arm-2) => move(arm-1)?",
    asB([toRobotB, alsoMayReport]),
    arm("arm-1"),
    "move",
  );

  // 5. Robot B tries to pass its authority further. It received depth 0.
  const onward = deriveGrant(toRobotB, {
    id: "grant-b-to-c",
    subject: { kind: "agent", agentId: "robot-c" },
    capabilities: [{ resource: arm("arm-1"), actions: ["grip"], scope: "exact" }],
    issuedAt: NOW,
  });
  console.log(
    `\n5. robot-b -> robot-c: refused at derivation, reason ${onward.ok ? "none" : onward.reason}`,
  );

  // 6. Emergency stop: revoke robot A's mandate. Robot B's grant is untouched.
  record({ ...toRobotA, revokedAt: "2026-08-20T08:45:00.000Z" });
  console.log("\n6. operator revokes robot-a's shift grant (robot-b's grant is not rewritten)\n");
  await attempt("the same call that was allowed in step 3", bHolds, arm("arm-1"), "grip");

  console.log("\n7. audit — every line reconstructable after an incident:\n");
  for (const line of audit) console.log(`  ${line}`);
  console.log("");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
