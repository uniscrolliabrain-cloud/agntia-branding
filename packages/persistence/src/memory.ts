import { ApiError, canonicalJson, conflict, notFound, opaqueId, sha256Hex } from "@agntia/contracts";

export interface StoredResource<T = unknown> {
  tenantId: string;
  resourceId: string;
  version: number;
  payload: T;
  updatedAt: string;
  updatedBy: string;
}

/**
 * Tenant-scoped resource repository with compare-and-swap. A resource that
 * belongs to another tenant is reported as not found, never as forbidden,
 * so existence does not leak across tenants.
 */
export class ResourceStore {
  private readonly rows = new Map<string, StoredResource>();

  private key(tenantId: string, resourceId: string): string {
    return `${tenantId}::${resourceId}`;
  }

  get<T>(tenantId: string, resourceId: string): StoredResource<T> {
    const row = this.rows.get(this.key(tenantId, resourceId));
    if (!row) throw notFound("resource not found in this scope");
    return row as StoredResource<T>;
  }

  list<T>(tenantId: string): StoredResource<T>[] {
    return [...this.rows.values()].filter((row) => row.tenantId === tenantId) as StoredResource<T>[];
  }

  put<T>(input: {
    tenantId: string;
    resourceId: string;
    payload: T;
    expectedVersion: number | null;
    actorId: string;
    now: Date;
  }): StoredResource<T> {
    const key = this.key(input.tenantId, input.resourceId);
    const existing = this.rows.get(key);
    const currentVersion = existing?.version ?? 0;

    if (input.expectedVersion === null && existing) {
      throw conflict("resource already exists; expectedVersion is required for updates");
    }
    if (input.expectedVersion !== null && input.expectedVersion !== currentVersion) {
      throw conflict(`version mismatch: expected ${input.expectedVersion}, found ${currentVersion}`);
    }

    const row: StoredResource<T> = {
      tenantId: input.tenantId,
      resourceId: input.resourceId,
      version: currentVersion + 1,
      payload: input.payload,
      updatedAt: input.now.toISOString(),
      updatedBy: input.actorId,
    };
    this.rows.set(key, row as StoredResource);
    return row;
  }
}

export interface AuditEntry {
  entryId: string;
  tenantId: string;
  actorId: string;
  action: string;
  resourceId: string | null;
  payloadHash: string;
  at: string;
  correlationId: string;
}

/** Append-only audit log. There is no update or delete operation. */
export class AuditLog {
  private readonly entries: AuditEntry[] = [];

  append(input: Omit<AuditEntry, "entryId" | "at" | "payloadHash"> & { payload: unknown; now: Date }): AuditEntry {
    const entry: AuditEntry = {
      entryId: `aud_${sha256Hex({ ...input, payload: undefined, t: input.now.toISOString() }).slice(0, 24)}`,
      tenantId: input.tenantId,
      actorId: input.actorId,
      action: input.action,
      resourceId: input.resourceId,
      payloadHash: sha256Hex(input.payload),
      at: input.now.toISOString(),
      correlationId: input.correlationId,
    };
    this.entries.push(entry);
    return entry;
  }

  forTenant(tenantId: string): AuditEntry[] {
    return this.entries.filter((entry) => entry.tenantId === tenantId);
  }

  all(): readonly AuditEntry[] {
    return this.entries;
  }
}

export interface OutboxEvent {
  eventId: string;
  tenantId: string;
  type: string;
  payload: unknown;
  createdAt: string;
  deliveredAt: string | null;
  attempts: number;
}

/** Local commit + outbox is atomic; remote HTTP is a separate transaction. */
export class Outbox {
  private readonly events = new Map<string, OutboxEvent>();

  enqueue(input: { eventId: string; tenantId: string; type: string; payload: unknown; now: Date }): OutboxEvent {
    if (this.events.has(input.eventId)) throw conflict("event already enqueued");
    const event: OutboxEvent = {
      eventId: input.eventId,
      tenantId: input.tenantId,
      type: input.type,
      payload: input.payload,
      createdAt: input.now.toISOString(),
      deliveredAt: null,
      attempts: 0,
    };
    this.events.set(input.eventId, event);
    return event;
  }

  pending(tenantId: string): OutboxEvent[] {
    return [...this.events.values()].filter((e) => e.tenantId === tenantId && e.deliveredAt === null);
  }

  markDelivered(eventId: string, now: Date): OutboxEvent {
    const event = this.events.get(eventId);
    if (!event) throw notFound("unknown outbox event");
    const updated = { ...event, deliveredAt: now.toISOString(), attempts: event.attempts + 1 };
    this.events.set(eventId, updated);
    return updated;
  }
}

/** Durable inbox dedupe: the same domain event is processed once. */
export class Inbox {
  private readonly seen = new Set<string>();

  receive(consumerId: string, eventId: string): { duplicate: boolean } {
    const key = `${consumerId}::${eventId}`;
    if (this.seen.has(key)) return { duplicate: true };
    this.seen.add(key);
    return { duplicate: false };
  }
}

export interface IdempotentRecord {
  key: string;
  tenantId: string;
  payloadHash: string;
  state: "running" | "completed";
  result: unknown;
  createdAt: string;
}

/**
 * Idempotency for effects: identical replay returns the stored result, a
 * different payload under the same key is a 409, and an in-flight key blocks
 * a second attempt instead of duplicating the effect.
 */
export class IdempotencyStore {
  private readonly records = new Map<string, IdempotentRecord>();

  private keyOf(tenantId: string, operationKey: string): string {
    return `${tenantId}::${operationKey}`;
  }

  begin(input: { tenantId: string; operationKey: string; payload: unknown; now: Date }): {
    status: "started" | "replay";
    result?: unknown;
    payloadHash: string;
  } {
    const payloadHash = sha256Hex(canonicalJson(input.payload));
    const existing = this.records.get(this.keyOf(input.tenantId, input.operationKey));
    if (!existing) {
      this.records.set(this.keyOf(input.tenantId, input.operationKey), {
        key: input.operationKey,
        tenantId: input.tenantId,
        payloadHash,
        state: "running",
        result: null,
        createdAt: input.now.toISOString(),
      });
      return { status: "started", payloadHash };
    }
    if (existing.payloadHash !== payloadHash) {
      throw conflict("idempotency key reused with a different payload");
    }
    if (existing.state === "running") {
      throw conflict("operation with this key is already in progress");
    }
    return { status: "replay", result: existing.result, payloadHash };
  }

  complete(tenantId: string, operationKey: string, result: unknown): void {
    const existing = this.records.get(this.keyOf(tenantId, operationKey));
    if (!existing) throw notFound("unknown idempotency record");
    this.records.set(this.keyOf(tenantId, operationKey), { ...existing, state: "completed", result });
  }

  abort(tenantId: string, operationKey: string): void {
    this.records.delete(this.keyOf(tenantId, operationKey));
  }
}

export function assertOpaqueId(value: string, field: string): void {
  if (!opaqueId.safeParse(value).success) {
    throw new ApiError("invalid_input", `${field} must be an opaque id`);
  }
}
