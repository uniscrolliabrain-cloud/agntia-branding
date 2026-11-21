#!/usr/bin/env node
/**
 * Command-line surface of the installed package.
 *
 * The CLI is the "is this real?" tool: it reports what is configured, what is
 * not, which vertical slices are on and why the rest are not, and it can render
 * a document to bytes. It never invents configuration and never prints secrets.
 *
 * Exit codes: 0 ok, 1 error, 2 not configured.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { DomainError } from "./contracts/errors.ts";
import { BRAND_CAPABILITY_NAMES, CAPABILITIES, getCapability } from "./contracts/capabilities.ts";
import { describeConfig, loadConfig, type RuntimeConfig } from "./config.ts";
import { createApp } from "./api/app.ts";
import { createAuthenticator } from "./auth/service.ts";
import { createHmacKeyProvider, createJwksKeyProvider, type JwtVerifierOptions } from "./auth/jwt.ts";
import { MemoryStore } from "./store/memory-store.ts";
import { loadMembershipFixtures } from "./store/bootstrap.ts";
import { startServer } from "./server.ts";
import { getSlice, resolveActivation, SLICES, sliceDeclaring, validateSliceRegistry } from "./slices/registry.ts";
import { designDocumentSchema } from "./domain/document.ts";
import { exportManifestSchema } from "./domain/export.ts";
import { assetRightsSchema } from "./domain/rights.ts";
import { RENDER_FORMATS, renderDocument, type RenderFormat } from "./domain/render.ts";
import { runMigrate } from "./db/migrate.ts";
import { runSeed } from "./db/seed.ts";

const OK = 0;
const ERROR = 1;
const NOT_CONFIGURED = 2;

const PACKAGE = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  name: string;
  version: string;
};

interface Args {
  command: string;
  flags: Map<string, string | true>;
  positionals: string[];
}

function parseArgs(argv: readonly string[]): Args {
  const [command = "help", ...rest] = argv;
  const flags = new Map<string, string | true>();
  const positionals: string[] = [];

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index] as string;
    if (token === "--") {
      positionals.push(...rest.slice(index + 1));
      break;
    }
    if (token.startsWith("--")) {
      const equals = token.indexOf("=");
      if (equals > 2) {
        flags.set(token.slice(2, equals), token.slice(equals + 1));
        continue;
      }
      const next = rest[index + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags.set(token.slice(2), next);
        index += 1;
      } else {
        flags.set(token.slice(2), true);
      }
    } else {
      positionals.push(token);
    }
  }
  return { command, flags, positionals };
}

function flagString(args: Args, name: string): string | undefined {
  const value = args.flags.get(name);
  return typeof value === "string" ? value : undefined;
}

function hasFlag(args: Args, name: string): boolean {
  return args.flags.has(name);
}

// A closed pipe (`| head`) is a normal end of output, not a crash.
process.stdout.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EPIPE") process.exit(0);
  throw error;
});

function write(text: string): void {
  process.stdout.write(text);
}

function writeErr(text: string): void {
  process.stderr.write(text);
}

function printJson(value: unknown): void {
  write(`${JSON.stringify(value, null, 2)}\n`);
}

const HELP = `agntia-branding ${PACKAGE.version} — branding, design and brand systems core

Usage: agntia-branding <command> [options]

Commands:
  doctor                     Diagnose runtime, config, providers and slices
  slices                     List vertical slices and activation state
  capabilities               List the closed capability registry
  serve                      Start the HTTP API (development only)
  render <input.json>        Render a design document to PDF, PNG or SVG
  migrate                    Apply src/db/schema.sql (needs DATABASE_URL)
  seed                       Load the synthetic fixtures (needs DATABASE_URL)
  version                    Print the package version
  help                       Print this help

Global options:
  --json                     Machine-readable output (doctor, slices, capabilities)

serve options:
  --port <n>                 Override AGNTIA_BRANDING_PORT

render options:
  --out <dir>                Output directory (default: artifacts/render)
  --accept-findings          Emit the file even when the render substitutes
                             something the manifest promised

Environment:
  AGNTIA_BRANDING_MODE       development | test | production (default: development)
  AGNTIA_BRANDING_HOST       Bind host (default: 127.0.0.1)
  AGNTIA_BRANDING_PORT       Bind port (default: 8787)
  AGNTIA_BRANDING_SLICES     Comma-separated slices to enable instead of the default
  AGNTIA_BRANDING_JWT_ISSUER / _AUDIENCE / _SECRET / AGNTIA_BRANDING_JWKS_URL
  AGNTIA_BRANDING_MEMBERSHIPS  Local membership fixture (never in production)
  DATABASE_URL               Postgres DSN for migrate/seed

Nothing is enabled by guessing: a blocked slice, a missing provider or a missing
secret is reported as such and the command fails closed.
`;

interface Check {
  name: string;
  status: "PASS" | "FAIL" | "NOT_CONFIGURED";
  detail: string;
}

function collectDoctorChecks(config: RuntimeConfig | null, configError: DomainError | null): Check[] {
  const checks: Check[] = [];

  const major = Number(process.versions.node.split(".")[0]);
  checks.push({
    name: "node",
    status: major >= 24 ? "PASS" : "FAIL",
    detail: `v${process.versions.node} (requires >=24)`,
  });

  const problems = validateSliceRegistry();
  checks.push({
    name: "slice registry",
    status: problems.length === 0 ? "PASS" : "FAIL",
    detail: problems.length === 0 ? `${SLICES.length} slices cover ${BRAND_CAPABILITY_NAMES.length} capabilities` : problems.join("; "),
  });

  if (configError !== null) {
    checks.push({ name: "config", status: "FAIL", detail: `${configError.code}: ${configError.message}` });
  } else if (config === null) {
    checks.push({ name: "config", status: "FAIL", detail: "config was not loaded" });
  } else {
    checks.push({
      name: "config",
      status: "PASS",
      detail: `${config.mode} ${config.http.host}:${config.http.port}`,
    });
    checks.push({
      name: "slices",
      status: "PASS",
      detail: `${config.activation.slices.length} active / ${SLICES.length} declared`,
    });
    checks.push({
      name: "jwt",
      status: config.jwt === null ? "NOT_CONFIGURED" : "PASS",
      detail: config.jwt === null ? "no issuer/keys configured" : `${config.jwt.kind} (${config.jwt.issuer})`,
    });
    checks.push({
      name: "database",
      status: config.databaseUrl === null ? "NOT_CONFIGURED" : "PASS",
      detail: config.databaseUrl === null ? "DATABASE_URL is not set" : "DATABASE_URL is set",
    });
  }

  checks.push({
    name: "providers",
    status: "NOT_CONFIGURED",
    detail: "penpot, anam and model_gateway have no server-side binding",
  });
  return checks;
}

function printChecks(checks: readonly Check[]): void {
  const width = Math.max(...checks.map((check) => check.name.length));
  for (const check of checks) {
    write(`${check.status.padEnd(15)} ${check.name.padEnd(width)}  ${check.detail}\n`);
  }
}

async function commandDoctor(args: Args): Promise<number> {
  let config: RuntimeConfig | null = null;
  let configError: DomainError | null = null;
  try {
    config = loadConfig();
  } catch (error) {
    if (!(error instanceof DomainError)) throw error;
    configError = error;
  }

  const checks = collectDoctorChecks(config, configError);
  const failed = checks.filter((check) => check.status === "FAIL").length;

  if (hasFlag(args, "json")) {
    printJson({
      ok: failed === 0,
      name: PACKAGE.name,
      version: PACKAGE.version,
      node: process.versions.node,
      checks,
      slices: {
        active: config?.activation.slices ?? [],
        declared: SLICES.map((slice) => ({ id: slice.id, status: slice.status })),
      },
      capabilities: BRAND_CAPABILITY_NAMES.length,
    });
  } else {
    printChecks(checks);
    write(`\n${failed === 0 ? "OK" : "NOT READY"}: ${failed} failed check(s).\n`);
  }
  return failed === 0 ? OK : ERROR;
}

function commandSlices(args: Args): Promise<number> {
  const config = loadConfig();
  const active = new Set<string>(config.activation.slices);

  if (hasFlag(args, "json")) {
    printJson({
      active: config.activation.slices,
      capabilities: [...config.activation.capabilities].sort(),
      slices: SLICES.map((slice) => ({
        id: slice.id,
        title: slice.title,
        status: slice.status,
        enabled: active.has(slice.id),
        capabilities: slice.capabilities,
        campaigns: slice.campaigns,
        blockers: slice.blockers,
        nextStep: slice.nextStep,
      })),
    });
    return Promise.resolve(OK);
  }

  for (const slice of SLICES) {
    const marker = active.has(slice.id) ? "on " : "off";
    write(`${marker} ${slice.id.padEnd(10)} ${slice.status.padEnd(8)} ${slice.title}\n`);
    write(`     capabilities: ${slice.capabilities.join(", ")}\n`);
    if (slice.status !== "active") write(`     next: ${slice.nextStep}\n`);
    for (const blocker of slice.blockers) write(`     blocker: ${blocker}\n`);
  }
  write(`\nActive: ${config.activation.slices.join(", ") || "(none)"}\n`);
  return Promise.resolve(OK);
}

function commandCapabilities(args: Args): Promise<number> {
  const config = loadConfig();
  const rows = CAPABILITIES.map((spec) => ({
    capability: spec.name,
    risk: spec.risk,
    externalEffect: spec.externalEffect,
    requiresApproval: spec.requiresApproval,
    // The declared slice is a property of the registry, not of the activation:
    // a capability that is off still belongs to a slice somebody can enable.
    slice: sliceDeclaring(spec.name) ?? null,
    enabled: config.activation.isCapabilityEnabled(spec.name),
  }));

  if (hasFlag(args, "json")) {
    printJson({ count: rows.length, capabilities: rows });
    return Promise.resolve(OK);
  }
  for (const row of rows) {
    write(
      `${row.enabled ? "on " : "off"} ${row.capability.padEnd(26)} ${row.risk.padEnd(6)} ` +
        `approval=${row.requiresApproval ? "yes" : "no "} effect=${row.externalEffect ? "yes" : "no "} ` +
        `slice=${row.slice ?? "-"}\n`,
    );
  }
  return Promise.resolve(OK);
}

function jwtVerifierOptions(config: RuntimeConfig): JwtVerifierOptions {
  if (config.jwt === null) throw new DomainError("unauthenticated", "JWT verification is not configured.");
  const base = { issuer: config.jwt.issuer, audience: config.jwt.audience };
  return config.jwt.kind === "hs256"
    ? { ...base, keyFor: createHmacKeyProvider(config.jwt.secret) }
    : { ...base, keyFor: createJwksKeyProvider({ jwksUrl: config.jwt.jwksUrl }) };
}

function waitForSignal(): Promise<void> {
  return new Promise((resolve) => {
    const stop = (): void => resolve();
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
}

async function commandServe(args: Args): Promise<number> {
  const config = loadConfig();

  if (config.mode === "production") {
    writeErr(
      "NOT_CONFIGURED: production serving needs the Postgres store adapter, which is not implemented. " +
        "The in-memory store must not be used in production.\n",
    );
    return NOT_CONFIGURED;
  }
  if (config.jwt === null) {
    writeErr(
      "NOT_CONFIGURED: no JWT verification. Set AGNTIA_BRANDING_JWT_ISSUER, " +
        "AGNTIA_BRANDING_JWT_AUDIENCE and AGNTIA_BRANDING_JWT_SECRET (or AGNTIA_BRANDING_JWKS_URL).\n",
    );
    return NOT_CONFIGURED;
  }

  let port = config.http.port;
  const portFlag = flagString(args, "port");
  if (portFlag !== undefined) {
    const parsed = Number(portFlag);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65_535) {
      throw new DomainError("invalid_input", "--port must be an integer between 0 and 65535.");
    }
    port = parsed;
  }

  const store = new MemoryStore({ activation: config.activation });
  if (config.bootstrapMembershipsPath !== null) {
    for (const membership of loadMembershipFixtures(config.bootstrapMembershipsPath)) {
      store.addMembership(membership);
    }
  } else {
    writeErr(
      "WARNING: no AGNTIA_BRANDING_MEMBERSHIPS fixture loaded; every request will be rejected " +
        "with membership_missing until memberships are provisioned.\n",
    );
  }

  const app = createApp({ store, authenticate: createAuthenticator({ jwt: jwtVerifierOptions(config), store }) });
  const running = await startServer({ handle: app, host: config.http.host, port });

  write(`LISTENING ${running.url}\n`);
  printJson({ running: true, config: describeConfig(config) });

  await waitForSignal();
  await running.close();
  write("STOPPED\n");
  return OK;
}

const renderInputSchema = z
  .object({
    document: designDocumentSchema,
    manifest: exportManifestSchema,
    rights: z.array(assetRightsSchema).max(128),
  })
  .strict();

function zodMessage(error: z.ZodError): string {
  return error.issues
    .slice(0, 5)
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}

async function commandRender(args: Args): Promise<number> {
  const inputPath = args.positionals[0];
  if (inputPath === undefined) {
    writeErr("Usage: agntia-branding render <input.json> [--out <dir>] [--accept-findings]\n");
    return ERROR;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(inputPath, "utf8")) as unknown;
  } catch {
    throw new DomainError("invalid_input", "The render input is not readable JSON.", { details: { path: inputPath } });
  }

  const parsed = renderInputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DomainError("invalid_input", "The render input does not match the schema.", {
      details: { issues: zodMessage(parsed.error) },
    });
  }

  const { document, manifest, rights } = parsed.data;
  const format = manifest.format;
  if (!(RENDER_FORMATS as readonly string[]).includes(format)) {
    throw new DomainError("unsupported_operation", "This manifest format has no renderer.", {
      details: { format, supported: RENDER_FORMATS.join(",") },
    });
  }

  const output = renderDocument({
    document,
    manifest,
    rights,
    acceptFindings: hasFlag(args, "accept-findings"),
  });

  const outDir = flagString(args, "out") ?? "artifacts/render";
  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, `${manifest.id}.${format as RenderFormat}`);
  writeFileSync(file, output.bytes);

  printJson({
    file,
    format: output.format,
    byteLength: output.byteLength,
    contentSha256: output.contentSha256,
    documentHashRef: output.documentHashRef,
    manifestHash: output.manifestHash,
    width: output.width,
    height: output.height,
    findings: output.findings,
  });
  return OK;
}

async function commandMigrate(args: Args): Promise<number> {
  void args;
  return runMigrate();
}

async function commandSeed(args: Args): Promise<number> {
  void args;
  return runSeed();
}

async function dispatch(args: Args): Promise<number> {
  switch (args.command) {
    case "help":
    case "--help":
    case "-h":
      write(HELP);
      return OK;
    case "version":
    case "--version":
      write(`${PACKAGE.name} ${PACKAGE.version}\n`);
      return OK;
    case "doctor":
      return commandDoctor(args);
    case "slices":
      return commandSlices(args);
    case "capabilities":
      return commandCapabilities(args);
    case "serve":
      return commandServe(args);
    case "render":
      return commandRender(args);
    case "migrate":
      return commandMigrate(args);
    case "seed":
      return commandSeed(args);
    default:
      writeErr(`Unknown command: ${args.command}\n\n`);
      write(HELP);
      return ERROR;
  }
}

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
  try {
    return await dispatch(parseArgs(argv));
  } catch (error) {
    if (error instanceof DomainError) {
      writeErr(`${error.code.toUpperCase()}: ${error.message}\n`);
      if (Object.keys(error.details).length > 0) writeErr(`  ${JSON.stringify(error.details)}\n`);
      return error.code === "unauthenticated" || error.details["reason"] === "not_configured" ? NOT_CONFIGURED : ERROR;
    }
    // No stack traces by default: they can carry paths and payload fragments.
    writeErr(`ERROR: ${error instanceof Error ? error.message : "unexpected failure"}\n`);
    return ERROR;
  }
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href;

if (invokedDirectly) {
  process.exitCode = await main();
}

export { getSlice, resolveActivation, getCapability };
