import { z } from "zod";

export const ERROR_CODES = [
  "invalid_input",
  "needs_review",
  "unauthenticated",
  "forbidden",
  "not_found",
  "conflict",
  "failed_dependency",
  "rate_limited",
  "invalid_provider_response",
  "provider_unavailable",
  "timeout",
  "reconciliation_required",
  "internal_error",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const ErrorCodeSchema = z.enum(ERROR_CODES);

export const STATUS_BY_CODE: Record<ErrorCode, number> = {
  invalid_input: 400,
  needs_review: 422,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  failed_dependency: 424,
  rate_limited: 429,
  invalid_provider_response: 502,
  provider_unavailable: 503,
  timeout: 504,
  reconciliation_required: 409,
  internal_error: 500,
};

export const ErrorResponseSchema = z
  .object({
    error: z
      .object({
        code: ErrorCodeSchema,
        message: z.string().min(1).max(500),
        correlationId: z.string().max(200).optional(),
        retryable: z.boolean(),
        reconciliationRequired: z.boolean(),
      })
      .strict(),
  })
  .strict();

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

/**
 * Normalized service error. The message is safe for clients: it must never
 * carry payloads, tokens, provider bodies or stack traces.
 */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly reconciliationRequired: boolean;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    options: { retryable?: boolean; reconciliationRequired?: boolean; details?: Record<string, unknown> } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.retryable = options.retryable ?? (code === "provider_unavailable" || code === "timeout" || code === "rate_limited");
    this.reconciliationRequired = options.reconciliationRequired ?? code === "reconciliation_required";
    this.details = options.details;
  }

  toResponse(correlationId?: string): ErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(correlationId ? { correlationId } : {}),
        retryable: this.retryable,
        reconciliationRequired: this.reconciliationRequired,
      },
    };
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

export function forbidden(message = "capability not granted for this resource"): ApiError {
  return new ApiError("forbidden", message);
}

export function notFound(message = "resource not found in this scope"): ApiError {
  return new ApiError("not_found", message);
}

export function conflict(message: string): ApiError {
  return new ApiError("conflict", message);
}

export function invalid(message: string): ApiError {
  return new ApiError("invalid_input", message);
}
