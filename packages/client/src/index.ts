import type {
  AuthorizationDecision,
  CapabilityRequirement,
  ExecutionResult,
  MessageDeliveryResult,
  MessageEnvelope,
  ResourceResult,
  ToolCall,
  ToolDefinition,
  ToolNamespaceCatalog,
  ToolNamespaceUpdate,
  ToolResult,
} from "@aicoo/sharedos-contracts";
import {
  AuthorizationDecisionSchema,
  ExecutionResultSchema,
  MessageDeliveryResultSchema,
  RemoteExecutionRequestSchema,
  RemoteResourceOperationSchema,
  ResourceResultSchema,
  SharedOSApiErrorResponseSchema,
  SharedOSHealthSchema,
  ReachableResourceSchema,
  ToolDefinitionSchema,
  ToolNamespaceCatalogSchema,
  ToolNamespaceUpdateSchema,
  ToolResultSchema,
  type ReachableResource,
  type RemoteExecutionRequest,
  type RemoteResourceOperation,
  type SharedOSHealth,
} from "@aicoo/sharedos-contracts";

export interface SharedOSClientOptions {
  baseUrl: string;
  token?: string | (() => string | Promise<string>);
  fetch?: typeof globalThis.fetch;
  headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>);
}

export interface SharedOSCallOptions {
  purpose?: string;
  signal?: AbortSignal;
  headers?: HeadersInit;
}

export type { RemoteExecutionRequest, RemoteResourceOperation, SharedOSHealth };

export class SharedOSClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string | undefined;

  constructor(args: { message: string; status: number; code: string; requestId?: string }) {
    super(args.message);
    this.name = "SharedOSClientError";
    this.status = args.status;
    this.code = args.code;
    this.requestId = args.requestId;
  }
}

export class SharedOSClient {
  readonly #baseUrl: string;
  readonly #token?: SharedOSClientOptions["token"];
  readonly #fetch: typeof globalThis.fetch;
  readonly #headers?: SharedOSClientOptions["headers"];

  constructor(options: SharedOSClientOptions) {
    this.#baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.#token = options.token;
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#headers = options.headers;
  }

  health(options?: SharedOSCallOptions): Promise<SharedOSHealth> {
    return this.#request("/health", { method: "GET" }, SharedOSHealthSchema, options);
  }

  authorize(
    request: CapabilityRequirement,
    options?: SharedOSCallOptions,
  ): Promise<AuthorizationDecision> {
    return this.#post("/v1/authorize", request, AuthorizationDecisionSchema, options);
  }

  /** Where this caller may work, for building a prompt or planning a turn. */
  listReachable(options?: SharedOSCallOptions): Promise<readonly ReachableResource[]> {
    return this.#request(
      "/v1/reachable",
      { method: "GET" },
      ReachableResourceSchema.array(),
      options,
    );
  }

  listTools(options?: SharedOSCallOptions): Promise<readonly ToolDefinition[]> {
    return this.#request("/v1/tools", { method: "GET" }, ToolDefinitionSchema.array(), options);
  }

  listToolNamespaces(options?: SharedOSCallOptions): Promise<ToolNamespaceCatalog> {
    return this.#request(
      "/v1/tools/namespaces",
      { method: "GET" },
      ToolNamespaceCatalogSchema,
      options,
    );
  }

  updateToolNamespaces(
    update: ToolNamespaceUpdate,
    options?: SharedOSCallOptions,
  ): Promise<ToolNamespaceCatalog> {
    return this.#post(
      "/v1/tools/namespaces",
      ToolNamespaceUpdateSchema.parse(update),
      ToolNamespaceCatalogSchema,
      options,
      "PUT",
    );
  }

  invokeTool(call: ToolCall, options?: SharedOSCallOptions): Promise<ToolResult> {
    return this.#post("/v1/tools/invoke", call, ToolResultSchema, options);
  }

  invokeResource(
    operation: RemoteResourceOperation,
    options?: SharedOSCallOptions,
  ): Promise<ResourceResult> {
    return this.#post(
      "/v1/resources/invoke",
      RemoteResourceOperationSchema.parse(operation),
      ResourceResultSchema,
      options,
    );
  }

  sendMessage(
    envelope: MessageEnvelope,
    options?: SharedOSCallOptions,
  ): Promise<MessageDeliveryResult> {
    return this.#post("/v1/messages", envelope, MessageDeliveryResultSchema, options);
  }

  executeTurn(
    request: RemoteExecutionRequest,
    options?: SharedOSCallOptions,
  ): Promise<ExecutionResult> {
    return this.#post(
      "/v1/turns",
      RemoteExecutionRequestSchema.parse(request),
      ExecutionResultSchema,
      options,
    );
  }

  #post<T>(
    path: string,
    body: unknown,
    schema: RuntimeSchema<T>,
    options?: SharedOSCallOptions,
    method: "POST" | "PUT" = "POST",
  ): Promise<T> {
    return this.#request(
      path,
      {
        method,
        body: JSON.stringify(body),
      },
      schema,
      options,
    );
  }

  async #request<T>(
    path: string,
    init: RequestInit,
    schema: RuntimeSchema<T>,
    options?: SharedOSCallOptions,
  ): Promise<T> {
    const headers = new Headers(await resolveValue(this.#headers));
    new Headers(options?.headers).forEach((value, key) => headers.set(key, value));
    headers.set("accept", "application/json");

    if (init.body !== undefined) {
      headers.set("content-type", "application/json");
    }

    if (options?.purpose) {
      headers.set("x-sharedos-purpose", options.purpose);
    }

    const token = await resolveValue(this.#token);
    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }

    const response = await this.#fetch(`${this.#baseUrl}${path}`, {
      ...init,
      headers,
      ...(options?.signal === undefined ? {} : { signal: options.signal }),
    });

    const payload = await readJson(response);
    if (!response.ok) {
      const error = readApiError(payload);
      throw new SharedOSClientError({
        status: response.status,
        code: error.code,
        message: error.message,
        ...(error.requestId ? { requestId: error.requestId } : {}),
      });
    }

    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      throw new SharedOSClientError({
        status: response.status,
        code: "invalid_response",
        message: "SharedOS returned a response that does not match the v1 contract.",
      });
    }

    return parsed.data;
  }
}

interface RuntimeSchema<T> {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
}

async function resolveValue<T>(
  value: T | (() => T | Promise<T>) | undefined,
): Promise<T | undefined> {
  return typeof value === "function" ? (value as () => T | Promise<T>)() : value;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new SharedOSClientError({
      status: response.status,
      code: "invalid_response",
      message: "SharedOS returned a non-JSON response.",
    });
  }
}

function readApiError(payload: unknown): { code: string; message: string; requestId?: string } {
  const parsed = SharedOSApiErrorResponseSchema.safeParse(payload);
  if (!parsed.success) {
    return { code: "request_failed", message: "SharedOS request failed." };
  }

  const { code, message, requestId } = parsed.data.error;
  return { code, message, ...(requestId === undefined ? {} : { requestId }) };
}
