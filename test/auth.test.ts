import { test } from "node:test";
import assert from "node:assert/strict";
import { DomainError } from "../src/contracts/errors.ts";
import { verifyJwt } from "../src/auth/jwt.ts";
import {
  AUDIENCE,
  ISSUER,
  SECRET,
  TENANT_A,
  TENANT_B,
  USER_A,
  USER_COLLAB,
  authenticatorFor,
  futureToken,
  jwksOptions,
  makeStore,
} from "./helpers.ts";

async function expectCode(fn: () => Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(fn, (error: unknown) => {
    assert.ok(error instanceof DomainError, `expected DomainError, got ${String(error)}`);
    assert.equal(error.code, code);
    return true;
  });
}

test("un JWT válido con membresía provisionada produce un principal scoped", async () => {
  const store = makeStore();
  const authenticate = authenticatorFor(store);
  const { principal } = await authenticate(futureToken({ sub: USER_A, tenant_id: TENANT_A }));
  assert.equal(principal.tenantId, TENANT_A);
  assert.equal(principal.role, "owner");
  assert.ok(principal.capabilities.includes("brand.deliver.propose"));
});

test("firma inválida se rechaza", async () => {
  const token = futureToken({ sub: USER_A, tenant_id: TENANT_A });
  const [header, body] = token.split(".");
  const tampered = `${header}.${body}.${"A".repeat(43)}`;
  await expectCode(() => verifyJwt(tampered, jwksOptions()), "unauthenticated");
});

test("secreto distinto al configurado se rechaza", async () => {
  const token = futureToken({ sub: USER_A, tenant_id: TENANT_A });
  const { createHmacKeyProvider } = await import("../src/auth/jwt.ts");
  await expectCode(
    () =>
      verifyJwt(token, {
        issuer: ISSUER,
        audience: AUDIENCE,
        keyFor: createHmacKeyProvider(`${SECRET}-other`),
      }),
    "unauthenticated",
  );
});

test("issuer inesperado se rechaza", async () => {
  const token = futureToken({ sub: USER_A, tenant_id: TENANT_A, iss: "https://evil.test/auth/v1" });
  await expectCode(() => verifyJwt(token, jwksOptions()), "unauthenticated");
});

test("audience inesperada se rechaza", async () => {
  const token = futureToken({ sub: USER_A, tenant_id: TENANT_A, aud: "anon" });
  await expectCode(() => verifyJwt(token, jwksOptions()), "unauthenticated");
});

test("token caducado se rechaza", async () => {
  const token = futureToken({ sub: USER_A, tenant_id: TENANT_A, exp: Math.floor(Date.now() / 1000) - 120 });
  await expectCode(() => verifyJwt(token, jwksOptions()), "unauthenticated");
});

test("alg none se rechaza aunque la firma esté vacía", async () => {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify({ sub: USER_A, iss: ISSUER, aud: AUDIENCE })).toString("base64url");
  await expectCode(() => verifyJwt(`${header}.${body}.`, jwksOptions()), "unauthenticated");
});

test("JWT válido sin membresía provisionada no autoriza", async () => {
  const store = makeStore();
  const authenticate = authenticatorFor(store);
  await expectCode(
    () => authenticate(futureToken({ sub: "99999999-9999-4999-8999-999999999999", tenant_id: TENANT_A })),
    "membership_missing",
  );
});

test("token de otro tenant no reutiliza la membresía propia", async () => {
  const store = makeStore();
  const authenticate = authenticatorFor(store);
  await expectCode(
    () => authenticate(futureToken({ sub: USER_A, tenant_id: TENANT_B })),
    "scope_forbidden",
  );
});

test("membresía suspendida se rechaza", async () => {
  const store = makeStore();
  const membership = store.memberships.get(`${TENANT_A}:${USER_A}`);
  assert.ok(membership);
  membership.status = "suspended";
  const authenticate = authenticatorFor(store);
  await expectCode(() => authenticate(futureToken({ sub: USER_A, tenant_id: TENANT_A })), "membership_missing");
});

test("el colaborador no obtiene capacidades de owner", async () => {
  const store = makeStore();
  const authenticate = authenticatorFor(store);
  const { principal } = await authenticate(futureToken({ sub: USER_COLLAB, tenant_id: TENANT_A }));
  assert.equal(principal.role, "collaborator");
  assert.ok(!principal.capabilities.includes("brand.deliver.propose"));
  assert.ok(!principal.capabilities.includes("brand.tokens.export"));
  assert.deepEqual(principal.scopes[0]?.resourceId, "wo-1");
});
