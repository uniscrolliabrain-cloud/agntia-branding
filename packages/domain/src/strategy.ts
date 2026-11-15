import { ApiError, opaqueId, needsReview, invalid, IsoDateTime } from "./_shared.ts";
import { z } from "zod";

/* ------------------------------------------------------------------ *
 * C09 · Brief y estrategia
 * ------------------------------------------------------------------ */

export const BrandBriefSchema = z
  .object({
    briefId: opaqueId,
    tenantId: opaqueId,
    resourceId: opaqueId,
    version: z.number().int().min(0),
    purpose: z.string().min(3).max(500).nullable(),
    audienceDeclared: z.string().min(1).max(500).nullable(),
    deliverables: z.array(z.string().min(1).max(200)).min(1),
    constraints: z.array(z.string().min(1).max(300)).default([]),
    acceptance: z.array(z.string().min(1).max(300)).min(1),
    pendingFacts: z.array(z.string().min(1).max(300)).default([]),
  })
  .strict();

export type BrandBrief = z.infer<typeof BrandBriefSchema>;

/**
 * A brief without purpose or audience stays pending. The system never fills
 * unknown context with plausible fiction to make a form look complete.
 */
export function proposeBrief(input: Omit<BrandBrief, "pendingFacts" | "version"> & { version?: number }): BrandBrief {
  const pending: string[] = [];
  if (!input.purpose) pending.push("purpose_not_declared");
  if (!input.audienceDeclared) pending.push("audience_not_declared");
  return BrandBriefSchema.parse({
    ...input,
    version: input.version ?? 0,
    pendingFacts: pending,
  });
}

export function isBriefReady(brief: BrandBrief): boolean {
  return brief.pendingFacts.length === 0;
}

/* ------------------------------------------------------------------ *
 * C10 · Investigación de marca
 * ------------------------------------------------------------------ */

export const USAGE_RIGHTS = ["licensed", "reference_only", "unlicensed", "unknown"] as const;
export const UsageRightsSchema = z.enum(USAGE_RIGHTS);

export const ResearchSourceSchema = z
  .object({
    sourceId: opaqueId,
    tenantId: opaqueId,
    url: z.string().url(),
    observedAt: IsoDateTime,
    usageRights: UsageRightsSchema,
    licenseRef: z.string().min(1).max(200).nullable(),
    inferenceLabel: z.enum(["fact", "inference", "observation"]),
    untrustedContent: z.literal(true),
  })
  .strict();

export type ResearchSource = z.infer<typeof ResearchSourceSchema>;

const DIRECTIVE_PATTERNS = [
  /ignore (all )?(previous|prior) instructions/i,
  /system prompt/i,
  /you are now/i,
  /ejecuta (el )?siguiente comando/i,
  /export(a|á)? (los )?(secretos|tokens)/i,
];

/** Fetched documents are data, never instructions. */
export function assertNoEmbeddedDirectives(text: string): void {
  for (const pattern of DIRECTIVE_PATTERNS) {
    if (pattern.test(text)) {
      throw new ApiError("invalid_input", "untrusted source contains instruction-like content; treated as data only", {
        details: { quarantine: true },
      });
    }
  }
}

export function assertResearchUsable(source: ResearchSource, purpose: "analysis" | "redistribution"): void {
  if (purpose === "analysis") return;
  if (source.usageRights !== "licensed" || !source.licenseRef) {
    throw needsReview("source is not licensed for redistribution", { sourceId: source.sourceId });
  }
}

/* ------------------------------------------------------------------ *
 * C11 · Naming y opciones
 * ------------------------------------------------------------------ */

export const NameCandidateSchema = z
  .object({
    candidateId: opaqueId,
    tenantId: opaqueId,
    name: z.string().min(1).max(120),
    locale: z.string().min(2).max(12),
    rationale: z.string().min(1).max(1000),
    uncertainty: z.enum(["low", "medium", "high"]),
    clearanceStatus: z.literal("not_checked"),
  })
  .strict();

export type NameCandidate = z.infer<typeof NameCandidateSchema>;

const LEGAL_CLAIM_PATTERNS = [
  /\b(legalmente|jur[ií]dic(amente)?) (disponible|libre|protegid[oa])\b/i,
  /\b(registrable|registrado|trademark cleared|cleared for use|exclusiv[oa])\b/i,
  /\bno (existe|hay) (conflicto|riesgo) (de marca|registral)\b/i,
];

/** A generated name is a proposal, never a legal availability statement. */
export function assertNoLegalClaim(text: string): void {
  for (const pattern of LEGAL_CLAIM_PATTERNS) {
    if (pattern.test(text)) {
      throw invalid("naming output cannot claim legal availability or exclusivity");
    }
  }
}

export function proposeNameCandidates(
  candidates: Omit<NameCandidate, "clearanceStatus" | "candidateId" | "tenantId">[],
  ids: { tenantId: string; newId: (index: number) => string },
): NameCandidate[] {
  return candidates.map((candidate, index) => {
    assertNoLegalClaim(`${candidate.name} ${candidate.rationale}`);
    return NameCandidateSchema.parse({
      ...candidate,
      candidateId: ids.newId(index),
      tenantId: ids.tenantId,
      clearanceStatus: "not_checked",
    });
  });
}

/* ------------------------------------------------------------------ *
 * C12 · Clearance preliminar
 * ------------------------------------------------------------------ */

export const CLEARANCE_RESULTS = ["preliminary_no_conflict", "conflict", "needs_review", "insufficient_scope"] as const;

export const ClearanceCheckSchema = z
  .object({
    checkId: opaqueId,
    tenantId: opaqueId,
    candidateId: opaqueId,
    registrySource: z.string().min(1).max(200),
    territory: z.string().min(2).max(60),
    classScope: z.array(z.string().min(1).max(20)).min(1),
    requiredClasses: z.array(z.string().min(1).max(20)).default([]),
    checkedAt: IsoDateTime,
    reviewer: opaqueId.nullable(),
    result: z.enum(CLEARANCE_RESULTS),
  })
  .strict();

export type ClearanceCheck = z.infer<typeof ClearanceCheckSchema>;

/**
 * Preliminary clearance can never produce a universal "cleared" verdict:
 * incomplete class coverage or a missing reviewer downgrades it.
 */
export function evaluateClearance(input: {
  check: Omit<ClearanceCheck, "result">;
  claimed: (typeof CLEARANCE_RESULTS)[number];
}): ClearanceCheck {
  const missing = input.check.requiredClasses.filter((c) => !input.check.classScope.includes(c));
  let result = input.claimed;
  if (missing.length > 0) result = "insufficient_scope";
  else if (!input.check.reviewer && result === "preliminary_no_conflict") result = "needs_review";
  return ClearanceCheckSchema.parse({ ...input.check, result });
}

/* ------------------------------------------------------------------ *
 * C13 · Identidad verbal
 * ------------------------------------------------------------------ */

export const VoiceClaimSchema = z
  .object({
    text: z.string().min(1).max(500),
    evidenceRef: opaqueId.nullable(),
    permissionRef: opaqueId.nullable(),
  })
  .strict();

export const VoiceProfileSchema = z
  .object({
    profileId: opaqueId,
    tenantId: opaqueId,
    tone: z.array(z.string().min(1).max(60)).min(1),
    lexicon: z.array(z.string().min(1).max(60)).default([]),
    claims: z.array(VoiceClaimSchema).default([]),
    localeRules: z.record(z.string().min(1).max(300)).default({}),
  })
  .strict();

export type VoiceProfile = z.infer<typeof VoiceProfileSchema>;

/** Testimonials and promises require a source and a permission. */
export function validateVoiceProfile(profile: VoiceProfile): VoiceProfile {
  for (const claim of profile.claims) {
    if (!claim.evidenceRef || !claim.permissionRef) {
      throw needsReview("voice claim lacks evidence or permission", { claim: claim.text });
    }
  }
  return profile;
}

/* ------------------------------------------------------------------ *
 * C14 · Direcciones visuales
 * ------------------------------------------------------------------ */

export const MoodSourceSchema = z
  .object({
    ref: z.string().min(1).max(300),
    rightsRef: opaqueId.nullable(),
    role: z.enum(["inspiration", "reference", "licensed_asset"]),
  })
  .strict();

export type MoodSource = z.infer<typeof MoodSourceSchema>;

export const VisualConceptSchema = z
  .object({
    conceptId: opaqueId,
    tenantId: opaqueId,
    conceptRef: opaqueId,
    moodSources: z.array(MoodSourceSchema).default([]),
    designRationale: z.string().min(1).max(2000),
  })
  .strict();

export type VisualConcept = z.infer<typeof VisualConceptSchema>;

/** Inspiration is not a license: only licensed_asset may reach a deliverable. */
export function assertConceptRights(concept: VisualConcept): void {
  for (const source of concept.moodSources) {
    if (source.role === "licensed_asset" && !source.rightsRef) {
      throw needsReview("licensed asset mood source has no rights reference", { ref: source.ref });
    }
  }
}

export function deliverableMoodSources(concept: VisualConcept): MoodSource[] {
  return concept.moodSources.filter((s) => s.role === "licensed_asset");
}
