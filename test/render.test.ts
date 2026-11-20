import { test } from "node:test";
import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import { DomainError } from "../src/contracts/errors.ts";
import { designDocumentSchema, updateDocument, type DesignDocument } from "../src/domain/document.ts";
import { preflight, type ExportManifest } from "../src/domain/export.ts";
import { renderDocument } from "../src/domain/render.ts";
import { contentHash } from "../src/contracts/evidence.ts";
import { TENANT_A } from "./helpers.ts";

const now = new Date("2026-11-15T10:00:00.000Z");

const font = {
  id: "f1",
  tenantId: TENANT_A,
  family: "Inter",
  foundry: "Example Foundry",
  licenseRef: "license-ref-1",
  licenseVerified: true,
  embeddingAllowed: true,
  subsettingAllowed: true,
  redistributionAllowed: false,
  verifiedAt: now.toISOString(),
};

function document(overrides: Partial<DesignDocument> = {}): DesignDocument {
  return designDocumentSchema.parse({
    id: "doc_render",
    tenantId: TENANT_A,
    version: 3,
    nodes: [
      { id: "r1", kind: "rect", x: 100, y: 100, width: 300, height: 120, textRef: null, fontRef: null, fill: "#ff0000", locked: false },
      { id: "e1", kind: "ellipse", x: 500, y: 100, width: 200, height: 120, textRef: null, fontRef: null, fill: "#0000ff", locked: false },
      { id: "t1", kind: "text", x: 100, y: 300, width: 600, height: 40, textRef: "headline", fontRef: "inter", fill: "#111111", locked: false },
    ],
    textSources: { headline: "Diseño verificable" },
    engine: "deterministic",
    engineVersion: "1.0.0",
    fontHash: contentHash({ family: "Inter" }),
    constraints: [],
    ...overrides,
  });
}

function manifestFor(doc: DesignDocument, format: "pdf" | "png" | "svg", dpi = 96): ExportManifest {
  return preflight({
    document: doc,
    font,
    assets: [],
    format,
    dpi,
    colorProfile: format === "pdf" ? "CMYK" : "sRGB",
    now,
  });
}

/** Reads the IDAT payload back, so the assertion is about real pixels. */
function decodePng(bytes: Buffer): { width: number; height: number; pixel: (x: number, y: number) => number[] } {
  assert.deepEqual([...bytes.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  let offset = 8;
  let width = 0;
  let height = 0;
  const idat: Buffer[] = [];
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("latin1");
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      assert.equal(data.readUInt8(8), 8);
      assert.equal(data.readUInt8(9), 6);
    } else if (type === "IDAT") idat.push(data);
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  assert.equal(raw.length, (stride + 1) * height);
  return {
    width,
    height,
    pixel: (x: number, y: number) => {
      assert.equal(raw[y * (stride + 1)], 0, "every row uses filter 0, so bytes are reproducible");
      const start = y * (stride + 1) + 1 + x * 4;
      return [raw[start], raw[start + 1], raw[start + 2], raw[start + 3]] as number[];
    },
  };
}

test("render PNG produce bytes reales y exige aceptar la sustitución de tipografía", () => {
  const doc = document();
  const manifest = manifestFor(doc, "png");

  assert.throws(
    () => renderDocument({ document: doc, manifest, rights: [] }),
    (error: unknown) =>
      error instanceof DomainError &&
      error.code === "policy_violation" &&
      JSON.stringify(error.details).includes("raster_builtin_bitmap_font"),
  );

  const output = renderDocument({ document: doc, manifest, rights: [], acceptFindings: true });
  assert.equal(output.mimeType, "image/png");
  assert.match(output.contentSha256, /^[a-f0-9]{64}$/);
  assert.equal(output.manifestHash, manifest.hash);
  assert.deepEqual(output.findings, ["raster_builtin_bitmap_font", "raster_uppercase_glyphs:t1"]);

  const png = decodePng(output.bytes);
  assert.equal(png.width, 1200);
  assert.equal(png.height, 800);
  assert.deepEqual(png.pixel(150, 150), [255, 0, 0, 255], "el rectángulo se pinta donde el documento dice");
  assert.deepEqual(png.pixel(1050, 150), [255, 255, 255, 255], "fuera del rectángulo el fondo es blanco");
  assert.deepEqual(png.pixel(600, 160), [0, 0, 255, 255], "la elipse se rellena");
  // The text row must contain dark pixels: ink actually landed on the page.
  let dark = 0;
  for (let x = 100; x < 700; x += 1) {
    const [r, g, b] = png.pixel(x, 320);
    if ((r as number) < 64 && (g as number) < 64 && (b as number) < 64) dark += 1;
  }
  assert.ok(dark > 20, `se esperaban píxeles de texto, se encontraron ${dark}`);
});

test("render PNG es determinista byte a byte", () => {
  const doc = document();
  const manifest = manifestFor(doc, "png");
  const first = renderDocument({ document: doc, manifest, rights: [], acceptFindings: true });
  const second = renderDocument({ document: doc, manifest, rights: [], acceptFindings: true });
  assert.equal(first.contentSha256, second.contentSha256);
  assert.ok(first.bytes.equals(second.bytes));

  const edited = updateDocument(doc, [{ nodeId: "r1", changes: { x: 120 } }], 3);
  const editedManifest = manifestFor(edited, "png");
  const third = renderDocument({ document: edited, manifest: editedManifest, rights: [], acceptFindings: true });
  assert.notEqual(third.contentSha256, first.contentSha256, "mover un nodo cambia los bytes, no solo el manifiesto");
});

test("render SVG entrega vector con el texto escapado y sin sustituciones", () => {
  const doc = document({ textSources: { headline: 'A < B & "C"' } });
  const manifest = manifestFor(doc, "svg");
  const output = renderDocument({ document: doc, manifest, rights: [] });
  const svg = output.bytes.toString("utf8");

  assert.equal(output.findings.length, 0, "sin fallback: no hace falta aceptar nada");
  assert.ok(svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.ok(svg.trimEnd().endsWith("</svg>"));
  assert.match(svg, /viewBox="0 0 1200 800"/);
  assert.match(svg, /<rect data-node="r1" x="100" y="100" width="300" height="120" fill="#ff0000"\/>/);
  assert.match(svg, /<ellipse data-node="e1" cx="600" cy="160" rx="100" ry="60" fill="#0000ff"\/>/);
  assert.ok(svg.includes("A &lt; B &amp; &quot;C&quot;"), "el texto no puede romper el XML");
  assert.ok(!/javascript:|onload=/.test(svg));
});

test("render PDF es estructuralmente válido: xref apunta a cada objeto", () => {
  const doc = document();
  const manifest = manifestFor(doc, "pdf", 300);
  const output = renderDocument({ document: doc, manifest, rights: [], acceptFindings: true });
  const pdf = output.bytes.toString("latin1");

  assert.ok(pdf.startsWith("%PDF-1.4"));
  assert.ok(pdf.trimEnd().endsWith("%%EOF"));
  assert.deepEqual(output.findings, ["pdf_base14_font_substituted"]);
  assert.equal(output.width, 1200);
  assert.match(pdf, /\/MediaBox \[0 0 1200 800\]/);

  const startxref = /startxref\n(\d+)\n%%EOF/.exec(pdf);
  assert.ok(startxref, "el PDF debe declarar startxref");
  const xrefOffset = Number(startxref[1]);
  assert.equal(pdf.slice(xrefOffset, xrefOffset + 4), "xref");

  const table = pdf.slice(xrefOffset).split("\n");
  assert.equal(table[1], "0 6", "cinco objetos más la entrada libre");
  for (let index = 1; index <= 5; index += 1) {
    const entry = table[index + 2] as string;
    const matches = /^(\d{10}) 00000 n $/.exec(entry);
    assert.ok(matches, `entrada xref ${index} con formato válido`);
    const offset = Number(matches[1]);
    assert.ok(
      pdf.startsWith(`${index} 0 obj`, offset),
      `la entrada ${index} del xref debe apuntar a su objeto, apunta a ${JSON.stringify(pdf.slice(offset, offset + 12))}`,
    );
  }

  const length = /\/Length (\d+)/.exec(pdf);
  assert.ok(length, "el stream declara su longitud");
  const streamStart = pdf.indexOf("stream\n") + "stream\n".length;
  const streamEnd = pdf.indexOf("\nendstream");
  assert.equal(Number(length[1]), streamEnd - streamStart, "la longitud del stream debe ser exacta");
  assert.match(pdf, /\(Diseño verificable\) Tj/, "el texto viaja en WinAnsi y se puede extraer");
});

test("el render se ata al manifiesto: versión distinta o documento editado no producen bytes", () => {
  const doc = document();
  const manifest = manifestFor(doc, "svg");
  const edited = updateDocument(doc, [{ nodeId: "t1", changes: { y: 320 } }], 3);

  assert.throws(
    () => renderDocument({ document: edited, manifest, rights: [] }),
    (error: unknown) => error instanceof DomainError && error.code === "version_conflict",
  );

  const otherVersion = { ...manifest, documentVersion: 2 };
  assert.throws(
    () => renderDocument({ document: doc, manifest: otherVersion, rights: [] }),
    (error: unknown) => error instanceof DomainError && error.code === "version_conflict",
  );

  const tokensManifest = { ...manifest, format: "tokens-json" as const };
  assert.throws(
    () => renderDocument({ document: doc, manifest: tokensManifest, rights: [] }),
    (error: unknown) => error instanceof DomainError && error.code === "unsupported_operation",
  );
});

test("el render falla cerrado ante lo que no puede dibujar con verdad", () => {
  const manifest = manifestFor(document(), "svg");

  const withPath = document({
    nodes: [
      { id: "p1", kind: "path", x: 0, y: 0, width: 10, height: 10, textRef: null, fontRef: null, fill: "#000000", locked: false },
    ],
  });
  assert.throws(
    () => renderDocument({ document: withPath, manifest: manifestFor(withPath, "svg"), rights: [] }),
    (error: unknown) =>
      error instanceof DomainError &&
      error.code === "unsupported_operation" &&
      JSON.stringify(error.details).includes("p1:path"),
  );

  const withImage = document({
    nodes: [
      { id: "i1", kind: "image", x: 0, y: 0, width: 10, height: 10, textRef: null, fontRef: null, fill: null, locked: false },
    ],
  });
  assert.throws(
    () => renderDocument({ document: withImage, manifest: manifestFor(withImage, "svg"), rights: [] }),
    (error: unknown) => error instanceof DomainError && error.code === "unsupported_operation",
  );

  // A glyph the raster font does not have must fail, never print a blank.
  const withGreek = document({ textSources: { headline: "Ω" } });
  assert.throws(
    () =>
      renderDocument({ document: withGreek, manifest: manifestFor(withGreek, "png"), rights: [], acceptFindings: true }),
    (error: unknown) => error instanceof DomainError && error.code === "invalid_input",
  );

  const huge = document();
  assert.throws(
    () => renderDocument({ document: huge, manifest: manifestFor(huge, "png", 2400), rights: [], acceptFindings: true }),
    (error: unknown) => error instanceof DomainError && error.code === "invalid_input",
  );
});

test("el render no se salta el preflight de derechos ni de fuentes", () => {
  const doc = document();
  const manifest = manifestFor(doc, "svg");
  const revoked = {
    id: "ar1",
    tenantId: TENANT_A,
    assetHash: contentHash({ asset: "photo-1" }),
    source: "licensed" as const,
    licenseRef: "license-photo-1",
    releaseRef: "release-1",
    purposes: ["brandbook" as const],
    territory: ["ES"],
    expiresAt: null,
    revokedAt: now.toISOString(),
  };
  assert.throws(
    () => renderDocument({ document: doc, manifest, rights: [revoked] }),
    (error: unknown) => error instanceof DomainError && error.code === "rights_missing",
  );

  const unlicensed = { ...font, licenseVerified: false, verifiedAt: null };
  assert.throws(
    () =>
      preflight({
        document: doc,
        font: unlicensed,
        assets: [],
        format: "png",
        dpi: 144,
        colorProfile: "sRGB",
        now,
      }),
    (error: unknown) => error instanceof DomainError && error.code === "font_license_unverified",
  );
});
