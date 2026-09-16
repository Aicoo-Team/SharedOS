import { z } from "zod";

/**
 * The wire protocol version implemented by this package, as the one value
 * every request, event, result, envelope and manifest stamps on itself.
 */
export const PROTOCOL_VERSION = "1" as const;

/** The wire protocol version implemented by this package. */
export const ProtocolVersionSchema = z.literal(PROTOCOL_VERSION);
export type ProtocolVersion = z.infer<typeof ProtocolVersionSchema>;

/** An opaque identifier. Callers choose its format; SharedOS only requires stability. */
export const IdentifierSchema = z.string().trim().min(1).max(256);
export type Identifier = z.infer<typeof IdentifierSchema>;

/** An RFC 3339 timestamp, represented as a string to remain JSON-safe. */
export const TimestampSchema = z.string().datetime({ offset: true });
export type Timestamp = z.infer<typeof TimestampSchema>;
