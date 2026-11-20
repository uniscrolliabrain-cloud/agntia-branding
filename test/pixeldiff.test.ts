import { test } from "node:test";
import assert from "node:assert/strict";
import { DomainError } from "../src/contracts/errors.ts";
import {
  designDocumentSchema,
  updateDocument,
  type DesignDocument,
} from "../src/domain/document.ts";
import { assertRenderChangeVisible, diffRenders } from "../src/domain/pixeldiff.ts";
import { rasterizeDocument } from "../src/domain/render.ts";
import { contentHash } from "../src/contracts/evidence.ts";
import { TENANT_A } from "./helpers.ts";

function document(overrides: Partial<DesignDocument> = {}): DesignDocument {
  return designDocumentSchema.parse({
    id: "doc_diff",
    tenantId: TENANT_A,
    version: 1,
    nodes: [
      { id: "bg", kind: "rect", x: 0, y: 0, width: 1200, height: 800, textRef: null, fontRef: null, fill: "#ffffff", locked: false },
      { id: "block", kind: "rect", x: 100, y: 100, width: 200, height: 100, textRef: null, fontRef: null, fill: "#ff0000", locked: false },
      { id: "label", kind: "text", x: 100, y: 300, width: 400, height: 30, textRef: "label", fontRef: "inter", fill: "#000000", locked: false },
    ],
    textSources: { label: "Marca" },
    engine: "deterministic",
    engineVersion: "1.0.0",
    fontHash: contentHash({ family: "Inter" }),
    constraints: [],
    ...overrides,
  });
}

test("rasterizar es determinista y coincide con el PNG que se entrega", () => {
  const doc = document();
  const first = rasterizeDocument(doc, 96);
  const second = rasterizeDocument(doc, 96);
  assert.equal(first.width, 1200);
  assert.equal(first.height, 800);
  assert.equal(first.data.length, 1200 * 800 * 4);
  assert.ok(Buffer.from(first.data).equals(Buffer.from(second.data)));
  assert.deepEqual(first.findings, ["raster_builtin_bitmap_font", "raster_uppercase_glyphs:label"]);
});

test("un cambio de relleno aparece en los píxeles y dentro del nodo", () => {
  const before = document();
  const after = updateDocument(before, [{ nodeId: "block", changes: { fill: "#0000ff" } }], 1);
  const diff = diffRenders(before, after, { dpi: 96 });

  assert.ok(diff.differingPixels > 0);
  assert.ok(diff.ratio > 0 && diff.ratio < 1);
  assert.equal(diff.withinTolerance, false);
  assert.deepEqual(diff.unexplainedChanges, []);
  const box = diff.boundingBox;
  assert.ok(box);
  assert.ok(box.x >= 100 && box.x <= 300, `el diff debe empezar dentro del bloque, empieza en ${box.x}`);
  assert.ok(box.y >= 100 && box.y <= 200);
  assert.ok(box.width <= 200 && box.height <= 100, "el cambio no puede extenderse fuera del nodo editado");
  assert.doesNotThrow(() => assertRenderChangeVisible(diff));
});

test("dos renders del mismo documento no divergen", () => {
  const doc = document();
  const diff = diffRenders(doc, doc, { dpi: 96 });
  assert.equal(diff.differingPixels, 0);
  assert.equal(diff.boundingBox, null);
  assert.equal(diff.withinTolerance, true);
  assert.deepEqual(diff.unexplainedChanges, []);
  assert.throws(
    () => assertRenderChangeVisible(diff),
    (error: unknown) => error instanceof DomainError && error.code === "policy_violation",
  );
});

test("la tolerancia se declara y se respeta", () => {
  const before = document();
  const after = updateDocument(before, [{ nodeId: "block", changes: { fill: "#fe0000" } }], 1);

  const strict = diffRenders(before, after, { dpi: 96, tolerance: 0 });
  assert.ok(strict.differingPixels > 0, "con tolerancia 0 un canal distinto cuenta");

  const lax = diffRenders(before, after, { dpi: 96, tolerance: 2 });
  assert.equal(lax.differingPixels, 0, "una diferencia de 1 canal queda dentro de la tolerancia");
  assert.equal(lax.withinTolerance, true);

  assert.throws(
    () => diffRenders(before, after, { dpi: 96, tolerance: 300 }),
    (error: unknown) => error instanceof DomainError && error.code === "invalid_input",
  );
});

test("un cambio fuera de la página se detecta como invisible", () => {
  const before = document();
  const after = updateDocument(
    designDocumentSchema.parse({
      ...before,
      nodes: [
        ...before.nodes,
        { id: "offpage", kind: "rect", x: 5000, y: 5000, width: 50, height: 50, textRef: null, fontRef: null, fill: "#00ff00", locked: false },
      ],
    }),
    [{ nodeId: "offpage", changes: { fill: "#000000" } }],
    1,
  );
  const diff = diffRenders(before, after, { dpi: 96 });

  assert.equal(diff.differingPixels, 0);
  assert.deepEqual(diff.unexplainedChanges, ["offpage"]);
  assert.ok(diff.findings.includes("invisible_change:offpage"));
  assert.throws(
    () => assertRenderChangeVisible(diff),
    (error: unknown) =>
      error instanceof DomainError &&
      error.code === "policy_violation" &&
      JSON.stringify(error.details).includes("invisible_change"),
  );
});

test("comparar resoluciones distintas se rechaza en lugar de promediarse", () => {
  const doc = document();
  assert.equal(rasterizeDocument(doc, 96).width, 1200);
  assert.equal(rasterizeDocument(doc, 48).width, 600);
  assert.throws(
    () => diffRenders(doc, doc, { dpi: 0 }),
    (error: unknown) => error instanceof DomainError && error.code === "invalid_input",
  );
});
