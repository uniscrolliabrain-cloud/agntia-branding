/**
 * Type-level install check. It is copied into a throw-away project that
 * installed the packed tarballs, then compiled with the repo's TypeScript.
 * A parent repo must be able to typecheck against these packages, not only
 * import them from JavaScript.
 */
import { money, type Money } from "@agntia/contracts";
import { proposeBrief, type BrandBrief, type DesignDocument } from "@agntia/domain";
import { resolvePrincipal, type Principal } from "@agntia/identity";
import { ResourceStore } from "@agntia/persistence";
import { BrandingClient } from "@agntia/sdk";
import { createApp } from "@agntia/api";
import { BrandingService } from "@agntia/api/service";
import { VerticalService, type VerticalRecord, type VerticalStage } from "@agntia/api/verticals";

const budget: Money = money("10.00");
const stage: VerticalStage = "brief";
const brief: BrandBrief = proposeBrief({
  briefId: "brief_typecheck_1",
  tenantId: "tenant_typecheck",
  resourceId: "res_typecheck_1",
  purpose: "typecheck",
  audienceDeclared: "parent repo",
  deliverables: ["brandbook"],
  constraints: [],
  acceptance: ["owner_approval"],
  version: 0,
});

const principal: Principal = resolvePrincipal({
  claims: {
    sub: "user_typecheck",
    iss: "https://typecheck.supabase.co/auth/v1",
    aud: "authenticated",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60,
    app_metadata: { tenant_id: "tenant_typecheck" },
  },
  memberships: [
    {
      tenantId: "tenant_typecheck",
      userId: "user_typecheck",
      role: "owner",
      status: "active",
      scopes: ["brand.review.decide"],
      provisionedAt: new Date().toISOString(),
    },
  ],
});

const documents = new Map<string, DesignDocument>();
const resources = new ResourceStore();
resources.put({
  tenantId: principal.tenantId,
  resourceId: "res_typecheck_1",
  payload: brief,
  expectedVersion: null,
  actorId: principal.userId,
  now: new Date(),
});

const service = new BrandingService();
const verticals = new VerticalService(service);
const app = createApp({
  verifier: {
    verify: async () => {
      throw new Error("typecheck fixture");
    },
  },
  memberships: [],
  service,
  verticals,
});

const record: VerticalRecord | null = null;
const client = new BrandingClient({ baseUrl: "http://127.0.0.1:1", accessToken: "unused" });

void app;
void budget;
void stage;
void record;
void client;
void documents;
