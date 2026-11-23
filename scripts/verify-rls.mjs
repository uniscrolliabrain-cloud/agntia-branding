#!/usr/bin/env node
// Verificación de las políticas RLS de packages/persistence/migrations/0001_init.sql
// contra un Postgres real embebido (PGlite = Postgres compilado a WASM).
//
// Uso:
//   npm i --no-save @electric-sql/pglite
//   node scripts/verify-rls.mjs
//
// Comprueba aislamiento por tenant con claims firmados (mismo GUC que Supabase:
// request.jwt.claims), append-only de auditoría, permisos de rol y FK compuestas.
// Sale con código 1 si alguna aserción falla.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const specifier = process.env.PGLITE_SPECIFIER ?? "@electric-sql/pglite";
let PGlite;
try {
  ({ PGlite } = await import(specifier));
} catch {
  console.error(
    `No se encontró PGlite en "${specifier}". Instálalo con: npm i --no-save @electric-sql/pglite\n` +
      `o apunta a una copia existente con PGLITE_SPECIFIER=/ruta/a/@electric-sql/pglite/dist/index.js`,
  );
  process.exit(2);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATION = readFileSync(join(root, "packages/persistence/migrations/0001_init.sql"), "utf8");

const db = new PGlite();
const results = [];
let extensionSkipped = false;

const q = (sql, params) => db.query(sql, params);

async function expectOk(name, fn) {
  try {
    results.push({ name, ok: true, detail: (await fn()) ?? "" });
  } catch (e) {
    results.push({ name, ok: false, detail: `inesperado: ${e.message.split("\n")[0]}` });
  }
}

async function expectFail(name, fn, matcher) {
  try {
    await fn();
    results.push({ name, ok: false, detail: "no falló (debía fallar)" });
  } catch (e) {
    const msg = e.message.split("\n")[0];
    results.push({ name, ok: matcher.test(e.message), detail: matcher.test(e.message) ? msg : `mensaje distinto: ${msg}` });
  }
}

try {
  await db.exec(MIGRATION);
} catch (e) {
  if (/pgcrypto/.test(e.message)) {
    extensionSkipped = true;
    await db.exec(MIGRATION.replace(/create extension if not exists "pgcrypto";/, ""));
  } else {
    console.error("MIGRACIÓN FALLÓ:", e.message);
    process.exit(1);
  }
}
console.log(
  `migración aplicada${extensionSkipped ? " (sin pgcrypto: gen_random_uuid es nativo desde PG13)" : " (completa)"}`,
);

await q(
  `insert into branding.tenants (tenant_id, display_name) values ('tenant_aaaa','A'), ('tenant_bbbb','B')`,
);
await q(`insert into branding.resources (tenant_id, resource_id, kind, payload, updated_by) values
  ('tenant_aaaa','res_a','brand_document','{"n":1}','u_a'),
  ('tenant_bbbb','res_b','brand_document','{"n":2}','u_b')`);
await q(`insert into branding.audit_log (tenant_id, actor_id, action, payload_hash, correlation_id)
  values ('tenant_aaaa','u_a','create','h','c1'), ('tenant_bbbb','u_b','create','h','c2')`);

async function asTenant(role, claims, fn) {
  await q(`set role ${role}`);
  await q(`select set_config('request.jwt.claims', $1, false)`, [claims]);
  try {
    return await fn();
  } finally {
    await q(`reset role`);
    await q(`select set_config('request.jwt.claims', '', false)`);
  }
}

const claimsA = JSON.stringify({ tenant_id: "tenant_aaaa", role: "authenticated" });
const claimsB = JSON.stringify({ tenant_id: "tenant_bbbb", role: "authenticated" });

await expectOk("A sólo ve recursos de A", async () => {
  const r = await asTenant("branding_api", claimsA, () =>
    q(`select resource_id from branding.resources order by resource_id`),
  );
  const seen = r.rows.map((x) => x.resource_id).join(",");
  if (seen !== "res_a") throw new Error(`vio: ${seen}`);
  return `vio ${seen}`;
});

await expectOk("B sólo ve recursos de B", async () => {
  const r = await asTenant("branding_api", claimsB, () =>
    q(`select resource_id from branding.resources order by resource_id`),
  );
  const seen = r.rows.map((x) => x.resource_id).join(",");
  if (seen !== "res_b") throw new Error(`vio: ${seen}`);
  return `vio ${seen}`;
});

await expectOk("sin claims no ve nada", async () => {
  const r = await asTenant("branding_api", "", () =>
    q(`select count(*)::int as n from branding.resources`),
  );
  if (r.rows[0].n !== 0) throw new Error(`vio ${r.rows[0].n}`);
  return "0 filas";
});

await expectOk("claims en app_metadata también autorizan", async () => {
  const r = await asTenant("branding_api", JSON.stringify({ app_metadata: { tenant_id: "tenant_aaaa" } }), () =>
    q(`select resource_id from branding.resources`),
  );
  if (r.rows.length !== 1 || r.rows[0].resource_id !== "res_a") throw new Error("sin aislamiento por app_metadata");
  return "res_a";
});

await expectFail(
  "A no puede insertar para B",
  () =>
    asTenant("branding_api", claimsA, () =>
      q(`insert into branding.resources (tenant_id, resource_id, kind, payload, updated_by)
         values ('tenant_bbbb','res_x','brand_document','{}','u_a')`),
    ),
  /row-level security|violates/i,
);

// RLS oculta la fila de B: el UPDATE no lanza error, afecta a 0 filas y no altera nada.
await expectOk("A no puede actualizar la fila de B (0 filas, sin efecto)", async () => {
  const r = await asTenant("branding_api", claimsA, () =>
    q(`update branding.resources set payload='{"hacked":true}' where tenant_id='tenant_bbbb'`),
  );
  const affected = r.affectedRows ?? 0;
  const b = await q(`select payload from branding.resources where resource_id='res_b'`);
  if (affected !== 0) throw new Error(`afectó ${affected} filas`);
  if (JSON.stringify(b.rows[0].payload) !== '{"n":2}') throw new Error("payload de B alterado");
  return `${affected} filas, B intacto`;
});

await expectOk("UPDATE de A afecta sólo a A", async () => {
  await asTenant("branding_api", claimsA, () =>
    q(`update branding.resources set payload='{"n":9}' where resource_id='res_a'`),
  );
  const a = await q(`select payload from branding.resources where resource_id='res_a'`);
  const b = await q(`select payload from branding.resources where resource_id='res_b'`);
  if (a.rows[0].payload.n !== 9) throw new Error("no actualizó A");
  if (b.rows[0].payload.n !== 2) throw new Error("alteró la fila de B");
  return "A cambiado, B intacto";
});

await expectFail(
  "audit_log es append-only (no UPDATE)",
  () => asTenant("branding_api", claimsA, () => q(`update branding.audit_log set action='x'`)),
  /permission denied|append-only/i,
);

await expectFail(
  "audit_log es append-only (no DELETE)",
  () => asTenant("branding_api", claimsA, () => q(`delete from branding.audit_log`)),
  /permission denied|append-only/i,
);

await expectFail(
  "worker no puede UPDATE resources",
  () => asTenant("branding_worker", claimsA, () => q(`update branding.resources set payload='{}'`)),
  /permission denied/i,
);

await expectFail(
  "worker no puede escribir revisions",
  () =>
    asTenant("branding_worker", claimsA, () =>
      q(`insert into branding.resource_revisions (tenant_id,resource_id,version,payload,payload_hash,created_by)
         values ('tenant_aaaa','res_a',1,'{}','h','u')`),
    ),
  /permission denied/i,
);

await expectFail(
  "FK compuesta impide revisión cross-tenant",
  () =>
    asTenant("branding_api", claimsA, () =>
      q(`insert into branding.resource_revisions (tenant_id,resource_id,version,payload,payload_hash,created_by)
         values ('tenant_bbbb','res_b',1,'{}','h','u')`),
    ),
  /row-level security|foreign key|permission denied/i,
);

await expectFail(
  "inbox no es legible por branding_api",
  () => asTenant("branding_api", claimsA, () => q(`select * from branding.inbox`)),
  /permission denied|row-level security/i,
);

// 5. FORCE RLS: un owner no-superusuario tampoco escapa del aislamiento.
await q(`do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'branding_owner') then
    create role branding_owner nologin;
  end if;
end $$;`);
await q(`alter table branding.resources owner to branding_owner`);
// El owner real (postgres en Supabase) ya tiene USAGE; aquí se simula ese rol.
await q(`grant usage on schema branding to branding_owner`);

await expectOk("owner no-superusuario sólo ve su tenant (FORCE RLS)", async () => {
  const r = await asTenant("branding_owner", claimsA, () =>
    q(`select resource_id from branding.resources order by resource_id`),
  );
  const seen = r.rows.map((x) => x.resource_id).join(",");
  if (seen !== "res_a") throw new Error(`vio: ${seen}`);
  return `vio ${seen}`;
});

await expectOk("owner no-superusuario sin claims no ve nada", async () => {
  const r = await asTenant("branding_owner", "", () =>
    q(`select count(*)::int as n from branding.resources`),
  );
  if (r.rows[0].n !== 0) throw new Error(`vio ${r.rows[0].n}`);
  return "0 filas";
});

const ownerView = await q(`select count(*)::int as n from branding.resources`);
const force = await q(
  `select relname, relforcerowsecurity from pg_class
   where relname in ('resources','audit_log','approvals','outbox','memberships') order by relname`,
);

for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} · ${r.name} — ${r.detail}`);
console.log(`\nsuperusuario ve ${ownerView.rows[0].n} recursos de 2 tenants (bypass del motor, inevitable)`);
console.log(`force RLS: ${force.rows.map((r) => `${r.relname}=${r.relforcerowsecurity}`).join(" ")}`);

const failed = results.filter((r) => !r.ok).length;
console.log(`\nRESUMEN ${results.length - failed}/${results.length} PASS`);
process.exit(failed === 0 ? 0 : 1);
