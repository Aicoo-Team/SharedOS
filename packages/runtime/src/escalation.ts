import { JsonObjectSchema, type JsonObject, type ToolDefinition } from "@aicoo/sharedos-contracts";

export const ESCALATION_TOOL_NAMESPACE = "sharedos";
export const ESCALATION_TOOL_NAME = "sharedos.escalate";
/** The resource an escalation grant is written over. */
export const ESCALATION_RESOURCE_PATH: readonly string[] = Object.freeze(["escalation"]);
export const ESCALATION_ACTION = "request";

/**
 * The affordance a driver offers so escalation can be chosen rather than inferred.
 *
 * A turn that ends by asking a human to decide is a claim about SharedOS -- the
 * request is recorded, audited, and grants nothing while it is pending -- and
 * until now no driver inside the standard loop could make it. Adding the
 * decision variant alone would not have been enough: the model still needs a way
 * to *say* it, and reading intent out of prose ("I should ask a human") would
 * make the row measure a phrase rather than a choice.
 *
 * So it is published as a tool. It is permission-filtered like every other tool,
 * which is the point -- escalation is an affordance a host grants, and an agent
 * with no grant over it does not see it in the catalogue at all.
 *
 * It is nonetheless never invoked. A driver whose turn was offered the tool
 * recognises the name and returns an escalate decision instead of a tool call,
 * so nothing reaches the kernel; see {@link escalationRequest}. The kernel-side
 * handler a host registers exists to put the tool in the catalogue and to fail
 * loudly if some driver forwards it anyway, because a call that quietly
 * succeeded would record an escalation the envelope never terminated on.
 *
 * The filtering is what gates the affordance, and a driver has to honour it
 * itself: ending a turn on the name skips the envelope, and with it the
 * envelope's check that the tool was published to this agent. So every driver
 * that recognises the name reads its turn's catalogue first, and a name the
 * catalogue does not hold is passed through to be refused `tool_unavailable`
 * like any other unpublished tool.
 */
export const ESCALATION_TOOL_DEFINITION: ToolDefinition = Object.freeze({
  name: ESCALATION_TOOL_NAME,
  description:
    "End this turn by asking a human to decide. Use it when the task needs authority you do not hold. " +
    "The turn stops, the request is recorded for a reviewer, and nothing is granted in the meantime.",
  namespace: ESCALATION_TOOL_NAMESPACE,
  source: "sharedos",
  readWrite: "read",
  inputSchema: {
    type: "object",
    properties: {
      reason: {
        type: "string",
        minLength: 1,
        maxLength: 512,
        description: "What needs deciding, and why this turn cannot decide it.",
      },
    },
    required: ["reason"],
    additionalProperties: false,
  },
  requiredCapability: {
    resource: { namespace: ESCALATION_TOOL_NAMESPACE, path: [...ESCALATION_RESOURCE_PATH] },
    action: ESCALATION_ACTION,
  },
  annotations: { readOnly: true },
});

/**
 * Read an escalation out of a call a driver is about to make, if that is what it is.
 *
 * Returns the reason when the call names the affordance and carries a usable
 * one, and `undefined` for anything else -- which a driver passes on unchanged,
 * so a tool that merely resembles this one is still re-authorized by the kernel
 * like any other.
 *
 * This recognises the name and nothing else. Whether the turn was offered the
 * tool is the caller's check to make, from its own `RuntimeTurnRequest.tools`,
 * before asking; a caller that honours the name unconditionally has given
 * every agent the affordance regardless of grant.
 *
 * A call that names the affordance with unreadable arguments still escalates,
 * under a reason saying so. The alternative is to forward it to a kernel that
 * will refuse it, which turns "the driver asked for a human" into "the agent
 * made a malformed call" -- the wrong record of what happened.
 */
export function escalationRequest(tool: string, arguments_: unknown): string | undefined {
  if (tool !== ESCALATION_TOOL_NAME) {
    return undefined;
  }
  const object = JsonObjectSchema.safeParse(arguments_);
  const reason = object.success ? escalationReason(object.data["reason"]) : undefined;
  return reason ?? "the turn asked for a human decision without saying what needs deciding";
}

/** The arguments an escalation is requested with, for a driver writing the call. */
export function escalationArguments(reason: string): JsonObject {
  return { reason };
}

/**
 * A reason string bounded exactly as `RuntimeTurnOutcome`'s is.
 *
 * Checked here rather than with a schema because this package carries no
 * validator of its own; the bounds are the contract's and are restated, not
 * loosened, so a decision that parses here still parses as an outcome.
 */
export function escalationReason(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 || trimmed.length > 512 ? undefined : trimmed;
}
