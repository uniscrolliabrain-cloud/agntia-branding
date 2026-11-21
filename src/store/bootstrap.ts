import { readFileSync } from "node:fs";
import { z } from "zod";
import { DOMAIN_ROLES, resourceScopeSchema } from "../auth/principal.ts";
import { DomainError } from "../contracts/errors.ts";
import type { Membership } from "./memory-store.ts";

/**
 * Local membership fixtures.
 *
 * This is NOT a provisioning system: it exists so a developer can run the
 * service against the in-memory store with the synthetic tenants the tests use.
 * Production refuses it (see config.ts) and real memberships are provisioned by
 * the parent repository.
 */
export const membershipFixtureSchema = z
  .object({
    id: z.string().min(1).max(128),
    userId: z.string().min(1).max(128),
    tenantId: z.string().min(1).max(128),
    role: z.enum(DOMAIN_ROLES),
    status: z.enum(["active", "suspended"]),
    scopes: z.array(resourceScopeSchema).max(64),
  })
  .strict();

export const membershipFixtureFileSchema = z
  .object({ memberships: z.array(membershipFixtureSchema).min(1).max(128) })
  .strict();

export function loadMembershipFixtures(path: string): Membership[] {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    throw new DomainError("invalid_input", "The membership fixture file cannot be read.", {
      details: { path },
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new DomainError("invalid_input", "The membership fixture file is not valid JSON.", { details: { path } });
  }

  const result = membershipFixtureFileSchema.safeParse(parsed);
  if (!result.success) {
    throw new DomainError("invalid_input", "The membership fixture file does not match the schema.", {
      details: { path, issues: result.error.issues.length },
    });
  }
  return result.data.memberships;
}
