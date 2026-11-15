import type { MemoryStore, OutboxRecord } from "../store/memory-store.ts";

/**
 * Outbox delivery: at-least-once, deduplicated, acknowledged after the receiver
 * commits. An event that was emitted is not an event that was received, so
 * `acknowledgedAt` is only set when the sink reports an identifier.
 */
export interface OutboxSink {
  deliver(event: OutboxRecord): Promise<{ acknowledged: boolean; receiptId?: string }>;
}

export interface DispatchReport {
  delivered: number;
  retried: number;
  deadLettered: number;
}

const MAX_ATTEMPTS = 5;

export function publishEvent(
  store: MemoryStore,
  input: { tenantId: string; eventType: string; domainEventId: string; payload: Record<string, unknown> },
): OutboxRecord {
  // Durable dedup by domain event id, per tenant.
  const duplicate = store.outbox.find(
    (e) => e.tenantId === input.tenantId && e.payload["domainEventId"] === input.domainEventId,
  );
  if (duplicate) return duplicate;

  return store.enqueueOutbox({
    tenantId: input.tenantId,
    eventType: input.eventType,
    payload: { ...input.payload, domainEventId: input.domainEventId },
  });
}

export async function dispatchPending(store: MemoryStore, sink: OutboxSink): Promise<DispatchReport> {
  const report: DispatchReport = { delivered: 0, retried: 0, deadLettered: 0 };
  for (const event of store.outbox) {
    if (event.acknowledgedAt !== null) continue;
    if (event.attempts >= MAX_ATTEMPTS) {
      report.deadLettered += 1;
      continue;
    }
    event.attempts += 1;
    try {
      const result = await sink.deliver(event);
      if (!result.acknowledged) {
        report.retried += 1;
        continue;
      }
      event.acknowledgedAt = new Date().toISOString();
      report.delivered += 1;
    } catch {
      // Transport failure: keep the event, bounded attempts, no data loss.
      report.retried += 1;
    }
  }
  return report;
}

export function pendingEvents(store: MemoryStore): OutboxRecord[] {
  return store.outbox.filter((e) => e.acknowledgedAt === null && e.attempts < MAX_ATTEMPTS);
}

export function deadLetteredEvents(store: MemoryStore): OutboxRecord[] {
  return store.outbox.filter((e) => e.acknowledgedAt === null && e.attempts >= MAX_ATTEMPTS);
}
