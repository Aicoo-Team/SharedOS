import type {
  AccessContext,
  MessageDeliveryResult,
  MessageEnvelope,
  ToolCall,
  ToolDefinition,
  ToolResult,
} from "@aicoo/sharedos-contracts";
import { MessageEnvelopeSchema, MessageRequestArgumentsSchema } from "@aicoo/sharedos-contracts";

import { addressesEqual } from "./authorization.js";
import {
  MESSAGE_SEND_ACTION,
  MESSAGING_NAMESPACE,
  type MessageCapabilityResolver,
  type MessageRequestRouter,
} from "./message-service.js";
import type { ToolHandler } from "./tool-registry.js";
import { deepFreeze, throwIfAborted } from "./internal.js";

export const MESSAGE_TOOL_NAMESPACE = "messages";
export const MESSAGE_REQUEST_TOOL_NAME = "messages.request";

export const MESSAGE_REQUEST_TOOL_DEFINITION: ToolDefinition = {
  name: MESSAGE_REQUEST_TOOL_NAME,
  description: "Send an authorized request to another agent and wait for its durable reply",
  namespace: MESSAGE_TOOL_NAMESPACE,
  source: "sharedos",
  readWrite: "write",
  inputSchema: {
    type: "object",
    properties: {
      recipient: {
        oneOf: [
          {
            type: "object",
            properties: {
              kind: { const: "human" },
              userId: {
                type: "string",
                minLength: 1,
                maxLength: 256,
                pattern: "^(?!\\s)[\\s\\S]*\\S$",
              },
            },
            required: ["kind", "userId"],
            additionalProperties: false,
          },
          {
            type: "object",
            properties: {
              kind: { const: "agent" },
              agentId: {
                type: "string",
                minLength: 1,
                maxLength: 256,
                pattern: "^(?!\\s)[\\s\\S]*\\S$",
              },
            },
            required: ["kind", "agentId"],
            additionalProperties: false,
          },
          {
            type: "object",
            properties: {
              kind: { const: "group" },
              conversationId: {
                type: "string",
                minLength: 1,
                maxLength: 256,
                pattern: "^(?!\\s)[\\s\\S]*\\S$",
              },
            },
            required: ["kind", "conversationId"],
            additionalProperties: false,
          },
          {
            type: "object",
            properties: {
              kind: { const: "service" },
              serviceId: {
                type: "string",
                minLength: 1,
                maxLength: 256,
                pattern: "^(?!\\s)[\\s\\S]*\\S$",
              },
            },
            required: ["kind", "serviceId"],
            additionalProperties: false,
          },
        ],
      },
      payload: {},
    },
    required: ["recipient", "payload"],
    additionalProperties: false,
  },
  /**
   * The reply payload, whose shape is the recipient's and not ours to declare.
   *
   * `{ type: "object" }` rather than `{}`: MCP types `outputSchema` as an object
   * schema, and the reference SDK validates that literally -- a `tools/list`
   * carrying a typeless one is rejected whole, so every tool in the catalogue
   * disappears along with it. Clients that skip the check connect regardless,
   * which is what makes this worth spelling out here: the same catalogue reaches
   * one harness intact and another not at all.
   */
  outputSchema: { type: "object" },
  requiredCapability: {
    resource: { namespace: MESSAGING_NAMESPACE, path: [] },
    action: MESSAGE_SEND_ACTION,
  },
  annotations: { readOnly: false, destructive: true, idempotent: false },
};

export type AuthorizedMessageDelivery = (
  context: AccessContext,
  envelope: MessageEnvelope,
  signal: AbortSignal,
  operationId: string,
) => Promise<MessageDeliveryResult>;

export interface MessageRequestToolOptions {
  readonly capabilityResolver: MessageCapabilityResolver;
  readonly router: MessageRequestRouter;
  readonly createMessageId: (context: AccessContext, call: ToolCall) => string;
  readonly deliverAuthorizedMessage: AuthorizedMessageDelivery;
}

/** Create one invocation-local handler; its prepared envelope is never shared. */
export function createMessageRequestTool(options: MessageRequestToolOptions): ToolHandler {
  let prepared: { readonly callId: string; readonly envelope: MessageEnvelope } | undefined;

  return {
    definition: MESSAGE_REQUEST_TOOL_DEFINITION,
    parseArguments(arguments_) {
      return MessageRequestArgumentsSchema.parse(arguments_);
    },
    resolveRequirement(context, call) {
      const trustedContext = deepFreeze(structuredClone(context));
      const trustedCall = deepFreeze(structuredClone(call));
      const arguments_ = MessageRequestArgumentsSchema.parse(trustedCall.arguments);
      const envelope = deepFreeze(
        MessageEnvelopeSchema.parse({
          version: "1",
          id: options.createMessageId(
            structuredClone(trustedContext),
            structuredClone(trustedCall),
          ),
          sender: trustedContext.actor,
          receiver: arguments_.recipient,
          purpose: trustedContext.purpose,
          payload: arguments_.payload,
          traceId: trustedContext.traceId,
          createdAt: trustedContext.now,
        }),
      );
      const requirement = options.capabilityResolver.resolve(
        structuredClone(trustedContext),
        structuredClone(envelope),
      );
      prepared = { callId: call.id, envelope };
      return requirement;
    },
    async invoke(context, call, signal) {
      if (prepared === undefined || prepared.callId !== call.id) {
        return failedResult(
          call,
          context.now,
          "message_request_not_prepared",
          "The message request was not prepared for authorization",
        );
      }

      const request = prepared.envelope;
      const delivery = await options.deliverAuthorizedMessage(
        context,
        structuredClone(request),
        signal,
        call.id,
      );
      if (delivery.status !== "accepted" && delivery.status !== "delivered") {
        return failedResult(
          call,
          context.now,
          "message_request_not_accepted",
          "The message request was not accepted for delivery",
        );
      }

      throwIfAborted(signal);
      let candidate: MessageEnvelope;
      try {
        candidate = await options.router.resolveReply(
          structuredClone(context),
          structuredClone(request),
          structuredClone(delivery),
          signal,
        );
        throwIfAborted(signal);
      } catch (error) {
        if (signal.aborted) {
          throw signal.reason ?? error;
        }
        return failedResult(
          call,
          context.now,
          "message_reply_resolution_failed",
          "The message router could not resolve a reply",
        );
      }

      const parsed = MessageEnvelopeSchema.safeParse(candidate);
      if (!parsed.success || !replyMatchesRequest(parsed.data, request)) {
        return failedResult(
          call,
          context.now,
          "invalid_message_reply",
          "The message router returned an invalid reply",
        );
      }

      return {
        callId: call.id,
        tool: call.tool,
        status: "succeeded",
        output: parsed.data.payload,
        completedAt: context.now,
      };
    },
  };
}

function replyMatchesRequest(reply: MessageEnvelope, request: MessageEnvelope): boolean {
  return (
    reply.replyTo === request.id &&
    addressesEqual(reply.sender, request.receiver) &&
    addressesEqual(reply.receiver, request.sender) &&
    reply.purpose === request.purpose &&
    reply.traceId === request.traceId
  );
}

function failedResult(
  call: ToolCall,
  completedAt: string,
  code: string,
  message: string,
): ToolResult {
  return {
    callId: call.id,
    tool: call.tool,
    status: "failed",
    completedAt,
    error: { code, message, retryable: false },
  };
}
