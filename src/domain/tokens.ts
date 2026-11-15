import { z } from "zod";
import { contentHash } from "../contracts/evidence.ts";
import { DomainError } from "../contracts/errors.ts";

/**
 * Design tokens: a closed, typed shape with aliases. Two rules that matter:
 * an alias may not cycle, and an alias may not change type. Both would make an
 * exported token file silently wrong, so both are rejected before export.
 */

export const TOKEN_TYPES = ["color", "dimension", "fontFamily", "fontWeight", "number", "duration"] as const;
export type TokenType = (typeof TOKEN_TYPES)[number];

export const tokenSchema = z
  .object({
    path: z.string().regex(/^[a-z][a-z0-9]*(\.[a-z0-9]+)*$/),
    type: z.enum(TOKEN_TYPES),
    value: z.union([z.string(), z.number()]),
    aliasOf: z.string().regex(/^[a-z][a-z0-9]*(\.[a-z0-9]+)*$/).nullable(),
    description: z.string().max(280).nullable(),
  })
  .strict();

export type Token = z.infer<typeof tokenSchema>;

export const tokenSetSchema = z
  .object({
    id: z.string().min(1).max(128),
    tenantId: z.string().min(1).max(128),
    version: z.number().int().nonnegative(),
    theme: z.enum(["light", "dark", "brand"]),
    tokens: z.array(tokenSchema).min(1).max(2048),
  })
  .strict();

export type TokenSet = z.infer<typeof tokenSetSchema>;

function byPath(set: TokenSet): Map<string, Token> {
  const map = new Map<string, Token>();
  for (const token of set.tokens) {
    if (map.has(token.path)) {
      throw new DomainError("invalid_input", "Duplicate token path.", { details: { path: token.path } });
    }
    map.set(token.path, token);
  }
  return map;
}

/**
 * Resolve one token, following aliases with a visited set. A cycle is an error,
 * not a "best effort" resolution.
 */
export function resolveToken(set: TokenSet, path: string): { token: Token; value: string | number } {
  const map = byPath(set);
  let current = map.get(path);
  if (!current) throw new DomainError("not_found", "Token not found.", { details: { path } });
  const visited = new Set<string>();
  while (current.aliasOf !== null) {
    if (visited.has(current.path)) {
      throw new DomainError("invalid_input", "Token alias cycle detected.", {
        details: { path, cycle: [...visited].join(">") },
      });
    }
    visited.add(current.path);
    const next = map.get(current.aliasOf);
    if (!next) {
      throw new DomainError("invalid_input", "Alias target does not exist.", {
        details: { path: current.path, aliasOf: current.aliasOf },
      });
    }
    if (next.type !== current.type) {
      throw new DomainError("invalid_input", "Alias changes the token type.", {
        details: { path: current.path, from: current.type, to: next.type },
      });
    }
    current = next;
  }
  return { token: current, value: current.value };
}

export function validateTokenSet(set: TokenSet): void {
  tokenSetSchema.parse(set);
  byPath(set);
  for (const token of set.tokens) {
    if (token.type === "color" && token.aliasOf === null) {
      if (typeof token.value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(token.value)) {
        throw new DomainError("invalid_input", "A color token must hold a hex value.", {
          details: { path: token.path },
        });
      }
    }
    resolveToken(set, token.path);
  }
}

/**
 * Deterministic Style Dictionary-shaped export. No transforms are executed: the
 * output is a pure function of the validated set.
 */
export function exportStyleDictionary(set: TokenSet): { output: Record<string, unknown>; hash: string } {
  validateTokenSet(set);
  type Node = Record<string, unknown>;
  const root: Node = {};
  const sorted = [...set.tokens].sort((a, b) => (a.path < b.path ? -1 : 1));

  for (const token of sorted) {
    const resolved = resolveToken(set, token.path);
    const segments = token.path.split(".");
    let cursor: Node = root;
    for (const segment of segments.slice(0, -1)) {
      const existing = cursor[segment];
      if (existing === undefined) {
        const created: Node = {};
        cursor[segment] = created;
        cursor = created;
      } else {
        cursor = existing as Node;
      }
    }
    const leaf = segments[segments.length - 1] as string;
    cursor[leaf] = {
      $type: token.type,
      $value: resolved.value,
      ...(token.description === null ? {} : { $description: token.description }),
    };
  }

  return { output: { [set.theme]: root }, hash: contentHash({ theme: set.theme, tokens: sorted }) };
}

/** Two exports of the same set must be byte-identical; this is the test hook. */
export function exportIsReproducible(set: TokenSet): boolean {
  const first = JSON.stringify(exportStyleDictionary(set).output);
  const second = JSON.stringify(exportStyleDictionary(set).output);
  return first === second;
}
