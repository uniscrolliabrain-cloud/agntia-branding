import { z } from "zod";
import type { BrandCapability } from "../contracts/capabilities.ts";

/**
 * Roles are domain roles, not Supabase roles. `role: "authenticated"` in a JWT
 * says nothing about whether someone may approve a brandbook.
 */
export const DOMAIN_ROLES = ["owner", "reviewer", "collaborator", "viewer"] as const;
export type DomainRole = (typeof DOMAIN_ROLES)[number];

export const resourceScopeSchema = z
  .object({
    resourceType: z.enum(["tenant", "work_order", "design_document", "asset", "token_set", "report"]),
    /** null means "resourceType is authorized tenant-wide". */
    resourceId: z.string().min(1).max(128).nullable(),
    /** Empty array = no field-level restriction inside that resource. */
    fields: z.array(z.string().min(1).max(64)).max(64),
  })
  .strict();

export type ResourceScope = z.infer<typeof resourceScopeSchema>;

/**
 * A Principal only exists after signature, issuer/audience, time window and
 * provisioned membership have all been checked. It is never built from a
 * client body, and never from `user_metadata`.
 */
export const principalSchema = z
  .object({
    userId: z.string().min(1).max(128),
    tenantId: z.string().min(1).max(128),
    membershipId: z.string().min(1).max(128),
    role: z.enum(DOMAIN_ROLES),
    scopes: z.array(resourceScopeSchema).max(64),
    capabilities: z.array(z.string().min(3).max(96)).max(128),
    verifiedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type Principal = z.infer<typeof principalSchema>;

export function principalHasCapability(principal: Principal, capability: string): boolean {
  return principal.capabilities.includes(capability);
}

/**
 * Resource scope is checked separately from identity. Being a collaborator in
 * tenant A does not grant access to a restricted project inside tenant A.
 */
export function isResourceInScope(
  principal: Principal,
  resourceType: ResourceScope["resourceType"],
  resourceId: string | null,
): boolean {
  return principal.scopes.some(
    (scope) =>
      scope.resourceType === resourceType &&
      (scope.resourceId === null || (resourceId !== null && scope.resourceId === resourceId)),
  );
}

/** Field-level scope: an empty `fields` list means "all fields". */
export function canReadField(principal: Principal, resourceType: ResourceScope["resourceType"], field: string): boolean {
  return principal.scopes.some(
    (scope) => scope.resourceType === resourceType && (scope.fields.length === 0 || scope.fields.includes(field)),
  );
}

export const ACTOR_KINDS = ["human", "agent"] as const;

/**
 * The canonical agent lives in the parent repository. This actor shape only
 * preserves the identifiers the parent issued; it does not create new ones.
 */
export const actorSchema = z
  .object({
    kind: z.enum(ACTOR_KINDS),
    actorId: z.string().min(1).max(128),
    tenantId: z.string().min(1).max(128),
    userId: z.string().min(1).max(128).nullable(),
    roleId: z.string().min(1).max(128).nullable(),
    runtimeId: z.string().min(1).max(128).nullable(),
    personaId: z.string().min(1).max(128).nullable(),
    kernelTurnId: z.string().min(1).max(128).nullable(),
  })
  .strict();

export type Actor = z.infer<typeof actorSchema>;

/** A name, an avatar or a persona never grants permission. */
export function actorFromPrincipal(principal: Principal): Actor {
  return {
    kind: "human",
    actorId: principal.userId,
    tenantId: principal.tenantId,
    userId: principal.userId,
    roleId: principal.role,
    runtimeId: null,
    personaId: null,
    kernelTurnId: null,
  };
}

export function capabilitiesForRole(role: DomainRole): BrandCapability[] {
  const all: BrandCapability[] = [
    "brand.brief.propose",
    "brand.research.preview",
    "brand.naming.propose",
    "brand.clearance.preview",
    "brand.voice.propose",
    "brand.concept.preview",
    "brand.rights.read",
    "brand.font.preview",
    "brand.document.update",
    "brand.penpot.preview",
    "brand.canvas.preview",
    "brand.logo.propose",
    "brand.palette.validate",
    "brand.tokens.preview",
    "brand.tokens.export",
    "brand.template.propose",
    "brand.layout.validate",
    "brand.design.preview",
    "brand.text.verify",
    "brand.quality.evaluate",
    "brand.brandbook.propose",
    "brand.export.preview",
    "brand.deliver.propose",
    "brand.learning.propose",
  ];
  switch (role) {
    case "owner":
      return all;
    case "reviewer":
      return all.filter((c) => !["brand.deliver.propose", "brand.learning.propose"].includes(c));
    case "collaborator":
      return all.filter(
        (c) => !["brand.tokens.export", "brand.deliver.propose", "brand.learning.propose"].includes(c),
      );
    case "viewer":
      return ["brand.rights.read", "brand.palette.validate", "brand.text.verify", "brand.quality.evaluate"];
  }
}
