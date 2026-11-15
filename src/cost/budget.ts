import { DomainError } from "../contracts/errors.ts";
import type { BudgetRecord, MemoryStore } from "../store/memory-store.ts";

/**
 * Budget control per tenant. Money is handled as integer minor units internally
 * and as decimal strings at the boundary: floats are never used for a commitment.
 *
 * A reservation happens BEFORE the paid call. If the reservation does not fit in
 * the ceiling, the operation does not run. There is no "we will settle later".
 */

const EXPONENT: Readonly<Record<string, number>> = { EUR: 2, USD: 2, GBP: 2 };

export function currencyExponent(currency: string): number {
  const exponent = EXPONENT[currency];
  if (exponent === undefined) {
    throw new DomainError("invalid_input", "Unsupported currency.", { details: { currency } });
  }
  return exponent;
}

export function toMinor(value: string, currency: string): bigint {
  if (!/^\d+(\.\d{1,6})?$/.test(value)) {
    throw new DomainError("invalid_input", "Monetary value must be a decimal string.");
  }
  const exponent = currencyExponent(currency);
  const [whole = "0", fraction = ""] = value.split(".");
  const padded = (fraction + "0".repeat(exponent)).slice(0, exponent);
  if (fraction.length > exponent) {
    throw new DomainError("invalid_input", "Monetary value has too many decimals.", { details: { currency } });
  }
  return BigInt(whole) * 10n ** BigInt(exponent) + BigInt(padded === "" ? "0" : padded);
}

export function fromMinor(value: bigint, currency: string): string {
  const exponent = currencyExponent(currency);
  const factor = 10n ** BigInt(exponent);
  const whole = value / factor;
  const fraction = (value % factor).toString().padStart(exponent, "0");
  return `${whole}.${fraction}`;
}

export function setCeiling(store: MemoryStore, tenantId: string, currency: string, ceiling: string): BudgetRecord {
  const record: BudgetRecord = { tenantId, currency, ceiling, reserved: "0.00", consumed: "0.00" };
  store.setBudget(record);
  return record;
}

function requireBudget(store: MemoryStore, tenantId: string): BudgetRecord {
  const budget = store.budgets.get(tenantId);
  if (!budget) {
    throw new DomainError("budget_exhausted", "No budget configured for this tenant.");
  }
  return budget;
}

/**
 * Reserve atomically. Synchronous on purpose: the store operation cannot be
 * interleaved, so two concurrent requests cannot both spend the last unit.
 */
export function reserve(store: MemoryStore, tenantId: string, currency: string, amount: string): void {
  const budget = requireBudget(store, tenantId);
  if (budget.currency !== currency) {
    throw new DomainError("invalid_input", "Budget currency mismatch.", { details: { currency } });
  }
  const ceiling = toMinor(budget.ceiling, currency);
  const reserved = toMinor(budget.reserved, currency);
  const consumed = toMinor(budget.consumed, currency);
  const requested = toMinor(amount, currency);
  if (reserved + consumed + requested > ceiling) {
    throw new DomainError("budget_exhausted", "The request exceeds the remaining budget.", {
      details: { currency },
    });
  }
  budget.reserved = fromMinor(reserved + requested, currency);
}

/** Settle a reservation with the observed cost. Reservations never leak on failure. */
export function settle(store: MemoryStore, tenantId: string, currency: string, reservedAmount: string, actualAmount: string): void {
  const budget = requireBudget(store, tenantId);
  const reserved = toMinor(budget.reserved, currency);
  const consumed = toMinor(budget.consumed, currency);
  const released = toMinor(reservedAmount, currency);
  const actual = toMinor(actualAmount, currency);
  budget.reserved = fromMinor(reserved > released ? reserved - released : 0n, currency);
  budget.consumed = fromMinor(consumed + actual, currency);
}

/** Release a reservation that never produced a cost (dry run, early failure). */
export function release(store: MemoryStore, tenantId: string, currency: string, amount: string): void {
  const budget = requireBudget(store, tenantId);
  const reserved = toMinor(budget.reserved, currency);
  const released = toMinor(amount, currency);
  budget.reserved = fromMinor(reserved > released ? reserved - released : 0n, currency);
}
