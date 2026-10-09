// requirements.test.js — descriptor geldig, 'eis' als bereik, EA-tabel sluitend.
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/requirements/requirements.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { valideerDiagramType } from "../../diagramcore/types/typeRegistry.js";
import { normaliseerErfenis, kopieVoorNormalisatie } from "../../diagramcore/types/erfenis.js";
import { requirementsDiagramType, elementTypes } from "./descriptor.js";
import { OBJECTEN, CONNECTOREN } from "./eaMapping.js";

test("descriptor is geldig", () => {
  assert.deepEqual(valideerDiagramType(requirementsDiagramType), []);
});

test("'eis' staat voor requirement/feature/issue/change; de vier typen erven id/tekst/status", () => {
  const dt = kopieVoorNormalisatie(requirementsDiagramType);
  assert.deepEqual(normaliseerErfenis(dt), []);
  const agg = dt.elementTypes.find((t) => t.id === "aggregatie");
  assert.deepEqual(agg.bron.elementTypes, ["requirement", "feature", "issue", "change"]);
  const verify = dt.elementTypes.find((t) => t.id === "verify");
  assert.deepEqual(verify.bron.elementTypes, ["requirement", "feature", "issue", "change", "verwijzing"]);
  for (const id of ["requirement", "feature", "issue", "change"]) {
    const t = dt.elementTypes.find((x) => x.id === id);
    assert.equal(t.shape, "rq-eis");
    for (const key of ["reqId", "tekst", "status", "prioriteit"]) assert.ok(t.properties.some((p) => p.key === key), `${id}.${key}`);
  }
  // Het requirement-specifieke 'soort' zit alleen op requirement.
  assert.ok(!dt.elementTypes.find((x) => x.id === "feature").properties.some((p) => p.key === "soort"));
});

test("soort → stereotype op de kop", () => {
  const req = elementTypes.find((t) => t.id === "requirement");
  assert.equal(req.hooks.stereotype({ data: { soort: "Functional" } }), "«functional»");
  assert.equal(req.hooks.stereotype({ data: {} }), "");
});

test("EA-tabel sluit op de descriptor", () => {
  const perId = new Map(elementTypes.map((t) => [t.id, t]));
  for (const r of OBJECTEN) {
    const t = perId.get(r.elementType);
    assert.ok(t && !t.isConnector && !t.isAbstract, r.elementType);
  }
  for (const r of CONNECTOREN) assert.ok(perId.get(r.elementType)?.isConnector, r.elementType);
  assert.ok(OBJECTEN.some((r) => r.elementType === "issue") && OBJECTEN.some((r) => r.elementType === "change"));
});
