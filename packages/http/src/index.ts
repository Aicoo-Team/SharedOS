import {
  AccessContextSchema,
  CapabilityRequirementSchema,
  MessageEnvelopeSchema,
  RemoteExecutionRequestSchema,
  RemoteResourceOperationSchema,
  ToolCallSchema,
  type AccessContext,
  type AuthorizationDecision,
  type CapabilityRequirement,
  type ExecutionResult,
  type MessageDeliveryResult,
  type MessageEnvelope,
  type RemoteExecutionRequest,
  type ResourceOperation,
  type ResourceResult,
  type ToolCall,
  type ToolDefinition,
  type ToolResult,
} from "@sharedos/contracts";
import type { SharedOSKernel } from "@sharedos/core";
import type { TurnExecutor } from "@sharedos/runtime";

export interface SharedOSApiCallOptions {
  readonly signal?: AbortSignal;
}

export interface SharedOSApi {
  authorize(
    context: AccessContext,
    request: CapabilityRequirement,
    options?: SharedOSApiCallOptions,
  ): Promise<AuthorizationDecision>;
  listTools(
    context: AccessContext,
    options?: SharedOSApiCallOptions,
  ): Promise<readonly ToolDefinition[]>;
  invokeTool(
    context: AccessContext,
    call: ToolCall,
    options?: SharedOSApiCallOptions,
  ): Promise<ToolResult>;
  invokeResource(
    context: AccessContext,
    operation: ResourceOperation,
    options?: SharedOSApiCallOptions,
  ): Promise<ResourceResult>;
  sendMessage(
    context: AccessContext,
    envelope: MessageEnvelope,
    options?: SharedOSApiCallOptions,
  ): Promise<MessageDeliveryResult>;
  executeTurn(
    context: AccessContext,
    request: RemoteExecutionRequest,
    options?: SharedOSApiCallOptions,
  ): Promise<ExecutionResult>;
}

export interface KernelSharedOSApiOptions {
  kernel: SharedOSKernel;
  turns: Pick<TurnExecutor, "execute">;
}

/** Builds the HTTP application surface from the same kernel used by embedded consumers. */
export function createKernelSharedOSApi(options: KernelSharedOSApiOptions): SharedOSApi {
  return {
    authorize: (context, requirement, callOptions) =>
      options.kernel.authorize(context, requirement, callOptions),
    listTools: (context, callOptions) => options.kernel.listTools(context, callOptions),
    invokeTool: (context, call, callOptions) =>
      options.kernel.invokeTool(context, call, callOptions),
    invokeResource: (context, operation, callOptions) =>
      options.kernel.invokeResource(
        context,
        {
          operationId: operation.operationId,
          resource: operation.resource,
          action: operation.action,
          ...(operation.input === undefined ? {} : { input: operation.input }),
          ...(operation.metadata === undefined ? {} : { metadata: operation.metadata }),
        },
        callOptions,
      ),
    sendMessage: (context, envelope, callOptions) =>
      options.kernel.sendMessage(context, envelope, callOptions),
    executeTurn: async (context, request, callOptions) => {
      const tools = await options.kernel.listTools(context, callOptions);
      return options.turns.execute(
        { ...request, context, tools: [...tools] },
        callOptions?.signal === undefined ? {} : { signal: callOptions.signal },
      );
    },
  };
}

export interface SharedOSHttpOptions {
  api: SharedOSApi;
  resolveContext(request: Request): Promise<AccessContext>;
  onError?: (error: unknown, request: Request, requestId: string) => void | Promise<void>;
}

export class SharedOSHttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "SharedOSHttpError";
    this.status = status;
    this.code = code;
  }
}

export function createSharedOSHandler(
  options: SharedOSHttpOptions,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

    try {
      return await routeRequest(options, request, requestId);
    } catch (error) {
      try {
        await options.onError?.(error, request, requestId);
      } catch {
        // Observability hooks must never replace the protocol error response.
      }
      return errorResponse(error, requestId);
    }
  };
}

async function routeRequest(
  options: SharedOSHttpOptions,
  request: Request,
  requestId: string,
): Promise<Response> {
  const { pathname } = new URL(request.url);

  if (pathname === "/health") {
    requireMethod(request, "GET");
    return json({ status: "ok", protocolVersion: "1" }, 200, requestId);
  }

  const resolvedContext = await options.resolveContext(request);
  const parsedContext = AccessContextSchema.safeParse(resolvedContext);
  if (!parsedContext.success) {
    throw new SharedOSHttpError(
      500,
      "invalid_access_context",
      "The host returned an invalid access context.",
    );
  }
  const context = parsedContext.data;
  const callOptions: SharedOSApiCallOptions = { signal: request.signal };

  if (pathname === "/v1/authorize") {
    requireMethod(request, "POST");
    const body = await parseBody(request, CapabilityRequirementSchema);
    return json(await options.api.authorize(context, body, callOptions), 200, requestId);
  }

  if (pathname === "/v1/tools") {
    requireMethod(request, "GET");
    return json(await options.api.listTools(context, callOptions), 200, requestId);
  }

  if (pathname === "/v1/tools/invoke") {
    requireMethod(request, "POST");
    const body = await parseBody(request, ToolCallSchema);
    return json(await options.api.invokeTool(context, body, callOptions), 200, requestId);
  }

  if (pathname === "/v1/resources/invoke") {
    requireMethod(request, "POST");
    const body = await parseBody(request, RemoteResourceOperationSchema);
    const operation: ResourceOperation = { ...body, context };
    return json(await options.api.invokeResource(context, operation, callOptions), 200, requestId);
  }

  if (pathname === "/v1/messages") {
    requireMethod(request, "POST");
    const body = await parseBody(request, MessageEnvelopeSchema);
    const result = await options.api.sendMessage(context, body, callOptions);
    return json(result, result.status === "accepted" ? 202 : 200, requestId);
  }

  if (pathname === "/v1/turns") {
    requireMethod(request, "POST");
    const body = await parseBody(request, RemoteExecutionRequestSchema);
    return json(await options.api.executeTurn(context, body, callOptions), 200, requestId);
  }

  throw new SharedOSHttpError(404, "not_found", "SharedOS endpoint not found.");
}

interface RuntimeSchema<T> {
  safeParse(
    value: unknown,
  ): { success: true; data: T } | { success: false; error: { issues?: readonly unknown[] } };
}

async function parseBody<T>(request: Request, schema: RuntimeSchema<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new SharedOSHttpError(400, "invalid_json", "Request body must be valid JSON.");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new SharedOSHttpError(
      400,
      "invalid_request",
      "Request body does not match the v1 contract.",
    );
  }

  return parsed.data;
}

function requireMethod(request: Request, expected: "GET" | "POST"): void {
  if (request.method !== expected) {
    throw new SharedOSHttpError(405, "method_not_allowed", `Use ${expected} for this endpoint.`);
  }
}

function json(payload: unknown, status: number, requestId: string): Response {
  return Response.json(payload, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-request-id": requestId,
    },
  });
}

function errorResponse(error: unknown, requestId: string): Response {
  if (error instanceof SharedOSHttpError) {
    return json(
      { error: { code: error.code, message: error.message, requestId } },
      error.status,
      requestId,
    );
  }

  if (hasErrorCode(error, "permission_denied")) {
    return json(
      {
        error: {
          code: "permission_denied",
          message: "No matching capability grant allows this operation.",
          requestId,
        },
      },
      403,
      requestId,
    );
  }

  return json(
    { error: { code: "internal_error", message: "SharedOS request failed.", requestId } },
    500,
    requestId,
  );
}

function hasErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}
