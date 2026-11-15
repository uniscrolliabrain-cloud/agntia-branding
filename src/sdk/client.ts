import { DomainError, ERROR_CODES, type ErrorCode } from "../contracts/errors.ts";

/**
 * Server-side SDK. It is a thin, typed wrapper over the nominated routes: no
 * retries on its own, no provider passthrough, no token storage. The caller
 * supplies a token getter so the SDK never persists credentials.
 */

export interface BrandingClientOptions {
  baseUrl: string;
  getToken: () => string | Promise<string>;
  fetchImpl?: typeof fetch;
  correlationId?: () => string;
}

export interface ResourceSummary {
  id: string;
  type: string;
  version: number;
  state: string;
  updatedAt: string;
}

export interface MeResponse {
  userId: string;
  tenantId: string;
  role: string;
  capabilities: string[];
  scopes: Array<{ resourceType: string; resourceId: string | null; fields: string[] }>;
}

export interface ProposalInput {
  capability: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  dryRun?: boolean;
}

export class BrandingClient {
  readonly #baseUrl: string;
  readonly #getToken: () => string | Promise<string>;
  readonly #fetch: typeof fetch;
  readonly #correlationId: () => string;

  constructor(options: BrandingClientOptions) {
    this.#baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.#getToken = options.getToken;
    this.#fetch = options.fetchImpl ?? fetch;
    this.#correlationId = options.correlationId ?? (() => crypto.randomUUID());
  }

  async #request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.#getToken();
    const response = await this.#fetch(`${this.#baseUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        "x-correlation-id": this.#correlationId(),
        authorization: `Bearer ${token}`,
        ...(init.headers ?? {}),
      },
    });

    const text = await response.text();
    const parsed = text === "" ? null : (JSON.parse(text) as unknown);

    if (!response.ok) {
      const body = parsed as { error?: { code?: string; message?: string; correlationId?: string } } | null;
      const code = body?.error?.code;
      const known = code !== undefined && (ERROR_CODES as readonly string[]).includes(code);
      throw new DomainError(
        known ? (code as ErrorCode) : "internal_error",
        body?.error?.message ?? `Request failed with status ${response.status}.`,
        { details: { status: response.status } },
      );
    }
    return parsed as T;
  }

  me(): Promise<MeResponse> {
    return this.#request<MeResponse>("/v1/branding/me");
  }

  listResources(type?: string): Promise<{ items: ResourceSummary[]; count: number }> {
    const query = type === undefined ? "" : `?type=${encodeURIComponent(type)}`;
    return this.#request(`/v1/branding/resources${query}`);
  }

  getResource<T>(id: string): Promise<T> {
    return this.#request<T>(`/v1/branding/resources/${encodeURIComponent(id)}`);
  }

  propose<T>(input: ProposalInput): Promise<T> {
    return this.#request<T>("/v1/branding/proposals", {
      method: "POST",
      body: JSON.stringify({
        capability: input.capability,
        correlationId: this.#correlationId(),
        idempotencyKey: input.idempotencyKey,
        dryRun: input.dryRun ?? false,
        payload: input.payload,
      }),
    });
  }

  capabilities(provider: string): Promise<{ provider: string; status: string; operations: string[] }> {
    return this.#request(`/v1/branding/integrations/${encodeURIComponent(provider)}/capabilities`);
  }
}
