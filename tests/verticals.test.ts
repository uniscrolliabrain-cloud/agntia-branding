import { describe, expect, it } from "vitest";
import {
  ASSET_HASH,
  DOC_ID,
  FONT_ID,
  OWNER_A,
  OWNER_B,
  RESOURCE_A,
  REVIEWER_A,
  TENANT_A,
  TENANT_B,
  claimsFor,
  makeApp,
  ownerPrincipal,
  signJwt,
  textNode,
} from "./helpers.ts";

type App = ReturnType<typeof makeApp>["app"];
type Json = Record<string, unknown>;

const tokenOwner = signJwt(claimsFor(OWNER_A, TENANT_A));
const tokenReviewer = signJwt(claimsFor(REVIEWER_A, TENANT_A));
const tokenOtherTenant = signJwt(claimsFor(OWNER_B, TENANT_B));

function headers(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}`, "content-type": "application/json" };
}

async function call(
  app: App,
  method: string,
  path: string,
  token: string,
  body?: unknown,
): Promise<{ status: number; body: Json }> {
  const response = await app.request(path, {
    method,
    headers: headers(token),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: (await response.json()) as Json };
}

function recordOf(result: { body: Json }): Json {
  return result.body.record as Json;
}

function artifactsOf(result: { body: Json }): Json {
  return recordOf(result).artifacts as Json;
}

async function startVertical(app: App, verticalId: string): Promise<Json> {
  const created = await call(app, "POST", "/v1/branding/verticals", tokenOwner, {
    verticalId,
    resourceId: RESOURCE_A,
    documentId: DOC_ID,
  });
  expect(created.status).toBe(201);
  return recordOf(created);
}

async function advance(
  app: App,
  verticalId: string,
  stage: string,
  payload: Json,
  key: string,
  token = tokenOwner,
): Promise<{ status: number; body: Json }> {
  return call(app, "POST", `/v1/branding/verticals/${verticalId}/stages/${stage}`, token, {
    ...payload,
    operationKey: key,
  });
}

async function expectAdvance(
  app: App,
  verticalId: string,
  stage: string,
  payload: Json,
  key: string,
  token = tokenOwner,
): Promise<{ status: number; body: Json }> {
  const result = await advance(app, verticalId, stage, payload, key, token);
  expect(result.status, `${stage} -> ${JSON.stringify(result.body)}`).toBe(200);
  return result;
}

const RESEARCH = {
  purpose: "analysis",
  sources: [
    {
      url: "https://example.com/brand-research",
      usageRights: "licensed",
      licenseRef: "license_research_001",
      inferenceLabel: "fact",
    },
  ],
};

const VOICE = { tone: ["clara", "cercana"], claims: [] };

const TOKENS = {
  theme: "light",
  tokens: [{ path: "color.brand.primary", type: "color", value: "#0a58ca", aliasOf: null }],
  pairs: [{ pairId: "body", foreground: "#111111", background: "#ffffff", usage: "body_text" }],
};

const CONTENT = { headline: "Aurea · 120 personas" };
const RIGHTS = { license: "license_asset_001" };
const POLICY = { version: "policy_2" };

describe("C40 · vertical slices over HTTP", () => {
  it("recorre brief → brandbook con gates deterministas, aprobación humana y receipt", async () => {
    const { app, service } = makeApp();
    const verticalId = "vertical_happy_1";
    const record = await startVertical(app, verticalId);
    expect(record.nextStage).toBe("brief");

    await expectAdvance(app, verticalId, "brief", {
      purpose: "lanzamiento de marca",
      audienceDeclared: "pymes españolas",
      deliverables: ["brandbook", "logotipo"],
      acceptance: ["owner_approval", "contrast_aa"],
    }, "op_happy_brief_1");

    await expectAdvance(app, verticalId, "research", RESEARCH, "op_happy_research_1");

    const naming = await expectAdvance(app, verticalId, "naming", {
      candidates: [{ name: "Aurea", locale: "es-ES", rationale: "luz y claridad", uncertainty: "medium" }],
    }, "op_happy_naming_1");
    const candidates = artifactsOf(naming).naming as Json[];
    const candidateId = String(candidates[0]!.candidateId);

    await expectAdvance(app, verticalId, "clearance", {
      candidateId,
      claimed: "preliminary_no_conflict",
      registrySource: "EUIPO manual",
      territory: "ES",
      classScope: ["9"],
      requiredClasses: ["9"],
      reviewer: REVIEWER_A,
    }, "op_happy_clearance_1");

    await expectAdvance(app, verticalId, "voice", VOICE, "op_happy_voice_1");
    await expectAdvance(app, verticalId, "tokens", TOKENS, "op_happy_tokens_1");

    const design = await expectAdvance(app, verticalId, "design", {
      nodes: [textNode({ text: "Aurea · 120 personas" })],
      constraints: ["headline max 60 chars"],
    }, "op_happy_design_1");
    const designVersion = Number((artifactsOf(design).design as Json).version);
    expect(designVersion).toBe(1);

    // Identical replay returns the stored result instead of moving the vertical.
    const replay = await advance(app, verticalId, "design", {
      nodes: [textNode({ text: "Aurea · 120 personas" })],
      constraints: ["headline max 60 chars"],
    }, "op_happy_design_1");
    expect(replay.status).toBe(200);
    expect(Number(recordOf(replay).version)).toBe(Number(recordOf(design).version));
    expect(recordOf(replay).nextStage).toBe("qa");

    await expectAdvance(app, verticalId, "qa", {
      sourceText: "Aurea · 120 personas",
      renderedText: "Aurea · 120 personas",
      locale: "es-ES",
      geometryChecks: [{ checkId: "geometry_1", kind: "overlap", status: "pass", detail: null }],
      rightsOk: true,
      securityOk: true,
    }, "op_happy_qa_1");

    await expectAdvance(app, verticalId, "review", { decision: "approved" }, "op_happy_review_1", tokenReviewer);

    const exported = await expectAdvance(app, verticalId, "export", {
      purpose: "client_delivery",
      dpi: 300,
      colorProfile: "sRGB",
      fontIds: [FONT_ID],
      assetHashes: [ASSET_HASH],
    }, "op_happy_export_1");
    const manifest = (artifactsOf(exported).export as Json).manifest as Json;
    expect(String(manifest.checksum)).toMatch(/^[0-9a-f]{64}$/);

    const approval = await call(app, "POST", "/v1/branding/approvals", tokenReviewer, {
      approvalId: "approval_vertical_1",
      resourceId: RESOURCE_A,
      resourceVersion: 1,
      payload: { content: CONTENT, manifest, receiverId: "receiver_client_a", action: "sandbox_delivery" },
      rights: RIGHTS,
      policy: POLICY,
      scope: "sandbox_delivery",
      recipient: "receiver_client_a",
      channel: "portal",
      costCeiling: { amount: "5.00", currency: "EUR", exponent: 2 },
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
      proposerId: OWNER_A,
    });
    expect(approval.status).toBe(201);

    const delivered = await expectAdvance(app, verticalId, "delivery", {
      approvalId: "approval_vertical_1",
      receiverId: "receiver_client_a",
      action: "sandbox_delivery",
      cost: { amount: "1.00", currency: "EUR", exponent: 2 },
      correlationId: "cor_vertical_1",
      content: CONTENT,
      rights: RIGHTS,
      policy: POLICY,
    }, "op_happy_delivery_1");
    const receipt = (artifactsOf(delivered).delivery as Json).receipt as Json;
    expect(String(receipt.manifestChecksum)).toBe(manifest.checksum);

    const completed = await expectAdvance(app, verticalId, "brandbook", {
      policyVersion: "policy_2",
      rules: [
        {
          ruleId: "rule_1",
          kind: "do",
          statement: "Usar el logotipo sobre fondo claro",
          sourceRef: "brandbook/source_1",
          policyVersion: "policy_2",
        },
      ],
      approvedAssets: ["asset_logo_primary"],
    }, "op_happy_brandbook_1");

    const finalRecord = recordOf(completed);
    expect(finalRecord.status).toBe("completed");
    expect(finalRecord.completedStages).toHaveLength(12);
    const brandbook = artifactsOf(completed).brandbook as Json;
    expect(String(brandbook.payloadHash)).toMatch(/^[0-9a-f]{64}$/);
    expect(service.outbox.pending(TENANT_A)).toHaveLength(1);
    expect(service.audit.forTenant(TENANT_A).map((entry) => entry.action)).toContain("vertical.brandbook.completed");
    expect(service.audit.forTenant(TENANT_A).map((entry) => entry.action)).toContain("delivery.completed");

    const fetched = await call(app, "GET", `/v1/branding/verticals/${verticalId}`, tokenOwner);
    expect(fetched.status).toBe(200);
    expect(recordOf(fetched).status).toBe("completed");
  });

  it("un brief sin propósito queda needs_input y no deja saltar a research", async () => {
    const { app } = makeApp();
    const verticalId = "vertical_pending_1";
    await startVertical(app, verticalId);

    const brief = await advance(app, verticalId, "brief", {
      deliverables: ["brandbook"],
      acceptance: ["owner_approval"],
    }, "op_pending_brief_1");
    expect(brief.status).toBe(200);
    expect(recordOf(brief).status).toBe("needs_input");
    expect(recordOf(brief).attention).toContain("purpose_not_declared");

    const skipped = await advance(app, verticalId, "research", RESEARCH, "op_pending_research_1");
    expect(skipped.status).toBe(409);

    const retried = await advance(app, verticalId, "brief", {
      purpose: "relanzamiento",
      audienceDeclared: "equipos de producto",
      deliverables: ["brandbook"],
      acceptance: ["owner_approval"],
    }, "op_pending_brief_2");
    expect(retried.status).toBe(200);
    expect(recordOf(retried).nextStage).toBe("research");
  });

  it("clearance con cobertura incompleta no avanza aunque el LLM afirme no conflicto", async () => {
    const { app } = makeApp();
    const verticalId = "vertical_clearance_1";
    await startVertical(app, verticalId);
    await expectAdvance(app, verticalId, "brief", {
      purpose: "marca",
      audienceDeclared: "pymes",
      deliverables: ["brandbook"],
      acceptance: ["owner_approval"],
    }, "op_clr_brief_1");
    await expectAdvance(app, verticalId, "research", RESEARCH, "op_clr_research_1");
    const naming = await expectAdvance(app, verticalId, "naming", {
      candidates: [{ name: "Aurea", locale: "es-ES", rationale: "claridad", uncertainty: "medium" }],
    }, "op_clr_naming_1");
    const candidateId = String((artifactsOf(naming).naming as Json[])[0]!.candidateId);

    const clearance = await advance(app, verticalId, "clearance", {
      candidateId,
      claimed: "preliminary_no_conflict",
      registrySource: "EUIPO manual",
      territory: "ES",
      classScope: ["9"],
      requiredClasses: ["9", "35"],
      reviewer: REVIEWER_A,
    }, "op_clr_clearance_1");
    expect(clearance.status).toBe(200);
    expect(recordOf(clearance).status).toBe("needs_input");
    expect(recordOf(clearance).attention).toContain("clearance:insufficient_scope");
    expect(recordOf(clearance).nextStage).toBe("clearance");
  });

  it("tokens con contraste insuficiente bloquean la vertical", async () => {
    const { app } = makeApp();
    const verticalId = "vertical_contrast_1";
    await startVertical(app, verticalId);
    await expectAdvance(app, verticalId, "brief", {
      purpose: "marca",
      audienceDeclared: "pymes",
      deliverables: ["brandbook"],
      acceptance: ["owner_approval"],
    }, "op_ct_brief_1");
    await expectAdvance(app, verticalId, "research", RESEARCH, "op_ct_research_1");
    const naming = await expectAdvance(app, verticalId, "naming", {
      candidates: [{ name: "Aurea", locale: "es-ES", rationale: "claridad", uncertainty: "medium" }],
    }, "op_ct_naming_1");
    const candidateId = String((artifactsOf(naming).naming as Json[])[0]!.candidateId);
    await expectAdvance(app, verticalId, "clearance", {
      candidateId,
      claimed: "preliminary_no_conflict",
      registrySource: "EUIPO manual",
      territory: "ES",
      classScope: ["9"],
      requiredClasses: ["9"],
      reviewer: REVIEWER_A,
    }, "op_ct_clearance_1");
    await expectAdvance(app, verticalId, "voice", VOICE, "op_ct_voice_1");

    const tokens = await advance(app, verticalId, "tokens", {
      theme: "light",
      tokens: [{ path: "color.brand.primary", type: "color", value: "#dddddd", aliasOf: null }],
      pairs: [{ pairId: "body", foreground: "#dddddd", background: "#ffffff", usage: "body_text" }],
    }, "op_ct_tokens_1");
    expect(tokens.status).toBe(200);
    expect(recordOf(tokens).status).toBe("needs_input");
    expect((recordOf(tokens).attention as string[]).some((item) => item.startsWith("contrast:body"))).toBe(true);
  });

  it("texto renderizado distinto bloquea QA y el review posterior", async () => {
    const { app } = makeApp();
    const verticalId = "vertical_textqa_1";
    await startVertical(app, verticalId);
    await expectAdvance(app, verticalId, "brief", {
      purpose: "marca",
      audienceDeclared: "pymes",
      deliverables: ["brandbook"],
      acceptance: ["owner_approval"],
    }, "op_tq_brief_1");
    await expectAdvance(app, verticalId, "research", RESEARCH, "op_tq_research_1");
    const naming = await expectAdvance(app, verticalId, "naming", {
      candidates: [{ name: "Aurea", locale: "es-ES", rationale: "claridad", uncertainty: "medium" }],
    }, "op_tq_naming_1");
    const candidateId = String((artifactsOf(naming).naming as Json[])[0]!.candidateId);
    await expectAdvance(app, verticalId, "clearance", {
      candidateId,
      claimed: "preliminary_no_conflict",
      registrySource: "EUIPO manual",
      territory: "ES",
      classScope: ["9"],
      requiredClasses: ["9"],
      reviewer: REVIEWER_A,
    }, "op_tq_clearance_1");
    await expectAdvance(app, verticalId, "voice", VOICE, "op_tq_voice_1");
    await expectAdvance(app, verticalId, "tokens", TOKENS, "op_tq_tokens_1");
    await expectAdvance(app, verticalId, "design", {
      nodes: [textNode({ text: "Aurea · 120 personas" })],
    }, "op_tq_design_1");

    const qa = await advance(app, verticalId, "qa", {
      sourceText: "Aurea · 120 personas",
      renderedText: "Aurea · 129 personas",
      locale: "es-ES",
      geometryChecks: [{ checkId: "geometry_1", kind: "overlap", status: "pass", detail: null }],
      rightsOk: true,
      securityOk: true,
    }, "op_tq_qa_1");
    expect(qa.status).toBe(200);
    expect(recordOf(qa).status).toBe("needs_input");
    expect((artifactsOf(qa).qa as Json).readyForReview).toBe(false);

    const review = await advance(app, verticalId, "review", { decision: "approved" }, "op_tq_review_1");
    expect(review.status).toBe(409);
  });

  it("un cambio del documento tras la revisión invalida la aprobación en export", async () => {
    const { app, service } = makeApp();
    const verticalId = "vertical_invalidate_1";
    await startVertical(app, verticalId);
    await expectAdvance(app, verticalId, "brief", {
      purpose: "marca",
      audienceDeclared: "pymes",
      deliverables: ["brandbook"],
      acceptance: ["owner_approval"],
    }, "op_inv_brief_1");
    await expectAdvance(app, verticalId, "research", RESEARCH, "op_inv_research_1");
    const naming = await expectAdvance(app, verticalId, "naming", {
      candidates: [{ name: "Aurea", locale: "es-ES", rationale: "claridad", uncertainty: "medium" }],
    }, "op_inv_naming_1");
    const candidateId = String((artifactsOf(naming).naming as Json[])[0]!.candidateId);
    await expectAdvance(app, verticalId, "clearance", {
      candidateId,
      claimed: "preliminary_no_conflict",
      registrySource: "EUIPO manual",
      territory: "ES",
      classScope: ["9"],
      requiredClasses: ["9"],
      reviewer: REVIEWER_A,
    }, "op_inv_clearance_1");
    await expectAdvance(app, verticalId, "voice", VOICE, "op_inv_voice_1");
    await expectAdvance(app, verticalId, "tokens", TOKENS, "op_inv_tokens_1");
    await expectAdvance(app, verticalId, "design", {
      nodes: [textNode({ text: "Aurea · 120 personas" })],
    }, "op_inv_design_1");
    await expectAdvance(app, verticalId, "qa", {
      sourceText: "Aurea · 120 personas",
      renderedText: "Aurea · 120 personas",
      locale: "es-ES",
      geometryChecks: [{ checkId: "geometry_1", kind: "overlap", status: "pass", detail: null }],
      rightsOk: true,
      securityOk: true,
    }, "op_inv_qa_1");
    await expectAdvance(app, verticalId, "review", { decision: "approved" }, "op_inv_review_1", tokenReviewer);

    service.updateDocument(ownerPrincipal(), {
      documentId: DOC_ID,
      expectedVersion: 1,
      operationKey: "op_inv_manual_edit_1",
      patch: { upsert: [textNode({ nodeId: "node_text_bbb", text: "Texto nuevo" })], remove: [] },
    });

    const exported = await advance(app, verticalId, "export", {
      purpose: "client_delivery",
      dpi: 300,
      colorProfile: "sRGB",
      fontIds: [FONT_ID],
      assetHashes: [ASSET_HASH],
    }, "op_inv_export_1");
    expect(exported.status).toBe(409);
    expect(String((exported.body.error as Json).message)).toMatch(/after review|no longer valid/);
  });

  it("el proponente no puede aprobar su propia entrega", async () => {
    const { app } = makeApp();
    const response = await call(app, "POST", "/v1/branding/approvals", tokenOwner, {
      approvalId: "approval_self_1",
      resourceId: RESOURCE_A,
      resourceVersion: 1,
      payload: { content: CONTENT },
      rights: RIGHTS,
      policy: POLICY,
      scope: "sandbox_delivery",
      recipient: "receiver_client_a",
      channel: "portal",
      costCeiling: { amount: "5.00", currency: "EUR", exponent: 2 },
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
      proposerId: OWNER_A,
    });
    expect(response.status).toBe(403);
  });

  it("otro tenant no puede leer ni avanzar la vertical", async () => {
    const { app } = makeApp();
    const verticalId = "vertical_isolation_1";
    await startVertical(app, verticalId);

    const read = await call(app, "GET", `/v1/branding/verticals/${verticalId}`, tokenOtherTenant);
    expect(read.status).toBe(404);

    const advanced = await advance(app, verticalId, "brief", {
      purpose: "marca",
      audienceDeclared: "pymes",
      deliverables: ["brandbook"],
      acceptance: ["owner_approval"],
    }, "op_iso_brief_1", tokenOtherTenant);
    expect(advanced.status).toBe(404);
  });

  it("una etapa desconocida o fuera de orden se rechaza", async () => {
    const { app } = makeApp();
    const verticalId = "vertical_order_1";
    await startVertical(app, verticalId);

    const unknown = await advance(app, verticalId, "teleport", {}, "op_order_unknown_1");
    expect(unknown.status).toBe(400);

    const outOfOrder = await advance(app, verticalId, "tokens", TOKENS, "op_order_tokens_1");
    expect(outOfOrder.status).toBe(409);
  });
});
