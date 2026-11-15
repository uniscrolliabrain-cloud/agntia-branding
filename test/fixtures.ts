import { contentHash } from "../src/contracts/evidence.ts";
import { designDocumentSchema, type DesignDocument } from "../src/domain/document.ts";
import type { TokenSet } from "../src/domain/tokens.ts";
import type { AssetRights, FontLicense } from "../src/domain/rights.ts";
import type { ContrastPair } from "../src/domain/palette.ts";

const NOW = "2026-11-15T10:00:00.000Z";

export const supportFixture = {
  tokens(tenantId: string): TokenSet {
    return {
      id: "ts_e2e",
      tenantId,
      version: 1,
      theme: "brand",
      tokens: [
        { path: "color.brand.primary", type: "color", value: "#0a5cff", aliasOf: null, description: "azul de marca" },
        { path: "color.brand.cta", type: "color", value: "#0a5cff", aliasOf: "color.brand.primary", description: null },
        { path: "space.gutter", type: "dimension", value: "16px", aliasOf: null, description: null },
      ],
    };
  },

  document(tenantId: string): DesignDocument {
    return designDocumentSchema.parse({
      id: "doc_e2e",
      tenantId,
      version: 1,
      nodes: [
        { id: "t1", kind: "text", x: 0, y: 0, width: 240, height: 48, textRef: "headline", fontRef: "inter", fill: "#111111", locked: false },
        { id: "r1", kind: "rect", x: 0, y: 60, width: 240, height: 8, textRef: null, fontRef: null, fill: "#0a5cff", locked: false },
      ],
      textSources: { headline: "Marca verificable" },
      engine: "deterministic",
      engineVersion: "1.0.0",
      fontHash: contentHash({ family: "Inter" }),
      constraints: ["safe-area"],
    });
  },

  font(tenantId: string): FontLicense {
    return {
      id: "font_e2e",
      tenantId,
      family: "Inter",
      foundry: "Example Foundry",
      licenseRef: "license-inter-1",
      licenseVerified: true,
      embeddingAllowed: true,
      subsettingAllowed: true,
      redistributionAllowed: false,
      verifiedAt: NOW,
    };
  },

  assets(tenantId: string): Array<{ rights: AssetRights; purpose: "brandbook"; territory: string }> {
    return [
      {
        rights: {
          id: "asset_e2e",
          tenantId,
          assetHash: contentHash({ asset: "pattern-1" }),
          source: "licensed",
          licenseRef: "license-pattern-1",
          releaseRef: "release-pattern-1",
          purposes: ["brandbook", "client_handoff"],
          territory: ["ES", "EU"],
          expiresAt: null,
          revokedAt: null,
        },
        purpose: "brandbook",
        territory: "ES",
      },
    ];
  },

  palette(): ContrastPair[] {
    return [
      { id: "body", foreground: "#111111", background: "#ffffff", usage: "normal_text" },
      { id: "cta", foreground: "#ffffff", background: "#0a5cff", usage: "large_text" },
    ];
  },
};
