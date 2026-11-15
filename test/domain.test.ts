import { test } from "node:test";
import assert from "node:assert/strict";
import { DomainError } from "../src/contracts/errors.ts";
import { designDocumentSchema, diffDocuments, renderIdentity, updateDocument, type DesignDocument } from "../src/domain/document.ts";
import { sanitizeSvg } from "../src/domain/canvas.ts";
import { contrastRatio, evaluatePalette, assertPalettePasses } from "../src/domain/palette.ts";
import { exportIsReproducible, exportStyleDictionary, resolveToken, validateTokenSet, type TokenSet } from "../src/domain/tokens.ts";
import { evaluateQuality, verifyRenderedText } from "../src/domain/qa.ts";
import { contentHash } from "../src/contracts/evidence.ts";
import { TENANT_A } from "./helpers.ts";

const FONT_HASH = contentHash({ family: "Inter", weights: [400, 700] });

function doc(overrides: Partial<DesignDocument> = {}): DesignDocument {
  return designDocumentSchema.parse({
    id: "doc_1",
    tenantId: TENANT_A,
    version: 3,
    nodes: [
      { id: "n1", kind: "rect", x: 0, y: 0, width: 100, height: 50, textRef: null, fontRef: null, fill: "#101010", locked: false },
      { id: "n2", kind: "text", x: 10, y: 10, width: 80, height: 20, textRef: "tagline", fontRef: "inter", fill: "#ffffff", locked: true },
    ],
    textSources: { tagline: "Marca clara, decisiones rápidas" },
    engine: "deterministic",
    engineVersion: "1.0.0",
    fontHash: FONT_HASH,
    constraints: ["safe-area"],
    ...overrides,
  });
}

test("CAS: editar con versión antigua produce conflicto", () => {
  assert.throws(
    () => updateDocument(doc(), [{ nodeId: "n1", changes: { x: 5 } }], 2),
    (error: unknown) => error instanceof DomainError && error.code === "version_conflict",
  );
});

test("CAS: editar con la versión correcta incrementa versión", () => {
  const next = updateDocument(doc(), [{ nodeId: "n1", changes: { x: 25 } }], 3);
  assert.equal(next.version, 4);
  assert.equal(next.nodes[0]?.x, 25);
});

test("un nodo bloqueado no se puede editar", () => {
  assert.throws(
    () => updateDocument(doc(), [{ nodeId: "n2", changes: { x: 99 } }], 3),
    (error: unknown) => error instanceof DomainError && error.code === "policy_violation",
  );
});

test("el diff identifica cambios reales por nodo", () => {
  const before = doc();
  const after = updateDocument(before, [{ nodeId: "n1", changes: { fill: "#202020" } }], 3);
  const diff = diffDocuments(before, after);
  assert.deepEqual(diff.changed, ["n1"]);
  assert.deepEqual(diff.added, []);
  assert.deepEqual(diff.removed, []);
});

test("el render es determinista y cambia si cambia la fuente", () => {
  const a = renderIdentity(doc());
  const b = renderIdentity(doc());
  assert.equal(a, b);
  const otherFont = renderIdentity(doc({ fontHash: contentHash({ family: "Other" }) }));
  assert.notEqual(a, otherFont);
});

test("SVG: script se rechaza", () => {
  assert.throws(
    () => sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
    (error: unknown) => error instanceof DomainError && error.code === "policy_violation",
  );
});

test("SVG: manejador de evento inline se rechaza", () => {
  assert.throws(
    () => sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg"><rect onload="steal()"/></svg>'),
    (error: unknown) => error instanceof DomainError && error.code === "policy_violation",
  );
});

test("SVG: referencia externa y data URI se rechazan", () => {
  assert.throws(() => sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil.test/x.png"/></svg>'));
  assert.throws(() => sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/png;base64,AAAA"/></svg>'));
});

test("SVG: entidad XML y foreignObject se rechazan", () => {
  assert.throws(() => sanitizeSvg('<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg/>'));
  assert.throws(() => sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg"><foreignObject/></svg>'));
});

test("SVG válido se conserva y pierde atributos no permitidos", () => {
  const result = sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect x="1" y="2" width="3" height="4" fill="#fff" data-x="1"/></svg>');
  assert.match(result.svg, /<rect x="1" y="2" width="3" height="4" fill="#fff">/);
  assert.deepEqual(result.strippedAttributes, ["data-x"]);
});

test("contraste se calcula: negro sobre blanco es 21", () => {
  assert.equal(contrastRatio("#000000", "#ffffff"), 21);
});

test("un par con contraste insuficiente bloquea la paleta", () => {
  const findings = evaluatePalette([{ id: "gray", foreground: "#777777", background: "#ffffff", usage: "normal_text" }]);
  assert.equal(findings[0]?.passes, false);
  assert.throws(() => assertPalettePasses([{ id: "gray", foreground: "#777777", background: "#ffffff", usage: "normal_text" }]));
});

function tokenSet(overrides: Partial<TokenSet> = {}): TokenSet {
  return {
    id: "ts_1",
    tenantId: TENANT_A,
    version: 0,
    theme: "light",
    tokens: [
      { path: "color.brand.primary", type: "color", value: "#0a5cff", aliasOf: null, description: null },
      { path: "color.brand.cta", type: "color", value: "#0a5cff", aliasOf: "color.brand.primary", description: null },
      { path: "space.md", type: "dimension", value: "16px", aliasOf: null, description: null },
    ],
    ...overrides,
  };
}

test("tokens: alias resuelve al valor base", () => {
  const resolved = resolveToken(tokenSet(), "color.brand.cta");
  assert.equal(resolved.value, "#0a5cff");
});

test("tokens: un ciclo de alias es un error", () => {
  const cyclic = tokenSet({
    tokens: [
      { path: "a.one", type: "color", value: "#000000", aliasOf: "a.two", description: null },
      { path: "a.two", type: "color", value: "#000000", aliasOf: "a.one", description: null },
    ],
  });
  assert.throws(() => validateTokenSet(cyclic), (error: unknown) => error instanceof DomainError && error.code === "invalid_input");
});

test("tokens: alias que cambia de tipo se rechaza", () => {
  const mixed = tokenSet({
    tokens: [
      { path: "a.color", type: "color", value: "#000000", aliasOf: null, description: null },
      { path: "a.size", type: "dimension", value: "8px", aliasOf: "a.color", description: null },
    ],
  });
  assert.throws(() => validateTokenSet(mixed));
});

test("tokens: export reproducible y determinista", () => {
  const set = tokenSet();
  assert.equal(exportIsReproducible(set), true);
  const first = JSON.stringify(exportStyleDictionary(set).output);
  const second = JSON.stringify(exportStyleDictionary(set).output);
  assert.equal(first, second);
  const parsed = JSON.parse(first) as Record<string, { color?: { brand?: { cta?: { $value: string } } } }>;
  assert.equal(parsed["light"]?.color?.brand?.cta?.$value, "#0a5cff");
});

test("QA de texto detecta deriva numérica", () => {
  const result = verifyRenderedText("Precio 19,90 € por mes", "Precio 19,00 € por mes");
  assert.equal(result.matches, false);
  assert.ok(result.mismatches.includes("numeric_drift"));
});

test("QA: atractivo alto no compensa texto incorrecto", () => {
  const decision = evaluateQuality({
    appeal: 0.99,
    textFaithful: false,
    contrastPasses: true,
    rightsSatisfied: true,
    geometryConstraintsMet: true,
  });
  assert.equal(decision.decision, "blocked");
  assert.deepEqual(decision.blockingReasons, ["text_mismatch"]);
});
