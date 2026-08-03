import { z } from "zod";

import { IdentifierSchema, ProtocolVersionSchema } from "./common.js";
import { ExecutionRequestSchema } from "./execution.js";
import { ResourceOperationSchema } from "./resource.js";

/** Resource operation accepted over HTTP; authority is injected by the host. */
export const RemoteResourceOperationSchema = ResourceOperationSchema.omit({
  context: true,
}).strict();
export type RemoteResourceOperation = z.infer<typeof RemoteResourceOperationSchema>;

/** Turn request accepted over HTTP; authority and visible tools are host-derived. */
export const RemoteExecutionRequestSchema = ExecutionRequestSchema.omit({
  context: true,
  tools: true,
}).strict();
export type RemoteExecutionRequest = z.infer<typeof RemoteExecutionRequestSchema>;

export const SharedOSHealthSchema = z
  .object({
    status: z.literal("ok"),
    protocolVersion: ProtocolVersionSchema,
  })
  .strict();
export type SharedOSHealth = z.infer<typeof SharedOSHealthSchema>;

export const SharedOSApiErrorResponseSchema = z
  .object({
    error: z
      .object({
        code: z.string().trim().min(1).max(128),
        message: z.string().min(1).max(8_192),
        requestId: IdentifierSchema.optional(),
      })
      .strict(),
  })
  .strict();
export type SharedOSApiErrorResponse = z.infer<typeof SharedOSApiErrorResponseSchema>;
