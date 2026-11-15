import { z } from "zod";
import { contentHash } from "../contracts/evidence.ts";
import { DomainError } from "../contracts/errors.ts";

/**
 * An approval authorizes ONE material thing. It is bound by hash to the content,
 * the resource version, the rights state, the policy version, the recipient and
 * the cost ceiling. Any material edit invalidates it — that is the whole point:
 * approving a draft must not silently approve what the draft became.
 */
export const approvalBindingSchema = z
  .object({
    id: z.string().min(8).max(128),
    tenantId: z.string().min(1).max(128),
    resourceType: z.enum(["work_order", "design_document", "export_manifest", "brandbook", "deliverable"]),
    resourceId: z.string().min(1).max(128),
    /** Verified human. A model may not appear here. */
    reviewerId: z.string().min(1).max(128),
    reviewerRole: z.enum(["owner", "reviewer"]),
    payloadHash: z.string().regex(/^[a-f0-9]{64}$/),
    resourceVersion: z.number().int().nonnegative(),
    rightsHash: z.string().regex(/^[a-f0-9]{64}$/),
    policyHash: z.string().regex(/^[a-f0-9]{64}$/),
    recipient: z.string().min(1).max(256).nullable(),
    channel: z.enum(["portal", "email_link", "download", "none"]),
    /** Decimal string, never a float: money must not lose precision. */
    costCeiling: z.string().regex(/^\d+(\.\d{1,6})?$/),
    currency: z.string().length(3),
    issuedAt: z.string().datetime({ offset: true }),
    expiresAt: z.string().datetime({ offset: true }),
    revokedAt: z.string().datetime({ offset: true }).nullable(),
    revocationVersion: z.number().int().nonnegative(),
  })
  .strict();

export type ApprovalBinding = z.infer<typeof approvalBindingSchema>;

/** Material fields. Everything here changes the meaning of the approval. */
export const APPROVAL_MATERIAL_FIELDS = [
  "tenantId",
  "resourceType",
  "resourceId",
  "payloadHash",
  "resourceVersion",
  "rightsHash",
  "policyHash",
  "recipient",
  "channel",
  "costCeiling",
  "currency",
] as const;

export function approvalHash(binding: ApprovalBinding): string {
  const material: Record<string, unknown> = {};
  for (const field of APPROVAL_MATERIAL_FIELDS) material[field] = binding[field];
  return contentHash(material);
}

export interface ApprovalExpectation {
  tenantId: string;
  resourceType: ApprovalBinding["resourceType"];
  resourceId: string;
  payloadHash: string;
  resourceVersion: number;
  rightsHash: string;
  policyHash: string;
  recipient: string | null;
  channel: ApprovalBinding["channel"];
  now: Date;
}

/**
 * Fail-closed verification. Every mismatch is a distinct, auditable reason.
 */
export function verifyApproval(binding: ApprovalBinding, expected: ApprovalExpectation): void {
  if (binding.revokedAt !== null) {
    throw new DomainError("approval_invalid", "The approval was revoked.", {
      details: { reason: "revoked" },
    });
  }
  if (Date.parse(binding.expiresAt) <= expected.now.getTime()) {
    throw new DomainError("approval_invalid", "The approval has expired.", {
      details: { reason: "expired" },
    });
  }
  if (binding.tenantId !== expected.tenantId) {
    throw new DomainError("approval_invalid", "The approval belongs to another tenant.", {
      details: { reason: "tenant_mismatch" },
    });
  }
  if (binding.resourceType !== expected.resourceType || binding.resourceId !== expected.resourceId) {
    throw new DomainError("approval_invalid", "The approval covers a different resource.", {
      details: { reason: "resource_mismatch" },
    });
  }
  if (binding.payloadHash !== expected.payloadHash) {
    throw new DomainError("approval_invalid", "The approved content changed.", {
      details: { reason: "payload_changed" },
    });
  }
  if (binding.resourceVersion !== expected.resourceVersion) {
    throw new DomainError("approval_invalid", "The approved version is not the current version.", {
      details: { reason: "version_changed" },
    });
  }
  if (binding.rightsHash !== expected.rightsHash) {
    throw new DomainError("approval_invalid", "Rights state changed since approval.", {
      details: { reason: "rights_changed" },
    });
  }
  if (binding.policyHash !== expected.policyHash) {
    throw new DomainError("approval_invalid", "Policy changed since approval.", {
      details: { reason: "policy_changed" },
    });
  }
  if (binding.recipient !== expected.recipient || binding.channel !== expected.channel) {
    throw new DomainError("approval_invalid", "The recipient or channel changed.", {
      details: { reason: "recipient_or_channel_changed" },
    });
  }
}

/**
 * The proponent may not approve their own effect, and an approval may not be
 * widened afterwards by editing fields.
 */
export function assertIndependentReviewer(binding: ApprovalBinding, proponentId: string): void {
  if (binding.reviewerId === proponentId) {
    throw new DomainError("policy_violation", "The proponent cannot approve their own effect.", {
      details: { reason: "self_approval" },
    });
  }
}
