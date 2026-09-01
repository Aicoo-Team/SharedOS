import type {
  PublishedToolAnnotations,
  PublishedToolDefinition,
  PublishedToolMetadata,
  SharedOSToolCatalog,
  ToolDefinition,
} from "@aicoo/sharedos-contracts";
import { PublishedToolDefinitionSchema } from "@aicoo/sharedos-contracts";

import { canonicalJson, sha256Hex } from "./hashing.js";
import { deepFreeze } from "./internal.js";

/**
 * The fields of a published tool that `catalogHash` is computed over.
 *
 * This list is the contract, not an implementation detail. Two hosts can both
 * claim to compute `catalogHash` and disagree on every value unless
 * participation is fixed somewhere, so it is fixed here and asserted by
 * {@link publishToolDefinition}, which cannot emit a key outside it.
 *
 * What is deliberately absent is everything that varies with *how* a catalogue
 * was delivered rather than *what* it contains: `executionId`, the harness-side
 * alias, the runtime name, the transport. Two harnesses handed the same tools
 * must hash identically, or the hash cannot be used to prove they were compared
 * on equal terms -- which is the only reason it exists.
 */
export const CATALOG_HASH_FIELDS: readonly string[] = Object.freeze([
  "annotations",
  "description",
  "inputSchema",
  "metadata",
  "name",
  "outputSchema",
]);

/**
 * Project one registered tool into what a harness is allowed to see.
 *
 * Everything authorization-bearing is dropped rather than redacted:
 * `requiredCapability`, `resolveRequirement`, and the handler itself never leave
 * SharedOS. A harness therefore cannot infer what authority a call would need,
 * and could not use the answer if it could -- the requirement is re-resolved
 * from the *arguments* at invocation time, so two calls to one published tool
 * routinely need different authority.
 *
 * `readWrite` is a required classification on every registration, so
 * `readOnlyHint` is always determined. `destructiveHint` and `idempotentHint`
 * appear only when the registration stated them: emitting a guess would put an
 * unfixed value into `catalogHash`.
 */
export function publishToolDefinition(definition: ToolDefinition): PublishedToolDefinition {
  const annotations: PublishedToolAnnotations = {
    readOnlyHint: definition.annotations?.readOnly ?? definition.readWrite === "read",
    ...(definition.annotations?.destructive === undefined
      ? {}
      : { destructiveHint: definition.annotations.destructive }),
    ...(definition.annotations?.idempotent === undefined
      ? {}
      : { idempotentHint: definition.annotations.idempotent }),
  };
  const metadata: PublishedToolMetadata = {
    namespace: definition.namespace,
    source: definition.source,
  };

  const published: PublishedToolDefinition = {
    name: definition.name,
    description: definition.description,
    inputSchema: definition.inputSchema,
    ...(definition.outputSchema === undefined ? {} : { outputSchema: definition.outputSchema }),
    annotations,
    metadata,
  };

  const parsed = PublishedToolDefinitionSchema.safeParse(published);
  if (!parsed.success) {
    throw new TypeError("published tool projection does not match the SharedOS contract");
  }
  return deepFreeze(parsed.data);
}

/**
 * Project a permission-filtered catalogue, in canonical order.
 *
 * Sorting is part of the projection rather than of the hash, so the tools a
 * harness receives and the tools that were hashed are in the same order and can
 * be compared by eye. Duplicate names are rejected here: a catalogue that
 * publishes one name twice has already lost the property the whole boundary
 * rests on, that a name identifies exactly one operation.
 */
export function publishToolCatalog(
  definitions: readonly ToolDefinition[],
): readonly PublishedToolDefinition[] {
  const published = definitions.map((definition) => publishToolDefinition(definition));
  const seen = new Set<string>();
  for (const tool of published) {
    if (seen.has(tool.name)) {
      throw new TypeError(`published catalogue contains a duplicate tool name: ${tool.name}`);
    }
    seen.add(tool.name);
  }
  return Object.freeze(
    published.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0)),
  );
}

/**
 * A stable identifier for one effective, model-facing tool catalogue.
 *
 *     catalogHash = SHA-256(canonical JSON(tools sorted by canonical name))
 *
 * Canonicalisation is {@link canonicalJson}: object keys sorted, no incidental
 * whitespace, so a host that serialises its schemas in a different key order
 * still produces the same hash. Field participation is
 * {@link CATALOG_HASH_FIELDS}.
 *
 * The hash answers one question -- were these harnesses given the same semantic
 * tool set? -- and answers it against schema drift, a missing tool, a renamed
 * tool, and a stale discovery cache alike.
 */
export async function catalogHash(tools: readonly PublishedToolDefinition[]): Promise<string> {
  const sorted = [...tools].sort((left, right) =>
    left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
  );
  return sha256Hex(canonicalJson(sorted));
}

/** The hash as an experiment record renders it: algorithm-qualified. */
export function formatCatalogHash(hash: string): string {
  return `sha256:${hash}`;
}

export interface ToolCatalogOptions {
  readonly executionId: string;
}

/** Build the per-turn catalogue a harness is served, hash included. */
export async function buildToolCatalog(
  definitions: readonly ToolDefinition[],
  options: ToolCatalogOptions,
): Promise<SharedOSToolCatalog> {
  const tools = publishToolCatalog(definitions);
  return deepFreeze({
    version: "1" as const,
    executionId: options.executionId,
    catalogHash: await catalogHash(tools),
    tools: [...tools],
  });
}

/**
 * The canonical name rewritten for a transport that cannot carry a dot.
 *
 * Provided because harnesses do this anyway and an unowned rewrite is worse than
 * an owned one. It is transport presentation only: it is not the tool's
 * identity, it is not what `catalogHash` covers, and nothing may authorize
 * against it. SharedOS maps a harness alias back to the canonical name before
 * the call reaches the kernel; the alias may be recorded diagnostically, and
 * that is the whole of its role.
 */
export function portableToolName(name: string): string {
  return name.replace(/\./gu, "_");
}
