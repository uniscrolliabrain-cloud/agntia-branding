/**
 * Error contract for the branding service.
 *
 * Errors are the only place where HTTP status is decided. Handlers must never
 * invent a status inline: they throw a DomainError and the API layer maps it.
 * Messages are safe for clients: no payloads, no PII, no provider detail.
 */

export const ERROR_CODES = [
  // input / business
  "invalid_input",
  "unsupported_capability",
  /** The capability exists, but this artifact or format cannot be produced truthfully. */
  "unsupported_operation",
  "policy_violation",
  // auth
  "unauthenticated",
  "membership_missing",
  "scope_forbidden",
  // resource
  "not_found",
  // concurrency / idempotency
  "version_conflict",
  "idempotency_conflict",
  // review / rights
  "approval_required",
  "approval_invalid",
  "rights_missing",
  "font_license_unverified",
  // limits / providers
  "rate_limited",
  "budget_exhausted",
  "provider_invalid_response",
  "provider_unavailable",
  "provider_timeout",
  // internal
  "internal_error",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

const STATUS: Record<ErrorCode, number> = {
  invalid_input: 400,
  unsupported_capability: 400,
  unsupported_operation: 400,
  policy_violation: 403,
  unauthenticated: 401,
  membership_missing: 403,
  scope_forbidden: 403,
  not_found: 404,
  version_conflict: 409,
  idempotency_conflict: 409,
  approval_required: 422,
  approval_invalid: 422,
  rights_missing: 422,
  font_license_unverified: 422,
  rate_limited: 429,
  budget_exhausted: 429,
  provider_invalid_response: 502,
  provider_unavailable: 503,
  provider_timeout: 504,
  internal_error: 500,
};

const RETRYABLE: ReadonlySet<ErrorCode> = new Set<ErrorCode>([
  "rate_limited",
  "provider_unavailable",
  "provider_timeout",
]);

/**
 * A timeout or an unavailable provider after a request may already have had an
 * effect. Those cases must be reconciled, never blindly retried.
 */
const RECONCILIATION: ReadonlySet<ErrorCode> = new Set<ErrorCode>([
  "provider_timeout",
  "provider_invalid_response",
]);

export interface DomainErrorOptions {
  /** Extra safe key/value context. Must never contain payloads or secrets. */
  details?: Record<string, string | number | boolean>;
  cause?: unknown;
}

export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly reconciliationRequired: boolean;
  readonly details: Record<string, string | number | boolean>;

  constructor(code: ErrorCode, message: string, options: DomainErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "DomainError";
    this.code = code;
    this.status = STATUS[code];
    this.retryable = RETRYABLE.has(code);
    this.reconciliationRequired = RECONCILIATION.has(code);
    this.details = options.details ?? {};
  }
}

export interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    correlationId: string;
    retryable: boolean;
    reconciliationRequired: boolean;
    details: Record<string, string | number | boolean>;
  };
}

export function toErrorBody(err: DomainError, correlationId: string): ErrorBody {
  return {
    error: {
      code: err.code,
      message: err.message,
      correlationId,
      retryable: err.retryable,
      reconciliationRequired: err.reconciliationRequired,
      details: err.details,
    },
  };
}

/** Anything that is not a DomainError becomes a safe 500 without internal text. */
export function normalizeError(err: unknown): DomainError {
  if (err instanceof DomainError) return err;
  const message =
    err instanceof Error && /^(invalid_input|version_conflict|not_found)/.test(err.message)
      ? err.message
      : "internal_error";
  return new DomainError(
    message === "internal_error" ? "internal_error" : (message as ErrorCode),
    message === "internal_error" ? "Unexpected failure." : message,
    { cause: err },
  );
}
