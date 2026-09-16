/**
 * One signal for a turn: the host's, if it gave one, with the turn's own
 * deadline and the executor's own abort folded in, and a `dispose` that
 * releases both once the turn is over.
 */
export function createAbortController(
  parent: AbortSignal | undefined,
  timeoutMs: number | undefined,
): { signal: AbortSignal; abort: (reason?: unknown) => void; dispose: () => void } {
  const controller = new AbortController();
  const abortFromParent = (): void => controller.abort(parent?.reason);
  parent?.addEventListener("abort", abortFromParent, { once: true });
  if (parent?.aborted) {
    abortFromParent();
  }

  const timeout =
    timeoutMs === undefined
      ? undefined
      : setTimeout(() => controller.abort(new Error("turn timeout")), timeoutMs);

  return {
    signal: controller.signal,
    abort: (reason?: unknown): void => controller.abort(reason),
    dispose: (): void => {
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
      parent?.removeEventListener("abort", abortFromParent);
    },
  };
}
