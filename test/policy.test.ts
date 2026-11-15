import { test } from "node:test";
import assert from "node:assert/strict";
import { DomainError } from "../src/contracts/errors.ts";
import { contentHash } from "../src/contracts/evidence.ts";
import { assertIndependentReviewer, verifyApproval, type ApprovalBinding } from "../src/policy/approval.ts";
import { assertMandateUsable, assertNoMandateWidening, type DelegationMandate } from "../src/policy/mandate.ts";
import { enforcePolicy } from "../src/policy/pep.ts";
import { composeEnvelope } from "../src/contracts/envelope.ts";
import { makeStore, principalFor, TENANT_A, USER_A } from "./helpers.ts";

const RIGHTS_HASH = contentHash({ rights: "state" });
const POLICY_HASH = contentHash({ policy: "v1" });
const PAYLOAD_HASH = contentHash({ document: "v3" });

function approval(overrides: Partial<ApprovalBinding> = {}): ApprovalBinding {
  return {
    id: "apr_00000001",
    tenantId: TENANT_A,
    resourceType: "design_document",
    resourceId: "doc_1",
    reviewerId: "reviewer-1",
    reviewerRole: "owner",
    payloadHash: PAYLOAD_HASH,
    resourceVersion: 3,
    rightsHash: RIGHTS_HASH,
    policyHash: POLICY_HASH,
    recipient: null,
    channel: "download",
    costCeiling: "0.000000",
    currency: "EUR",
    issuedAt: new Date(Date.now() - 60_000).toISOString(),
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    revokedAt: null,
    revocationVersion: 0,
    ...overrides,
  };
}

function expectation(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: TENANT_A,
    resourceType: "design_document" as const,
    resourceId: "doc_1",
    payloadHash: PAYLOAD_HASH,
    resourceVersion: 3,
    rightsHash: RIGHTS_HASH,
    policyHash: POLICY_HASH,
    recipient: null,
    channel: "download" as const,
    now: new Date(),
    ...overrides,
  };
}

function expectPolicyError(fn: () => void, code: string, reason?: string): void {
  assert.throws(fn, (error: unknown) => {
    assert.ok(error instanceof DomainError);
    assert.equal(error.code, code);
    if (reason !== undefined) assert.equal(error.details["reason"], reason);
    return true;
  });
}

test("una aprobación vigente y bien ligada se acepta", () => {
  verifyApproval(approval(), expectation());
});

test("cambiar el contenido invalida la aprobación", () => {
  expectPolicyError(
    () => verifyApproval(approval(), expectation({ payloadHash: contentHash({ document: "v4" }) })),
    "approval_invalid",
    "payload_changed",
  );
});

test("cambiar la versión del recurso invalida la aprobación", () => {
  expectPolicyError(() => verifyApproval(approval(), expectation({ resourceVersion: 4 })), "approval_invalid", "version_changed");
});

test("cambiar los derechos invalida la aprobación", () => {
  expectPolicyError(
    () => verifyApproval(approval(), expectation({ rightsHash: contentHash({ rights: "revoked" }) })),
    "approval_invalid",
    "rights_changed",
  );
});

test("cambiar el destinatario invalida la aprobación", () => {
  expectPolicyError(
    () => verifyApproval(approval(), expectation({ recipient: "someone@else.test", channel: "email_link" })),
    "approval_invalid",
    "recipient_or_channel_changed",
  );
});

test("aprobación caducada se rechaza", () => {
  expectPolicyError(
    () => verifyApproval(approval({ expiresAt: new Date(Date.now() - 1000).toISOString() }), expectation()),
    "approval_invalid",
    "expired",
  );
});

test("aprobación revocada se rechaza", () => {
  expectPolicyError(
    () => verifyApproval(approval({ revokedAt: new Date().toISOString() }), expectation()),
    "approval_invalid",
    "revoked",
  );
});

test("aprobación de otro tenant se rechaza", () => {
  expectPolicyError(
    () => verifyApproval(approval({ tenantId: "22222222-2222-4222-8222-222222222222" }), expectation()),
    "approval_invalid",
    "tenant_mismatch",
  );
});

test("el proponente no puede aprobar su propio efecto", () => {
  expectPolicyError(() => assertIndependentReviewer(approval({ reviewerId: "me" }), "me"), "policy_violation", "self_approval");
});

function mandate(overrides: Partial<DelegationMandate> = {}): DelegationMandate {
  return {
    id: "mnd_00000001",
    canonicalAgentRef: "agente:branding-specialist",
    localInstanceId: "twin-local-1",
    originatingActorId: USER_A,
    originatingTenantId: TENANT_A,
    targetTenantId: TENANT_A,
    workOrderId: "wo-1",
    capabilities: ["brand.brief.propose", "brand.concept.preview"],
    purpose: "brand_strategy",
    budgetRef: "budget-a",
    issuedAt: new Date(Date.now() - 60_000).toISOString(),
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    revocationVersion: 2,
    proofRef: "proof-1",
    ...overrides,
  };
}

test("mandato vigente permite la capacidad incluida", () => {
  assertMandateUsable(mandate(), {
    now: new Date(),
    currentRevocationVersion: 2,
    capability: "brand.brief.propose",
    targetTenantId: TENANT_A,
  });
});

test("mandato caducado bloquea efectos nuevos", () => {
  expectPolicyError(
    () =>
      assertMandateUsable(mandate({ expiresAt: new Date(Date.now() - 1000).toISOString() }), {
        now: new Date(),
        currentRevocationVersion: 2,
        capability: "brand.brief.propose",
        targetTenantId: TENANT_A,
      }),
    "policy_violation",
    "expired_mandate",
  );
});

test("mandato revocado por versión superior bloquea", () => {
  expectPolicyError(
    () =>
      assertMandateUsable(mandate(), {
        now: new Date(),
        currentRevocationVersion: 3,
        capability: "brand.brief.propose",
        targetTenantId: TENANT_A,
      }),
    "policy_violation",
    "revoked_mandate",
  );
});

test("mandato no cubre capacidades fuera de su lista", () => {
  expectPolicyError(
    () =>
      assertMandateUsable(mandate(), {
        now: new Date(),
        currentRevocationVersion: 2,
        capability: "brand.deliver.propose",
        targetTenantId: TENANT_A,
      }),
    "scope_forbidden",
    "capability_outside_mandate",
  );
});

test("mandato no se autoamplía", () => {
  expectPolicyError(
    () => assertNoMandateWidening(mandate(), mandate({ capabilities: ["brand.brief.propose", "brand.deliver.propose"] })),
    "policy_violation",
    "mandate_widening",
  );
});

function envelope(capability: string, approvalRef: string | null = null) {
  return composeEnvelope({
    operationId: "op_00000001",
    tenantId: TENANT_A,
    actorId: USER_A,
    client: {
      capability,
      correlationId: "corr-00000001",
      idempotencyKey: "idem-00000001",
      dryRun: false,
      payload: {},
    },
    approvalRef,
  });
}

test("PEP rechaza capacidades desconocidas", () => {
  const store = makeStore();
  expectPolicyError(
    () => enforcePolicy({ principal: principalFor(USER_A, TENANT_A), envelope: envelope("brand.admin.delete") }, store),
    "unsupported_capability",
  );
});

test("PEP exige aprobación para exportar tokens", () => {
  const store = makeStore();
  expectPolicyError(
    () => enforcePolicy({ principal: principalFor(USER_A, TENANT_A), envelope: envelope("brand.tokens.export") }, store),
    "approval_required",
  );
});

test("PEP acepta la exportación con aprobación ligada al material actual", () => {
  const store = makeStore();
  store.putApproval(approval({ resourceType: "export_manifest", resourceId: "expr_1", channel: "portal" }));
  const env = envelope("brand.tokens.export", "apr_00000001");
  const result = enforcePolicy(
    {
      principal: principalFor(USER_A, TENANT_A),
      envelope: env,
      bindings: {
        payloadHash: PAYLOAD_HASH,
        resourceVersion: 3,
        rightsHash: RIGHTS_HASH,
        policyHash: POLICY_HASH,
        recipient: null,
        channel: "portal",
      },
    },
    store,
  );
  assert.equal(result.spec.name, "brand.tokens.export");
  assert.ok(store.audit.some((a) => a.outcome === "allowed"));
});

test("PEP deniega recurso fuera del scope del colaborador", () => {
  const store = makeStore();
  const principal = principalFor("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", TENANT_A, "collaborator");
  expectPolicyError(
    () =>
      enforcePolicy(
        {
          principal,
          envelope: composeEnvelope({
            operationId: "op_00000002",
            tenantId: TENANT_A,
            actorId: principal.userId,
            client: {
              capability: "brand.design.preview",
              correlationId: "corr-00000002",
              idempotencyKey: "idem-00000002",
              dryRun: true,
              payload: {},
            },
          }),
          resourceType: "design_document",
          resourceId: "doc-outside",
        },
        store,
      ),
    "scope_forbidden",
  );
});
