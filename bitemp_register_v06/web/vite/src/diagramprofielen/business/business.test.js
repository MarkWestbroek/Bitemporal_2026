// business.test.js — Eriksson-Penker: descriptor geldig, resource als bereik, EA-tabel sluitend.
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/business/business.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { valideerDiagramType } from "../../diagramcore/types/typeRegistry.js";
import { normaliseerErfenis, kopieVoorNormalisatie } from "../../diagramcore/types/erfenis.js";
import { businessDiagramType, elementTypes } from "./descriptor.js";
import { OBJECTEN, CONNECTOREN } from "./eaMapping.js";

test("descriptor is geldig", () => {
  assert.deepEqual(valideerDiagramType(businessDiagramType), []);
});

test("«supply» loopt van elke concrete resource (en actor) naar het proces", () => {
  const dt = kopieVoorNormalisatie(businessDiagramType);
  assert.deepEqual(normaliseerErfenis(dt), []);
  const levering = dt.elementTypes.find((t) => t.id === "levering");
  assert.deepEqual(levering.bron.elementTypes, ["fysiek", "mensen", "informatie", "actor"]);
  assert.deepEqual(levering.doel.elementTypes, ["proces"]);
  for (const id of ["fysiek", "mensen", "informatie"]) {
    const t = dt.elementTypes.find((x) => x.id === id);
    assert.equal(t.shape, "ep-resource");
    assert.ok(t.properties.some((p) => p.key === "hoeveelheid"));
  }
});

test("de vier EP-stereotypen en de doelkoppeling bestaan met vast label", () => {
  for (const [id, label] of [["invoer", "«input»"], ["uitvoer", "«output»"], ["besturing", "«control»"], ["levering", "«supply»"], ["doelkoppeling", "«achieve»"]]) {
    const t = elementTypes.find((x) => x.id === id);
    assert.ok(t?.isConnector, id);
    assert.equal(t.hooks.edgeLabels({ data: {} }).kaal[0].delen[0].tekst, label);
  }
});

test("EA-tabel sluit op de descriptor en kent alle vier EP-lijnen", () => {
  const perId = new Map(elementTypes.map((t) => [t.id, t]));
  for (const r of OBJECTEN) {
    const t = perId.get(r.elementType);
    assert.ok(t && !t.isConnector && !t.isAbstract, r.elementType);
  }
  for (const r of CONNECTOREN) assert.ok(perId.get(r.elementType)?.isConnector, r.elementType);
  for (const st of ["input", "output", "control", "supply"]) assert.ok(CONNECTOREN.some((r) => r.stereotype === st), st);
});
