import { describe, expect, it } from "vitest";
import {
  applyComposition,
  applyTemplateOverrides,
  assertAssetsApproved,
  assertBrandbookCurrent,
  assertDeliveryAuthorized,
  assertLayoutValid,
  assertProtectedNodesIntact,
  assertReceiverCanReceive,
  evaluateQualityGate,
  preflightExport,
  validateLayout,
  verifyText,
} from "@agntia/domain";
import { ASSET_HASH, DOC_ID, FONT_HASH, FONT_ID, TENANT_A, makeDocument, textNode } from "./helpers.ts";

const template = {
  templateId: "template_001",
  tenantId: TENANT_A,
  revision: 1,
  slots: [
    { slotId: "headline", editable: true, requiredMessage: null },
    { slotId: "legal", editable: false, requiredMessage: "Aviso legal obligatorio" },
  ],
  protectedNodes: ["node_logo_001"],
  locale: "es-ES",
  legalFooter: "© Aurea",
};

describe("C24 · Plantillas", () => {
  it("no permite editar slots no editables ni vaciar mensajes obligatorios", () => {
    expect(() => applyTemplateOverrides(template, [{ slotId: "legal", text: "otra cosa" }])).toThrowError(/not editable/);
    const withMandatory = { ...template, slots: [{ slotId: "legal", editable: true, requiredMessage: "Aviso legal" }] };
    expect(() => applyTemplateOverrides(withMandatory, [{ slotId: "legal", text: "  " }])).toThrowError(/mandatory/);
  });

  it("protege nodos en todas las variantes", () => {
    expect(() => assertProtectedNodesIntact(template, ["node_logo_001"])).toThrowError(/protected/);
    expect(() => assertProtectedNodesIntact(template, ["node_text_aaa"])).not.toThrow();
  });
});

describe("C25 · Layouts responsive", () => {
  const elements = [
    { elementId: "node_text_aaa", box: { x: 0, y: 0, width: 100, height: 40 }, containsText: true, minFontSizePx: 14, readingOrder: 1 },
  ];

  it("detecta overflow con medidas reales", () => {
    const result = validateLayout({
      breakpoints: [{ name: "mobile", minWidthPx: 320, maxWidthPx: 480 }],
      elements,
      measurements: [{ locale: "fr-FR", breakpoint: "mobile", elementId: "node_text_aaa", measuredTextWidthPx: 140 }],
      requiredReadingOrder: ["node_text_aaa"],
    });
    expect(result.ok).toBe(false);
    expect(result.findings[0]?.code).toBe("text_overflow");
  });

  it("sin medición del renderer queda pendiente, no PASS", () => {
    expect(() =>
      assertLayoutValid({ breakpoints: [], elements, measurements: [], requiredReadingOrder: ["node_text_aaa"] }),
    ).toThrowError(/without renderer measurements/);
  });
});

describe("C26 · Composición reversible", () => {
  it("devuelve el patch inverso y conserva el original", () => {
    const doc = makeDocument();
    const result = applyComposition(doc, {
      operationKey: "op_key_0001",
      expectedVersion: 0,
      patch: { upsert: [textNode({ text: "Cambiado" })], remove: [] },
    }, new Date());
    expect(result.document.version).toBe(1);
    expect(result.inverse.upsert[0]?.text).toBe("Marca clara");
  });
});

describe("C27 · QA de texto", () => {
  it("un número alterado bloquea el export", () => {
    const result = verifyText({ sourceText: "Somos 120 personas", renderedText: "Somos 129 personas", locale: "es-ES" });
    expect(result.ok).toBe(false);
    expect(result.findings.map((f) => f.code)).toContain("number_mismatch");
  });

  it("un render vacío o con otra tipografía falla", () => {
    expect(verifyText({ sourceText: "Hola", renderedText: "  ", locale: "es-ES" }).ok).toBe(false);
    const wrongFont = verifyText({
      sourceText: "Hola",
      renderedText: "Hola",
      locale: "es-ES",
      fontFamily: "Brand Sans",
      fontFamilyMeasured: "Arial",
    });
    expect(wrongFont.ok).toBe(false);
  });

  it("texto fiel y tipografía correcta pasan", () => {
    expect(verifyText({ sourceText: "Marca clara", renderedText: "Marca clara", locale: "es-ES", fontFamily: "Brand Sans", fontFamilyMeasured: "Brand Sans" }).ok).toBe(true);
  });
});

describe("C28 · QA visual", () => {
  const evaluation = {
    evaluationId: "eval_001",
    tenantId: TENANT_A,
    resourceId: "res_brand_a",
    resourceVersion: 1,
    geometryChecks: [{ checkId: "g1", kind: "overlap" as const, status: "pass" as const, detail: null }],
    perceptionModel: "vision-judge",
    perceptionScore: 0.98,
    findings: [],
    humanDecision: { reviewerId: "user_review_a", decision: "approved" as const, decidedAt: new Date().toISOString() },
  };

  it("una puntuación alta no compensa un fallo de texto o derechos", () => {
    expect(evaluateQualityGate({ evaluation, textQa: { ok: false }, rightsOk: true, securityOk: true }).reasons).toContain("text_qa_failed");
    expect(evaluateQualityGate({ evaluation, textQa: { ok: true }, rightsOk: false, securityOk: false }).passed).toBe(false);
  });

  it("sin decisión humana no hay gate aprobado", () => {
    const result = evaluateQualityGate({
      evaluation: { ...evaluation, humanDecision: null },
      textQa: { ok: true },
      rightsOk: true,
      securityOk: true,
    });
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain("human_decision_missing");
  });
});

describe("C29 · Brandbook", () => {
  const snapshot = {
    brandbookId: "brandbook_001",
    tenantId: TENANT_A,
    policyVersion: "policy_2",
    rules: [{ ruleId: "r1", kind: "do" as const, statement: "usar el logo principal", sourceRef: "brand_guide.pdf", policyVersion: "policy_2" }],
    approvedAssets: [ASSET_HASH],
    tokenSetVersion: 1,
    createdAt: new Date().toISOString(),
    supersedes: null,
  };

  it("una regla obsoleta no se presenta como vigente", () => {
    expect(() => assertBrandbookCurrent(snapshot, "policy_3")).toThrowError(/stale/);
    expect(() => assertBrandbookCurrent(snapshot, "policy_2")).not.toThrow();
  });

  it("solo publica activos aprobados", () => {
    expect(() => assertAssetsApproved(snapshot, ["d".repeat(64)])).toThrowError(/not approved/);
  });
});

describe("C30 · Preflight", () => {
  const now = new Date("2026-11-15T10:00:00.000Z");
  const font = {
    fontId: FONT_ID,
    tenantId: TENANT_A,
    family: "Brand Sans",
    fontHash: FONT_HASH,
    familyLicense: "OFL-1.1",
    embeddingRights: { print: true, web: true, editableDocument: true },
    redistributionAllowed: true,
    fallbackPolicy: "block" as const,
    fallbackFamily: null,
    licenseRef: "license_font_001",
  };
  const ledger = [
    {
      rightsId: "rights_asset_a",
      tenantId: TENANT_A,
      assetHash: ASSET_HASH,
      source: "commissioned",
      licenseRef: "license_asset_001",
      releaseRef: null,
      expiresAt: null,
      purposes: ["client_delivery" as const],
      territory: ["ES"],
      revokedAt: null,
      attribution: null,
    },
  ];
  const request = {
    manifestId: "manifest_001",
    tenantId: TENANT_A,
    deliverableId: DOC_ID,
    editableHash: "e".repeat(64),
    renderHash: "f".repeat(64),
    dpi: 300,
    colorProfile: "sRGB" as const,
    renderEngine: "branding-dom",
    renderEngineVersion: "0.1.0",
    purpose: "client_delivery" as const,
    fontIds: [FONT_ID],
    assetHashes: [ASSET_HASH],
    textQaOk: true,
    rightsOk: true,
  };

  it("produce un manifest verificable cuando todo está en regla", () => {
    const result = preflightExport(request, { fonts: [font], ledger, now });
    expect(result.ok).toBe(true);
    expect(result.manifest?.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(preflightExport(request, { fonts: [font], ledger, now }).manifest?.checksum).toBe(result.manifest?.checksum);
  });

  it("bloquea sin fuente, sin derechos, sin QA o con SVG inseguro", () => {
    expect(preflightExport(request, { fonts: [], ledger, now }).blockers.map((b) => b.code)).toContain("font_blocked");
    expect(preflightExport({ ...request, assetHashes: ["c".repeat(64)] }, { fonts: [font], ledger, now }).blockers.map((b) => b.code)).toContain("asset_rights");
    expect(preflightExport({ ...request, textQaOk: false }, { fonts: [font], ledger, now }).blockers.map((b) => b.code)).toContain("text_qa_failed");
    expect(preflightExport({ ...request, svg: ["<svg><script>alert(1)</script></svg>"] }, { fonts: [font], ledger, now }).blockers.map((b) => b.code)).toContain("unsafe_svg");
  });

  it("publicación exige 300 dpi", () => {
    const result = preflightExport({ ...request, purpose: "publication", dpi: 72 }, { fonts: [font], ledger, now });
    expect(result.blockers.map((b) => b.code)).toContain("dpi_below_requirement");
  });
});

describe("C31 · Entrega", () => {
  const now = new Date();

  it("un receptor de otro tenant o caducado no recibe el paquete", () => {
    expect(() =>
      assertReceiverCanReceive(
        { receiverId: "receiver_x", tenantId: "tenant_bbbb", kind: "external_client", allowedDeliverables: [], expiresAt: null },
        { tenantId: TENANT_A, deliverableId: DOC_ID, now },
      ),
    ).toThrowError(/another tenant/);
    expect(() =>
      assertReceiverCanReceive(
        { receiverId: "receiver_y", tenantId: TENANT_A, kind: "external_client", allowedDeliverables: [DOC_ID], expiresAt: new Date(Date.now() - 1000).toISOString() },
        { tenantId: TENANT_A, deliverableId: DOC_ID, now },
      ),
    ).toThrowError(/expired/);
  });

  it("publicar exige una aprobación con scope de publicación", () => {
    expect(() => assertDeliveryAuthorized({ action: "publication", approvalScope: "sandbox_delivery" })).toThrowError(/publication/);
    expect(() => assertDeliveryAuthorized({ action: "sandbox_delivery", approvalScope: "publication" })).toThrowError(/sandbox/);
    expect(() => assertDeliveryAuthorized({ action: "sandbox_delivery", approvalScope: "sandbox_delivery" })).not.toThrow();
  });
});
