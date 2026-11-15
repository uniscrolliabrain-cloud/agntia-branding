import { conflict, invalid, needsReview, opaqueId, sha256Hex } from "./_shared.ts";
import { z } from "zod";

/* ------------------------------------------------------------------ *
 * C21 · Paleta y accesibilidad (contraste calculado, no juicio del LLM)
 * ------------------------------------------------------------------ */

export const HexColor = z.string().regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, "hex color");

function channelToLinear(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const clean = hex.replace("#", "").slice(0, 6);
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const light = Math.max(a, b);
  const dark = Math.min(a, b);
  return (light + 0.05) / (dark + 0.05);
}

export const ContrastPairSchema = z
  .object({
    pairId: z.string().min(1).max(80),
    foreground: HexColor,
    background: HexColor,
    usage: z.enum(["body_text", "large_text", "non_text_ui", "decorative"]),
  })
  .strict();

export type ContrastPair = z.infer<typeof ContrastPairSchema>;

export const CONTRAST_THRESHOLDS = { body_text: 4.5, large_text: 3, non_text_ui: 3, decorative: 0 } as const;

export interface ContrastFinding {
  pairId: string;
  ratio: number;
  required: number;
  status: "pass" | "fail" | "not_applicable";
}

/** Deterministic WCAG 2.x contrast check. A pretty palette is not a pass. */
export function evaluatePalette(pairs: ContrastPair[]): { findings: ContrastFinding[]; passed: boolean } {
  const findings = pairs.map((pair) => {
    const required = CONTRAST_THRESHOLDS[pair.usage];
    if (pair.usage === "decorative") {
      return { pairId: pair.pairId, ratio: Number(contrastRatio(pair.foreground, pair.background).toFixed(2)), required, status: "not_applicable" as const };
    }
    const ratio = Number(contrastRatio(pair.foreground, pair.background).toFixed(2));
    return { pairId: pair.pairId, ratio, required, status: ratio >= required ? ("pass" as const) : ("fail" as const) };
  });
  return { findings, passed: findings.every((f) => f.status !== "fail") };
}

export function assertPaletteAccessible(pairs: ContrastPair[]): void {
  const result = evaluatePalette(pairs);
  if (!result.passed) {
    throw needsReview("palette has insufficient contrast pairs", {
      failures: result.findings.filter((f) => f.status === "fail"),
    });
  }
}

/* ------------------------------------------------------------------ *
 * C22 · Design tokens (alias, tipos y ciclos)
 * ------------------------------------------------------------------ */

export const TOKEN_TYPES = ["color", "dimension", "fontFamily", "fontWeight", "number", "duration"] as const;
export const TokenTypeSchema = z.enum(TOKEN_TYPES);
export type TokenType = z.infer<typeof TokenTypeSchema>;

export const TokenSchema = z
  .object({
    path: z.string().regex(/^[a-z][a-z0-9]*(\.[a-z0-9]+)+$/, "dot-separated lowercase path"),
    type: TokenTypeSchema,
    value: z.union([z.string().min(1).max(200), z.number()]),
    aliasOf: z.string().min(1).max(200).nullable().default(null),
  })
  .strict();

export type Token = z.infer<typeof TokenSchema>;

export const TokenSetSchema = z
  .object({
    tokenSetId: opaqueId,
    tenantId: opaqueId,
    theme: z.string().min(1).max(60),
    version: z.number().int().min(0),
    tokens: z.array(TokenSchema).min(1),
  })
  .strict();

export type TokenSet = z.infer<typeof TokenSetSchema>;

function validateValue(type: TokenType, value: string | number): void {
  if (type === "number" || type === "fontWeight") {
    if (typeof value !== "number") throw invalid(`token ${type} requires a number`);
    if (type === "fontWeight" && (value < 1 || value > 1000)) throw invalid("fontWeight out of range");
    return;
  }
  if (typeof value !== "string") throw invalid(`token ${type} requires a string`);
  if (type === "color" && !/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value)) throw invalid("invalid color token");
  if (type === "dimension" && !/^\d+(\.\d+)?(px|rem|em|%)$/.test(value)) throw invalid("invalid dimension token");
  if (type === "duration" && !/^\d+(\.\d+)?(ms|s)$/.test(value)) throw invalid("invalid duration token");
}

/**
 * Validates uniqueness, alias targets, type compatibility and cycles.
 * Cyclic or mistyped tokens never reach an export.
 */
export function validateTokenSet(set: TokenSet): TokenSet {
  const byPath = new Map<string, Token>();
  for (const token of set.tokens) {
    if (byPath.has(token.path)) throw conflict(`duplicate token path ${token.path}`);
    validateValue(token.type, token.value);
    byPath.set(token.path, token);
  }

  const visiting = new Set<string>();
  const resolved = new Set<string>();

  const visit = (path: string): void => {
    if (resolved.has(path)) return;
    if (visiting.has(path)) throw conflict(`cyclic token alias at ${path}`);
    const token = byPath.get(path);
    if (!token) throw invalid(`alias target ${path} does not exist`);
    visiting.add(path);
    if (token.aliasOf) {
      const target = byPath.get(token.aliasOf);
      if (!target) throw invalid(`alias target ${token.aliasOf} does not exist`);
      if (target.type !== token.type) {
        throw invalid(`alias ${path} (${token.type}) points to ${token.aliasOf} (${target.type})`);
      }
      visit(token.aliasOf);
    }
    visiting.delete(path);
    resolved.add(path);
  };

  for (const token of set.tokens) visit(token.path);
  return set;
}

export function resolveTokenValue(set: TokenSet, path: string): string | number {
  const byPath = new Map(set.tokens.map((t) => [t.path, t]));
  let current = byPath.get(path);
  const seen = new Set<string>();
  while (current?.aliasOf) {
    if (seen.has(current.path)) throw conflict(`cyclic token alias at ${current.path}`);
    seen.add(current.path);
    const next = byPath.get(current.aliasOf);
    if (!next) throw invalid(`alias target ${current.aliasOf} does not exist`);
    current = next;
  }
  if (!current) throw invalid(`unknown token ${path}`);
  return current.value;
}

/** Tokens whose resolved value depends on `path` (impact of a semantic change). */
export function tokenDependents(set: TokenSet, path: string): string[] {
  const affected = new Set<string>([path]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const token of set.tokens) {
      if (token.aliasOf && affected.has(token.aliasOf) && !affected.has(token.path)) {
        affected.add(token.path);
        changed = true;
      }
    }
  }
  return [...affected].sort();
}

/* ------------------------------------------------------------------ *
 * C23 · Style Dictionary (build reproducible, sin scripts)
 * ------------------------------------------------------------------ */

export const ALLOWED_TRANSFORMS = ["name/kebab", "color/hex", "size/px", "value/number", "time/seconds"] as const;

export interface TokenBuildRequest {
  formats: ("css" | "json")[];
  transforms: string[];
  engineVersion: string;
}

export interface TokenBuildResult {
  outputs: Record<string, string>;
  inputHash: string;
  engineVersion: string;
}

/**
 * Deterministic, allowlisted projection of a token set. No custom transform
 * code, no network, no filesystem: nothing the model writes is executed.
 */
export function buildTokens(set: TokenSet, request: TokenBuildRequest): TokenBuildResult {
  validateTokenSet(set);
  for (const transform of request.transforms) {
    if (!(ALLOWED_TRANSFORMS as readonly string[]).includes(transform)) {
      throw invalid(`transform not allowlisted: ${transform}`);
    }
  }
  if (request.formats.length === 0) throw invalid("at least one output format is required");
  if (request.transforms.length === 0) throw invalid("at least one transform is required");

  const inputHash = sha256Hex({ theme: set.theme, version: set.version, tokens: set.tokens });
  const sorted = [...set.tokens].sort((a, b) => (a.path < b.path ? -1 : 1));
  const resolved = sorted.map((token) => ({
    path: token.path,
    type: token.type,
    value: resolveTokenValue(set, token.path),
    alias: token.aliasOf,
  }));

  const outputs: Record<string, string> = {};

  if (request.formats.includes("json")) {
    outputs[`${set.theme}.tokens.json`] = `${JSON.stringify(
      {
        engine: "style-dictionary-contract",
        engineVersion: request.engineVersion,
        inputHash,
        theme: set.theme,
        version: set.version,
        tokens: resolved,
      },
      null,
      2,
    )}\n`;
  }

  if (request.formats.includes("css")) {
    const lines = resolved.map((token) => {
      const name = `--${token.path.replace(/\./g, "-")}`;
      const suffix = token.type === "dimension" ? "" : "";
      return `  ${name}: ${String(token.value)}${suffix};`;
    });
    outputs[`${set.theme}.tokens.css`] =
      `/* generated deterministically · inputHash=${inputHash} · engine=${request.engineVersion} */\n:root {\n${lines.join("\n")}\n}\n`;
  }

  return { outputs, inputHash, engineVersion: request.engineVersion };
}
