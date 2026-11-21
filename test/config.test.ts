import { test } from "node:test";
import assert from "node:assert/strict";
import { DomainError } from "../src/contracts/errors.ts";
import { describeConfig, loadConfig } from "../src/config.ts";

const DSN = "postgresql://app_api:sup3r-s3cret@127.0.0.1:5432/branding";
const SECRET = "development-secret-not-a-real-key-0123456789";

function expectCode(fn: () => unknown, code: string): void {
  assert.throws(fn, (error: unknown) => error instanceof DomainError && error.code === code);
}

test("sin configuración arranca en desarrollo con el core activo y nada más", () => {
  const config = loadConfig({});

  assert.equal(config.mode, "development");
  assert.deepEqual(config.http, { host: "127.0.0.1", port: 8787 });
  assert.equal(config.databaseUrl, null);
  assert.equal(config.jwt, null);
  assert.equal(config.bootstrapMembershipsPath, null);
  assert.equal(config.activation.isCapabilityEnabled("brand.brief.propose"), true);
  assert.equal(config.activation.isCapabilityEnabled("brand.export.preview"), false);
});

test("las slices se leen del entorno, con espacios tolerados", () => {
  const config = loadConfig({ AGNTIA_BRANDING_SLICES: " research , export " });
  assert.deepEqual([...config.activation.slices].sort(), ["export", "research"]);
  assert.equal(config.activation.isCapabilityEnabled("brand.clearance.preview"), true);
});

test("una slice desconocida en el entorno impide arrancar", () => {
  expectCode(() => loadConfig({ AGNTIA_BRANDING_SLICES: "research,nope" }), "invalid_input");
  expectCode(() => loadConfig({ AGNTIA_BRANDING_SLICES: "penpot" }), "policy_violation");
});

test("el modo y el puerto se validan", () => {
  expectCode(() => loadConfig({ AGNTIA_BRANDING_MODE: "staging" }), "invalid_input");
  expectCode(() => loadConfig({ AGNTIA_BRANDING_PORT: "99999" }), "invalid_input");
  expectCode(() => loadConfig({ AGNTIA_BRANDING_PORT: "abc" }), "invalid_input");
  assert.equal(loadConfig({ AGNTIA_BRANDING_PORT: "3000" }).http.port, 3000);
});

test("DATABASE_URL se valida por esquema y nunca se repite en el error", () => {
  assert.equal(loadConfig({ DATABASE_URL: DSN }).databaseUrl, DSN);
  assert.throws(
    () => loadConfig({ DATABASE_URL: "mysql://user:secret@localhost/db" }),
    (error: unknown) => {
      assert.ok(error instanceof DomainError);
      assert.equal(error.code, "invalid_input");
      assert.equal(JSON.stringify(error.details).includes("secret"), false);
      return true;
    },
  );
});

test("producción rechaza un secreto HS256 compartido", () => {
  assert.throws(
    () =>
      loadConfig({
        AGNTIA_BRANDING_MODE: "production",
        DATABASE_URL: DSN,
        AGNTIA_BRANDING_JWT_ISSUER: "https://project.supabase.co/auth/v1",
        AGNTIA_BRANDING_JWT_AUDIENCE: "authenticated",
        AGNTIA_BRANDING_JWT_SECRET: SECRET,
      }),
    (error: unknown) =>
      error instanceof DomainError &&
      error.code === "policy_violation" &&
      error.details["reason"] === "shared_secret_in_production",
  );
});

test("producción exige JWT configurado", () => {
  expectCode(
    () => loadConfig({ AGNTIA_BRANDING_MODE: "production", DATABASE_URL: DSN }),
    "invalid_input",
  );
});

test("producción con JWKS es válida y describe la configuración sin secretos", () => {
  const config = loadConfig({
    AGNTIA_BRANDING_MODE: "production",
    DATABASE_URL: DSN,
    AGNTIA_BRANDING_JWT_ISSUER: "https://project.supabase.co/auth/v1",
    AGNTIA_BRANDING_JWT_AUDIENCE: "authenticated",
    AGNTIA_BRANDING_JWKS_URL: "https://project.supabase.co/auth/v1/.well-known/jwks.json",
  });

  assert.equal(config.jwt?.kind, "jwks");
  const described = JSON.stringify(describeConfig(config));
  assert.equal(described.includes("sup3r-s3cret"), false);
  assert.equal(described.includes(DSN), false);
  assert.equal(described.includes("jwks.json"), true);
});

test("un secreto corto en desarrollo se rechaza", () => {
  expectCode(
    () =>
      loadConfig({
        AGNTIA_BRANDING_JWT_ISSUER: "https://issuer.test",
        AGNTIA_BRANDING_JWT_AUDIENCE: "authenticated",
        AGNTIA_BRANDING_JWT_SECRET: "short",
      }),
    "invalid_input",
  );
});

test("las fixtures de membresías no se aceptan en producción", () => {
  expectCode(
    () =>
      loadConfig({
        AGNTIA_BRANDING_MODE: "production",
        DATABASE_URL: DSN,
        AGNTIA_BRANDING_JWT_ISSUER: "https://project.supabase.co/auth/v1",
        AGNTIA_BRANDING_JWT_AUDIENCE: "authenticated",
        AGNTIA_BRANDING_JWKS_URL: "https://project.supabase.co/auth/v1/.well-known/jwks.json",
        AGNTIA_BRANDING_MEMBERSHIPS: "memberships.json",
      }),
    "policy_violation",
  );
});
