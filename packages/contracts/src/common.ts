import { z } from "zod";

/**
 * The wire protocol version implemented by this package, as the one value
 * every request, event, result, envelope and manifest stamps on itself.
 */
export const PROTOCOL_VERSION = "2" as const;

/** The wire protocol version implemented by this package. */
export const ProtocolVersionSchema = z.literal(PROTOCOL_VERSION, {
  errorMap: (_issue, context) => ({
    message: unsupportedProtocolMessage(context.data),
  }),
});

/** A version mismatch is distinct from malformed data within a supported epoch. */
export class UnsupportedProtocolVersionError extends TypeError {
  readonly code = "unsupported_protocol_version";
  readonly supportedVersion = PROTOCOL_VERSION;
  readonly receivedVersion: string | null;

  constructor(receivedVersion: unknown) {
    super(unsupportedProtocolMessage(receivedVersion));
    this.name = "UnsupportedProtocolVersionError";
    this.receivedVersion = typeof receivedVersion === "string" ? receivedVersion : null;
  }
}

function unsupportedProtocolMessage(received: unknown): string {
  const label = typeof received === "string" ? JSON.stringify(received) : "missing or invalid";
  return `Unsupported SharedOS protocol version ${label}; supported version is "${PROTOCOL_VERSION}".`;
}

/** Check the boundary stamp before validating the rest of an untrusted payload. */
export function assertProtocolVersion(received: unknown): asserts received is ProtocolVersion {
  if (received !== PROTOCOL_VERSION) {
    throw new UnsupportedProtocolVersionError(received);
  }
}
export type ProtocolVersion = z.infer<typeof ProtocolVersionSchema>;

/**
 * The SharedOS build, as every manifest, MCP server and conformance record
 * names it.
 *
 * The packages share one version and are published together, so there is one
 * constant. The release gate holds it equal to the synchronized package
 * version, because a record that names the wrong build is evidence attributed
 * to code that never ran.
 */
export const SHAREDOS_VERSION = "1.0.0-preview";

/** An opaque identifier. Callers choose its format; SharedOS only requires stability. */
export const IdentifierSchema = z.string().trim().min(1).max(256);
export type Identifier = z.infer<typeof IdentifierSchema>;

/** An RFC 3339 timestamp, represented as a string to remain JSON-safe. */
export const TimestampSchema = z.string().datetime({ offset: true });
export type Timestamp = z.infer<typeof TimestampSchema>;
