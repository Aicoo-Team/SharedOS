import type { AccessContext, ToolNamespace, ToolNamespaceUpdate } from "@aicoo/sharedos-contracts";
import { EnabledToolNamespacesSchema, ToolNamespaceUpdateSchema } from "@aicoo/sharedos-contracts";

/**
 * Host-owned persistence and product-policy boundary for namespace settings.
 *
 * Implementations must apply a patch atomically against fresh state and return
 * the authoritative effective selection. They may narrow the result according
 * to organization policy, but must never widen it beyond trusted host policy.
 */
export interface ToolNamespaceSettingsStore {
  applyUpdate(
    context: AccessContext,
    update: ToolNamespaceUpdate,
    signal: AbortSignal,
  ): Promise<readonly ToolNamespace[]>;
}

/** Apply the standard idempotent patch semantics used by host stores. */
export function applyToolNamespaceUpdate(
  current: readonly ToolNamespace[],
  update: ToolNamespaceUpdate,
): ToolNamespace[] {
  const parsedCurrent = EnabledToolNamespacesSchema.parse([...current]);
  const parsedUpdate = ToolNamespaceUpdateSchema.parse(structuredClone(update));
  const enabled = new Set(parsedCurrent);

  for (const namespace of parsedUpdate.enable ?? []) {
    enabled.add(namespace);
  }
  for (const namespace of parsedUpdate.disable ?? []) {
    enabled.delete(namespace);
  }

  return [...enabled].sort((left, right) => left.localeCompare(right));
}
