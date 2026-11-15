import { conflict, forbidden, needsReview, opaqueId, IsoDateTime } from "./_shared.ts";
import { z } from "zod";

/* ------------------------------------------------------------------ *
 * C39 · Privacidad y pruebas adversariales
 * ------------------------------------------------------------------ */

export const PrivacyRequestSchema = z
  .object({
    requestId: opaqueId,
    tenantId: opaqueId,
    subjectRef: z.string().min(1).max(300),
    kind: z.enum(["access", "erasure", "restriction", "portability"]),
    identityProofRef: z.string().min(1).max(300).nullable(),
    representationProofRef: z.string().min(1).max(300).nullable(),
    scope: z.array(z.string().min(1).max(200)).min(1),
    legalHold: z.boolean(),
    receivedAt: IsoDateTime,
  })
  .strict();

export type PrivacyRequest = z.infer<typeof PrivacyRequestSchema>;

export const SECRET_PATTERNS: readonly { name: string; pattern: RegExp }[] = [
  { name: "openai_style_key", pattern: /\bsk-[A-Za-z0-9]{20,}\b/ },
  { name: "github_token", pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { name: "jwt", pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
  { name: "supabase_service_role", pattern: /\bservice_role\b.*\beyJ/ },
  { name: "private_key", pattern: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "bearer_header", pattern: /\bBearer\s+[A-Za-z0-9._-]{20,}/ },
];

/** Sentinel scan used before any payload leaves the boundary or hits logs. */
export function findSecrets(text: string): string[] {
  return SECRET_PATTERNS.filter((rule) => rule.pattern.test(text)).map((rule) => rule.name);
}

export function assertNoSecrets(text: string, context: string): void {
  const found = findSecrets(text);
  if (found.length > 0) {
    throw forbidden(`secret material detected in ${context}`,);
  }
}

/**
 * A privacy request needs verified identity, plus representation when acting
 * for someone else. Erasure is blocked while a legal hold applies.
 */
export function assertPrivacyRequestProcessable(request: PrivacyRequest): void {
  if (!request.identityProofRef) throw needsReview("privacy request lacks verified identity");
  if (request.kind !== "access" && request.representationProofRef === null && request.scope.some((s) => s.startsWith("third_party:"))) {
    throw needsReview("representation proof required for third-party scope");
  }
  if (request.kind === "erasure" && request.legalHold) {
    throw conflict("erasure blocked by legal hold; restriction may apply instead");
  }
}

/** Restore must not resurrect deleted data or expired permissions. */
export function assertRestoreRespectsRestrictions(input: {
  restoredVersions: number[];
  suppressedVersions: number[];
  expiredMandates: string[];
  activeMandates: string[];
}): void {
  for (const version of input.restoredVersions) {
    if (input.suppressedVersions.includes(version)) {
      throw conflict(`restore would resurrect suppressed revision ${version}`);
    }
  }
  for (const mandate of input.activeMandates) {
    if (input.expiredMandates.includes(mandate)) {
      throw conflict(`restore would reactivate expired mandate ${mandate}`);
    }
  }
}

/* ------------------------------------------------------------------ *
 * C41 · Operaciones, flags y release
 * ------------------------------------------------------------------ */

export const FeatureFlagsSchema = z.record(z.enum(["enabled", "disabled", "canary"])).default({});

export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>;

/** Unknown or disabled capabilities stay off: no fallback to admin/default. */
export function capabilityEnabled(flags: FeatureFlags, capability: string): boolean {
  return flags[capability] === "enabled";
}

export function assertCapabilityEnabled(flags: FeatureFlags, capability: string): void {
  if (!capabilityEnabled(flags, capability)) {
    throw forbidden(`capability ${capability} is disabled`);
  }
}

export interface ReleaseGateInput {
  testsExecuted: number;
  testsPassed: number;
  criticalFindings: number;
  blockingGates: string[];
  rollbackDocumented: boolean;
  backupRestoreVerified: boolean;
}

export function evaluateReleaseGate(input: ReleaseGateInput): { releasable: boolean; blockers: string[] } {
  const blockers: string[] = [];
  if (input.testsExecuted === 0) blockers.push("no_tests_executed");
  if (input.testsPassed < input.testsExecuted) blockers.push("tests_failing");
  if (input.criticalFindings > 0) blockers.push("critical_findings_open");
  if (input.blockingGates.length > 0) blockers.push(...input.blockingGates.map((g) => `gate_${g}`));
  if (!input.rollbackDocumented) blockers.push("rollback_undocumented");
  if (!input.backupRestoreVerified) blockers.push("restore_unverified");
  return { releasable: blockers.length === 0, blockers };
}

/* ------------------------------------------------------------------ *
 * C42 · Aceptación, evidencia y handoff final
 * ------------------------------------------------------------------ */

export const PHASE_STATUSES = ["PASS", "BLOCKED", "NOT_VERIFIED", "NOT_STARTED", "FAIL"] as const;
export const PhaseStatusSchema = z.enum(PHASE_STATUSES);
export type PhaseStatus = z.infer<typeof PhaseStatusSchema>;

export const PhaseEvidenceSchema = z
  .object({
    phaseId: z.string().regex(/^BRD-C\d{2}$/),
    status: PhaseStatusSchema,
    tasksTotal: z.number().int().min(0),
    tasksPassed: z.number().int().min(0),
    gatesExecuted: z.number().int().min(0),
    gatesPassed: z.number().int().min(0),
    evidenceRefs: z.array(z.string().min(1).max(300)).default([]),
    testsExecuted: z.number().int().min(0),
  })
  .strict();

export type PhaseEvidence = z.infer<typeof PhaseEvidenceSchema>;

export interface AcceptanceMatrix {
  phases: PhaseEvidence[];
  summary: { total: number; pass: number; blocked: number; notVerified: number; notStarted: number; failed: number };
  repoComplete: boolean;
  disclaimers: string[];
}

/**
 * A phase may only claim PASS when it has executed tests and evidence.
 * Documentation alone, a mock or a plan is downgraded to NOT_VERIFIED.
 */
export function buildAcceptanceMatrix(phases: PhaseEvidence[]): AcceptanceMatrix {
  const disclaimers: string[] = [];
  const normalized = phases.map((phase) => {
    if (phase.status === "PASS" && (phase.testsExecuted === 0 || phase.evidenceRefs.length === 0)) {
      disclaimers.push(`${phase.phaseId}: PASS downgraded to NOT_VERIFIED (no executed tests or evidence)`);
      return { ...phase, status: "NOT_VERIFIED" as PhaseStatus };
    }
    if (phase.status === "PASS" && phase.tasksPassed < phase.tasksTotal) {
      disclaimers.push(`${phase.phaseId}: PASS kept but tasks ${phase.tasksPassed}/${phase.tasksTotal}`);
    }
    return phase;
  });

  const summary = {
    total: normalized.length,
    pass: normalized.filter((p) => p.status === "PASS").length,
    blocked: normalized.filter((p) => p.status === "BLOCKED").length,
    notVerified: normalized.filter((p) => p.status === "NOT_VERIFIED").length,
    notStarted: normalized.filter((p) => p.status === "NOT_STARTED").length,
    failed: normalized.filter((p) => p.status === "FAIL").length,
  };

  const repoComplete =
    summary.total === 42 && summary.pass === 42 && normalized.every((p) => p.gatesPassed >= 2 && p.testsExecuted > 0);

  return { phases: normalized, summary, repoComplete, disclaimers };
}
