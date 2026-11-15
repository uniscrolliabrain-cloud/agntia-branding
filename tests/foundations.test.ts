import { describe, expect, it } from "vitest";
import { EnvelopeSchema, addMoney, canonicalJson, compareMoney, money, sha256Hex } from "@agntia/contracts";
import {
  afterTimeout,
  buildAuthorityMap,
  canTransition,
  createApproval,
  evaluateApproval,
  resolveAuthority,
  reviseApproved,
  revokeApproval,
  transition,
  transitionOperation,
} from "@agntia/domain";

describe("C02 · AuthorityMap", () => {
  const map = buildAuthorityMap({
    workOrderId: "work_order_1",
    tenantId: "tenant_aaaa",
    claims: [
      { effect: "publish_asset", field: null, responsible: "redes" },
      { effect: "publish_asset", field: "caption", responsible: "marketing" },
      { effect: "export_package", field: null, responsible: "branding" },
    ],
  });

  it("resuelve el responsable único de un efecto", () => {
    expect(resolveAuthority(map, { effect: "export_package" }).responsible).toBe("branding");
  });

  it("prefiere la autoridad por campo sobre la de efecto", () => {
    expect(resolveAuthority(map, { effect: "publish_asset", field: "caption" }).responsible).toBe("marketing");
    expect(resolveAuthority(map, { effect: "publish_asset" }).responsible).toBe("redes");
  });

  it("falla cerrado si no hay autoridad declarada", () => {
    expect(() => resolveAuthority(map, { effect: "sign_contract" })).toThrowError(/no authority declared/);
  });

  it("bloquea autoridad ambigua en vez de elegir last-write-wins", () => {
    const ambiguous = buildAuthorityMap({
      workOrderId: "work_order_2",
      tenantId: "tenant_aaaa",
      claims: [
        { effect: "publish_asset", field: null, responsible: "redes" },
        { effect: "publish_asset", field: null, responsible: "marketing" },
      ],
    });
    expect(() => resolveAuthority(ambiguous, { effect: "publish_asset" })).toThrowError(/ambiguous authority/);
  });
});

describe("C05 · Contratos y dinero", () => {
  it("rechaza campos extra en el envelope", () => {
    const envelope = {
      schemaVersion: 1,
      operationId: "op_00000001",
      tenantId: "tenant_aaaa",
      actorId: "user_owner_a",
      capability: "brand.deliver.propose",
      requestId: null,
      correlationId: "cor_0001",
      causationId: null,
      idempotencyKey: "idem_0001",
      expectedVersion: null,
      approvalRef: null,
      dryRun: true,
      payload: {},
      extra: "nope",
    };
    expect(EnvelopeSchema.safeParse(envelope).success).toBe(false);
  });

  it("no usa coma flotante para dinero", () => {
    expect(() => money("0.30000000000000004")).toThrow();
    expect(compareMoney(addMoney(money("0.10"), money("0.20")), money("0.30"))).toBe(0);
    expect(addMoney(money("999999999999.99"), money("0.01")).amount).toBe("1000000000000.00");
  });

  it("el hash canónico es estable con distinto orden de claves", () => {
    expect(sha256Hex({ b: 1, a: 2 })).toBe(sha256Hex({ a: 2, b: 1 }));
    expect(canonicalJson({ b: 1, a: [2, { d: 4, c: 3 }] })).toBe('{"a":[2,{"c":3,"d":4}],"b":1}');
  });
});

describe("C01 · Máquina de estados", () => {
  it("permite el camino feliz y niega saltos", () => {
    expect(transition("brief_draft", "researching")).toBe("researching");
    expect(canTransition("brief_draft", "approved")).toBe(false);
    expect(() => transition("brief_draft", "approved")).toThrowError(/illegal domain transition/);
  });

  it("approved nunca se sobrescribe: exige nueva revisión y no revive revocados", () => {
    expect(reviseApproved("approved")).toBe("in_review");
    expect(() => reviseApproved("revoked")).toThrowError(/cannot revise/);
  });

  it("un timeout tras posible escritura es incertidumbre, no fallo", () => {
    expect(afterTimeout("accepted")).toBe("outcome_unknown");
    expect(transitionOperation("accepted", "reconciliation_required")).toBe("reconciliation_required");
    expect(() => transitionOperation("confirmed", "queued")).toThrow();
  });
});

describe("C07 · Aprobaciones ligadas al payload", () => {
  const base = {
    approvalId: "approval_001",
    principalId: "user_review_a",
    reviewerRole: "brand_reviewer" as const,
    proofRef: "proof_001",
    tenantId: "tenant_aaaa",
    payload: { deliverable: "DOC", version: 3 },
    resourceVersion: 3,
    rights: { license: "lic_1" },
    policy: { version: "policy_1" },
    scope: "sandbox_delivery",
    recipient: "receiver_client_a",
    channel: "portal",
    costCeiling: money("5.00"),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };

  const subject = {
    tenantId: "tenant_aaaa",
    payload: base.payload,
    resourceVersion: 3,
    rights: base.rights,
    policy: base.policy,
    scope: base.scope,
    recipient: base.recipient,
    channel: base.channel,
  };

  it("acepta una aprobación vigente y exacta", () => {
    const approval = createApproval(base);
    const evaluation = evaluateApproval(approval, subject, { now: new Date(), cost: money("1.00") });
    expect(evaluation.ok).toBe(true);
  });

  it("invalida si cambia el payload, la versión, el destinatario o el coste", () => {
    const approval = createApproval(base);
    const now = new Date();
    expect(evaluateApproval(approval, { ...subject, payload: { deliverable: "DOC", version: 4 } }, { now, cost: money("1.00") })).toMatchObject({ ok: false, reason: "payload_changed" });
    expect(evaluateApproval(approval, { ...subject, resourceVersion: 4 }, { now, cost: money("1.00") })).toMatchObject({ ok: false, reason: "version_changed" });
    expect(evaluateApproval(approval, { ...subject, recipient: "otro" }, { now, cost: money("1.00") })).toMatchObject({ ok: false, reason: "recipient_mismatch" });
    expect(evaluateApproval(approval, subject, { now, cost: money("9.00") })).toMatchObject({ ok: false, reason: "cost_exceeds_ceiling" });
  });

  it("invalida por tenant, caducidad y revocación", () => {
    const approval = createApproval(base);
    const now = new Date();
    expect(evaluateApproval(approval, { ...subject, tenantId: "tenant_bbbb" }, { now, cost: money("1.00") })).toMatchObject({ ok: false, reason: "tenant_mismatch" });
    expect(evaluateApproval(approval, subject, { now: new Date(Date.now() + 120_000), cost: money("1.00") })).toMatchObject({ ok: false, reason: "expired" });
    const revoked = revokeApproval(approval, now);
    expect(evaluateApproval(revoked, subject, { now, cost: money("1.00") })).toMatchObject({ ok: false, reason: "revoked" });
  });
});
