import { ApiError, ErrorResponseSchema, type CapabilityReport } from "@agntia/contracts";
import type { ExportManifest } from "@agntia/domain";

export interface BrandingClientOptions {
  baseUrl: string;
  /** Server-to-server token. Never a browser token, never logged. */
  accessToken: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface VerticalRecordView {
  verticalId: string;
  status: "in_progress" | "needs_input" | "completed";
  nextStage: string;
  completedStages: string[];
  attention: string[];
  version: number;
  artifacts: Record<string, unknown>;
}

export interface DeliveryRequest {
  approvalId: string;
  receiverId: string;
  action: "sandbox_delivery" | "publication";
  manifest: ExportManifest;
  cost: { amount: string; currency: string; exponent: number };
  content: unknown;
  rights: unknown;
  policy: unknown;
  correlationId: string;
  idempotencyKey?: string;
}

/**
 * Typed server SDK. It cannot reach arbitrary HTTP: only the named routes of
 * the middleware, with the same PEP as the public API.
 */
export class BrandingClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: BrandingClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async call<T>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 15_000);
    try {
      const response = await this.fetchImpl(`${this.options.baseUrl.replace(/\/$/, "")}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${this.options.accessToken}`,
          "content-type": "application/json",
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });

      const text = await response.text();
      const parsed: unknown = text.length > 0 ? JSON.parse(text) : null;
      if (!response.ok) {
        const errorBody = ErrorResponseSchema.safeParse(parsed);
        if (errorBody.success) {
          throw new ApiError(errorBody.data.error.code, errorBody.data.error.message, {
            retryable: errorBody.data.error.retryable,
            reconciliationRequired: errorBody.data.error.reconciliationRequired,
          });
        }
        throw new ApiError("invalid_provider_response", `unexpected ${response.status} response`);
      }
      return parsed as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  me(): Promise<{ userId: string; tenantId: string; role: string; scopes: string[] }> {
    return this.call("GET", "/v1/branding/me");
  }

  resources(): Promise<{ resources: { resourceId: string; version: number; updatedAt: string }[] }> {
    return this.call("GET", "/v1/branding/resources");
  }

  resource(resourceId: string): Promise<{ resourceId: string; version: number; payload: unknown }> {
    return this.call("GET", `/v1/branding/resources/${encodeURIComponent(resourceId)}`);
  }

  proposeBrief(resourceId: string, input: {
    purpose: string | null;
    audienceDeclared: string | null;
    deliverables: string[];
    acceptance: string[];
    constraints?: string[];
  }): Promise<{ proposalId: string; version: number; pendingFacts: string[] }> {
    return this.call("POST", "/v1/branding/proposals", {
      capability: "brand.brief.propose",
      resourceId,
      payload: input,
    });
  }

  previewExport(documentId: string, input: {
    purpose: "internal_review" | "client_delivery" | "publication" | "paid_media";
    dpi: number;
    colorProfile: "sRGB" | "DisplayP3" | "CMYK_FOGRA39" | "GRAYSCALE";
    fontIds: string[];
    assetHashes: string[];
    textQaOk: boolean;
    rightsOk: boolean;
    svg?: string[];
  }): Promise<{ ok: boolean; blockers: { code: string; detail: string }[]; manifest: ExportManifest | null }> {
    return this.call("POST", `/v1/branding/proposals/${encodeURIComponent(documentId)}/preview`, {
      capability: "brand.export.preview",
      ...input,
    });
  }

  deliver(request: DeliveryRequest): Promise<{ result: unknown; receipt: { receiptId: string } }> {
    const operationId = `op_${crypto.randomUUID()}`;
    return this.call(
      "POST",
      "/v1/branding/intents",
      {
        schemaVersion: 1,
        operationId,
        tenantId: "server-resolved",
        actorId: "server-resolved",
        capability: "brand.deliver.propose",
        requestId: null,
        correlationId: request.correlationId,
        causationId: null,
        idempotencyKey: request.idempotencyKey ?? operationId,
        expectedVersion: null,
        approvalRef: request.approvalId,
        dryRun: false,
        payload: {
          approvalId: request.approvalId,
          receiverId: request.receiverId,
          action: request.action,
          manifest: request.manifest,
          cost: request.cost,
          content: request.content,
          rights: request.rights,
          policy: request.policy,
        },
      },
      { "x-correlation-id": request.correlationId },
    );
  }

  capabilities(connectionId: string): Promise<CapabilityReport> {
    return this.call("GET", `/v1/branding/integrations/${encodeURIComponent(connectionId)}/capabilities`);
  }

  createReport(input: {
    resourceId: string;
    metricDefinitions: { metricId: string; definition: string }[];
    values: { metricId: string; value: number; unit: string; sourceRef: string; coverage: string }[];
  }): Promise<{ snapshotId: string; hash: string }> {
    return this.call("POST", "/v1/branding/reports", input);
  }

  openAdvisorSession(input: {
    resourceId: string;
    personaId: string;
    capabilities: string[];
    budget: { amount: string; currency: string; exponent: number };
    ttlSeconds?: number;
  }): Promise<{ sessionId: string; expiresAt: string; avToken: null; fallback: string }> {
    return this.call("POST", "/v1/branding/advisor-sessions", input);
  }

  /** Runs the P0 vertical one gate at a time. Stages are refused if skipped. */
  startVertical(input: { resourceId: string; documentId: string; verticalId?: string }): Promise<{ record: VerticalRecordView }> {
    return this.call("POST", "/v1/branding/verticals", input);
  }

  vertical(verticalId: string): Promise<{ record: VerticalRecordView }> {
    return this.call("GET", `/v1/branding/verticals/${encodeURIComponent(verticalId)}`);
  }

  advanceVertical(
    verticalId: string,
    stage: string,
    input: Record<string, unknown> & { operationKey: string },
  ): Promise<{ record: VerticalRecordView; artifact: unknown }> {
    return this.call(
      "POST",
      `/v1/branding/verticals/${encodeURIComponent(verticalId)}/stages/${encodeURIComponent(stage)}`,
      input,
    );
  }

  /** Only a provisioned human reviewer may call this route. */
  createApproval(input: {
    approvalId: string;
    resourceId: string;
    resourceVersion: number;
    payload: unknown;
    rights: unknown;
    policy: unknown;
    scope: string;
    recipient: string;
    channel: string;
    costCeiling: { amount: string; currency: string; exponent: number };
    expiresAt: string;
    proposerId: string;
  }): Promise<{ approval: { approvalId: string; payloadHash: string; expiresAt: string } }> {
    return this.call("POST", "/v1/branding/approvals", input);
  }
}
