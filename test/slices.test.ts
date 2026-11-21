import { test } from "node:test";
import assert from "node:assert/strict";
import { BRAND_CAPABILITY_NAMES, CAPABILITIES } from "../src/contracts/capabilities.ts";
import { DomainError } from "../src/contracts/errors.ts";
import { composeEnvelope } from "../src/contracts/envelope.ts";
import { enforcePolicy } from "../src/policy/pep.ts";
import { MemoryStore } from "../src/store/memory-store.ts";
import {
  DEFAULT_ACTIVE_SLICE_IDS,
  SLICES,
  resolveActivation,
  validateSliceRegistry,
} from "../src/slices/registry.ts";
import { principalFor, TENANT_A, USER_A, makeStore } from "./helpers.ts";

function envelopeFor(capability: string) {
  return composeEnvelope({
    operationId: "op_slice_00000001",
    tenantId: TENANT_A,
    actorId: USER_A,
    client: {
      capability,
      correlationId: "corr-slice-0001",
      idempotencyKey: "idem-slice-0001",
      dryRun: true,
      payload: {},
    },
  });
}

test("el registro de slices es coherente y cubre cada capacidad exactamente una vez", () => {
  assert.deepEqual(validateSliceRegistry(), []);

  const seen = new Map<string, number>();
  for (const slice of SLICES) {
    for (const capability of slice.capabilities) {
      seen.set(capability, (seen.get(capability) ?? 0) + 1);
    }
  }
  for (const capability of CAPABILITIES.map((spec) => spec.name)) {
    assert.equal(seen.get(capability), 1, `${capability} debe pertenecer a una sola slice`);
  }
  assert.equal(seen.size, BRAND_CAPABILITY_NAMES.length);
});

test("la activación por defecto enciende el core y deja fuera lo que depende de proveedores", () => {
  const activation = resolveActivation();

  assert.deepEqual([...activation.slices].sort(), [...DEFAULT_ACTIVE_SLICE_IDS].sort());
  assert.equal(activation.isCapabilityEnabled("brand.brief.propose"), true);
  assert.equal(activation.isCapabilityEnabled("brand.tokens.export"), true);

  for (const capability of [
    "brand.research.preview",
    "brand.clearance.preview",
    "brand.export.preview",
    "brand.deliver.propose",
    "brand.learning.propose",
    "brand.penpot.preview",
  ]) {
    assert.equal(activation.isCapabilityEnabled(capability), false, `${capability} no debe estar activa`);
  }
  assert.equal(activation.capabilities.size, BRAND_CAPABILITY_NAMES.length - 6);
});

test("una slice ready se puede activar de forma explícita", () => {
  const activation = resolveActivation(["research"]);
  assert.equal(activation.isCapabilityEnabled("brand.research.preview"), true);
  assert.equal(activation.isCapabilityEnabled("brand.clearance.preview"), true);
  assert.equal(activation.isCapabilityEnabled("brand.brief.propose"), false);
});

test("una slice desconocida o una lista vacía se rechazan en vez de ignorarse", () => {
  assert.throws(
    () => resolveActivation(["nope"]),
    (error: unknown) => error instanceof DomainError && error.code === "invalid_input" && error.details["slice"] === "nope",
  );
  assert.throws(
    () => resolveActivation([]),
    (error: unknown) =>
      error instanceof DomainError && error.code === "invalid_input" && error.details["reason"] === "empty_slice_list",
  );
});

test("una slice blocked no se puede activar: falla cerrado con sus blockers", () => {
  assert.throws(
    () => resolveActivation(["penpot"]),
    (error: unknown) => {
      assert.ok(error instanceof DomainError);
      assert.equal(error.code, "policy_violation");
      assert.equal(error.details["slice"], "penpot");
      assert.match(String(error.details["blockers"]), /Penpot/);
      return true;
    },
  );
});

test("el PEP deniega una capacidad de una slice no activada, incluso para el owner", () => {
  const store = makeStore();
  assert.throws(
    () => enforcePolicy({ principal: principalFor(USER_A, TENANT_A), envelope: envelopeFor("brand.export.preview") }, store),
    (error: unknown) => {
      assert.ok(error instanceof DomainError);
      assert.equal(error.code, "unsupported_capability");
      assert.equal(error.details["slice"], "export");
      return true;
    },
  );

  const audit = store.audit.at(-1);
  assert.ok(audit);
  assert.equal(audit.outcome, "blocked");
  assert.equal(audit.reason, "slice_disabled");
});

test("el PEP permite la misma capacidad cuando la slice está activada", () => {
  const store = new MemoryStore({ activation: resolveActivation(["export"]) });
  const result = enforcePolicy(
    { principal: principalFor(USER_A, TENANT_A), envelope: envelopeFor("brand.export.preview") },
    store,
  );
  assert.equal(result.spec.name, "brand.export.preview");
  assert.equal(store.activation.sliceOf("brand.export.preview"), "export");
});
