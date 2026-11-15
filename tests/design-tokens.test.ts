import { describe, expect, it } from "vitest";
import {
  assertLogoMatchesApproval,
  assertPenpotAccess,
  buildTokens,
  documentHash,
  logoPayloadHash,
  renderFingerprint,
  resolveTokenValue,
  sanitizeSvg,
  tokenDependents,
  updateDocument,
  validateTokenSet,
} from "@agntia/domain";
import { TENANT_A, makeDocument, textNode } from "./helpers.ts";

describe("C17 · Documento vectorial", () => {
  it("aplica CAS y rechaza versiones concurrentes", () => {
    const doc = makeDocument();
    const updated = updateDocument(doc, { upsert: [textNode({ text: "Nuevo" })] }, 0, new Date());
    expect(updated.version).toBe(1);
    expect(() => updateDocument(doc, { upsert: [textNode({ text: "Otro" })] }, 1, new Date())).toThrowError(/version mismatch/);
  });

  it("respeta nodos bloqueados", () => {
    const doc = makeDocument({ nodes: [textNode({ locked: true })] });
    expect(() => updateDocument(doc, { upsert: [textNode({ text: "X", locked: true })] }, 0, new Date())).toThrowError(/locked/);
  });

  it("el render es determinista y depende de engine, versión y fuentes", () => {
    const doc = makeDocument();
    expect(documentHash(doc)).toBe(documentHash(makeDocument()));
    expect(renderFingerprint(doc)).toBe(renderFingerprint(makeDocument()));
    expect(renderFingerprint({ ...doc, engineVersion: "0.2.0" })).not.toBe(renderFingerprint(doc));
  });
});

describe("C19 · SVG no ejecutable", () => {
  it("acepta SVG estático simple", () => {
    const result = sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect x="0" y="0" width="10" height="10" fill="#ffffff"/></svg>');
    expect(result.sanitized).toContain("<rect");
  });

  it("rechaza script, handlers, foreignObject y data URLs", () => {
    expect(() => sanitizeSvg('<svg><script>alert(1)</script></svg>')).toThrowError(/script_element/);
    expect(() => sanitizeSvg('<svg><rect onload="alert(1)"/></svg>')).toThrowError(/event_handler/);
    expect(() => sanitizeSvg('<svg><foreignObject></foreignObject></svg>')).toThrowError(/foreign_object/);
    expect(() => sanitizeSvg('<svg><image href="data:image/svg+xml;base64,AA"/></svg>')).toThrowError(/external_or_data_reference|not allowed/);
    expect(() => sanitizeSvg('<svg><a href="javascript:alert(1)"/></svg>')).toThrowError(/javascript_uri|not allowed/);
  });

  it("elimina atributos no permitidos en lugar de ejecutarlos", () => {
    const result = sanitizeSvg('<svg><rect width="10" height="10" stroke-dasharray="4 4"/></svg>');
    expect(result.removedAttributes).toContain("stroke-dasharray");
    expect(result.sanitized).not.toContain("stroke-dasharray");
  });
});

describe("C18 · Penpot", () => {
  const binding = {
    bindingId: "binding_001",
    tenantId: TENANT_A,
    teamId: "team_1",
    projectId: "project_1",
    fileIds: ["file_1"],
    role: "editor" as const,
    capabilities: ["brand.penpot.preview"],
    verifiedAt: null,
  };

  it("un file de otro workspace no se abre bajo el binding", () => {
    expect(() => assertPenpotAccess(binding, { tenantId: TENANT_A, fileId: "file_2", write: false })).toThrowError(/not part of this binding/);
    expect(() => assertPenpotAccess(binding, { tenantId: "tenant_bbbb", fileId: "file_1", write: false })).toThrowError(/another tenant/);
  });
});

describe("C20 · Logotipo", () => {
  const logo = {
    logoId: "logo_0001",
    tenantId: TENANT_A,
    revision: 2,
    geometryHash: "d".repeat(64),
    wordmark: "Aurea",
    variants: [{ variantId: "variant_1", name: "principal", minWidthPx: 32, clearSpacePx: 8, colorMode: "full_color" as const }],
    approvalRef: "approval_001",
  };

  it("editar el logo tras la aprobación invalida el paquete", () => {
    const approved = logoPayloadHash(logo);
    expect(() => assertLogoMatchesApproval(logo, approved)).not.toThrow();
    expect(() => assertLogoMatchesApproval({ ...logo, wordmark: "Aurea 2" }, approved)).toThrowError(/after approval/);
  });
});

describe("C22 · Tokens", () => {
  const tokenSet = {
    tokenSetId: "tokens_001",
    tenantId: TENANT_A,
    theme: "light",
    version: 1,
    tokens: [
      { path: "color.brand.primary", type: "color" as const, value: "#0a58ca", aliasOf: null },
      { path: "color.action.background", type: "color" as const, value: "#0a58ca", aliasOf: "color.brand.primary" },
      { path: "space.sm", type: "dimension" as const, value: "8px", aliasOf: null },
    ],
  };

  it("resuelve alias y calcula dependientes", () => {
    expect(resolveTokenValue(tokenSet, "color.action.background")).toBe("#0a58ca");
    expect(tokenDependents(tokenSet, "color.brand.primary")).toEqual(["color.action.background", "color.brand.primary"]);
  });

  it("no exporta alias cíclicos ni tipos incompatibles", () => {
    const cyclic = {
      ...tokenSet,
      tokens: [
        { path: "color.a", type: "color" as const, value: "#000000", aliasOf: "color.b" },
        { path: "color.b", type: "color" as const, value: "#ffffff", aliasOf: "color.a" },
      ],
    };
    expect(() => validateTokenSet(cyclic)).toThrowError(/cyclic/);
    const mistyped = {
      ...tokenSet,
      tokens: [
        { path: "space.sm", type: "dimension" as const, value: "8px", aliasOf: "color.brand.primary" },
        { path: "color.brand.primary", type: "color" as const, value: "#0a58ca", aliasOf: null },
      ],
    };
    expect(() => validateTokenSet(mistyped)).toThrowError(/points to/);
  });
});

describe("C23 · Style Dictionary", () => {
  const tokenSet = {
    tokenSetId: "tokens_001",
    tenantId: TENANT_A,
    theme: "light",
    version: 1,
    tokens: [
      { path: "color.brand.primary", type: "color" as const, value: "#0a58ca", aliasOf: null },
      { path: "space.sm", type: "dimension" as const, value: "8px", aliasOf: null },
    ],
  };

  it("el build es reproducible y ordenado", () => {
    const first = buildTokens(tokenSet, { formats: ["css", "json"], transforms: ["name/kebab", "color/hex"], engineVersion: "4.0.0" });
    const second = buildTokens(tokenSet, { formats: ["css", "json"], transforms: ["name/kebab", "color/hex"], engineVersion: "4.0.0" });
    expect(first.outputs).toEqual(second.outputs);
    expect(first.inputHash).toBe(second.inputHash);
    expect(first.outputs["light.tokens.css"]).toContain("--color-brand-primary: #0a58ca;");
  });

  it("rechaza transforms no allowlisted", () => {
    expect(() => buildTokens(tokenSet, { formats: ["css"], transforms: ["custom/exec"], engineVersion: "4.0.0" })).toThrowError(/not allowlisted/);
  });
});
