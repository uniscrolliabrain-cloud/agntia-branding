import { DomainError } from "../contracts/errors.ts";

/**
 * SVG is executable. An uploaded or model-generated vector can carry scripts,
 * event handlers, external entity expansion or a remote reference that leaks the
 * reader's IP and referrer. The canvas therefore accepts an allowlist and
 * rejects anything else: no "sanitize and hope", no silent stripping of a
 * dangerous construct.
 */

const ALLOWED_ELEMENTS = new Set([
  "svg",
  "g",
  "defs",
  "title",
  "desc",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "text",
  "tspan",
  "lineargradient",
  "radialgradient",
  "stop",
  "clippath",
  "mask",
  "pattern",
]);

const ALLOWED_ATTRIBUTES = new Set([
  "xmlns",
  "xmlns:xlink",
  "viewbox",
  "width",
  "height",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "d",
  "points",
  "transform",
  "fill",
  "fill-opacity",
  "fill-rule",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-opacity",
  "opacity",
  "offset",
  "stop-color",
  "stop-opacity",
  "id",
  "class",
  "font-family",
  "font-size",
  "font-weight",
  "text-anchor",
  "letter-spacing",
  "dominant-baseline",
  "clip-path",
  "mask",
  "gradientunits",
  "patternunits",
  "preserveaspectratio",
]);

const FORBIDDEN_PATTERNS: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
  { pattern: /<\s*script\b/i, reason: "script_element" },
  { pattern: /<\s*foreignobject\b/i, reason: "foreign_object" },
  { pattern: /<\s*(iframe|object|embed|applet|frame)\b/i, reason: "embedded_document" },
  { pattern: /<\s*(handler|listener)\b/i, reason: "event_handler_element" },
  { pattern: /<!entity/i, reason: "xml_entity" },
  { pattern: /<!doctype/i, reason: "doctype" },
  { pattern: /<!\[cdata\[/i, reason: "cdata" },
  { pattern: /\son[a-z]+\s*=/i, reason: "inline_event_handler" },
  { pattern: /javascript:/i, reason: "javascript_uri" },
  { pattern: /vbscript:/i, reason: "vbscript_uri" },
  { pattern: /data:text\/html/i, reason: "html_data_uri" },
  { pattern: /@import/i, reason: "css_import" },
  { pattern: /expression\s*\(/i, reason: "css_expression" },
  { pattern: /<\s*style\b/i, reason: "style_element" },
];

const EXTERNAL_URL = /(?:href|src)\s*=\s*["']\s*(?:https?:)?\/\//i;
const DATA_URI = /(?:href|src)\s*=\s*["']\s*data:/i;

export interface SanitizedSvg {
  svg: string;
  strippedAttributes: string[];
}

/**
 * Fail-closed: dangerous constructs throw instead of being cleaned, because a
 * cleaned-but-changed vector can no longer be attributed to its approved
 * version.
 */
export function sanitizeSvg(input: string): SanitizedSvg {
  if (typeof input !== "string" || input.trim() === "") {
    throw new DomainError("invalid_input", "SVG content is empty.");
  }
  if (input.length > 512_000) {
    throw new DomainError("invalid_input", "SVG exceeds the size limit.");
  }

  for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
    if (pattern.test(input)) {
      throw new DomainError("policy_violation", "The SVG contains a forbidden construct.", {
        details: { reason },
      });
    }
  }
  if (EXTERNAL_URL.test(input)) {
    throw new DomainError("policy_violation", "The SVG references an external URL.", {
      details: { reason: "external_url" },
    });
  }
  if (DATA_URI.test(input)) {
    throw new DomainError("policy_violation", "The SVG embeds a data URI.", { details: { reason: "data_uri" } });
  }

  // Element allowlist.
  const elementPattern = /<\s*\/?\s*([a-zA-Z][a-zA-Z0-9:-]*)/g;
  for (const match of input.matchAll(elementPattern)) {
    const name = (match[1] ?? "").toLowerCase();
    if (!ALLOWED_ELEMENTS.has(name)) {
      throw new DomainError("policy_violation", "The SVG contains a disallowed element.", {
        details: { reason: "element_not_allowed", element: name.slice(0, 32) },
      });
    }
  }

  // Attribute allowlist: unknown attributes are removed and reported, never kept.
  const stripped: string[] = [];
  const svg = input.replace(/<([a-zA-Z][a-zA-Z0-9:-]*)((?:\s+[^<>]*?)?)\s*\/?>/g, (full, tag: string, attrs: string) => {
    if (!attrs) return full;
    const kept: string[] = [];
    const attrPattern = /([a-zA-Z_:][a-zA-Z0-9_:.-]*)\s*=\s*("[^"]*"|'[^']*')/g;
    for (const attr of attrs.matchAll(attrPattern)) {
      const name = (attr[1] ?? "").toLowerCase();
      if (ALLOWED_ATTRIBUTES.has(name)) kept.push(`${attr[1]}=${attr[2]}`);
      else stripped.push(name.slice(0, 32));
    }
    return `<${tag}${kept.length > 0 ? ` ${kept.join(" ")}` : ""}>`;
  });

  if (!/^\s*(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(svg)) {
    throw new DomainError("invalid_input", "The document is not an SVG root.");
  }

  return { svg, strippedAttributes: [...new Set(stripped)].sort() };
}

/** A model may propose a vector, but never a URL, a script or a handler. */
export function assertModelVectorSafe(input: string): void {
  sanitizeSvg(input);
}
