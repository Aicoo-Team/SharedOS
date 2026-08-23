import type { ToolClass, ToolPolicy } from "@aicoo/sharedos-contracts";
import { ToolPolicySchema } from "@aicoo/sharedos-contracts";
import { hashJson } from "@aicoo/sharedos-core";

import { SHAREDOS_MCP_SERVER_NAME } from "./server.js";

/**
 * What a run's tool surface actually was.
 *
 * A conformance result reads very differently depending on the answer. "The
 * kernel refused every violation" means one thing when the managed catalogue was
 * the only way to have an effect, and almost nothing when the harness also had a
 * shell. The policy is declared per run so a reader never has to infer which of
 * those they are looking at, and {@link parseToolPolicy} refuses the combination
 * that would let a run claim the first while being the second.
 */
export interface DeclareToolPolicyOptions {
  readonly mode?: ToolPolicy["mode"];
  /** SharedOS MCP endpoints. Defaults to the one this package serves. */
  readonly managedMcp?: readonly string[];
  /** The harness's own tools, which SharedOS never sees. */
  readonly harnessLocal?: readonly string[];
  /** MCP servers the harness was configured with independently. */
  readonly externalDirect?: readonly string[];
}

export function declareToolPolicy(options: DeclareToolPolicyOptions = {}): ToolPolicy {
  const externalDirect = [...(options.externalDirect ?? [])];
  return parseToolPolicy({
    mode: options.mode ?? (externalDirect.length === 0 ? "strict" : "hybrid"),
    managedMcp: [...(options.managedMcp ?? [SHAREDOS_MCP_SERVER_NAME])],
    harnessLocal: [...(options.harnessLocal ?? [])],
    externalDirect,
  });
}

/**
 * The strictest policy a live harness can honestly declare.
 *
 * Not the empty policy: every CLI in scope keeps some tools it will not give up,
 * and pretending otherwise would be the exact misdeclaration this type exists to
 * prevent. What `strict` asserts is narrower and checkable -- that no
 * independently configured external server was reachable, so every effect
 * outside the harness's own sandbox went through SharedOS.
 */
export function strictToolPolicy(harnessLocal: readonly string[] = []): ToolPolicy {
  return declareToolPolicy({ mode: "strict", harnessLocal });
}

export function parseToolPolicy(value: unknown): ToolPolicy {
  const parsed = ToolPolicySchema.safeParse(value);
  if (!parsed.success) {
    throw new TypeError(
      `tool policy is not valid: ${parsed.error.issues[0]?.message ?? "unknown"}`,
    );
  }
  return Object.freeze({
    mode: parsed.data.mode,
    managedMcp: Object.freeze([...parsed.data.managedMcp]),
    harnessLocal: Object.freeze([...parsed.data.harnessLocal]),
    externalDirect: Object.freeze([...parsed.data.externalDirect]),
  }) as ToolPolicy;
}

/**
 * Which class a tool the harness called belongs to.
 *
 * `managed` is decided by presence in the published catalogue rather than by the
 * policy's own lists, because the catalogue is the fact and the policy is the
 * declaration. A name in neither is `undefined`: an unclassified tool, which is
 * a gap in the declaration and is reported as one rather than being quietly
 * counted as harness-local.
 */
export function classifyTool(
  policy: ToolPolicy,
  publishedNames: readonly string[],
  tool: string,
): ToolClass | undefined {
  if (publishedNames.includes(tool)) {
    return "managed";
  }
  if (policy.harnessLocal.includes(tool)) {
    return "harness_local";
  }
  if (policy.externalDirect.some((server) => tool.startsWith(`${server}.`))) {
    return "external_direct";
  }
  return undefined;
}

/** A content identifier for the declared policy, for the run's `policyHash`. */
export function toolPolicyHash(policy: ToolPolicy): Promise<string> {
  return hashJson(parseToolPolicy(policy));
}
