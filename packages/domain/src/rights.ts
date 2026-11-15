import { ApiError, HashHex, IsoDateTime, needsReview, opaqueId } from "./_shared.ts";
import { z } from "zod";

/* ------------------------------------------------------------------ *
 * C15 · Ledger de activos y derechos
 * ------------------------------------------------------------------ */

export const ASSET_PURPOSES = ["internal_review", "client_delivery", "publication", "paid_media"] as const;
export const AssetPurposeSchema = z.enum(ASSET_PURPOSES);
export type AssetPurpose = z.infer<typeof AssetPurposeSchema>;

export const AssetRightsSchema = z
  .object({
    rightsId: opaqueId,
    tenantId: opaqueId,
    assetHash: HashHex,
    source: z.string().min(1).max(300),
    licenseRef: z.string().min(1).max(200).nullable(),
    releaseRef: z.string().min(1).max(200).nullable(),
    expiresAt: IsoDateTime.nullable(),
    purposes: z.array(AssetPurposeSchema).min(1),
    territory: z.array(z.string().min(2).max(60)).default([]),
    revokedAt: IsoDateTime.nullable(),
    attribution: z.string().max(500).nullable(),
  })
  .strict();

export type AssetRights = z.infer<typeof AssetRightsSchema>;

export type RightsCheck = { usable: true } | { usable: false; reason: string };

/**
 * Rights are purpose-bound and revocable. Revocation blocks every *new* use;
 * it does not erase the audit trail of what was used before.
 */
export function isAssetUsable(rights: AssetRights, purpose: AssetPurpose, now: Date): RightsCheck {
  if (rights.revokedAt !== null) return { usable: false, reason: "rights_revoked" };
  if (rights.expiresAt && new Date(rights.expiresAt).getTime() <= now.getTime()) {
    return { usable: false, reason: "rights_expired" };
  }
  if (!rights.purposes.includes(purpose)) return { usable: false, reason: "purpose_not_granted" };
  if (!rights.licenseRef) return { usable: false, reason: "license_missing" };
  return { usable: true };
}

export function assertAssetUsable(rights: AssetRights, purpose: AssetPurpose, now: Date): void {
  const check = isAssetUsable(rights, purpose, now);
  if (!check.usable) {
    throw needsReview(`asset not usable for ${purpose}`, { reason: check.reason, rightsId: rights.rightsId });
  }
}

export function revokeAssetRights(rights: AssetRights, now: Date): AssetRights {
  return { ...rights, revokedAt: now.toISOString() };
}

/** Export preflight uses this so a revoked or unlicensed asset cannot ship. */
export function assertAssetsUsableForDelivery(
  ledger: AssetRights[],
  assetsInDeliverable: string[],
  purpose: AssetPurpose,
  now: Date,
): void {
  for (const assetHash of assetsInDeliverable) {
    const rights = ledger.find((r) => r.assetHash === assetHash);
    if (!rights) {
      throw new ApiError("needs_review", "deliverable contains an asset with no rights record", {
        details: { assetHash },
      });
    }
    assertAssetUsable(rights, purpose, now);
  }
}

/* ------------------------------------------------------------------ *
 * C16 · Tipografía y fuentes
 * ------------------------------------------------------------------ */

export const FontLicenseSchema = z
  .object({
    fontId: opaqueId,
    tenantId: opaqueId,
    family: z.string().min(1).max(120),
    fontHash: HashHex,
    familyLicense: z.string().min(1).max(120),
    embeddingRights: z
      .object({
        print: z.boolean(),
        web: z.boolean(),
        editableDocument: z.boolean(),
      })
      .strict(),
    redistributionAllowed: z.boolean(),
    fallbackPolicy: z.enum(["block", "ask_review", "substitute_declared"]),
    fallbackFamily: z.string().min(1).max(120).nullable().default(null),
    licenseRef: z.string().min(1).max(200).nullable(),
  })
  .strict();

export type FontLicense = z.infer<typeof FontLicenseSchema>;

export type FontResolution =
  | { status: "ok"; fontId: string }
  | { status: "needs_review"; reason: string }
  | { status: "blocked"; reason: string };

/**
 * Font fallback is never silent: missing fonts, unknown licenses and missing
 * embedding rights block the render or require explicit human review.
 */
export function resolveFontUsage(
  font: FontLicense | null,
  usage: { embedding: boolean; redistribution: boolean; channel: "print" | "web" | "editable" },
): FontResolution {
  if (!font) return { status: "blocked", reason: "font_missing" };
  if (!font.licenseRef) return { status: "needs_review", reason: "font_license_unverified" };

  if (usage.embedding) {
    const allowed =
      usage.channel === "print"
        ? font.embeddingRights.print
        : usage.channel === "web"
          ? font.embeddingRights.web
          : font.embeddingRights.editableDocument;
    if (!allowed) {
      return font.fallbackPolicy === "substitute_declared" && font.fallbackFamily
        ? { status: "needs_review", reason: "font_fallback_requires_approval" }
        : { status: "blocked", reason: "embedding_not_granted" };
    }
  }
  if (usage.redistribution && !font.redistributionAllowed) {
    return { status: "blocked", reason: "redistribution_not_granted" };
  }
  return { status: "ok", fontId: font.fontId };
}
