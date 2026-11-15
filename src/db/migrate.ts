/**
 * Migration runner.
 *
 * The schema is applied with `psql` so the repository needs no database driver
 * and the exact SQL a DBA reviews is the SQL that runs. When DATABASE_URL is
 * absent this exits with NOT_CONFIGURED instead of pretending success: the whole
 * service is designed to fail closed, and migrations are no exception.
 *
 * The connection string is never printed: it contains credentials.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

function main(): number {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) {
    process.stderr.write("NOT_CONFIGURED: DATABASE_URL is not set; no migration was applied.\n");
    return 2;
  }

  try {
    execFileSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-f", join(here, "schema.sql")], {
      stdio: "inherit",
      env: { ...process.env, PGCONNECT_TIMEOUT: "10" },
    });
    process.stdout.write("MIGRATED: src/db/schema.sql applied.\n");
    return 0;
  } catch {
    // psql already wrote its diagnostic; do not echo the DSN.
    process.stderr.write("MIGRATION_FAILED: see psql output above.\n");
    return 1;
  }
}

process.exit(main());
