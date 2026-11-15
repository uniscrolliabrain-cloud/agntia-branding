import { test } from "node:test";
import assert from "node:assert/strict";
import { DomainError } from "../src/contracts/errors.ts";
import { designDocumentSchema, updateDocument, type DesignDocument } from "../src/domain/document.ts";
import { assertManifestCurrent, createDelivery, preflight } from "../src/domain/export.ts";
import { buildBrandbook } from "../src/domain/brand.ts";
import { activateProcedure, assertTenantScopedLearning, proposeProcedure } from "../src/domain/learning.ts";
import type { AssetRights, FontLicense } from "../src/domain/rights.ts";
import { contentHash } from "../src/contracts/evidence.ts";
import { TENANT_A, TENANT_B } from "./helpers.ts";

const now = new Date("2026-11-15T10:00:00.000Z");

function document(overrides: Partial<DesignDocument> = {}): DesignDocument {
  return designDocumentSchema.parse({
    id: "doc_9",
    tenantId: TENANT_A,
    version: 2,
    nodes: [{ id: "t1", kind: "text", x: 0, y: 0, width: 200, height: 40, textRef: "headline", fontRef: "inter", fill: "#111111", locked: false }],
    textSources: { headline: "Diseño verificable" },
    engine: "deterministic",
    engineVersion: "1.0.0",
    fontHash: contentHash({ family: "Inter" }),
    constraints: [],
    ...overrides,
  });
}

function font(overrides: Partial<FontLicense> = {}): FontLicense {
  return {
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
    ...overrides,
  };
}

function rights(overrides: Partial<AssetRights> = {}): AssetRights {
  return {
    id: "ar1",
    tenantId: TENANT_A,
    assetHash: contentHash({ asset: "photo-1" }),
    source: "licensed",
    licenseRef: "license-photo-1",
    releaseRef: "release-1",
    purposes: ["brandbook", "client_handoff"],
    territory: ["ES", "EU"],
    expiresAt: null,
    revokedAt: null,
    ...overrides,
  };
}

test("preflight produce manifiesto ligado a documento, fuente y derechos", () => {
  const manifest = preflight({
    document: document(),
    font: font(),
    assets: [{ rights: rights(), purpose: "brandbook", territory: "ES" }],
    format: "png",
    dpi: 144,
    colorProfile: "sRGB",
    now,
  });
  assert.equal(manifest.documentVersion, 2);
  assert.equal(manifest.fontFamily, "Inter");
  assert.match(manifest.hash, /^[a-f0-9]{64}$/);
});

test("preflight bloquea una tipografía sin licencia verificada", () => {
  assert.throws(
    () =>
      preflight({
        document: document(),
        font: font({ licenseVerified: false, verifiedAt: null }),
        assets: [],
        format: "png",
        dpi: 144,
        colorProfile: "sRGB",
        now,
      }),
    (error: unknown) => error instanceof DomainError && error.code === "font_license_unverified",
  );
});

test("preflight bloquea derechos caducados o de otro propósito", () => {
  assert.throws(
    () =>
      preflight({
        document: document(),
        font: font(),
        assets: [{ rights: rights({ purposes: ["web_publish"] }), purpose: "brandbook", territory: "ES" }],
        format: "png",
        dpi: 144,
        colorProfile: "sRGB",
        now,
      }),
    (error: unknown) => error instanceof DomainError && error.code === "rights_missing",
  );
});

test("preflight rechaza PDF por debajo de 300 dpi", () => {
  assert.throws(
    () =>
      preflight({
        document: document(),
        font: font(),
        assets: [],
        format: "pdf",
        dpi: 150,
        colorProfile: "CMYK",
        now,
      }),
    (error: unknown) => error instanceof DomainError && error.code === "policy_violation",
  );
});

test("un manifiesto deja de ser válido si el documento cambia", () => {
  const doc = document();
  const manifest = preflight({ document: doc, font: font(), assets: [], format: "png", dpi: 144, colorProfile: "sRGB", now });
  assertManifestCurrent(manifest, doc, []);
  const edited = updateDocument(doc, [{ nodeId: "t1", changes: { x: 40 } }], 2);
  assert.throws(
    () => assertManifestCurrent(manifest, edited, []),
    (error: unknown) => error instanceof DomainError && error.code === "version_conflict",
  );
});

test("la entrega al sandbox genera receipt sin publicar", () => {
  const manifest = preflight({ document: document(), font: font(), assets: [], format: "png", dpi: 144, colorProfile: "sRGB", now });
  const receipt = createDelivery(manifest, { recipient: "client@example.test", channel: "email_link", now });
  assert.equal(receipt.scope, "sandbox");
  assert.equal(receipt.manifestHash, manifest.hash);
  assert.throws(() => createDelivery(manifest, { recipient: "not-an-email", channel: "email_link", now }));
});

test("el brandbook solo admite activos aprobados", () => {
  assert.throws(
    () =>
      buildBrandbook({
        id: "bb_1",
        tenantId: TENANT_A,
        policyVersion: "v1",
        rules: [{ id: "r1", do: "usar el lockup principal", dont: "deformar el símbolo" }],
        assets: [{ ref: "asset:1", state: "draft", rights: rights(), purpose: "brandbook" }],
        sourceRefs: ["brief:1"],
      }),
    (error: unknown) => error instanceof DomainError && error.code === "policy_violation",
  );

  const brandbook = buildBrandbook({
    id: "bb_1",
    tenantId: TENANT_A,
    policyVersion: "v1",
    rules: [{ id: "r1", do: "usar el lockup principal", dont: "deformar el símbolo" }],
    assets: [{ ref: "asset:1", state: "approved", rights: rights(), purpose: "brandbook" }],
    sourceRefs: ["brief:1"],
  });
  assert.match(brandbook.hash ?? "", /^[a-f0-9]{64}$/);
});

test("un procedimiento no se activa sin replay ni con autoaprobación", () => {
  const proposal = proposeProcedure({
    id: "proc_00000001",
    tenantId: TENANT_A,
    title: "Checklist de preflight",
    steps: ["verificar fuentes", "verificar derechos", "calcular contraste"],
    evidenceRefs: ["evidence:1"],
    replayPassed: false,
    replaySummary: null,
    proposedBy: "user-1",
  });
  assert.throws(() => activateProcedure(proposal, "user-2"), (error: unknown) => error instanceof DomainError);
  assert.throws(
    () => activateProcedure({ ...proposal, replayPassed: true }, "user-1"),
    (error: unknown) => error instanceof DomainError && error.code === "policy_violation",
  );
  const active = activateProcedure({ ...proposal, replayPassed: true }, "user-2");
  assert.equal(active.status, "active");
});

test("el aprendizaje no cruza tenants", () => {
  const proposal = proposeProcedure({
    id: "proc_00000002",
    tenantId: TENANT_A,
    title: "Checklist",
    steps: ["paso"],
    evidenceRefs: ["evidence:1"],
    replayPassed: true,
    replaySummary: "replay ok",
    proposedBy: "user-1",
  });
  assert.throws(
    () => assertTenantScopedLearning(proposal, TENANT_B),
    (error: unknown) => error instanceof DomainError && error.code === "scope_forbidden",
  );
});
