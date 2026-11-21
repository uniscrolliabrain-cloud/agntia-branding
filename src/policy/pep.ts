import { getCapability, type CapabilitySpec } from "../contracts/capabilities.ts";
import { sliceDeclaring } from "../slices/registry.ts";
import { DomainError } from "../contracts/errors.ts";
import type { Principal, ResourceScope } from "../auth/principal.ts";
import { isResourceInScope, principalHasCapability } from "../auth/principal.ts";
import type { OperationEnvelope } from "../contracts/envelope.ts";
import type { MemoryStore } from "../store/memory-store.ts";
import { approvalHash, assertIndependentReviewer, verifyApproval, type ApprovalBinding } from "./approval.ts";

/**
 * The Policy Enforcement Point. Every entry point — HTTP route, SDK call, model
 * tool, future MCP bridge — goes through this function, so there is exactly one
 * place where "may this happen?" is decided.
 *
 * Order matters: unknown capability, then capability grant, then resource scope,
 * then approval. Denying early keeps the audit reason unambiguous.
 */
export interface PepInput {
  principal: Principal;
  envelope: OperationEnvelope;
  resourceType?: ResourceScope["resourceType"];
  resourceId?: string | null;
  /** Material state the approval must be bound to. Required when approval applies. */
  bindings?: {
    /** Hash of the exact material about to be produced or sent. */
    payloadHash: string;
    /** Version of the resource the material was derived from. */
    resourceVersion: number;
    rightsHash: string;
    policyHash: string;
    recipient: string | null;
    channel: ApprovalBinding["channel"];
  };
}

export interface PepResult {
  spec: CapabilitySpec;
  approval: ApprovalBinding | null;
}

export function enforcePolicy(input: PepInput, store: MemoryStore): PepResult {
  const { principal, envelope } = input;
  const audit = (outcome: "allowed" | "denied" | "blocked", reason: string | null): void => {
    store.recordAudit({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      capability: envelope.capability,
      outcome,
      reason,
      correlationId: envelope.correlationId,
    });
  };

  const spec = getCapability(envelope.capability);
  if (!spec) {
    audit("denied", "unsupported_capability");
    throw new DomainError("unsupported_capability", "Unknown capability.", {
      details: { capability: envelope.capability },
    });
  }

  // The envelope tenant is server-composed, but the principal is the authority.
  if (envelope.tenantId !== principal.tenantId) {
    audit("denied", "tenant_mismatch");
    throw new DomainError("scope_forbidden", "Operation tenant does not match the principal.");
  }

  // A vertical slice that is not activated cannot be invoked, even by an owner.
  // The capability exists, so the error is about availability, not about rights.
  if (!store.activation.isCapabilityEnabled(spec.name)) {
    audit("blocked", "slice_disabled");
    throw new DomainError("unsupported_capability", "The vertical slice for this capability is not activated.", {
      details: { capability: spec.name, slice: sliceDeclaring(spec.name) ?? "unknown" },
    });
  }

  if (!principalHasCapability(principal, spec.name)) {
    audit("denied", "capability_not_granted");
    throw new DomainError("scope_forbidden", "The principal does not hold this capability.", {
      details: { capability: spec.name },
    });
  }

  if (input.resourceType !== undefined && !isResourceInScope(principal, input.resourceType, input.resourceId ?? null)) {
    audit("denied", "resource_out_of_scope");
    throw new DomainError("scope_forbidden", "The resource is outside the principal's scope.", {
      details: { resourceType: input.resourceType },
    });
  }

  let approval: ApprovalBinding | null = null;
  const needsApproval = spec.requiresApproval;

  if (needsApproval) {
    if (!envelope.approvalRef) {
      audit("blocked", "approval_required");
      throw new DomainError("approval_required", "This capability requires an approval.");
    }
    const found = store.getApproval(principal.tenantId, envelope.approvalRef);
    if (!found) {
      audit("denied", "approval_not_found");
      throw new DomainError("approval_invalid", "Approval reference not found.");
    }
    const bindings = input.bindings;
    if (!bindings) {
      audit("blocked", "approval_bindings_missing");
      throw new DomainError("approval_invalid", "Approval cannot be verified without material bindings.");
    }
    verifyApproval(found, {
      tenantId: principal.tenantId,
      resourceType: found.resourceType,
      resourceId: found.resourceId,
      payloadHash: bindings.payloadHash,
      resourceVersion: bindings.resourceVersion,
      rightsHash: bindings.rightsHash,
      policyHash: bindings.policyHash,
      recipient: bindings.recipient,
      channel: bindings.channel,
      now: new Date(),
    });
    assertIndependentReviewer(found, principal.userId);
    approval = found;
  }

  // A dry run never requires an approval, but it also never produces an effect.
  audit("allowed", envelope.dryRun ? "dry_run" : null);
  return { spec, approval };
}

/** Stable hash for an approval, exposed for route handlers that create one. */
export const hashApproval = approvalHash;
