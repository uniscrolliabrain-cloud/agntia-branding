import { ApiError, type CapabilityReport } from "@agntia/contracts";
import { assertPenpotAccess, type PenpotBinding } from "@agntia/domain";
import { discoverCapabilities } from "./discovery.ts";

/** Port shape: real transports are injected by the deployment, never by a model. */
export interface PenpotTransport {
  readFile(input: { baseUrl: string; accessTokenRef: string; fileId: string }): Promise<{ fileId: string; revision: string; pages: string[] }>;
}

export interface PenpotConfig {
  baseUrl: string | null;
  accessTokenRef: string | null;
  binding: PenpotBinding;
  transport: PenpotTransport | null;
}

/**
 * Penpot is optional. Without a configured base URL, credential reference and
 * transport, the adapter reports `not_configured` instead of simulating a file.
 */
export class PenpotAdapter {
  constructor(private readonly config: PenpotConfig) {}

  get configured(): boolean {
    return Boolean(this.config.baseUrl && this.config.accessTokenRef && this.config.transport);
  }

  async capabilityReport(input: { connectionId: string; now: Date; ttlSeconds: number }): Promise<CapabilityReport> {
    if (!this.configured) {
      return discoverCapabilities({
        connectionId: input.connectionId,
        tenantId: this.config.binding.tenantId,
        deployment: "self-hosted",
        edition: "unknown",
        version: "unknown",
        now: input.now,
        ttlSeconds: input.ttlSeconds,
        probes: [],
      });
    }
    return discoverCapabilities({
      connectionId: input.connectionId,
      tenantId: this.config.binding.tenantId,
      deployment: "self-hosted",
      edition: "unknown",
      version: "unknown",
      now: input.now,
      ttlSeconds: input.ttlSeconds,
      probes: [
        {
          capability: "brand.penpot.preview",
          run: async () => {
            assertPenpotAccess(this.config.binding, {
              tenantId: this.config.binding.tenantId,
              fileId: this.config.binding.fileIds[0]!,
              write: false,
            });
            return { ok: true, fields: ["fileRevision", "pages"] };
          },
        },
      ],
    });
  }

  async readFile(request: { tenantId: string; fileId: string }): Promise<{ fileId: string; revision: string; pages: string[] }> {
    if (!this.configured) {
      throw new ApiError("failed_dependency", "penpot adapter is not configured", { details: { state: "not_configured" } });
    }
    assertPenpotAccess(this.config.binding, { tenantId: request.tenantId, fileId: request.fileId, write: false });
    return this.config.transport!.readFile({
      baseUrl: this.config.baseUrl!,
      accessTokenRef: this.config.accessTokenRef!,
      fileId: request.fileId,
    });
  }
}

/* ------------------------------------------------------------------ *
 * Anam · presencia del agente existente
 * ------------------------------------------------------------------ */

export interface AnamTransport {
  createSession(input: { token: string; personaId: string; sessionId: string }): Promise<{ providerSessionRef: string; expiresAt: string }>;
}

export interface AnamConfig {
  apiKeyRef: string | null;
  transport: AnamTransport | null;
}

/**
 * The browser must never receive the provider API key. The backend exchanges a
 * scoped session for an ephemeral token; the token is not a JWT and grants no
 * domain authority.
 */
export class AnamSessionIssuer {
  constructor(private readonly config: AnamConfig) {}

  get configured(): boolean {
    return Boolean(this.config.apiKeyRef && this.config.transport);
  }

  async issue(input: {
    sessionId: string;
    tenantId: string;
    personaId: string;
    expiresAt: string;
    now: Date;
    capabilities: string[];
  }): Promise<{ providerSessionRef: string; tokenRef: string; expiresAt: string }> {
    if (!this.configured) {
      throw new ApiError("failed_dependency", "anam is not configured; keep text fallback", {
        details: { state: "not_configured", fallback: "text" },
      });
    }
    if (new Date(input.expiresAt).getTime() <= input.now.getTime()) {
      throw new ApiError("forbidden", "cannot issue a session that is already expired");
    }
    const session = await this.config.transport!.createSession({
      token: this.config.apiKeyRef!,
      personaId: input.personaId,
      sessionId: input.sessionId,
    });
    return {
      providerSessionRef: session.providerSessionRef,
      tokenRef: `anam:${input.sessionId}:${input.expiresAt}`,
      expiresAt: session.expiresAt,
    };
  }
}
