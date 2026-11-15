import { conflict, type OperationStatus } from "@agntia/contracts";
import { z } from "zod";

export const DOMAIN_STATES = [
  "brief_draft",
  "researching",
  "concept_proposed",
  "in_design",
  "needs_rights_review",
  "in_review",
  "approved",
  "released",
  "superseded",
  "revoked",
] as const;

export const DomainStateSchema = z.enum(DOMAIN_STATES);
export type DomainState = z.infer<typeof DomainStateSchema>;

const TRANSITIONS: Record<DomainState, readonly DomainState[]> = {
  brief_draft: ["researching", "revoked"],
  researching: ["concept_proposed", "revoked"],
  concept_proposed: ["in_design", "researching", "revoked"],
  in_design: ["needs_rights_review", "concept_proposed", "revoked"],
  needs_rights_review: ["in_review", "in_design", "revoked"],
  in_review: ["approved", "in_design", "revoked"],
  approved: ["released", "in_review", "superseded", "revoked"],
  released: ["superseded", "revoked"],
  superseded: [],
  revoked: [],
};

export const PROTECTED_STATES: readonly DomainState[] = ["approved", "released", "superseded", "revoked"];

export function canTransition(from: DomainState, to: DomainState): boolean {
  return TRANSITIONS[from].includes(to);
}

/**
 * Deterministic state machine. The model may propose a transition; only this
 * function decides whether it is legal.
 */
export function transition(from: DomainState, to: DomainState): DomainState {
  if (!canTransition(from, to)) {
    throw conflict(`illegal domain transition ${from} -> ${to}`);
  }
  return to;
}

export function isProtected(state: DomainState): boolean {
  return PROTECTED_STATES.includes(state);
}

export function nextStates(from: DomainState): readonly DomainState[] {
  return TRANSITIONS[from];
}

/**
 * Material change after approval never rewrites history: it supersedes the
 * approved revision and forces a new review.
 */
export function reviseApproved(current: DomainState): DomainState {
  if (current === "released" || current === "approved") return "in_review";
  if (current === "superseded" || current === "revoked") {
    throw conflict(`cannot revise a ${current} resource`);
  }
  return current;
}

const OPERATION_TRANSITIONS: Record<OperationStatus, readonly OperationStatus[]> = {
  proposed: ["needs_review", "approved", "cancelled"],
  needs_review: ["approved", "cancelled", "proposed"],
  approved: ["queued", "cancelled"],
  queued: ["running", "cancelled"],
  running: ["accepted", "failed_definitive", "outcome_unknown", "cancelled"],
  accepted: ["confirmed", "outcome_unknown", "reconciliation_required"],
  confirmed: [],
  failed_definitive: ["queued"],
  outcome_unknown: ["reconciliation_required", "confirmed", "failed_definitive"],
  reconciliation_required: ["confirmed", "failed_definitive", "outcome_unknown"],
  cancelled: [],
};

export function transitionOperation(from: OperationStatus, to: OperationStatus): OperationStatus {
  if (!OPERATION_TRANSITIONS[from].includes(to)) {
    throw conflict(`illegal operation transition ${from} -> ${to}`);
  }
  return to;
}

export function isOperationTerminal(status: OperationStatus): boolean {
  return OPERATION_TRANSITIONS[status].length === 0;
}

/**
 * A timeout after a possible remote write is uncertainty, not failure.
 * Blind retries would duplicate the effect.
 */
export function afterTimeout(previous: OperationStatus): OperationStatus {
  if (previous === "running" || previous === "accepted") return "outcome_unknown";
  return previous;
}
