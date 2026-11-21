import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/api/app.ts";
import { startServer } from "../src/server.ts";
import { authenticatorFor, futureToken, makeStore, TENANT_A, USER_A } from "./helpers.ts";

test("el servidor Node habla el contrato Fetch: health, 401 y 404", async (t) => {
  const store = makeStore();
  const app = createApp({ store, authenticate: authenticatorFor(store) });
  const running = await startServer({ handle: app, host: "127.0.0.1", port: 0 });
  t.after(() => running.close());

  assert.equal(running.port > 0, true);
  assert.match(running.url, /^http:\/\/127\.0\.0\.1:\d+$/);

  const health = await fetch(`${running.url}/health`);
  assert.equal(health.status, 200);
  const healthBody = (await health.json()) as { status: string };
  assert.equal(healthBody.status, "ok");
  assert.equal(health.headers.get("cache-control"), "no-store");

  const anonymous = await fetch(`${running.url}/v1/branding/me`);
  assert.equal(anonymous.status, 401);
  const anonymousBody = (await anonymous.json()) as { error: { code: string; correlationId: string } };
  assert.equal(anonymousBody.error.code, "unauthenticated");
  assert.ok(anonymousBody.error.correlationId.length > 0);

  const missing = await fetch(`${running.url}/v1/branding/nope`, {
    headers: { authorization: `Bearer ${futureToken({ sub: USER_A, tenant_id: TENANT_A })}` },
  });
  assert.equal(missing.status, 404);
});

test("el adaptador corta el cuerpo antes de que llegue al dominio", async (t) => {
  const store = makeStore();
  const app = createApp({ store, authenticate: authenticatorFor(store) });
  const running = await startServer({ handle: app, host: "127.0.0.1", port: 0, maxBodyBytes: 32 });
  t.after(() => running.close());

  const response = await fetch(`${running.url}/v1/branding/proposals`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${futureToken({ sub: USER_A, tenant_id: TENANT_A })}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ capability: "brand.brief.propose", padding: "x".repeat(256) }),
  });

  assert.equal(response.status, 400);
  const body = (await response.json()) as { error: { code: string } };
  assert.equal(body.error.code, "invalid_input");
});
