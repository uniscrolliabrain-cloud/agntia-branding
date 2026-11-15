import { ApiError, HashHex, conflict, invalid, forbidden, needsReview, opaqueId, sha256Hex, IsoDateTime } from "./_shared.ts";
import { z } from "zod";

/* ------------------------------------------------------------------ *
 * C17 · Documento vectorial editable (fuente canónica del servicio)
 * ------------------------------------------------------------------ */

export const DesignNodeSchema = z
  .object({
    nodeId: opaqueId,
    kind: z.enum(["frame", "group", "text", "shape", "image", "vector"]),
    name: z.string().min(1).max(120),
    x: z.number(),
    y: z.number(),
    width: z.number().nonnegative(),
    height: z.number().nonnegative(),
    text: z.string().max(5000).nullable().default(null),
    fontHash: HashHex.nullable().default(null),
    fill: z.string().regex(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/).nullable().default(null),
    locked: z.boolean().default(false),
    children: z.array(opaqueId).default([]),
  })
  .strict();

export type DesignNode = z.infer<typeof DesignNodeSchema>;

export const DesignDocumentSchema = z
  .object({
    documentId: opaqueId,
    tenantId: opaqueId,
    resourceId: opaqueId,
    version: z.number().int().min(0),
    engine: z.string().min(1).max(60),
    engineVersion: z.string().min(1).max(60),
    nodes: z.array(DesignNodeSchema),
    constraints: z.array(z.string().min(1).max(300)).default([]),
    textSources: z.array(z.string().min(1).max(300)).default([]),
    fontHashes: z.array(HashHex).default([]),
    updatedAt: IsoDateTime,
  })
  .strict();

export type DesignDocument = z.infer<typeof DesignDocumentSchema>;

/** Hash of the editable source (nodes + constraints + text sources). */
export function documentHash(doc: DesignDocument): string {
  return sha256Hex({
    documentId: doc.documentId,
    nodes: doc.nodes,
    constraints: doc.constraints,
    textSources: doc.textSources,
  });
}

/** Deterministic render fingerprint: engine + version + fonts + document hash. */
export function renderFingerprint(doc: DesignDocument): string {
  return sha256Hex({
    engine: doc.engine,
    engineVersion: doc.engineVersion,
    fontHashes: [...doc.fontHashes].sort(),
    documentHash: documentHash(doc),
  });
}

export interface DocumentPatch {
  upsert?: DesignNode[];
  remove?: string[];
  constraints?: string[];
}

/**
 * Compare-and-swap update. Concurrent editors get a conflict, never a silent
 * overwrite; the previous revision stays recoverable in the caller's store.
 */
export function updateDocument(
  doc: DesignDocument,
  patch: DocumentPatch,
  expectedVersion: number,
  now: Date,
): DesignDocument {
  if (doc.version !== expectedVersion) {
    throw conflict(`document version mismatch: expected ${expectedVersion}, found ${doc.version}`);
  }
  const byId = new Map(doc.nodes.map((node) => [node.nodeId, node]));
  for (const node of patch.upsert ?? []) {
    const existing = byId.get(node.nodeId);
    if (existing?.locked) throw conflict(`node ${node.nodeId} is locked`);
    byId.set(node.nodeId, node);
  }
  for (const nodeId of patch.remove ?? []) {
    const existing = byId.get(nodeId);
    if (!existing) throw invalid(`unknown node ${nodeId}`);
    if (existing.locked) throw conflict(`node ${nodeId} is locked`);
    byId.delete(nodeId);
  }
  return DesignDocumentSchema.parse({
    ...doc,
    version: doc.version + 1,
    nodes: [...byId.values()],
    constraints: patch.constraints ?? doc.constraints,
    updatedAt: now.toISOString(),
  });
}

/* ------------------------------------------------------------------ *
 * C18 · Adaptador Penpot (workspace externo ≠ tenant local)
 * ------------------------------------------------------------------ */

export const PenpotBindingSchema = z
  .object({
    bindingId: opaqueId,
    tenantId: opaqueId,
    teamId: z.string().min(1).max(120),
    projectId: z.string().min(1).max(120),
    fileIds: z.array(z.string().min(1).max(120)).min(1),
    role: z.enum(["viewer", "editor", "admin"]),
    capabilities: z.array(z.string().min(1).max(120)).default([]),
    verifiedAt: IsoDateTime.nullable(),
  })
  .strict();

export type PenpotBinding = z.infer<typeof PenpotBindingSchema>;

/**
 * A file with the same name in another workspace is still another file.
 * Access requires the tenant binding, an included file id and a write role.
 */
export function assertPenpotAccess(
  binding: PenpotBinding,
  request: { tenantId: string; fileId: string; write: boolean },
): void {
  if (binding.tenantId !== request.tenantId) throw forbidden("penpot binding belongs to another tenant");
  if (!binding.fileIds.includes(request.fileId)) throw forbidden("file is not part of this binding");
  if (request.write && binding.role === "viewer") throw forbidden("viewer role cannot write");
}

/* ------------------------------------------------------------------ *
 * C19 · Canvas Fabric/SVG (sin ejecución de contenido activo)
 * ------------------------------------------------------------------ */

const FORBIDDEN_SVG_PATTERNS: readonly { pattern: RegExp; reason: string }[] = [
  { pattern: /<\s*script/i, reason: "script_element" },
  { pattern: /<\s*foreignObject/i, reason: "foreign_object" },
  { pattern: /<\s*iframe/i, reason: "iframe" },
  { pattern: /<\s*!ENTITY/i, reason: "xml_entity" },
  { pattern: /<\?xml-stylesheet/i, reason: "xml_stylesheet" },
  { pattern: /\son[a-z]+\s*=/i, reason: "event_handler" },
  { pattern: /javascript:/i, reason: "javascript_uri" },
  { pattern: /<!\[CDATA\[/i, reason: "cdata" },
  { pattern: /\b(href|xlink:href)\s*=\s*["']?\s*(https?:|\/\/|data:)/i, reason: "external_or_data_reference" },
  { pattern: /\bstyle\s*=\s*["'][^"']*url\s*\(/i, reason: "css_url" },
];

const ALLOWED_SVG_TAGS = new Set([
  "svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
  "text", "tspan", "defs", "linearGradient", "radialGradient", "stop", "clipPath", "mask", "title", "desc", "use",
]);

const ALLOWED_SVG_ATTRS = new Set([
  "xmlns", "version", "viewBox", "width", "height", "fill", "stroke", "stroke-width", "d", "x", "y", "x1", "y1",
  "x2", "y2", "cx", "cy", "r", "rx", "ry", "points", "transform", "opacity", "fill-opacity", "stroke-opacity",
  "font-family", "font-size", "font-weight", "text-anchor", "id", "class", "roles", "aria-label", "role",
  "offset", "stop-color", "stop-opacity", "clip-path", "mask", "href",
]);

export interface SvgSanitizeResult {
  sanitized: string;
  removedAttributes: string[];
}

/**
 * Conservative allowlist sanitizer for agent-produced SVG. Rejects active
 * content and external references; unknown tags fail closed.
 */
export function sanitizeSvg(input: string): SvgSanitizeResult {
  if (input.length > 2_000_000) throw invalid("svg exceeds size limit");
  for (const rule of FORBIDDEN_SVG_PATTERNS) {
    if (rule.pattern.test(input)) {
      throw new ApiError("invalid_input", `svg rejected: ${rule.reason}`, { details: { reason: rule.reason } });
    }
  }

  const tags = [...input.matchAll(/<\s*\/?\s*([a-zA-Z][\w:-]*)/g)].map((m) => m[1]!);
  for (const tag of tags) {
    if (!ALLOWED_SVG_TAGS.has(tag)) {
      throw new ApiError("invalid_input", `svg rejected: tag ${tag} not allowed`, { details: { tag } });
    }
  }

  const removed: string[] = [];
  const sanitized = input.replace(/<([a-zA-Z][\w:-]*)((?:\s+[^<>]*?)?)(\/?)>/g, (match, tag: string, attrs: string, selfClose: string) => {
    const kept = attrs.replace(/([a-zA-Z_:][\w:.-]*)\s*=\s*("[^"]*"|'[^']*')/g, (attrMatch, name: string) => {
      if (!ALLOWED_SVG_ATTRS.has(name)) {
        removed.push(name);
        return "";
      }
      return attrMatch;
    });
    return `<${tag}${kept}${selfClose}>`;
  });

  return { sanitized: sanitized.replace(/\s{2,}/g, " "), removedAttributes: [...new Set(removed)].sort() };
}

/* ------------------------------------------------------------------ *
 * C20 · Logotipo y variantes
 * ------------------------------------------------------------------ */

export const LogoVariantSchema = z
  .object({
    variantId: opaqueId,
    name: z.string().min(1).max(80),
    minWidthPx: z.number().positive(),
    clearSpacePx: z.number().nonnegative(),
    colorMode: z.enum(["full_color", "monochrome", "reversed"]),
  })
  .strict();

export const LogoRevisionSchema = z
  .object({
    logoId: opaqueId,
    tenantId: opaqueId,
    revision: z.number().int().min(1),
    geometryHash: HashHex,
    wordmark: z.string().max(120).nullable(),
    variants: z.array(LogoVariantSchema).min(1),
    approvalRef: opaqueId.nullable(),
  })
  .strict();

export type LogoRevision = z.infer<typeof LogoRevisionSchema>;

export function logoPayloadHash(logo: LogoRevision): string {
  return sha256Hex({
    logoId: logo.logoId,
    revision: logo.revision,
    geometryHash: logo.geometryHash,
    wordmark: logo.wordmark,
    variants: logo.variants,
  });
}

/** Editing a logo after approval invalidates the previously approved bundle. */
export function assertLogoMatchesApproval(logo: LogoRevision, approvedPayloadHash: string): void {
  if (!logo.approvalRef) throw needsReview("logo has no approval reference");
  if (logoPayloadHash(logo) !== approvedPayloadHash) {
    throw conflict("logo changed after approval; a new review is required");
  }
}
