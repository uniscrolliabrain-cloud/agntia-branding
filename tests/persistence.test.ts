import { describe, expect, it } from "vitest";
import { AuditLog, IdempotencyStore, Inbox, Outbox, ResourceStore } from "@agntia/persistence";
import { TENANT_A, TENANT_B } from "./helpers.ts";

describe("C06 · ResourceStore", () => {
  it("aísla por tenant y no revela existencia ajena", () => {
    const store = new ResourceStore();
    store.put({ tenantId: TENANT_A, resourceId: "res_brand_a", payload: { v: 1 }, expectedVersion: null, actorId: "user_owner_a", now: new Date() });
    expect(store.get(TENANT_A, "res_brand_a")).toMatchObject({ version: 1 });
    expect(() => store.get(TENANT_B, "res_brand_a")).toThrowError(/not found/);
    expect(store.list(TENANT_B)).toHaveLength(0);
  });

  it("exige CAS en actualizaciones y evita duplicados al crear", () => {
    const store = new ResourceStore();
    const first = store.put({ tenantId: TENANT_A, resourceId: "res_brand_a", payload: { v: 1 }, expectedVersion: null, actorId: "u", now: new Date() });
    const second = store.put({ tenantId: TENANT_A, resourceId: "res_brand_a", payload: { v: 2 }, expectedVersion: first.version, actorId: "u", now: new Date() });
    expect(second.version).toBe(2);
    expect(() =>
      store.put({ tenantId: TENANT_A, resourceId: "res_brand_a", payload: { v: 3 }, expectedVersion: 1, actorId: "u", now: new Date() }),
    ).toThrowError(/version mismatch/);
    expect(() =>
      store.put({ tenantId: TENANT_A, resourceId: "res_brand_a", payload: { v: 4 }, expectedVersion: null, actorId: "u", now: new Date() }),
    ).toThrowError(/already exists/);
  });
});

describe("C06 · Audit, outbox e inbox", () => {
  it("el audit es append-only y guarda hash, no el payload", () => {
    const audit = new AuditLog();
    const entry = audit.append({ tenantId: TENANT_A, actorId: "u", action: "brief.proposed", resourceId: "res_brand_a", payload: { secretish: "x" }, correlationId: "cor_1", now: new Date() });
    expect(entry.payloadHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(audit.all())).not.toContain("secretish");
    expect(audit.forTenant(TENANT_B)).toHaveLength(0);
  });

  it("outbox entrega tras commit y marca receipt", () => {
    const outbox = new Outbox();
    outbox.enqueue({ eventId: "event_0001", tenantId: TENANT_A, type: "branding.operation.confirmed", payload: { ok: true }, now: new Date() });
    expect(outbox.pending(TENANT_A)).toHaveLength(1);
    const delivered = outbox.markDelivered("event_0001", new Date());
    expect(delivered.deliveredAt).not.toBeNull();
    expect(outbox.pending(TENANT_A)).toHaveLength(0);
  });

  it("inbox deduplica el mismo evento", () => {
    const inbox = new Inbox();
    expect(inbox.receive("consumer_1", "event_0001")).toEqual({ duplicate: false });
    expect(inbox.receive("consumer_1", "event_0001")).toEqual({ duplicate: true });
  });
});

describe("C06 · Idempotencia", () => {
  it("replay devuelve resultado y payload distinto colisiona", () => {
    const store = new IdempotencyStore();
    const first = store.begin({ tenantId: TENANT_A, operationKey: "op_key_1", payload: { a: 1 }, now: new Date() });
    expect(first.status).toBe("started");
    store.complete(TENANT_A, "op_key_1", { receipt: "r1" });
    expect(store.begin({ tenantId: TENANT_A, operationKey: "op_key_1", payload: { a: 1 }, now: new Date() })).toMatchObject({ status: "replay" });
    expect(() =>
      store.begin({ tenantId: TENANT_A, operationKey: "op_key_1", payload: { a: 2 }, now: new Date() }),
    ).toThrowError(/different payload/);
  });

  it("no duplica un efecto en curso", () => {
    const store = new IdempotencyStore();
    store.begin({ tenantId: TENANT_A, operationKey: "op_key_2", payload: { a: 1 }, now: new Date() });
    expect(() => store.begin({ tenantId: TENANT_A, operationKey: "op_key_2", payload: { a: 1 }, now: new Date() })).toThrowError(/in progress/);
  });
});
