import type { RuntimeEvent } from "@aicoo/sharedos-contracts";

/**
 * The runtime event a runtime announces what it told the seat under.
 *
 * A record carries `promptHash` on the turn's result metadata, and a result is
 * the one thing a cancelled turn does not have: the plugin threw at the abort,
 * so the envelope built the `cancelled` result from its own provenance and
 * nothing the plugin had computed reached it. The prompt-set hash then folded
 * one entry fewer for that column, and a reader could not tell that column's
 * moved hash from a reworded prompt -- the exact confusion the hash exists to
 * remove. So what the seat was told is also announced through
 * `RuntimeHost.emit` the moment it is composed, before the model or harness is
 * sent anything, and lands in the record as a `runtime.event` whatever the turn
 * then does. `ExecutionResult.events` survives cancellation; metadata does not.
 *
 * The result metadata keeps carrying the hash too. A reader prefers the
 * metadata where both are present and falls back to this event, so a record
 * written before this event existed reads exactly as it did.
 */
export const PROMPT_HANDED_EVENT = "prompt.handed";

/** What the seat was told, hashed, in the one shape every runtime records it. */
export function promptHandedEvent(promptHash: string): RuntimeEvent {
  return { type: PROMPT_HANDED_EVENT, data: { promptHash } };
}
