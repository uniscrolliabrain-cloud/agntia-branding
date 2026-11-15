import { createHmac } from "node:crypto";
import { MemoryStore, type Membership } from "../src/store/memory-store.ts";
import { createAuthenticator } from "../src/auth/service.ts";
import { createHmacKeyProvider } from "../src/auth/jwt.ts";
import type { Principal } from "../src/auth/principal.ts";
import { capabilitiesForRole } from "../src/auth/principal.ts";

export const ISSUER = "https://project.supabase.test/auth/v1";
export const AUDIENCE = "authenticated";
export const SECRET = "test-secret-not-a-real-key-0123456789";

export const TENANT_A = "11111111-1111-4111-8111-111111111111";
export const TENANT_B = "22222222-2222-4222-8222-222222222222";
export const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const USER_B = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
export const USER_COLLAB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface TokenPayload {
  sub: string;
  tenant_id?: string;
  role?: string;
  aud?: string;
  iss?: string;
  exp?: number;
  nbf?: number;
  app_metadata?: Record<string, unknown>;
}

export function signHs256(payload: TokenPayload, secret = SECRET, alg = "HS256"): string {
  const header = b64url(JSON.stringify({ alg, typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const signature = createHmac("sha256", secret).update(`${header}.${body}`).digest();
  return `${header}.${body}.${b64url(signature)}`;
}

export function futureToken(payload: Partial<TokenPayload> & { sub: string }): string {
  return signHs256({
    iss: ISSUER,
    aud: AUDIENCE,
    role: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 600,
    ...payload,
  });
}

export function jwksOptions() {
  return {
    issuer: ISSUER,
    audience: AUDIENCE,
    keyFor: createHmacKeyProvider(SECRET),
    now: () => new Date(),
  };
}

export function makeStore(): MemoryStore {
  const store = new MemoryStore();
  const memberships: Membership[] = [
    {
      id: "m-a-owner",
      userId: USER_A,
      tenantId: TENANT_A,
      role: "owner",
      status: "active",
      scopes: [{ resourceType: "tenant", resourceId: null, fields: [] }],
    },
    {
      id: "m-a-collab",
      userId: USER_COLLAB,
      tenantId: TENANT_A,
      role: "collaborator",
      status: "active",
      scopes: [{ resourceType: "work_order", resourceId: "wo-1", fields: ["brief"] }],
    },
    {
      id: "m-b-owner",
      userId: USER_B,
      tenantId: TENANT_B,
      role: "owner",
      status: "active",
      scopes: [{ resourceType: "tenant", resourceId: null, fields: [] }],
    },
  ];
  for (const membership of memberships) store.addMembership(membership);
  return store;
}

export function principalFor(userId: string, tenantId: string, role: Principal["role"] = "owner"): Principal {
  return {
    userId,
    tenantId,
    membershipId: `m-${userId.slice(0, 4)}`,
    role,
    scopes: [{ resourceType: "tenant", resourceId: null, fields: [] }],
    capabilities: capabilitiesForRole(role),
    verifiedAt: new Date().toISOString(),
  };
}

export function authenticatorFor(store: MemoryStore) {
  return createAuthenticator({ jwt: jwksOptions(), store });
}
