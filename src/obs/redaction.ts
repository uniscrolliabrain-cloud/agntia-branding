/**
 * Log redaction.
 *
 * Telemetry is not an evidence ledger; it is the place where secrets leak by
 * accident. Unknown keys are kept only if they are short primitives, and a
 * denylist removes credentials, tokens and client content.
 */

const DENY_EXACT = new Set([
  "password",
  "secret",
  "token",
  "authorization",
  "cookie",
  "apikey",
  "api_key",
  "access_token",
  "refresh_token",
  "private_key",
  "client_secret",
  "service_role_key",
  "dsn",
  "database_url",
  "prompt",
  "payload",
  "content",
  "brief",
  "original",
]);

const DENY_PATTERN = /(secret|token|password|credential|authorization|cookie|key)$/i;

export type Redacted = Record<string, string | number | boolean | null>;

export function redact(record: Record<string, unknown>): Redacted {
  const out: Redacted = {};
  for (const [key, value] of Object.entries(record)) {
    if (DENY_EXACT.has(key.toLowerCase()) || DENY_PATTERN.test(key)) {
      out[key] = "[redacted]";
      continue;
    }
    if (value === null || typeof value === "number" || typeof value === "boolean") {
      out[key] = value;
      continue;
    }
    if (typeof value === "string") {
      out[key] = value.length > 200 ? `${value.slice(0, 200)}…` : value;
      continue;
    }
    // Objects and arrays are dropped: they are the usual carrier of client data.
    out[key] = "[object]";
  }
  return out;
}

/** Fail-closed check used by tests and by the API error path. */
export function containsSecretMarker(serialized: string, marker: string): boolean {
  return serialized.includes(marker);
}
