import { z } from "zod";
import type { AdtcEvent } from "./adtc.ts";

/**
 * Service events. These type names belong to this middleware; they are not an
 * enum of the parent and must be projected, never assumed.
 */
export const BRANDING_EVENT_TYPES = [
  "branding.proposal.created",
  "branding.review.required",
  "branding.resource.changed",
  "branding.operation.confirmed",
  "branding.operation.outcome_unknown",
  "branding.connection.degraded",
] as const;

export type BrandingEventType = (typeof BRANDING_EVENT_TYPES)[number];

/**
 * Parent `SystemEvent` shape, as documented in
 * `docs/architecture/03-compatibilidad-agente.md`: string schemaVersion "1.0",
 * emittedAt, owner and the allowed source kinds. We do not add fields to it.
 */
export const systemEventSchema = z
  .object({
    id: z.string().min(1).max(128),
    type: z.string().min(3).max(96),
    schemaVersion: z.literal("1.0"),
    tenantId: z.string().min(1).max(128),
    owner: z.string().min(1).max(128),
    emittedAt: z.string().datetime({ offset: true }),
    source: z
      .object({
        kind: z.enum(["agent", "human", "service"]),
        id: z.string().min(1).max(128),
        personaId: z.string().min(1).max(128).nullable(),
      })
      .strict(),
  })
  .strict();

export type SystemEvent = z.infer<typeof systemEventSchema>;

/** Only confirmed facts become host events. A proposal is not a result. */
const PROJECTABLE = new Set<BrandingEventType>([
  "branding.resource.changed",
  "branding.operation.confirmed",
  "branding.operation.outcome_unknown",
  "branding.review.required",
]);

export interface ProjectionInput {
  event: AdtcEvent;
  /** Whether the underlying operation has a receipt, not merely an attempt. */
  hasReceipt: boolean;
  ownerRef: string;
  now?: Date;
}

export function toSystemEvent(input: ProjectionInput): SystemEvent {
  const type = input.event.eventType;
  if (!PROJECTABLE.has(type as BrandingEventType)) {
    throw new Error("policy_violation: event type is not projectable to the host");
  }
  if (!input.hasReceipt && type !== "branding.review.required") {
    throw new Error("policy_violation: refusing to report success without a receipt");
  }
  return systemEventSchema.parse({
    id: input.event.eventId,
    type,
    schemaVersion: "1.0",
    tenantId: input.event.tenantId,
    owner: input.ownerRef,
    emittedAt: (input.now ?? new Date()).toISOString(),
    source: {
      kind: "service",
      id: "agntia-branding",
      personaId: null,
    },
  });
}
