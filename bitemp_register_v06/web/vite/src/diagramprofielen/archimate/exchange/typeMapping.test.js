// typeMapping.test.js — dekking van de Exchange-mapping tegen het profiel.
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/archimate/exchange/typeMapping.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { ELEMENT_TYPE_MAPPING, RELATIONSHIP_TYPE_MAPPING } from "./typeMapping.js";
import { ELEMENTEN, ELEMENT_IDS } from "../elementen.js";

test("elke gemapte elementwaarde bestaat als elementtype in het profiel", () => {
  // Dít ging mis bij de eerste echte Archi-import: de mapping kende het type
  // niet omdat het profiel het niet had. De tabel en de mapping horen
  // hetzelfde universum te beschrijven.
  for (const [exchange, id] of Object.entries(ELEMENT_TYPE_MAPPING)) {
    assert.ok(ELEMENT_IDS.includes(id), `${exchange} → ${id} bestaat niet in elementen.js`);
  }
});

test("elk profiel-elementtype is vanuit Exchange bereikbaar", () => {
  // Andersom: een element dat je in Studio kunt tekenen maar dat nooit uit
  // een import kan komen, wijst op een vergeten mapping-regel.
  const bereikbaar = new Set(Object.values(ELEMENT_TYPE_MAPPING));
  for (const [id] of ELEMENTEN) {
    assert.ok(bereikbaar.has(id), `elementtype "${id}" heeft geen Exchange-mapping`);
  }
});

test("de volledige ArchiMate 3.2-elemententabel is gedekt (60 + junction)", () => {
  assert.equal(ELEMENTEN.length, 60);
  // 60 typen; constraint deelt zijn doel-id niet, junction heeft er twee
  // (And/Or) — de mapping is dus groter dan de tabel.
  assert.ok(Object.keys(ELEMENT_TYPE_MAPPING).length >= 61);
});

test("alle elf relaties blijven gedekt, in beide naamvarianten", () => {
  const doelen = new Set(Object.values(RELATIONSHIP_TYPE_MAPPING));
  assert.equal(doelen.size, 11);
  for (const kaal of Object.keys(RELATIONSHIP_TYPE_MAPPING).filter((n) => !n.endsWith("Relationship"))) {
    assert.equal(
      RELATIONSHIP_TYPE_MAPPING[kaal],
      RELATIONSHIP_TYPE_MAPPING[`${kaal}Relationship`],
      `naamvarianten van ${kaal} wijzen niet naar hetzelfde type`
    );
  }
});
