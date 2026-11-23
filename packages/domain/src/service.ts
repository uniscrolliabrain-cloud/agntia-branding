import {
  addMoney,
  compareMoney,
  conflict,
  forbidden,
  invalid,
  needsReview,
  opaqueId,
  sha256Hex,
  subMoney,
  type Money,
  IsoDateTime,
  ZERO_MONEY,
} from "./_shared.ts";
import { z } from "zod";

/* ------------------------------------------------------------------ *
 * C32 · Aprendizaje y librería (replay antes de activar, nunca auto)
 * ------------------------------------------------------------------ */

export const ProcedureProposalSchema = z
  .object({
    proposalId: opaqueId,
    tenantId: opaqueId,
    procedure: z.string().min(10).max(5000),
    evidenceRefs: z.array(opaqueId).min(1),
    replayGate: z
      .object({
        required: z.boolean(),
        passed: z.boolean(),
        cases: z.number().int().min(0),
        failures: z.array(z.string().max(300)).default([]),
      })
      .strict(),
    approvedBy: opaqueId.nullable(),
    status: z.enum(["proposed", "approved", "active", "rejected"]),
  })
  .strict();

export type ProcedureProposal = z.infer<typeof ProcedureProposalSchema>;

/**
 * Procedural learning is scoped to one tenant and only activates after replay
 * and a human approval. It never learns from another client's private work.
 */
export function activateProcedure(
  proposal: ProcedureProposal,
  context: { tenantId: string; reviewerRole: string },
): ProcedureProposal {
  if (proposal.tenantId !== context.tenantId) throw forbidden("procedure belongs to another tenant");
  if (!proposal.replayGate.required || !proposal.replayGate.passed) {
    throw conflict("procedure cannot activate without a passed replay gate");
  }
  if (proposal.replayGate.cases === 0) throw conflict("replay gate has no cases");
  if (!proposal.approvedBy) throw needsReview("procedure requires human approval before activation");
  if (context.reviewerRole !== "owner" && context.reviewerRole !== "competent_reviewer") {
    throw forbidden("role cannot activate a procedure");
  }
  return { ...proposal, status: "active" };
}

/* ------------------------------------------------------------------ *
 * C33 · Reportes, dashboard e infografías
 * ------------------------------------------------------------------ */

export const MetricValueSchema = z
  .object({
    metricId: z.string().min(1).max(80),
    value: z.number(),
    unit: z.string().min(1).max(20),
    sourceRef: z.string().min(1).max(300),
    coverage: z.string().min(1).max(200),
  })
  .strict();

export const ReportSnapshotSchema = z
  .object({
    snapshotId: opaqueId,
    tenantId: opaqueId,
    resourceId: opaqueId,
    metricDefinitions: z.array(
      z.object({ metricId: z.string().min(1).max(80), definition: z.string().min(3).max(500) }).strict(),
    ),
    values: z.array(MetricValueSchema),
    createdAt: IsoDateTime,
    hash: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict();

export type ReportSnapshot = z.infer<typeof ReportSnapshotSchema>;

/**
 * A report is a snapshot of measured facts. Every number must carry its
 * definition, source and coverage; nothing is filled with a plausible value.
 */
export function createReportSnapshot(input: {
  snapshotId: string;
  tenantId: string;
  resourceId: string;
  metricDefinitions: { metricId: string; definition: string }[];
  values: z.infer<typeof MetricValueSchema>[];
  createdAt: Date;
}): ReportSnapshot {
  const defined = new Set(input.metricDefinitions.map((d) => d.metricId));
  for (const value of input.values) {
    if (!defined.has(value.metricId)) throw invalid(`metric ${value.metricId} has no definition`);
    if (!Number.isFinite(value.value)) throw invalid(`metric ${value.metricId} is not a finite number`);
  }
  const body = {
    snapshotId: input.snapshotId,
    tenantId: input.tenantId,
    resourceId: input.resourceId,
    metricDefinitions: input.metricDefinitions,
    values: input.values,
    createdAt: input.createdAt.toISOString(),
  };
  return ReportSnapshotSchema.parse({ ...body, hash: sha256Hex(body) });
}

export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  if (p <= 0 || p > 100) throw invalid("percentile out of range");
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))]!;
}

/* ------------------------------------------------------------------ *
 * C34 · Portal y Anam (presencia, no autoridad)
 * ------------------------------------------------------------------ */

export const AdvisorSessionSchema = z
  .object({
    sessionId: opaqueId,
    tenantId: opaqueId,
    resourceId: opaqueId,
    twinBindingId: opaqueId,
    capabilities: z.array(z.string().min(1).max(120)).min(1),
    budget: z.object({ amount: z.string(), currency: z.string().length(3), exponent: z.number().int() }).strict(),
    expiresAt: IsoDateTime,
    recordingEnabled: z.boolean(),
    avTokenRef: z.string().min(1).max(200).nullable(),
  })
  .strict();

export type AdvisorSession = z.infer<typeof AdvisorSessionSchema>;

/**
 * The avatar is a channel. It never widens scope, and its ephemeral token is
 * not a JWT, a signature or a professional credential.
 */
export function assertSessionAction(
  session: AdvisorSession,
  request: { tenantId: string; capability: string; now: Date },
): void {
  if (session.tenantId !== request.tenantId) throw forbidden("advisor session belongs to another tenant");
  if (new Date(session.expiresAt).getTime() <= request.now.getTime()) throw forbidden("advisor session expired");
  if (!session.capabilities.includes(request.capability)) {
    throw forbidden(`capability ${request.capability} is outside this session`);
  }
}

export function microphoneRequiresConsent(session: AdvisorSession): boolean {
  return session.recordingEnabled;
}

/* ------------------------------------------------------------------ *
 * C35 · SDK, Hono y tools (mismo PEP, sin passthrough)
 * ------------------------------------------------------------------ */

export const ROUTE_ALLOWLIST: readonly { method: string; pattern: RegExp }[] = [
  { method: "GET", pattern: /^\/v1\/branding\/me$/ },
  { method: "GET", pattern: /^\/v1\/branding\/resources$/ },
  { method: "GET", pattern: /^\/v1\/branding\/resources\/[A-Za-z0-9:_-]{8,128}$/ },
  { method: "GET", pattern: /^\/v1\/branding\/jobs\/[A-Za-z0-9:_-]{8,128}$/ },
  { method: "GET", pattern: /^\/v1\/branding\/reports\/[A-Za-z0-9:_-]{8,128}$/ },
  { method: "GET", pattern: /^\/v1\/branding\/integrations\/[A-Za-z0-9:_-]{8,128}\/capabilities$/ },
  { method: "POST", pattern: /^\/v1\/branding\/imports\/preview$/ },
  { method: "POST", pattern: /^\/v1\/branding\/proposals$/ },
  { method: "POST", pattern: /^\/v1\/branding\/proposals\/[A-Za-z0-9:_-]{8,128}\/preview$/ },
  { method: "POST", pattern: /^\/v1\/branding\/intents$/ },
  { method: "POST", pattern: /^\/v1\/branding\/intents\/[A-Za-z0-9:_-]{8,128}\/reconcile$/ },
  { method: "POST", pattern: /^\/v1\/branding\/reports$/ },
  { method: "POST", pattern: /^\/v1\/branding\/advisor-sessions$/ },
  { method: "POST", pattern: /^\/v1\/branding\/advisor-sessions\/[A-Za-z0-9:_-]{8,128}\/close$/ },
  { method: "POST", pattern: /^\/v1\/branding\/approvals$/ },
  { method: "POST", pattern: /^\/v1\/branding\/verticals$/ },
  { method: "GET", pattern: /^\/v1\/branding\/verticals\/[A-Za-z0-9:_-]{8,128}$/ },
  { method: "POST", pattern: /^\/v1\/branding\/verticals\/[A-Za-z0-9:_-]{8,128}\/stages\/[a-z]+$/ },
];

export function assertRouteAllowed(method: string, path: string): void {
  const allowed = ROUTE_ALLOWLIST.some((route) => route.method === method.toUpperCase() && route.pattern.test(path));
  if (!allowed) throw forbidden(`route ${method} ${path} is not exposed`);
}

/* ------------------------------------------------------------------ *
 * C36 · Bridge de agente y eventos (mapeo, no enum inventado)
 * ------------------------------------------------------------------ */

export const HOST_EVENT_TYPES = [
  "task.completed",
  "task.failed",
  "business.updated",
  "artifact.created",
  "approval.requested",
] as const;

export const BrandingEventSchema = z
  .object({
    id: opaqueId,
    schemaVersion: z.literal("1.0"),
    tenantId: opaqueId,
    owner: z.string().min(1).max(120),
    emittedAt: IsoDateTime,
    source: z
      .object({
        kind: z.enum(["branding"]),
        id: z.string().min(1).max(120),
        personaId: opaqueId.nullable().default(null),
      })
      .strict(),
    type: z.enum(HOST_EVENT_TYPES),
    correlationId: z.string().min(1).max(200),
    causationId: z.string().min(1).max(200).nullable(),
    domainEventId: opaqueId,
    payloadRef: z.string().min(1).max(300).nullable(),
  })
  .strict();

export type BrandingEvent = z.infer<typeof BrandingEventSchema>;

/** Only confirmed facts may be projected to the host bus. */
export function toHostEvent(input: {
  fact: { tenantId: string; owner: string; type: (typeof HOST_EVENT_TYPES)[number]; occurredAt: Date; confirmed: boolean; domainEventId: string; correlationId: string; causationId: string | null; payloadRef: string | null; eventId: string };
  personaId?: string | null;
}): BrandingEvent {
  if (!input.fact.confirmed) throw conflict("only confirmed facts can be emitted to the host bus");
  return BrandingEventSchema.parse({
    id: input.fact.eventId,
    schemaVersion: "1.0",
    tenantId: input.fact.tenantId,
    owner: input.fact.owner,
    emittedAt: input.fact.occurredAt.toISOString(),
    source: { kind: "branding", id: "agntia-branding", personaId: input.personaId ?? null },
    type: input.fact.type,
    correlationId: input.fact.correlationId,
    causationId: input.fact.causationId,
    domainEventId: input.fact.domainEventId,
    payloadRef: input.fact.payloadRef,
  });
}

/* ------------------------------------------------------------------ *
 * C37 · Cooperación y handoff empresarial
 * ------------------------------------------------------------------ */

export const HANDOFF_STATES = ["proposed", "offered", "acknowledged", "working", "completed", "returned", "cancelled"] as const;

export const HandoffSchema = z
  .object({
    handoffId: opaqueId,
    tenantId: opaqueId,
    fromService: z.string().min(1).max(60),
    toService: z.string().min(1).max(60),
    state: z.enum(HANDOFF_STATES),
    offeredAt: IsoDateTime.nullable(),
    acknowledgedAt: IsoDateTime.nullable(),
    completedAt: IsoDateTime.nullable(),
    ackRef: z.string().min(1).max(200).nullable(),
    evidenceRefs: z.array(opaqueId).default([]),
  })
  .strict();

export type Handoff = z.infer<typeof HandoffSchema>;

const HANDOFF_TRANSITIONS: Record<(typeof HANDOFF_STATES)[number], readonly (typeof HANDOFF_STATES)[number][]> = {
  proposed: ["offered", "cancelled"],
  offered: ["acknowledged", "cancelled", "returned"],
  acknowledged: ["working", "returned", "cancelled"],
  working: ["completed", "returned"],
  completed: [],
  returned: [],
  cancelled: [],
};

/** Emitting an event is not receiving work: only an ACK moves the handoff. */
export function acknowledgeHandoff(handoff: Handoff, ackRef: string, now: Date): Handoff {
  if (handoff.state !== "offered") throw conflict(`cannot acknowledge a ${handoff.state} handoff`);
  if (!ackRef.trim()) throw invalid("acknowledgement requires a verifiable reference");
  return { ...handoff, state: "acknowledged", acknowledgedAt: now.toISOString(), ackRef };
}

export function advanceHandoff(handoff: Handoff, next: (typeof HANDOFF_STATES)[number], now: Date): Handoff {
  if (!HANDOFF_TRANSITIONS[handoff.state].includes(next)) {
    throw conflict(`illegal handoff transition ${handoff.state} -> ${next}`);
  }
  if (next === "working" && !handoff.ackRef) throw conflict("work cannot start without acknowledgement");
  return {
    ...handoff,
    state: next,
    completedAt: next === "completed" ? now.toISOString() : handoff.completedAt,
  };
}

export function isReceivedByPeer(handoff: Handoff): boolean {
  return handoff.ackRef !== null && handoff.acknowledgedAt !== null;
}

/* ------------------------------------------------------------------ *
 * C38 · Modelos, coste y observabilidad
 * ------------------------------------------------------------------ */

export interface BudgetReservation {
  reservationId: string;
  tenantId: string;
  operationKey: string;
  amount: Money;
  consumed: Money;
  released: boolean;
  createdAt: Date;
}

/**
 * Budget accounting per tenant/operation. Concurrent operations cannot spend
 * the last cent twice: the reservation is checked against committed + held.
 */
export class BudgetLedger {
  private readonly reservations = new Map<string, BudgetReservation>();
  private readonly committed = new Map<string, Money>();

  constructor(private readonly unit: Money) {}

  private committedFor(tenantId: string): Money {
    return this.committed.get(tenantId) ?? ZERO_MONEY;
  }

  private heldFor(tenantId: string): Money {
    let held = ZERO_MONEY;
    for (const reservation of this.reservations.values()) {
      if (reservation.tenantId === tenantId && !reservation.released) {
        held = addMoney(held, subMoney(reservation.amount, reservation.consumed));
      }
    }
    return held;
  }

  available(tenantId: string): Money {
    return subMoney(subMoney(this.unit, this.committedFor(tenantId)), this.heldFor(tenantId));
  }

  reserve(input: { reservationId: string; tenantId: string; operationKey: string; amount: Money; now: Date }): BudgetReservation {
    if (compareMoney(input.amount, this.available(input.tenantId)) > 0) {
      throw conflict("budget exhausted for this tenant");
    }
    const existing = this.reservations.get(input.operationKey);
    if (existing && !existing.released) throw conflict("operation already has an active reservation");
    const reservation: BudgetReservation = {
      reservationId: input.reservationId,
      tenantId: input.tenantId,
      operationKey: input.operationKey,
      amount: input.amount,
      consumed: subMoney(input.amount, input.amount),
      released: false,
      createdAt: input.now,
    };
    this.reservations.set(input.operationKey, reservation);
    return reservation;
  }

  consume(operationKey: string, actual: Money): BudgetReservation {
    const reservation = this.reservations.get(operationKey);
    if (!reservation) throw invalid("unknown reservation");
    if (reservation.released) throw conflict("reservation already released");
    if (compareMoney(actual, reservation.amount) > 0) throw conflict("actual cost exceeds reservation");
    const updated = { ...reservation, consumed: actual };
    this.reservations.set(operationKey, updated);
    return updated;
  }

  release(operationKey: string): void {
    const reservation = this.reservations.get(operationKey);
    if (!reservation) throw invalid("unknown reservation");
    this.reservations.delete(operationKey);
    this.committed.set(reservation.tenantId, addMoney(this.committedFor(reservation.tenantId), reservation.consumed));
  }
}
