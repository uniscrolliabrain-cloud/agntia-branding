import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { DomainError } from "../contracts/errors.ts";
import { assertManifestCurrent, type ExportManifest } from "./export.ts";
import { assertTextNodesResolvable, renderIdentity, type DesignDocument, type DesignNode } from "./document.ts";
import type { AssetRights } from "./rights.ts";

/**
 * Bytes, not intentions.
 *
 * Until now an export produced a manifest and stopped there: the campaign's
 * deliverable was a description of a file. This module turns the canonical
 * document into an actual PDF, PNG or SVG with no external dependency, no
 * network access and no font binary.
 *
 * Two consequences are unavoidable and are therefore made explicit instead of
 * hidden:
 *
 *   - PDF and PNG cannot embed a licensed font we do not have. The PDF uses the
 *     base-14 Helvetica and the PNG a built-in 5x7 bitmap font. Both are
 *     substitutions, so both produce a finding the caller must acknowledge
 *     before bytes are returned. Silent fallback is exactly what C16 forbids.
 *   - The document model has no children, no strokes and no embedded image
 *     bytes. Node kinds that cannot be drawn truthfully (path, image, group)
 *     fail closed rather than disappearing from the output.
 */

export const PAGE_WIDTH = 1200;
export const PAGE_HEIGHT = 800;
export const RENDER_FORMATS = ["pdf", "png", "svg"] as const;
export type RenderFormat = (typeof RENDER_FORMATS)[number];

/** 20 megapixels keeps a 300 dpi page inside a predictable memory budget. */
const MAX_RASTER_PIXELS = 20_000_000;

export interface RenderRequest {
  document: DesignDocument;
  manifest: ExportManifest;
  rights: readonly AssetRights[];
  /**
   * Acknowledge the findings (font substitution, for example) and accept the
   * deliverable anyway. Without it, a render with findings throws.
   */
  acceptFindings?: boolean;
}

export interface RenderOutput {
  format: RenderFormat;
  mimeType: string;
  bytes: Buffer;
  byteLength: number;
  /** sha256 of the bytes themselves: what a recipient can verify. */
  contentSha256: string;
  documentHashRef: string;
  renderHash: string;
  manifestHash: string;
  width: number;
  height: number;
  findings: string[];
}

const MIME: Record<RenderFormat, string> = {
  pdf: "application/pdf",
  png: "image/png",
  svg: "image/svg+xml",
};

function isRenderFormat(value: string): value is RenderFormat {
  return (RENDER_FORMATS as readonly string[]).includes(value);
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function parseHexColor(hex: string): Rgb {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!match) throw new DomainError("invalid_input", "Fill must be a six digit hex color.");
  const value = Number.parseInt(match[1] as string, 16);
  return { r: (value >> 16) & 0xff, g: (value >> 8) & 0xff, b: value & 0xff };
}

/**
 * The renderer draws a fixed page. Node coordinates are absolute page units, so
 * the same document maps to points in PDF and to pixels in PNG without a second
 * layout pass that could disagree with the editable version.
 */
function drawableNodes(document: DesignDocument): DesignNode[] {
  const unsupported = document.nodes.filter(
    (node) => node.kind !== "rect" && node.kind !== "ellipse" && node.kind !== "text",
  );
  if (unsupported.length > 0) {
    throw new DomainError("unsupported_operation", "The renderer cannot draw this node kind truthfully.", {
      details: { nodes: unsupported.map((n) => `${n.id}:${n.kind}`).slice(0, 16).join(",") },
    });
  }
  return document.nodes;
}

function textOf(document: DesignDocument, node: DesignNode): string {
  if (node.textRef === null) {
    throw new DomainError("policy_violation", "A text node must reference an approved text source.", {
      details: { nodeId: node.id, reason: "text_without_source" },
    });
  }
  const text = document.textSources[node.textRef];
  if (text === undefined) {
    throw new DomainError("invalid_input", "The text source is missing from the document.", {
      details: { nodeId: node.id, textRef: node.textRef },
    });
  }
  if (text.length === 0) {
    throw new DomainError("invalid_input", "A text source cannot be empty.", { details: { nodeId: node.id } });
  }
  return text;
}

function fontSizeFor(node: DesignNode): number {
  // Deterministic and proportional: the text box height drives the type size.
  return Math.max(6, Math.round(node.height * 0.6 * 100) / 100);
}

function fillOf(node: DesignNode, findings: string[]): Rgb {
  if (node.fill === null) {
    findings.push(`default_fill_applied:${node.id}`);
    return { r: 0x11, g: 0x11, b: 0x11 };
  }
  return parseHexColor(node.fill);
}

// ---------------------------------------------------------------------------
// PNG
// ---------------------------------------------------------------------------

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) !== 0 ? (0xedb88320 ^ (c >>> 1)) >>> 0 : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(input: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of input) crc = ((CRC_TABLE[(crc ^ byte) & 0xff] as number) ^ (crc >>> 8)) >>> 0;
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const tag = Buffer.from(type, "latin1");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([tag, data])), 0);
  return Buffer.concat([length, tag, data, crc]);
}

/**
 * A 5x7 bitmap font, written out so the raster path needs no font file. Lowercase
 * maps to its uppercase glyph and the caller is told: the licence and the exact
 * face live in the manifest, and this raster is a preview, not the typeset page.
 */
const GLYPHS: Record<string, readonly string[]> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".###."],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#...#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#...#", "#.#.#", "##.##", "#...#"],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
  ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  ",": [".....", ".....", ".....", ".....", ".##..", ".##..", ".#..."],
  ":": [".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."],
  ";": [".....", ".##..", ".##..", ".....", ".##..", ".#...", ".#..."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
  "-": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
  "_": [".....", ".....", ".....", ".....", ".....", ".....", "#####"],
  "/": ["....#", "....#", "...#.", "..#..", ".#...", "#....", "#...."],
  "(": ["...#.", "..#..", ".#...", ".#...", ".#...", "..#..", "...#."],
  ")": [".#...", "..#..", "...#.", "...#.", "...#.", "..#..", ".#..."],
  "'": ["..#..", "..#..", ".....", ".....", ".....", ".....", "....."],
  '"': [".#.#.", ".#.#.", ".....", ".....", ".....", ".....", "....."],
  "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
  "&": [".##..", "#..#.", "#.#..", ".#...", "#.#.#", "#..#.", ".##.#"],
  "@": [".###.", "#...#", "#.###", "#.#.#", "#.###", "#....", ".###."],
  "#": [".....", ".#.#.", "#####", ".#.#.", "#####", ".#.#.", "....."],
  "%": ["##..#", "##..#", "...#.", "..#..", ".#...", "#..##", "#..##"],
  "*": [".....", "#.#.#", ".###.", "#####", ".###.", "#.#.#", "....."],
  "=": [".....", ".....", "#####", ".....", "#####", ".....", "....."],
  "<": ["...#.", "..#..", ".#...", "#....", ".#...", "..#..", "...#."],
  "·": [".....", ".....", ".....", "..#..", ".....", ".....", "....."],
  ">": [".#...", "..#..", "...#.", "....#", "...#.", "..#..", ".#..."],
};

/** Accent rows drawn above a 5x7 glyph, so `ñ` is not flattened to `n`. */
const ACCENTS: Record<string, readonly string[]> = {
  acute: ["...#.", "..#.."],
  tilde: [".....", ".##.#"],
  diaeresis: [".....", ".#.#."],
};

const DECOMPOSABLE: Record<string, { base: string; accent: keyof typeof ACCENTS }> = {
  "á": { base: "A", accent: "acute" },
  "é": { base: "E", accent: "acute" },
  "í": { base: "I", accent: "acute" },
  "ó": { base: "O", accent: "acute" },
  "ú": { base: "U", accent: "acute" },
  "ü": { base: "U", accent: "diaeresis" },
  "ñ": { base: "N", accent: "tilde" },
  "Á": { base: "A", accent: "acute" },
  "É": { base: "E", accent: "acute" },
  "Í": { base: "I", accent: "acute" },
  "Ó": { base: "O", accent: "acute" },
  "Ú": { base: "U", accent: "acute" },
  "Ü": { base: "U", accent: "diaeresis" },
  "Ñ": { base: "N", accent: "tilde" },
};

interface Raster {
  width: number;
  height: number;
  data: Uint8Array;
}

function createRaster(width: number, height: number): Raster {
  const data = new Uint8Array(width * height * 4);
  data.fill(255);
  return { width, height, data };
}

function putPixel(raster: Raster, x: number, y: number, color: Rgb): void {
  if (x < 0 || y < 0 || x >= raster.width || y >= raster.height) return;
  const offset = (y * raster.width + x) * 4;
  raster.data[offset] = color.r;
  raster.data[offset + 1] = color.g;
  raster.data[offset + 2] = color.b;
  raster.data[offset + 3] = 255;
}

function fillRect(raster: Raster, node: DesignNode, color: Rgb, scale: number): void {
  const x0 = Math.round(node.x * scale);
  const y0 = Math.round(node.y * scale);
  const x1 = Math.round((node.x + node.width) * scale);
  const y1 = Math.round((node.y + node.height) * scale);
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) putPixel(raster, x, y, color);
  }
}

function fillEllipse(raster: Raster, node: DesignNode, color: Rgb, scale: number): void {
  const rx = (node.width * scale) / 2;
  const ry = (node.height * scale) / 2;
  const cx = node.x * scale + rx;
  const cy = node.y * scale + ry;
  if (rx <= 0 || ry <= 0) return;
  const x0 = Math.floor(cx - rx);
  const x1 = Math.ceil(cx + rx);
  const y0 = Math.floor(cy - ry);
  const y1 = Math.ceil(cy + ry);
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) putPixel(raster, x, y, color);
    }
  }
}

function drawGlyphRow(raster: Raster, row: string, x: number, y: number, pixel: number, color: Rgb): void {
  for (let i = 0; i < row.length; i += 1) {
    if (row[i] !== "#") continue;
    for (let py = 0; py < pixel; py += 1) {
      for (let px = 0; px < pixel; px += 1) putPixel(raster, x + i * pixel + px, y + py, color);
    }
  }
}

function drawRasterText(
  raster: Raster,
  document: DesignDocument,
  node: DesignNode,
  color: Rgb,
  scale: number,
  findings: string[],
): void {
  const text = textOf(document, node);
  const fontSize = fontSizeFor(node) * scale;
  const pixel = Math.max(1, Math.round(fontSize / 7));
  const glyphWidth = 6 * pixel;
  const totalWidth = text.length * glyphWidth;
  const left = Math.round(node.x * scale + Math.max(0, (node.width * scale - totalWidth) / 2));
  const glyphHeight = 7 * pixel;
  const top = Math.round(node.y * scale + Math.max(0, (node.height * scale - glyphHeight) / 2));

  let uppercase = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i] as string;
    const x = left + i * glyphWidth;
    const decomposed = DECOMPOSABLE[char];
    if (decomposed) {
      const glyph = GLYPHS[decomposed.base] as readonly string[];
      glyph.forEach((row, index) => drawGlyphRow(raster, row, x, top + index * pixel, pixel, color));
      (ACCENTS[decomposed.accent] as readonly string[]).forEach((row, index) =>
        drawGlyphRow(raster, row, x, top + (index - 2) * pixel, pixel, color),
      );
      continue;
    }
    let glyph = GLYPHS[char];
    if (glyph === undefined) {
      const upper = char.toUpperCase();
      if (GLYPHS[upper] !== undefined && upper !== char) {
        glyph = GLYPHS[upper];
        if (/[a-z]/.test(char)) uppercase = true;
      }
    }
    if (glyph === undefined) {
      throw new DomainError("invalid_input", "The raster font has no glyph for this character.", {
        details: { character: char, codePoint: char.codePointAt(0) ?? 0, nodeId: node.id },
      });
    }
    glyph.forEach((row, index) => drawGlyphRow(raster, row, x, top + index * pixel, pixel, color));
  }
  if (uppercase) findings.push(`raster_uppercase_glyphs:${node.id}`);
}

function encodePng(raster: Raster, dpi: number): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(raster.width, 0);
  ihdr.writeUInt32BE(raster.height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(6, 9); // truecolor with alpha
  ihdr.writeUInt8(0, 10); // deflate
  ihdr.writeUInt8(0, 11); // adaptive filtering
  ihdr.writeUInt8(0, 12); // no interlace

  const phys = Buffer.alloc(9);
  const perMetre = Math.round(dpi / 0.0254);
  phys.writeUInt32BE(perMetre, 0);
  phys.writeUInt32BE(perMetre, 4);
  phys.writeUInt8(1, 8); // pixels per metre

  const stride = raster.width * 4;
  const raw = Buffer.alloc((stride + 1) * raster.height);
  for (let y = 0; y < raster.height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none, so bytes are reproducible
    Buffer.from(raster.data.buffer, raster.data.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }

  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("pHYs", phys),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function renderPng(document: DesignDocument, dpi: number, findings: string[]): { bytes: Buffer; scale: number } {
  const scale = dpi / 96;
  const width = Math.round(PAGE_WIDTH * scale);
  const height = Math.round(PAGE_HEIGHT * scale);
  if (width * height > MAX_RASTER_PIXELS) {
    throw new DomainError("invalid_input", "The requested raster exceeds the size limit.", {
      details: { width, height, maximumPixels: MAX_RASTER_PIXELS },
    });
  }
  const raster = createRaster(width, height);
  const nodes = drawableNodes(document);
  const hasText = nodes.some((node) => node.kind === "text");
  if (hasText) findings.push("raster_builtin_bitmap_font");

  for (const node of nodes) {
    const color = fillOf(node, findings);
    if (node.kind === "rect") fillRect(raster, node, color, scale);
    else if (node.kind === "ellipse") fillEllipse(raster, node, color, scale);
    else drawRasterText(raster, document, node, color, scale, findings);
  }
  return { bytes: encodePng(raster, dpi), scale };
}

// ---------------------------------------------------------------------------
// SVG
// ---------------------------------------------------------------------------

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function renderSvg(document: DesignDocument, findings: string[]): Buffer {
  const parts: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_WIDTH}" height="${PAGE_HEIGHT}" viewBox="0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}">`,
    `<rect x="0" y="0" width="${PAGE_WIDTH}" height="${PAGE_HEIGHT}" fill="#ffffff"/>`,
  ];
  for (const node of drawableNodes(document)) {
    const color = fillOf(node, findings);
    const hex = `#${[color.r, color.g, color.b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
    if (node.kind === "rect") {
      parts.push(
        `<rect data-node="${escapeXml(node.id)}" x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" fill="${hex}"/>`,
      );
    } else if (node.kind === "ellipse") {
      parts.push(
        `<ellipse data-node="${escapeXml(node.id)}" cx="${node.x + node.width / 2}" cy="${node.y + node.height / 2}" rx="${node.width / 2}" ry="${node.height / 2}" fill="${hex}"/>`,
      );
    } else {
      const text = textOf(document, node);
      const size = fontSizeFor(node);
      parts.push(
        `<text data-node="${escapeXml(node.id)}" x="${node.x}" y="${node.y + node.height / 2 + size * 0.35}" font-family="${escapeXml(node.fontRef ?? "unknown")}" font-size="${size}" fill="${hex}">${escapeXml(text)}</text>`,
      );
      if (node.fontRef === null) findings.push(`svg_font_family_unknown:${node.id}`);
    }
  }
  parts.push("</svg>");
  return Buffer.from(`${parts.join("\n")}\n`, "utf8");
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

const KAPPA = 0.5522847498307936;

function pdfNumber(value: number): string {
  return (Math.round(value * 1000) / 1000).toString();
}

function pdfColor(color: Rgb): string {
  return `${pdfNumber(color.r / 255)} ${pdfNumber(color.g / 255)} ${pdfNumber(color.b / 255)}`;
}

function pdfEscape(text: string, nodeId: string): string {
  let out = "";
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code > 255) {
      // WinAnsi stops at 255. Replacing it would ship different words.
      throw new DomainError("invalid_input", "The PDF text encoding cannot represent this character.", {
        details: { character: char, codePoint: code, nodeId },
      });
    }
    if (char === "\\" || char === "(" || char === ")") out += `\\${char}`;
    else if (code < 32) out += " ";
    else out += char;
  }
  return out;
}

function renderPdf(document: DesignDocument, findings: string[]): Buffer {
  const hasText = document.nodes.some((node) => node.kind === "text");
  if (hasText) findings.push("pdf_base14_font_substituted");

  // PDF y grows upwards: convert once, here, so the content stream stays readable.
  const flip = (y: number): number => PAGE_HEIGHT - y;
  const ops: string[] = [];
  for (const node of drawableNodes(document)) {
    const color = fillOf(node, findings);
    if (node.kind === "rect") {
      ops.push(
        `${pdfColor(color)} rg`,
        `${pdfNumber(node.x)} ${pdfNumber(flip(node.y + node.height))} ${pdfNumber(node.width)} ${pdfNumber(node.height)} re f`,
      );
    } else if (node.kind === "ellipse") {
      const rx = node.width / 2;
      const ry = node.height / 2;
      const cx = node.x + rx;
      const cy = node.y + ry;
      // Four cubic arcs in flipped coordinates: right, top, left, bottom.
      const cyPdf = flip(cy);
      const kx = KAPPA * rx;
      const ky = KAPPA * ry;
      ops.push(
        `${pdfColor(color)} rg`,
        `${pdfNumber(cx + rx)} ${pdfNumber(cyPdf)} m`,
        `${pdfNumber(cx + rx)} ${pdfNumber(cyPdf + ky)} ${pdfNumber(cx + kx)} ${pdfNumber(cyPdf + ry)} ${pdfNumber(cx)} ${pdfNumber(cyPdf + ry)} c`,
        `${pdfNumber(cx - kx)} ${pdfNumber(cyPdf + ry)} ${pdfNumber(cx - rx)} ${pdfNumber(cyPdf + ky)} ${pdfNumber(cx - rx)} ${pdfNumber(cyPdf)} c`,
        `${pdfNumber(cx - rx)} ${pdfNumber(cyPdf - ky)} ${pdfNumber(cx - kx)} ${pdfNumber(cyPdf - ry)} ${pdfNumber(cx)} ${pdfNumber(cyPdf - ry)} c`,
        `${pdfNumber(cx + kx)} ${pdfNumber(cyPdf - ry)} ${pdfNumber(cx + rx)} ${pdfNumber(cyPdf - ky)} ${pdfNumber(cx + rx)} ${pdfNumber(cyPdf)} c`,
        `f`,
      );
    } else {
      const text = textOf(document, node);
      const size = fontSizeFor(node);
      const baseline = node.y + node.height / 2 + size * 0.35;
      ops.push(
        "BT",
        `/F1 ${pdfNumber(size)} Tf`,
        `${pdfColor(color)} rg`,
        `1 0 0 1 ${pdfNumber(node.x)} ${pdfNumber(flip(baseline))} Tm`,
        `(${pdfEscape(text, node.id)}) Tj`,
        "ET",
      );
    }
  }

  const content = Buffer.from(ops.join("\n"), "latin1");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>`,
    Buffer.concat([
      Buffer.from(`<< /Length ${content.length} >>\nstream\n`, "latin1"),
      content,
      Buffer.from("\nendstream", "latin1"),
    ]),
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];

  const header = Buffer.from("%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n", "latin1");
  const chunks: Buffer[] = [header];
  const offsets: number[] = [];
  let position = header.length;
  objects.forEach((body, index) => {
    const objectBody = Buffer.isBuffer(body) ? body : Buffer.from(body, "latin1");
    const head = Buffer.from(`${index + 1} 0 obj\n`, "latin1");
    const tail = Buffer.from("\nendobj\n", "latin1");
    offsets.push(position);
    chunks.push(head, objectBody, tail);
    position += head.length + objectBody.length + tail.length;
  });

  const xrefStart = position;
  const xref: string[] = ["xref", `0 ${objects.length + 1}`, "0000000000 65535 f "];
  for (const offset of offsets) xref.push(`${offset.toString().padStart(10, "0")} 00000 n `);
  const trailer = [
    xref.join("\n"),
    "trailer",
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    "startxref",
    String(xrefStart),
    "%%EOF",
    "",
  ].join("\n");
  chunks.push(Buffer.from(trailer, "latin1"));
  return Buffer.concat(chunks);
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Render the document described by the manifest.
 *
 * The manifest is the authorisation: a document that no longer matches it, or
 * rights that changed after it was built, cannot produce bytes. The output
 * carries the hash of those bytes so a receipt can bind the file the recipient
 * actually got.
 */
export function renderDocument(request: RenderRequest): RenderOutput {
  const { document, manifest } = request;
  const format = manifest.format;
  if (!isRenderFormat(format)) {
    throw new DomainError("unsupported_operation", "This format has no renderer.", {
      details: { format, supported: RENDER_FORMATS.join(",") },
    });
  }
  if (manifest.documentId !== document.id || manifest.documentVersion !== document.version) {
    throw new DomainError("version_conflict", "The manifest describes a different document version.", {
      details: { manifestDocument: manifest.documentId, manifestVersion: manifest.documentVersion },
    });
  }

  assertTextNodesResolvable(document);
  assertManifestCurrent(manifest, document, request.rights);

  if (!Number.isFinite(manifest.dpi) || manifest.dpi <= 0) {
    throw new DomainError("invalid_input", "The manifest DPI is not usable.");
  }

  const findings: string[] = [];
  let bytes: Buffer;
  let width = PAGE_WIDTH;
  let height = PAGE_HEIGHT;

  if (format === "pdf") bytes = renderPdf(document, findings);
  else if (format === "svg") bytes = renderSvg(document, findings);
  else {
    const raster = renderPng(document, manifest.dpi, findings);
    bytes = raster.bytes;
    width = Math.round(PAGE_WIDTH * raster.scale);
    height = Math.round(PAGE_HEIGHT * raster.scale);
  }

  const uniqueFindings = [...new Set(findings)].sort();
  if (uniqueFindings.length > 0 && request.acceptFindings !== true) {
    throw new DomainError("policy_violation", "The render substitutes something the manifest promised.", {
      details: { findings: uniqueFindings.join(","), reason: "findings_not_accepted" },
    });
  }

  return {
    format,
    mimeType: MIME[format],
    bytes,
    byteLength: bytes.length,
    contentSha256: createHash("sha256").update(bytes).digest("hex"),
    documentHashRef: manifest.editableHash,
    renderHash: renderIdentity(document),
    manifestHash: manifest.hash,
    width,
    height,
    findings: uniqueFindings,
  };
}
