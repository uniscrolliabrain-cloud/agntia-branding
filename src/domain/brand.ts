import { z } from "zod";
import { contentHash } from "../contracts/evidence.ts";
import { DomainError } from "../contracts/errors.ts";
import type { AssetRights, AssetPurpose } from "./rights.ts";

/**
 * Brand strategy through brandbook. Every function here is deterministic: the
 * model may propose inputs, but the rules that decide state live in code.
 */

// ---------------------------------------------------------------------------
// Brief
// ---------------------------------------------------------------------------

export const briefSchema = z
  .object({
    id: z.string().min(1).max(128),
    tenantId: z.string().min(1).max(128),
    version: z.number().int().nonnegative(),
    state: z.enum(["brief_draft", "researching", "concept_proposed", "in_design", "needs_rights_review", "in_review", "approved", "released", "superseded", "revoked"]),
    purpose: z.enum(["rebrand", "new_brand", "extension", "refresh"]),
    /** Declared by the client. Never inferred from demographic guessing. */
    audienceDeclared: z.string().min(3).max(500),
    deliverables: z.array(z.string().min(2).max(80)).min(1).max(32),
    constraints: z.array(z.string().min(2).max(200)).max(32),
    acceptance: z.array(z.string().min(3).max(200)).min(1).max(32),
    objective: z.string().min(3).max(500),
    sources: z.array(z.string().min(1).max(256)).max(32),
  })
  .strict();

export type BrandBrief = z.infer<typeof briefSchema>;

export function createBrief(input: Omit<BrandBrief, "state" | "version">): BrandBrief {
  if (input.sources.length === 0) {
    // A brief without a source is a pending item, not a plausible default.
    throw new DomainError("invalid_input", "A brief needs at least one declared source.", {
      details: { reason: "missing_source" },
    });
  }
  return briefSchema.parse({ ...input, state: "brief_draft", version: 0 });
}

/** Changing the objective creates a new version; it never rewrites the old one. */
export function reviseObjective(brief: BrandBrief, objective: string): BrandBrief {
  if (brief.state === "approved" || brief.state === "released") {
    return briefSchema.parse({
      ...brief,
      id: `${brief.id}-v${brief.version + 1}`,
      version: brief.version + 1,
      objective,
      state: "brief_draft",
    });
  }
  return briefSchema.parse({ ...brief, version: brief.version + 1, objective });
}

// ---------------------------------------------------------------------------
// Naming
// ---------------------------------------------------------------------------

export const nameCandidateSchema = z
  .object({
    id: z.string().min(1).max(64),
    name: z.string().min(2).max(64),
    locale: z.enum(["es", "en", "fr"]),
    rationale: z.string().min(3).max(500),
    /** A suggestion is never an availability claim. */
    legalAvailability: z.literal("unknown"),
    conflicts: z.array(z.string().max(200)).max(16),
    uncertainty: z.enum(["low", "medium", "high"]),
  })
  .strict();

export type NameCandidate = z.infer<typeof nameCandidateSchema>;

export function validateNameCandidates(candidates: readonly NameCandidate[]): NameCandidate[] {
  if (candidates.length === 0) throw new DomainError("invalid_input", "At least one candidate is required.");
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const normalized = candidate.name.toLowerCase().trim();
    if (seen.has(normalized)) {
      throw new DomainError("invalid_input", "Duplicate candidate name.", { details: { name: candidate.name } });
    }
    seen.add(normalized);
    if (/[\u0000-\u001f]/.test(candidate.name)) {
      throw new DomainError("invalid_input", "Candidate contains control characters.");
    }
    if (candidate.conflicts.length > 0 && candidate.uncertainty === "low") {
      throw new DomainError("invalid_input", "A candidate with known conflicts cannot claim low uncertainty.", {
        details: { name: candidate.name },
      });
    }
  }
  return [...candidates];
}

// ---------------------------------------------------------------------------
// Preliminary clearance
// ---------------------------------------------------------------------------

/**
 * Preliminary clearance is not a legal opinion. The strongest verdict this
 * service can emit is "no conflict observed", and it always requires a
 * professional review before any filing or launch.
 */
export const clearanceVerdictSchema = z.enum(["inconclusive", "no_conflict_observed"]);

export type ClearanceVerdict = z.infer<typeof clearanceVerdictSchema>;

export interface ClearanceCheck {
  id: string;
  candidateId: string;
  registrySource: string;
  territory: string;
  classScope: string[];
  checkedAt: string;
  /** How many register classes were actually queried. */
  classesQueried: number;
  classesRequested: number;
  observations: string[];
  verdict: ClearanceVerdict;
  professionalReviewRequired: true;
}

export function runClearance(input: {
  id: string;
  candidateId: string;
  registrySource: string;
  territory: string;
  classScope: string[];
  classesQueried: number;
  observations: string[];
  now: Date;
}): ClearanceCheck {
  const complete = input.classesQueried >= input.classScope.length && input.observations.length === 0;
  return {
    id: input.id,
    candidateId: input.candidateId,
    registrySource: input.registrySource,
    territory: input.territory,
    classScope: [...input.classScope],
    checkedAt: input.now.toISOString(),
    classesQueried: input.classesQueried,
    classesRequested: input.classScope.length,
    observations: [...input.observations],
    verdict: complete ? "no_conflict_observed" : "inconclusive",
    professionalReviewRequired: true,
  };
}

// ---------------------------------------------------------------------------
// Verbal identity
// ---------------------------------------------------------------------------

export const claimSchema = z
  .object({
    id: z.string().min(1).max(64),
    text: z.string().min(3).max(500),
    evidenceRef: z.string().min(1).max(256).nullable(),
    permissionRef: z.string().min(1).max(256).nullable(),
    kind: z.enum(["product_fact", "testimonial", "aspiration"]),
  })
  .strict();

export type Claim = z.infer<typeof claimSchema>;

/**
 * A testimonial needs both a source and a permission. An aspiration may not be
 * phrased as a fact. Anything else is blocked, not softened.
 */
export function assertClaimUsable(claim: Claim): void {
  if (claim.kind === "testimonial" && (claim.evidenceRef === null || claim.permissionRef === null)) {
    throw new DomainError("policy_violation", "A testimonial needs a source and a written permission.", {
      details: { claimId: claim.id, reason: "testimonial_without_consent" },
    });
  }
  if (claim.kind === "product_fact" && claim.evidenceRef === null) {
    throw new DomainError("policy_violation", "A product claim needs evidence.", {
      details: { claimId: claim.id, reason: "fact_without_evidence" },
    });
  }
}

export const voiceProfileSchema = z
  .object({
    id: z.string().min(1).max(128),
    tenantId: z.string().min(1).max(128),
    tone: z.array(z.string().min(2).max(48)).min(1).max(12),
    lexicon: z.array(z.string().min(1).max(48)).max(64),
    forbidden: z.array(z.string().min(1).max(48)).max(64),
    localeRules: z.record(z.string()),
    claims: z.array(claimSchema).max(64),
  })
  .strict();

export type VoiceProfile = z.infer<typeof voiceProfileSchema>;

export function validateVoiceProfile(profile: VoiceProfile): VoiceProfile {
  voiceProfileSchema.parse(profile);
  for (const claim of profile.claims) assertClaimUsable(claim);
  const overlap = profile.lexicon.filter((word) => profile.forbidden.includes(word));
  if (overlap.length > 0) {
    throw new DomainError("invalid_input", "A word cannot be both preferred and forbidden.", {
      details: { words: overlap.join(",") },
    });
  }
  return profile;
}

// ---------------------------------------------------------------------------
// Visual directions
// ---------------------------------------------------------------------------

export const conceptSchema = z
  .object({
    id: z.string().min(1).max(64),
    title: z.string().min(2).max(120),
    rationale: z.string().min(10).max(1000),
    /** Moodboard references: consulted, never redistributed. */
    references: z
      .array(
        z
          .object({
            ref: z.string().min(1).max(256),
            rightsRef: z.string().min(1).max(256),
            role: z.enum(["inspiration_only", "redistributable"]),
          })
          .strict(),
      )
      .max(32),
    paletteIds: z.array(z.string().max(64)).max(16),
  })
  .strict();

export type Concept = z.infer<typeof conceptSchema>;

/** An inspiration reference may never be treated as a redistributable asset. */
export function assertConceptReferencesSafe(concept: Concept): void {
  for (const reference of concept.references) {
    if (reference.role === "inspiration_only" && reference.rightsRef.startsWith("asset:")) {
      throw new DomainError("policy_violation", "An inspiration reference cannot be shipped as an asset.", {
        details: { conceptId: concept.id, ref: reference.ref.slice(0, 64) },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Logo and variants
// ---------------------------------------------------------------------------

export const logoRevisionSchema = z
  .object({
    id: z.string().min(1).max(128),
    tenantId: z.string().min(1).max(128),
    revision: z.number().int().nonnegative(),
    geometryHash: z.string().regex(/^[a-f0-9]{64}$/),
    textHash: z.string().regex(/^[a-f0-9]{64}$/),
    minSizePx: z.number().int().positive(),
    variants: z.array(z.enum(["primary", "monochrome", "inverse", "symbol", "wordmark"])).min(1),
    approvalHash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  })
  .strict();

export type LogoRevision = z.infer<typeof logoRevisionSchema>;

/**
 * Editing a logo after approval must invalidate the approval. Returning the new
 * hash makes that invalidation explicit instead of implicit.
 */
export function reviseLogo(logo: LogoRevision, geometryHash: string, textHash: string): LogoRevision {
  return logoRevisionSchema.parse({
    ...logo,
    revision: logo.revision + 1,
    geometryHash,
    textHash,
    approvalHash: null,
  });
}

// ---------------------------------------------------------------------------
// Templates, layouts
// ---------------------------------------------------------------------------

export const templateSchema = z
  .object({
    id: z.string().min(1).max(128),
    tenantId: z.string().min(1).max(128),
    revision: z.number().int().nonnegative(),
    slots: z.array(z.string().min(1).max(64)).max(64),
    protectedNodes: z.array(z.string().min(1).max(64)).max(64),
    requiredMessages: z.array(z.string().min(3).max(200)).max(16),
    locale: z.enum(["es", "en", "fr"]),
  })
  .strict();

export type Template = z.infer<typeof templateSchema>;

export function fillTemplate(
  template: Template,
  values: Readonly<Record<string, string>>,
): { filled: Record<string, string>; missing: string[] } {
  const filled: Record<string, string> = {};
  const missing: string[] = [];
  for (const slot of template.slots) {
    const value = values[slot];
    if (value === undefined || value.trim() === "") missing.push(slot);
    else filled[slot] = value;
  }
  // Required legal or accessibility messages can never be replaced by a slot.
  for (const message of template.requiredMessages) {
    if (Object.values(filled).some((v) => v.trim() === "")) missing.push("__empty_value__");
    if (!message.trim()) missing.push("__required_message__");
  }
  return { filled, missing: [...new Set(missing)] };
}

export const layoutSchema = z
  .object({
    id: z.string().min(1).max(128),
    tenantId: z.string().min(1).max(128),
    breakpoints: z.array(z.number().int().positive()).min(1).max(8),
    readingOrder: z.array(z.string().min(1).max(64)).min(1),
    constraints: z.array(z.string().max(128)).max(32),
  })
  .strict();

export type Layout = z.infer<typeof layoutSchema>;

export interface OverflowFinding {
  slot: string;
  breakpoint: number;
  estimatedWidth: number;
  availableWidth: number;
  overflows: boolean;
}

/**
 * Approximate text measurement, deterministic and declared as such: an average
 * glyph width per font size. It is a warning signal, not a typographic proof.
 * The point is that long French copy does not silently clip.
 */
export function detectOverflow(
  layout: Layout,
  contents: ReadonlyArray<{ slot: string; text: string; fontSizePx: number }>,
  availableWidthByBreakpoint: Readonly<Record<number, number>>,
): OverflowFinding[] {
  const findings: OverflowFinding[] = [];
  for (const content of contents) {
    const estimated = Math.round(content.text.length * content.fontSizePx * 0.52);
    for (const breakpoint of layout.breakpoints) {
      const available = availableWidthByBreakpoint[breakpoint] ?? 0;
      findings.push({
        slot: content.slot,
        breakpoint,
        estimatedWidth: estimated,
        availableWidth: available,
        overflows: available > 0 && estimated > available,
      });
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Brandbook
// ---------------------------------------------------------------------------

export const brandbookSchema = z
  .object({
    id: z.string().min(1).max(128),
    tenantId: z.string().min(1).max(128),
    policyVersion: z.string().min(1).max(32),
    rules: z.array(z.object({ id: z.string(), do: z.string(), dont: z.string() }).strict()).min(1).max(64),
    /** Only approved assets may enter the manual. */
    approvedAssetRefs: z.array(z.string().min(1).max(256)).max(256),
    sourceRefs: z.array(z.string().min(1).max(256)).min(1).max(64),
    hash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  })
  .strict();

export type Brandbook = z.infer<typeof brandbookSchema>;

export interface BrandbookInput {
  id: string;
  tenantId: string;
  policyVersion: string;
  rules: Brandbook["rules"];
  assets: ReadonlyArray<{ ref: string; state: "draft" | "approved" | "revoked"; rights: AssetRights; purpose: AssetPurpose }>;
  sourceRefs: string[];
}

export function buildBrandbook(input: BrandbookInput): Brandbook {
  const notApproved = input.assets.filter((a) => a.state !== "approved");
  if (notApproved.length > 0) {
    throw new DomainError("policy_violation", "The brandbook may only contain approved assets.", {
      details: { offending: notApproved.map((a) => a.ref).slice(0, 5).join(",") },
    });
  }
  const brandbook = brandbookSchema.parse({
    id: input.id,
    tenantId: input.tenantId,
    policyVersion: input.policyVersion,
    rules: input.rules,
    approvedAssetRefs: input.assets.map((a) => a.ref),
    sourceRefs: input.sourceRefs,
    hash: null,
  });
  return { ...brandbook, hash: contentHash(brandbook) };
}

/** A stale rule must never be presented as the current one. */
export function isBrandbookStale(brandbook: Brandbook, currentPolicyVersion: string): boolean {
  return brandbook.policyVersion !== currentPolicyVersion;
}
