import { describe, expect, it } from "vitest";
import { ApiError } from "@agntia/contracts";
import { assertMandateValid, assertResourceAccess, assertTwinDoesNotInventAuthority, resolvePrincipal } from "@agntia/identity";
import {
  AUDIENCE,
  ISSUER,
  OWNER_A,
  OWNER_B,
  RESOURCE_A,
  TENANT_A,
  TENANT_B,
  claimsFor,
  makeVerifier,
  memberships,
  signJwt,
} from "./helpers.ts";

const verifier = makeVerifier();

async function expectApiError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(ApiError);
  await promise.catch((error: ApiError) => expect(error.code).toBe(code));
}

describe("C03 · JWT Supabase", () => {
  it("verifica firma, issuer, audience y tiempos", async () => {
    const claims = await verifier.verify(signJwt(claimsFor(OWNER_A, TENANT_A)));
    expect(claims.sub).toBe(OWNER_A);
    expect(claims.iss).toBe(ISSUER);
  });

  it("rechaza alg none", async () => {
    await expectApiError(verifier.verify(signJwt(claimsFor(OWNER_A, TENANT_A), { alg: "none" })), "unauthenticated");
  });

  it("rechaza un issuer distinto aunque la firma sea válida", async () => {
    const token = signJwt(claimsFor(OWNER_A, TENANT_A, { iss: "https://evil.example/auth/v1" }));
    await expectApiError(verifier.verify(token), "unauthenticated");
  });

  it("rechaza audiencia incorrecta y tokens caducados", async () => {
    const wrongAudience = signJwt(claimsFor(OWNER_A, TENANT_A, { aud: "other" }));
    await expectApiError(verifier.verify(wrongAudience), "unauthenticated");
    const now = Math.floor(Date.now() / 1000);
    const expired = signJwt(claimsFor(OWNER_A, TENANT_A, { iat: now - 7200, exp: now - 3600 }));
    await expectApiError(verifier.verify(expired), "unauthenticated");
  });

  it("rechaza una firma manipulada", async () => {
    const token = signJwt(claimsFor(OWNER_A, TENANT_A));
    const [header, payload] = token.split(".");
    const tampered = `${header}.${payload}.${"A".repeat(342)}`;
    await expectApiError(verifier.verify(tampered), "unauthenticated");
  });

  it("no confía en user_metadata editable", async () => {
    const token = signJwt(
      claimsFor(OWNER_A, TENANT_A, { app_metadata: {}, user_metadata: { tenant_id: TENANT_B, role: "owner" } }),
    );
    const claims = await verifier.verify(token);
    expect(() => resolvePrincipal({ claims, memberships: memberships() })).toThrowError(/no signed tenant claim/);
  });

  it("un tenant firmado sin membership provisionada no autoriza", async () => {
    const token = signJwt(claimsFor(OWNER_A, TENANT_B));
    const claims = await verifier.verify(token);
    expect(() => resolvePrincipal({ claims, memberships: memberships() })).toThrowError(/no provisioned membership/);
  });

  it("una membership suspendida se rechaza", async () => {
    const token = signJwt(claimsFor(OWNER_A, TENANT_A));
    const claims = await verifier.verify(token);
    const suspended = memberships().map((m) => (m.userId === OWNER_A ? { ...m, status: "suspended" as const } : m));
    expect(() => resolvePrincipal({ claims, memberships: suspended })).toThrowError(/membership is suspended/);
  });
});

describe("C03 · ACL por recurso", () => {
  const principal = {
    userId: OWNER_A,
    kind: "human" as const,
    tenantId: TENANT_A,
    role: "owner" as const,
    scopes: [],
  };
  const acl = {
    tenantId: TENANT_A,
    resourceId: RESOURCE_A,
    publicShare: false,
    grants: [{ principalId: OWNER_A, role: "owner" as const, capabilities: ["brand.brief.propose"], fields: ["purpose"] }],
  };

  it("permite la capacidad concedida y el campo permitido", () => {
    expect(() => assertResourceAccess(principal, acl, { resourceId: RESOURCE_A, capability: "brand.brief.propose", field: "purpose" })).not.toThrow();
  });

  it("deniega capacidad o campo no concedidos", () => {
    expect(() => assertResourceAccess(principal, acl, { resourceId: RESOURCE_A, capability: "brand.export.preview" })).toThrowError(/capability/);
    expect(() => assertResourceAccess(principal, acl, { resourceId: RESOURCE_A, capability: "brand.brief.propose", field: "secret" })).toThrowError(/field/);
  });

  it("un recurso de otro tenant aparece como no encontrado, sin filtrar existencia", () => {
    expect(() => assertResourceAccess({ ...principal, tenantId: TENANT_B }, acl, { resourceId: RESOURCE_A, capability: "brand.brief.propose" })).toThrowError(/not found/);
  });

  it("un colaborador sin grant no hereda permisos del owner", () => {
    expect(() => assertResourceAccess({ ...principal, userId: "user_other_1" }, acl, { resourceId: RESOURCE_A, capability: "brand.brief.propose" })).toThrowError(/no grant/);
  });
});

describe("C04 · Twins y mandato", () => {
  const mandate = {
    mandateId: "mandate_001",
    originatingActorId: "actor_origin_1",
    originatingTenantId: TENANT_B,
    targetTenantId: TENANT_A,
    workOrderId: "work_order_1",
    twinBindingId: "twin_binding_1",
    capabilities: ["brand.brief.propose", "brand.design.preview"],
    purpose: "brand_system_delivery",
    budget: { amount: "10.00", currency: "EUR", exponent: 2 },
    issuedAt: new Date(Date.now() - 60_000).toISOString(),
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    revocationVersion: 2,
    proofRef: "proof_mandate_1",
  };

  it("acepta un mandato vigente y scoped", () => {
    expect(() =>
      assertMandateValid(mandate, { now: new Date(), targetTenantId: TENANT_A, capability: "brand.brief.propose", currentRevocationVersion: 2 }),
    ).not.toThrow();
  });

  it("rechaza tenant objetivo distinto, capability fuera de alcance y caducidad", () => {
    expect(() =>
      assertMandateValid(mandate, { now: new Date(), targetTenantId: TENANT_B, capability: "brand.brief.propose", currentRevocationVersion: 2 }),
    ).toThrowError(/another tenant/);
    expect(() =>
      assertMandateValid(mandate, { now: new Date(), targetTenantId: TENANT_A, capability: "brand.deliver.propose", currentRevocationVersion: 2 }),
    ).toThrowError(/outside the mandate/);
    expect(() =>
      assertMandateValid(
        { ...mandate, expiresAt: new Date(Date.now() - 1000).toISOString() },
        { now: new Date(), targetTenantId: TENANT_A, capability: "brand.brief.propose", currentRevocationVersion: 2 },
      ),
    ).toThrowError(/expired/);
  });

  it("rechaza mandato revocado", () => {
    expect(() =>
      assertMandateValid(mandate, { now: new Date(), targetTenantId: TENANT_A, capability: "brand.brief.propose", currentRevocationVersion: 3 }),
    ).toThrowError(/revoked/);
  });

  it("un twin no puede reclamar capabilities no delegadas", () => {
    const twin = {
      twinBindingId: "twin_binding_1",
      canonicalRuntimeId: "runtime_1",
      canonicalRoleId: "role_1",
      personaId: null,
      instanceId: "instance_1",
      targetTenantId: TENANT_A,
      workOrderId: "work_order_1",
      capabilities: ["brand.brief.propose", "brand.deliver.propose"],
      purpose: "brand_system_delivery",
      issuedAt: mandate.issuedAt,
      expiresAt: mandate.expiresAt,
      revocationVersion: 2,
      proofRef: "proof_twin_1",
    };
    expect(() => assertTwinDoesNotInventAuthority(twin, mandate)).toThrowError(/not delegated/);
  });
});
