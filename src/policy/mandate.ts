import { z } from "zod";
import { DomainError } from "../contracts/errors.ts";

/**
 * The canonical agent lives in the parent. Here we only hold a delegated twin,
 * and this mandate is the entire basis of its authority: a bounded slice of
 * capabilities, for one work order, on one target tenant, until it expires or is
 * revoked. Name, avatar or persona add nothing to it.
 */
export const mandateSchema = z
  .object({
    id: z.string().min(8).max(128),
    canonicalAgentRef: z.string().min(1).max(128),
    localInstanceId: z.string().min(1).max(128),
    /** Tenant of the actor that granted the delegation. */
    originatingActorId: z.string().min(1).max(128),
    originatingTenantId: z.string().min(1).max(128),
    /** Tenant the twin acts upon. Kept strictly separate from the origin. */
    targetTenantId: z.string().min(1).max(128),
    workOrderId: z.string().min(1).max(128),
    capabilities: z.array(z.string().min(3).max(96)).min(1).max(64),
    purpose: z.enum([
      "brand_strategy",
      "naming",
      "verbal_identity",
      "visual_identity",
      "design_system",
      "asset_governance",
      "delivery",
    ]),
    budgetRef: z.string().min(1).max(128).nullable(),
    issuedAt: z.string().datetime({ offset: true }),
    expiresAt: z.string().datetime({ offset: true }),
    revocationVersion: z.number().int().nonnegative(),
    proofRef: z.string().min(1).max(256),
  })
  .strict();

export type DelegationMandate = z.infer<typeof mandateSchema>;

export interface MandateCheck {
  now: Date;
  /** Highest revocation version observed by the server, from the parent. */
  currentRevocationVersion: number;
  capability: string;
  targetTenantId: string;
}

/**
 * Revalidated before EVERY job, not once at session start. A queued job whose
 * mandate expired must not execute: state and history survive, new effects stop.
 */
export function assertMandateUsable(mandate: DelegationMandate, check: MandateCheck): void {
  if (mandate.revocationVersion < check.currentRevocationVersion) {
    throw new DomainError("policy_violation", "The delegation mandate was revoked.", {
      details: { reason: "revoked_mandate", mandateId: mandate.id },
    });
  }
  if (Date.parse(mandate.expiresAt) <= check.now.getTime()) {
    throw new DomainError("policy_violation", "The delegation mandate expired.", {
      details: { reason: "expired_mandate", mandateId: mandate.id },
    });
  }
  if (mandate.targetTenantId !== check.targetTenantId) {
    throw new DomainError("scope_forbidden", "The mandate targets another tenant.", {
      details: { reason: "target_tenant_mismatch" },
    });
  }
  if (!mandate.capabilities.includes(check.capability)) {
    throw new DomainError("scope_forbidden", "The mandate does not cover this capability.", {
      details: { reason: "capability_outside_mandate", capability: check.capability },
    });
  }
}

/**
 * A mandate may not be widened by the twin itself. Only a new grant from the
 * originating tenant can add a capability, a tenant or budget.
 */
export function assertNoMandateWidening(previous: DelegationMandate, next: DelegationMandate): void {
  const added = next.capabilities.filter((c) => !previous.capabilities.includes(c));
  if (
    added.length > 0 ||
    next.targetTenantId !== previous.targetTenantId ||
    next.originatingTenantId !== previous.originatingTenantId ||
    next.workOrderId !== previous.workOrderId ||
    next.budgetRef !== previous.budgetRef
  ) {
    throw new DomainError("policy_violation", "A mandate cannot widen its own scope.", {
      details: { reason: "mandate_widening" },
    });
  }
}
