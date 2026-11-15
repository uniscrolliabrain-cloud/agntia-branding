import { capabilitiesForRole, principalSchema, type Principal } from "./principal.ts";
import type { JwtClaims, JwtVerifierOptions } from "./jwt.ts";
import { verifyJwt } from "./jwt.ts";
import { DomainError } from "../contracts/errors.ts";
import type { MemoryStore } from "../store/memory-store.ts";

/**
 * Authentication = verified token + provisioned membership.
 *
 * A valid signature alone is not authorization: without an active membership in
 * the tenant the request stops here. There is no default tenant, no owner
 * fallback and no reading of `user_metadata`.
 */
export interface AuthenticatorOptions {
  jwt: JwtVerifierOptions;
  store: MemoryStore;
  now?: () => Date;
}

export interface AuthenticatedRequest {
  principal: Principal;
  claims: JwtClaims;
}

export function createAuthenticator(options: AuthenticatorOptions) {
  const now = options.now ?? (() => new Date());

  return async function authenticate(token: string | null): Promise<AuthenticatedRequest> {
    if (!token) throw new DomainError("unauthenticated", "Missing bearer token.");
    const claims = await verifyJwt(token, options.jwt);

    // The token's tenant claim selects which membership applies; it never
    // grants one. If the claim is absent we still require a provisioned row.
    const membership = options.store.findMembership(claims.tenantId, claims.sub);
    if (!membership) {
      throw new DomainError("membership_missing", "No provisioned membership for this user.");
    }
    if (membership.status !== "active") {
      throw new DomainError("membership_missing", "Membership is suspended.");
    }
    if (claims.tenantId !== null && claims.tenantId !== membership.tenantId) {
      throw new DomainError("scope_forbidden", "Token tenant does not match the provisioned membership.");
    }

    const principal = principalSchema.parse({
      userId: claims.sub,
      tenantId: membership.tenantId,
      membershipId: membership.id,
      role: membership.role,
      scopes: membership.scopes,
      capabilities: capabilitiesForRole(membership.role),
      verifiedAt: now().toISOString(),
    });

    return { principal, claims };
  };
}
