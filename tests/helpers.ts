import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import type { DesignDocument, DesignNode } from "@agntia/domain";
import { SupabaseJwtVerifier, type Membership } from "@agntia/identity";
import { createApp } from "../apps/api/src/app.ts";
import { BrandingService } from "../apps/api/src/service.ts";

export const ISSUER = "https://project.supabase.co/auth/v1";
export const AUDIENCE = "authenticated";

export const TENANT_A = "tenant_aaaa";
export const TENANT_B = "tenant_bbbb";
export const OWNER_A = "user_owner_a";
export const REVIEWER_A = "user_review_a";
export const OWNER_B = "user_owner_b";
export const RESOURCE_A = "res_brand_a";
export const DOC_ID = "doc_brand_a";
export const FONT_ID = "font_brand_a";
export const ASSET_HASH = "b".repeat(64);
export const FONT_HASH = "a".repeat(64);

const keyPair = generateKeyPairSync("rsa", { modulusLength: 2048 });

export function publicJwk(kid = "test-key"): Record<string, unknown> {
  return { ...keyPair.publicKey.export({ format: "jwk" }), kid, use: "sig", alg: "RS256" };
}

export function signJwt(claims: Record<string, unknown>, options: { alg?: string; kid?: string | null } = {}): string {
  const header = { alg: options.alg ?? "RS256", typ: "JWT", ...(options.kid === null ? {} : { kid: options.kid ?? "test-key" }) };
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
  const signingInput = `${encode(header)}.${encode(claims)}`;
  const signature = sign("sha256", Buffer.from(signingInput), keyPair.privateKey as KeyObject);
  return `${signingInput}.${signature.toString("base64url")}`;
}

export function claimsFor(userId: string, tenantId: string, overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: userId,
    iss: ISSUER,
    aud: AUDIENCE,
    iat: now,
    exp: now + 3600,
    app_metadata: { tenant_id: tenantId },
    ...overrides,
  };
}

export function makeVerifier(fetchJwks?: () => Promise<unknown>): SupabaseJwtVerifier {
  return new SupabaseJwtVerifier({
    issuer: ISSUER,
    audience: AUDIENCE,
    jwksUrl: "https://project.supabase.co/auth/v1/.well-known/jwks.json",
    fetchJwks: fetchJwks ?? (async () => ({ keys: [publicJwk()] })),
  });
}

export function memberships(): Membership[] {
  const now = new Date().toISOString();
  return [
    { tenantId: TENANT_A, userId: OWNER_A, role: "owner", status: "active", scopes: ["brand.review.decide"], provisionedAt: now },
    { tenantId: TENANT_A, userId: REVIEWER_A, role: "brand_reviewer", status: "active", scopes: ["brand.review.decide"], provisionedAt: now },
    { tenantId: TENANT_B, userId: OWNER_B, role: "owner", status: "active", scopes: ["brand.review.decide"], provisionedAt: now },
  ];
}

export function textNode(overrides: Partial<DesignNode> = {}): DesignNode {
  return {
    nodeId: "node_text_aaa",
    kind: "text",
    name: "Headline",
    x: 10,
    y: 10,
    width: 400,
    height: 80,
    text: "Marca clara",
    fontHash: FONT_HASH,
    fill: "#111111",
    locked: false,
    children: [],
    ...overrides,
  };
}

export function makeDocument(overrides: Partial<DesignDocument> = {}): DesignDocument {
  return {
    documentId: DOC_ID,
    tenantId: TENANT_A,
    resourceId: RESOURCE_A,
    version: 0,
    engine: "branding-dom",
    engineVersion: "0.1.0",
    nodes: [textNode()],
    constraints: ["headline max 60 chars"],
    textSources: ["brief.headline"],
    fontHashes: [FONT_HASH],
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function makeService(): BrandingService {
  const service = new BrandingService();
  const acl = (tenantId: string, grants: { principalId: string; role: "owner" | "brand_reviewer"; capabilities: string[] }[]) => ({
    tenantId,
    resourceId: RESOURCE_A,
    publicShare: false,
    grants: grants.map((grant) => ({ ...grant, fields: null })),
  });
  const allCaps = [
    "brand.brief.propose",
    "brand.document.update",
    "brand.design.preview",
    "brand.export.preview",
    "brand.deliver.propose",
    "brand.report.read",
    "brand.advisor.session",
    "brand.research.preview",
    "brand.review.decide",
  ];
  service.registerAcl(
    acl(TENANT_A, [
      { principalId: OWNER_A, role: "owner", capabilities: allCaps },
      { principalId: REVIEWER_A, role: "brand_reviewer", capabilities: ["brand.review.decide"] },
    ]),
  );
  service.registerAcl(acl(TENANT_B, [{ principalId: OWNER_B, role: "owner", capabilities: allCaps }]));

  service.registerFont({
    fontId: FONT_ID,
    tenantId: TENANT_A,
    family: "Brand Sans",
    fontHash: FONT_HASH,
    familyLicense: "OFL-1.1",
    embeddingRights: { print: true, web: true, editableDocument: true },
    redistributionAllowed: true,
    fallbackPolicy: "block",
    fallbackFamily: null,
    licenseRef: "license_font_001",
  });
  service.registerRights({
    rightsId: "rights_asset_a",
    tenantId: TENANT_A,
    assetHash: ASSET_HASH,
    source: "commissioned photograph",
    licenseRef: "license_asset_001",
    releaseRef: "release_001",
    expiresAt: null,
    purposes: ["internal_review", "client_delivery", "publication"],
    territory: ["ES"],
    revokedAt: null,
    attribution: "Studio",
  });
  service.registerReceiver({
    receiverId: "receiver_client_a",
    tenantId: TENANT_A,
    kind: "external_client",
    allowedDeliverables: [DOC_ID],
    expiresAt: null,
  });
  service.putDocument(
    { userId: OWNER_A, kind: "human", tenantId: TENANT_A, role: "owner", scopes: allCaps },
    makeDocument(),
  );
  return service;
}

export function ownerPrincipal() {
  return {
    userId: OWNER_A,
    kind: "human" as const,
    tenantId: TENANT_A,
    role: "owner" as const,
    scopes: ["brand.review.decide"],
  };
}

export function reviewerPrincipal() {
  return {
    userId: REVIEWER_A,
    kind: "human" as const,
    tenantId: TENANT_A,
    role: "brand_reviewer" as const,
    scopes: ["brand.review.decide"],
  };
}

export function makeApp(service = makeService()) {
  const verifier = makeVerifier();
  const app = createApp({ verifier, memberships: memberships(), service });
  return { app, service, verifier };
}

export { keyPair };
