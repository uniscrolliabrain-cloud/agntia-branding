import {
  ApprovalBindingSchema,
  compareMoney,
  sha256Hex,
  type ApprovalBinding,
  type Money,
} from "@agntia/contracts";

export interface ApprovalSubject {
  tenantId: string;
  payload: unknown;
  resourceVersion: number;
  rights: unknown;
  policy: unknown;
  scope: string;
  recipient: string;
  channel: string;
}

export function subjectHashes(subject: ApprovalSubject) {
  return {
    payloadHash: sha256Hex(subject.payload),
    rightsHash: sha256Hex(subject.rights),
    policyHash: sha256Hex(subject.policy),
  };
}

export interface ApprovalRequest extends ApprovalSubject {
  approvalId: string;
  principalId: string;
  reviewerRole: ApprovalBinding["reviewerRole"];
  proofRef: string;
  costCeiling: Money;
  expiresAt: string;
}

/** Builds a binding over the exact material content of a proposal. */
export function createApproval(request: ApprovalRequest): ApprovalBinding {
  const hashes = subjectHashes(request);
  return ApprovalBindingSchema.parse({
    approvalId: request.approvalId,
    tenantId: request.tenantId,
    principalId: request.principalId,
    reviewerRole: request.reviewerRole,
    proofRef: request.proofRef,
    payloadHash: hashes.payloadHash,
    resourceVersion: request.resourceVersion,
    rightsHash: hashes.rightsHash,
    policyHash: hashes.policyHash,
    scope: request.scope,
    recipient: request.recipient,
    channel: request.channel,
    costCeiling: request.costCeiling,
    expiresAt: request.expiresAt,
    revokedAt: null,
    revocationVersion: 0,
  });
}

export type ApprovalFailure =
  | "tenant_mismatch"
  | "payload_changed"
  | "version_changed"
  | "rights_changed"
  | "policy_changed"
  | "scope_mismatch"
  | "recipient_mismatch"
  | "channel_mismatch"
  | "cost_exceeds_ceiling"
  | "expired"
  | "revoked"
  | "revocation_advanced";

export type ApprovalEvaluation =
  | { ok: true; approval: ApprovalBinding }
  | { ok: false; reason: ApprovalFailure };

/**
 * The single gate before a sensitive effect. Any material change, expiry or
 * revocation invalidates the approval; nothing is "grandfathered".
 */
export function evaluateApproval(
  approval: ApprovalBinding,
  subject: ApprovalSubject,
  options: { now: Date; cost: Money; revocationVersion?: number },
): ApprovalEvaluation {
  const fail = (reason: ApprovalFailure): ApprovalEvaluation => ({ ok: false, reason });

  if (approval.tenantId !== subject.tenantId) return fail("tenant_mismatch");
  if (approval.revokedAt !== null) return fail("revoked");
  if (options.revocationVersion !== undefined && options.revocationVersion > approval.revocationVersion) {
    return fail("revocation_advanced");
  }
  if (new Date(approval.expiresAt).getTime() <= options.now.getTime()) return fail("expired");

  const hashes = subjectHashes(subject);
  if (hashes.payloadHash !== approval.payloadHash) return fail("payload_changed");
  if (hashes.rightsHash !== approval.rightsHash) return fail("rights_changed");
  if (hashes.policyHash !== approval.policyHash) return fail("policy_changed");
  if (subject.resourceVersion !== approval.resourceVersion) return fail("version_changed");
  if (subject.scope !== approval.scope) return fail("scope_mismatch");
  if (subject.recipient !== approval.recipient) return fail("recipient_mismatch");
  if (subject.channel !== approval.channel) return fail("channel_mismatch");
  if (compareMoney(options.cost, approval.costCeiling) > 0) return fail("cost_exceeds_ceiling");

  return { ok: true, approval };
}

/**
 * Approver identity is a human fact, not a name. A model, an avatar or a
 * generic "approved=true" flag cannot satisfy this check.
 */
export function assertApproverIsHumanAndIndependent(input: {
  proposerId: string;
  approverId: string;
  approverKind: "human" | "agent" | "service";
  role: ApprovalBinding["reviewerRole"];
}): void {
  if (input.approverKind !== "human") throw new Error("approver must be a verified human principal");
  if (input.approverId === input.proposerId) throw new Error("proposer cannot approve its own effect");
  if (input.role === "owner" || input.role === "competent_reviewer" || input.role === "legal_reviewer" || input.role === "brand_reviewer") {
    return;
  }
  throw new Error("approver role is not allowed to approve designs");
}

export function revokeApproval(approval: ApprovalBinding, now: Date): ApprovalBinding {
  return ApprovalBindingSchema.parse({
    ...approval,
    revokedAt: now.toISOString(),
    revocationVersion: approval.revocationVersion + 1,
  });
}
