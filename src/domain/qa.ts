import { DomainError } from "../contracts/errors.ts";

/**
 * QA of the produced artifact.
 *
 * Two independent checks: is the rendered text the approved text, and do the
 * signals agree? A beautiful layout with a wrong price fails. A vision model may
 * raise findings; it may not approve.
 */

export interface TextVerification {
  matches: boolean;
  mismatches: string[];
}

function normalize(value: string): string {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Numbers, names and dates are the usual silent corruption in design handoff.
 * We compare them explicitly before comparing the whole string.
 */
export function verifyRenderedText(approved: string, rendered: string): TextVerification {
  const mismatches: string[] = [];
  const approvedNumbers = approved.match(/\d+(?:[.,]\d+)?/g) ?? [];
  const renderedNumbers = rendered.match(/\d+(?:[.,]\d+)?/g) ?? [];
  if (approvedNumbers.join("|") !== renderedNumbers.join("|")) {
    mismatches.push("numeric_drift");
  }
  if (normalize(approved) !== normalize(rendered)) {
    mismatches.push("text_differs");
  }
  return { matches: mismatches.length === 0, mismatches };
}

export function assertTextFaithful(approved: string, rendered: string): void {
  const verification = verifyRenderedText(approved, rendered);
  if (!verification.matches) {
    throw new DomainError("policy_violation", "The rendered text does not match the approved text.", {
      details: { reasons: verification.mismatches.join(",") },
    });
  }
}

export interface VisualSignals {
  /** Subjective appeal score from a reviewer or model, 0..1. Advisory only. */
  appeal: number;
  textFaithful: boolean;
  contrastPasses: boolean;
  rightsSatisfied: boolean;
  geometryConstraintsMet: boolean;
}

export interface QualityDecision {
  decision: "candidate_for_approval" | "blocked";
  blockingReasons: string[];
}

/**
 * The gate is intentionally unforgiving: a high appeal score cannot rescue a
 * text mismatch, a contrast failure, a rights gap or a broken constraint.
 */
export function evaluateQuality(signals: VisualSignals): QualityDecision {
  const blockingReasons: string[] = [];
  if (!signals.textFaithful) blockingReasons.push("text_mismatch");
  if (!signals.contrastPasses) blockingReasons.push("contrast_failure");
  if (!signals.rightsSatisfied) blockingReasons.push("rights_unsatisfied");
  if (!signals.geometryConstraintsMet) blockingReasons.push("constraint_violation");
  return {
    decision: blockingReasons.length === 0 ? "candidate_for_approval" : "blocked",
    blockingReasons,
  };
}
