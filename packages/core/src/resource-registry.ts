import type {
  AccessContext,
  ResourceOperation,
  ResourceRef,
  ResourceResult,
} from "@aicoo/sharedos-contracts";

import { DuplicateRegistrationError } from "./errors.js";

export interface ResourceInvocationRequest {
  readonly operationId: string;
  readonly resource: ResourceRef;
  readonly action: string;
  readonly input?: ResourceOperation["input"];
  readonly metadata?: ResourceOperation["metadata"];
}

export interface ResourceProvider {
  readonly namespace: string;
  invoke(operation: ResourceOperation, signal: AbortSignal): Promise<ResourceResult>;
}

export class ResourceProviderRegistry {
  readonly #providers = new Map<string, ResourceProvider>();

  register(provider: ResourceProvider): void {
    if (provider.namespace.length === 0) {
      throw new TypeError("resource namespace must not be empty");
    }
    if (this.#providers.has(provider.namespace)) {
      throw new DuplicateRegistrationError("resource namespace", provider.namespace);
    }

    this.#providers.set(provider.namespace, provider);
  }

  get(namespace: string): ResourceProvider | undefined {
    return this.#providers.get(namespace);
  }

  has(namespace: string): boolean {
    return this.#providers.has(namespace);
  }

  namespaces(): readonly string[] {
    return [...this.#providers.keys()].sort();
  }
}

export function toResourceOperation(
  context: AccessContext,
  request: ResourceInvocationRequest,
): ResourceOperation {
  return {
    operationId: request.operationId,
    context,
    resource: request.resource,
    action: request.action,
    ...(request.input === undefined ? {} : { input: request.input }),
    ...(request.metadata === undefined ? {} : { metadata: request.metadata }),
  };
}
