import { conflict, needsReview, opaqueId, sha256Hex } from "./_shared.ts";
import { z } from "zod";

/* ------------------------------------------------------------------ *
 * C27 · QA de texto (el render debe coincidir con la fuente aprobada)
 * ------------------------------------------------------------------ */

export interface TextQaFinding {
  code: "text_mismatch" | "number_mismatch" | "script_mismatch" | "empty_render" | "font_below_minimum";
  severity: "error" | "warning";
  detail: string;
}

function normalize(text: string): string {
  return text
    .normalize("NFC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return normalize(text).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

const NUMBER_PATTERN = /\d+(?:[.,]\d+)?/g;

/**
 * Layout/typography errors and wording errors are different failures.
 * A wrong number or name blocks the final export.
 */
export function verifyText(input: {
  sourceText: string;
  renderedText: string;
  locale: string;
  fontFamily?: string | null;
  fontFamilyMeasured?: string | null;
  fontSizePx?: number | null;
  minFontSizePx?: number | null;
}): { ok: boolean; findings: TextQaFinding[] } {
  const findings: TextQaFinding[] = [];
  const source = normalize(input.sourceText);
  const rendered = normalize(input.renderedText);

  if (rendered.length === 0) {
    findings.push({ code: "empty_render", severity: "error", detail: "rendered text is empty" });
    return { ok: false, findings };
  }
  if (source !== rendered) {
    const sourceTokens = tokenize(source);
    const renderedTokens = tokenize(rendered);
    if (sourceTokens.join(" ") !== renderedTokens.join(" ")) {
      findings.push({
        code: "text_mismatch",
        severity: "error",
        detail: `${sourceTokens.filter((t) => !renderedTokens.includes(t)).slice(0, 5).join(",") || "-"}`,
      });
    }
    const sourceNumbers = new Set(source.match(NUMBER_PATTERN) ?? []);
    const renderedNumbers = new Set(rendered.match(NUMBER_PATTERN) ?? []);
    for (const number of sourceNumbers) {
      if (!renderedNumbers.has(number)) {
        findings.push({ code: "number_mismatch", severity: "error", detail: number });
      }
    }
  }

  if (input.fontFamily && input.fontFamilyMeasured && input.fontFamily !== input.fontFamilyMeasured) {
    findings.push({
      code: "script_mismatch",
      severity: "error",
      detail: `${input.fontFamily} rendered as ${input.fontFamilyMeasured}`,
    });
  }

  if (
    input.fontSizePx !== undefined &&
    input.fontSizePx !== null &&
    input.minFontSizePx !== undefined &&
    input.minFontSizePx !== null &&
    input.fontSizePx < input.minFontSizePx
  ) {
    findings.push({
      code: "font_below_minimum",
      severity: "error",
      detail: `${input.fontSizePx} < ${input.minFontSizePx}`,
    });
  }

  return { ok: !findings.some((f) => f.severity === "error"), findings };
}

/* ------------------------------------------------------------------ *
 * C28 · QA visual y revisión (la percepción no sustituye la aceptación)
 * ------------------------------------------------------------------ */

export const GeometryCheckSchema = z
  .object({
    checkId: z.string().min(1).max(80),
    kind: z.enum(["overlap", "out_of_bounds", "alignment", "min_size", "safe_area"]),
    status: z.enum(["pass", "fail", "unknown"]),
    detail: z.string().max(300).nullable().default(null),
  })
  .strict();

export const QualityEvaluationSchema = z
  .object({
    evaluationId: opaqueId,
    tenantId: opaqueId,
    resourceId: opaqueId,
    resourceVersion: z.number().int().min(0),
    geometryChecks: z.array(GeometryCheckSchema),
    perceptionModel: z.string().min(1).max(120),
    perceptionScore: z.number().min(0).max(1).nullable(),
    findings: z.array(z.string().max(300)).default([]),
    humanDecision: z
      .object({
        reviewerId: opaqueId,
        decision: z.enum(["approved", "rejected"]),
        decidedAt: z.string().datetime({ offset: true }),
      })
      .strict()
      .nullable(),
  })
  .strict();

export type QualityEvaluation = z.infer<typeof QualityEvaluationSchema>;

/**
 * A high aesthetic score cannot compensate a failed text check, a rights
 * violation or an executable asset. Only a human can close the gate.
 */
export function evaluateQualityGate(input: {
  evaluation: QualityEvaluation;
  textQa: { ok: boolean };
  rightsOk: boolean;
  securityOk: boolean;
}): { passed: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!input.textQa.ok) reasons.push("text_qa_failed");
  if (!input.rightsOk) reasons.push("rights_not_cleared");
  if (!input.securityOk) reasons.push("unsafe_asset");
  for (const check of input.evaluation.geometryChecks) {
    if (check.status !== "pass") reasons.push(`geometry_${check.kind}_${check.status}`);
  }
  if (!input.evaluation.humanDecision) reasons.push("human_decision_missing");
  if (input.evaluation.humanDecision?.decision === "rejected") reasons.push("human_rejected");
  return { passed: reasons.length === 0, reasons };
}

/* ------------------------------------------------------------------ *
 * C29 · Brandbook y reglas
 * ------------------------------------------------------------------ */

export const BrandRuleSchema = z
  .object({
    ruleId: z.string().min(1).max(80),
    kind: z.enum(["do", "dont"]),
    statement: z.string().min(1).max(500),
    sourceRef: z.string().min(1).max(300),
    policyVersion: z.string().min(1).max(60),
  })
  .strict();

export const BrandbookSnapshotSchema = z
  .object({
    brandbookId: opaqueId,
    tenantId: opaqueId,
    policyVersion: z.string().min(1).max(60),
    rules: z.array(BrandRuleSchema).min(1),
    approvedAssets: z.array(z.string().min(1).max(300)).default([]),
    tokenSetVersion: z.number().int().min(0),
    createdAt: z.string().datetime({ offset: true }),
    supersedes: opaqueId.nullable().default(null),
  })
  .strict();

export type BrandbookSnapshot = z.infer<typeof BrandbookSnapshotSchema>;

export function brandbookPayloadHash(snapshot: BrandbookSnapshot): string {
  return sha256Hex({
    policyVersion: snapshot.policyVersion,
    rules: snapshot.rules,
    approvedAssets: snapshot.approvedAssets,
    tokenSetVersion: snapshot.tokenSetVersion,
  });
}

/** An obsolete rule must never be presented as the current guidance. */
export function assertBrandbookCurrent(snapshot: BrandbookSnapshot, currentPolicyVersion: string): void {
  if (snapshot.policyVersion !== currentPolicyVersion) {
    throw conflict(`brandbook is stale: ${snapshot.policyVersion} != ${currentPolicyVersion}`);
  }
  for (const rule of snapshot.rules) {
    if (rule.policyVersion !== snapshot.policyVersion) {
      throw conflict(`rule ${rule.ruleId} belongs to another policy version`);
    }
  }
}

export function assertAssetsApproved(snapshot: BrandbookSnapshot, assets: string[]): void {
  for (const asset of assets) {
    if (!snapshot.approvedAssets.includes(asset)) {
      throw needsReview("asset is not approved for the brandbook", { asset });
    }
  }
}
