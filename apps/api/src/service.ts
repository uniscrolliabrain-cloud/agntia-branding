import {
  ApiError,
  ApprovalBindingSchema,
  conflict,
  forbidden,
  invalid,
  notFound,
  opaqueId,
  sha256Hex,
  type ApprovalBinding,
  type CapabilityReport,
  type Money,
  type OperationResult,
} from "@agntia/contracts";
import {
  assertDeliveryAuthorized,
  assertReceiverCanReceive,
  applyComposition,
  createApproval,
  createReportSnapshot,
  documentHash,
  evaluateApproval,
  preflightExport,
  proposeBrief,
  renderFingerprint,
  type AdvisorSession,
  type AssetRights,
  type BrandBrief,
  type DeliveryReceipt,
  type DesignDocument,
  type ExportManifest,
  type ExportRequest,
  type FontLicense,
  type ReceiverScope,
  type ReportSnapshot,
} from "@agntia/domain";
import { assertResourceAccess, type Principal, type ResourceAcl } from "@agntia/identity";
import { AuditLog, IdempotencyStore, Outbox, ResourceStore } from "@agntia/persistence";

export interface TenantFixtures {
  memberships: never[];
  acls: ResourceAcl[];
  fonts: FontLicense[];
  ledger: AssetRights[];
  receivers: ReceiverScope[];
}

export interface ServiceOptions {
  now?: () => Date;
  newId?: (prefix: string) => string;
}

/**
 * Application service. Every operation resolves the principal server-side,
 * checks ACL before data access, writes audit + outbox in the local commit and
 * never performs a provider effect without a verified capability.
 */
export class BrandingService {
  readonly resources = new ResourceStore();
  readonly audit = new AuditLog();
  readonly outbox = new Outbox();
  readonly idempotency = new IdempotencyStore();
  readonly approvals = new Map<string, ApprovalBinding>();
  readonly sessions = new Map<string, AdvisorSession>();
  readonly acls = new Map<string, ResourceAcl>();
  readonly reports = new Map<string, ReportSnapshot>();
  readonly receipts = new Map<string, DeliveryReceipt>();
  readonly documents = new Map<string, DesignDocument>();
  readonly fonts = new Map<string, FontLicense>();
  readonly ledger = new Map<string, AssetRights>();
  readonly receivers = new Map<string, ReceiverScope>();
  private readonly now: () => Date;
  private readonly newId: (prefix: string) => string;

  constructor(options: ServiceOptions = {}) {
    this.now = options.now ?? (() => new Date());
    let counter = 0;
    this.newId = options.newId ?? ((prefix) => `${prefix}_${(++counter).toString().padStart(8, "0")}`);
  }

  private aclKey(tenantId: string, resourceId: string): string {
    return `${tenantId}::${resourceId}`;
  }

  registerAcl(acl: ResourceAcl): void {
    this.acls.set(this.aclKey(acl.tenantId, acl.resourceId), acl);
  }

  registerFont(font: FontLicense): void {
    this.fonts.set(`${font.tenantId}::${font.fontId}`, font);
  }

  registerRights(rights: AssetRights): void {
    this.ledger.set(`${rights.tenantId}::${rights.rightsId}`, rights);
  }

  registerReceiver(receiver: ReceiverScope): void {
    this.receivers.set(`${receiver.tenantId}::${receiver.receiverId}`, receiver);
  }

  /** Approvals are created by a verified human reviewer, never by the proposer. */
  grantApproval(input: {
    principal: Principal;
    approvalId: string;
    resourceId: string;
    payload: unknown;
    resourceVersion: number;
    rights: unknown;
    policy: unknown;
    scope: string;
    recipient: string;
    channel: string;
    costCeiling: Money;
    expiresAt: string;
    reviewerRole: ApprovalBinding["reviewerRole"];
    proposerId: string;
    competenceVerified: boolean;
  }): ApprovalBinding {
    if (input.principal.kind !== "human") throw forbidden("approver must be a human principal");
    if (input.principal.userId === input.proposerId) throw forbidden("proposer cannot approve its own effect");
    if (!input.competenceVerified) throw forbidden("reviewer competence is not verified");
    this.assertAuthorized(input.principal, input.resourceId, "brand.review.decide", null);

    const approval = createApproval({
      approvalId: input.approvalId,
      tenantId: input.principal.tenantId,
      principalId: input.principal.userId,
      reviewerRole: input.reviewerRole,
      proofRef: `proof:${input.approvalId}`,
      payload: input.payload,
      resourceVersion: input.resourceVersion,
      rights: input.rights,
      policy: input.policy,
      scope: input.scope,
      recipient: input.recipient,
      channel: input.channel,
      costCeiling: input.costCeiling,
      expiresAt: input.expiresAt,
    });
    this.approvals.set(this.aclKey(approval.tenantId, approval.approvalId), approval);
    this.audit.append({
      tenantId: approval.tenantId,
      actorId: input.principal.userId,
      action: "approval.granted",
      resourceId: input.resourceId,
      payload: approval,
      correlationId: `approval:${approval.approvalId}`,
      now: this.now(),
    });
    return approval;
  }

  assertAuthorized(principal: Principal, resourceId: string, capability: string, field: string | null): void {
    const acl = this.acls.get(this.aclKey(principal.tenantId, resourceId));
    if (!acl) throw notFound("resource not found in this scope");
    assertResourceAccess(principal, acl, { resourceId, capability, field });
  }

  createBrief(principal: Principal, input: {
    resourceId: string;
    purpose: string | null;
    audienceDeclared: string | null;
    deliverables: string[];
    constraints?: string[];
    acceptance: string[];
  }): { resourceId: string; version: number; brief: BrandBrief } {
    this.assertAuthorized(principal, input.resourceId, "brand.brief.propose", null);
    const brief = proposeBrief({
      briefId: this.newId("brief"),
      tenantId: principal.tenantId,
      resourceId: input.resourceId,
      purpose: input.purpose,
      audienceDeclared: input.audienceDeclared,
      deliverables: input.deliverables,
      constraints: input.constraints ?? [],
      acceptance: input.acceptance,
    });
    const existing = this.resources.list(principal.tenantId).find((row) => row.resourceId === input.resourceId);
    const stored = this.resources.put({
      tenantId: principal.tenantId,
      resourceId: input.resourceId,
      payload: brief,
      expectedVersion: existing ? existing.version : null,
      actorId: principal.userId,
      now: this.now(),
    });
    this.audit.append({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: "brief.proposed",
      resourceId: input.resourceId,
      payload: brief,
      correlationId: `brief:${input.resourceId}`,
      now: this.now(),
    });
    return { resourceId: input.resourceId, version: stored.version, brief };
  }

  putDocument(principal: Principal, document: DesignDocument): DesignDocument {
    this.assertAuthorized(principal, document.resourceId, "brand.document.update", null);
    if (document.tenantId !== principal.tenantId) throw forbidden("document belongs to another tenant");
    this.documents.set(this.aclKey(principal.tenantId, document.documentId), document);
    return document;
  }

  updateDocument(principal: Principal, input: {
    documentId: string;
    expectedVersion: number;
    patch: { upsert: DesignDocument["nodes"]; remove: string[]; constraints?: string[] };
    operationKey: string;
  }): { document: DesignDocument; inverse: unknown; payloadHash: string } {
    const key = this.aclKey(principal.tenantId, input.documentId);
    const current = this.documents.get(key);
    if (!current) throw notFound("document not found in this scope");
    this.assertAuthorized(principal, current.resourceId, "brand.design.preview", null);

    const payload = { documentId: input.documentId, version: input.expectedVersion, patch: input.patch };
    const started = this.idempotency.begin({
      tenantId: principal.tenantId,
      operationKey: input.operationKey,
      payload,
      now: this.now(),
    });
    if (started.status === "replay") {
      const replayed = this.documents.get(key)!;
      return { document: replayed, inverse: started.result, payloadHash: started.payloadHash };
    }

    const result = applyComposition(current, input, this.now());
    this.documents.set(key, result.document);
    this.audit.append({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: "document.updated",
      resourceId: current.resourceId,
      payload: { from: current.version, to: result.document.version, hash: documentHash(result.document) },
      correlationId: `doc:${input.documentId}`,
      now: this.now(),
    });
    this.idempotency.complete(principal.tenantId, input.operationKey, result.inverse);
    return { document: result.document, inverse: result.inverse, payloadHash: started.payloadHash };
  }

  preflight(principal: Principal, input: Omit<ExportRequest, "tenantId" | "manifestId"> & { manifestId?: string }): {
    ok: boolean;
    blockers: { code: string; detail: string }[];
    manifest: ExportManifest | null;
    renderFingerprint: string;
  } {
    const document = [...this.documents.values()].find(
      (doc) => doc.tenantId === principal.tenantId && doc.documentId === input.deliverableId,
    );
    if (!document) throw notFound("deliverable not found in this scope");
    this.assertAuthorized(principal, document.resourceId, "brand.export.preview", null);

    const fonts = [...this.fonts.values()].filter((f) => f.tenantId === principal.tenantId);
    const ledger = [...this.ledger.values()].filter((r) => r.tenantId === principal.tenantId);
    const result = preflightExport(
      {
        ...input,
        manifestId: input.manifestId ?? this.newId("manifest"),
        tenantId: principal.tenantId,
        editableHash: documentHash(document),
        renderHash: renderFingerprint(document),
      },
      { fonts, ledger, now: this.now() },
    );

    this.audit.append({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: "export.preflight",
      resourceId: document.resourceId,
      payload: { ok: result.ok, blockers: result.blockers.map((b) => b.code) },
      correlationId: `export:${document.documentId}`,
      now: this.now(),
    });
    return { ...result, renderFingerprint: renderFingerprint(document) };
  }

  deliver(principal: Principal, input: {
    approvalId: string;
    receiverId: string;
    action: "sandbox_delivery" | "publication";
    manifest: ExportManifest;
    payload: unknown;
    rights: unknown;
    policy: unknown;
    cost: Money;
    correlationId: string;
  }): DeliveryReceipt {
    const approval = this.approvals.get(this.aclKey(principal.tenantId, input.approvalId));
    if (!approval) throw notFound("approval not found in this scope");
    const deliverable = [...this.documents.values()].find(
      (doc) => doc.tenantId === principal.tenantId && doc.documentId === input.manifest.deliverableId,
    );
    if (!deliverable) throw notFound("deliverable not found in this scope");
    this.assertAuthorized(principal, deliverable.resourceId, "brand.deliver.propose", null);

    const approvedMaterial = {
      content: input.payload,
      manifest: input.manifest,
      receiverId: input.receiverId,
      action: input.action,
    };
    const evaluation = evaluateApproval(
      approval,
      {
        tenantId: principal.tenantId,
        payload: approvedMaterial,
        resourceVersion: approval.resourceVersion,
        rights: input.rights,
        policy: input.policy,
        scope: approval.scope,
        recipient: approval.recipient,
        channel: approval.channel,
      },
      { now: this.now(), cost: input.cost },
    );
    if (!evaluation.ok) throw new ApiError("needs_review", `approval rejected: ${evaluation.reason}`, {
      details: { reason: evaluation.reason },
    });

    const receiver = this.receivers.get(`${principal.tenantId}::${input.receiverId}`);
    if (!receiver) throw notFound("receiver not found in this scope");
    assertReceiverCanReceive(receiver, {
      tenantId: principal.tenantId,
      deliverableId: input.manifest.deliverableId,
      now: this.now(),
    });

    assertDeliveryAuthorized({ action: input.action, approvalScope: approval.scope });

    const receipt: DeliveryReceipt = {
      receiptId: this.newId("receipt"),
      tenantId: principal.tenantId,
      deliverableId: input.manifest.deliverableId,
      manifestId: input.manifest.manifestId,
      receiverId: receiver.receiverId,
      action: input.action,
      acceptedAt: this.now().toISOString(),
      manifestChecksum: input.manifest.checksum,
      correlationId: input.correlationId,
    };
    this.receipts.set(receipt.receiptId, receipt);
    this.outbox.enqueue({
      eventId: receipt.receiptId,
      tenantId: principal.tenantId,
      type: "branding.operation.confirmed",
      payload: { deliverableId: receipt.deliverableId, manifestId: receipt.manifestId },
      now: this.now(),
    });
    this.audit.append({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: "delivery.completed",
      resourceId: input.manifest.deliverableId,
      payload: receipt,
      correlationId: input.correlationId,
      now: this.now(),
    });
    return receipt;
  }

  createReport(principal: Principal, input: {
    resourceId: string;
    metricDefinitions: { metricId: string; definition: string }[];
    values: { metricId: string; value: number; unit: string; sourceRef: string; coverage: string }[];
  }): ReportSnapshot {
    this.assertAuthorized(principal, input.resourceId, "brand.report.read", null);
    const snapshot = createReportSnapshot({
      snapshotId: this.newId("report"),
      tenantId: principal.tenantId,
      resourceId: input.resourceId,
      metricDefinitions: input.metricDefinitions,
      values: input.values,
      createdAt: this.now(),
    });
    this.reports.set(snapshot.snapshotId, snapshot);
    return snapshot;
  }

  openAdvisorSession(principal: Principal, input: {
    resourceId: string;
    personaId: string;
    capabilities: string[];
    budget: Money;
    ttlSeconds: number;
  }): AdvisorSession {
    this.assertAuthorized(principal, input.resourceId, "brand.advisor.session", null);
    const session: AdvisorSession = {
      sessionId: this.newId("session"),
      tenantId: principal.tenantId,
      resourceId: input.resourceId,
      twinBindingId: this.newId("twin"),
      capabilities: input.capabilities,
      budget: input.budget,
      expiresAt: new Date(this.now().getTime() + input.ttlSeconds * 1000).toISOString(),
      recordingEnabled: false,
      avTokenRef: null,
    };
    this.sessions.set(session.sessionId, session);
    return session;
  }

  closeAdvisorSession(principal: Principal, sessionId: string): AdvisorSession {
    const session = this.sessions.get(sessionId);
    if (!session || session.tenantId !== principal.tenantId) throw notFound("session not found in this scope");
    const closed = { ...session, expiresAt: this.now().toISOString(), avTokenRef: null };
    this.sessions.set(sessionId, closed);
    return closed;
  }

  capabilities(principal: Principal, connectionId: string, report: CapabilityReport): CapabilityReport {
    if (report.tenantId !== principal.tenantId) throw notFound("connection not found in this scope");
    if (!opaqueId.safeParse(connectionId).success) throw invalid("invalid connection id");
    return report;
  }

  operationResult(input: { operationId: string; status: OperationResult["status"]; payloadHash: string; scope: string }): OperationResult {
    return {
      operationId: input.operationId,
      status: input.status,
      localRefs: [],
      remoteRefs: [],
      evidenceRefs: [],
      payloadHash: input.payloadHash,
      warnings: [],
      retryable: input.status === "outcome_unknown" ? false : true,
      reconciliationRequired: input.status === "outcome_unknown" || input.status === "reconciliation_required",
      actualScope: input.scope,
    };
  }

  assertApprovalShape(approval: unknown): ApprovalBinding {
    const parsed = ApprovalBindingSchema.safeParse(approval);
    if (!parsed.success) throw conflict("approval record is malformed");
    return parsed.data;
  }

  evidenceHash(value: unknown): string {
    return sha256Hex(value);
  }
}
