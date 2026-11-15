import { createHmac, createPublicKey, timingSafeEqual, verify as cryptoVerify, type KeyObject } from "node:crypto";
import { DomainError } from "../contracts/errors.ts";

/**
 * Supabase JWT verification, implemented on node:crypto so it runs identically
 * in Node and in Workers without a JWT dependency.
 *
 * Rules that are not negotiable:
 * - the algorithm comes from an allowlist and must match the key type;
 * - `alg: none` is rejected outright;
 * - issuer and audience are compared to server-configured values, never to
 *   values taken from the token;
 * - expiry and not-before are enforced with a small, explicit skew.
 *
 * A decoded token is not proof of anything. This module is the only place that
 * turns a token into claims.
 */

export interface JwtClaims {
  sub: string;
  tenantId: string | null;
  /** Supabase role claim. NOT a domain role. */
  supabaseRole: string | null;
  appMetadata: Record<string, unknown>;
  issuedAt: number;
  expiresAt: number;
}

export interface JwksDocument {
  keys: Array<Record<string, unknown> & { kid?: string; alg?: string; kty?: string }>;
}

export type KeyMaterial = { kind: "hmac"; secret: Buffer } | { kind: "public"; key: KeyObject };

export interface JwtVerifierOptions {
  issuer: string;
  audience: string;
  /** Resolve key material for a token header. Must never accept an algorithm change. */
  keyFor: (header: { alg: string; kid?: string }) => KeyMaterial | undefined | Promise<KeyMaterial | undefined>;
  now?: () => Date;
  clockSkewSeconds?: number;
}

const ALLOWED_ALGORITHMS = new Set(["RS256", "ES256", "HS256"]);

function decodeBase64Url(segment: string): Buffer {
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

function decodeJsonSegment(segment: string, label: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(decodeBase64Url(segment).toString("utf8")) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("not an object");
    return parsed as Record<string, unknown>;
  } catch {
    throw new DomainError("unauthenticated", `Malformed JWT ${label}.`);
  }
}

function verifySignature(
  signingInput: string,
  signature: Buffer,
  alg: string,
  material: KeyMaterial,
): boolean {
  if (alg === "HS256") {
    if (material.kind !== "hmac") return false;
    const expected = createHmac("sha256", material.secret).update(signingInput).digest();
    return expected.length === signature.length && timingSafeEqual(expected, signature);
  }
  if (material.kind !== "public") return false;
  const algorithm = alg === "RS256" ? "RSA-SHA256" : "SHA256";
  try {
    return cryptoVerify(algorithm, Buffer.from(signingInput, "utf8"), material.key, signature);
  } catch {
    return false;
  }
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Verify a token and return the claims we are willing to rely on.
 * Every failure mode maps to `unauthenticated`: the client learns nothing about
 * which check failed, and the audit trail records it separately.
 */
export async function verifyJwt(token: string, options: JwtVerifierOptions): Promise<JwtClaims> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new DomainError("unauthenticated", "Malformed JWT.");
  const [encodedHeader, encodedPayload, encodedSignature] = parts as [string, string, string];

  const header = decodeJsonSegment(encodedHeader, "header");
  const alg = readString(header, "alg");
  if (!alg || alg === "none" || !ALLOWED_ALGORITHMS.has(alg)) {
    throw new DomainError("unauthenticated", "Unsupported JWT algorithm.");
  }
  const kid = readString(header, "kid") ?? undefined;

  const material = await options.keyFor({ alg, ...(kid === undefined ? {} : { kid }) });
  if (!material) throw new DomainError("unauthenticated", "No key available for this token.");

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  if (!verifySignature(signingInput, decodeBase64Url(encodedSignature), alg, material)) {
    throw new DomainError("unauthenticated", "Invalid JWT signature.");
  }

  const payload = decodeJsonSegment(encodedPayload, "payload");
  const nowSeconds = Math.floor((options.now?.() ?? new Date()).getTime() / 1000);
  const skew = options.clockSkewSeconds ?? 30;

  if (readString(payload, "iss") !== options.issuer) {
    throw new DomainError("unauthenticated", "Unexpected JWT issuer.");
  }
  const audience = payload["aud"];
  const audiences = Array.isArray(audience) ? audience.filter((a): a is string => typeof a === "string") : [audience];
  if (!audiences.includes(options.audience)) {
    throw new DomainError("unauthenticated", "Unexpected JWT audience.");
  }

  const exp = payload["exp"];
  const nbf = payload["nbf"];
  if (typeof exp !== "number" || exp + skew <= nowSeconds) {
    throw new DomainError("unauthenticated", "Expired JWT.");
  }
  if (nbf !== undefined && (typeof nbf !== "number" || nbf - skew > nowSeconds)) {
    throw new DomainError("unauthenticated", "JWT is not valid yet.");
  }

  const sub = readString(payload, "sub");
  if (!sub) throw new DomainError("unauthenticated", "JWT without subject.");

  const appMetadataRaw = payload["app_metadata"];
  const appMetadata =
    typeof appMetadataRaw === "object" && appMetadataRaw !== null && !Array.isArray(appMetadataRaw)
      ? (appMetadataRaw as Record<string, unknown>)
      : {};

  const tenantClaim = readString(payload, "tenant_id") ?? readString(appMetadata, "tenant_id");
  const iat = typeof payload["iat"] === "number" ? (payload["iat"] as number) : 0;

  return {
    sub,
    tenantId: tenantClaim,
    supabaseRole: readString(payload, "role"),
    appMetadata,
    issuedAt: iat,
    expiresAt: exp,
  };
}

export interface JwksKeyProviderOptions {
  jwksUrl: string;
  fetchImpl?: typeof fetch;
  cacheTtlMs?: number;
  now?: () => Date;
}

/**
 * JWKS resolution with a bounded cache. The URL is configured by the server, so
 * a token can never redirect key lookup to an attacker-controlled `jku`.
 */
export function createJwksKeyProvider(options: JwksKeyProviderOptions): JwtVerifierOptions["keyFor"] {
  const fetchImpl = options.fetchImpl ?? fetch;
  const ttl = options.cacheTtlMs ?? 5 * 60_000;
  const now = options.now ?? (() => new Date());
  let cached: { keys: Map<string, KeyObject>; expiresAt: number } | null = null;

  async function load(): Promise<Map<string, KeyObject>> {
    const current = now().getTime();
    if (cached && cached.expiresAt > current) return cached.keys;
    const response = await fetchImpl(options.jwksUrl, { headers: { accept: "application/json" } });
    if (!response.ok) throw new DomainError("provider_unavailable", "JWKS endpoint unavailable.");
    const document = (await response.json()) as JwksDocument;
    if (!Array.isArray(document.keys)) throw new DomainError("provider_invalid_response", "Invalid JWKS document.");
    const keys = new Map<string, KeyObject>();
    for (const jwk of document.keys) {
      if (jwk.kty !== "RSA" && jwk.kty !== "EC") continue;
      try {
        keys.set(String(jwk.kid ?? jwk.alg ?? ""), createPublicKey({ key: jwk as never, format: "jwk" }));
      } catch {
        // A single malformed key must not poison the whole document.
      }
    }
    cached = { keys, expiresAt: current + ttl };
    return keys;
  }

  return async (header) => {
    if (header.alg === "HS256") return undefined;
    const keys = await load();
    const key = (header.kid !== undefined ? keys.get(header.kid) : undefined) ?? keys.values().next().value;
    return key ? { kind: "public", key } : undefined;
  };
}

export function createHmacKeyProvider(secret: string): JwtVerifierOptions["keyFor"] {
  const buffer = Buffer.from(secret, "utf8");
  return (header) => (header.alg === "HS256" ? { kind: "hmac", secret: buffer } : undefined);
}
