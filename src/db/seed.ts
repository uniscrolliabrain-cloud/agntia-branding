/**
 * Seed runner for the synthetic two-tenant fixtures.
 *
 * Deterministic UUIDs, no real client data. Requires DATABASE_URL; without it
 * the process reports NOT_CONFIGURED rather than inventing state.
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

function resolveSql(file: string): string | null {
  const candidates = [join(here, file), join(here, "..", "..", "src", "db", file)];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export function runSeed(options: SqlCommandOptions = {}): number {
  const out = options.stdout ?? ((line: string) => process.stdout.write(line));
  const err = options.stderr ?? ((line: string) => process.stderr.write(line));
  const databaseUrl = options.databaseUrl ?? process.env["DATABASE_URL"] ?? null;

  if (!databaseUrl) {
    err("NOT_CONFIGURED: DATABASE_URL is not set; fixtures were not seeded.\n");
    return 2;
  }

  const sql = resolveSql("seed.sql");
  if (sql === null) {
    err("SEED_FAILED: seed.sql is missing from this installation.\n");
    return 1;
  }

  try {
    execFileSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-f", sql], {
      stdio: "inherit",
      env: { ...process.env, PGCONNECT_TIMEOUT: "10" },
    });
    out("SEEDED: tenants A/B/P with synthetic fixtures.\n");
    return 0;
  } catch {
    err("SEED_FAILED: see psql output above.\n");
    return 1;
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runSeed());
}
