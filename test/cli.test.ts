import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { preflight } from "../src/domain/export.ts";
import { supportFixture } from "./fixtures.ts";
import { TENANT_A } from "./helpers.ts";

/**
 * The CLI is how an installed package answers "what is real here?". These tests
 * spawn it the way a user would, with a minimal environment.
 */
const PACKAGE = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
const BASE_ENV = { PATH: process.env["PATH"] ?? "", HOME: process.env["HOME"] ?? "" };

function run(args: readonly string[], env: Record<string, string> = {}) {
  return spawnSync(process.execPath, ["src/cli.ts", ...args], {
    encoding: "utf8",
    env: { ...BASE_ENV, ...env },
    timeout: 60_000,
  });
}

test("help y version no dependen de configuración", () => {
  const help = run(["help"]);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Usage: agntia-branding/);

  const version = run(["version"]);
  assert.equal(version.status, 0);
  assert.equal(version.stdout.trim(), `agntia-branding ${PACKAGE.version}`);
});

test("doctor responde en JSON y distingue lo no configurado de lo fallido", () => {
  const result = run(["doctor", "--json"]);
  assert.equal(result.status, 0, result.stderr);

  const report = JSON.parse(result.stdout) as {
    ok: boolean;
    node: string;
    checks: Array<{ name: string; status: string }>;
    slices: { active: string[]; declared: Array<{ id: string; status: string }> };
    capabilities: number;
  };
  assert.equal(report.ok, true);
  assert.equal(report.capabilities, 24);
  assert.equal(report.slices.declared.length, 13);
  assert.deepEqual(report.slices.active.sort(), [
    "brandbook",
    "brief",
    "design",
    "documents",
    "identity",
    "qa",
    "rights",
    "tokens",
  ]);
  const node = report.checks.find((check) => check.name === "node");
  assert.equal(node?.status, "PASS");
  const database = report.checks.find((check) => check.name === "database");
  assert.equal(database?.status, "NOT_CONFIGURED");
});

test("slices y capabilities muestran qué está apagado y por qué", () => {
  const slices = run(["slices", "--json"]);
  assert.equal(slices.status, 0, slices.stderr);
  const report = JSON.parse(slices.stdout) as {
    slices: Array<{ id: string; status: string; enabled: boolean; blockers: string[] }>;
  };
  const penpot = report.slices.find((slice) => slice.id === "penpot");
  assert.equal(penpot?.status, "blocked");
  assert.equal(penpot?.enabled, false);
  assert.ok((penpot?.blockers.length ?? 0) > 0);

  const capabilities = run(["capabilities", "--json"]);
  assert.equal(capabilities.status, 0, capabilities.stderr);
  const registry = JSON.parse(capabilities.stdout) as {
    count: number;
    capabilities: Array<{ capability: string; slice: string | null; enabled: boolean }>;
  };
  assert.equal(registry.count, 24);
  assert.equal(registry.capabilities.every((row) => row.slice !== null), true);
  assert.equal(registry.capabilities.find((row) => row.capability === "brand.export.preview")?.enabled, false);
  assert.equal(registry.capabilities.find((row) => row.capability === "brand.brief.propose")?.enabled, true);
});

test("serve sin JWT y en producción sale con NOT_CONFIGURED (2)", () => {
  const withoutJwt = run(["serve"], { AGNTIA_BRANDING_PORT: "8799" });
  assert.equal(withoutJwt.status, 2);
  assert.match(withoutJwt.stderr, /NOT_CONFIGURED/);

  const production = run(["serve"], {
    AGNTIA_BRANDING_MODE: "production",
    AGNTIA_BRANDING_PORT: "8799",
    DATABASE_URL: "postgresql://app_api:pw@127.0.0.1:5432/branding",
    AGNTIA_BRANDING_JWT_ISSUER: "https://project.supabase.co/auth/v1",
    AGNTIA_BRANDING_JWT_AUDIENCE: "authenticated",
    AGNTIA_BRANDING_JWKS_URL: "https://project.supabase.co/auth/v1/.well-known/jwks.json",
  });
  assert.equal(production.status, 2);
  assert.match(production.stderr, /Postgres store adapter/);
});

test("render produce bytes reales y los nombra por manifiesto", (t) => {
  const directory = join(".tmp", `cli-render-${process.pid}`);
  mkdirSync(directory, { recursive: true });
  t.after(() => rmSync(directory, { recursive: true, force: true }));

  const document = supportFixture.document(TENANT_A);
  const manifest = preflight({
    document,
    font: supportFixture.font(TENANT_A),
    assets: supportFixture.assets(TENANT_A),
    format: "svg",
    dpi: 96,
    colorProfile: "sRGB",
    now: new Date("2026-11-15T10:00:00.000Z"),
  });
  const inputPath = join(directory, "input.json");
  writeFileSync(inputPath, JSON.stringify({ document, manifest, rights: supportFixture.assets(TENANT_A).map((a) => a.rights) }));

  const result = run(["render", inputPath, "--out", directory, "--accept-findings"]);
  assert.equal(result.status, 0, result.stderr);

  const summary = JSON.parse(result.stdout) as { file: string; contentSha256: string; byteLength: number };
  assert.equal(summary.file, join(directory, `${manifest.id}.svg`));
  assert.equal(summary.contentSha256.length, 64);
  assert.ok(summary.byteLength > 100);
  assert.ok(statSync(summary.file).size > 100);
});

test("render rechaza una entrada que no cumple el contrato", (t) => {
  const directory = join(".tmp", `cli-render-bad-${process.pid}`);
  mkdirSync(directory, { recursive: true });
  t.after(() => rmSync(directory, { recursive: true, force: true }));

  const inputPath = join(directory, "bad.json");
  writeFileSync(inputPath, JSON.stringify({ document: { id: "doc" } }));

  const result = run(["render", inputPath, "--out", directory]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /INVALID_INPUT/);
});
