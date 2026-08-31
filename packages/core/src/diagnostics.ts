import type { ResourceRef } from "@aicoo/sharedos-contracts";

/**
 * Call one diagnostic sink without letting it change what happened.
 *
 * Exported deliberately, and it is the guard rather than a convenience: a host
 * or package offering a hook of this shape should not reimplement the swallow
 * rule, because two implementations of one promise is how it stops being true
 * in one of them. `@aicoo/sharedos-runtime` uses it for exactly that reason.
 *
 * The guard behind the synchronous "here is the error we contained" hooks --
 * `SharedOSKernelOptions.onProviderError` and the runtime's `onTurnError` --
 * generic over the context each one carries so there is one implementation of
 * the rule rather than one per hook. A sink that throws is swallowed: a
 * diagnostic that can turn one failure into two is a liability, and a host would
 * be right to weigh installing it against the risk. There is no risk.
 *
 * Synchronous is the reason `onAuditError` is not among them and keeps a guard
 * of its own. That one is awaited because it fires *after* the side effect,
 * where there is nothing left to hold up; every sink called through here fires
 * mid-flight, with a result still to construct and return, so awaiting a host's
 * logger would put its latency on the path of every failed call.
 */
export function reportContainedError<Context>(
  report: ((error: unknown, context: Context) => void) | undefined,
  error: unknown,
  context: Context,
): void {
  if (report === undefined) {
    return;
  }
  try {
    report(error, context);
  } catch {
    // Deliberately empty; see the docblock above.
  }
}

/** Which of the kernel's mediated operations a contained throw happened under. */
export type ProviderErrorKind = "tool" | "tool_catalog" | "resource" | "message" | "policy";

/**
 * What one contained throw was, in the kernel's own terms.
 *
 * `kind` is what lets a single hook stay honest across a growing set of ports.
 * A host that wants to route a transport failure differently from a tool's
 * branches on it, and gets that without SharedOS having guessed in advance which
 * splits a host would want; a fifth port added later is covered by the hook
 * every host already installed, where a fifth *option* would be one nobody
 * passes.
 *
 * `reasonCode` closes the loop, and is most of the value here. It is the code
 * the kernel returned in place of the throw, and the same code the matching
 * audit event carries under `reason`, so a host can join its own log line to
 * audit without correlating on timing. Usually it is also what the agent was
 * told; the exception is a transport failure under the message-request tool,
 * where audit records `message_delivery_failed` and the tool result says
 * `message_request_not_accepted`. Both records carry the same `operationId`.
 *
 * `policy` is the one kind that is not an operation: it is a `HostCeiling` that
 * threw while narrowing a decision, answered with `host_policy_unavailable`.
 * The ceiling is installed on `CapabilityAuthorizer` rather than on the kernel,
 * so a host that wants these reports passes the same function to both --
 * `CapabilityAuthorizerOptions.onProviderError` and
 * `SharedOSKernelOptions.onProviderError` -- which is why they share one shape
 * rather than the ceiling growing a hook of its own.
 *
 * `kind` follows the *entry point*, not the port, where the two differ. A
 * `MessageCapabilityResolver` that throws is `message` when the turn called
 * `sendMessage` and `tool` when it went through the message-request tool, since
 * that is a tool call resolving its requirement. A host watching one port
 * should match on `reasonCode`, which is stable, rather than on `kind` alone.
 *
 * The rest is what the kernel knew at the point it caught: `traceId` and
 * `namespaceId` always, and whichever of the operation's identifiers exist on
 * that path. A message resolved outside a tool call names neither a call nor a
 * tool; a resource names no tool.
 */
export interface ProviderErrorContext {
  readonly kind: ProviderErrorKind;
  /** The code the kernel returned instead. */
  readonly reasonCode: string;
  readonly traceId: string;
  readonly namespaceId: string;
  /** The call id, where the path has one. */
  readonly operationId?: string;
  readonly tool?: string;
  readonly resource?: ResourceRef;
  readonly action?: string;
}

/**
 * A host's sink for a throw the kernel contained rather than propagated.
 *
 * A provider, tool handler, transport, or router that throws is answered with a
 * fixed reason code and a fixed message: the operation fails closed and the
 * agent is told a bounded fact about it. That is the right thing to put on the
 * wire and the wrong place to put a stack, so the error itself comes here for a
 * host's own logs, as thrown.
 *
 * One case is wrapped rather than as-thrown, and it is worth knowing which. When
 * a `ContextToolProvider`'s `listTools` throws, the kernel replaces it with one
 * catalogue-failure sentence -- every caller of the catalogue reads that one --
 * and the provider's error becomes its `cause`. A `tool_catalog` report from any
 * other origin, such as a returned handler the registry refuses, carries that
 * error unwrapped and has no `cause`. Log `error` and let a formatter walk it;
 * do not read `cause` on its own.
 *
 * It reaches nothing else. Audit records the outcome and the reason code and has
 * never carried call data; a thrown message may contain arguments, rows, or
 * credentials the thrower had in scope, and routing it into an audit sink or a
 * protocol error would be a disclosure the rest of the design spends its effort
 * preventing.
 *
 * Observational. One that throws is ignored, and a kernel with none installed
 * takes the same decisions. A cancelled operation is not reported: every site
 * that awaits a host port re-throws the abort ahead of the containment, and the
 * three that do not -- an argument parser, a requirement resolver, a message
 * capability resolver -- wrap synchronous code that is never handed the signal,
 * so an abort cannot be what made them throw. A caller that stopped the work is
 * not a defect to diagnose.
 */
export type ProviderErrorReporter = (error: unknown, operation: ProviderErrorContext) => void;
