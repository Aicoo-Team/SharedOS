import type { ResourceReach, ToolDefinition } from "@aicoo/sharedos-contracts";

/**
 * The part of a reach a catalogue of tools can act on.
 *
 * Grant reach says where an actor is authorized. A runtime acts only through
 * the tools it was handed, so for a turn the two are not the same: a place no
 * offered tool operates on is not somewhere the turn can work, and naming it
 * would send a model at a wall. This keeps the entries whose namespace some
 * offered tool requires a capability over, and drops the rest.
 *
 * Keyed on the *resource* namespace a tool operates on, not on the tool's own
 * namespace. They are different vocabularies -- the message tool lives in
 * `messages` and operates on `sharedos.messaging` -- so a filter on
 * `AccessContext.enabledToolNamespaces` would drop reach the turn has and keep
 * reach it does not. Nothing is narrowed within an entry: a tool's
 * `requiredCapability.action` is a discovery ceiling, not the action a call is
 * authorized against, so actions are left as the grants state them.
 *
 * Descriptive, never permissive: every call is authorized independently, so an
 * entry this keeps is not a permission and an entry it drops was not a refusal.
 */
export function reachThroughTools(
  reach: readonly ResourceReach[],
  tools: readonly ToolDefinition[],
): readonly ResourceReach[] {
  const namespaces = new Set(
    tools.map(({ requiredCapability }) => requiredCapability.resource.namespace),
  );
  return reach
    .filter((entry) => namespaces.has(entry.namespace))
    .map((entry) => structuredClone(entry));
}
