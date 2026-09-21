import test from "node:test";
import assert from "node:assert/strict";

import { resolveerCanoniekElement, resolveerKolommen, PROFIELTYPE_CANONIEK_MOTOR } from "./canoniekResolutie.js";

const ELEMENTEN = [
  { id: "e1", elementType: "entiteit", naam: "NatuurlijkPersoon" },
  { id: "e2", elementType: "entiteit", naam: "Organisatie" },
  { id: "g1", elementType: "gegevenselement", naam: "Naam" },
  { id: "g2", elementType: "gegevenselement", naam: "Naam" }, // zelfde naam, andere entiteit
  { id: "g3", elementType: "gegevenselement", naam: "Inkomen" },
];
const CONNECTOREN = [
  { id: "c1", elementType: "bezit", source: "e1", target: "g1" },
  { id: "c2", elementType: "bezit", source: "e2", target: "g2" },
  { id: "c3", elementType: "bezit", source: "e1", target: "g3" },
];

test("resolvet naar de GE die met de juiste entiteit verbonden is", () => {
  assert.deepEqual(
    resolveerCanoniekElement("NatuurlijkPersoon.naam.achternaam", ELEMENTEN, CONNECTOREN),
    { elementId: "g1", niveau: "ge" }
  );
  assert.deepEqual(
    resolveerCanoniekElement("Organisatie.naam", ELEMENTEN, CONNECTOREN),
    { elementId: "g2", niveau: "ge" }
  );
});

test("valt terug op de entiteit als de GE niet (verbonden) te vinden is", () => {
  assert.deepEqual(
    resolveerCanoniekElement("NatuurlijkPersoon.onbekendDeel.x", ELEMENTEN, CONNECTOREN),
    { elementId: "e1", niveau: "entiteit" }
  );
  assert.deepEqual(
    resolveerCanoniekElement("NatuurlijkPersoon", ELEMENTEN, CONNECTOREN),
    { elementId: "e1", niveau: "entiteit" }
  );
  assert.equal(resolveerCanoniekElement("Ruimteschip.naam", ELEMENTEN, CONNECTOREN), null);
});

test("resolveerKolommen herschrijft alleen wat te resolven is", () => {
  const links = [
    { rij: { profielId: "toegangsregels", elementId: "trg:policy" }, kolom: { profielId: "canoniek-model", elementId: "NatuurlijkPersoon.Inkomen" }, soort: "komt voort uit" },
    { rij: { profielId: "toegangsregels", elementId: "x" }, kolom: { profielId: "canoniek-model", elementId: "Ruimteschip.naam" }, soort: "komt voort uit" },
    { rij: { profielId: "toegangsregels", elementId: "y" }, kolom: { profielId: "archimate05", elementId: "am_1" }, soort: "realiseert" },
  ];
  const state = { elements: Object.fromEntries([...ELEMENTEN, ...CONNECTOREN].map((el) => [el.id, el])) };
  const [a, b, c] = resolveerKolommen(links, "canoniek-model", state);
  // Resolvebaar → echt element op de motor.
  assert.deepEqual(a.kolom, { profielId: PROFIELTYPE_CANONIEK_MOTOR, elementId: "g3" });
  // Niet vindbaar → pad-gebaseerd blijft staan.
  assert.deepEqual(b.kolom, { profielId: "canoniek-model", elementId: "Ruimteschip.naam" });
  // Andere profielen blijven onaangeroerd.
  assert.deepEqual(c.kolom, { profielId: "archimate05", elementId: "am_1" });
});
