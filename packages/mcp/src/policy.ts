import type { ToolPolicy } from "@aicoo/sharedos-contracts";
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

/** A content identifier for the declared policy, for the run's `policyHash`. */
export function toolPolicyHash(policy: ToolPolicy): Promise<string> {
  return hashJson(parseToolPolicy(policy));
}
