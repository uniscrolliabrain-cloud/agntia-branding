import { z } from "zod";
import { HashHex, IsoDateTime, MoneySchema, opaqueId } from "./primitives.ts";

export const EVIDENCE_KINDS = ["fact", "inference", "user_assertion", "observation"] as const;
export const EvidenceKindSchema = z.enum(EVIDENCE_KINDS);
export type EvidenceKind = z.infer<typeof EvidenceKindSchema>;

/** Provenance record. Holding it never grants authorization. */
export const EvidenceRefSchema = z
  .object({
    id: opaqueId,
    tenantId: opaqueId,
    resourceScope: z.string().min(1).max(200),
    originalCustodian: z.string().min(1).max(120),
    sourceObjectRef: z.string().min(1).max(300),
    sourceHash: HashHex,
    mapperVersion: z.string().min(1).max(60),
    observedAt: IsoDateTime,
    effectiveAt: IsoDateTime.nullable(),
    kind: EvidenceKindSchema,
    reviewRef: opaqueId.nullable(),
  })
  .strict();

export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;

export const APPROVAL_REVIEWERS = ["owner", "competent_reviewer", "legal_reviewer", "brand_reviewer"] as const;
export const ApprovalReviewerSchema = z.enum(APPROVAL_REVIEWERS);

/**
 * Approval bound to exact material content. Any material change invalidates it.
 * Hashes are over canonical JSON of the bound scope.
 */
export const ApprovalBindingSchema = z
  .object({
    approvalId: opaqueId,
    tenantId: opaqueId,
    principalId: opaqueId,
    reviewerRole: ApprovalReviewerSchema,
    proofRef: z.string().min(1).max(300),
    payloadHash: HashHex,
    resourceVersion: z.number().int().min(0),
    rightsHash: HashHex,
    policyHash: HashHex,
    scope: z.string().min(1).max(200),
    recipient: z.string().min(1).max(200),
    channel: z.string().min(1).max(60),
    costCeiling: MoneySchema,
    expiresAt: IsoDateTime,
    revokedAt: IsoDateTime.nullable().default(null),
    revocationVersion: z.number().int().min(0).default(0),
  })
  .strict();

export type ApprovalBinding = z.infer<typeof ApprovalBindingSchema>;

export const OPERATION_STATUSES = [
  "proposed",
  "needs_review",
  "approved",
  "queued",
  "running",
  "accepted",
  "confirmed",
  "failed_definitive",
  "outcome_unknown",
  "reconciliation_required",
  "cancelled",
] as const;
export const OperationStatusSchema = z.enum(OPERATION_STATUSES);
export type OperationStatus = z.infer<typeof OperationStatusSchema>;

/**
 * What the system can honestly say after attempting an effect.
 * `accepted` is not `confirmed`; `outcome_unknown` must never be retried blindly.
 */
export const OperationResultSchema = z
  .object({
    operationId: opaqueId,
    status: OperationStatusSchema,
    localRefs: z.array(z.string().min(1).max(300)).default([]),
    remoteRefs: z.array(z.string().min(1).max(300)).default([]),
    evidenceRefs: z.array(opaqueId).default([]),
    payloadHash: HashHex,
    warnings: z.array(z.string().max(500)).default([]),
    retryable: z.boolean(),
    reconciliationRequired: z.boolean(),
    actualScope: z.string().min(1).max(400),
  })
  .strict();

export type OperationResult = z.infer<typeof OperationResultSchema>;

export const CAPABILITY_STATES = [
  "documented",
  "verified_runtime",
  "unknown",
  "unsupported",
  "forbidden",
  "not_configured",
] as const;
export const CapabilityStateSchema = z.enum(CAPABILITY_STATES);
export type CapabilityState = z.infer<typeof CapabilityStateSchema>;

export const CapabilityReportSchema = z
  .object({
    connectionId: opaqueId,
    tenantId: opaqueId,
    deployment: z.string().min(1).max(120),
    edition: z.string().min(1).max(120),
    version: z.string().min(1).max(120),
    operations: z
      .array(
        z
          .object({
            capability: z.string().min(1).max(120),
            state: CapabilityStateSchema,
            fields: z.array(z.string().min(1).max(120)).default([]),
            note: z.string().max(500).nullable().default(null),
          })
          .strict(),
      )
      .default([]),
    checkedAt: IsoDateTime,
    expiresAt: IsoDateTime.nullable(),
    errors: z.array(z.string().max(300)).default([]),
    evidenceRefs: z.array(opaqueId).default([]),
  })
  .strict();

export type CapabilityReport = z.infer<typeof CapabilityReportSchema>;

/** A capability is only usable when it was verified at runtime and is fresh. */
export function isCapabilityUsable(
  report: CapabilityReport,
  capability: string,
  now: Date,
): { usable: boolean; reason: string } {
  if (report.expiresAt && new Date(report.expiresAt).getTime() <= now.getTime()) {
    return { usable: false, reason: "capability_report_expired" };
  }
  const op = report.operations.find((o) => o.capability === capability);
  if (!op) return { usable: false, reason: "capability_not_declared" };
  if (op.state === "verified_runtime") return { usable: true, reason: "verified" };
  return { usable: false, reason: `capability_${op.state}` };
}

export const ProposalRevisionSchema = z
  .object({
    proposalId: opaqueId,
    tenantId: opaqueId,
    resourceId: opaqueId,
    resourceVersion: z.number().int().min(0),
    capability: z.string().min(1).max(120),
    structuredInputs: z.record(z.unknown()),
    artifacts: z.array(z.string().min(1).max(300)).default([]),
    sources: z.array(opaqueId).default([]),
    pendingFacts: z.array(z.string().min(1).max(300)).default([]),
    scopeHash: HashHex,
    modelConfigRef: z.string().min(1).max(200),
    policyVersion: z.string().min(1).max(60),
    warnings: z.array(z.string().max(500)).default([]),
  })
  .strict();

export type ProposalRevision = z.infer<typeof ProposalRevisionSchema>;

export const ReviewDecisionSchema = z
  .object({
    decisionId: opaqueId,
    tenantId: opaqueId,
    resourceId: opaqueId,
    resourceVersion: z.number().int().min(0),
    reviewerId: opaqueId,
    reviewerRole: ApprovalReviewerSchema,
    decision: z.enum(["approved", "rejected", "changes_requested"]),
    comment: z.string().max(2000).nullable().default(null),
    payloadHash: HashHex,
    decidedAt: IsoDateTime,
  })
  .strict();

export type ReviewDecision = z.infer<typeof ReviewDecisionSchema>;
