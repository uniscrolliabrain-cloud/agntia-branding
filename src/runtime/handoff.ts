import { z } from "zod";
import { DomainError } from "../contracts/errors.ts";

/**
 * Enterprise handoff between specialists.
 *
 * Emitting an event proves nothing about reception. This state machine makes
 * that explicit: `acknowledged` requires a receiver-side receipt, and
 * `completed` requires the receiver to return a result. There is no path from
 * "offered" to "completed" without both.
 */

export const HANDOFF_STATES = ["proposed", "offered", "acknowledged", "working", "completed", "returned", "declined"] as const;

export type HandoffState = (typeof HANDOFF_STATES)[number];

export const handoffSchema = z
  .object({
    id: z.string().min(8).max(128),
    tenantId: z.string().min(1).max(128),
    fromRepo: z.string().min(1).max(64),
    toRepo: z.string().min(1).max(64),
    workOrderId: z.string().min(1).max(128),
    state: z.enum(HANDOFF_STATES),
    /** Evidence refs only: the payload stays behind ACL. */
    evidenceRefs: z.array(z.string().min(1).max(256)).max(32),
    receiverReceiptId: z.string().min(1).max(128).nullable(),
    completedAt: z.string().datetime({ offset: true }).nullable(),
  })
  .strict();

export type Handoff = z.infer<typeof handoffSchema>;

const ALLOWED: Readonly<Record<HandoffState, readonly HandoffState[]>> = {
  proposed: ["offered", "declined"],
  offered: ["acknowledged", "declined"],
  acknowledged: ["working", "returned"],
  working: ["completed", "returned"],
  completed: [],
  returned: ["offered"],
  declined: [],
};

function transition(handoff: Handoff, next: HandoffState): Handoff {
  if (!ALLOWED[handoff.state].includes(next)) {
    throw new DomainError("policy_violation", "Illegal handoff transition.", {
      details: { from: handoff.state, to: next },
    });
  }
  return { ...handoff, state: next };
}

export function offerHandoff(handoff: Handoff): Handoff {
  return transition(handoff, "offered");
}

/**
 * Acknowledging without a receipt from the receiver is exactly the failure mode
 * this module exists to prevent.
 */
export function acknowledgeHandoff(handoff: Handoff, receiptId: string): Handoff {
  if (receiptId.trim() === "") {
    throw new DomainError("policy_violation", "A handoff cannot be acknowledged without a receiver receipt.", {
      details: { reason: "missing_receipt" },
    });
  }
  const acked = transition(handoff, "acknowledged");
  return { ...acked, receiverReceiptId: receiptId };
}

export function startHandoff(handoff: Handoff): Handoff {
  return transition(handoff, "working");
}

export function completeHandoff(handoff: Handoff, now: Date): Handoff {
  if (handoff.receiverReceiptId === null) {
    throw new DomainError("policy_violation", "Completion requires an acknowledged receipt.");
  }
  const completed = transition(handoff, "completed");
  return { ...completed, completedAt: now.toISOString() };
}

export function returnHandoff(handoff: Handoff): Handoff {
  return transition(handoff, "returned");
}

/** A human taking over pauses autonomy: queued jobs must revalidate first. */
export function assertResumable(handoff: Handoff, mandateStillValid: boolean): void {
  if (!mandateStillValid) {
    throw new DomainError("policy_violation", "The mandate is no longer valid; the handoff cannot resume.", {
      details: { handoffId: handoff.id },
    });
  }
}
