// typeRegistry.test.js — contract-tests voor het DiagramType-register.
// Run: npm test  (vanuit web/vite/; node --test)

import test from "node:test";
import assert from "node:assert/strict";

import {
  registreerDiagramType,
  getDiagramType,
  alleDiagramTypes,
  valideerDiagramType,
  MAX_COMPARTIMENTEN,
  _resetVoorTests,
} from "./typeRegistry.js";

/** Minimaal geldig DiagramType om per test te variëren. */
function maakGeldigDiagramType(overrides = {}) {
  return {
    id: "test-type",
    label: "Testtype",
    style: "uml-klassiek",
    elementTypes: [
      { id: "blok", label: "Blok", shape: "class-box" },
      {
        id: "lijn",
        label: "Lijn",
        shape: "edge",
        isConnector: true,
        bron: { elementTypes: ["blok"] },
        doel: { elementTypes: ["blok"] },
      },
    ],
    ...overrides,
  };
}

test("geldig DiagramType registreert en is opvraagbaar", () => {
  _resetVoorTests();
  registreerDiagramType(maakGeldigDiagramType());
  assert.equal(getDiagramType("test-type")?.label, "Testtype");
  assert.equal(alleDiagramTypes().length, 1);
});

test("dubbele registratie van hetzelfde id gooit", () => {
  _resetVoorTests();
  registreerDiagramType(maakGeldigDiagramType());
  assert.throws(() => registreerDiagramType(maakGeldigDiagramType()), /al geregistreerd/);
});

test("verplichte velden: id, label, style, elementTypes", () => {
  assert.ok(valideerDiagramType({}).length >= 3);
  assert.match(valideerDiagramType({}).join("\n"), /id ontbreekt/);
  const zonderElementen = maakGeldigDiagramType({ elementTypes: [] });
  assert.match(valideerDiagramType(zonderElementen).join("\n"), /elementTypes/);
});

test("maximaal 9 compartimenten per ElementType (metamodel 0..9)", () => {
  const teVeel = Array.from({ length: MAX_COMPARTIMENTEN + 1 }, (_, i) => ({
    id: `c${i}`,
    fieldType: "attribuut",
  }));
  const dt = maakGeldigDiagramType();
  dt.elementTypes[0].compartments = teVeel;
  assert.match(valideerDiagramType(dt).join("\n"), /maximum is 9/);
  // Precies 9 is wél geldig
  dt.elementTypes[0].compartments = teVeel.slice(0, MAX_COMPARTIMENTEN);
  assert.equal(valideerDiagramType(dt).length, 0);
});

test("connector vereist bron- en doel-regels", () => {
  const dt = maakGeldigDiagramType();
  delete dt.elementTypes[1].bron;
  assert.match(valideerDiagramType(dt).join("\n"), /zonder bron/);
});

test("verbindingsregels moeten naar bestaande element-typen verwijzen", () => {
  const dt = maakGeldigDiagramType();
  dt.elementTypes[1].doel = { elementTypes: ["bestaat-niet"] };
  assert.match(valideerDiagramType(dt).join("\n"), /onbekend ElementType "bestaat-niet"/);
});

test("dubbele ElementType-ids worden gemeld", () => {
  const dt = maakGeldigDiagramType();
  dt.elementTypes.push({ id: "blok", label: "Blok 2", shape: "class-box" });
  assert.match(valideerDiagramType(dt).join("\n"), /dubbel ElementType-id "blok"/);
});
