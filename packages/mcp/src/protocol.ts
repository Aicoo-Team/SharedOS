import { z } from "zod";

/**
 * The MCP wire shapes SharedOS speaks, and nothing else.
 *
 * MCP is a large protocol -- prompts, resources, sampling, roots, elicitation.
 * SharedOS implements the tool surface alone, because the tool surface is the
 * whole of what the toolshare boundary is for: a harness discovers the
 * permission-filtered catalogue and calls into it. Anything else a client asks
 * for is answered `method_not_found`, which is a protocol answer rather than a
 * silent capability.
 */

/** Protocol revisions this server speaks, newest first. */
export const SUPPORTED_MCP_PROTOCOL_VERSIONS: readonly string[] = Object.freeze([
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
]);

export const LATEST_MCP_PROTOCOL_VERSION = "2025-06-18";

/**
 * JSON-RPC 2.0 error codes.
 *
 * These are for messages that could not be processed at all. A SharedOS refusal
 * is never one of them: a denial is a processed request whose answer is `no`, and
 * it returns as a tool result. See `toCallToolResult`.
 */
export const JSON_RPC_PARSE_ERROR = -32_700;
export const JSON_RPC_INVALID_REQUEST = -32_600;
export const JSON_RPC_METHOD_NOT_FOUND = -32_601;
export const JSON_RPC_INVALID_PARAMS = -32_602;
export const JSON_RPC_INTERNAL_ERROR = -32_603;

export const JsonRpcIdSchema = z.union([z.string(), z.number()]);
export type JsonRpcId = z.infer<typeof JsonRpcIdSchema>;

export const JsonRpcRequestSchema = z
  .object({
    jsonrpc: z.literal("2.0"),
    id: JsonRpcIdSchema,
    method: z.string().min(1),
    params: z.unknown().optional(),
  })
  .passthrough();
export type JsonRpcRequest = z.infer<typeof JsonRpcRequestSchema>;

export const JsonRpcNotificationSchema = z
  .object({
    jsonrpc: z.literal("2.0"),
    method: z.string().min(1),
    params: z.unknown().optional(),
  })
  .passthrough()
  .refine((message) => !("id" in message), {
    message: "a notification must not carry an id",
  });
export type JsonRpcNotification = z.infer<typeof JsonRpcNotificationSchema>;

export interface JsonRpcErrorBody {
  readonly code: number;
  readonly message: string;
  readonly data?: unknown;
}

export interface JsonRpcSuccess {
  readonly jsonrpc: "2.0";
  readonly id: JsonRpcId;
  readonly result: unknown;
}

export interface JsonRpcFailure {
  readonly jsonrpc: "2.0";
  readonly id: JsonRpcId | null;
  readonly error: JsonRpcErrorBody;
}

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcFailure;

export function jsonRpcResult(id: JsonRpcId, result: unknown): JsonRpcSuccess {
  return { jsonrpc: "2.0", id, result };
}

export function jsonRpcError(
  id: JsonRpcId | null,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcFailure {
  return {
    jsonrpc: "2.0",
    id,
    error: { code, message, ...(data === undefined ? {} : { data }) },
  };
}

export const InitializeParamsSchema = z
  .object({
    protocolVersion: z.string().min(1).optional(),
    capabilities: z.record(z.unknown()).optional(),
    clientInfo: z
      .object({ name: z.string().optional(), version: z.string().optional() })
      .passthrough()
      .optional(),
  })
  .passthrough();
export type InitializeParams = z.infer<typeof InitializeParamsSchema>;

export const CallToolParamsSchema = z
  .object({
    name: z.string().min(1),
    arguments: z.record(z.unknown()).optional(),
    _meta: z.record(z.unknown()).optional(),
  })
  .passthrough();
export type CallToolParams = z.infer<typeof CallToolParamsSchema>;

/**
 * Negotiate a protocol revision.
 *
 * A client asking for a revision this server knows gets that revision back,
 * which is what keeps an older harness working. A client asking for one it does
 * not know is answered with the newest supported revision rather than an error,
 * per the MCP negotiation rule: the client then decides whether it can proceed.
 */
export function negotiateProtocolVersion(requested: string | undefined): string {
  return requested !== undefined && SUPPORTED_MCP_PROTOCOL_VERSIONS.includes(requested)
    ? requested
    : LATEST_MCP_PROTOCOL_VERSION;
}
