import { createHash } from "node:crypto";
import { z } from "zod";

/** Opaque, tenant-owned identifiers. Never UUIDs forced onto host ids. */
export const OPAQUE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$/;
export const opaqueId = z
  .string()
  .regex(OPAQUE_ID_PATTERN, "must be an opaque id (8-128 chars, [A-Za-z0-9:_-])");

export const IsoDateTime = z.string().datetime({ offset: true });

/** ISO-4217-ish currency kept as decimal string; no floats for money. */
export const DECIMAL_PATTERN = /^-?(0|[1-9]\d{0,17})(\.\d{1,9})?$/;

export const MoneySchema = z
  .object({
    amount: z.string().regex(DECIMAL_PATTERN, "decimal string"),
    currency: z.string().regex(/^[A-Z]{3}$/, "ISO 4217 code"),
    exponent: z.number().int().min(0).max(9),
  })
  .strict();

export type Money = z.infer<typeof MoneySchema>;

export function money(amount: string, currency = "EUR", exponent = 2): Money {
  return MoneySchema.parse({ amount, currency, exponent });
}

export const ZERO_MONEY = money("0");

function assertSameUnit(a: Money, b: Money): void {
  if (a.currency !== b.currency || a.exponent !== b.exponent) {
    throw new Error(`money unit mismatch: ${a.currency}/${a.exponent} vs ${b.currency}/${b.exponent}`);
  }
}

function toScaled(m: Money, exponent: number): bigint {
  const negative = m.amount.startsWith("-");
  const [intPart = "0", fracPart = ""] = m.amount.replace("-", "").split(".");
  const padded = (fracPart + "0".repeat(exponent)).slice(0, exponent);
  const scaled = BigInt(intPart + padded);
  return negative ? -scaled : scaled;
}

export function toMinorUnits(m: Money): bigint {
  return toScaled(m, m.exponent);
}

export function addMoney(a: Money, b: Money): Money {
  assertSameUnit(a, b);
  const sum = toMinorUnits(a) + toMinorUnits(b);
  return fromMinorUnits(sum, a);
}

export function subMoney(a: Money, b: Money): Money {
  assertSameUnit(a, b);
  return fromMinorUnits(toMinorUnits(a) - toMinorUnits(b), a);
}

export function compareMoney(a: Money, b: Money): -1 | 0 | 1 {
  assertSameUnit(a, b);
  const diff = toMinorUnits(a) - toMinorUnits(b);
  return diff < 0n ? -1 : diff > 0n ? 1 : 0;
}

export function isZeroMoney(a: Money): boolean {
  return toMinorUnits(a) === 0n;
}

export function fromMinorUnits(value: bigint, unit: Money): Money {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const digits = abs.toString().padStart(unit.exponent + 1, "0");
  const intPart = digits.slice(0, digits.length - unit.exponent) || "0";
  const frac = unit.exponent > 0 ? `.${digits.slice(digits.length - unit.exponent)}` : "";
  return { amount: `${negative ? "-" : ""}${intPart}${frac}`, currency: unit.currency, exponent: unit.exponent };
}

/** Deterministic JSON: sorted keys, no undefined, stable for hashing. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`);
  return `{${entries.join(",")}}`;
}

export function sha256Hex(value: unknown): string {
  const input = typeof value === "string" ? value : canonicalJson(value);
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function sha256Base64Url(value: unknown): string {
  const input = typeof value === "string" ? value : canonicalJson(value);
  return createHash("sha256").update(input, "utf8").digest("base64url");
}

export const HashHex = z.string().regex(/^[0-9a-f]{64}$/, "sha256 hex");

/**
 * Strict parser helper: rejects unknown fields, returns typed value.
 * Boundary DTOs must never accept extra keys silently.
 */
export function parseStrict<T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  return schema.parse(input) as z.infer<T>;
}
