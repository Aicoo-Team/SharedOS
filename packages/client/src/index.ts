import {
  SHAREDOS_ROUTES,
  type AuthorizationDecision,
  type CapabilityRequirement,
  type ExecutionResult,
  type MessageDeliveryResult,
  type MessageEnvelope,
  type ReachResult,
  type RemoteExecutionRequest,
  type RemoteResourceOperation,
  type ResourceResult,
  type SharedOSApiErrorCode,
  type SharedOSHealth,
  type SharedOSRoute,
  type ToolCall,
  type ToolDefinition,
  type ToolNamespaceCatalog,
  type ToolNamespaceUpdate,
  type ToolResult,
  type WireSchema,
} from "@aicoo/sharedos-contracts";
import { SharedOSApiErrorResponseSchema } from "@aicoo/sharedos-contracts";

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

/**
 * The codes a client failure carries: the server's own, the two the client
 * raises for an answer it could not read, or one an older client has no
 * name for yet, which is why the type admits any string.
 *
 * The `(string & {})` widening is a design decision, not a typing shortcut.
 * It costs autocomplete on `code` and buys forward compatibility: a client
 * built against this release still reads a code a later server adds, and a
 * host's own codes arrive unrenamed. Narrowing it back to the union changes
 * what callers may rely on, so it needs an explicit sign-off of its own
 * rather than a procedural clean-up.
 */
export type SharedOSClientErrorCode =
  SharedOSApiErrorCode | "invalid_response" | "request_failed" | (string & {});

export class SharedOSClientError extends Error {
  readonly status: number;
  readonly code: SharedOSClientErrorCode;
  readonly requestId: string | undefined;

  constructor(args: {
    message: string;
    status: number;
    code: SharedOSClientErrorCode;
    requestId?: string;
  }) {
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
    return this.#call(SHAREDOS_ROUTES.health, undefined, options);
  }

  authorize(
    request: CapabilityRequirement,
    options?: SharedOSCallOptions,
  ): Promise<AuthorizationDecision> {
    return this.#call(SHAREDOS_ROUTES.authorize, request, options);
  }

  listTools(options?: SharedOSCallOptions): Promise<readonly ToolDefinition[]> {
    return this.#call(SHAREDOS_ROUTES.listTools, undefined, options);
  }

  /**
   * Where this caller may operate, with the authority stripped out.
   *
   * Grant reach for the context the server resolved, as `SharedOSKernel.reach`
   * answers it: where some call would be authorized, not that any call will be.
   * It is not narrowed to the tool catalogue, because `invokeResource` is not
   * gated by tool namespaces; a client driving a model from `listTools()`
   * keeps the entries whose namespace one of those tools operates on, which is
   * what the execution envelope does for a turn. `unavailable` is an answer
   * rather than an error: nothing could be established, and the code says why.
   */
  reach(options?: SharedOSCallOptions): Promise<ReachResult> {
    return this.#call(SHAREDOS_ROUTES.reach, undefined, options);
  }

  listToolNamespaces(options?: SharedOSCallOptions): Promise<ToolNamespaceCatalog> {
    return this.#call(SHAREDOS_ROUTES.listToolNamespaces, undefined, options);
  }

  updateToolNamespaces(
    update: ToolNamespaceUpdate,
    options?: SharedOSCallOptions,
  ): Promise<ToolNamespaceCatalog> {
    return this.#call(
      SHAREDOS_ROUTES.updateToolNamespaces,
      SHAREDOS_ROUTES.updateToolNamespaces.request.parse(update),
      options,
    );
  }

  invokeTool(call: ToolCall, options?: SharedOSCallOptions): Promise<ToolResult> {
    return this.#call(SHAREDOS_ROUTES.invokeTool, call, options);
  }

  invokeResource(
    operation: RemoteResourceOperation,
    options?: SharedOSCallOptions,
  ): Promise<ResourceResult> {
    return this.#call(
      SHAREDOS_ROUTES.invokeResource,
      SHAREDOS_ROUTES.invokeResource.request.parse(operation),
      options,
    );
  }

  sendMessage(
    envelope: MessageEnvelope,
    options?: SharedOSCallOptions,
  ): Promise<MessageDeliveryResult> {
    return this.#call(SHAREDOS_ROUTES.sendMessage, envelope, options);
  }

  executeTurn(
    request: RemoteExecutionRequest,
    options?: SharedOSCallOptions,
  ): Promise<ExecutionResult> {
    return this.#call(
      SHAREDOS_ROUTES.executeTurn,
      SHAREDOS_ROUTES.executeTurn.request.parse(request),
      options,
    );
  }

  /** One route from the table: its verb, its path, and its answer read through its schema. */
  #call<Request, Response>(
    route: SharedOSRoute<Request, Response>,
    body: Request | undefined,
    options?: SharedOSCallOptions,
  ): Promise<Response> {
    return this.#request(
      route.path,
      body === undefined
        ? { method: route.method }
        : { method: route.method, body: JSON.stringify(body) },
      route.response,
      options,
    );
  }

  async #request<T>(
    path: string,
    init: RequestInit,
    schema: WireSchema<T>,
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
