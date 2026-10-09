// object.test.js — objectdiagram: descriptor geldig, multiobject erft, RunState → slots.
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/object/object.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { valideerDiagramType } from "../../diagramcore/types/typeRegistry.js";
import { normaliseerErfenis, kopieVoorNormalisatie } from "../../diagramcore/types/erfenis.js";
import { objectDiagramType, elementTypes } from "./descriptor.js";
import { OBJECTEN, CONNECTOREN, slotsUitRunState, EA_DIAGRAM_TYPES } from "./eaMapping.js";

test("descriptor is geldig", () => {
  assert.deepEqual(valideerDiagramType(objectDiagramType), []);
});

test("multiobject erft shape, slots en properties van object", () => {
  const dt = kopieVoorNormalisatie(objectDiagramType);
  assert.deepEqual(normaliseerErfenis(dt), []);
  const mo = dt.elementTypes.find((t) => t.id === "multiobject");
  assert.equal(mo.shape, "ob-object");
  assert.deepEqual(mo.compartments.map((c) => c.id), ["slots"]);
  assert.ok(mo.properties.some((p) => p.key === "instantieVan"));
  assert.equal(mo.randDikte, 3);
  // Bereik: een concreet type staat ook voor zijn afstammelingen — een link
  // mag dus ook aan een multiobject.
  assert.deepEqual(dt.elementTypes.find((t) => t.id === "link").bron.elementTypes, ["object", "multiobject"]);
});

test("EA-tabel sluit op de descriptor", () => {
  const perId = new Map(elementTypes.map((t) => [t.id, t]));
  for (const r of OBJECTEN) assert.ok(perId.get(r.elementType) && !perId.get(r.elementType).isConnector, r.elementType);
  for (const r of CONNECTOREN) assert.ok(perId.get(r.elementType)?.isConnector, r.elementType);
  assert.deepEqual(EA_DIAGRAM_TYPES, ["Object"]);
});

test("RunState → slots", () => {
  assert.deepEqual(slotsUitRunState("@VAR;Variable=naam;Value=Jan;Op==;@ENDVAR;@VAR;Variable=leeftijd;Value=42;Op==;@ENDVAR;"), [
    { naam: "naam", typeLabel: "Jan" },
    { naam: "leeftijd", typeLabel: "42" },
  ]);
  assert.deepEqual(slotsUitRunState(""), []);
  assert.deepEqual(slotsUitRunState(null), []);
});
