import { z } from "zod";
import { DomainError } from "../contracts/errors.ts";

/**
 * Learning in this service is procedural and tenant-scoped. It never copies one
 * client's private material into another client's context, and it never
 * activates itself: a proposal must pass replay and a human review.
 */

export const procedureProposalSchema = z
  .object({
    id: z.string().min(8).max(128),
    tenantId: z.string().min(1).max(128),
    title: z.string().min(3).max(160),
    steps: z.array(z.string().min(3).max(500)).min(1).max(32),
    evidenceRefs: z.array(z.string().min(1).max(256)).min(1).max(32),
    /** Replay against recorded cases must have run before activation. */
    replayPassed: z.boolean(),
    replaySummary: z.string().max(500).nullable(),
    status: z.enum(["proposed", "approved", "active", "rejected"]),
    proposedBy: z.string().min(1).max(128),
    reviewedBy: z.string().min(1).max(128).nullable(),
  })
  .strict();

export type ProcedureProposal = z.infer<typeof procedureProposalSchema>;

export function proposeProcedure(input: Omit<ProcedureProposal, "status" | "reviewedBy">): ProcedureProposal {
  if (input.evidenceRefs.length === 0) {
    throw new DomainError("invalid_input", "A procedure needs evidence from its own tenant.", {
      details: { reason: "missing_evidence" },
    });
  }
  return { ...input, status: "proposed", reviewedBy: null };
}

/**
 * Activation requires: replay passed, and a reviewer who is not the proponent.
 * There is no auto-activation path in this codebase.
 */
export function activateProcedure(proposal: ProcedureProposal, reviewerId: string): ProcedureProposal {
  if (!proposal.replayPassed) {
    throw new DomainError("policy_violation", "A procedure without a passing replay cannot be activated.", {
      details: { proposalId: proposal.id, reason: "replay_not_run" },
    });
  }
  if (reviewerId === proposal.proposedBy) {
    throw new DomainError("policy_violation", "The proponent cannot approve their own procedure.", {
      details: { reason: "self_approval" },
    });
  }
  return { ...proposal, status: "active", reviewedBy: reviewerId };
}

/** Cross-tenant reuse of a learned procedure is a leak, not an optimization. */
export function assertTenantScopedLearning(proposal: ProcedureProposal, targetTenantId: string): void {
  if (proposal.tenantId !== targetTenantId) {
    throw new DomainError("scope_forbidden", "A learned procedure cannot be reused across tenants.", {
      details: { proposalTenant: proposal.tenantId },
    });
  }
}
