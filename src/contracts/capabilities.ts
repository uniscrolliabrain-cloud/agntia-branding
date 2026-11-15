import { DomainError } from "./errors.ts";

/**
 * Closed capability registry.
 *
 * Nothing outside this table can be invoked. A capability is not a permission:
 * the principal must also hold it, inside a live mandate, with the resource in
 * scope. Declaring `requiresApproval` here is a floor, not a guarantee.
 */

export type Risk = "low" | "medium" | "high";

export const BRAND_CAPABILITY_NAMES = [
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

export type BrandCapability = (typeof BRAND_CAPABILITY_NAMES)[number];

export interface CapabilitySpec {
  readonly name: BrandCapability;
  readonly risk: Risk;
  /** True when the call may reach a network or produce a deliverable artifact. */
  readonly externalEffect: boolean;
  /** ApprovalBinding (hash, version, tenant, scope, expiry) is mandatory. */
  readonly requiresApproval: boolean;
  /** A dry-run is the only allowed mode until a provider is verified. */
  readonly dryRunOnly?: boolean;
}

export const CAPABILITIES: readonly CapabilitySpec[] = [
  { name: "brand.brief.propose", risk: "low", externalEffect: false, requiresApproval: false },
  { name: "brand.research.preview", risk: "medium", externalEffect: true, requiresApproval: false, dryRunOnly: false },
  { name: "brand.naming.propose", risk: "low", externalEffect: false, requiresApproval: false },
  { name: "brand.clearance.preview", risk: "medium", externalEffect: true, requiresApproval: false },
  { name: "brand.voice.propose", risk: "low", externalEffect: false, requiresApproval: false },
  { name: "brand.concept.preview", risk: "low", externalEffect: false, requiresApproval: false },
  { name: "brand.rights.read", risk: "low", externalEffect: false, requiresApproval: false },
  { name: "brand.font.preview", risk: "low", externalEffect: false, requiresApproval: false },
  { name: "brand.document.update", risk: "medium", externalEffect: false, requiresApproval: false },
  { name: "brand.penpot.preview", risk: "medium", externalEffect: true, requiresApproval: false },
  { name: "brand.canvas.preview", risk: "low", externalEffect: false, requiresApproval: false },
  { name: "brand.logo.propose", risk: "low", externalEffect: false, requiresApproval: false },
  { name: "brand.palette.validate", risk: "low", externalEffect: false, requiresApproval: false },
  { name: "brand.tokens.preview", risk: "low", externalEffect: false, requiresApproval: false },
  { name: "brand.tokens.export", risk: "medium", externalEffect: true, requiresApproval: true },
  { name: "brand.template.propose", risk: "low", externalEffect: false, requiresApproval: false },
  { name: "brand.layout.validate", risk: "low", externalEffect: false, requiresApproval: false },
  { name: "brand.design.preview", risk: "low", externalEffect: false, requiresApproval: false },
  { name: "brand.text.verify", risk: "low", externalEffect: false, requiresApproval: false },
  { name: "brand.quality.evaluate", risk: "low", externalEffect: false, requiresApproval: false },
  { name: "brand.brandbook.propose", risk: "low", externalEffect: false, requiresApproval: false },
  { name: "brand.export.preview", risk: "medium", externalEffect: false, requiresApproval: false },
  { name: "brand.deliver.propose", risk: "high", externalEffect: true, requiresApproval: true },
  { name: "brand.learning.propose", risk: "medium", externalEffect: false, requiresApproval: true },
];

const BY_NAME = new Map<string, CapabilitySpec>(CAPABILITIES.map((c) => [c.name as string, c]));

export function getCapability(name: string): CapabilitySpec | undefined {
  return BY_NAME.get(name);
}

export function isBrandCapability(name: string): name is BrandCapability {
  return BY_NAME.has(name);
}

/**
 * Tools a model may call. Deliberately a narrow subset, and never `approve`,
 * `send`, `export_all` or anything administrative. tenant/actor/scopes are not
 * model inputs.
 */
export const MODEL_TOOLS = [
  "brand_brief_read",
  "brand_policy_read",
  "brand_concept_propose",
  "brand_design_preview",
  "brand_rights_check",
  "brand_export_preview",
  "brand_review_read",
] as const;

export type ModelTool = (typeof MODEL_TOOLS)[number];

export const TOOL_TO_CAPABILITY: Readonly<Record<ModelTool, BrandCapability>> = {
  brand_brief_read: "brand.brief.propose",
  brand_policy_read: "brand.brandbook.propose",
  brand_concept_propose: "brand.concept.preview",
  brand_design_preview: "brand.design.preview",
  brand_rights_check: "brand.rights.read",
  brand_export_preview: "brand.export.preview",
  brand_review_read: "brand.quality.evaluate",
};

/** Capabilities that must never be reachable from a model tool call. */
export function assertNotModelInvokable(capability: string): void {
  const spec = getCapability(capability);
  if (!spec) throw new DomainError("unsupported_capability", "Unknown capability.");
  if (spec.requiresApproval && spec.externalEffect) {
    throw new DomainError("policy_violation", "This capability is not invokable by a model tool.", {
      details: { capability },
    });
  }
}
