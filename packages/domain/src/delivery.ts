import { ApiError, forbidden, needsReview, opaqueId, sha256Hex, IsoDateTime } from "./_shared.ts";
import { z } from "zod";
import { resolveFontUsage, assertAssetsUsableForDelivery, type AssetRights, type FontLicense } from "./rights.ts";
import { sanitizeSvg } from "./design.ts";

/* ------------------------------------------------------------------ *
 * C30 · Export y preflight
 * ------------------------------------------------------------------ */

export const EXPORT_PROFILES = ["sRGB", "DisplayP3", "CMYK_FOGRA39", "GRAYSCALE"] as const;
export const ExportProfileSchema = z.enum(EXPORT_PROFILES);

export const ExportManifestSchema = z
  .object({
    manifestId: opaqueId,
    tenantId: opaqueId,
    deliverableId: opaqueId,
    editableHash: z.string().regex(/^[0-9a-f]{64}$/),
    renderHash: z.string().regex(/^[0-9a-f]{64}$/),
    dpi: z.number().int().positive(),
    colorProfile: ExportProfileSchema,
    renderEngine: z.string().min(1).max(60),
    renderEngineVersion: z.string().min(1).max(60),
    fontHashes: z.array(z.string().regex(/^[0-9a-f]{64}$/)).default([]),
    licenseRefs: z.array(z.string().min(1).max(200)).default([]),
    assetHashes: z.array(z.string().regex(/^[0-9a-f]{64}$/)).default([]),
    createdAt: IsoDateTime,
    checksum: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict();

export type ExportManifest = z.infer<typeof ExportManifestSchema>;

export interface ExportBlocker {
  code: string;
  detail: string;
}

export interface ExportRequest {
  manifestId: string;
  tenantId: string;
  deliverableId: string;
  editableHash: string;
  renderHash: string;
  dpi: number;
  colorProfile: (typeof EXPORT_PROFILES)[number];
  renderEngine: string;
  renderEngineVersion: string;
  purpose: "internal_review" | "client_delivery" | "publication" | "paid_media";
  fontIds: string[];
  assetHashes: string[];
  svg?: string[];
  textQaOk: boolean;
  rightsOk: boolean;
}

/**
 * Preflight is the last deterministic gate before a package exists. It never
 * "exports anyway": missing fonts, unlicensed assets, failed QA or an unsafe
 * SVG block the manifest.
 */
export function preflightExport(
  request: ExportRequest,
  context: { fonts: (FontLicense | null)[]; ledger: AssetRights[]; now: Date },
): { ok: boolean; blockers: ExportBlocker[]; manifest: ExportManifest | null } {
  const blockers: ExportBlocker[] = [];

  if (request.dpi < (request.purpose === "publication" || request.purpose === "paid_media" ? 300 : 72)) {
    blockers.push({ code: "dpi_below_requirement", detail: String(request.dpi) });
  }
  if (!request.textQaOk) blockers.push({ code: "text_qa_failed", detail: "rendered text differs from approved source" });
  if (!request.rightsOk) blockers.push({ code: "rights_not_cleared", detail: "approval or rights gate failed" });

  const licenseRefs: string[] = [];
  for (const fontId of request.fontIds) {
    const font = context.fonts.find((f) => f?.fontId === fontId) ?? null;
    const resolution = resolveFontUsage(font, {
      embedding: true,
      redistribution: request.purpose === "client_delivery" || request.purpose === "publication",
      channel: request.colorProfile === "CMYK_FOGRA39" ? "print" : "web",
    });
    if (resolution.status === "blocked") blockers.push({ code: "font_blocked", detail: `${fontId}:${resolution.reason}` });
    if (resolution.status === "needs_review") blockers.push({ code: "font_needs_review", detail: `${fontId}:${resolution.reason}` });
    if (font?.licenseRef) licenseRefs.push(font.licenseRef);
  }

  try {
    assertAssetsUsableForDelivery(context.ledger, request.assetHashes, request.purpose, context.now);
  } catch (error) {
    if (error instanceof ApiError) blockers.push({ code: "asset_rights", detail: error.message });
    else throw error;
  }

  for (const svg of request.svg ?? []) {
    try {
      sanitizeSvg(svg);
    } catch (error) {
      if (error instanceof ApiError) blockers.push({ code: "unsafe_svg", detail: error.message });
      else throw error;
    }
  }

  if (blockers.length > 0) return { ok: false, blockers, manifest: null };

  const base = {
    manifestId: request.manifestId,
    tenantId: request.tenantId,
    deliverableId: request.deliverableId,
    editableHash: request.editableHash,
    renderHash: request.renderHash,
    dpi: request.dpi,
    colorProfile: request.colorProfile,
    renderEngine: request.renderEngine,
    renderEngineVersion: request.renderEngineVersion,
    fontHashes: context.fonts.filter((f): f is FontLicense => Boolean(f)).map((f) => f.fontHash),
    licenseRefs: [...new Set(licenseRefs)].sort(),
    assetHashes: [...request.assetHashes].sort(),
    createdAt: context.now.toISOString(),
  };

  return {
    ok: true,
    blockers: [],
    manifest: ExportManifestSchema.parse({ ...base, checksum: sha256Hex(base) }),
  };
}

/* ------------------------------------------------------------------ *
 * C31 · Entrega y publicación (exportar no autoriza publicar)
 * ------------------------------------------------------------------ */

export const ReceiverScopeSchema = z
  .object({
    receiverId: opaqueId,
    tenantId: opaqueId,
    kind: z.enum(["internal_user", "external_client", "partner"]),
    allowedDeliverables: z.array(z.string().min(1).max(300)).default([]),
    expiresAt: IsoDateTime.nullable(),
  })
  .strict();

export type ReceiverScope = z.infer<typeof ReceiverScopeSchema>;

export function assertReceiverCanReceive(
  receiver: ReceiverScope,
  request: { tenantId: string; deliverableId: string; now: Date },
): void {
  if (receiver.tenantId !== request.tenantId) throw forbidden("receiver belongs to another tenant");
  if (receiver.allowedDeliverables.length > 0 && !receiver.allowedDeliverables.includes(request.deliverableId)) {
    throw forbidden("deliverable is not shared with this receiver");
  }
  if (receiver.expiresAt && new Date(receiver.expiresAt).getTime() <= request.now.getTime()) {
    throw forbidden("receiver share has expired");
  }
}

export const DELIVERY_ACTIONS = ["sandbox_delivery", "publication"] as const;
export type DeliveryAction = (typeof DELIVERY_ACTIONS)[number];

/**
 * Sandbox delivery is a scoped effect. Publication is a different effect with
 * its own approval; the export step never implies it. The approval is bound to
 * the exact manifest by `evaluateApproval`, so the scope is the only extra gate.
 */
export function assertDeliveryAuthorized(input: { action: DeliveryAction; approvalScope: string }): void {
  const scope = input.approvalScope;
  if (input.action === "publication" && !scope.includes("publication")) {
    throw new ApiError("forbidden", "publication requires its own approval scope");
  }
  if (input.action === "sandbox_delivery" && !scope.includes("sandbox")) {
    throw new ApiError("forbidden", "approval scope does not cover sandbox delivery");
  }
}

export const DeliveryReceiptSchema = z
  .object({
    receiptId: opaqueId,
    tenantId: opaqueId,
    deliverableId: opaqueId,
    manifestId: opaqueId,
    receiverId: opaqueId,
    action: z.enum(DELIVERY_ACTIONS),
    acceptedAt: IsoDateTime,
    manifestChecksum: z.string().regex(/^[0-9a-f]{64}$/),
    correlationId: z.string().min(1).max(200),
  })
  .strict();

export type DeliveryReceipt = z.infer<typeof DeliveryReceiptSchema>;
