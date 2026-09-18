import { z } from "zod";

import type { HarnessStep } from "./harness.js";

/**
 * What the vendor wire formats share: assistant content as an array of typed
 * blocks, of which `text` is prose and one vendor-named kind is a tool call.
 *
 * Everything that varies stays with the vendor: the tool shape it is shown,
 * how arguments are carried, the envelope around the blocks, the vocabulary of
 * a failure, and how a result is encoded back.
 */

/** Assistant prose. Kept as a `message` step so a terminal frame with no text still has output. */
export const TextBlockSchema = z.object({ type: z.literal("text"), text: z.string() });

/**
 * Any block this adapter does not read: thinking, images, a vendor's own.
 * Accepted so one unfamiliar block does not fail the whole message.
 */
export const UnknownBlockSchema = z.object({ type: z.string() }).passthrough();

/**
 * The steps one assistant message's content means, in order.
 *
 * `toolCall` reads the vendor's own call block and returns nothing for any
 * other. A vendor whose calls arrive in a frame of their own passes none, and
 * only the prose is read: reading the call here as well would issue it twice.
 */
export function contentBlockSteps(
  content: readonly { readonly type: string }[],
  toolCall?: (block: unknown) => HarnessStep | undefined,
): HarnessStep[] {
  const steps: HarnessStep[] = [];
  for (const block of content) {
    const text = TextBlockSchema.safeParse(block);
    if (text.success) {
      steps.push({ type: "message", text: text.data.text });
      continue;
    }
    const call = toolCall?.(block);
    if (call !== undefined) {
      steps.push(call);
    }
  }
  return steps;
}
