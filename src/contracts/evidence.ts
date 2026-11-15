import { createHash } from "node:crypto";
import { z } from "zod";

/**
 * Deterministic serialization: sorted object keys, recursive, no undefined.
 * Two structurally equal payloads must produce the same hash, otherwise
 * idempotency and approval binding break in subtle ways.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/** Stable content hash used by idempotency keys and approval bindings. */
export function contentHash(value: unknown): string {
  return sha256Hex(canonicalJson(value));
}

export const EVIDENCE_KINDS = ["fact", "inference", "user_assertion", "observation"] as const;

/**
 * An evidence reference never carries the payload itself: only a pointer, a
 * hash, provenance and who reviewed it. That keeps restricted originals and
 * personal data out of the audit trail and out of the model context.
 */
export const evidenceRefSchema = z
  .object({
    id: z.string().min(1).max(128),
    tenantId: z.string().min(1).max(128),
    sourceObjectRef: z.string().min(1).max(512),
    sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
    mapperVersion: z.string().min(1).max(32),
    observedAt: z.string().datetime({ offset: true }),
    effectiveAt: z.string().datetime({ offset: true }).nullable(),
    kind: z.enum(EVIDENCE_KINDS),
    reviewRef: z.string().min(1).max(128).nullable(),
  })
  .strict();

export type EvidenceRef = z.infer<typeof evidenceRefSchema>;

/**
 * Confidence is provenance metadata, never a permission. A value of 1.0 from a
 * model must not be mistaken for verification.
 */
export function describeEvidence(ref: EvidenceRef): string {
  const label =
    ref.kind === "fact"
      ? "hecho con fuente"
      : ref.kind === "observation"
        ? "observación"
        : ref.kind === "user_assertion"
          ? "afirmación del cliente"
          : "inferencia del modelo";
  return `${label} (${ref.sourceObjectRef}, hash ${ref.sourceHash.slice(0, 12)}…)`;
}
