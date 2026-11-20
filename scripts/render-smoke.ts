/**
 * Render smoke test with a real file on disk.
 *
 * Prints the hash of each artifact so a person can verify that the file they
 * open is the file the manifest describes.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { contentHash } from "../src/contracts/evidence.ts";
import { designDocumentSchema } from "../src/domain/document.ts";
import { preflight } from "../src/domain/export.ts";
import { renderDocument } from "../src/domain/render.ts";

const now = new Date("2026-11-20T10:00:00.000Z");
const document = designDocumentSchema.parse({
  id: "doc_smoke",
  tenantId: "tenant_demo",
  version: 1,
  nodes: [
    { id: "bg", kind: "rect", x: 0, y: 0, width: 1200, height: 800, textRef: null, fontRef: null, fill: "#0f172a", locked: false },
    { id: "mark", kind: "ellipse", x: 96, y: 96, width: 96, height: 96, textRef: null, fontRef: null, fill: "#f97316", locked: false },
    { id: "rule", kind: "rect", x: 96, y: 236, width: 420, height: 6, textRef: null, fontRef: null, fill: "#f97316", locked: false },
    { id: "title", kind: "text", x: 96, y: 280, width: 1000, height: 72, textRef: "title", fontRef: "inter", fill: "#f8fafc", locked: false },
    { id: "sub", kind: "text", x: 96, y: 380, width: 900, height: 40, textRef: "subtitle", fontRef: "inter", fill: "#94a3b8", locked: false },
  ],
  textSources: { title: "Sistema de marca verificable", subtitle: "Buffy · export real, con hash" },
  engine: "deterministic",
  engineVersion: "1.0.0",
  fontHash: contentHash({ family: "Inter" }),
  constraints: ["grid:8"],
});

const font = {
  id: "font_demo",
  tenantId: "tenant_demo",
  family: "Inter",
  foundry: "Example Foundry",
  licenseRef: "license-demo",
  licenseVerified: true,
  embeddingAllowed: true,
  subsettingAllowed: true,
  redistributionAllowed: false,
  verifiedAt: now.toISOString(),
};

await mkdir("artifacts/render", { recursive: true });
for (const format of ["pdf", "png", "svg"] as const) {
  const dpi = format === "pdf" ? 300 : 96;
  const manifest = preflight({
    document,
    font,
    assets: [],
    format,
    dpi,
    colorProfile: format === "pdf" ? "CMYK" : "sRGB",
    now,
  });
  const output = renderDocument({ document, manifest, rights: [], acceptFindings: true });
  const path = `artifacts/render/brand-sample.${format}`;
  await writeFile(path, output.bytes);
  console.log(
    `${path} · ${output.byteLength} bytes · ${output.width}x${output.height} · sha256=${output.contentSha256.slice(0, 16)}… · findings=${output.findings.join("|") || "none"}`,
  );
}
