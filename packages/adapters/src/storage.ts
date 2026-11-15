import { createHmac, timingSafeEqual } from "node:crypto";
import { ApiError, opaqueId } from "@agntia/contracts";

export interface SignedUrlClaims {
  tenantId: string;
  assetHash: string;
  expiresAt: number;
  resourceScope: string;
}

function encode(claims: SignedUrlClaims, secret: string): string {
  const body = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

/**
 * Storage links are tenant-scoped capabilities with an expiry. A leaked URL
 * from tenant A never grants access to tenant B.
 */
export function signDownloadUrl(input: {
  tenantId: string;
  assetHash: string;
  resourceScope: string;
  ttlSeconds: number;
  secret: string;
  now: Date;
}): string {
  if (input.ttlSeconds <= 0 || input.ttlSeconds > 3600) throw new ApiError("invalid_input", "ttl out of range");
  return encode(
    {
      tenantId: input.tenantId,
      assetHash: input.assetHash,
      expiresAt: input.now.getTime() + input.ttlSeconds * 1000,
      resourceScope: input.resourceScope,
    },
    input.secret,
  );
}

export function verifyDownloadUrl(token: string, input: { secret: string; now: Date; tenantId: string }): SignedUrlClaims {
  const [body, signature] = token.split(".");
  if (!body || !signature) throw new ApiError("forbidden", "malformed storage link");
  const expected = createHmac("sha256", input.secret).update(body).digest();
  const provided = Buffer.from(signature, "base64url");
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    throw new ApiError("forbidden", "invalid storage link signature");
  }
  const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SignedUrlClaims;
  if (claims.expiresAt <= input.now.getTime()) throw new ApiError("forbidden", "storage link expired");
  if (claims.tenantId !== input.tenantId) throw new ApiError("forbidden", "storage link belongs to another tenant");
  return claims;
}

export const StorageKeySchema = opaqueId;

/** Keys are namespaced per tenant so a bucket listing cannot cross tenants. */
export function storageKey(tenantId: string, assetHash: string): string {
  return `${tenantId}/assets/${assetHash}`;
}
