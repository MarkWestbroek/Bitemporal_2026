// afgeleid.test.js — wanneer krijgt een veld of relatie de UML-"/".
// Run: node --import ./test/register-aliases.mjs --test src/diagramcore/model/afgeleid.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { isAfgeleid } from "./afgeleid.js";

test("data.afgeleid is de bestaande conventie", () => {
  assert.equal(isAfgeleid({ afgeleid: true }), true);
  assert.equal(isAfgeleid({ afgeleid: false }), false);
  assert.equal(isAfgeleid({}), false);
  assert.equal(isAfgeleid(null), false);
});

test("een property met betekenis 'afgeleid' telt, onder zijn eigen naam (MIM)", () => {
  const relatiesoort = { properties: [{ key: "indicatieAfleidbaar", betekenis: "afgeleid" }] };
  assert.equal(isAfgeleid({ indicatieAfleidbaar: true }, relatiesoort), true);
  assert.equal(isAfgeleid({ indicatieAfleidbaar: false }, relatiesoort), false);
  // Zonder betekenis is de sleutel gewoon data.
  assert.equal(isAfgeleid({ indicatieAfleidbaar: true }, { properties: [{ key: "indicatieAfleidbaar" }] }), false);
});

test("FieldType/ElementType.afgeleid: elk voorkomen is afgeleid", () => {
  assert.equal(isAfgeleid({}, { afgeleid: true }), true);
  assert.equal(isAfgeleid(null, { afgeleid: true }), true);
});

import { veldAanvulling } from "./afgeleid.js";

test("veldAanvulling: UML-notatie volgens de betekenis van de properties", () => {
  const type = {
    properties: [
      { key: "kardinaliteit", betekenis: "kardinaliteit" },
      { key: "standaardwaarde", betekenis: "standaardwaarde" },
      { key: "zichtbaarheid", betekenis: "zichtbaarheid" },
      { key: "geordend", betekenis: "geordend" },
      { key: "nietUniek", betekenis: "nietUniek" },
      { key: "alleenLezen", betekenis: "alleenLezen" },
      { key: "identificerend", betekenis: "id" },
    ],
  };
  assert.deepEqual(
    veldAanvulling({ kardinaliteit: "0..*", standaardwaarde: "5", zichtbaarheid: "Private", geordend: true, alleenLezen: true, identificerend: true }, type),
    { zichtbaarheid: "-", kardinaliteit: "0..*", standaardwaarde: "5", eigenschappen: ["ordered", "readOnly", "id"] }
  );
  // Zonder betekenis: niets (bestaande profielen veranderen niet).
  assert.deepEqual(veldAanvulling({ kardinaliteit: "1" }, { properties: [{ key: "kardinaliteit" }] }), { zichtbaarheid: "", kardinaliteit: "", standaardwaarde: "", eigenschappen: [] });
  assert.deepEqual(veldAanvulling(null, type).eigenschappen, []);
});
