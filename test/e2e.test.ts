import { test } from "node:test";
import assert from "node:assert/strict";
import { DomainError } from "../src/contracts/errors.ts";
import { contentHash } from "../src/contracts/evidence.ts";
import { createBrief, reviseObjective, validateNameCandidates, runClearance, validateVoiceProfile, buildBrandbook } from "../src/domain/brand.ts";
import { designDocumentSchema, documentHash, updateDocument } from "../src/domain/document.ts";
import { assertPalettePasses, contrastRatio } from "../src/domain/palette.ts";
import { exportStyleDictionary, validateTokenSet } from "../src/domain/tokens.ts";
import { preflight, createDelivery, assertManifestCurrent } from "../src/domain/export.ts";
import { verifyRenderedText, evaluateQuality } from "../src/domain/qa.ts";
import { supportFixture } from "./fixtures.ts";
import { acknowledgeHandoff, completeHandoff, offerHandoff, startHandoff } from "../src/runtime/handoff.ts";
import { assertReportHonest, buildReport } from "../src/domain/reports.ts";
import { TENANT_A, TENANT_B } from "./helpers.ts";

const now = new Date("2026-11-15T12:00:00.000Z");

test("vertical completo: brief → identidad → tokens → diseño → QA → export → entrega", () => {
  // 1. Brief con fuente declarada.
  const brief = createBrief({
    id: "brief_e2e",
    tenantId: TENANT_A,
    purpose: "new_brand",
    audienceDeclared: "pymes de servicios profesionales",
    deliverables: ["identidad verbal", "logotipo", "tokens", "brandbook"],
    constraints: ["accesibilidad AA"],
    acceptance: ["revisión del owner"],
    objective: "marca verificable",
    sources: ["brief:kickoff"],
  });
  assert.equal(brief.state, "brief_draft");

  // 2. Naming y clearance preliminar (nunca "cleared").
  const candidates = validateNameCandidates([
    { id: "c1", name: "Lumen", locale: "es", rationale: "claridad", legalAvailability: "unknown", conflicts: [], uncertainty: "medium" },
  ]);
  assert.equal(candidates.length, 1);
  const clearance = runClearance({
    id: "clr_1",
    candidateId: "c1",
    registrySource: "REGISTRY_FIXTURE",
    territory: "ES",
    classScope: ["9", "35", "42"],
    classesQueried: 2,
    observations: [],
    now,
  });
  assert.equal(clearance.verdict, "inconclusive");
  assert.equal(clearance.professionalReviewRequired, true);

  // 3. Identidad verbal sin claims sin evidencia.
  const voice = validateVoiceProfile({
    id: "voice_1",
    tenantId: TENANT_A,
    tone: ["clara", "directa"],
    lexicon: ["verificable"],
    forbidden: ["revolucionario"],
    localeRules: { es: "tuteo" },
    claims: [{ id: "cl_1", text: "Entrega en 5 días", evidenceRef: "evidence:sla", permissionRef: null, kind: "product_fact" }],
  });
  assert.equal(voice.claims.length, 1);

  // 4. Tokens con alias y export determinista.
  const tokenSet = supportFixture.tokens(TENANT_A);
  validateTokenSet(tokenSet);
  const exported = exportStyleDictionary(tokenSet);
  assert.match(exported.hash, /^[a-f0-9]{64}$/);

  // 5. Diseño editable con CAS.
  const doc = supportFixture.document(TENANT_A);
  const edited = updateDocument(doc, [{ nodeId: "t1", changes: { x: 24 } }], doc.version);
  assert.equal(edited.version, doc.version + 1);

  // 6. Contraste calculado.
  const findings = assertPalettePasses(supportFixture.palette());
  assert.ok(findings.every((f) => f.passes));
  assert.ok(contrastRatio("#111111", "#ffffff") > 12);

  // 7. QA de texto y decisión.
  const decision = evaluateQuality({
    appeal: 0.8,
    textFaithful: verifyRenderedText(doc.textSources["headline"] ?? "", "Marca verificable").matches,
    contrastPasses: true,
    rightsSatisfied: true,
    geometryConstraintsMet: true,
  });
  assert.equal(decision.decision, "candidate_for_approval");

  // 8. Preflight con derechos y fuente verificada.
  const manifest = preflight({
    document: edited,
    font: supportFixture.font(TENANT_A),
    assets: supportFixture.assets(TENANT_A),
    format: "png",
    dpi: 144,
    colorProfile: "sRGB",
    now,
  });
  assert.equal(manifest.documentVersion, edited.version);
  assertManifestCurrent(manifest, edited, supportFixture.assets(TENANT_A).map((a) => a.rights));

  // 9. Entrega sandbox con receipt.
  const receipt = createDelivery(manifest, { recipient: "cliente@example.test", channel: "portal", now });
  assert.equal(receipt.scope, "sandbox");
  assert.equal(receipt.manifestHash, manifest.hash);

  // 10. Brandbook solo con activos aprobados.
  const brandbook = buildBrandbook({
    id: "bb_e2e",
    tenantId: TENANT_A,
    policyVersion: "v1",
    rules: [{ id: "r1", do: "lockup principal", dont: "deformar" }],
    assets: supportFixture.assets(TENANT_A).map((a) => ({ ref: a.rights.id, state: "approved" as const, rights: a.rights, purpose: a.purpose })),
    sourceRefs: ["brief:kickoff"],
  });
  assert.ok(brandbook.hash);

  // 11. Un cambio posterior invalida el manifiesto y bloquea la reentrega.
  const later = updateDocument(edited, [{ nodeId: "t1", changes: { fill: "#222222" } }], edited.version);
  assert.notEqual(documentHash(later), documentHash(edited));
  assert.throws(
    () => assertManifestCurrent(manifest, later, supportFixture.assets(TENANT_A).map((a) => a.rights)),
    (error: unknown) => error instanceof DomainError && error.code === "version_conflict",
  );

  // 12. Revisión del objetivo crea versión nueva en vez de reescribir.
  const revised = reviseObjective(brief, "marca verificable y accesible");
  assert.equal(revised.version, brief.version + 1);
});

test("un activo de otro tenant no puede sostener un export del tenant A", () => {
  const foreign = supportFixture.assets(TENANT_B);
  assert.equal(foreign[0]?.rights.tenantId, TENANT_B);
  // El manifiesto sólo toma derechos del tenant del documento; mezclar tenants
  // se detecta en el hash de derechos y en la comprobación de vigencia.
  const doc = supportFixture.document(TENANT_A);
  assert.throws(() =>
    preflight({
      document: doc,
      font: supportFixture.font(TENANT_A),
      assets: [{ rights: { ...foreign[0]!.rights, tenantId: TENANT_A, purposes: ["web_publish"] }, purpose: "brandbook", territory: "ES" }],
      format: "png",
      dpi: 144,
      colorProfile: "sRGB",
      now,
    }),
  );
});

test("handoff: sin receipt del receptor no hay ACK ni finalización", () => {
  const base = {
    id: "hnd_00000001",
    tenantId: TENANT_A,
    fromRepo: "agntia-branding",
    toRepo: "agntia-marketing",
    workOrderId: "wo-1",
    state: "proposed" as const,
    evidenceRefs: ["evidence:1"],
    receiverReceiptId: null,
    completedAt: null,
  };
  const offered = offerHandoff(base);
  assert.throws(() => acknowledgeHandoff(offered, "  "), (error: unknown) => error instanceof DomainError);
  const acked = acknowledgeHandoff(offered, "rcpt-1");
  assert.equal(acked.receiverReceiptId, "rcpt-1");
  const working = startHandoff(acked);
  const completed = completeHandoff(working, now);
  assert.equal(completed.state, "completed");
  assert.equal(completed.completedAt, now.toISOString());
});

test("un reporte no puede ocultar métricas sin dato", () => {
  const snapshot = buildReport({
    id: "rep_1",
    tenantId: TENANT_A,
    scope: "tenant",
    generatedAt: now,
    sourceWatermark: "wm-1",
    metrics: [
      { key: "briefs", label: "Briefs", value: 2, unit: "count", sourceRef: "table:brand_briefs" },
      { key: "avg_contrast", label: "Contraste medio", value: null, unit: "ratio", sourceRef: "table:token_sets" },
    ],
  });
  assert.deepEqual(snapshot.missingData, ["avg_contrast"]);
  assert.doesNotThrow(() => assertReportHonest(snapshot));
  assert.throws(() =>
    assertReportHonest({ ...snapshot, missingData: [] }),
  );
  assert.equal(snapshot.coverage.reported, 1);
  assert.equal(contentHash(snapshot.metrics).length, 64);
});
