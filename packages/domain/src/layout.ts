import { ApiError, conflict, invalid, needsReview, opaqueId } from "./_shared.ts";
import { z } from "zod";
import { DesignDocumentSchema, updateDocument, type DesignDocument, type DesignNode } from "./design.ts";

/* ------------------------------------------------------------------ *
 * C24 · Plantillas y componentes
 * ------------------------------------------------------------------ */

export const TemplateSlotSchema = z
  .object({
    slotId: z.string().min(1).max(80),
    editable: z.boolean(),
    requiredMessage: z.string().max(300).nullable().default(null),
  })
  .strict();

export const TemplateSchema = z
  .object({
    templateId: opaqueId,
    tenantId: opaqueId,
    revision: z.number().int().min(0),
    slots: z.array(TemplateSlotSchema).min(1),
    protectedNodes: z.array(opaqueId).default([]),
    locale: z.string().min(2).max(12),
    legalFooter: z.string().max(500).nullable().default(null),
  })
  .strict();

export type Template = z.infer<typeof TemplateSchema>;

/**
 * Editing a slot may not break protected nodes, required legal copy or
 * mandatory messages. Protected means protected for every variant.
 */
export function applyTemplateOverrides(
  template: Template,
  overrides: { slotId: string; text: string }[],
): { template: Template; applied: { slotId: string; text: string }[] } {
  const applied: { slotId: string; text: string }[] = [];
  for (const override of overrides) {
    const slot = template.slots.find((s) => s.slotId === override.slotId);
    if (!slot) throw invalid(`unknown slot ${override.slotId}`);
    if (!slot.editable) throw conflict(`slot ${override.slotId} is not editable`);
    if (slot.requiredMessage && override.text.trim().length === 0) {
      throw conflict(`slot ${override.slotId} requires its mandatory message`);
    }
    applied.push({ slotId: override.slotId, text: override.text });
  }
  return { template, applied };
}

export function assertProtectedNodesIntact(template: Template, removed: string[]): void {
  for (const nodeId of removed) {
    if (template.protectedNodes.includes(nodeId)) {
      throw conflict(`protected node ${nodeId} cannot be removed`);
    }
  }
}

/* ------------------------------------------------------------------ *
 * C25 · Layouts responsive (una captura desktop no prueba móvil)
 * ------------------------------------------------------------------ */

export const BreakpointSchema = z
  .object({
    name: z.string().min(1).max(40),
    minWidthPx: z.number().positive(),
    maxWidthPx: z.number().positive().nullable(),
  })
  .strict();

export const LayoutElementSchema = z
  .object({
    elementId: opaqueId,
    box: z
      .object({
        x: z.number(),
        y: z.number(),
        width: z.number().nonnegative(),
        height: z.number().nonnegative(),
      })
      .strict(),
    containsText: z.boolean(),
    minFontSizePx: z.number().positive().nullable(),
    readingOrder: z.number().int().min(0),
  })
  .strict();

export interface LayoutMeasurement {
  locale: string;
  breakpoint: string;
  elementId: string;
  measuredTextWidthPx: number | null;
}

export interface LayoutFinding {
  severity: "error" | "warning" | "pending";
  code: string;
  detail: string;
}

/**
 * Validates overflow using *real* measurements from the render engine. Absent
 * measurements produce `pending`, never a silent pass.
 */
export function validateLayout(input: {
  breakpoints: z.infer<typeof BreakpointSchema>[];
  elements: z.infer<typeof LayoutElementSchema>[];
  measurements: LayoutMeasurement[];
  requiredReadingOrder: string[];
}): { ok: boolean; findings: LayoutFinding[] } {
  const findings: LayoutFinding[] = [];
  const ids = new Set(input.elements.map((e) => e.elementId));

  for (const elementId of input.requiredReadingOrder) {
    if (!ids.has(elementId)) findings.push({ severity: "error", code: "missing_required_element", detail: elementId });
  }

  const orders = input.elements.map((e) => e.readingOrder);
  if (new Set(orders).size !== orders.length) {
    findings.push({ severity: "error", code: "duplicate_reading_order", detail: "reading order must be unique" });
  }

  for (const element of input.elements) {
    if (element.containsText && element.minFontSizePx !== null && element.minFontSizePx < 12) {
      findings.push({ severity: "warning", code: "small_font_size", detail: element.elementId });
    }
    if (element.box.x < 0 || element.box.y < 0) {
      findings.push({ severity: "error", code: "out_of_canvas", detail: element.elementId });
    }
  }

  for (const element of input.elements.filter((e) => e.containsText)) {
    const relevant = input.measurements.filter((m) => m.elementId === element.elementId);
    if (relevant.length === 0) {
      findings.push({ severity: "pending", code: "text_measurement_missing", detail: element.elementId });
      continue;
    }
    for (const measurement of relevant) {
      if (measurement.measuredTextWidthPx === null) {
        findings.push({
          severity: "pending",
          code: "text_measurement_unavailable",
          detail: `${element.elementId}/${measurement.locale}/${measurement.breakpoint}`,
        });
        continue;
      }
      if (measurement.measuredTextWidthPx > element.box.width) {
        findings.push({
          severity: "error",
          code: "text_overflow",
          detail: `${element.elementId}/${measurement.locale}/${measurement.breakpoint} ${measurement.measuredTextWidthPx}>${element.box.width}`,
        });
      }
    }
  }

  return { ok: !findings.some((f) => f.severity === "error" || f.severity === "pending"), findings };
}

export function assertLayoutValid(input: Parameters<typeof validateLayout>[0]): void {
  const result = validateLayout(input);
  if (result.ok) return;
  const blocking = result.findings.filter((f) => f.severity !== "warning");
  if (blocking.every((f) => f.severity === "pending")) {
    throw needsReview("layout cannot be validated without renderer measurements", { findings: blocking });
  }
  throw new ApiError("conflict", "layout violates constraints", { details: { findings: blocking } });
}

/* ------------------------------------------------------------------ *
 * C26 · Composición y edición (CAS + patch reversible)
 * ------------------------------------------------------------------ */

export const CompositionOperationSchema = z
  .object({
    operationKey: z.string().min(8).max(120),
    expectedVersion: z.number().int().min(0),
    patch: z
      .object({
        upsert: z.array(z.any()).default([]),
        remove: z.array(z.string()).default([]),
        constraints: z.array(z.string().max(300)).optional(),
      })
      .strict(),
  })
  .strict();

export interface CompositionResult {
  document: DesignDocument;
  inverse: { upsert: DesignNode[]; remove: string[]; constraints: string[] };
}

/**
 * Applies a node diff with optimistic concurrency and returns the inverse
 * patch, so an editor can undo without losing history.
 */
export function applyComposition(
  doc: DesignDocument,
  operation: { operationKey: string; expectedVersion: number; patch: { upsert: DesignNode[]; remove: string[]; constraints?: string[] } },
  now: Date,
): CompositionResult {
  const before = new Map(doc.nodes.map((n) => [n.nodeId, n]));
  const inverseUpsert: DesignNode[] = [];
  const inverseRemove: string[] = [];

  for (const node of operation.patch.upsert) {
    const previous = before.get(node.nodeId);
    if (previous) inverseUpsert.push(previous);
    else inverseRemove.push(node.nodeId);
  }
  for (const nodeId of operation.patch.remove) {
    const previous = before.get(nodeId);
    if (previous) inverseUpsert.push(previous);
  }

  const next = updateDocument(
    DesignDocumentSchema.parse(doc),
    { upsert: operation.patch.upsert, remove: operation.patch.remove, constraints: operation.patch.constraints },
    operation.expectedVersion,
    now,
  );

  return {
    document: next,
    inverse: { upsert: inverseUpsert, remove: inverseRemove, constraints: [...doc.constraints] },
  };
}
