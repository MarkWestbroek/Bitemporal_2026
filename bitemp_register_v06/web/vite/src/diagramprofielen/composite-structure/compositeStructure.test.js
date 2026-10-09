// compositeStructure.test.js — descriptor geldig, poorten op de rand, EA-tabel sluitend.
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/composite-structure/compositeStructure.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { valideerDiagramType } from "../../diagramcore/types/typeRegistry.js";
import { normaliseerErfenis, kopieVoorNormalisatie } from "../../diagramcore/types/erfenis.js";
import { compositeStructureDiagramType, elementTypes } from "./descriptor.js";
import { OBJECTEN, CONNECTOREN, RAND_ELEMENTEN, CONTAINERS } from "./eaMapping.js";

test("descriptor is geldig", () => {
  assert.deepEqual(valideerDiagramType(compositeStructureDiagramType), []);
});

test("structureel → klasse, part, collaboratie, collaboratiegebruik; poort woont op klasse/part/collaboratie", () => {
  const dt = kopieVoorNormalisatie(compositeStructureDiagramType);
  assert.deepEqual(normaliseerErfenis(dt), []);
  const dep = dt.elementTypes.find((t) => t.id === "dependency");
  assert.deepEqual(dep.bron.elementTypes, ["klasse", "part", "collaboratie", "collaboratiegebruik", "interface", "package"]);
  const poort = dt.elementTypes.find((t) => t.id === "poort");
  assert.deepEqual(poort.randElement.ouderTypes, ["klasse", "part", "collaboratie"]);
  assert.ok(dt.elementTypes.find((t) => t.id === "collaboratie").compartments.some((c) => c.id === "attributen"));
});

test("connector: assembly-vlag zet de bol; rollen en kardinaliteiten als labels", () => {
  const c = elementTypes.find((t) => t.id === "connector");
  assert.deepEqual(c.hooks.edgePresentatie({ data: { isAssembly: true } }), { markerEnd: "bol" });
  assert.deepEqual(c.hooks.edgePresentatie({ data: {} }), {});
  const kaal = c.hooks.edgeLabels({ data: { bronRol: "a", doelKardinaliteit: "0..*" } }).kaal;
  assert.equal(kaal.length, 2);
});

test("EA-tabel sluit op de descriptor", () => {
  const perId = new Map(elementTypes.map((t) => [t.id, t]));
  for (const r of OBJECTEN) {
    const t = perId.get(r.elementType);
    assert.ok(t && !t.isConnector && !t.isAbstract, r.elementType);
  }
  for (const r of CONNECTOREN) assert.ok(perId.get(r.elementType)?.isConnector, r.elementType);
  for (const id of RAND_ELEMENTEN) assert.ok(perId.get(id)?.randElement, id);
  const dt = kopieVoorNormalisatie(compositeStructureDiagramType);
  normaliseerErfenis(dt);
  for (const id of CONTAINERS) assert.ok(dt.elementTypes.find((t) => t.id === id)?.containerVoor, id);
});
