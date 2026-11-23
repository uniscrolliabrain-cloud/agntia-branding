#!/usr/bin/env node
/**
 * Consumer smoke test, executed inside a throw-away npm project that installed
 * the tarballs from artifacts/parent-install. It proves that the packed
 * packages load and compose outside this monorepo.
 */
import assert from "node:assert/strict";
import { ApiError, money, sha256Hex } from "@agntia/contracts";
import {
  buildTokens,
  documentHash,
  evaluatePalette,
  isBriefReady,
  proposeBrief,
} from "@agntia/domain";
import { resolvePrincipal } from "@agntia/identity";
import { ResourceStore } from "@agntia/persistence";
import * as adapters from "@agntia/adapters";
import { BrandingClient } from "@agntia/sdk";
import { createApp } from "@agntia/api";
import { BrandingService } from "@agntia/api/service";
import { VERTICAL_STAGES, VerticalService } from "@agntia/api/verticals";

assert.equal(money("1.00").amount, "1.00", "money parses outside the monorepo");
assert.equal(sha256Hex({ b: 2, a: 1 }), sha256Hex({ a: 1, b: 2 }), "canonical hashing is stable");

const brief = proposeBrief({
  briefId: "brief_consumer_1",
  tenantId: "tenant_consumer",
  resourceId: "res_consumer_1",
  purpose: null,
  audienceDeclared: null,
  deliverables: ["brandbook"],
  constraints: [],
  acceptance: ["owner_approval"],
});
assert.equal(isBriefReady(brief), false, "unknown brief facts stay pending");

const tokens = buildTokens(
  {
    tokenSetId: "tokens_consumer",
    tenantId: "tenant_consumer",
    theme: "light",
    version: 1,
    tokens: [{ path: "color.brand.primary", type: "color", value: "#0a58ca", aliasOf: null }],
  },
  { formats: ["css"], transforms: ["name/kebab"], engineVersion: "0.1.0" },
);
assert.match(tokens.outputs["light.tokens.css"], /--color-brand-primary: #0a58ca;/, "token build works");

const contrast = evaluatePalette([
  { pairId: "body", foreground: "#111111", background: "#ffffff", usage: "body_text" },
]);
assert.equal(contrast.passed, true, "contrast gate works");

const principal = resolvePrincipal({
  claims: { sub: "user_consumer", app_metadata: { tenant_id: "tenant_consumer" } },
  memberships: [
    {
      tenantId: "tenant_consumer",
      userId: "user_consumer",
      role: "owner",
      status: "active",
      scopes: ["brand.review.decide"],
      provisionedAt: new Date().toISOString(),
    },
  ],
});
assert.equal(principal.tenantId, "tenant_consumer", "principal resolves from signed tenant claim");

const resources = new ResourceStore();
const stored = resources.put({
  tenantId: "tenant_consumer",
  resourceId: "res_consumer_1",
  payload: { ok: true },
  expectedVersion: null,
  actorId: "user_consumer",
  now: new Date(),
});
assert.equal(stored.version, 1, "resource store works");
assert.throws(() => resources.get("tenant_other", "res_consumer_1"), /not found/, "cross-tenant read is not found");

assert.ok(Object.keys(adapters).length > 0, "adapters package exports runtime symbols");
assert.equal(VERTICAL_STAGES.length, 12, "vertical slice stages are exported");

const document = {
  documentId: "doc_consumer_1",
  tenantId: "tenant_consumer",
  resourceId: "res_consumer_1",
  version: 0,
  engine: "branding-dom",
  engineVersion: "0.1.0",
  nodes: [],
  constraints: [],
  textSources: [],
  fontHashes: [],
  updatedAt: new Date().toISOString(),
};
assert.match(documentHash(document), /^[0-9a-f]{64}$/, "document hash works");

const service = new BrandingService();
const app = createApp({
  verifier: {
    verify: async () => {
      throw new ApiError("unauthenticated", "consumer smoke has no signing key");
    },
  },
  memberships: [],
  service,
});
assert.equal((await app.request("/health")).status, 200, "Hono app serves /health");
assert.equal((await app.request("/v1/branding/verticals/vertical_smoke_1")).status, 401, "vertical routes are deny-by-default");

new VerticalService(service);
new BrandingClient({ baseUrl: "http://127.0.0.1:1", accessToken: "unused" });
console.log("PARENT_INSTALL_SMOKE PASS");
