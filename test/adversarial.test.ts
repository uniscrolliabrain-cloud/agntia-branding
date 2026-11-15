import { test } from "node:test";
import assert from "node:assert/strict";
import { DomainError } from "../src/contracts/errors.ts";
import { safeFetchText, assertOperationVerified, notConfigured, capabilityReportSchema } from "../src/adapters/index.ts";
import { assertNoIdentitySupplied } from "../src/contracts/envelope.ts";
import { assertNotModelInvokable, getCapability, MODEL_TOOLS } from "../src/contracts/capabilities.ts";
import { redact } from "../src/obs/redaction.ts";
import { buildAdtcEvent, assertNoInlinePayload } from "../src/obs/adtc.ts";
import { toSystemEvent } from "../src/obs/events.ts";

const allowlist = ["example.test"];

test("SSRF: http plano se rechaza", async () => {
  await assert.rejects(
    () => safeFetchText("http://example.test/page", { allowedHosts: allowlist }),
    (error: unknown) => error instanceof DomainError && error.code === "policy_violation",
  );
});

test("SSRF: localhost y direcciones privadas se rechazan", async () => {
  for (const host of ["localhost", "127.0.0.1", "10.0.0.1", "169.254.169.254", "192.168.1.10"]) {
    await assert.rejects(
      () => safeFetchText(`https://${host}/meta`, { allowedHosts: [host] }),
      (error: unknown) => error instanceof DomainError && error.code === "policy_violation",
      `debería rechazar ${host}`,
    );
  }
});

test("SSRF: host fuera de la allowlist se rechaza antes de la red", async () => {
  await assert.rejects(
    () => safeFetchText("https://evil.test/page", { allowedHosts: allowlist }),
    (error: unknown) => error instanceof DomainError && error.code === "policy_violation",
  );
});

test("SSRF: redirección a otro host se valida de nuevo y se corta", async () => {
  const fakeFetch = (async () =>
    new Response(null, { status: 302, headers: { location: "https://evil.test/x" } })) as unknown as typeof fetch;
  await assert.rejects(
    () => safeFetchText("https://example.test/page", { allowedHosts: allowlist, fetchImpl: fakeFetch }),
    (error: unknown) => error instanceof DomainError && error.code === "policy_violation",
  );
});

test("SSRF: contenido binario se rechaza", async () => {
  const fakeFetch = (async () =>
    new Response("binary", { status: 200, headers: { "content-type": "application/octet-stream" } })) as unknown as typeof fetch;
  await assert.rejects(
    () => safeFetchText("https://example.test/file", { allowedHosts: allowlist, fetchImpl: fakeFetch }),
    (error: unknown) => error instanceof DomainError,
  );
});

test("un informe de capacidad no verificado impide invocar operaciones", () => {
  const report = notConfigured("penpot");
  assert.equal(capabilityReportSchema.safeParse(report).success, true);
  assert.throws(
    () => assertOperationVerified(report, "file.read"),
    (error: unknown) => error instanceof DomainError && error.code === "unsupported_capability",
  );
});

test("el cliente no puede inyectar identidad en el cuerpo", () => {
  assert.throws(() => assertNoIdentitySupplied({ tenantId: "x" }));
  assert.throws(() => assertNoIdentitySupplied({ actorId: "x" }));
  assertNoIdentitySupplied({ capability: "brand.brief.propose" });
});

test("las capacidades de efecto con aprobación no son invocables por el modelo", () => {
  assert.throws(
    () => assertNotModelInvokable("brand.deliver.propose"),
    (error: unknown) => error instanceof DomainError && error.code === "policy_violation",
  );
  assert.equal(MODEL_TOOLS.length, 7);
  assert.ok(getCapability("brand.brandbook.propose"));
  assert.equal(getCapability("brand.execute.anything"), undefined);
});

test("la redacción elimina credenciales y contenido", () => {
  const output = redact({
    token: "abc",
    authorization: "Bearer x",
    payload: { secret: 1 },
    brief: "contenido del cliente",
    tenantId: "t-1",
    status: "ok",
    count: 3,
  });
  assert.equal(output["token"], "[redacted]");
  assert.equal(output["authorization"], "[redacted]");
  assert.equal(output["payload"], "[redacted]");
  assert.equal(output["brief"], "[redacted]");
  assert.equal(output["tenantId"], "t-1");
  assert.equal(output["count"], 3);
});

test("ADTC no transporta payloads y rechaza sobres con contenido", () => {
  const event = buildAdtcEvent({
    eventType: "branding.proposal.created",
    tenantId: "t-1",
    actorId: "u-1",
    correlationId: "corr-0001",
    resourceRefs: ["brief:1"],
  });
  assert.equal(event.schemaVersion, "adtc/0.1");
  assert.doesNotThrow(() => assertNoInlinePayload(event));
});

test("no se proyecta un éxito al padre sin receipt", () => {
  const event = buildAdtcEvent({
    eventType: "branding.operation.confirmed",
    tenantId: "t-1",
    actorId: "u-1",
    correlationId: "corr-0001",
  });
  assert.throws(() => toSystemEvent({ event, hasReceipt: false, ownerRef: "owner-1" }));
  const projected = toSystemEvent({ event, hasReceipt: true, ownerRef: "owner-1" });
  assert.equal(projected.schemaVersion, "1.0");
  assert.equal(projected.type, "branding.operation.confirmed");
});
