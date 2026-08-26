import { canonicalJson, hashJson, sha256Hex } from "@aicoo/sharedos-core";

import type { ContentHash } from "./record.js";

export { canonicalJson, hashJson, sha256Hex };

/** Content identifier for any JSON-safe value, stable across key ordering. */
export async function contentHash(value: unknown): Promise<ContentHash> {
  return hashJson(value);
}

export interface ExperimentHashInput {
  /** The frozen, declarative experiment specification. */
  readonly spec: unknown;
  /** The world that specification materialised. */
  readonly world: unknown;
  /** The evaluator that will score runs of this specification. */
  readonly evaluator: unknown;
  /** Policy or configuration in force, if it is versioned separately. */
  readonly policy?: unknown;
}

export interface ExperimentHashes {
  readonly specHash: ContentHash;
  readonly worldHash: ContentHash;
  readonly evaluatorHash: ContentHash;
  readonly policyHash: ContentHash;
}

/**
 * Hash the inputs of one experiment.
 *
 * Spec and world are hashed separately on purpose. A specification can be
 * identical while its materialisation is not, and only the world hash answers
 * "is this the same world I ran against last time".
 */
export async function hashExperimentInputs(input: ExperimentHashInput): Promise<ExperimentHashes> {
  const [specHash, worldHash, evaluatorHash, policyHash] = await Promise.all([
    contentHash(input.spec),
    contentHash(input.world),
    contentHash(input.evaluator),
    contentHash(input.policy ?? null),
  ]);
  return { specHash, worldHash, evaluatorHash, policyHash };
}

export type ReproducibilityStatus = "identical" | "world_differs" | "spec_differs";

export interface ReproducibilityCheck {
  readonly status: ReproducibilityStatus;
  readonly comparable: boolean;
  readonly detail: string;
}

/**
 * Decide whether two materialisations may be compared at all.
 *
 * A differing spec means the runs answer different questions. A matching spec
 * with a differing world means materialisation is not deterministic, which
 * invalidates any comparison of agent behaviour between them.
 */
export function compareReproducibility(
  expected: Pick<ExperimentHashes, "specHash" | "worldHash">,
  actual: Pick<ExperimentHashes, "specHash" | "worldHash">,
): ReproducibilityCheck {
  if (expected.specHash !== actual.specHash) {
    return {
      status: "spec_differs",
      comparable: false,
      detail: "The two runs were built from different experiment specifications.",
    };
  }
  if (expected.worldHash !== actual.worldHash) {
    return {
      status: "world_differs",
      comparable: false,
      detail:
        "One specification materialised two different worlds; materialisation is not deterministic.",
    };
  }
  return {
    status: "identical",
    comparable: true,
    detail: "Same specification and same materialised world.",
  };
}
