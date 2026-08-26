import type {
  AccessContext,
  Address,
  Capability,
  MessageDeliveryResult,
  MessageEnvelope,
  ResourceRef,
} from "@aicoo/sharedos-contracts";

import type { AuthorizationRequest } from "./authorization.js";

export const MESSAGING_NAMESPACE = "sharedos.messaging";
export const MESSAGE_SEND_ACTION = "send";

export function messageSendCapability(receiver: Address, owner: Address): Capability {
  return {
    resource: {
      namespace: MESSAGING_NAMESPACE,
      path: addressPath(receiver),
      owner,
    },
    actions: [MESSAGE_SEND_ACTION],
    scope: "exact",
  };
}

export interface MessageTransport {
  deliver(
    context: AccessContext,
    envelope: MessageEnvelope,
    signal: AbortSignal,
  ): Promise<MessageDeliveryResult>;
}

/**
 * Host-owned lookup for the durable reply to one accepted message request.
 * SharedOS validates the returned envelope before exposing its payload.
 */
export interface MessageRequestRouter {
  resolveReply(
    context: AccessContext,
    request: MessageEnvelope,
    delivery: MessageDeliveryResult,
    signal: AbortSignal,
  ): Promise<MessageEnvelope>;
}

export interface MessageCapabilityResolver {
  resolve(context: AccessContext, envelope: MessageEnvelope): AuthorizationRequest;
}

export class RecipientScopedMessageCapabilityResolver implements MessageCapabilityResolver {
  readonly #namespace: string;

  constructor(namespace = MESSAGING_NAMESPACE) {
    this.#namespace = namespace;
  }

  resolve(context: AccessContext, envelope: MessageEnvelope): AuthorizationRequest {
    const resource: ResourceRef = {
      namespace: this.#namespace,
      path: addressPath(envelope.receiver),
      owner: context.owner,
    };

    return { resource, action: MESSAGE_SEND_ACTION };
  }
}

/** Stable, segment-safe grant path for recipient-scoped messaging. */
export function addressPath(address: Address): [kind: Address["kind"], id: string] {
  switch (address.kind) {
    case "human":
      return [address.kind, address.userId];
    case "agent":
      return [address.kind, address.agentId];
    case "group":
      return [address.kind, address.conversationId];
    case "service":
      return [address.kind, address.serviceId];
  }
}
