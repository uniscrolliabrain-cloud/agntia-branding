import { z } from "zod";
import { DomainError } from "./contracts/errors.ts";
import { resolveActivation, type SliceActivation } from "./slices/registry.ts";

/**
 * Runtime configuration.
 *
 * One loader, one schema, no second source of truth: every entry point (CLI,
 * server, tests) reads the same validated object. Configuration never arrives
 * from a request, and a missing value is reported as missing — there is no
 * default tenant, default owner or fallback provider.
 *
 * A shared HS256 secret is a development convenience. In production it is
 * refused outright, because symmetric verification means every holder of the
 * secret can mint tokens for every tenant.
 */

export const RUNTIME_MODES = ["development", "test", "production"] as const;
export type RuntimeMode = (typeof RUNTIME_MODES)[number];

export const configSchema = z
  .object({
    mode: z.enum(RUNTIME_MODES),
    http: z
      .object({
        host: z.string().min(1).max(255),
        port: z.number().int().min(1).max(65_535),
      })
      .strict(),
    databaseUrl: z.string().min(1).max(2048).nullable(),
    jwt: z
      .discriminatedUnion("kind", [
        z
          .object({
            kind: z.literal("hs256"),
            issuer: z.string().min(1).max(512),
            audience: z.string().min(1).max(256),
            secret: z.string().min(32).max(512),
          })
          .strict(),
        z
          .object({
            kind: z.literal("jwks"),
            issuer: z.string().min(1).max(512),
            audience: z.string().min(1).max(256),
            jwksUrl: z.string().url().max(2048),
          })
          .strict(),
      ])
      .nullable(),
    /** Path to a local membership fixture. Refused in production. */
    bootstrapMembershipsPath: z.string().min(1).max(1024).nullable(),
    slices: z.array(z.string().min(1).max(64)).max(64),
  })
  .strict();

export type JwtRuntimeConfig = NonNullable<z.infer<typeof configSchema>["jwt"]>;

export interface RuntimeConfig extends Omit<z.infer<typeof configSchema>, "slices"> {
  activation: SliceActivation;
}

export type Env = Record<string, string | undefined>;

function invalid(message: string, details: Record<string, string | number | boolean> = {}): DomainError {
  return new DomainError("invalid_input", message, { details });
}

function readString(env: Env, name: string): string | null {
  const value = env[name];
  if (value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function readPort(env: Env): number {
  const raw = readString(env, "AGNTIA_BRANDING_PORT");
  if (raw === null) return 8787;
  if (!/^[0-9]{1,5}$/.test(raw)) {
    throw invalid("AGNTIA_BRANDING_PORT must be an integer between 1 and 65535.", { variable: "AGNTIA_BRANDING_PORT" });
  }
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw invalid("AGNTIA_BRANDING_PORT must be an integer between 1 and 65535.", { variable: "AGNTIA_BRANDING_PORT" });
  }
  return port;
}

function readMode(env: Env): RuntimeMode {
  const raw = readString(env, "AGNTIA_BRANDING_MODE");
  if (raw === null) return "development";
  if (!(RUNTIME_MODES as readonly string[]).includes(raw)) {
    throw invalid("AGNTIA_BRANDING_MODE must be development, test or production.", {
      variable: "AGNTIA_BRANDING_MODE",
    });
  }
  return raw as RuntimeMode;
}

function readDatabaseUrl(env: Env): string | null {
  const raw = readString(env, "DATABASE_URL");
  if (raw === null) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    // Never echo the value: a DSN carries credentials.
    throw invalid("DATABASE_URL is not a valid URL.", { variable: "DATABASE_URL" });
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw invalid("DATABASE_URL must be a postgres:// or postgresql:// URL.", { variable: "DATABASE_URL" });
  }
  return raw;
}

function readJwt(env: Env, mode: RuntimeMode): JwtRuntimeConfig | null {
  const issuer = readString(env, "AGNTIA_BRANDING_JWT_ISSUER");
  const audience = readString(env, "AGNTIA_BRANDING_JWT_AUDIENCE");
  const secret = readString(env, "AGNTIA_BRANDING_JWT_SECRET");
  const jwksUrl = readString(env, "AGNTIA_BRANDING_JWKS_URL");

  const configured = issuer !== null || audience !== null || secret !== null || jwksUrl !== null;
  if (!configured) {
    if (mode === "production") throw invalid("Production requires JWT verification configuration.");
    return null;
  }

  if (issuer === null) throw invalid("AGNTIA_BRANDING_JWT_ISSUER is required when JWT is configured.");
  if (audience === null) throw invalid("AGNTIA_BRANDING_JWT_AUDIENCE is required when JWT is configured.");
  if (secret !== null && jwksUrl !== null) {
    throw invalid("Configure either a shared secret or a JWKS URL, never both.", { reason: "ambiguous_key_source" });
  }
  if (secret !== null) {
    if (mode === "production") {
      throw new DomainError("policy_violation", "Production refuses a symmetric JWT secret; use JWKS.", {
        details: { reason: "shared_secret_in_production" },
      });
    }
    if (secret.length < 32) throw invalid("The JWT secret must be at least 32 characters.", { variable: "AGNTIA_BRANDING_JWT_SECRET" });
    return { kind: "hs256", issuer, audience, secret };
  }
  if (jwksUrl === null) {
    throw invalid("JWT is configured but has neither a secret (development) nor a JWKS URL.");
  }
  return { kind: "jwks", issuer, audience, jwksUrl };
}

function readSlices(env: Env): string[] {
  const raw = readString(env, "AGNTIA_BRANDING_SLICES");
  if (raw === null) return [];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "");
}

export function loadConfig(env: Env = process.env): RuntimeConfig {
  const mode = readMode(env);
  const host = readString(env, "AGNTIA_BRANDING_HOST") ?? "127.0.0.1";
  const port = readPort(env);
  const databaseUrl = readDatabaseUrl(env);
  const jwt = readJwt(env, mode);
  const bootstrapMembershipsPath = readString(env, "AGNTIA_BRANDING_MEMBERSHIPS");
  const slices = readSlices(env);

  if (bootstrapMembershipsPath !== null && mode === "production") {
    throw new DomainError("policy_violation", "Fixture memberships cannot be loaded in production.", {
      details: { reason: "fixture_memberships_in_production" },
    });
  }

  // A slice that does not exist, or a blocked one, stops startup instead of
  // being ignored: silently serving fewer capabilities than configured is worse.
  const activation = resolveActivation(slices.length === 0 ? null : slices);

  const parsed = configSchema.parse({
    mode,
    http: { host, port },
    databaseUrl,
    jwt,
    bootstrapMembershipsPath,
    slices,
  });

  return { ...parsed, activation };
}

/**
 * A configuration view safe to print: no secret, no DSN. Used by `doctor` and
 * by the startup log.
 */
export function describeConfig(config: RuntimeConfig): Record<string, unknown> {
  return {
    mode: config.mode,
    http: config.http,
    database: config.databaseUrl === null ? "not_configured" : "configured",
    jwt:
      config.jwt === null
        ? "not_configured"
        : {
            kind: config.jwt.kind,
            issuer: config.jwt.issuer,
            audience: config.jwt.audience,
            jwksUrl: config.jwt.kind === "jwks" ? config.jwt.jwksUrl : null,
            secret: config.jwt.kind === "hs256" ? "redacted" : null,
          },
    memberships: config.bootstrapMembershipsPath === null ? "not_configured" : "fixture_file",
    slices: {
      requested: config.activation.requestedSlices,
      active: config.activation.slices,
      capabilities: config.activation.capabilities.size,
    },
  };
}
