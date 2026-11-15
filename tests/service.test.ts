import { describe, expect, it } from "vitest";
import { money } from "@agntia/contracts";
import {
  BudgetLedger,
  acknowledgeHandoff,
  activateProcedure,
  advanceHandoff,
  assertCapabilityEnabled,
  assertNoSecrets,
  assertPrivacyRequestProcessable,
  assertRouteAllowed,
  assertSessionAction,
  buildAcceptanceMatrix,
  capabilityEnabled,
  createReportSnapshot,
  evaluateReleaseGate,
  findSecrets,
  isReceivedByPeer,
  percentile,
  toHostEvent,
} from "@agntia/domain";
import { TENANT_A, TENANT_B } from "./helpers.ts";

describe("C32 · Aprendizaje", () => {
  const proposal = {
    proposalId: "procedure_001",
    tenantId: TENANT_A,
    procedure: "Revisar contraste antes de exportar y adjuntar evidencia de licencias.",
    evidenceRefs: ["evidence_001"],
    replayGate: { required: true, passed: true, cases: 5, failures: [] },
    approvedBy: "user_review_a",
    status: "approved" as const,
  };

  it("activa solo con replay pasado, casos y aprobación humana", () => {
    expect(activateProcedure(proposal, { tenantId: TENANT_A, reviewerRole: "owner" }).status).toBe("active");
    expect(() =>
      activateProcedure({ ...proposal, replayGate: { ...proposal.replayGate, passed: false } }, { tenantId: TENANT_A, reviewerRole: "owner" }),
    ).toThrowError(/replay/);
    expect(() =>
      activateProcedure({ ...proposal, approvedBy: null }, { tenantId: TENANT_A, reviewerRole: "owner" }),
    ).toThrowError(/human approval/);
  });

  it("no cruza tenant ni acepta autoactivación por rol no competente", () => {
    expect(() => activateProcedure(proposal, { tenantId: TENANT_B, reviewerRole: "owner" })).toThrowError(/another tenant/);
    expect(() => activateProcedure(proposal, { tenantId: TENANT_A, reviewerRole: "viewer" })).toThrowError(/cannot activate/);
  });
});

describe("C33 · Reportes", () => {
  it("exige definición y fuente para cada cifra", () => {
    const snapshot = createReportSnapshot({
      snapshotId: "report_001",
      tenantId: TENANT_A,
      resourceId: "res_brand_a",
      metricDefinitions: [{ metricId: "contrast_pass_rate", definition: "pares de contraste que pasan WCAG AA" }],
      values: [{ metricId: "contrast_pass_rate", value: 1, unit: "ratio", sourceRef: "palette_v1", coverage: "8 pares" }],
      createdAt: new Date("2026-11-15T10:00:00.000Z"),
    });
    expect(snapshot.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(() =>
      createReportSnapshot({
        snapshotId: "report_002",
        tenantId: TENANT_A,
        resourceId: "res_brand_a",
        metricDefinitions: [],
        values: [{ metricId: "invented", value: 42, unit: "x", sourceRef: "none", coverage: "none" }],
        createdAt: new Date(),
      }),
    ).toThrowError(/no definition/);
  });

  it("p95 se mide, no se inventa", () => {
    expect(percentile([], 95)).toBeNull();
    expect(percentile([10, 20, 30, 40, 50, 60, 70, 80, 90, 100], 95)).toBe(100);
  });
});

describe("C34 · Sesión de asesor", () => {
  const session = {
    sessionId: "session_001",
    tenantId: TENANT_A,
    resourceId: "res_brand_a",
    twinBindingId: "twin_001",
    capabilities: ["brand.brief.propose"],
    budget: money("2.00"),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    recordingEnabled: false,
    avTokenRef: null,
  };

  it("el avatar no amplía scope ni cruza tenant", () => {
    expect(() => assertSessionAction(session, { tenantId: TENANT_A, capability: "brand.brief.propose", now: new Date() })).not.toThrow();
    expect(() => assertSessionAction(session, { tenantId: TENANT_A, capability: "brand.deliver.propose", now: new Date() })).toThrowError(/outside this session/);
    expect(() => assertSessionAction(session, { tenantId: TENANT_B, capability: "brand.brief.propose", now: new Date() })).toThrowError(/another tenant/);
    expect(() =>
      assertSessionAction({ ...session, expiresAt: new Date(Date.now() - 1000).toISOString() }, { tenantId: TENANT_A, capability: "brand.brief.propose", now: new Date() }),
    ).toThrowError(/expired/);
  });
});

describe("C35 · Contrato de rutas", () => {
  it("solo expone rutas nominadas", () => {
    expect(() => assertRouteAllowed("GET", "/v1/branding/me")).not.toThrow();
    expect(() => assertRouteAllowed("POST", "/v1/branding/proposals")).not.toThrow();
    expect(() => assertRouteAllowed("POST", "/v1/branding/execute-anything")).toThrowError(/not exposed/);
    expect(() => assertRouteAllowed("DELETE", "/v1/branding/resources/res_brand_a")).toThrowError(/not exposed/);
  });
});

describe("C36 · Bridge de eventos", () => {
  it("solo proyecta hechos confirmados y tipos del host", () => {
    const event = toHostEvent({
      fact: {
        tenantId: TENANT_A,
        owner: "owner_spanish",
        type: "task.completed",
        occurredAt: new Date("2026-11-15T10:00:00.000Z"),
        confirmed: true,
        domainEventId: "domain_event_001",
        correlationId: "cor_001",
        causationId: null,
        payloadRef: "ref_001",
        eventId: "event_0001",
      },
    });
    expect(event.schemaVersion).toBe("1.0");
    expect(event.source.kind).toBe("branding");
    expect(() =>
      toHostEvent({
        fact: {
          tenantId: TENANT_A,
          owner: "owner_spanish",
          type: "task.completed",
          occurredAt: new Date(),
          confirmed: false,
          domainEventId: "domain_event_002",
          correlationId: "cor_001",
          causationId: null,
          payloadRef: null,
          eventId: "event_0002",
        },
      }),
    ).toThrowError(/confirmed/);
  });
});

describe("C37 · Handoff", () => {
  const handoff = {
    handoffId: "handoff_001",
    tenantId: TENANT_A,
    fromService: "branding",
    toService: "diseno",
    state: "offered" as const,
    offeredAt: new Date().toISOString(),
    acknowledgedAt: null,
    completedAt: null,
    ackRef: null,
    evidenceRefs: [],
  };

  it("emitir no es recibir: sin ACK no hay trabajo", () => {
    expect(isReceivedByPeer(handoff)).toBe(false);
    expect(() => advanceHandoff(handoff, "working", new Date())).toThrowError(/illegal handoff transition/);
    const acked = acknowledgeHandoff(handoff, "ack_001", new Date());
    expect(isReceivedByPeer(acked)).toBe(true);
    expect(advanceHandoff(acked, "working", new Date()).state).toBe("working");
  });
});

describe("C38 · Presupuesto", () => {
  it("no permite doble gasto del último saldo", () => {
    const ledger = new BudgetLedger(money("10.00"));
    ledger.reserve({ reservationId: "r1", tenantId: TENANT_A, operationKey: "op_1", amount: money("8.00"), now: new Date() });
    expect(() =>
      ledger.reserve({ reservationId: "r2", tenantId: TENANT_A, operationKey: "op_2", amount: money("3.00"), now: new Date() }),
    ).toThrowError(/budget exhausted/);
    ledger.consume("op_1", money("5.00"));
    ledger.release("op_1");
    expect(ledger.available(TENANT_A).amount).toBe("5.00");
    expect(() =>
      ledger.reserve({ reservationId: "r3", tenantId: TENANT_A, operationKey: "op_3", amount: money("6.00"), now: new Date() }),
    ).toThrowError(/budget exhausted/);
  });

  it("un consume por encima de la reserva es conflicto", () => {
    const ledger = new BudgetLedger(money("10.00"));
    ledger.reserve({ reservationId: "r1", tenantId: TENANT_A, operationKey: "op_1", amount: money("2.00"), now: new Date() });
    expect(() => ledger.consume("op_1", money("3.00"))).toThrowError(/exceeds reservation/);
  });
});

describe("C39 · Privacidad y secretos", () => {
  it("detecta material sensible antes de salir del boundary", () => {
    expect(findSecrets("token sk-abcdefghijklmnopqrstuvwxyz012345")).toContain("openai_style_key");
    expect(() => assertNoSecrets("Authorization: Bearer abcdefghijklmnopqrstuvwxyz012345", "log")).toThrowError(/secret material/);
    expect(findSecrets("texto normal de marca")).toEqual([]);
  });

  it("una solicitud de privacidad exige identidad y respeta legal hold", () => {
    const request = {
      requestId: "privacy_001",
      tenantId: TENANT_A,
      subjectRef: "subject_001",
      kind: "erasure" as const,
      identityProofRef: "proof_identity",
      representationProofRef: null,
      scope: ["brand_assets"],
      legalHold: false,
      receivedAt: new Date().toISOString(),
    };
    expect(() => assertPrivacyRequestProcessable(request)).not.toThrow();
    expect(() => assertPrivacyRequestProcessable({ ...request, identityProofRef: null })).toThrowError(/identity/);
    expect(() => assertPrivacyRequestProcessable({ ...request, legalHold: true })).toThrowError(/legal hold/);
  });
});

describe("C41 · Release", () => {
  it("sin tests, sin restore o con hallazgos críticos no hay release", () => {
    const result = evaluateReleaseGate({
      testsExecuted: 0,
      testsPassed: 0,
      criticalFindings: 1,
      blockingGates: ["C40"],
      rollbackDocumented: false,
      backupRestoreVerified: false,
    });
    expect(result.releasable).toBe(false);
    expect(result.blockers).toEqual(expect.arrayContaining(["no_tests_executed", "critical_findings_open", "gate_C40", "restore_unverified"]));
    expect(
      evaluateReleaseGate({ testsExecuted: 10, testsPassed: 10, criticalFindings: 0, blockingGates: [], rollbackDocumented: true, backupRestoreVerified: true }).releasable,
    ).toBe(true);
  });

  it("una capability desconocida queda deshabilitada", () => {
    expect(capabilityEnabled({ "brand.brief.propose": "enabled" }, "brand.export.preview")).toBe(false);
    expect(() => assertCapabilityEnabled({}, "brand.export.preview")).toThrowError(/disabled/);
  });
});

describe("C42 · Aceptación", () => {
  it("un PASS sin tests ni evidencia se degrada a NOT_VERIFIED", () => {
    const matrix = buildAcceptanceMatrix([
      { phaseId: "BRD-C01", status: "PASS", tasksTotal: 7, tasksPassed: 0, gatesExecuted: 0, gatesPassed: 0, evidenceRefs: [], testsExecuted: 0 },
    ]);
    expect(matrix.phases[0]?.status).toBe("NOT_VERIFIED");
    expect(matrix.disclaimers[0]).toMatch(/downgraded/);
    expect(matrix.repoComplete).toBe(false);
  });

  it("el repo solo está completo con 42 fases, gates y tests", () => {
    const phases = Array.from({ length: 42 }, (_, index) => ({
      phaseId: `BRD-C${String(index + 1).padStart(2, "0")}`,
      status: "PASS" as const,
      tasksTotal: 7,
      tasksPassed: 7,
      gatesExecuted: 2,
      gatesPassed: 2,
      evidenceRefs: ["evidence"],
      testsExecuted: 3,
    }));
    expect(buildAcceptanceMatrix(phases).repoComplete).toBe(true);
    expect(buildAcceptanceMatrix(phases.slice(0, 41)).repoComplete).toBe(false);
  });
});

