import {
  conflict,
  forbidden,
  invalid,
  MoneySchema,
  notFound,
  opaqueId,
  type Money,
} from "@agntia/contracts";
import {
  assertBrandbookCurrent,
  assertNoEmbeddedDirectives,
  assertResearchUsable,
  brandbookPayloadHash,
  BrandbookSnapshotSchema,
  buildTokens,
  ContrastPairSchema,
  DesignDocumentSchema,
  documentHash,
  evaluateClearance,
  evaluatePalette,
  evaluateQualityGate,
  GeometryCheckSchema,
  isBriefReady,
  proposeBrief,
  proposeNameCandidates,
  ResearchSourceSchema,
  TokenSetSchema,
  validateTokenSet,
  validateVoiceProfile,
  verifyText,
  VoiceProfileSchema,
  CLEARANCE_RESULTS,
  type BrandBrief,
  type BrandbookSnapshot,
  type ClearanceCheck,
  type DeliveryReceipt,
  type DesignDocument,
  type DesignNode,
  type ExportBlocker,
  type ExportManifest,
  type NameCandidate,
  type QualityEvaluation,
  type ResearchSource,
  type TokenSet,
  type VoiceProfile,
} from "@agntia/domain";
import type { Principal } from "@agntia/identity";
import type { BrandingService } from "./service.ts";

/**
 * The P0 vertical of the service, as executable slices. A slice is not a
 * provider integration: every gate is deterministic and local. Stages must run
 * in order; unknown or skipped stages are refused, never silently filled.
 */
export const VERTICAL_STAGES = [
  "brief",
  "research",
  "naming",
  "clearance",
  "voice",
  "tokens",
  "design",
  "qa",
  "review",
  "export",
  "delivery",
  "brandbook",
] as const;

export type VerticalStage = (typeof VERTICAL_STAGES)[number];
export type VerticalStatus = "in_progress" | "needs_input" | "completed";

export interface VerticalArtifacts {
  brief: BrandBrief | null;
  research: { purpose: "analysis" | "redistribution"; sources: ResearchSource[] } | null;
  naming: NameCandidate[] | null;
  clearance: ClearanceCheck | null;
  voice: VoiceProfile | null;
  tokens: {
    set: TokenSet;
    outputs: Record<string, string>;
    inputHash: string;
    contrast: { passed: boolean; findings: { pairId: string; ratio: number; required: number; status: string }[] };
  } | null;
  design: { documentHash: string; version: number } | null;
  qa: {
    text: { ok: boolean; findings: { code: string; severity: string; detail: string }[] };
    gate: { passed: boolean; reasons: string[] };
    readyForReview: boolean;
    rightsOk: boolean;
    securityOk: boolean;
  } | null;
  review: {
    reviewerId: string;
    reviewerRole: string;
    decision: "approved" | "rejected";
    reviewedDocumentHash: string;
    decidedAt: string;
  } | null;
  export: { manifest: ExportManifest } | { blockers: ExportBlocker[] } | null;
  delivery: { receipt: DeliveryReceipt } | null;
  brandbook: { snapshot: BrandbookSnapshot; payloadHash: string } | null;
}

export interface VerticalRecord {
  verticalId: string;
  tenantId: string;
  resourceId: string;
  documentId: string;
  createdBy: string;
  status: VerticalStatus;
  nextStage: VerticalStage;
  completedStages: VerticalStage[];
  attention: string[];
  artifacts: VerticalArtifacts;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface VerticalServiceOptions {
  now?: () => Date;
  newId?: (prefix: string) => string;
}

const STAGE_CAPABILITY: Record<VerticalStage, string> = {
  brief: "brand.brief.propose",
  research: "brand.research.preview",
  naming: "brand.brief.propose",
  clearance: "brand.brief.propose",
  voice: "brand.brief.propose",
  tokens: "brand.design.preview",
  design: "brand.document.update",
  qa: "brand.design.preview",
  review: "brand.review.decide",
  export: "brand.export.preview",
  delivery: "brand.deliver.propose",
  brandbook: "brand.export.preview",
};

const REVIEWER_ROLES = new Set(["owner", "brand_reviewer", "legal_reviewer"]);

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw invalid(`${field} is required`);
  return value;
}

function optionalString(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw invalid(`${field} must be a string`);
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function stringArray(value: unknown, field: string, min: number): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim().length === 0)) {
    throw invalid(`${field} must be an array of non-empty strings`);
  }
  if (value.length < min) throw invalid(`${field} requires at least ${min} item(s)`);
  return value as string[];
}

function objectArray(value: unknown, field: string, min = 1): Record<string, unknown>[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "object" || item === null || Array.isArray(item))) {
    throw invalid(`${field} must be an array of objects`);
  }
  if (value.length < min) throw invalid(`${field} requires at least ${min} item(s)`);
  return value as Record<string, unknown>[];
}

function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") throw invalid(`${field} must be a boolean`);
  return value;
}

function requireEnum<T extends readonly string[]>(value: unknown, allowed: T, field: string): T[number] {
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw invalid(`${field} must be one of: ${allowed.join(", ")}`);
  }
  return value as T[number];
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function emptyArtifacts(): VerticalArtifacts {
  return {
    brief: null,
    research: null,
    naming: null,
    clearance: null,
    voice: null,
    tokens: null,
    design: null,
    qa: null,
    review: null,
    export: null,
    delivery: null,
    brandbook: null,
  };
}

const ARTIFACT_KEY: Record<VerticalStage, keyof VerticalArtifacts> = {
  brief: "brief",
  research: "research",
  naming: "naming",
  clearance: "clearance",
  voice: "voice",
  tokens: "tokens",
  design: "design",
  qa: "qa",
  review: "review",
  export: "export",
  delivery: "delivery",
  brandbook: "brandbook",
};

interface StageOutcome {
  complete: boolean;
  attention: string[];
}

/**
 * Application-level vertical runner. It composes the deterministic domain with
 * the tenant-scoped service (ACL, documents, audit, approvals, delivery) and
 * keeps explicit stage state so a client cannot skip a gate.
 */
export class VerticalService {
  private readonly verticals = new Map<string, VerticalRecord>();
  private readonly now: () => Date;
  private readonly newId: (prefix: string) => string;

  constructor(
    private readonly branding: BrandingService,
    options: VerticalServiceOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    let counter = 0;
    this.newId = options.newId ?? ((prefix) => `${prefix}_${(++counter).toString().padStart(8, "0")}`);
  }

  private key(tenantId: string, verticalId: string): string {
    return `${tenantId}::${verticalId}`;
  }

  create(
    principal: Principal,
    input: { verticalId?: string | null; resourceId: string; documentId: string },
  ): VerticalRecord {
    const resourceId = requireString(input.resourceId, "resourceId");
    const documentId = requireString(input.documentId, "documentId");
    if (!opaqueId.safeParse(resourceId).success) throw invalid("resourceId must be an opaque id");
    if (!opaqueId.safeParse(documentId).success) throw invalid("documentId must be an opaque id");
    const verticalId = input.verticalId ? requireString(input.verticalId, "verticalId") : this.newId("vertical");
    if (!opaqueId.safeParse(verticalId).success) throw invalid("verticalId must be an opaque id");

    this.branding.assertAuthorized(principal, resourceId, "brand.brief.propose", null);
    if (this.verticals.has(this.key(principal.tenantId, verticalId))) {
      throw conflict("vertical id already exists in this tenant");
    }

    const at = this.now().toISOString();
    const record: VerticalRecord = {
      verticalId,
      tenantId: principal.tenantId,
      resourceId,
      documentId,
      createdBy: principal.userId,
      status: "in_progress",
      nextStage: "brief",
      completedStages: [],
      attention: [],
      artifacts: emptyArtifacts(),
      createdAt: at,
      updatedAt: at,
      version: 0,
    };
    this.verticals.set(this.key(principal.tenantId, verticalId), record);
    this.branding.audit.append({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: "vertical.started",
      resourceId,
      payload: { verticalId, documentId },
      correlationId: `vertical:${verticalId}`,
      now: this.now(),
    });
    return clone(record);
  }

  get(principal: Principal, verticalId: string): VerticalRecord {
    const record = this.verticals.get(this.key(principal.tenantId, requireString(verticalId, "verticalId")));
    if (!record) throw notFound("vertical not found in this scope");
    return clone(record);
  }

  advance(
    principal: Principal,
    verticalId: string,
    stage: string,
    input: Record<string, unknown>,
  ): { record: VerticalRecord; artifact: VerticalArtifacts[keyof VerticalArtifacts] } {
    const record = this.verticals.get(this.key(principal.tenantId, requireString(verticalId, "verticalId")));
    if (!record) throw notFound("vertical not found in this scope");

    if (!(VERTICAL_STAGES as readonly string[]).includes(stage)) {
      throw invalid(`unknown vertical stage ${stage}`);
    }
    const typedStage = stage as VerticalStage;

    const capability = STAGE_CAPABILITY[typedStage];
    this.branding.assertAuthorized(principal, record.resourceId, capability, null);

    const operationKey = requireString(input.operationKey, "operationKey");
    if (operationKey.length < 8) throw invalid("operationKey must have at least 8 characters");
    const { operationKey: _ignored, ...payload } = input;
    const namespacedKey = `vertical:${record.verticalId}:${typedStage}:${operationKey}`;

    const started = this.branding.idempotency.begin({
      tenantId: principal.tenantId,
      operationKey: namespacedKey,
      payload: { verticalId: record.verticalId, stage: typedStage, payload },
      now: this.now(),
    });
    if (started.status === "replay") {
      const replayed = started.result as VerticalRecord;
      return { record: clone(replayed), artifact: replayed.artifacts[ARTIFACT_KEY[typedStage]] };
    }

    let outcome: StageOutcome;
    try {
      if (record.completedStages.includes(typedStage)) {
        throw conflict(`stage ${typedStage} is already completed`);
      }
      if (record.nextStage !== typedStage) {
        throw conflict(`expected stage ${record.nextStage}, received ${typedStage}`);
      }
      if (typedStage === "review") this.assertReviewer(principal, record);
      outcome = this.runStage(principal, record, typedStage, payload);
    } catch (error) {
      this.branding.idempotency.abort(principal.tenantId, namespacedKey);
      throw error;
    }

    record.version += 1;
    record.updatedAt = this.now().toISOString();
    record.attention = outcome.attention;

    if (!outcome.complete) {
      record.status = "needs_input";
      record.nextStage = typedStage;
    } else {
      record.completedStages.push(typedStage);
      const index = VERTICAL_STAGES.indexOf(typedStage);
      const next = VERTICAL_STAGES[index + 1];
      if (next) {
        record.nextStage = next;
        record.status = "in_progress";
      } else {
        record.nextStage = typedStage;
        record.status = "completed";
      }
    }

    this.branding.audit.append({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: `vertical.${typedStage}.${outcome.complete ? "completed" : "needs_input"}`,
      resourceId: record.resourceId,
      payload: { verticalId: record.verticalId, version: record.version, attention: outcome.attention },
      correlationId: `vertical:${record.verticalId}`,
      now: this.now(),
    });
    this.branding.idempotency.complete(principal.tenantId, namespacedKey, clone(record));

    return { record: clone(record), artifact: record.artifacts[ARTIFACT_KEY[typedStage]] };
  }

  private assertReviewer(principal: Principal, record: VerticalRecord): void {
    if (principal.kind !== "human") throw forbidden("review requires a human principal");
    if (!REVIEWER_ROLES.has(principal.role)) throw forbidden("role cannot decide a brand review");
    if (principal.userId === record.createdBy) throw forbidden("the proposer cannot review its own vertical");
  }

  private currentDocument(
    principal: Principal,
    record: VerticalRecord,
    capability = "brand.design.preview",
  ): DesignDocument | null {
    return this.branding.requireDocument(principal, record.documentId, capability);
  }

  private runStage(
    principal: Principal,
    record: VerticalRecord,
    stage: VerticalStage,
    payload: Record<string, unknown>,
  ): StageOutcome {
    switch (stage) {
      case "brief":
        return this.stageBrief(principal, record, payload);
      case "research":
        return this.stageResearch(principal, record, payload);
      case "naming":
        return this.stageNaming(principal, record, payload);
      case "clearance":
        return this.stageClearance(principal, record, payload);
      case "voice":
        return this.stageVoice(principal, record, payload);
      case "tokens":
        return this.stageTokens(principal, record, payload);
      case "design":
        return this.stageDesign(principal, record, payload);
      case "qa":
        return this.stageQa(principal, record, payload);
      case "review":
        return this.stageReview(principal, record, payload);
      case "export":
        return this.stageExport(principal, record, payload);
      case "delivery":
        return this.stageDelivery(principal, record, payload);
      case "brandbook":
        return this.stageBrandbook(principal, record, payload);
      default: {
        const exhaustive: never = stage;
        throw invalid(`unsupported stage ${String(exhaustive)}`);
      }
    }
  }

  private stageBrief(principal: Principal, record: VerticalRecord, payload: Record<string, unknown>): StageOutcome {
    const brief = proposeBrief({
      briefId: this.newId("brief"),
      tenantId: principal.tenantId,
      resourceId: record.resourceId,
      purpose: optionalString(payload.purpose, "purpose"),
      audienceDeclared: optionalString(payload.audienceDeclared, "audienceDeclared"),
      deliverables: stringArray(payload.deliverables, "deliverables", 1),
      constraints: payload.constraints === undefined ? [] : stringArray(payload.constraints, "constraints", 0),
      acceptance: stringArray(payload.acceptance, "acceptance", 1),
      version: 0,
    });
    record.artifacts.brief = brief;
    if (!isBriefReady(brief)) {
      return { complete: false, attention: brief.pendingFacts };
    }
    return { complete: true, attention: [] };
  }

  private stageResearch(principal: Principal, record: VerticalRecord, payload: Record<string, unknown>): StageOutcome {
    if (!record.artifacts.brief) throw conflict("brief must be completed before research");
    const purpose = requireEnum(payload.purpose, ["analysis", "redistribution"] as const, "purpose");
    const rawSources = objectArray(payload.sources, "sources", 1);
    const sources = rawSources.map((raw) => {
      const excerpt = optionalString(raw.excerpt, "excerpt");
      if (excerpt) assertNoEmbeddedDirectives(excerpt);
      const source = ResearchSourceSchema.parse({
        sourceId: typeof raw.sourceId === "string" && raw.sourceId.length > 0 ? raw.sourceId : this.newId("source"),
        tenantId: principal.tenantId,
        url: raw.url,
        observedAt: typeof raw.observedAt === "string" ? raw.observedAt : this.now().toISOString(),
        usageRights: raw.usageRights,
        licenseRef: typeof raw.licenseRef === "string" && raw.licenseRef.length > 0 ? raw.licenseRef : null,
        inferenceLabel: raw.inferenceLabel,
        untrustedContent: true,
      });
      assertResearchUsable(source, purpose);
      return source;
    });
    record.artifacts.research = { purpose, sources };
    return { complete: true, attention: [] };
  }

  private stageNaming(principal: Principal, record: VerticalRecord, payload: Record<string, unknown>): StageOutcome {
    if (!record.artifacts.brief) throw conflict("brief must be completed before naming");
    const rawCandidates = objectArray(payload.candidates, "candidates", 1);
    const candidates = proposeNameCandidates(
      rawCandidates.map((raw) => ({
        name: requireString(raw.name, "candidate.name"),
        locale: requireString(raw.locale, "candidate.locale"),
        rationale: requireString(raw.rationale, "candidate.rationale"),
        uncertainty: requireEnum(raw.uncertainty, ["low", "medium", "high"] as const, "candidate.uncertainty"),
      })),
      { tenantId: principal.tenantId, newId: () => this.newId("candidate") },
    );
    record.artifacts.naming = candidates;
    return { complete: true, attention: [] };
  }

  private stageClearance(principal: Principal, record: VerticalRecord, payload: Record<string, unknown>): StageOutcome {
    const candidates = record.artifacts.naming;
    if (!candidates || candidates.length === 0) throw conflict("naming must be completed before clearance");
    const candidateId = requireString(payload.candidateId, "candidateId");
    if (!candidates.some((candidate) => candidate.candidateId === candidateId)) {
      throw invalid("candidateId does not belong to this vertical");
    }
    const claimed = requireEnum(payload.claimed, CLEARANCE_RESULTS, "claimed");
    const check = evaluateClearance({
      check: {
        checkId: this.newId("clearance"),
        tenantId: principal.tenantId,
        candidateId,
        registrySource: requireString(payload.registrySource, "registrySource"),
        territory: requireString(payload.territory, "territory"),
        classScope: stringArray(payload.classScope, "classScope", 1),
        requiredClasses: payload.requiredClasses === undefined ? [] : stringArray(payload.requiredClasses, "requiredClasses", 0),
        checkedAt: this.now().toISOString(),
        reviewer: optionalString(payload.reviewer, "reviewer"),
      },
      claimed,
    });
    record.artifacts.clearance = check;
    if (check.result !== "preliminary_no_conflict") {
      return { complete: false, attention: [`clearance:${check.result}`] };
    }
    return { complete: true, attention: [] };
  }

  private stageVoice(principal: Principal, record: VerticalRecord, payload: Record<string, unknown>): StageOutcome {
    if (!record.artifacts.clearance) throw conflict("clearance must be completed before voice");
    const profile = VoiceProfileSchema.parse({
      profileId: this.newId("voice"),
      tenantId: principal.tenantId,
      tone: stringArray(payload.tone, "tone", 1),
      lexicon: payload.lexicon === undefined ? [] : stringArray(payload.lexicon, "lexicon", 0),
      claims: objectArray(payload.claims ?? [], "claims", 0),
      localeRules:
        payload.localeRules && typeof payload.localeRules === "object" && !Array.isArray(payload.localeRules)
          ? payload.localeRules
          : {},
    });
    record.artifacts.voice = validateVoiceProfile(profile);
    return { complete: true, attention: [] };
  }

  private stageTokens(principal: Principal, record: VerticalRecord, payload: Record<string, unknown>): StageOutcome {
    if (!record.artifacts.voice) throw conflict("voice must be completed before tokens");
    const set = TokenSetSchema.parse({
      tokenSetId: this.newId("tokens"),
      tenantId: principal.tenantId,
      theme: requireString(payload.theme, "theme"),
      version: 0,
      tokens: objectArray(payload.tokens, "tokens", 1),
    });
    validateTokenSet(set);
    const built = buildTokens(set, {
      formats: ["css", "json"],
      transforms: ["name/kebab"],
      engineVersion: "0.1.0",
    });
    const pairs = ContrastPairSchema.array().min(1).parse(payload.pairs);
    const contrast = evaluatePalette(pairs);
    record.artifacts.tokens = {
      set,
      outputs: built.outputs,
      inputHash: built.inputHash,
      contrast: { passed: contrast.passed, findings: contrast.findings },
    };
    if (!contrast.passed) {
      return {
        complete: false,
        attention: contrast.findings
          .filter((finding) => finding.status === "fail")
          .map((finding) => `contrast:${finding.pairId}:${finding.ratio}`),
      };
    }
    return { complete: true, attention: [] };
  }

  private stageDesign(principal: Principal, record: VerticalRecord, payload: Record<string, unknown>): StageOutcome {
    if (!record.artifacts.tokens) throw conflict("tokens must be completed before design");
    const nodes = payload.nodes === undefined ? [] : objectArray(payload.nodes, "nodes", 0);
    const constraints = payload.constraints === undefined ? [] : stringArray(payload.constraints, "constraints", 0);
    const textSources = payload.textSources === undefined ? [] : stringArray(payload.textSources, "textSources", 0);
    const remove = payload.remove === undefined ? [] : stringArray(payload.remove, "remove", 0);

    const existing = this.currentDocument(principal, record, "brand.document.update");
    let document: DesignDocument;
    if (!existing) {
      if (nodes.length === 0) throw invalid("the first design stage requires at least one node");
      document = DesignDocumentSchema.parse({
        documentId: record.documentId,
        tenantId: principal.tenantId,
        resourceId: record.resourceId,
        version: 0,
        engine: "branding-dom",
        engineVersion: "0.1.0",
        nodes,
        constraints,
        textSources,
        fontHashes: payload.fontHashes === undefined ? [] : stringArray(payload.fontHashes, "fontHashes", 0),
        updatedAt: this.now().toISOString(),
      });
      document = this.branding.putDocument(principal, document);
    } else {
      if (nodes.length === 0 && remove.length === 0 && payload.constraints === undefined) {
        throw invalid("an existing design stage requires nodes, remove or constraints");
      }
      const updated = this.branding.updateDocument(principal, {
        documentId: record.documentId,
        expectedVersion: existing.version,
        patch: { upsert: nodes as unknown as DesignNode[], remove, ...(payload.constraints === undefined ? {} : { constraints }) },
        operationKey: `${record.verticalId}:design:${existing.version}`,
      });
      document = updated.document;
    }

    record.artifacts.design = { documentHash: documentHash(document), version: document.version };
    record.artifacts.qa = null;
    record.artifacts.review = null;
    record.artifacts.export = null;
    record.artifacts.delivery = null;
    record.artifacts.brandbook = null;
    return { complete: true, attention: [] };
  }

  private stageQa(principal: Principal, record: VerticalRecord, payload: Record<string, unknown>): StageOutcome {
    const design = record.artifacts.design;
    if (!design) throw conflict("design must be completed before qa");
    const document = this.currentDocument(principal, record);
    if (!document) throw notFound("design document not found in this scope");
    if (documentHash(document) !== design.documentHash) {
      throw conflict("design changed after the recorded slice; re-run design before qa");
    }

    const sourceText = requireString(payload.sourceText, "sourceText");
    const renderedText = requireString(payload.renderedText, "renderedText");
    const locale = requireString(payload.locale, "locale");
    const geometryChecks = GeometryCheckSchema.array().min(1).parse(payload.geometryChecks);
    const rightsOk = requireBoolean(payload.rightsOk, "rightsOk");
    const securityOk = requireBoolean(payload.securityOk, "securityOk");

    const text = verifyText({ sourceText, renderedText, locale });
    const evaluation: QualityEvaluation = {
      evaluationId: this.newId("evaluation"),
      tenantId: principal.tenantId,
      resourceId: record.resourceId,
      resourceVersion: document.version,
      geometryChecks,
      perceptionModel: "none",
      perceptionScore: null,
      findings: [],
      humanDecision: null,
    };
    const gate = evaluateQualityGate({ evaluation, textQa: { ok: text.ok }, rightsOk, securityOk });
    const readyForReview =
      text.ok && geometryChecks.every((check) => check.status === "pass") && rightsOk && securityOk;

    record.artifacts.qa = { text, gate, readyForReview, rightsOk, securityOk };
    record.artifacts.review = null;
    record.artifacts.export = null;
    record.artifacts.delivery = null;
    record.artifacts.brandbook = null;
    if (!readyForReview) {
      return { complete: false, attention: gate.reasons.length > 0 ? gate.reasons : ["qa_blocked"] };
    }
    return { complete: true, attention: [] };
  }

  private stageReview(principal: Principal, record: VerticalRecord, payload: Record<string, unknown>): StageOutcome {
    const qa = record.artifacts.qa;
    const design = record.artifacts.design;
    if (!qa || !design) throw conflict("qa must be completed before review");
    if (!qa.readyForReview) throw conflict("qa is not ready for review");
    const document = this.currentDocument(principal, record, "brand.review.decide");
    if (!document) throw notFound("design document not found in this scope");
    const currentHash = documentHash(document);
    if (currentHash !== design.documentHash) {
      throw conflict("design changed after qa; run design and qa again");
    }

    const decision = requireEnum(payload.decision, ["approved", "rejected"] as const, "decision");
    const claimedHash = payload.payloadHash === undefined ? currentHash : requireString(payload.payloadHash, "payloadHash");
    if (claimedHash !== currentHash) throw conflict("review payload hash does not match the current design");

    record.artifacts.review = {
      reviewerId: principal.userId,
      reviewerRole: principal.role,
      decision,
      reviewedDocumentHash: currentHash,
      decidedAt: this.now().toISOString(),
    };
    if (decision !== "approved") return { complete: false, attention: ["review_rejected"] };
    return { complete: true, attention: [] };
  }

  private stageExport(principal: Principal, record: VerticalRecord, payload: Record<string, unknown>): StageOutcome {
    const review = record.artifacts.review;
    const design = record.artifacts.design;
    if (!review || !design || review.decision !== "approved") {
      throw conflict("an approved review is required before export");
    }
    const document = this.currentDocument(principal, record, "brand.export.preview");
    if (!document) throw notFound("design document not found in this scope");
    if (documentHash(document) !== review.reviewedDocumentHash) {
      throw conflict("design changed after review; approval is no longer valid");
    }

    const result = this.branding.preflight(principal, {
      deliverableId: record.documentId,
      editableHash: "",
      renderHash: "",
      dpi: typeof payload.dpi === "number" ? payload.dpi : 72,
      colorProfile: requireEnum(payload.colorProfile, ["sRGB", "DisplayP3", "CMYK_FOGRA39", "GRAYSCALE"] as const, "colorProfile"),
      renderEngine: "branding-dom",
      renderEngineVersion: "0.1.0",
      purpose: requireEnum(
        payload.purpose,
        ["internal_review", "client_delivery", "publication", "paid_media"] as const,
        "purpose",
      ),
      fontIds: payload.fontIds === undefined ? [] : stringArray(payload.fontIds, "fontIds", 0),
      assetHashes: payload.assetHashes === undefined ? [] : stringArray(payload.assetHashes, "assetHashes", 0),
      svg: payload.svg === undefined ? [] : stringArray(payload.svg, "svg", 0),
      textQaOk: record.artifacts.qa?.text.ok ?? false,
      rightsOk: (record.artifacts.qa?.rightsOk ?? false) && record.artifacts.qa?.readyForReview === true,
    });

    if (!result.ok || !result.manifest) {
      record.artifacts.export = { blockers: result.blockers };
      return { complete: false, attention: result.blockers.map((blocker) => `export:${blocker.code}`) };
    }
    record.artifacts.export = { manifest: result.manifest };
    return { complete: true, attention: [] };
  }

  private stageDelivery(principal: Principal, record: VerticalRecord, payload: Record<string, unknown>): StageOutcome {
    const exported = record.artifacts.export;
    if (!exported || !("manifest" in exported)) throw conflict("a successful export is required before delivery");
    const cost: Money = MoneySchema.parse(payload.cost);

    const receipt = this.branding.deliver(principal, {
      approvalId: requireString(payload.approvalId, "approvalId"),
      receiverId: requireString(payload.receiverId, "receiverId"),
      action: requireEnum(payload.action, ["sandbox_delivery", "publication"] as const, "action"),
      manifest: exported.manifest,
      payload: payload.content ?? null,
      rights: payload.rights ?? null,
      policy: payload.policy ?? null,
      cost,
      correlationId: requireString(payload.correlationId, "correlationId"),
    });
    record.artifacts.delivery = { receipt };
    return { complete: true, attention: [] };
  }

  private stageBrandbook(principal: Principal, record: VerticalRecord, payload: Record<string, unknown>): StageOutcome {
    if (!record.artifacts.delivery) throw conflict("delivery must be completed before the brandbook");
    const tokens = record.artifacts.tokens;
    if (!tokens) throw conflict("tokens are missing from this vertical");

    const policyVersion = requireString(payload.policyVersion, "policyVersion");
    const previous = record.artifacts.brandbook;
    const snapshot = BrandbookSnapshotSchema.parse({
      brandbookId: this.newId("brandbook"),
      tenantId: principal.tenantId,
      policyVersion,
      rules: objectArray(payload.rules, "rules", 1),
      approvedAssets: payload.approvedAssets === undefined ? [] : stringArray(payload.approvedAssets, "approvedAssets", 0),
      tokenSetVersion: tokens.set.version,
      createdAt: this.now().toISOString(),
      supersedes: previous?.snapshot.brandbookId ?? null,
    });
    assertBrandbookCurrent(snapshot, policyVersion);
    record.artifacts.brandbook = { snapshot, payloadHash: brandbookPayloadHash(snapshot) };
    return { complete: true, attention: [] };
  }
}

