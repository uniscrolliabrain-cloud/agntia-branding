import { randomUUID } from "node:crypto";
import { z } from "zod";
import { DomainError, normalizeError, toErrorBody } from "../contracts/errors.ts";
import { assertNoIdentitySupplied, clientEnvelopeSchema, composeEnvelope } from "../contracts/envelope.ts";
import { getCapability } from "../contracts/capabilities.ts";
import { contentHash } from "../contracts/evidence.ts";
import { enforcePolicy } from "../policy/pep.ts";
import { beginIntent, completeIntent, failIntent } from "../runtime/idempotency.ts";
import type { MemoryStore } from "../store/memory-store.ts";
import { briefSchema, createBrief } from "../domain/brand.ts";
import { anamPresenceReport, modelGatewayReport, notConfigured, assertPenpotBinding } from "../adapters/index.ts";
import { principalSchema } from "../auth/principal.ts";

/**
 * HTTP surface under /v1/branding.
 *
 * Only nominated routes exist. There is no generic provider proxy, no SQL, no
 * arbitrary URL and no execute-anything endpoint. Identity is never read from
 * the body, and every mutating route goes through the PEP.
 */

export interface AppDependencies {
  store: MemoryStore;
  authenticate: (token: string | null) => Promise<{ principal: z.infer<typeof principalSchema> }>;
  now?: () => Date;
}

const MAX_BODY_BYTES = 262_144;

function json(body: unknown, status = 200, correlationId?: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(correlationId === undefined ? {} : { "x-correlation-id": correlationId }),
    },
  });
}

async function readJson(request: Request): Promise<unknown> {
  const declared = request.headers.get("content-length");
  if (declared !== null && Number(declared) > MAX_BODY_BYTES) {
    throw new DomainError("invalid_input", "Request body is too large.");
  }
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) {
    throw new DomainError("invalid_input", "Request body is too large.");
  }
  if (text.trim() === "") return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new DomainError("invalid_input", "Body is not valid JSON.");
  }
}

export function createApp(deps: AppDependencies) {
  const now = deps.now ?? (() => new Date());

  return async function handle(request: Request): Promise<Response> {
    const correlationId = request.headers.get("x-correlation-id") ?? randomUUID();
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    try {
      if (request.method === "GET" && path === "/health") {
        return json({ status: "ok", service: "agntia-branding", tests: "see repo CI" });
      }

      const authHeader = request.headers.get("authorization");
      const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
      const { principal } = await deps.authenticate(token);

      // ---- identity -------------------------------------------------------
      if (request.method === "GET" && path === "/v1/branding/me") {
        return json({
          userId: principal.userId,
          tenantId: principal.tenantId,
          role: principal.role,
          capabilities: principal.capabilities,
          scopes: principal.scopes,
        });
      }

      // ---- capabilities ---------------------------------------------------
      const capabilitiesMatch = /^\/v1\/branding\/integrations\/([a-z_]+)\/capabilities$/.exec(path);
      if (request.method === "GET" && capabilitiesMatch) {
        const provider = capabilitiesMatch[1] as string;
        const report =
          provider === "penpot"
            ? assertPenpotBinding(false)
            : provider === "anam"
              ? anamPresenceReport(false)
              : provider === "model_gateway"
                ? modelGatewayReport(false)
                : notConfigured(provider);
        return json(report);
      }

      // ---- resources ------------------------------------------------------
      if (request.method === "GET" && path === "/v1/branding/resources") {
        const type = url.searchParams.get("type");
        const items = [...deps.store.resources.values()]
          .filter((r) => r.tenantId === principal.tenantId)
          .filter((r) => type === null || r.type === type)
          .map((r) => ({ id: r.id, type: r.type, version: r.version, state: r.state, updatedAt: r.updatedAt }));
        return json({ items, count: items.length });
      }

      const resourceMatch = /^\/v1\/branding\/resources\/([A-Za-z0-9_-]{1,128})$/.exec(path);
      if (request.method === "GET" && resourceMatch) {
        const id = resourceMatch[1] as string;
        const found = [...deps.store.resources.values()].find(
          (r) => r.tenantId === principal.tenantId && r.id === id,
        );
        if (!found) throw new DomainError("not_found", "Resource not found.");
        return json(found);
      }

      // ---- brief creation ------------------------------------------------
      if (request.method === "POST" && path === "/v1/branding/proposals") {
        const raw = await readJson(request);
        assertNoIdentitySupplied(raw);
        const client = clientEnvelopeSchema.parse(raw);
        const envelope = composeEnvelope({
          operationId: randomUUID(),
          tenantId: principal.tenantId,
          actorId: principal.userId,
          client,
        });
        enforcePolicy({ principal, envelope }, deps.store);

        const payloadHash = contentHash(envelope.payload);
        const intent = beginIntent(deps.store, {
          tenantId: principal.tenantId,
          capability: envelope.capability,
          idempotencyKey: envelope.idempotencyKey,
          payloadHash,
        });
        if (intent.kind === "replay") {
          return json({ ...intent.result, replayed: true }, 200, correlationId);
        }

        try {
          if (envelope.capability === "brand.brief.propose") {
            const candidate = briefSchema.omit({ state: true, version: true }).parse({
              ...envelope.payload,
              tenantId: principal.tenantId,
              id: typeof envelope.payload["id"] === "string" ? envelope.payload["id"] : `brief_${randomUUID().slice(0, 8)}`,
            });
            const brief = createBrief(candidate);
            const stored = deps.store.putResource({
              tenantId: principal.tenantId,
              type: "brand_brief",
              id: brief.id,
              version: brief.version,
              state: brief.state,
              data: brief as unknown as Record<string, unknown>,
              evidence: [],
              updatedAt: now().toISOString(),
              updatedBy: principal.userId,
            });
            const result = { resourceId: stored.id, version: stored.version, state: stored.state };
            completeIntent(
              deps.store,
              { tenantId: principal.tenantId, capability: envelope.capability, idempotencyKey: envelope.idempotencyKey, payloadHash },
              result,
            );
            return json(result, 201, correlationId);
          }

          // Every other capability is declared but not implemented in this
          // environment. It is NOT simulated.
          failIntent(
            deps.store,
            { tenantId: principal.tenantId, capability: envelope.capability, idempotencyKey: envelope.idempotencyKey, payloadHash },
            "not_implemented",
          );
          throw new DomainError("unsupported_capability", "This capability has no implementation yet.", {
            details: { capability: envelope.capability },
          });
        } catch (error) {
          if (error instanceof DomainError && error.code === "unsupported_capability") throw error;
          throw error;
        }
      }

      // ---- jobs ------------------------------------------------------------
      const jobMatch = /^\/v1\/branding\/jobs\/([A-Za-z0-9_-]{1,128})$/.exec(path);
      if (request.method === "GET" && jobMatch) {
        const job = deps.store.jobs.get(`${principal.tenantId}:${jobMatch[1] as string}`);
        if (!job) throw new DomainError("not_found", "Job not found.");
        return json(job);
      }

      throw new DomainError("not_found", "Route not found.");
    } catch (error) {
      const domainError = normalizeError(error);
      const body = toErrorBody(domainError, correlationId);
      return json(body, domainError.status, correlationId);
    }
  };
}

export { getCapability };
