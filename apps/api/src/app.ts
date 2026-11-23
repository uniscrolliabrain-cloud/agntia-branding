import { Hono, type Context } from "hono";
import { ZodError } from "zod";
import {
  ApiError,
  EnvelopeSchema,
  isApiError,
  MoneySchema,
  type ApprovalBinding,
  type CapabilityReport,
  type OperationResult,
} from "@agntia/contracts";
import type { ExportManifest } from "@agntia/domain";
import { assertNoEmbeddedDirectives, type DesignDocument } from "@agntia/domain";
import {
  resolvePrincipal,
  type Membership,
  type Principal,
} from "@agntia/identity";
import type { SupabaseJwtVerifier } from "@agntia/identity";
import type { BrandingService } from "./service.ts";
import { VerticalService } from "./verticals.ts";

export interface AppDependencies {
  verifier: Pick<SupabaseJwtVerifier, "verify">;
  memberships: Membership[];
  service: BrandingService;
  verticals?: VerticalService;
  capabilityReports?: Map<string, CapabilityReport>;
  newOperationId?: () => string;
}

/** Only provisioned review roles can issue an approval; the body never picks it. */
const APPROVAL_ROLE_BY_PRINCIPAL: Partial<Record<Principal["role"], ApprovalBinding["reviewerRole"]>> = {
  owner: "owner",
  brand_reviewer: "brand_reviewer",
  legal_reviewer: "legal_reviewer",
};

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ApiError("invalid_input", `${field} is required`);
  }
  return value;
}

type Variables = {
  principal: Principal;
  correlationId: string;
};

function correlationId(headers: Headers): string {
  const provided = headers.get("x-correlation-id");
  if (provided && /^[A-Za-z0-9._:-]{8,200}$/.test(provided)) return provided;
  return `cor_${crypto.randomUUID()}`;
}

/**
 * HTTP surface. Identity is resolved from the verified token only; the tenant
 * in a body is never trusted. Every route reuses the same PEP as the SDK.
 */
export function createApp(deps: AppDependencies): Hono<{ Variables: Variables }> {
  const app = new Hono<{ Variables: Variables }>();
  const verticals = deps.verticals ?? new VerticalService(deps.service);
  const jobs = new Map<string, OperationResult>();
  let operationCounter = 0;
  const newOperationId = deps.newOperationId ?? (() => `op_${(++operationCounter).toString().padStart(8, "0")}`);

  app.use("*", async (c, next) => {
    c.set("correlationId", correlationId(c.req.raw.headers));
    await next();
  });

  const requirePrincipal = async (c: Context<{ Variables: Variables }>) => {
    const header = c.req.header("authorization") ?? "";
    if (!header.startsWith("Bearer ")) throw new ApiError("unauthenticated", "missing bearer token");
    const token = header.slice("Bearer ".length).trim();
    const claims = await deps.verifier.verify(token);
    const principal = resolvePrincipal({ claims, memberships: deps.memberships });
    c.set("principal", principal);
    return principal;
  };

  app.get("/health", (c) => c.json({ status: "ok", service: "agntia-branding", version: "0.1.0" }));

  app.get("/v1/branding/me", async (c) => {
    const principal = await requirePrincipal(c);
    return c.json({
      userId: principal.userId,
      tenantId: principal.tenantId,
      role: principal.role,
      scopes: principal.scopes,
      kind: principal.kind,
    });
  });

  app.get("/v1/branding/resources", async (c) => {
    const principal = await requirePrincipal(c);
    const rows = deps.service.resources.list(principal.tenantId);
    return c.json({
      resources: rows.map((row) => ({ resourceId: row.resourceId, version: row.version, updatedAt: row.updatedAt })),
    });
  });

  app.get("/v1/branding/resources/:resourceId", async (c) => {
    const principal = await requirePrincipal(c);
    const resourceId = c.req.param("resourceId");
    deps.service.assertAuthorized(principal, resourceId, "brand.brief.propose", null);
    const row = deps.service.resources.get(principal.tenantId, resourceId);
    return c.json({ resourceId: row.resourceId, version: row.version, payload: row.payload });
  });

  app.post("/v1/branding/proposals", async (c) => {
    const principal = await requirePrincipal(c);
    const body = (await c.req.json()) as { capability?: string; resourceId?: string; payload?: Record<string, unknown> };
    if (!body.capability || !body.resourceId || !body.payload) throw new ApiError("invalid_input", "capability, resourceId and payload are required");

    if (body.capability === "brand.brief.propose") {
      const payload = body.payload as {
        purpose?: string | null;
        audienceDeclared?: string | null;
        deliverables?: string[];
        constraints?: string[];
        acceptance?: string[];
      };
      const result = deps.service.createBrief(principal, {
        resourceId: body.resourceId,
        purpose: payload.purpose ?? null,
        audienceDeclared: payload.audienceDeclared ?? null,
        deliverables: payload.deliverables ?? [],
        constraints: payload.constraints ?? [],
        acceptance: payload.acceptance ?? [],
      });
      return c.json({ proposalId: result.brief.briefId, version: result.version, brief: result.brief, pendingFacts: result.brief.pendingFacts }, 201);
    }

    if (body.capability === "brand.document.update") {
      const payload = body.payload as {
        documentId?: string;
        expectedVersion?: number;
        patch?: { upsert: DesignDocument["nodes"]; remove: string[]; constraints?: string[] };
        operationKey?: string;
      };
      if (!payload.documentId || payload.expectedVersion === undefined || !payload.patch || !payload.operationKey) {
        throw new ApiError("invalid_input", "documentId, expectedVersion, patch and operationKey are required");
      }
      const result = deps.service.updateDocument(principal, {
        documentId: payload.documentId,
        expectedVersion: payload.expectedVersion,
        patch: payload.patch,
        operationKey: payload.operationKey,
      });
      return c.json({ document: result.document, payloadHash: result.payloadHash, inverse: result.inverse });
    }

    throw new ApiError("forbidden", `capability ${body.capability} is not exposed through proposals`);
  });

  app.post("/v1/branding/proposals/:proposalId/preview", async (c) => {
    const principal = await requirePrincipal(c);
    const body = (await c.req.json()) as {
      capability?: string;
      documentId?: string;
      purpose?: "internal_review" | "client_delivery" | "publication" | "paid_media";
      dpi?: number;
      colorProfile?: "sRGB" | "DisplayP3" | "CMYK_FOGRA39" | "GRAYSCALE";
      fontIds?: string[];
      assetHashes?: string[];
      svg?: string[];
      textQaOk?: boolean;
      rightsOk?: boolean;
    };
    if (body.capability !== "brand.export.preview") {
      throw new ApiError("forbidden", `capability ${String(body.capability)} is not exposed through preview`);
    }
    if (!body.documentId) throw new ApiError("invalid_input", "documentId is required");

    const result = deps.service.preflight(principal, {
      deliverableId: body.documentId,
      editableHash: "",
      renderHash: "",
      dpi: body.dpi ?? 72,
      colorProfile: body.colorProfile ?? "sRGB",
      renderEngine: "branding-dom",
      renderEngineVersion: "0.1.0",
      purpose: body.purpose ?? "internal_review",
      fontIds: body.fontIds ?? [],
      assetHashes: body.assetHashes ?? [],
      svg: body.svg ?? [],
      textQaOk: body.textQaOk ?? false,
      rightsOk: body.rightsOk ?? false,
    });

    return c.json({ ok: result.ok, blockers: result.blockers, manifest: result.manifest }, result.ok ? 200 : 422);
  });

  app.post("/v1/branding/intents", async (c) => {
    const principal = await requirePrincipal(c);
    const envelope = EnvelopeSchema.parse(await c.req.json());
    if (envelope.tenantId !== principal.tenantId) throw new ApiError("forbidden", "envelope tenant does not match the principal");
    if (envelope.capability !== "brand.deliver.propose") {
      throw new ApiError("forbidden", `capability ${envelope.capability} is not exposed through intents`);
    }

    const payload = envelope.payload as {
      approvalId?: string;
      receiverId?: string;
      action?: "sandbox_delivery" | "publication";
      manifest?: { checksum: string; deliverableId: string; manifestId: string };
      cost?: { amount: string; currency: string; exponent: number };
      rights?: unknown;
      policy?: unknown;
      content?: unknown;
    };
    if (!payload.approvalId || !payload.receiverId || !payload.action || !payload.manifest || !payload.cost) {
      throw new ApiError("invalid_input", "approvalId, receiverId, action, manifest and cost are required");
    }

    const started = deps.service.idempotency.begin({
      tenantId: principal.tenantId,
      operationKey: envelope.idempotencyKey ?? envelope.operationId,
      payload,
      now: new Date(),
    });
    if (started.status === "replay") {
      return c.json({ result: started.result });
    }

    const receipt = deps.service.deliver(principal, {
      approvalId: payload.approvalId,
      receiverId: payload.receiverId,
      action: payload.action,
      manifest: payload.manifest as unknown as ExportManifest,
      payload: payload.content ?? payload,
      rights: payload.rights ?? null,
      policy: payload.policy ?? null,
      cost: payload.cost,
      correlationId: envelope.correlationId,
    });

    const result = deps.service.operationResult({
      operationId: newOperationId(),
      status: "confirmed",
      payloadHash: started.payloadHash,
      scope: `deliverable:${receipt.deliverableId}`,
    });
    jobs.set(result.operationId, result);
    deps.service.idempotency.complete(principal.tenantId, envelope.idempotencyKey ?? envelope.operationId, { receipt, result });
    return c.json({ result, receipt }, 202);
  });

  app.get("/v1/branding/jobs/:jobId", async (c) => {
    await requirePrincipal(c);
    const job = jobs.get(c.req.param("jobId"));
    if (!job) throw new ApiError("not_found", "job not found in this scope");
    return c.json(job);
  });

  app.get("/v1/branding/integrations/:connectionId/capabilities", async (c) => {
    const principal = await requirePrincipal(c);
    const report = deps.capabilityReports?.get(c.req.param("connectionId"));
    if (!report) throw new ApiError("not_found", "connection not found in this scope");
    const scoped = deps.service.capabilities(principal, c.req.param("connectionId"), report);
    return c.json(scoped);
  });

  app.post("/v1/branding/imports/preview", async (c) => {
    const principal = await requirePrincipal(c);
    const body = (await c.req.json()) as { sourceId?: string; text?: string; usageRights?: string };
    if (!body.sourceId || typeof body.text !== "string") throw new ApiError("invalid_input", "sourceId and text are required");
    assertNoEmbeddedDirectives(body.text);
    deps.service.assertAuthorized(principal, body.sourceId, "brand.research.preview", null);
    return c.json({
      sourceId: body.sourceId,
      preview: body.text.slice(0, 2000),
      usageRights: body.usageRights ?? "unknown",
      persisted: false,
      warnings: body.usageRights === "licensed" ? [] : ["source is not licensed for redistribution"],
    });
  });

  app.post("/v1/branding/reports", async (c) => {
    const principal = await requirePrincipal(c);
    const body = (await c.req.json()) as {
      resourceId?: string;
      metricDefinitions?: { metricId: string; definition: string }[];
      values?: { metricId: string; value: number; unit: string; sourceRef: string; coverage: string }[];
    };
    if (!body.resourceId || !body.metricDefinitions || !body.values) {
      throw new ApiError("invalid_input", "resourceId, metricDefinitions and values are required");
    }
    const snapshot = deps.service.createReport(principal, {
      resourceId: body.resourceId,
      metricDefinitions: body.metricDefinitions,
      values: body.values,
    });
    return c.json(snapshot, 201);
  });

  app.get("/v1/branding/reports/:reportId", async (c) => {
    const principal = await requirePrincipal(c);
    const report = deps.service.reports.get(c.req.param("reportId"));
    if (!report || report.tenantId !== principal.tenantId) throw new ApiError("not_found", "report not found in this scope");
    return c.json(report);
  });

  app.post("/v1/branding/advisor-sessions", async (c) => {
    const principal = await requirePrincipal(c);
    const body = (await c.req.json()) as {
      resourceId?: string;
      personaId?: string;
      capabilities?: string[];
      budget?: { amount: string; currency: string; exponent: number };
      ttlSeconds?: number;
    };
    if (!body.resourceId || !body.personaId || !body.capabilities || !body.budget) {
      throw new ApiError("invalid_input", "resourceId, personaId, capabilities and budget are required");
    }
    const session = deps.service.openAdvisorSession(principal, {
      resourceId: body.resourceId,
      personaId: body.personaId,
      capabilities: body.capabilities,
      budget: body.budget,
      ttlSeconds: Math.min(Math.max(body.ttlSeconds ?? 600, 30), 3600),
    });
    return c.json({ ...session, avToken: null, fallback: "text" }, 201);
  });

  app.post("/v1/branding/advisor-sessions/:sessionId/close", async (c) => {
    const principal = await requirePrincipal(c);
    return c.json(deps.service.closeAdvisorSession(principal, c.req.param("sessionId")));
  });

  app.post("/v1/branding/verticals", async (c) => {
    const principal = await requirePrincipal(c);
    const body = (await c.req.json()) as { verticalId?: string; resourceId?: string; documentId?: string };
    const record = verticals.create(principal, {
      verticalId: body.verticalId ?? null,
      resourceId: requiredString(body.resourceId, "resourceId"),
      documentId: requiredString(body.documentId, "documentId"),
    });
    return c.json({ record }, 201);
  });

  app.get("/v1/branding/verticals/:verticalId", async (c) => {
    const principal = await requirePrincipal(c);
    return c.json({ record: verticals.get(principal, c.req.param("verticalId")) });
  });

  app.post("/v1/branding/verticals/:verticalId/stages/:stage", async (c) => {
    const principal = await requirePrincipal(c);
    const body = (await c.req.json()) as Record<string, unknown>;
    return c.json(verticals.advance(principal, c.req.param("verticalId"), c.req.param("stage"), body));
  });

  /**
   * Approval must come from a provisioned human reviewer. Competence is taken
   * from server membership, never from the request body, and the proposer can
   * never approve its own effect.
   */
  app.post("/v1/branding/approvals", async (c) => {
    const principal = await requirePrincipal(c);
    if (principal.kind !== "human") throw new ApiError("forbidden", "approval requires a human principal");
    const reviewerRole = APPROVAL_ROLE_BY_PRINCIPAL[principal.role];
    if (!reviewerRole) throw new ApiError("forbidden", "role cannot issue an approval");
    if (!principal.scopes.includes("brand.review.decide")) {
      throw new ApiError("forbidden", "review decision scope is not provisioned");
    }

    const body = (await c.req.json()) as {
      approvalId?: string;
      resourceId?: string;
      resourceVersion?: number;
      payload?: unknown;
      rights?: unknown;
      policy?: unknown;
      scope?: string;
      recipient?: string;
      channel?: string;
      costCeiling?: unknown;
      expiresAt?: string;
      proposerId?: string;
    };
    if (body.payload === undefined) throw new ApiError("invalid_input", "payload is required");
    if (typeof body.resourceVersion !== "number" || !Number.isInteger(body.resourceVersion) || body.resourceVersion < 0) {
      throw new ApiError("invalid_input", "resourceVersion must be a non-negative integer");
    }
    const expiresAt = requiredString(body.expiresAt, "expiresAt");
    if (new Date(expiresAt).getTime() <= Date.now()) throw new ApiError("invalid_input", "expiresAt must be in the future");

    const approval = deps.service.grantApproval({
      principal,
      approvalId: requiredString(body.approvalId, "approvalId"),
      resourceId: requiredString(body.resourceId, "resourceId"),
      payload: body.payload,
      resourceVersion: body.resourceVersion,
      rights: body.rights ?? null,
      policy: body.policy ?? null,
      scope: requiredString(body.scope, "scope"),
      recipient: requiredString(body.recipient, "recipient"),
      channel: requiredString(body.channel, "channel"),
      costCeiling: MoneySchema.parse(body.costCeiling),
      expiresAt,
      reviewerRole,
      proposerId: requiredString(body.proposerId, "proposerId"),
      competenceVerified: true,
    });
    return c.json({ approval }, 201);
  });

  app.onError((error, c) => {
    const correlation = c.get("correlationId");
    if (isApiError(error)) {
      return c.json(error.toResponse(correlation), error.status as never);
    }
    if (error instanceof ZodError) {
      const apiError = new ApiError("invalid_input", "request does not match the contract");
      return c.json(apiError.toResponse(correlation), 400);
    }
    const apiError = new ApiError("internal_error", "unexpected error");
    return c.json(apiError.toResponse(correlation), 500);
  });

  app.notFound((c) => {
    const apiError = new ApiError("not_found", "route not found");
    return c.json(apiError.toResponse(c.get("correlationId")), 404);
  });

  return app;
}
