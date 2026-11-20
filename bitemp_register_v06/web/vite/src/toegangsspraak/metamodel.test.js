import test from "node:test";
import assert from "node:assert/strict";

import { parseBeleid } from "./parser.js";
import { toegangsspraakNaarOdrl } from "./odrlExport.js";

/** De knopen van de ODRL-export (ODRL-AP-NL) op naam; `lijst` maakt van één of meer waarden een lijst van namen. */
const odrlKnopen = (beleid) => Object.fromEntries(toegangsspraakNaarOdrl(beleid).jsonld["@graph"].map((k) => [k["@id"], k]));
const lijst = (w) => [w ?? []].flat().map((x) => x?.["@id"] ?? x);
import { maakVeldIndex, resolveerVerwijzing, resolveerBeleid, suggereerVanVormen, suggereerBases, isGroepPad } from "./metamodel.js";
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

  const g = odrlKnopen(verrijkt);
  assert.deepEqual(g["b:regel-inzage"]["odrl:target"], { "@id": "reg:NatuurlijkPersoon.inkomen.bedrag" });
  assert.deepEqual(g[lijst(g["b:regel-inzage"]["odrl:constraint"])[0]]["odrl:leftOperand"], {
    "@id": "ts:veldwaarde.NatuurlijkPersoon.naam.achternaam",
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
  assert.deepEqual(odrlKnopen(verrijkt)["b:regel-alles"]["odrl:target"], { "@id": "reg:NatuurlijkPersoon.inkomen" });
});

test("een groep gegevens waar een veld verwacht wordt: de melding zegt wat je moet schrijven", () => {
  const tekst = `Beleid "Naam".

  Begrippen.
    Naamgegevens zijn: de naam van een natuurlijk persoon.

  Regel "inzage".
    Een beheerder mag de naamgegevens bekijken
    als de naam van een natuurlijk persoon bekend is.
`;
  const { fouten } = resolveerBeleid(parseBeleid(tekst).beleid, INDEX);
  assert.deepEqual(fouten.map((f) => f.bericht), [
    'Begrip "Naamgegevens": "naam" is onder natuurlijk persoon een groep gegevens, geen veld (keten: "de naam van een natuurlijk persoon"). Bedoel je de hele groep, schrijf dan: "alle gegevens van de naam van een natuurlijk persoon".',
    'Regel "inzage": "naam" is onder natuurlijk persoon een groep gegevens, geen veld (keten: "de naam van een natuurlijk persoon"). Een voorwaarde gaat over één veld, bijvoorbeeld "de voorletters van de naam van een natuurlijk persoon" (velden: voorletters, achternaam).',
  ]);
  // Met "alle gegevens van" is het begrip goed.
  const goed = resolveerBeleid(parseBeleid(tekst.replace("Naamgegevens zijn: de naam", "Naamgegevens zijn: alle gegevens van de naam")).beleid, INDEX);
  assert.ok(!goed.fouten.some((f) => f.bericht.startsWith('Begrip "Naamgegevens"')));
});

test("isGroepPad: entiteit en gegevenselement zijn een groep, een veld niet", () => {
  assert.equal(isGroepPad("NatuurlijkPersoon", INDEX), true);
  assert.equal(isGroepPad("NatuurlijkPersoon.naam", INDEX), true);
  assert.equal(isGroepPad("NatuurlijkPersoon.naam.achternaam", INDEX), false);
  assert.equal(isGroepPad("Onbekend.iets", INDEX), false);
  assert.equal(isGroepPad("NatuurlijkPersoon.naam", null), false, "zonder canoniek model: geen gok");
});
