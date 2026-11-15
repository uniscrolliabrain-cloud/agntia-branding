import type { DomainRole, ResourceScope } from "../auth/principal.ts";
import type { ApprovalBinding } from "../policy/approval.ts";
import type { EvidenceRef } from "../contracts/evidence.ts";

/**
 * Tenant-scoped in-memory store used by the API, the worker and the tests.
 *
 * Every key starts with the tenant id, which mirrors the composite foreign keys
 * and RLS predicate in `src/db/schema.sql`. That is deliberate: a bug that
 * forgets the tenant prefix fails loudly in tests here, before it becomes a
 * cross-tenant read in Postgres.
 *
 * This is not the production persistence layer. Production uses Postgres with
 * row-level security; this store exists so the domain rules are executable and
 * testable without a database.
 */

export interface Membership {
  id: string;
  userId: string;
  tenantId: string;
  role: DomainRole;
  status: "active" | "suspended";
  scopes: ResourceScope[];
}

export const RESOURCE_TYPES = [
  "brand_brief",
  "design_document",
  "asset",
  "font",
  "token_set",
  "brandbook",
  "export_manifest",
  "deliverable",
  "report",
  "work_order",
] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];

export interface StoredResource {
  tenantId: string;
  type: ResourceType;
  id: string;
  version: number;
  state: string;
  data: Record<string, unknown>;
  evidence: EvidenceRef[];
  updatedAt: string;
  updatedBy: string;
}

export interface IntentRecord {
  tenantId: string;
  capability: string;
  idempotencyKey: string;
  payloadHash: string;
  status: "in_progress" | "succeeded" | "failed" | "outcome_unknown";
  result: Record<string, unknown> | null;
  createdAt: string;
}

export interface OutboxRecord {
  id: string;
  tenantId: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
  acknowledgedAt: string | null;
  attempts: number;
}

export interface AuditRecord {
  id: string;
  tenantId: string;
  actorId: string;
  capability: string;
  outcome: "allowed" | "denied" | "blocked";
  reason: string | null;
  correlationId: string;
  at: string;
}

export interface BudgetRecord {
  tenantId: string;
  currency: string;
  /** Decimal strings in minor units of the currency's exponent. */
  ceiling: string;
  reserved: string;
  consumed: string;
}

export interface JobRecord {
  id: string;
  tenantId: string;
  capability: string;
  status: "queued" | "running" | "confirmed" | "failed_definitive" | "outcome_unknown" | "reconciliation_required";
  attempt: number;
  leaseUntil: string | null;
  lastError: string | null;
}

const resourceKey = (tenantId: string, type: ResourceType, id: string): string => `${tenantId}:${type}:${id}`;

export class MemoryStore {
  readonly memberships = new Map<string, Membership>();
  readonly resources = new Map<string, StoredResource>();
  readonly approvals = new Map<string, ApprovalBinding>();
  readonly intents = new Map<string, IntentRecord>();
  readonly outbox: OutboxRecord[] = [];
  readonly audit: AuditRecord[] = [];
  readonly budgets = new Map<string, BudgetRecord>();
  readonly jobs = new Map<string, JobRecord>();

  addMembership(membership: Membership): void {
    this.memberships.set(`${membership.tenantId}:${membership.userId}`, membership);
  }

  findMembership(tenantId: string | null, userId: string): Membership | undefined {
    if (tenantId !== null) {
      const direct = this.memberships.get(`${tenantId}:${userId}`);
      if (direct) return direct;
    }
    // A user may belong to several tenants; the token's tenant selects one.
    for (const membership of this.memberships.values()) {
      if (membership.userId === userId) return membership;
    }
    return undefined;
  }

  putResource(resource: StoredResource): StoredResource {
    this.resources.set(resourceKey(resource.tenantId, resource.type, resource.id), resource);
    return resource;
  }

  getResource(tenantId: string, type: ResourceType, id: string): StoredResource | undefined {
    return this.resources.get(resourceKey(tenantId, type, id));
  }

  requireResource(tenantId: string, type: ResourceType, id: string): StoredResource {
    const found = this.getResource(tenantId, type, id);
    if (!found) {
      // A foreign tenant's resource is indistinguishable from a missing one.
      throw Object.assign(new Error("not_found"), { code: "not_found" });
    }
    return found;
  }

  putApproval(binding: ApprovalBinding): ApprovalBinding {
    this.approvals.set(`${binding.tenantId}:${binding.id}`, binding);
    return binding;
  }

  getApproval(tenantId: string, id: string): ApprovalBinding | undefined {
    return this.approvals.get(`${tenantId}:${id}`);
  }

  getIntent(tenantId: string, capability: string, key: string): IntentRecord | undefined {
    return this.intents.get(`${tenantId}:${capability}:${key}`);
  }

  putIntent(record: IntentRecord): IntentRecord {
    this.intents.set(`${record.tenantId}:${record.capability}:${record.idempotencyKey}`, record);
    return record;
  }

  enqueueOutbox(record: Omit<OutboxRecord, "id" | "createdAt" | "acknowledgedAt" | "attempts">): OutboxRecord {
    const full: OutboxRecord = {
      ...record,
      id: `evt_${this.outbox.length + 1}_${Date.now().toString(36)}`,
      createdAt: new Date().toISOString(),
      acknowledgedAt: null,
      attempts: 0,
    };
    this.outbox.push(full);
    return full;
  }

  recordAudit(record: Omit<AuditRecord, "id" | "at">): AuditRecord {
    const full: AuditRecord = {
      ...record,
      id: `aud_${this.audit.length + 1}`,
      at: new Date().toISOString(),
    };
    this.audit.push(full);
    return full;
  }

  setBudget(record: BudgetRecord): void {
    this.budgets.set(record.tenantId, record);
  }
}
