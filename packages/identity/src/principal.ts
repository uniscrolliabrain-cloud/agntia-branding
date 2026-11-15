import { ApiError, IsoDateTime, MoneySchema, opaqueId } from "@agntia/contracts";
import { z } from "zod";
import type { JwtClaims } from "./jwt.ts";

/* ------------------------------------------------------------------ *
 * Membership provisionada (nunca user_metadata)
 * ------------------------------------------------------------------ */

export const MEMBERSHIP_STATUSES = ["active", "invited", "suspended", "revoked"] as const;
export const PrincipalRoleSchema = z.enum(["owner", "brand_reviewer", "legal_reviewer", "collaborator", "viewer", "service"]);
export type PrincipalRole = z.infer<typeof PrincipalRoleSchema>;

export const MembershipSchema = z
  .object({
    tenantId: opaqueId,
    userId: opaqueId,
    role: PrincipalRoleSchema,
    status: z.enum(MEMBERSHIP_STATUSES),
    scopes: z.array(z.string().min(1).max(120)).default([]),
    provisionedAt: IsoDateTime,
  })
  .strict();

export type Membership = z.infer<typeof MembershipSchema>;

export interface Principal {
  userId: string;
  kind: "human" | "agent" | "service";
  tenantId: string;
  role: PrincipalRole;
  scopes: string[];
  runtimeId?: string;
  personaId?: string;
  roleId?: string;
}

function signedTenantClaim(claims: JwtClaims): string | null {
  const appMetadataTenant = claims.app_metadata?.tenant_id;
  if (typeof appMetadataTenant === "string") return appMetadataTenant;
  const direct = (claims as Record<string, unknown>).tenant_id;
  return typeof direct === "string" ? direct : null;
}

/**
 * `user_metadata` is user-editable and is ignored on purpose. Authorization
 * comes from a signed tenant claim plus a provisioned, active membership.
 * There is no default tenant and no owner fallback.
 */
export function resolvePrincipal(input: {
  claims: JwtClaims;
  memberships: Membership[];
  kind?: Principal["kind"];
  runtime?: { runtimeId: string; roleId: string; personaId?: string };
}): Principal {
  const { claims, memberships } = input;
  const tenantId = signedTenantClaim(claims);
  if (!tenantId) throw new ApiError("forbidden", "token carries no signed tenant claim");

  const membership = memberships.find((m) => m.userId === claims.sub && m.tenantId === tenantId);
  if (!membership) throw new ApiError("forbidden", "no provisioned membership for this tenant");
  if (membership.status === "suspended" || membership.status === "revoked") {
    throw new ApiError("forbidden", `membership is ${membership.status}`);
  }

  return {
    userId: claims.sub,
    kind: input.kind ?? "human",
    tenantId,
    role: membership.role,
    scopes: membership.scopes,
    ...(input.runtime ? { runtimeId: input.runtime.runtimeId, roleId: input.runtime.roleId, personaId: input.runtime.personaId } : {}),
  };
}

/** Membership of another tenant never applies, even if the names match. */
export function assertMembershipBelongsTo(principal: Principal, tenantId: string): void {
  if (principal.tenantId !== tenantId) throw new ApiError("forbidden", "principal does not act on this tenant");
}

/* ------------------------------------------------------------------ *
 * ACL por recurso y campo (deny-by-default)
 * ------------------------------------------------------------------ */

export const ResourceAclSchema = z
  .object({
    tenantId: opaqueId,
    resourceId: opaqueId,
    grants: z
      .array(
        z
          .object({
            principalId: opaqueId,
            role: PrincipalRoleSchema,
            capabilities: z.array(z.string().min(1).max(120)).min(1),
            fields: z.array(z.string().min(1).max(120)).nullable().default(null),
          })
          .strict(),
      )
      .default([]),
    publicShare: z.boolean().default(false),
  })
  .strict();

export type ResourceAcl = z.infer<typeof ResourceAclSchema>;

export function assertResourceAccess(
  principal: Principal,
  acl: ResourceAcl,
  request: { resourceId: string; capability: string; field?: string | null },
): void {
  if (acl.tenantId !== principal.tenantId) throw new ApiError("not_found", "resource not found in this scope");
  if (acl.resourceId !== request.resourceId) throw new ApiError("not_found", "resource not found in this scope");

  const grant = acl.grants.find((g) => g.principalId === principal.userId);
  if (!grant) throw new ApiError("forbidden", "no grant for this resource");

  const effective = new Set([...grant.capabilities, ...principal.scopes]);
  if (!effective.has(request.capability)) {
    throw new ApiError("forbidden", `capability ${request.capability} not granted on this resource`);
  }
  if (request.field && grant.fields && !grant.fields.includes(request.field)) {
    throw new ApiError("forbidden", `field ${request.field} not granted on this resource`);
  }
}

/* ------------------------------------------------------------------ *
 * C04 · Twin vinculado y mandato acotado
 * ------------------------------------------------------------------ */

export const TwinBindingSchema = z
  .object({
    twinBindingId: opaqueId,
    canonicalRuntimeId: z.string().min(1).max(120),
    canonicalRoleId: z.string().min(1).max(120),
    personaId: z.string().min(1).max(120).nullable(),
    instanceId: z.string().min(1).max(120),
    targetTenantId: opaqueId,
    workOrderId: opaqueId,
    capabilities: z.array(z.string().min(1).max(120)).min(1),
    purpose: z.string().min(3).max(200),
    issuedAt: IsoDateTime,
    expiresAt: IsoDateTime,
    revocationVersion: z.number().int().min(0),
    proofRef: z.string().min(1).max(300),
  })
  .strict();

export type TwinBinding = z.infer<typeof TwinBindingSchema>;

export const DelegationMandateSchema = z
  .object({
    mandateId: opaqueId,
    originatingActorId: opaqueId,
    originatingTenantId: opaqueId,
    targetTenantId: opaqueId,
    workOrderId: opaqueId,
    twinBindingId: opaqueId,
    capabilities: z.array(z.string().min(1).max(120)).min(1),
    purpose: z.string().min(3).max(200),
    budget: MoneySchema,
    issuedAt: IsoDateTime,
    expiresAt: IsoDateTime,
    revocationVersion: z.number().int().min(0),
    proofRef: z.string().min(1).max(300),
  })
  .strict();

export type DelegationMandate = z.infer<typeof DelegationMandateSchema>;

/**
 * A worker revalidates the mandate on every job. Source actor/tenant and the
 * target data scope stay separate; the mandate never widens itself.
 */
export function assertMandateValid(
  mandate: DelegationMandate,
  request: {
    now: Date;
    targetTenantId: string;
    capability: string;
    currentRevocationVersion: number;
    originatingTenantId?: string;
  },
): void {
  if (mandate.targetTenantId !== request.targetTenantId) {
    throw new ApiError("forbidden", "mandate targets another tenant");
  }
  if (request.originatingTenantId && mandate.originatingTenantId !== request.originatingTenantId) {
    throw new ApiError("forbidden", "originating tenant mismatch");
  }
  if (new Date(mandate.expiresAt).getTime() <= request.now.getTime()) {
    throw new ApiError("forbidden", "delegation mandate expired");
  }
  if (request.currentRevocationVersion > mandate.revocationVersion) {
    throw new ApiError("forbidden", "delegation mandate revoked");
  }
  if (!mandate.capabilities.includes(request.capability)) {
    throw new ApiError("forbidden", `capability ${request.capability} outside the mandate`);
  }
}

/** A twin is a scoped specialization, never a second sovereign identity. */
export function assertTwinDoesNotInventAuthority(twin: TwinBinding, mandate: DelegationMandate): void {
  if (twin.twinBindingId !== mandate.twinBindingId) {
    throw new ApiError("forbidden", "twin binding does not match the mandate");
  }
  const excess = twin.capabilities.filter((c) => !mandate.capabilities.includes(c));
  if (excess.length > 0) {
    throw new ApiError("forbidden", `twin claims capabilities not delegated: ${excess.join(",")}`);
  }
}
