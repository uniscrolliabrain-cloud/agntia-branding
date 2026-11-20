import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import { Client } from "pg";

/**
 * RLS against a real PostgreSQL cluster.
 *
 * Until this file existed, row-level security was only *statically* verified:
 * the schema said ENABLE/FORCE ROW LEVEL SECURITY and the invariant scan checked
 * the text. That proves intent, not behaviour. Here the actual schema is applied
 * to a real server and the isolation is exercised with two tenants and with the
 * API and worker roles.
 *
 * Important and deliberate: `postgres` is a SUPERUSER, and a superuser bypasses
 * RLS even with FORCE. That is why production must never connect as a superuser
 * (or with `service_role`, which is the hosted equivalent of "trust me"): the
 * application roles below are the only ones that matter.
 */

const PORT = 55_432;
const DB = "branding_rls_test";
const TENANT_A = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "22222222-2222-4222-8222-222222222222";

const REQUIRE_DB = process.env["REQUIRE_DB"] === "1";

let cluster: EmbeddedPostgres | null = null;
let dataDir = "";
let startupError: Error | null = null;

async function applied(): Promise<void> {
  if (startupError !== null) throw startupError;
  if (!cluster) throw new Error("cluster not started");
}

before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "branding-pg-"));
  try {
    cluster = new EmbeddedPostgres({
      databaseDir: dataDir,
      port: PORT,
      user: "postgres",
      password: "postgres",
      persistent: false,
      autoRehydrateSymlinks: true,
      onLog: () => {},
      onError: () => {},
    });
    await cluster.initialise();
    await cluster.start();
    await cluster.createDatabase(DB);

    const admin = new Client({ host: "localhost", port: PORT, user: "postgres", password: "postgres", database: DB });
    await admin.connect();
    await admin.query(await readFile("src/db/schema.sql", "utf8"));
    await admin.query(await readFile("src/db/seed.sql", "utf8"));
    await admin.end();
  } catch (error) {
    startupError = error instanceof Error ? error : new Error(String(error));
  }
});

after(async () => {
  try {
    if (cluster) await cluster.stop();
  } catch {
    // El cluster ya puede estar parado; no ocultar el resultado de los tests.
  }
  if (dataDir !== "") await rm(dataDir, { recursive: true, force: true });
});

interface Session {
  query: (text: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
  end: () => Promise<void>;
}

/** Open a connection, optionally switching to an application role and tenant. */
async function session(role: "postgres" | "app_api" | "app_worker", tenantId?: string): Promise<Session> {
  await applied();
  const client = new Client({ host: "localhost", port: PORT, user: "postgres", password: "postgres", database: DB });
  await client.connect();
  if (role !== "postgres") await client.query(`set role ${role}`);
  if (tenantId !== undefined) await client.query("select set_config('app.tenant_id', $1, false)", [tenantId]);
  return {
    query: async (text, values) => {
      const result = await client.query(text, values as never);
      return { rows: result.rows as Record<string, unknown>[], rowCount: result.rowCount };
    },
    end: async () => {
      await client.end();
    },
  };
}

function insertBrief(tenantId: string, id: string): [string, string[]] {
  return [
    `insert into brand_briefs (tenant_id, id, version, state, payload) values ($1, $2, 0, 'brief_draft', '{}'::jsonb)`,
    [tenantId, id],
  ];
}

test("cada tenant solo ve sus propios briefs con el rol de API", async (t) => {
  if (startupError !== null && !REQUIRE_DB) {
    t.skip(`NOT_VERIFIED: no se pudo arrancar Postgres (${startupError.message})`);
    return;
  }
  const a = await session("app_api", TENANT_A);
  const b = await session("app_api", TENANT_B);
  try {
    await a.query(...insertBrief(TENANT_A, "aaaaaaaa-0000-4000-8000-000000000001"));
    await b.query(...insertBrief(TENANT_B, "bbbbbbbb-0000-4000-8000-000000000001"));

    const rowsA = await a.query("select tenant_id from brand_briefs");
    const rowsB = await b.query("select tenant_id from brand_briefs");

    assert.equal(rowsA.rows.length, 1, "A debe ver exactamente su brief");
    assert.equal(rowsB.rows.length, 1, "B debe ver exactamente su brief");
    assert.equal(rowsA.rows[0]?.["tenant_id"], TENANT_A);
    assert.equal(rowsB.rows[0]?.["tenant_id"], TENANT_B);
  } finally {
    await a.end();
    await b.end();
  }
});

test("escribir con el tenant de otro se rechaza por WITH CHECK", async (t) => {
  if (startupError !== null && !REQUIRE_DB) {
    t.skip(`NOT_VERIFIED: ${startupError.message}`);
    return;
  }
  const a = await session("app_api", TENANT_A);
  try {
    await assert.rejects(
      () => a.query(...insertBrief(TENANT_B, "bbbbbbbb-0000-4000-8000-000000000002")),
      (error: unknown) => {
        const code = (error as { code?: string }).code;
        assert.equal(code, "42501", `esperaba violación de RLS, recibí ${String(code)}`);
        return true;
      },
    );
  } finally {
    await a.end();
  }
});

test("sin tenant en sesión no se ve ninguna fila (fail-closed)", async (t) => {
  if (startupError !== null && !REQUIRE_DB) {
    t.skip(`NOT_VERIFIED: ${startupError.message}`);
    return;
  }
  const anonymous = await session("app_api");
  try {
    const rows = await anonymous.query("select id from brand_briefs");
    assert.equal(rows.rows.length, 0);
  } finally {
    await anonymous.end();
  }
});

test("un tenant no puede leer documentos ni aprobaciones de otro", async (t) => {
  if (startupError !== null && !REQUIRE_DB) {
    t.skip(`NOT_VERIFIED: ${startupError.message}`);
    return;
  }
  const writer = await session("postgres");
  const a = await session("app_api", TENANT_A);
  const b = await session("app_api", TENANT_B);
  try {
    await writer.query(
      `insert into design_documents (tenant_id, id, version, state, document, document_hash, font_hash)
       values ($1, 'dddddddd-0000-4000-8000-000000000002', 0, 'in_design', '{}'::jsonb, 'h', 'f')`,
      [TENANT_B],
    );
    await writer.query(
      `insert into approvals (tenant_id, id, resource_type, resource_id, reviewer_id, reviewer_role, payload_hash,
        resource_version, rights_hash, policy_hash, channel, cost_ceiling, currency, expires_at)
       values ($1, 'eeeeeeee-0000-4000-8000-000000000002', 'design_document', 'dddddddd-0000-4000-8000-000000000002',
        'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'owner', 'p', 0, 'r', 'pol', 'portal', 0, 'EUR', now() + interval '1 day')`,
      [TENANT_B],
    );

    const docs = await a.query("select id from design_documents");
    const approvals = await a.query("select id from approvals");
    assert.equal(docs.rows.length, 0, "A no debe ver documentos de B");
    assert.equal(approvals.rows.length, 0, "A no debe ver aprobaciones de B");

    const docsB = await b.query("select id from design_documents");
    assert.equal(docsB.rows.length, 1);
  } finally {
    await writer.end();
    await a.end();
    await b.end();
  }
});

test("el worker puede leer pero no borrar historia", async (t) => {
  if (startupError !== null && !REQUIRE_DB) {
    t.skip(`NOT_VERIFIED: ${startupError.message}`);
    return;
  }
  const worker = await session("app_worker", TENANT_A);
  try {
    const rows = await worker.query("select id from brand_briefs");
    assert.ok(rows.rows.length >= 1);
    await assert.rejects(
      () => worker.query("delete from brand_briefs"),
      (error: unknown) => {
        const code = (error as { code?: string }).code;
        assert.equal(code, "42501", `el worker no debe poder borrar (recibí ${String(code)})`);
        return true;
      },
    );
  } finally {
    await worker.end();
  }
});

test("el rol de API no puede tocar la tabla de tenants de otro", async (t) => {
  if (startupError !== null && !REQUIRE_DB) {
    t.skip(`NOT_VERIFIED: ${startupError.message}`);
    return;
  }
  const a = await session("app_api", TENANT_A);
  try {
    const rows = await a.query("select id from tenants");
    assert.equal(rows.rows.length, 1, "solo debe verse el propio tenant");
    assert.equal(rows.rows[0]?.["id"], TENANT_A);
  } finally {
    await a.end();
  }
});

test("la FK compuesta impide enlazar un documento con datos de otro tenant", async (t) => {
  if (startupError !== null && !REQUIRE_DB) {
    t.skip(`NOT_VERIFIED: ${startupError.message}`);
    return;
  }
  const writer = await session("postgres");
  try {
    await assert.rejects(
      () =>
        writer.query(
          `insert into document_versions (tenant_id, document_id, version, document_hash, render_hash)
           values ($1, 'dddddddd-0000-4000-8000-000000000002', 0, 'h', 'r')`,
          [TENANT_A],
        ),
      (error: unknown) => {
        const code = (error as { code?: string }).code;
        assert.equal(code, "23503", `esperaba violación de FK compuesta (recibí ${String(code)})`);
        return true;
      },
    );
  } finally {
    await writer.end();
  }
});
