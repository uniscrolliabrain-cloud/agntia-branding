import { test } from "node:test";
import assert from "node:assert/strict";
import { DomainError } from "../src/contracts/errors.ts";
import { contentHash } from "../src/contracts/evidence.ts";
import { beginIntent, completeIntent, markOutcomeUnknown } from "../src/runtime/idempotency.ts";
import { deadLetteredEvents, dispatchPending, pendingEvents, publishEvent } from "../src/runtime/outbox.ts";
import { reserve, setCeiling, settle } from "../src/cost/budget.ts";
import { makeStore, TENANT_A } from "./helpers.ts";

const base = {
  tenantId: TENANT_A,
  capability: "brand.deliver.propose",
  idempotencyKey: "idem-abcdef01",
  payloadHash: contentHash({ deliverable: "pack-1" }),
};

test("replay idéntico devuelve el resultado sin duplicar", () => {
  const store = makeStore();
  const first = beginIntent(store, base);
  assert.equal(first.kind, "started");
  completeIntent(store, base, { receiptId: "r1" });
  const replay = beginIntent(store, base);
  assert.equal(replay.kind, "replay");
  if (replay.kind === "replay") assert.equal(replay.result["receiptId"], "r1");
});

test("misma key con contenido distinto produce conflicto", () => {
  const store = makeStore();
  beginIntent(store, base);
  assert.throws(
    () => beginIntent(store, { ...base, payloadHash: contentHash({ deliverable: "other" }) }),
    (error: unknown) => error instanceof DomainError && error.code === "idempotency_conflict",
  );
});

test("outcome desconocido bloquea el reintento ciego", () => {
  const store = makeStore();
  beginIntent(store, base);
  markOutcomeUnknown(store, base, "timeout después de aceptar");
  assert.throws(
    () => beginIntent(store, base),
    (error: unknown) => error instanceof DomainError && error.code === "provider_timeout",
  );
});

test("el outbox deduplica por domainEventId y solo confirma con ACK", async () => {
  const store = makeStore();
  publishEvent(store, { tenantId: TENANT_A, eventType: "branding.operation.confirmed", domainEventId: "evt-1", payload: {} });
  publishEvent(store, { tenantId: TENANT_A, eventType: "branding.operation.confirmed", domainEventId: "evt-1", payload: {} });
  assert.equal(store.outbox.length, 1);

  const noAck = await dispatchPending(store, { deliver: async () => ({ acknowledged: false }) });
  assert.equal(noAck.delivered, 0);
  assert.equal(pendingEvents(store).length, 1);

  const ack = await dispatchPending(store, { deliver: async () => ({ acknowledged: true, receiptId: "r-1" }) });
  assert.equal(ack.delivered, 1);
  assert.ok(store.outbox[0]?.acknowledgedAt !== null);
  assert.equal(pendingEvents(store).length, 0);
});

test("un fallo de transporte no pierde el evento", async () => {
  const store = makeStore();
  publishEvent(store, { tenantId: TENANT_A, eventType: "branding.resource.changed", domainEventId: "evt-2", payload: {} });
  await dispatchPending(store, {
    deliver: async () => {
      throw new Error("network down");
    },
  });
  assert.equal(store.outbox[0]?.attempts, 1);
  assert.equal(pendingEvents(store).length, 1);
});

test("tras el máximo de intentos el evento va a dead-letter", async () => {
  const store = makeStore();
  publishEvent(store, { tenantId: TENANT_A, eventType: "branding.resource.changed", domainEventId: "evt-3", payload: {} });
  for (let i = 0; i < 6; i += 1) {
    await dispatchPending(store, {
      deliver: async () => {
        throw new Error("still down");
      },
    });
  }
  assert.equal(pendingEvents(store).length, 0);
  assert.equal(deadLetteredEvents(store).length, 1);
});

test("el presupuesto no permite sobregasto concurrente", () => {
  const store = makeStore();
  setCeiling(store, TENANT_A, "EUR", "10.00");
  reserve(store, TENANT_A, "EUR", "6.00");
  assert.throws(
    () => reserve(store, TENANT_A, "EUR", "6.00"),
    (error: unknown) => error instanceof DomainError && error.code === "budget_exhausted",
  );
  reserve(store, TENANT_A, "EUR", "4.00");
  settle(store, TENANT_A, "EUR", "4.00", "3.50");
  const budget = store.budgets.get(TENANT_A);
  assert.ok(budget);
  assert.equal(budget.consumed, "3.50");
  assert.equal(budget.reserved, "6.00");
});

test("sin presupuesto configurado no hay gasto posible", () => {
  const store = makeStore();
  assert.throws(
    () => reserve(store, TENANT_A, "EUR", "1.00"),
    (error: unknown) => error instanceof DomainError && error.code === "budget_exhausted",
  );
});
