import { z } from "zod";
import { contentHash } from "../contracts/evidence.ts";
import { DomainError } from "../contracts/errors.ts";
import { assertTextNodesResolvable, documentHash, renderIdentity, type DesignDocument } from "./document.ts";
import { assertAssetUsable, assertFontUsable, rightsStateHash, type AssetPurpose, type AssetRights, type FontLicense } from "./rights.ts";

/**
 * Export and preflight.
 *
 * A PDF, PNG or SVG is not proof of fidelity. The manifest binds the editable
 * document, the render identity, the fonts actually used, the asset rights in
 * force and the preflight findings, so the deliverable can be audited later.
 */

export const exportFormatSchema = z.enum(["pdf", "png", "svg", "tokens-json"]);

export interface PreflightInput {
  document: DesignDocument;
  font: FontLicense;
  assets: ReadonlyArray<{ rights: AssetRights; purpose: AssetPurpose; territory: string }>;
  format: z.infer<typeof exportFormatSchema>;
  dpi: number;
  colorProfile: "sRGB" | "CMYK" | "P3";
  now: Date;
}

export interface ExportManifest {
  id: string;
  tenantId: string;
  documentId: string;
  documentVersion: number;
  editableHash: string;
  renderHash: string;
  fontFamily: string;
  fontLicenseRef: string;
  rightsHash: string;
  format: z.infer<typeof exportFormatSchema>;
  dpi: number;
  colorProfile: "sRGB" | "CMYK" | "P3";
  findings: string[];
  hash: string;
}

const MIN_PRINT_DPI = 300;

/**
 * Fail-closed preflight. Every blocking reason is collected where possible so a
 * designer can fix them in one pass, but the manifest is never produced with a
 * known gap.
 */
export function preflight(input: PreflightInput): ExportManifest {
  assertTextNodesResolvable(input.document);

  const findings: string[] = [];

  assertFontUsable(input.font, true);

  for (const asset of input.assets) {
    assertAssetUsable(asset.rights, {
      purpose: asset.purpose,
      territory: asset.territory,
      now: input.now,
    });
  }

  if (input.format === "pdf" && input.dpi < MIN_PRINT_DPI) {
    findings.push(`dpi_below_print_minimum:${input.dpi}`);
  }
  if (input.format === "pdf" && input.colorProfile === "sRGB") {
    findings.push("color_profile_srgb_for_print");
  }
  if (findings.some((f) => f.startsWith("dpi_below"))) {
    throw new DomainError("policy_violation", "The export does not meet the print resolution requirement.", {
      details: { dpi: input.dpi, minimum: MIN_PRINT_DPI },
    });
  }

  const manifest: Omit<ExportManifest, "hash"> = {
    id: `exp_${input.document.id}_${input.document.version}_${input.format}`,
    tenantId: input.document.tenantId,
    documentId: input.document.id,
    documentVersion: input.document.version,
    editableHash: documentHash(input.document),
    renderHash: renderIdentity(input.document),
    fontFamily: input.font.family,
    fontLicenseRef: input.font.licenseRef,
    rightsHash: rightsStateHash(input.assets.map((a) => a.rights)),
    format: input.format,
    dpi: input.dpi,
    colorProfile: input.colorProfile,
    findings,
  };

  return { ...manifest, hash: contentHash(manifest) };
}

/**
 * A manifest that no longer matches the live document or rights state is stale.
 * Delivering it would ship a file nobody approved.
 */
export function assertManifestCurrent(
  manifest: ExportManifest,
  document: DesignDocument,
  rights: readonly AssetRights[],
): void {
  if (manifest.editableHash !== documentHash(document)) {
    throw new DomainError("version_conflict", "The document changed after the export manifest was built.", {
      details: { reason: "document_changed" },
    });
  }
  if (manifest.rightsHash !== rightsStateHash(rights)) {
    throw new DomainError("rights_missing", "Rights changed after the export manifest was built.", {
      details: { reason: "rights_changed" },
    });
  }
}

export interface DeliveryReceipt {
  id: string;
  manifestHash: string;
  tenantId: string;
  recipient: string;
  channel: "portal" | "download" | "email_link";
  issuedAt: string;
  /** Deliverable produced locally; no external publication happened. */
  scope: "sandbox";
}

/**
 * Delivery to the sandbox. Delivery is not publication: exporting does not
 * authorize publishing, deploying or emailing a real recipient.
 */
export function createDelivery(
  manifest: ExportManifest,
  input: { recipient: string; channel: DeliveryReceipt["channel"]; now: Date },
): DeliveryReceipt {
  if (input.channel === "email_link" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.recipient)) {
    throw new DomainError("invalid_input", "The recipient address is not valid.");
  }
  return {
    id: `dlv_${contentHash({ manifest: manifest.hash, recipient: input.recipient }).slice(0, 16)}`,
    manifestHash: manifest.hash,
    tenantId: manifest.tenantId,
    recipient: input.recipient,
    channel: input.channel,
    issuedAt: input.now.toISOString(),
    scope: "sandbox",
  };
}
