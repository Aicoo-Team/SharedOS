/**
 * Monotonic measurement of what SharedOS itself costs, kept apart from the
 * clock a record is written with.
 *
 * The two clocks answer different questions and cannot be the same clock. A
 * record needs an instant a reader can compare across machines, so it carries
 * ISO strings; subtracting two of those yields whole milliseconds from a source
 * a host is free to move backwards, which is not a cost measurement. A cost
 * measurement needs a monotonic reading in fractional milliseconds, which is
 * meaningless written into a record because it names no instant at all.
 *
 * So there is a second clock, and it is read only when a host has installed a
 * sink. With none installed nothing here is entered: `performance.now()` is
 * never read, no attribute object is allocated, and a run produces records
 * byte-identical to a run of the same code with this module absent. That is
 * what lets the conformance suite stay deterministic -- it freezes the record
 * clock and installs no sink -- while the same enforcement paths stay
 * measurable by a benchmark that installs one.
 *
 * Spans are reported, never stored. SharedOS does not accumulate them, does not
 * aggregate them, and holds no benchmark state; a sink is a host object and
 * whatever it does with a span is the host's business.
 */

/**
 * What a span may say about itself.
 *
 * Identifiers, tool names, and outcomes. Never arguments, never results, never
 * payloads -- the same redaction rule the audit trail follows, for the same
 * reason: a measurement sink is not an authorized reader of anything a call
 * carried, and a span that leaked one would be a disclosure channel opened by
 * turning measurement on.
 */
export type SpanAttributes = Readonly<Record<string, string | number | boolean>>;

/** One completed span of SharedOS-owned work. */
export interface Span {
  readonly name: string;
  /** Monotonic duration in fractional milliseconds. */
  readonly durationMs: number;
  readonly attributes: SpanAttributes;
}

/**
 * Where completed spans are reported.
 *
 * Synchronous and returning nothing, so a sink cannot delay the operation it is
 * measuring or change what the operation returns. A sink that throws is
 * ignored: measurement is an observation, and an observation that could fail an
 * authorization decision would be a new way for a turn to be denied.
 */
export interface SpanSink {
  record(span: Span): void;
}

/**
 * The handle an operation uses to say what it turned out to be.
 *
 * Attributes are set from inside the measured operation rather than derived
 * from its return value, because the facts worth recording are not all in the
 * return: the call id an MCP server minted, the refusal code a path took, the
 * boundary that answered. Setting one on a span nobody is recording is a no-op.
 */
export interface SpanScope {
  set(key: string, value: string | number | boolean): void;
}

const IGNORED_SCOPE: SpanScope = Object.freeze({ set: () => undefined });

/**
 * Run an operation, and report how long the part SharedOS owns took.
 *
 * With no sink this is one comparison and a direct call: `operation` is invoked
 * and its own promise handed back untouched, so an uninstrumented host pays
 * nothing for the call sites existing.
 *
 * That property is the reason `operation` must be an ordinary arrow that
 * *returns* a promise rather than an `async` one that awaits inside. An async
 * callback allocates a second promise and two microtask hops on every call,
 * measured or not, and eight of those on the path of one tool call is a real
 * cost charged to hosts that never asked to be measured. Attributes only
 * knowable from the result go to `describe`, which runs solely when there is a
 * sink to report to.
 *
 * Nested spans are reported whole and are not subtracted from one another here.
 * A span that contains foreign work -- a resource provider, a host's storage --
 * is separated from it by naming that work in its own span and correlating the
 * two afterwards on a shared identifier. Doing the subtraction inside would
 * need an ambient stack, and an ambient stack is wrong the first time two turns
 * are in flight at once.
 */
export function measure<T>(
  sink: SpanSink | undefined,
  name: string,
  operation: (scope: SpanScope) => Promise<T>,
  describe?: (value: T, scope: SpanScope) => void,
): Promise<T> {
  return sink === undefined ? operation(IGNORED_SCOPE) : timed(sink, name, operation, describe);
}

/** {@link measure} for an operation that does not await. */
export function measureSync<T>(
  sink: SpanSink | undefined,
  name: string,
  operation: (scope: SpanScope) => T,
): T {
  if (sink === undefined) {
    return operation(IGNORED_SCOPE);
  }
  const attributes: Record<string, string | number | boolean> = {};
  const startedAt = performance.now();
  try {
    return operation({
      set: (key, value) => {
        attributes[key] = value;
      },
    });
  } finally {
    report(sink, name, performance.now() - startedAt, attributes);
  }
}

async function timed<T>(
  sink: SpanSink,
  name: string,
  operation: (scope: SpanScope) => Promise<T>,
  describe: ((value: T, scope: SpanScope) => void) | undefined,
): Promise<T> {
  const attributes: Record<string, string | number | boolean> = {};
  const scope: SpanScope = {
    set: (key, value) => {
      attributes[key] = value;
    },
  };
  const startedAt = performance.now();
  try {
    const value = await operation(scope);
    describe?.(value, scope);
    return value;
  } finally {
    report(sink, name, performance.now() - startedAt, attributes);
  }
}

function report(
  sink: SpanSink,
  name: string,
  durationMs: number,
  attributes: SpanAttributes,
): void {
  try {
    sink.record({ name, durationMs, attributes });
  } catch {
    // A measurement sink is an observer. It does not get to fail the operation.
  }
}

/**
 * The spans SharedOS emits, named once so a sink and a report agree.
 *
 * `TOOL_HANDLER` is the odd one and the important one: it is the only span here
 * that measures work SharedOS does not own. A resource provider's read is the
 * host's storage, not enforcement, and an end-to-end figure that included it
 * would report the host's disk as a SharedOS cost. It is emitted so it can be
 * taken back out, correlated by the `callId` every span on one call carries.
 */
export const SPAN = Object.freeze({
  /** One read of authority from its trusted source, at a turn boundary. */
  AUTHORITY_LOAD: "kernel.authority.load",
  /** One authorization decision against already-held authority. */
  AUTHORIZE: "kernel.authorize",
  /** One `SharedOSKernel.invokeTool`, provider included. */
  TOOL_INVOKE: "kernel.tool.invoke",
  /** Resolving the effective tool registry one call is answered against. */
  TOOL_CATALOGUE: "kernel.tool.catalogue",
  /** The discovery filter: whether this authority may see the tool at all. */
  TOOL_DISCOVER: "kernel.tool.discover",
  /** The provider call inside it. Foreign work, to be subtracted. */
  TOOL_HANDLER: "kernel.tool.handler",
  /** Serving a typed governed view: one projection of one provider result. */
  VIEW_PROJECT: "kernel.view.project",
  /** One `RuntimeHost.invokeTool`: the envelope's mediation of one call. */
  TOOL_MEDIATE: "envelope.tool.mediate",
  /** One whole agent turn, from request to terminal outcome. */
  TURN: "envelope.turn",
  /** One JSON-RPC message, from arrival at the MCP server to its response. */
  MCP_HANDLE: "mcp.handle",
} as const);

export type SpanName = (typeof SPAN)[keyof typeof SPAN];
