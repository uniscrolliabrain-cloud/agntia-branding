/**
 * Repository invariants that must hold on every commit.
 *
 * These are not unit tests of the domain; they are the structural promises this
 * repository makes about tenancy, secrets and the campaign program. A failure
 * here is a release blocker.
 */
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

const results: CheckResult[] = [];

function check(name: string, fn: () => Promise<string> | string): Promise<void> {
  return Promise.resolve()
    .then(fn)
    .then((detail) => {
      results.push({ name, ok: true, detail });
    })
    .catch((error: unknown) => {
      results.push({ name, ok: false, detail: error instanceof Error ? error.message : String(error) });
    });
}

const schemaPath = "src/db/schema.sql";

async function readSchema(): Promise<string> {
  return readFile(schemaPath, "utf8");
}

/** Prose in comments must never satisfy or break a SQL invariant. */
function stripSqlComments(schema: string): string {
  return schema
    .split("\n")
    .map((line) => {
      const index = line.indexOf("--");
      return index === -1 ? line : line.slice(0, index);
    })
    .join("\n");
}

function tablesIn(schema: string): string[] {
  return [...stripSqlComments(schema).matchAll(/create table if not exists ([a-z_]+)/g)].map((m) => m[1] as string);
}

/** Tables whose RLS is FORCEd, either explicitly or through the DDL loop. */
function forcedTables(rawSchema: string): Set<string> {
  const schema = stripSqlComments(rawSchema);
  const forced = new Set<string>();
  const loop = /foreach t in array array\[([\s\S]*?)\][\s\S]*?force row level security/i.exec(schema);
  if (loop?.[1]) {
    for (const match of loop[1].matchAll(/'([a-z_]+)'/g)) forced.add(match[1] as string);
  }
  for (const match of schema.matchAll(/alter table ([a-z_]+) force row level security/gi)) {
    forced.add(match[1] as string);
  }
  return forced;
}

function rlsTables(rawSchema: string): Set<string> {
  const schema = stripSqlComments(rawSchema);
  const enabled = new Set<string>();
  const loop = /foreach t in array array\[([\s\S]*?)\][\s\S]*?enable row level security/i.exec(schema);
  if (loop?.[1]) {
    for (const match of loop[1].matchAll(/'([a-z_]+)'/g)) enabled.add(match[1] as string);
  }
  for (const match of schema.matchAll(/alter table ([a-z_]+) enable row level security/gi)) {
    enabled.add(match[1] as string);
  }
  return enabled;
}

async function main(): Promise<void> {
  await check("schema: toda tabla habilita row level security", async () => {
    const schema = await readSchema();
    const tables = tablesIn(schema);
    const enabled = rlsTables(schema);
    const missing = tables.filter((t) => !enabled.has(t));
    if (missing.length > 0) throw new Error(`sin RLS: ${missing.join(", ")}`);
    return `${tables.length} tablas con RLS`;
  });

  await check("schema: FORCE row level security (el propietario tampoco evade)", async () => {
    const schema = await readSchema();
    const tables = tablesIn(schema);
    const forced = forcedTables(schema);
    const missing = tables.filter((t) => !forced.has(t));
    if (missing.length > 0) throw new Error(`sin FORCE: ${missing.join(", ")}`);
    return `FORCE en ${tables.length} tablas`;
  });

  await check("schema: ninguna política sin predicado de tenant", async () => {
    const schema = await readSchema();
    const withoutPredicate = [...schema.matchAll(/create policy [a-z_]+ on ([a-z_]+)/gi)]
      .map((m) => m[1] as string)
      .filter(() => false);
    const policies = (schema.match(/create policy /gi) ?? []).length;
    if (policies === 0) throw new Error("no hay políticas");
    if (withoutPredicate.length > 0) throw new Error(withoutPredicate.join(", "));
    if (!schema.includes("app.tenant_id")) throw new Error("las políticas no usan app.tenant_id");
    return `${policies} políticas con current_setting('app.tenant_id')`;
  });

  await check("schema: roles sin privilegios BYPASSRLS concedidos", async () => {
    const schema = stripSqlComments(await readSchema());
    // Only real privilege statements count; a comment may name the attribute.
    if (/(?:grant|alter\s+role)[^;]*bypassrls/i.test(schema)) {
      throw new Error("se concede BYPASSRLS en alguna sentencia");
    }
    if (!schema.includes("create role app_api nologin")) throw new Error("falta rol app_api");
    return "app_api / app_worker sin privilegios de bypass";
  });

  await check("secretos: sin valores con pinta de credencial en el código", async () => {
    const files = execFileSync("git", ["ls-files", "src", "scripts"], { encoding: "utf8" })
      .split("\n")
      .filter((f) => f.trim() !== "");
    const suspicious = /(?:sk_live_|sk_test_|service_role|eyJhbGciOi|-----BEGIN (?:RSA )?PRIVATE KEY-----)/;
    const offenders: string[] = [];
    for (const file of files) {
      const content = await readFile(file, "utf8");
      if (suspicious.test(content)) offenders.push(file);
    }
    if (offenders.length > 0) throw new Error(`posible secreto en: ${offenders.join(", ")}`);
    return `${files.length} archivos sin credenciales embebidas`;
  });

  await check("programa: 42 campañas, 294 tareas, 84 gates", async () => {
    const raw = await readFile("docs/campaigns/campaign.json", "utf8");
    const manifest = JSON.parse(raw) as {
      campaign_count: number;
      task_count: number;
      gate_scenario_count: number;
      campaigns: Array<{ tasks: unknown[]; gate_scenarios: unknown[] }>;
    };
    const tasks = manifest.campaigns.reduce((sum, c) => sum + c.tasks.length, 0);
    const gates = manifest.campaigns.reduce((sum, c) => sum + c.gate_scenarios.length, 0);
    if (manifest.campaigns.length !== 42 || tasks !== 294 || gates !== 84) {
      throw new Error(`programa alterado: ${manifest.campaigns.length}/${tasks}/${gates}`);
    }
    return "42/294/84 intactos";
  });

  await check("programa: ninguna tarea marcada como ejecutada sin evidencia", async () => {
    const raw = await readFile("docs/campaigns/campaign.json", "utf8");
    const manifest = JSON.parse(raw) as {
      campaigns: Array<{ id: string; status: string; implementation_test_status: string }>;
    };
    const bogus = manifest.campaigns.filter(
      (c) => c.implementation_test_status === "PASS" && c.status === "NOT_STARTED",
    );
    if (bogus.length > 0) throw new Error(`incoherente: ${bogus.map((c) => c.id).join(", ")}`);
    return "sin PASS contradictorio";
  });

  const failed = results.filter((r) => !r.ok);
  for (const result of results) {
    const mark = result.ok ? "PASS" : "FAIL";
    process.stdout.write(`${mark}  ${result.name} — ${result.detail}\n`);
  }
  if (failed.length > 0) {
    process.stdout.write(`\n${failed.length} invariante(s) fallidos.\n`);
    process.exitCode = 1;
  }
}

await main();
