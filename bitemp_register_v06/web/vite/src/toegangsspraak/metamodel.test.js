import test from "node:test";
import assert from "node:assert/strict";

import { parseBeleid } from "./parser.js";
import { naarOdrl } from "./odrl.js";
import { maakVeldIndex, resolveerVerwijzing, resolveerBeleid, suggereerVanVormen, suggereerBases } from "./metamodel.js";
import { padNaarVerwijzing } from "./parser.js";

// Kleine metamodel-fixture in de vorm van de schema-API (veldpad met
// jsonRolnaam-casing, OAS type/format, enums).
const VELDEN = [
  { veldpad: "NatuurlijkPersoon.naam.voorletters", type: "string" },
  { veldpad: "NatuurlijkPersoon.naam.achternaam", type: "string" },
  { veldpad: "NatuurlijkPersoon.geboorte.datum", type: "string", format: "date" },
  { veldpad: "NatuurlijkPersoon.overlijden.datum", type: "string", format: "date" },
  { veldpad: "NatuurlijkPersoon.inkomen.bedrag", type: "number" },
  { veldpad: "NatuurlijkPersoon.naamgebruik.naamgebruik", type: "string", enum: ["EigenNaam", "PartnerNaam", "EigenPartnerNaam"] },
];

const INDEX = maakVeldIndex(VELDEN);

function verwijzingUit(tekstpad) {
  return padNaarVerwijzing(tekstpad);
}

test("keten-verkorting: eenduidige korte keten vindt het volledige pad (mét metamodel-casing)", () => {
  // "de achternaam van een natuurlijk persoon" — zonder de tussenstap "naam"
  const res = resolveerVerwijzing(verwijzingUit("NatuurlijkPersoon.achternaam"), INDEX);
  assert.equal(res.fout, undefined);
  assert.equal(res.pad, "NatuurlijkPersoon.naam.achternaam");
});

test("keten-verkorting: dubbelzinnige keten eist de volledige keten", () => {
  // "de datum van een natuurlijk persoon" — geboorte én overlijden hebben een datum
  const res = resolveerVerwijzing(verwijzingUit("NatuurlijkPersoon.datum"), INDEX);
  assert.match(res.fout, /dubbelzinnig/);
  assert.match(res.fout, /NatuurlijkPersoon\.geboorte\.datum/);
  assert.match(res.fout, /NatuurlijkPersoon\.overlijden\.datum/);

  // Met de tussenstap is het wél eenduidig.
  const vol = resolveerVerwijzing(verwijzingUit("NatuurlijkPersoon.Geboorte.datum"), INDEX);
  assert.equal(vol.pad, "NatuurlijkPersoon.geboorte.datum");
});

test("onbekend veld en onbekend type geven een klare-taal fout", () => {
  const onbekendVeld = resolveerVerwijzing(verwijzingUit("NatuurlijkPersoon.schoenmaat"), INDEX);
  assert.match(onbekendVeld.fout, /geen veld "schoenmaat"/);
  const onbekendType = resolveerVerwijzing(verwijzingUit("Ruimteschip.naam"), INDEX);
  assert.match(onbekendType.fout, /Onbekend gegevenstype "ruimteschip"/);
});

test("typebewaking: tekst-operator op een datumveld geeft een hint", () => {
  const tekst = `Beleid "Typetest".

  Regel "fout".
    Een beheerder mag de achternaam van de naam van een natuurlijk persoon bekijken
    als de datum van de geboorte van een natuurlijk persoon begint met "19".
`;
  const { ok, beleid } = parseBeleid(tekst);
  assert.ok(ok);
  const { fouten } = resolveerBeleid(beleid, INDEX);
  assert.equal(fouten.length, 1);
  assert.match(fouten[0].bericht, /"begint met" kan alleen met tekst/);
  assert.match(fouten[0].bericht, /is een datum/);
  assert.match(fouten[0].bericht, /is kleiner dan/);
});

test("typebewaking: getal-literal tegen tekstveld en enum-bewaking", () => {
  const tekst = `Beleid "Typetest".

  Regel "fouten".
    Een beheerder mag alle gegevens van een natuurlijk persoon bekijken
    als aan alle volgende voorwaarden is voldaan:
      - de achternaam van de naam van een natuurlijk persoon is 42;
      - het naamgebruik van het naamgebruik van een natuurlijk persoon is "Anders".
`;
  const { ok, beleid } = parseBeleid(tekst);
  assert.ok(ok);
  const { fouten } = resolveerBeleid(beleid, INDEX);
  assert.equal(fouten.length, 2);
  assert.match(fouten[0].bericht, /is tekst, maar wordt vergeleken met een getal \(42\)/);
  assert.match(fouten[1].bericht, /"Anders" is geen toegestane waarde/);
  assert.match(fouten[1].bericht, /"EigenNaam"/);
});

test("resolveerBeleid verrijkt paden; ODRL gebruikt de metamodel-casing", () => {
  const tekst = `Beleid "Resolutie".

  Regel "inzage".
    Een beheerder mag het bedrag van het inkomen van een natuurlijk persoon bekijken
    als de achternaam van een natuurlijk persoon begint met "A".
`;
  const { ok, beleid } = parseBeleid(tekst);
  assert.ok(ok);
  const { beleid: verrijkt, fouten } = resolveerBeleid(beleid, INDEX);
  assert.deepEqual(fouten, []);

  const odrl = naarOdrl(verrijkt);
  assert.equal(odrl.permission[0].target.uid, "nlgov:register:NatuurlijkPersoon.inkomen.bedrag");
  assert.deepEqual(odrl.permission[0].constraint[0].leftOperand, {
    "@id": "nlgov:veldwaarde:NatuurlijkPersoon.naam.achternaam",
  });
  // Het origineel is niet gemuteerd.
  assert.equal(beleid.regels[0].wat.pad, undefined);
});

test("autocomplete vooruit: label toont het overslabare deel tussen haakjes; kort/lang als varianten", () => {
  const treffers = suggereerVanVormen("achterna", INDEX);
  assert.equal(treffers.length, 1);
  assert.equal(treffers[0].label, "de achternaam van (de naam van) een natuurlijk persoon");
  assert.equal(treffers[0].kort, "de achternaam van een natuurlijk persoon");
  assert.equal(treffers[0].lang, "de achternaam van de naam van een natuurlijk persoon");
  assert.equal(treffers[0].pad, "NatuurlijkPersoon.naam.achternaam");

  // Dubbelzinnig blad → alleen de volledige keten is eenduidig (kort = lang).
  const datums = suggereerVanVormen("datum", INDEX);
  assert.deepEqual(
    datums.map((t) => t.label).sort(),
    [
      "de datum van de geboorte van een natuurlijk persoon",
      "de datum van het overlijden van een natuurlijk persoon",
    ]
  );
  assert.equal(datums[0].kort, datums[0].lang);
});

test("autocomplete achterstevoren: 'de achternaam van …' → bases die dat veld hebben", () => {
  // Eenduidig binnen het type → korte basis (keten-verkorting), haakjes in het label.
  const bases = suggereerBases([["achternaam"]], INDEX);
  assert.equal(bases.length, 1);
  assert.equal(bases[0].label, "(de naam van) een natuurlijk persoon");
  assert.equal(bases[0].kort, "een natuurlijk persoon");
  assert.equal(bases[0].lang, "de naam van een natuurlijk persoon");

  // Dubbelzinnig blad → per kandidaat de onderscheidende rest.
  const datums = suggereerBases([["datum"]], INDEX);
  assert.deepEqual(
    datums.map((t) => t.label).sort(),
    ["de geboorte van een natuurlijk persoon", "het overlijden van een natuurlijk persoon"]
  );

  // Met een al getypte tussenstap is het weer eenduidig.
  const geboorte = suggereerBases([["datum"], ["geboorte"]], INDEX);
  assert.deepEqual(geboorte.map((t) => t.kort), ["een natuurlijk persoon"]);
});

test("gegevensgroepen resolven ook: entiteit en GE-rol", () => {
  const tekst = `Beleid "Groepen".

  Regel "alles".
    Een beheerder mag alle gegevens van het inkomen van een natuurlijk persoon bekijken.
`;
  const { beleid } = parseBeleid(tekst);
  const { beleid: verrijkt, fouten } = resolveerBeleid(beleid, INDEX);
  assert.deepEqual(fouten, []);
  const odrl = naarOdrl(verrijkt);
  assert.equal(odrl.permission[0].target.uid, "nlgov:register:NatuurlijkPersoon.inkomen");
});
