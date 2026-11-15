import { ApiError } from "@agntia/contracts";

export {
  ApiError,
  conflict,
  forbidden,
  invalid,
  notFound,
  opaqueId,
  IsoDateTime,
  MoneySchema,
  HashHex,
  ApprovalBindingSchema,
  OperationResultSchema,
  CapabilityReportSchema,
  canonicalJson,
  sha256Hex,
  sha256Base64Url,
  money,
  addMoney,
  subMoney,
  compareMoney,
  isZeroMoney,
  toMinorUnits,
  fromMinorUnits,
  ZERO_MONEY,
  isCapabilityUsable,
} from "@agntia/contracts";

export type {
  Money,
  ApprovalBinding,
  OperationResult,
  OperationStatus,
  CapabilityReport,
  CapabilityState,
  EvidenceRef,
  EvidenceKind,
} from "@agntia/contracts";

/** 422: the proposal is coherent but a human decision is required first. */
export function needsReview(message: string, details?: Record<string, unknown>): ApiError {
  return new ApiError("needs_review", message, { details });
}

/** 403: capability exists but is not granted for this resource/field. */
export function capabilityDenied(message: string): ApiError {
  return new ApiError("forbidden", message);
}
