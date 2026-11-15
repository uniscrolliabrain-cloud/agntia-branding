import { z } from "zod";
import { randomUUID } from "node:crypto";

/**
 * ADTC (identidad, causalidad y observabilidad) envelope for this service.
 *
 * This is NOT the parent's native SystemEvent. It carries references only: no
 * payloads, no binaries, no licensed fonts, no client briefs on the bus. The
 * projection to the parent event contract lives in `events.ts`.
 */
export const adtcEventSchema = z
  .object({
    schemaVersion: z.literal("adtc/0.1"),
    eventId: z.string().uuid(),
    eventType: z.string().min(3).max(96),
    tenantId: z.string().min(1).max(128),
    actorId: z.string().min(1).max(128),
    taskId: z.string().min(1).max(128).nullable(),
    correlationId: z.string().min(8).max(128),
    causationId: z.string().min(8).max(128).nullable(),
    requestId: z.string().min(1).max(128).nullable(),
    traceId: z.string().min(16).max(64),
    spanId: z.string().min(8).max(32),
    idempotencyKey: z.string().min(8).max(128).nullable(),
    source: z.literal("agntia-branding"),
    resourceRefs: z.array(z.string().min(1).max(256)).max(32),
    evidenceRefs: z.array(z.string().min(1).max(256)).max(32),
    /** Pointer to an access-controlled payload, never the payload itself. */
    payloadRef: z.string().min(1).max(256).nullable(),
  })
  .strict();

export type AdtcEvent = z.infer<typeof adtcEventSchema>;

export interface AdtcInput {
  eventType: string;
  tenantId: string;
  actorId: string;
  taskId?: string | null;
  correlationId: string;
  causationId?: string | null;
  requestId?: string | null;
  traceId?: string;
  spanId?: string;
  idempotencyKey?: string | null;
  resourceRefs?: string[];
  evidenceRefs?: string[];
  payloadRef?: string | null;
}

export function buildAdtcEvent(input: AdtcInput): AdtcEvent {
  return adtcEventSchema.parse({
    schemaVersion: "adtc/0.1",
    eventId: randomUUID(),
    eventType: input.eventType,
    tenantId: input.tenantId,
    actorId: input.actorId,
    taskId: input.taskId ?? null,
    correlationId: input.correlationId,
    causationId: input.causationId ?? null,
    requestId: input.requestId ?? null,
    traceId: input.traceId ?? randomUUID().replace(/-/g, ""),
    spanId: input.spanId ?? randomUUID().replace(/-/g, "").slice(0, 16),
    idempotencyKey: input.idempotencyKey ?? null,
    source: "agntia-branding",
    resourceRefs: input.resourceRefs ?? [],
    evidenceRefs: input.evidenceRefs ?? [],
    payloadRef: input.payloadRef ?? null,
  });
}

/** Keep restricted material out of the bus even if a caller passes it by mistake. */
export function assertNoInlinePayload(event: AdtcEvent): void {
  const serialized = JSON.stringify(event);
  if (serialized.length > 4096) {
    throw new Error("policy_violation: event envelope too large; send a payloadRef instead");
  }
}
