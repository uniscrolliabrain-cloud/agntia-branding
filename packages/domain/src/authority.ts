import { ApiError, opaqueId, conflict, forbidden } from "@agntia/contracts";
import { z } from "zod";

/**
 * Duplicated functionality is allowed across Agntia services; duplicated
 * *authority* is not. A single executor is declared per effect (and optionally
 * per field) inside a work order.
 */
export const RESPONSIBLE_SYSTEMS = [
  "branding",
  "agente",
  "diseno",
  "marketing",
  "redes",
  "video",
  "clientes",
  "legal",
  "ciberseguridad",
] as const;

export const ResponsibleSchema = z.enum(RESPONSIBLE_SYSTEMS);
export type ResponsibleSystem = z.infer<typeof ResponsibleSchema>;

export const AuthorityClaimSchema = z
  .object({
    effect: z.string().min(3).max(120),
    field: z.string().min(1).max(120).nullable().default(null),
    responsible: ResponsibleSchema,
  })
  .strict();

export type AuthorityClaim = z.infer<typeof AuthorityClaimSchema>;

export const AuthorityMapSchema = z
  .object({
    workOrderId: opaqueId,
    tenantId: opaqueId,
    claims: z.array(AuthorityClaimSchema).min(1),
  })
  .strict();

export type AuthorityMap = z.infer<typeof AuthorityMapSchema>;

export interface AuthorityResolution {
  responsible: ResponsibleSystem;
  effect: string;
  field: string | null;
}

/** Field-level claim wins over effect-level; duplicate distinct owners block. */
export function resolveAuthority(
  map: AuthorityMap,
  query: { effect: string; field?: string | null },
): AuthorityResolution {
  const field = query.field ?? null;
  const fieldClaims = map.claims.filter((c) => c.effect === query.effect && c.field === field);
  const candidates = fieldClaims.length > 0 ? fieldClaims : map.claims.filter((c) => c.effect === query.effect && c.field === null);

  if (candidates.length === 0) {
    throw forbidden(`no authority declared for effect ${query.effect}${field ? ` on ${field}` : ""}`);
  }
  const owners = new Set(candidates.map((c) => c.responsible));
  if (owners.size > 1) {
    throw conflict(`ambiguous authority for effect ${query.effect}: ${[...owners].sort().join(",")}`);
  }
  const responsible = candidates[0]!.responsible;
  return { responsible, effect: query.effect, field };
}

export function assertAuthorityIs(
  map: AuthorityMap,
  query: { effect: string; field?: string | null },
  expected: ResponsibleSystem,
): AuthorityResolution {
  const resolution = resolveAuthority(map, query);
  if (resolution.responsible !== expected) {
    throw forbidden(`effect ${query.effect} is owned by ${resolution.responsible}, not ${expected}`);
  }
  return resolution;
}

export function buildAuthorityMap(input: {
  workOrderId: string;
  tenantId: string;
  claims: AuthorityClaim[];
}): AuthorityMap {
  return AuthorityMapSchema.parse(input);
}

export { ApiError };
