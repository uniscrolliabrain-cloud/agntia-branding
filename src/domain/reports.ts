import { z } from "zod";
import { contentHash } from "../contracts/evidence.ts";
import { DomainError } from "../contracts/errors.ts";

/**
 * Reports and dashboards.
 *
 * A report may only state what the data supports: counts of real records,
 * coverage as a fraction of known items, and explicit freshness. Missing data is
 * reported as missing — never filled with a plausible number.
 */

export const reportMetricSchema = z
  .object({
    key: z.string().min(1).max(64),
    label: z.string().min(1).max(96),
    /** Numeric value, or null when the underlying data is absent. */
    value: z.number().nullable(),
    unit: z.enum(["count", "ratio", "currency", "ms"]),
    /** Where the number comes from, so a reader can verify it. */
    sourceRef: z.string().min(1).max(256),
  })
  .strict();

export type ReportMetric = z.infer<typeof reportMetricSchema>;

export const reportSnapshotSchema = z
  .object({
    id: z.string().min(1).max(128),
    tenantId: z.string().min(1).max(128),
    scope: z.string().min(1).max(128),
    generatedAt: z.string().datetime({ offset: true }),
    /** Watermark of the data read; lets a reader judge staleness. */
    sourceWatermark: z.string().min(1).max(64),
    coverage: z.object({ known: z.number().int().nonnegative(), reported: z.number().int().nonnegative() }).strict(),
    metrics: z.array(reportMetricSchema).max(64),
    missingData: z.array(z.string().max(128)).max(64),
    hash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  })
  .strict();

export type ReportSnapshot = z.infer<typeof reportSnapshotSchema>;

export interface ReportInput {
  id: string;
  tenantId: string;
  scope: string;
  generatedAt: Date;
  sourceWatermark: string;
  metrics: ReportMetric[];
  missingData?: string[];
}

export function buildReport(input: ReportInput): ReportSnapshot {
  if (input.metrics.length === 0) {
    throw new DomainError("invalid_input", "A report needs at least one metric with a source.");
  }
  const reported = input.metrics.filter((m) => m.value !== null).length;
  const snapshot: Omit<ReportSnapshot, "hash"> = {
    id: input.id,
    tenantId: input.tenantId,
    scope: input.scope,
    generatedAt: input.generatedAt.toISOString(),
    sourceWatermark: input.sourceWatermark,
    coverage: { known: input.metrics.length, reported },
    metrics: input.metrics,
    missingData: input.missingData ?? input.metrics.filter((m) => m.value === null).map((m) => m.key),
  };
  return { ...snapshot, hash: contentHash(snapshot) };
}

/** A completed-looking report with unreported metrics is a defect, not a design. */
export function assertReportHonest(snapshot: ReportSnapshot): void {
  const nulls = snapshot.metrics.filter((m) => m.value === null).map((m) => m.key);
  const undeclared = nulls.filter((key) => !snapshot.missingData.includes(key));
  if (undeclared.length > 0) {
    throw new DomainError("policy_violation", "Unreported metrics must be declared as missing data.", {
      details: { metrics: undeclared.join(",") },
    });
  }
  if (snapshot.coverage.reported > snapshot.coverage.known) {
    throw new DomainError("policy_violation", "Coverage cannot exceed the known population.");
  }
}
