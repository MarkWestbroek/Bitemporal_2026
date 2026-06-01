// modelTree.test.js — tests voor de pure boom-/FieldRef-helpers.
// Run met: node --test src/modelpicker/modelTree.test.js  (vanuit web/vite/)

import test from "node:test";
import assert from "node:assert/strict";

import { bouwModelTree, filterTree, maakFieldRef, fieldRefKey } from "./modelTree.js";

// Minimaal schema: één entiteit met één GE (Hub-stijl onderliggende) + velden.
const types = [
  {
    typenaam: "NatuurlijkPersoon",
    metatype: "entiteit",
    domein: "np-loc",
    isMaterieel: true,
    velden: [],
    onderliggende: [
      { rolnaam: "Namen", jsonRolnaam: "namen", doeltype: "NP_Naam_Data", momentvoorkomen: "enkelvoudig" },
    ],
  },
  {
    typenaam: "NP_Naam_Data",
    metatype: "gegevenselement",
    domein: "np-loc",
    velden: [
      { naam: "achternaam", type: "string", verplicht: true },
      { naam: "bsn", type: "string", datatype: "BSN" },
    ],
    afgeleideVelden: [
      { naam: "weergavenaam", goType: "string", afleidingsregel: "voornaam + achternaam", afleidingsregelTaal: "cel" },
    ],
  },
  // Type uit ander domein zodat domein-groepering getest wordt.
  { typenaam: "Configuratie", metatype: "entiteit", domein: "configuratie", velden: [] },
];

test("bouwModelTree groepeert per domein en sorteert", () => {
  const tree = bouwModelTree(types);
  assert.equal(tree.length, 2);
  assert.deepEqual(
    tree.map((d) => d.naam),
    ["configuratie", "np-loc"]
  );
});

test("bouwModelTree verbergt configuratie-domein wanneer hiddenDomains is ingesteld", () => {
  const tree = bouwModelTree(types, { hiddenDomains: ["configuratie"] });
  assert.equal(tree.length, 1);
  assert.equal(tree[0].naam, "np-loc");
});

test("bouwModelTree nest GE onder entiteit met velden", () => {
  const tree = bouwModelTree(types);
  const npLoc = tree.find((d) => d.naam === "np-loc");
  const np = npLoc.entiteiten.find((e) => e.type.typenaam === "NatuurlijkPersoon");
  assert.equal(np.kinderen.length, 1);
  const ge = np.kinderen[0];
  assert.equal(ge.rol, "namen");
  // 2 primaire + 1 afgeleid veld
  assert.equal(ge.velden.length, 3);
});

test("afgeleid veld krijgt afgeleid=true en kan uitgesloten worden", () => {
  const metAfgeleid = bouwModelTree(types);
  const geMet = metAfgeleid.find((d) => d.naam === "np-loc").entiteiten[0].kinderen[0];
  assert.ok(geMet.velden.some((k) => k.ref.afgeleid === true));

  const zonder = bouwModelTree(types, { includeAfgeleid: false });
  const geZonder = zonder.find((d) => d.naam === "np-loc").entiteiten[0].kinderen[0];
  assert.equal(geZonder.velden.length, 2);
  assert.ok(geZonder.velden.every((k) => k.ref.afgeleid === false));
});

test("maakFieldRef bouwt veldpad en neemt datatype/dimensie mee", () => {
  const ref = maakFieldRef({
    veld: { naam: "bsn", type: "string", datatype: "BSN" },
    ownerTypenaam: "NP_Naam_Data",
    entiteitTypenaam: "NatuurlijkPersoon",
    rol: "namen",
    tDimensie: "materieel",
  });
  assert.equal(ref.veldpad, "NatuurlijkPersoon.namen.bsn");
  assert.equal(ref.datatype, "BSN");
  assert.equal(ref.tDimensie, "materieel");
  assert.equal(ref.afgeleid, false);
});

test("fieldRefKey is stabiel op typenaam + veldnaam", () => {
  const a = maakFieldRef({ veld: { naam: "bsn" }, ownerTypenaam: "NP_Naam_Data" });
  const b = maakFieldRef({ veld: { naam: "bsn" }, ownerTypenaam: "NP_Naam_Data", tDimensie: "materieel" });
  assert.equal(fieldRefKey(a), fieldRefKey(b));
  assert.equal(fieldRefKey(a), "NP_Naam_Data::bsn");
});

test("filterTree houdt alleen matchende takken", () => {
  const tree = bouwModelTree(types);
  const result = filterTree(tree, "bsn");
  // Alleen np-loc blijft over, met de bsn-veldtak.
  assert.equal(result.length, 1);
  assert.equal(result[0].naam, "np-loc");
  const ge = result[0].entiteiten[0].kinderen[0];
  assert.ok(ge.velden.some((k) => k.ref.veldnaam === "bsn"));
  assert.ok(!ge.velden.some((k) => k.ref.veldnaam === "achternaam"));
});

test("filterTree op entiteitnaam behoudt alle velden", () => {
  const tree = bouwModelTree(types);
  const result = filterTree(tree, "natuurlijkpersoon");
  assert.equal(result.length, 1);
  const np = result[0].entiteiten[0];
  assert.equal(np.kinderen[0].velden.length, 3);
});
