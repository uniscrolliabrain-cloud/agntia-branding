import { z } from "zod";

/**
 * Two envelopes, deliberately different:
 *
 * - The client may send only intent: capability, correlation, payload, a dry-run
 *   flag and an idempotency key.
 * - tenantId / actorId / approvalRef are SERVER-RESOLVED. They exist in the
 *   internal envelope because the audit record needs them, but a client body can
 *   never set them. Trusting them from JSON would be a privilege escalation.
 */

export const clientEnvelopeSchema = z
  .object({
    capability: z.string().min(3).max(96).regex(/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){1,3}$/),
    correlationId: z.string().min(8).max(128),
    causationId: z.string().min(8).max(128).nullable().optional(),
    idempotencyKey: z.string().min(8).max(128),
    expectedVersion: z.number().int().nonnegative().optional(),
    dryRun: z.boolean().default(true),
    payload: z.record(z.unknown()).default({}),
  })
  .strict();

export type ClientEnvelope = z.infer<typeof clientEnvelopeSchema>;

export const operationEnvelopeSchema = z
  .object({
    schemaVersion: z.literal(1),
    operationId: z.string().min(8).max(128),
    tenantId: z.string().min(1).max(128),
    actorId: z.string().min(1).max(128),
    capability: z.string().min(3).max(96),
    requestId: z.string().min(1).max(128).nullable(),
    correlationId: z.string().min(8).max(128),
    causationId: z.string().min(8).max(128).nullable(),
    idempotencyKey: z.string().min(8).max(128),
    expectedVersion: z.number().int().nonnegative().nullable(),
    approvalRef: z.string().min(1).max(128).nullable(),
    dryRun: z.boolean(),
    payload: z.record(z.unknown()),
  })
  .strict();

export type OperationEnvelope = z.infer<typeof operationEnvelopeSchema>;

export interface ComposeEnvelopeInput {
  operationId: string;
  tenantId: string;
  actorId: string;
  client: ClientEnvelope;
  approvalRef?: string | null;
  requestId?: string | null;
}

/**
 * Compose the internal envelope from a verified principal plus a client body.
 * Identity fields come exclusively from the principal, never from the body.
 */
export function composeEnvelope(input: ComposeEnvelopeInput): OperationEnvelope {
  return operationEnvelopeSchema.parse({
    schemaVersion: 1,
    operationId: input.operationId,
    tenantId: input.tenantId,
    actorId: input.actorId,
    capability: input.client.capability,
    requestId: input.requestId ?? null,
    correlationId: input.client.correlationId,
    causationId: input.client.causationId ?? null,
    idempotencyKey: input.client.idempotencyKey,
    expectedVersion: input.client.expectedVersion ?? null,
    approvalRef: input.approvalRef ?? null,
    dryRun: input.client.dryRun,
    payload: input.client.payload,
  });
}

/** Reject any client body that tries to set server-resolved identity. */
export function assertNoIdentitySupplied(body: unknown): void {
  if (typeof body !== "object" || body === null) return;
  for (const forbidden of ["tenantId", "actorId", "approvalRef", "sub", "owner"]) {
    if (Object.prototype.hasOwnProperty.call(body, forbidden)) {
      throw new Error("invalid_input");
    }
  }
}
