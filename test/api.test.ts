import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/api/app.ts";
import { TENANT_A, TENANT_B, USER_A, USER_B, authenticatorFor, futureToken, makeStore } from "./helpers.ts";

function build() {
  const store = makeStore();
  const app = createApp({ store, authenticate: authenticatorFor(store) });
  return { store, app };
}

function authHeaders(userId: string, tenantId: string): Record<string, string> {
  return {
    authorization: `Bearer ${futureToken({ sub: userId, tenant_id: tenantId })}`,
    "content-type": "application/json",
  };
}

const briefPayload = {
  capability: "brand.brief.propose",
  correlationId: "corr-api-0001",
  idempotencyKey: "idem-api-0001",
  dryRun: false,
  payload: {
    id: "brief_api_1",
    purpose: "new_brand",
    audienceDeclared: "equipos de producto en pymes",
    deliverables: ["identidad verbal", "logotipo", "tokens"],
    constraints: ["sin claims no verificados"],
    acceptance: ["aprobación del owner"],
    objective: "crear una marca clara y verificable",
    sources: ["brief:kickoff"],
  },
};

test("health responde sin autenticación", async () => {
  const { app } = build();
  const response = await app(new Request("http://local/health"));
  assert.equal(response.status, 200);
  const body = (await response.json()) as { status: string };
  assert.equal(body.status, "ok");
});

test("sin token la API responde 401 con envelope de error", async () => {
  const { app } = build();
  const response = await app(new Request("http://local/v1/branding/me"));
  assert.equal(response.status, 401);
  const body = (await response.json()) as { error: { code: string; correlationId: string } };
  assert.equal(body.error.code, "unauthenticated");
  assert.ok(body.error.correlationId.length > 0);
});

test("me devuelve principal y capacidades del rol", async () => {
  const { app } = build();
  const response = await app(
    new Request("http://local/v1/branding/me", { headers: authHeaders(USER_A, TENANT_A) }),
  );
  assert.equal(response.status, 200);
  const body = (await response.json()) as { tenantId: string; capabilities: string[] };
  assert.equal(body.tenantId, TENANT_A);
  assert.ok(body.capabilities.includes("brand.brief.propose"));
});

test("crear brief devuelve recurso y se puede leer", async () => {
  const { app } = build();
  const created = await app(
    new Request("http://local/v1/branding/proposals", {
      method: "POST",
      headers: authHeaders(USER_A, TENANT_A),
      body: JSON.stringify(briefPayload),
    }),
  );
  assert.equal(created.status, 201);
  const body = (await created.json()) as { resourceId: string; state: string };
  assert.equal(body.state, "brief_draft");

  const read = await app(
    new Request(`http://local/v1/branding/resources/${body.resourceId}`, { headers: authHeaders(USER_A, TENANT_A) }),
  );
  assert.equal(read.status, 200);
});

test("replay con la misma key no duplica el recurso", async () => {
  const { app, store } = build();
  const send = () =>
    app(
      new Request("http://local/v1/branding/proposals", {
        method: "POST",
        headers: authHeaders(USER_A, TENANT_A),
        body: JSON.stringify(briefPayload),
      }),
    );
  await send();
  const second = await send();
  assert.equal(second.status, 200);
  const body = (await second.json()) as { replayed?: boolean };
  assert.equal(body.replayed, true);
  assert.equal([...store.resources.values()].filter((r) => r.type === "brand_brief").length, 1);
});

test("el tenant B no puede leer un recurso del tenant A", async () => {
  const { app } = build();
  const created = await app(
    new Request("http://local/v1/branding/proposals", {
      method: "POST",
      headers: authHeaders(USER_A, TENANT_A),
      body: JSON.stringify(briefPayload),
    }),
  );
  const { resourceId } = (await created.json()) as { resourceId: string };

  const foreign = await app(
    new Request(`http://local/v1/branding/resources/${resourceId}`, { headers: authHeaders(USER_B, TENANT_B) }),
  );
  assert.equal(foreign.status, 404);

  const list = await app(new Request("http://local/v1/branding/resources", { headers: authHeaders(USER_B, TENANT_B) }));
  const body = (await list.json()) as { count: number };
  assert.equal(body.count, 0);
});

test("un cuerpo que intenta fijar el tenant se rechaza", async () => {
  const { app } = build();
  const response = await app(
    new Request("http://local/v1/branding/proposals", {
      method: "POST",
      headers: authHeaders(USER_A, TENANT_A),
      body: JSON.stringify({ ...briefPayload, tenantId: TENANT_B }),
    }),
  );
  assert.equal(response.status, 400);
  const body = (await response.json()) as { error: { code: string } };
  assert.equal(body.error.code, "invalid_input");
});

test("las capacidades de proveedor se declaran no configuradas, no simuladas", async () => {
  const { app } = build();
  const response = await app(
    new Request("http://local/v1/branding/integrations/penpot/capabilities", {
      headers: authHeaders(USER_A, TENANT_A),
    }),
  );
  assert.equal(response.status, 200);
  const body = (await response.json()) as { status: string; operations: string[] };
  assert.equal(body.status, "not_configured");
  assert.deepEqual(body.operations, []);
});

test("una ruta inexistente devuelve 404 normalizado", async () => {
  const { app } = build();
  const response = await app(new Request("http://local/v1/branding/execute-anything", { headers: authHeaders(USER_A, TENANT_A) }));
  assert.equal(response.status, 404);
});
