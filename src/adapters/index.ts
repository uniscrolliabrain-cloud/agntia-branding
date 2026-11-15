import { z } from "zod";
import { DomainError } from "../contracts/errors.ts";

/**
 * Adapters and capability discovery.
 *
 * None of the external providers is configured in this environment, and the
 * design forbids pretending otherwise. Each adapter therefore reports a
 * capability status and refuses to act unless a server-side binding exists.
 * A fake that "works" is worse than a disabled capability, because it hides a
 * missing contract.
 */

export const CAPABILITY_STATUSES = [
  "documented",
  "verified_runtime",
  "unknown",
  "unsupported",
  "forbidden",
  "not_configured",
] as const;

export type CapabilityStatus = (typeof CAPABILITY_STATUSES)[number];

export const capabilityReportSchema = z
  .object({
    provider: z.string().min(1).max(64),
    edition: z.string().min(1).max(64),
    version: z.string().min(1).max(64),
    status: z.enum(CAPABILITY_STATUSES),
    operations: z.array(z.string().min(1).max(96)).max(64),
    fields: z.array(z.string().min(1).max(96)).max(128),
    observedAt: z.string().datetime({ offset: true }),
    expiresAt: z.string().datetime({ offset: true }).nullable(),
    errors: z.array(z.string().max(200)).max(16),
  })
  .strict();

export type CapabilityReport = z.infer<typeof capabilityReportSchema>;

export function notConfigured(provider: string): CapabilityReport {
  return {
    provider,
    edition: "unknown",
    version: "unknown",
    status: "not_configured",
    operations: [],
    fields: [],
    observedAt: new Date().toISOString(),
    expiresAt: null,
    errors: ["no server-side binding"],
  };
}

/** Only a runtime-verified operation may be invoked. Everything else is denied. */
export function assertOperationVerified(report: CapabilityReport, operation: string): void {
  if (report.status !== "verified_runtime") {
    throw new DomainError("unsupported_capability", "The provider capability is not verified.", {
      details: { provider: report.provider, status: report.status },
    });
  }
  if (!report.operations.includes(operation)) {
    throw new DomainError("unsupported_capability", "The operation is not in the verified set.", {
      details: { provider: report.provider, operation },
    });
  }
}

// ---------------------------------------------------------------------------
// SSRF-safe retrieval (research, discovery, imports)
// ---------------------------------------------------------------------------

const PRIVATE_V4 = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\./,
];

export interface SafeFetchOptions {
  allowedHosts: readonly string[];
  maxBytes?: number;
  maxRedirects?: number;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

function assertPublicHost(hostname: string, allowedHosts: readonly string[]): void {
  if (hostname === "localhost" || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new DomainError("policy_violation", "The host is not allowed.", { details: { reason: "internal_host" } });
  }
  if (PRIVATE_V4.some((pattern) => pattern.test(hostname))) {
    throw new DomainError("policy_violation", "The host is not allowed.", { details: { reason: "private_address" } });
  }
  if (hostname.startsWith("[") || hostname.includes(":")) {
    throw new DomainError("policy_violation", "The host is not allowed.", { details: { reason: "ip_literal" } });
  }
  if (!allowedHosts.includes(hostname)) {
    throw new DomainError("policy_violation", "The host is not in the allowlist.", {
      details: { reason: "host_not_allowed" },
    });
  }
}

/**
 * Retrieval used for research and imports. The URL never comes from the model:
 * it comes from a server-side binding, and even then it is checked.
 */
export async function safeFetchText(rawUrl: string, options: SafeFetchOptions): Promise<{ body: string; url: string }> {
  const maxBytes = options.maxBytes ?? 1_000_000;
  const maxRedirects = options.maxRedirects ?? 2;
  const fetchImpl = options.fetchImpl ?? fetch;

  let current = rawUrl;
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    let url: URL;
    try {
      url = new URL(current);
    } catch {
      throw new DomainError("invalid_input", "Malformed URL.");
    }
    if (url.protocol !== "https:") {
      throw new DomainError("policy_violation", "Only https is allowed.", { details: { reason: "scheme" } });
    }
    if (url.username !== "" || url.password !== "") {
      throw new DomainError("policy_violation", "Credentials in URL are not allowed.", { details: { reason: "userinfo" } });
    }
    assertPublicHost(url.hostname, options.allowedHosts);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 5_000);
    try {
      const response = await fetchImpl(url.toString(), {
        redirect: "manual",
        signal: controller.signal,
        headers: { accept: "text/html,text/plain;q=0.9" },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new DomainError("provider_invalid_response", "Redirect without location.");
        current = new URL(location, url).toString();
        continue;
      }
      if (!response.ok) {
        throw new DomainError("provider_unavailable", "The source is unavailable.", {
          details: { status: response.status },
        });
      }
      const contentType = response.headers.get("content-type") ?? "";
      if (!/^text\/(html|plain)/i.test(contentType)) {
        throw new DomainError("policy_violation", "Unexpected content type.", { details: { reason: "content_type" } });
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength > maxBytes) {
        throw new DomainError("policy_violation", "The response exceeds the size limit.", {
          details: { reason: "too_large" },
        });
      }
      return { body: buffer.toString("utf8"), url: url.toString() };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new DomainError("policy_violation", "Too many redirects.", { details: { reason: "redirect_limit" } });
}

// ---------------------------------------------------------------------------
// Provider stubs
// ---------------------------------------------------------------------------

export interface PenpotBinding {
  baseUrl: string;
  teamBindingRef: string;
  fileRevision: string;
}

/**
 * Penpot adapter. A remote workspace is not a local tenant: the file binding is
 * server-side and a file with a matching name from another team must never open.
 */
export function assertPenpotBinding(configured: boolean): CapabilityReport {
  return configured
    ? {
        ...notConfigured("penpot"),
        status: "documented",
        operations: [],
        errors: ["binding declared but runtime not verified in this environment"],
      }
    : notConfigured("penpot");
}

export function openPenpotFile(report: CapabilityReport, binding: PenpotBinding, requestedFileRevision: string): never {
  assertOperationVerified(report, "file.read");
  if (binding.fileRevision !== requestedFileRevision) {
    throw new DomainError("version_conflict", "The requested file revision is not the bound revision.");
  }
  // Unreachable today: no verified runtime exists.
  throw new DomainError("unsupported_capability", "Penpot runtime is not configured in this environment.");
}

/** Anam is presence only: it never authenticates, authorizes or signs. */
export function anamPresenceReport(configured: boolean): CapabilityReport {
  return configured
    ? { ...notConfigured("anam"), status: "documented", errors: ["presence channel, not identity"] }
    : notConfigured("anam");
}

/** Model gateway: proposals only, no tools, no credentials. */
export function modelGatewayReport(configured: boolean): CapabilityReport {
  return configured
    ? { ...notConfigured("model_gateway"), status: "documented", errors: ["allowlist not verified in this environment"] }
    : notConfigured("model_gateway");
}
