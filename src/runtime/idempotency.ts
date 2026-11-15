import { DomainError } from "../contracts/errors.ts";
import type { IntentRecord, MemoryStore } from "../store/memory-store.ts";

/**
 * Durable idempotency for effects.
 *
 * The rule that prevents double charging and double sending: one intent per
 * (tenant, capability, key). Replaying the same key with the same payload
 * returns the stored result; the same key with different content is a conflict,
 * never a silent overwrite.
 *
 * This guards the local decision. It does not make a remote call exactly-once:
 * a provider that accepted a request and lost the response must be reconciled,
 * not retried with a fresh key.
 */
export interface BeginIntentInput {
  tenantId: string;
  capability: string;
  idempotencyKey: string;
  payloadHash: string;
}

export type BeginIntentResult =
  | { kind: "started"; intent: IntentRecord }
  | { kind: "replay"; result: Record<string, unknown> };

export function beginIntent(store: MemoryStore, input: BeginIntentInput): BeginIntentResult {
  const existing = store.getIntent(input.tenantId, input.capability, input.idempotencyKey);
  if (existing) {
    if (existing.payloadHash !== input.payloadHash) {
      throw new DomainError("idempotency_conflict", "This idempotency key was used with different content.", {
        details: { capability: input.capability },
      });
    }
    if (existing.status === "succeeded" && existing.result !== null) {
      return { kind: "replay", result: existing.result };
    }
    if (existing.status === "outcome_unknown") {
      throw new DomainError("provider_timeout", "A previous attempt has an unknown outcome; reconcile first.", {
        details: { reconciliationRequired: true },
      });
    }
    throw new DomainError("idempotency_conflict", "The same intent is already in progress.", {
      details: { status: existing.status },
    });
  }

  const intent: IntentRecord = {
    tenantId: input.tenantId,
    capability: input.capability,
    idempotencyKey: input.idempotencyKey,
    payloadHash: input.payloadHash,
    status: "in_progress",
    result: null,
    createdAt: new Date().toISOString(),
  };
  store.putIntent(intent);
  return { kind: "started", intent };
}

export function completeIntent(
  store: MemoryStore,
  input: BeginIntentInput,
  result: Record<string, unknown>,
): void {
  store.putIntent({
    tenantId: input.tenantId,
    capability: input.capability,
    idempotencyKey: input.idempotencyKey,
    payloadHash: input.payloadHash,
    status: "succeeded",
    result,
    createdAt: new Date().toISOString(),
  });
}

/**
 * A timeout after a possible acceptance is not a definitive failure. Recording
 * it as `outcome_unknown` blocks naive retries and forces reconciliation.
 */
export function markOutcomeUnknown(store: MemoryStore, input: BeginIntentInput, reason: string): void {
  store.putIntent({
    tenantId: input.tenantId,
    capability: input.capability,
    idempotencyKey: input.idempotencyKey,
    payloadHash: input.payloadHash,
    status: "outcome_unknown",
    result: { reason },
    createdAt: new Date().toISOString(),
  });
}

export function failIntent(store: MemoryStore, input: BeginIntentInput, reason: string): void {
  store.putIntent({
    tenantId: input.tenantId,
    capability: input.capability,
    idempotencyKey: input.idempotencyKey,
    payloadHash: input.payloadHash,
    status: "failed",
    result: { reason },
    createdAt: new Date().toISOString(),
  });
}
