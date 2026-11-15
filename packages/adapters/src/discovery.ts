import {
  ApiError,
  CapabilityReportSchema,
  isCapabilityUsable,
  type CapabilityReport,
  type CapabilityState,
} from "@agntia/contracts";

export interface CapabilityProbe {
  capability: string;
  /** The probe must use a server-side endpoint binding and an allowlisted method. */
  run: () => Promise<{ ok: boolean; fields?: string[]; state?: CapabilityState; note?: string }>;
}

export interface DiscoveryRequest {
  connectionId: string;
  tenantId: string;
  deployment: string;
  edition: string;
  version: string;
  probes: CapabilityProbe[];
  now: Date;
  ttlSeconds: number;
}

/**
 * A 200 response is not health: each probe must confirm structure and scope.
 * Unknown capabilities stay disabled; nothing is enabled by default.
 */
export async function discoverCapabilities(request: DiscoveryRequest): Promise<CapabilityReport> {
  const operations: CapabilityReport["operations"] = [];

  for (const probe of request.probes) {
    try {
      const result = await probe.run();
      if (result.ok) {
        operations.push({
          capability: probe.capability,
          state: "verified_runtime",
          fields: result.fields ?? [],
          note: result.note ?? null,
        });
      } else {
        operations.push({
          capability: probe.capability,
          state: result.state ?? "unknown",
          fields: [],
          note: result.note ?? "probe did not confirm the capability",
        });
      }
    } catch (error) {
      const state: CapabilityState = error instanceof ApiError && error.code === "forbidden" ? "forbidden" : "unknown";
      operations.push({
        capability: probe.capability,
        state,
        fields: [],
        note: error instanceof Error ? error.message.slice(0, 200) : "probe failed",
      });
    }
  }

  const expiresAt = new Date(request.now.getTime() + request.ttlSeconds * 1000).toISOString();
  return CapabilityReportSchema.parse({
    connectionId: request.connectionId,
    tenantId: request.tenantId,
    deployment: request.deployment,
    edition: request.edition,
    version: request.version,
    operations,
    checkedAt: request.now.toISOString(),
    expiresAt,
    errors: [],
    evidenceRefs: [],
  });
}

export function requireUsableCapability(report: CapabilityReport, capability: string, now: Date): void {
  const check = isCapabilityUsable(report, capability, now);
  if (!check.usable) {
    throw new ApiError("failed_dependency", `capability ${capability} unavailable: ${check.reason}`, {
      details: { reason: check.reason },
    });
  }
}

/** No endpoint, method, credential or tenant may come from model output. */
export function assertServerSideBinding(input: { endpointRef: string; secretRef: string | null; tenantId: string; reportTenantId: string }): void {
  if (!/^[a-z][a-z0-9_.-]{2,60}$/.test(input.endpointRef)) {
    throw new ApiError("invalid_input", "endpointRef must be a server-side named binding");
  }
  if (input.tenantId !== input.reportTenantId) {
    throw new ApiError("forbidden", "provider connection belongs to another tenant");
  }
}
