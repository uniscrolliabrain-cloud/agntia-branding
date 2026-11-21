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
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export interface SqlCommandOptions {
  databaseUrl?: string | null;
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
}

/**
 * The SQL lives next to the module when running from source and inside dist/db
 * in an installed package. Both locations are checked, in that order.
 */
function resolveSql(file: string): string | null {
  const candidates = [join(here, file), join(here, "..", "..", "src", "db", file)];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export function runMigrate(options: SqlCommandOptions = {}): number {
  const out = options.stdout ?? ((line: string) => process.stdout.write(line));
  const err = options.stderr ?? ((line: string) => process.stderr.write(line));
  const databaseUrl = options.databaseUrl ?? process.env["DATABASE_URL"] ?? null;

  if (!databaseUrl) {
    err("NOT_CONFIGURED: DATABASE_URL is not set; no migration was applied.\n");
    return 2;
  }

  const sql = resolveSql("schema.sql");
  if (sql === null) {
    err("MIGRATION_FAILED: schema.sql is missing from this installation.\n");
    return 1;
  }

  try {
    execFileSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-f", sql], {
      stdio: "inherit",
      env: { ...process.env, PGCONNECT_TIMEOUT: "10" },
    });
    out("MIGRATED: schema.sql applied.\n");
    return 0;
  } catch {
    // psql already wrote its diagnostic; do not echo the DSN.
    err("MIGRATION_FAILED: see psql output above.\n");
    return 1;
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runMigrate());
}
