import { z } from "zod";
import { opaqueId } from "./primitives.ts";

/**
 * Request envelope. `tenantId` and `actorId` are resolved by the server from a
 * verified principal; the values here are only a cross-check of the data scope.
 * Identity claims inside the JSON are never proof of authorization.
 */
export const EnvelopeSchema = z
  .object({
    schemaVersion: z.literal(1),
    operationId: opaqueId,
    tenantId: opaqueId,
    actorId: opaqueId,
    capability: z.string().min(3).max(120),
    requestId: z.string().min(1).max(200).nullable().default(null),
    correlationId: z.string().min(1).max(200),
    causationId: z.string().min(1).max(200).nullable().default(null),
    idempotencyKey: z.string().min(8).max(200).nullable().default(null),
    expectedVersion: z.number().int().min(0).nullable().default(null),
    approvalRef: z.string().min(1).max(200).nullable().default(null),
    dryRun: z.boolean().default(true),
    payload: z.record(z.unknown()),
  })
  .strict();

export type Envelope = z.infer<typeof EnvelopeSchema>;

export const CAPABILITIES = [
  "brand.brief.propose",
  "brand.research.preview",
  "brand.naming.propose",
  "brand.clearance.preview",
  "brand.voice.propose",
  "brand.concept.preview",
  "brand.rights.read",
  "brand.font.preview",
  "brand.document.update",
  "brand.penpot.preview",
  "brand.canvas.preview",
  "brand.logo.propose",
  "brand.palette.validate",
  "brand.tokens.preview",
  "brand.tokens.export",
  "brand.template.propose",
  "brand.layout.validate",
  "brand.design.preview",
  "brand.text.verify",
  "brand.quality.evaluate",
  "brand.brandbook.propose",
  "brand.export.preview",
  "brand.deliver.propose",
  "brand.learning.propose",
] as const;

export type Capability = (typeof CAPABILITIES)[number];
export const CapabilitySchema = z.enum(CAPABILITIES);

/** Capabilities that may never be exposed to a model or an anonymous caller. */
export const INTERNAL_CAPABILITIES = [
  "baseline.capture",
  "authority.define",
  "auth.verify",
  "twin.bind",
  "contracts.validate",
  "storage.migrate",
  "provider.discover",
  "host.bridge",
  "pilot.accept",
  "security.verify",
  "release.prepare",
] as const;

export function isExposedCapability(capability: string): capability is Capability {
  return (CAPABILITIES as readonly string[]).includes(capability);
}
