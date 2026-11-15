import { z } from "zod";
import { DomainError } from "../contracts/errors.ts";

/**
 * Contrast is computed, never judged. A model saying "this looks readable" is
 * not evidence; the ratio below is. Thresholds follow WCAG 2.1 AA:
 * 4.5:1 normal text, 3:1 large text and UI components.
 */

export const colorUsageSchema = z.enum(["normal_text", "large_text", "ui_component", "decorative"]);

export type ColorUsage = z.infer<typeof colorUsageSchema>;

export const contrastPairSchema = z
  .object({
    id: z.string().min(1).max(64),
    foreground: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    usage: colorUsageSchema,
  })
  .strict();

export type ContrastPair = z.infer<typeof contrastPairSchema>;

export interface ContrastFinding {
  id: string;
  ratio: number;
  threshold: number;
  passes: boolean;
  usage: ColorUsage;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
    throw new DomainError("invalid_input", "Color must be a 6-digit hex value.");
  }
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function channelLuminance(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

/** WCAG contrast ratio, rounded to two decimals for stable assertions. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
}

export function thresholdFor(usage: ColorUsage): number {
  switch (usage) {
    case "normal_text":
      return 4.5;
    case "large_text":
    case "ui_component":
      return 3;
    case "decorative":
      return 1;
  }
}

export function evaluatePalette(pairs: readonly ContrastPair[]): ContrastFinding[] {
  return pairs.map((pair) => {
    contrastPairSchema.parse(pair);
    const ratio = contrastRatio(pair.foreground, pair.background);
    const threshold = thresholdFor(pair.usage);
    return { id: pair.id, ratio, threshold, passes: ratio >= threshold, usage: pair.usage };
  });
}

/** A failing pair does not "warn": it blocks the palette from being approved. */
export function assertPalettePasses(pairs: readonly ContrastPair[]): ContrastFinding[] {
  const findings = evaluatePalette(pairs);
  const failing = findings.filter((f) => !f.passes);
  if (failing.length > 0) {
    throw new DomainError("policy_violation", "Some contrast pairs do not meet the target standard.", {
      details: { failingPairs: failing.map((f) => f.id).join(",") },
    });
  }
  return findings;
}
