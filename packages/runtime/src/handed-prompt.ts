import type { ExecutionEvent, RuntimeEvent } from "@aicoo/sharedos-contracts";

import { announceForRecord, type RecordAnnouncement, type RuntimeHost } from "./runtime-plugin.js";

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
 * The result metadata keeps carrying the hash too. A reader takes the metadata
 * where the result has one and falls back to this event, so a record written
 * before this event existed reads exactly as it did. A turn cancelled before
 * the announcement -- while the loop's driver is still opening, or while the
 * MCP runtime is still binding its port -- carries neither and is not in its
 * column's prompt set.
 */
export const PROMPT_HANDED_EVENT = "prompt.handed";

/** What the seat was told, hashed, in the one shape every runtime records it. */
export function promptHandedEvent(promptHash: string): RuntimeEvent {
  return { type: PROMPT_HANDED_EVENT, data: { promptHash } };
}

/**
 * Announce what the seat was told, for the record only.
 *
 * A host that will not take the event does not change what the turn goes on
 * to do: the announcement is a trace, and a throw from `emit` here would end a
 * turn that had not yet started as the driver's failure. The refusal is
 * reported to the turn's `onTurnError` sink instead, unless the turn is already
 * cancelled; see {@link announceForRecord}, which the escalation announcement
 * shares.
 */
export function announcePromptHanded(
  host: Pick<RuntimeHost, "emit">,
  promptHash: string,
  announcement: RecordAnnouncement,
): void {
  announceForRecord(host, promptHandedEvent(promptHash), announcement);
}

/**
 * The hash a `prompt.handed` announcement carried, read back off the record.
 *
 * The envelope wraps every runtime event as a `runtime.event` execution event
 * whose `data` holds the runtime's own `type` and `data`; this is the one place
 * that layout is spelled, so a reader never decodes it by hand. Anything that
 * is not that shape, or carries no string hash, reads as no announcement.
 */
export function promptHandedHash(event: ExecutionEvent): string | undefined {
  if (event.type !== "runtime.event" || !isRecord(event.data)) {
    return undefined;
  }
  if (event.data["type"] !== PROMPT_HANDED_EVENT || !isRecord(event.data["data"])) {
    return undefined;
  }
  const promptHash = event.data["data"]["promptHash"];
  return typeof promptHash === "string" ? promptHash : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
