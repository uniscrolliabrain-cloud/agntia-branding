import { z } from "zod";
import { contentHash } from "../contracts/evidence.ts";
import { DomainError } from "../contracts/errors.ts";

/**
 * Asset rights ledger.
 *
 * The service may only emit a deliverable whose assets have a live right for the
 * intended purpose. A revoked license, an expired license or a license for a
 * different purpose blocks the export. Visual quality never compensates.
 */
export const ASSET_PURPOSES = [
  "internal_review",
  "brandbook",
  "web_publish",
  "print_publish",
  "social_publish",
  "client_handoff",
] as const;

export type AssetPurpose = (typeof ASSET_PURPOSES)[number];

export const assetRightsSchema = z
  .object({
    id: z.string().min(1).max(128),
    tenantId: z.string().min(1).max(128),
    assetHash: z.string().regex(/^[a-f0-9]{64}$/),
    source: z.enum(["owned", "licensed", "commissioned", "open_license", "generated"]),
    licenseRef: z.string().min(1).max(256),
    releaseRef: z.string().min(1).max(256).nullable(),
    purposes: z.array(z.enum(ASSET_PURPOSES)).min(1),
    territory: z.array(z.string().min(2).max(3)).min(1),
    expiresAt: z.string().datetime({ offset: true }).nullable(),
    revokedAt: z.string().datetime({ offset: true }).nullable(),
  })
  .strict();

export type AssetRights = z.infer<typeof assetRightsSchema>;

export interface UsageCheck {
  purpose: AssetPurpose;
  territory: string;
  now: Date;
}

export function assertAssetUsable(rights: AssetRights, check: UsageCheck): void {
  if (rights.revokedAt !== null) {
    throw new DomainError("rights_missing", "The asset license was revoked.", {
      details: { assetHash: rights.assetHash.slice(0, 12), reason: "revoked" },
    });
  }
  if (rights.expiresAt !== null && Date.parse(rights.expiresAt) <= check.now.getTime()) {
    throw new DomainError("rights_missing", "The asset license expired.", {
      details: { assetHash: rights.assetHash.slice(0, 12), reason: "expired" },
    });
  }
  if (!rights.purposes.includes(check.purpose)) {
    throw new DomainError("rights_missing", "The license does not cover this purpose.", {
      details: { assetHash: rights.assetHash.slice(0, 12), reason: "purpose_not_covered" },
    });
  }
  if (!rights.territory.includes(check.territory)) {
    throw new DomainError("rights_missing", "The license does not cover this territory.", {
      details: { assetHash: rights.assetHash.slice(0, 12), reason: "territory_not_covered" },
    });
  }
  // A licence that came from someone else's release needs the release document.
  if ((rights.source === "commissioned" || rights.source === "licensed") && rights.releaseRef === null) {
    throw new DomainError("rights_missing", "A licensed or commissioned asset needs a release reference.", {
      details: { assetHash: rights.assetHash.slice(0, 12), reason: "release_missing" },
    });
  }
}

/** Hash of the whole rights state, so an approval can be bound to it. */
export function rightsStateHash(rights: readonly AssetRights[]): string {
  return contentHash(
    [...rights]
      .map((r) => ({
        id: r.id,
        assetHash: r.assetHash,
        purposes: [...r.purposes].sort(),
        revokedAt: r.revokedAt,
        expiresAt: r.expiresAt,
      }))
      .sort((a, b) => (a.id < b.id ? -1 : 1)),
  );
}

/**
 * Font licensing.
 *
 * `licenseVerified: false` means the family may not be rendered or exported.
 * There is no silent fallback: substituting a typeface changes the design.
 */
export const fontLicenseSchema = z
  .object({
    id: z.string().min(1).max(128),
    tenantId: z.string().min(1).max(128),
    family: z.string().min(1).max(128),
    foundry: z.string().min(1).max(128),
    licenseRef: z.string().min(1).max(256),
    licenseVerified: z.boolean(),
    embeddingAllowed: z.boolean(),
    subsettingAllowed: z.boolean(),
    redistributionAllowed: z.boolean(),
    verifiedAt: z.string().datetime({ offset: true }).nullable(),
  })
  .strict();

export type FontLicense = z.infer<typeof fontLicenseSchema>;

export function assertFontUsable(font: FontLicense, requireEmbedding: boolean): void {
  if (!font.licenseVerified || font.verifiedAt === null) {
    throw new DomainError("font_license_unverified", "The font license has not been verified.", {
      details: { family: font.family },
    });
  }
  if (requireEmbedding && !font.embeddingAllowed) {
    throw new DomainError("font_license_unverified", "The license does not allow embedding.", {
      details: { family: font.family, reason: "embedding_not_allowed" },
    });
  }
  if (!font.subsettingAllowed) {
    throw new DomainError("font_license_unverified", "The license does not allow subsetting.", {
      details: { family: font.family, reason: "subsetting_not_allowed" },
    });
  }
}
