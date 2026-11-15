/**
 * Seed runner for the synthetic two-tenant fixtures.
 *
 * Deterministic UUIDs, no real client data. Requires DATABASE_URL; without it
 * the process reports NOT_CONFIGURED rather than inventing state.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

function main(): number {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) {
    process.stderr.write("NOT_CONFIGURED: DATABASE_URL is not set; fixtures were not seeded.\n");
    return 2;
  }
  try {
    execFileSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-f", join(here, "seed.sql")], {
      stdio: "inherit",
      env: { ...process.env, PGCONNECT_TIMEOUT: "10" },
    });
    process.stdout.write("SEEDED: tenants A/B/P with synthetic fixtures.\n");
    return 0;
  } catch {
    process.stderr.write("SEED_FAILED: see psql output above.\n");
    return 1;
  }
}

process.exit(main());
