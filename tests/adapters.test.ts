import { describe, expect, it } from "vitest";
import { AnamSessionIssuer, PenpotAdapter, assertServerSideBinding, discoverCapabilities, requireUsableCapability, signDownloadUrl, verifyDownloadUrl } from "@agntia/adapters";
import { ASSET_HASH, TENANT_A, TENANT_B } from "./helpers.ts";

const now = new Date("2026-11-15T10:00:00.000Z");

describe("C08 · Discovery", () => {
  it("marca verified_runtime solo cuando la sonda confirma", async () => {
    const report = await discoverCapabilities({
      connectionId: "conn_00001",
      tenantId: TENANT_A,
      deployment: "self-hosted",
      edition: "community",
      version: "2.6",
      now,
      ttlSeconds: 600,
      probes: [
        { capability: "brand.penpot.preview", run: async () => ({ ok: true, fields: ["fileRevision"] }) },
        { capability: "brand.penpot.write", run: async () => ({ ok: false, state: "unsupported", note: "no write API in this edition" }) },
        { capability: "brand.export.preview", run: async () => { throw new Error("network down"); } },
      ],
    });
    expect(report.operations.find((o) => o.capability === "brand.penpot.preview")?.state).toBe("verified_runtime");
    expect(report.operations.find((o) => o.capability === "brand.penpot.write")?.state).toBe("unsupported");
    expect(report.operations.find((o) => o.capability === "brand.export.preview")?.state).toBe("unknown");
    expect(() => requireUsableCapability(report, "brand.penpot.preview", now)).not.toThrow();
    expect(() => requireUsableCapability(report, "brand.penpot.write", now)).toThrowError(/unavailable/);
  });

  it("un report caducado no habilita nada", async () => {
    const report = await discoverCapabilities({
      connectionId: "conn_00002",
      tenantId: TENANT_A,
      deployment: "cloud",
      edition: "pro",
      version: "1",
      now,
      ttlSeconds: 60,
      probes: [{ capability: "brand.penpot.preview", run: async () => ({ ok: true }) }],
    });
    expect(() => requireUsableCapability(report, "brand.penpot.preview", new Date(now.getTime() + 120_000))).toThrowError(/expired/);
  });

  it("rechaza endpointRef libre y conexiones de otro tenant", () => {
    expect(() => assertServerSideBinding({ endpointRef: "https://evil.example/x", secretRef: null, tenantId: TENANT_A, reportTenantId: TENANT_A })).toThrowError(/server-side named binding/);
    expect(() => assertServerSideBinding({ endpointRef: "penpot_prod", secretRef: null, tenantId: TENANT_A, reportTenantId: TENANT_B })).toThrowError(/another tenant/);
  });
});

describe("C08 · Storage firmado", () => {
  const secret = "test-secret-value";

  it("firma y verifica con scope de tenant", () => {
    const token = signDownloadUrl({ tenantId: TENANT_A, assetHash: ASSET_HASH, resourceScope: "brand_assets", ttlSeconds: 300, secret, now });
    expect(verifyDownloadUrl(token, { secret, now, tenantId: TENANT_A }).assetHash).toBe(ASSET_HASH);
    expect(() => verifyDownloadUrl(token, { secret, now, tenantId: TENANT_B })).toThrowError(/another tenant/);
  });

  it("rechaza expirado y firma manipulada", () => {
    const token = signDownloadUrl({ tenantId: TENANT_A, assetHash: ASSET_HASH, resourceScope: "brand_assets", ttlSeconds: 60, secret, now });
    expect(() => verifyDownloadUrl(token, { secret, now: new Date(now.getTime() + 120_000), tenantId: TENANT_A })).toThrowError(/expired/);
    expect(() => verifyDownloadUrl(token, { secret: "otro", now, tenantId: TENANT_A })).toThrowError(/signature/);
  });
});

describe("C18/C34 · Proveedores opcionales", () => {
  const binding = {
    bindingId: "binding_001",
    tenantId: TENANT_A,
    teamId: "team_1",
    projectId: "project_1",
    fileIds: ["file_1"],
    role: "editor" as const,
    capabilities: ["brand.penpot.preview"],
    verifiedAt: null,
  };

  it("Penpot sin configurar se declara not_configured, no simula archivo", async () => {
    const adapter = new PenpotAdapter({ baseUrl: null, accessTokenRef: null, binding, transport: null });
    expect(adapter.configured).toBe(false);
    await expect(adapter.readFile({ tenantId: TENANT_A, fileId: "file_1" })).rejects.toThrowError(/not configured/);
    const report = await adapter.capabilityReport({ connectionId: "conn_00003", now, ttlSeconds: 60 });
    expect(report.operations).toHaveLength(0);
  });

  it("Penpot configurado respeta el binding de tenant y fichero", async () => {
    const adapter = new PenpotAdapter({
      baseUrl: "https://penpot.internal",
      accessTokenRef: "vault:penpot",
      binding,
      transport: { readFile: async ({ fileId }) => ({ fileId, revision: "rev_1", pages: ["cover"] }) },
    });
    expect(adapter.configured).toBe(true);
    await expect(adapter.readFile({ tenantId: TENANT_B, fileId: "file_1" })).rejects.toThrowError(/another tenant/);
    await expect(adapter.readFile({ tenantId: TENANT_A, fileId: "file_2" })).rejects.toThrowError(/not part of this binding/);
    expect(await adapter.readFile({ tenantId: TENANT_A, fileId: "file_1" })).toMatchObject({ revision: "rev_1" });
  });

  it("Anam sin configurar conserva fallback de texto", async () => {
    const issuer = new AnamSessionIssuer({ apiKeyRef: null, transport: null });
    await expect(
      issuer.issue({ sessionId: "session_001", tenantId: TENANT_A, personaId: "persona_1", expiresAt: new Date(now.getTime() + 60_000).toISOString(), now, capabilities: [] }),
    ).rejects.toThrowError(/text fallback/);
  });
});
