import { createHmac, createPublicKey, timingSafeEqual, verify as cryptoVerify, type KeyObject } from "node:crypto";
import { ApiError, IsoDateTime, opaqueId } from "@agntia/contracts";
import { z } from "zod";

/* ------------------------------------------------------------------ *
 * C03 · Supabase JWT
 * ------------------------------------------------------------------ */

export const JWT_ALGORITHMS = ["RS256", "ES256"] as const;
export type JwtAlgorithm = (typeof JWT_ALGORITHMS)[number];

export const JwkSchema = z
  .object({
    kty: z.string().min(1),
    kid: z.string().min(1),
    alg: z.string().optional(),
    use: z.string().optional(),
    n: z.string().optional(),
    e: z.string().optional(),
    crv: z.string().optional(),
    x: z.string().optional(),
    y: z.string().optional(),
  })
  .passthrough();

export const JwksSchema = z.object({ keys: z.array(JwkSchema).min(1) }).strict();

export interface JwtClaims {
  sub: string;
  iss: string;
  aud: string | string[];
  exp: number;
  iat: number;
  nbf?: number;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface JwtVerifierConfig {
  /** Fixed, server-side issuer. Never taken from the token. */
  issuer: string;
  /** Expected audience of the Supabase project. */
  audience: string;
  /** Fixed JWKS endpoint configured by the server, not by the caller. */
  jwksUrl: string;
  allowedAlgorithms?: JwtAlgorithm[];
  clockSkewSeconds?: number;
  jwksCacheSeconds?: number;
  /** Legacy Supabase HS256 secret; only if explicitly configured. */
  legacyHs256Secret?: string;
  fetchJwks?: (url: string) => Promise<unknown>;
}

interface DecodedToken {
  header: { alg?: string; kid?: string; typ?: string };
  payload: JwtClaims;
  signingInput: string;
  signature: Buffer;
}

function base64UrlDecode(input: string): Buffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

function decodeToken(token: string): DecodedToken {
  const parts = token.split(".");
  if (parts.length !== 3) throw new ApiError("unauthenticated", "malformed token");
  const [headerPart, payloadPart, signaturePart] = parts as [string, string, string];
  let header: DecodedToken["header"];
  let payload: JwtClaims;
  try {
    header = JSON.parse(base64UrlDecode(headerPart).toString("utf8"));
    payload = JSON.parse(base64UrlDecode(payloadPart).toString("utf8"));
  } catch {
    throw new ApiError("unauthenticated", "malformed token encoding");
  }
  if (typeof payload !== "object" || payload === null) throw new ApiError("unauthenticated", "malformed claims");
  return {
    header,
    payload,
    signingInput: `${headerPart}.${payloadPart}`,
    signature: base64UrlDecode(signaturePart),
  };
}

function hashFor(alg: JwtAlgorithm): string {
  return "sha256";
}

function verifySignature(alg: JwtAlgorithm, key: KeyObject | string, signingInput: string, signature: Buffer): boolean {
  if (alg === "RS256" || alg === "ES256") {
    if (typeof key === "string") throw new Error("asymmetric key required");
    return cryptoVerify(hashFor(alg), Buffer.from(signingInput), { key }, signature);
  }
  if (typeof key !== "string") throw new Error("hmac secret required");
  const expected = createHmac("sha256", key).update(signingInput).digest();
  return expected.length === signature.length && timingSafeEqual(expected, signature);
}

function objectToKeyObject(jwk: z.infer<typeof JwkSchema>): KeyObject {
  return createPublicKey({ key: jwk as unknown as import("node:crypto").JsonWebKey, format: "jwk" });
}

/**
 * Verifies signature, algorithm, issuer, audience and temporal claims.
 * A decoded JWT is not proof; `role: authenticated` is not ownership.
 */
export class SupabaseJwtVerifier {
  private cache: { fetchedAt: number; keys: Map<string, KeyObject> } | null = null;

  constructor(private readonly config: JwtVerifierConfig) {}

  private algorithms(): JwtAlgorithm[] {
    return this.config.allowedAlgorithms ?? ["RS256", "ES256"];
  }

  private async jwksKeys(): Promise<Map<string, KeyObject>> {
    const ttl = (this.config.jwksCacheSeconds ?? 300) * 1000;
    if (this.cache && Date.now() - this.cache.fetchedAt < ttl) return this.cache.keys;
    const fetcher = this.config.fetchJwks ?? (async (url: string) => {
      const response = await fetch(url, { headers: { accept: "application/json" } });
      if (!response.ok) throw new ApiError("unauthenticated", "jwks unavailable", { retryable: true });
      return response.json();
    });
    const raw = await fetcher(this.config.jwksUrl);
    const parsed = JwksSchema.parse(raw);
    const keys = new Map<string, KeyObject>();
    for (const jwk of parsed.keys) {
      keys.set(jwk.kid, objectToKeyObject(jwk));
    }
    this.cache = { fetchedAt: Date.now(), keys };
    return keys;
  }

  async verify(token: string, now = new Date()): Promise<JwtClaims> {
    if (!token || token.length > 8192) throw new ApiError("unauthenticated", "missing token");
    const decoded = decodeToken(token);
    const rawAlg = decoded.header.alg;
    if (!rawAlg || rawAlg === "none" || !(this.algorithms() as readonly string[]).includes(rawAlg)) {
      throw new ApiError("unauthenticated", `algorithm not allowed: ${String(rawAlg)}`);
    }
    const alg = rawAlg as JwtAlgorithm;

    let key: KeyObject | string;
    if (alg === "RS256" || alg === "ES256") {
      if (!decoded.header.kid) throw new ApiError("unauthenticated", "token has no key id");
      const keys = await this.jwksKeys();
      const selected = keys.get(decoded.header.kid);
      if (!selected) throw new ApiError("unauthenticated", "unknown signing key");
      key = selected;
    } else {
      if (!this.config.legacyHs256Secret) throw new ApiError("unauthenticated", "legacy algorithm not configured");
      key = this.config.legacyHs256Secret;
    }

    if (!verifySignature(alg, key, decoded.signingInput, decoded.signature)) {
      throw new ApiError("unauthenticated", "invalid signature");
    }

    const claims = decoded.payload;
    const skew = (this.config.clockSkewSeconds ?? 30) * 1000;
    const nowMs = now.getTime();

    if (claims.iss !== this.config.issuer) throw new ApiError("unauthenticated", "issuer mismatch");
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audiences.includes(this.config.audience)) throw new ApiError("unauthenticated", "audience mismatch");
    if (typeof claims.exp !== "number" || claims.exp * 1000 <= nowMs - skew) {
      throw new ApiError("unauthenticated", "token expired");
    }
    if (typeof claims.nbf === "number" && claims.nbf * 1000 > nowMs + skew) {
      throw new ApiError("unauthenticated", "token not yet valid");
    }
    if (typeof claims.iat === "number" && claims.iat * 1000 > nowMs + skew) {
      throw new ApiError("unauthenticated", "token issued in the future");
    }
    if (typeof claims.sub !== "string" || !opaqueId.safeParse(claims.sub).success) {
      throw new ApiError("unauthenticated", "invalid subject");
    }
    return claims;
  }
}

export const SupabaseClaimsSchema = z
  .object({
    sub: opaqueId,
    iss: z.string().min(1),
    aud: z.union([z.string(), z.array(z.string())]),
    exp: z.number(),
    iat: z.number(),
    nbf: z.number().optional(),
    app_metadata: z.record(z.unknown()).optional(),
    user_metadata: z.record(z.unknown()).optional(),
  })
  .passthrough();

export { IsoDateTime };
