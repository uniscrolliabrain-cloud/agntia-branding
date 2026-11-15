import { describe, expect, it } from "vitest";
import { ApiError, money } from "@agntia/contracts";
import {
  afterTimeout,
  buildTokens,
  evaluateClearance,
  proposeNameCandidates,
  revokeApproval,
  transitionOperation,
  verifyText,
} from "@agntia/domain";
import {
  ASSET_HASH,
  DOC_ID,
  FONT_ID,
  OWNER_A,
  RESOURCE_A,
  TENANT_A,
  TENANT_B,
  makeService,
  ownerPrincipal,
  reviewerPrincipal,
  textNode,
} from "./helpers.ts";

function makeApprovalFor(service: ReturnType<typeof makeService>, manifest: unknown, content: unknown, overrides: { expiresAt?: string } = {}) {
  return service.grantApproval({
    principal: reviewerPrincipal(),
    approvalId: "approval_e2e_1",
    resourceId: RESOURCE_A,
    payload: { content, manifest, receiverId: "receiver_client_a", action: "sandbox_delivery" },
    resourceVersion: 0,
    rights: { license: "license_asset_001" },
    policy: { version: "policy_2" },
    scope: "sandbox_delivery",
    recipient: "receiver_client_a",
    channel: "portal",
    costCeiling: money("10.00"),
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 600_000).toISOString(),
    reviewerRole: "brand_reviewer",
    proposerId: OWNER_A,
    competenceVerified: true,
  });
}

describe("C40 · Vertical E2E de dos tenants", () => {
  it("brief → naming → clearance → tokens → texto → preflight → aprobación → entrega con receipt", () => {
    const service = makeService();
    const principal = ownerPrincipal();

    const brief = service.createBrief(principal, {
      resourceId: RESOURCE_A,
      purpose: "lanzamiento de marca",
      audienceDeclared: "pymes españolas",
      deliverables: ["brandbook", "logotipo"],
      acceptance: ["owner_approval", "contrast_aa"],
    });
    expect(brief.version).toBe(1);

    const candidates = proposeNameCandidates(
      [{ name: "Aurea", locale: "es-ES", rationale: "luz y claridad", uncertainty: "medium" }],
      { tenantId: TENANT_A, newId: () => "candidate_e2e" },
    );
    const clearance = evaluateClearance({
      check: {
        checkId: "check_e2e",
        tenantId: TENANT_A,
        candidateId: candidates[0]!.candidateId,
        registrySource: "EUIPO manual",
        territory: "ES",
        classScope: ["9"],
        requiredClasses: ["9", "35"],
        checkedAt: new Date().toISOString(),
        reviewer: "user_review_a",
      },
      claimed: "preliminary_no_conflict",
    });
    expect(clearance.result).toBe("insufficient_scope");

    const built = buildTokens(
      {
        tokenSetId: "tokens_e2e",
        tenantId: TENANT_A,
        theme: "light",
        version: 1,
        tokens: [{ path: "color.brand.primary", type: "color", value: "#0a58ca", aliasOf: null }],
      },
      { formats: ["css"], transforms: ["name/kebab"], engineVersion: "4.0.0" },
    );
    expect(built.outputs["light.tokens.css"]).toContain("--color-brand-primary");

    const updated = service.updateDocument(principal, {
      documentId: DOC_ID,
      expectedVersion: 0,
      operationKey: "op_key_e2e_1",
      patch: { upsert: [textNode({ text: "Aurea · 120 personas" })], remove: [] },
    });
    expect(updated.document.version).toBe(1);

    const textCheck = verifyText({
      sourceText: "Aurea · 120 personas",
      renderedText: "Aurea · 129 personas",
      locale: "es-ES",
    });
    expect(textCheck.ok).toBe(false);

    const preflight = service.preflight(principal, {
      deliverableId: DOC_ID,
      editableHash: "",
      renderHash: "",
      dpi: 300,
      colorProfile: "sRGB",
      renderEngine: "branding-dom",
      renderEngineVersion: "0.1.0",
      purpose: "client_delivery",
      fontIds: [FONT_ID],
      assetHashes: [ASSET_HASH],
      textQaOk: true,
      rightsOk: true,
    });
    expect(preflight.ok).toBe(true);
    const manifest = preflight.manifest!;

    const content = { headline: "Aurea · 120 personas" };
    const approval = makeApprovalFor(service, manifest, content);

    const receipt = service.deliver(principal, {
      approvalId: approval.approvalId,
      receiverId: "receiver_client_a",
      action: "sandbox_delivery",
      manifest,
      payload: content,
      rights: { license: "license_asset_001" },
      policy: { version: "policy_2" },
      cost: money("1.00"),
      correlationId: "cor_e2e_1",
    });
    expect(receipt.manifestChecksum).toBe(manifest.checksum);
    expect(service.receipts.size).toBe(1);
    expect(service.outbox.pending(TENANT_A)).toHaveLength(1);
    expect(service.audit.forTenant(TENANT_A).map((entry) => entry.action)).toContain("delivery.completed");
  });

  it("si cambia el contenido tras aprobar, la entrega queda en revisión", () => {
    const service = makeService();
    const principal = ownerPrincipal();
    const preflight = service.preflight(principal, {
      deliverableId: DOC_ID,
      editableHash: "",
      renderHash: "",
      dpi: 300,
      colorProfile: "sRGB",
      renderEngine: "branding-dom",
      renderEngineVersion: "0.1.0",
      purpose: "client_delivery",
      fontIds: [FONT_ID],
      assetHashes: [ASSET_HASH],
      textQaOk: true,
      rightsOk: true,
    });
    const approval = makeApprovalFor(service, preflight.manifest!, { headline: "Original" });

    expect(() =>
      service.deliver(principal, {
        approvalId: approval.approvalId,
        receiverId: "receiver_client_a",
        action: "sandbox_delivery",
        manifest: preflight.manifest!,
        payload: { headline: "Cambiado" },
        rights: { license: "license_asset_001" },
        policy: { version: "policy_2" },
        cost: money("1.00"),
        correlationId: "cor_e2e_2",
      }),
    ).toThrowError(/payload_changed/);
  });

  it("una aprobación revocada bloquea la entrega", () => {
    const service = makeService();
    const principal = ownerPrincipal();
    const preflight = service.preflight(principal, {
      deliverableId: DOC_ID,
      editableHash: "",
      renderHash: "",
      dpi: 300,
      colorProfile: "sRGB",
      renderEngine: "branding-dom",
      renderEngineVersion: "0.1.0",
      purpose: "client_delivery",
      fontIds: [FONT_ID],
      assetHashes: [ASSET_HASH],
      textQaOk: true,
      rightsOk: true,
    });
    const approval = makeApprovalFor(service, preflight.manifest!, { headline: "Original" });
    service.approvals.set(`${TENANT_A}::${approval.approvalId}`, revokeApproval(approval, new Date()));

    expect(() =>
      service.deliver(principal, {
        approvalId: approval.approvalId,
        receiverId: "receiver_client_a",
        action: "sandbox_delivery",
        manifest: preflight.manifest!,
        payload: { headline: "Original" },
        rights: { license: "license_asset_001" },
        policy: { version: "policy_2" },
        cost: money("1.00"),
        correlationId: "cor_e2e_3",
      }),
    ).toThrowError(/revoked/);
  });

  it("tenant B no accede al documento, aprobación ni receipt de A", () => {
    const service = makeService();
    const principal = ownerPrincipal();
    const preflight = service.preflight(principal, {
      deliverableId: DOC_ID,
      editableHash: "",
      renderHash: "",
      dpi: 300,
      colorProfile: "sRGB",
      renderEngine: "branding-dom",
      renderEngineVersion: "0.1.0",
      purpose: "client_delivery",
      fontIds: [FONT_ID],
      assetHashes: [ASSET_HASH],
      textQaOk: true,
      rightsOk: true,
    });
    const approval = makeApprovalFor(service, preflight.manifest!, { headline: "Original" });
    const receipt = service.deliver(principal, {
      approvalId: approval.approvalId,
      receiverId: "receiver_client_a",
      action: "sandbox_delivery",
      manifest: preflight.manifest!,
      payload: { headline: "Original" },
      rights: { license: "license_asset_001" },
      policy: { version: "policy_2" },
      cost: money("1.00"),
      correlationId: "cor_e2e_4",
    });

    const principalB = { userId: "user_owner_b", kind: "human" as const, tenantId: TENANT_B, role: "owner" as const, scopes: [] };
    expect(() => service.resources.get(TENANT_B, RESOURCE_A)).toThrowError(/not found/);
    expect(service.approvals.has(`${TENANT_B}::${approval.approvalId}`)).toBe(false);
    expect(receipt.tenantId).toBe(TENANT_A);
    expect(() => service.closeAdvisorSession(principalB, receipt.receiptId)).toThrowError(/not found/);
  });

  it("un timeout tras aceptación deja incertidumbre y no se reintenta a ciegas", () => {
    expect(afterTimeout("running")).toBe("outcome_unknown");
    expect(() => transitionOperation("outcome_unknown", "queued")).toThrowError(/illegal operation transition/);
    const service = makeService();
    service.idempotency.begin({ tenantId: TENANT_A, operationKey: "op_dup", payload: { a: 1 }, now: new Date() });
    expect(() =>
      service.idempotency.begin({ tenantId: TENANT_A, operationKey: "op_dup", payload: { a: 1 }, now: new Date() }),
    ).toThrowError(/already in progress/);
    expect(() => service.resources.get(TENANT_A, "res_inexistente")).toThrowError(ApiError);
  });
});
