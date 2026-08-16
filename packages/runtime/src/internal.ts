import type { ProtocolError } from "@sharedos/contracts";

export function protocolError(code: string, message: string, retryable = false): ProtocolError {
  return { code, message, retryable };
}

export function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  for (const child of Object.values(value)) {
    deepFreeze(child);
  }
  return Object.freeze(value);
}

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

export function raceWithAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(signal.reason ?? new Error("operation aborted"));
  }

  return new Promise<T>((resolve, reject) => {
    const abort = (): void => reject(signal.reason ?? new Error("operation aborted"));
    signal.addEventListener("abort", abort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
  });
}
