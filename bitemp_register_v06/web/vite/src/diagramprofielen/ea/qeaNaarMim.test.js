// qeaNaarMim.test.js — EA-model met MIM-profiel → mim12, op een echte fixture:
// vier objecttypen uit "Model Kern RSGB" (Delfts Gemeentelijk Gegevensmodel) met
// 67 attribuutsoorten en hun MIM-tagged values (oude MDG-namen met metaklasse-suffix).
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/ea/qeaNaarMim.test.js

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { qeaNaarMim, normaliseerTagnaam } from "./qeaNaarMim.js";

const hier = dirname(fileURLToPath(import.meta.url));
const bron = JSON.parse(readFileSync(join(hier, "fixtures", "model-kern-rsgb.qea.json"), "utf8"));
const model = qeaNaarMim(bron, { packageId: 177, schaal: 1 });
const els = Object.values(model.elements);
const van = (type) => els.filter((e) => e.elementType === type);
const opNaam = (naam) => els.find((e) => e.naam === naam);
const np = opNaam("NatuurlijkPersoon");
const attrs = np.compartimenten[0].velden;
const veld = (naam) => attrs.find((v) => v.naam === naam);

test("MIM::Objecttype → objecttype; package met soort; generalisatieketen", () => {
  assert.equal(van("objecttype").length, 4);
  assert.deepEqual(np.data.stereotypen, ["MIM::Objecttype"]);
  const pk = van("package")[0];
  assert.equal(pk.naam, "Model Kern RSGB");
  assert.equal(pk.data.soort, "domein");
  const gens = van("generalisatie");
  assert.equal(gens.length, 2);
  const ip = opNaam("IngeschrevenPersoon"), persoon = opNaam("Persoon");
  assert.ok(gens.some((g) => g.source === ip.id && g.target === np.id));
  assert.ok(gens.some((g) => g.source === np.id && g.target === persoon.id));
  assert.deepEqual(model.verslag.overgeslagen, {});
  // Element-tags met suffix "objecttype" → mim12-properties; memo's komen uit NOTES.
  const tagNP = (naam) => bron.t_objectproperties.find((t) => t.Object_ID === 1255 && t.Property === naam)?.Value;
  assert.equal(np.data.datumOpname, tagNP("Datum opname objecttype"));
  // "Herkomst objecttype" (MIM) wint van GEMMA's kale "herkomst".
  assert.equal(np.data.herkomst, tagNP("Herkomst objecttype"));
  assert.notEqual(tagNP("Herkomst objecttype"), tagNP("herkomst"));
  assert.ok(typeof np.data.populatie === "string" && np.data.populatie.length > 10, "Populatie (<memo>) uit NOTES");
  assert.equal(np.data.tags["GEMMA-naam"], "NatuurlijkPersoon");
  assert.ok(!("Datum opname objecttype" in np.data.tags), "gemapte tag niet nog eens in tags");
});

test("attribuutsoorten: type, kardinaliteit, MIM-tags als properties, de rest in tags", () => {
  assert.equal(attrs.length, 26);
  const a = veld("aanduidingNaamgebruik");
  assert.equal(a.fieldType, "attribuutsoort");
  assert.equal(a.data.typeLabel, "AN50");
  assert.equal(a.data.kardinaliteit, "0..1");
  assert.equal(a.data.datumOpname, "1 mei 2008", "'Datum opname attribuutsoort' → datumOpname");
  assert.equal(a.data.herkomst, "GBA");
  assert.equal(a.data.herkomstDefinitie, "GBA");
  assert.equal(a.data.indicatieFormeleHistorie, true, "'Ja' → true");
  // Geen boolean → de tekst blijft staan.
  assert.match(String(a.data.indicatieMaterieleHistorie), /^Ja indien/);
  // Niet-MIM-tags blijven bewaard.
  assert.ok("Waardenverzameling" in a.data.tags);
  assert.ok("Aanduiding brondocument" in a.data.tags);
  assert.equal(a.data.stereotypen, undefined, "«Attribuutsoort» is de default, geen label");
  const verplicht = veld("geslachtsnaamAanschrijving");
  assert.equal(verplicht.data.kardinaliteit, undefined, "1..1 niet tonen");
});

test("relatiesoort met rollen, kardinaliteiten, richting en relatiesoort-tags; zelfrelaties", () => {
  const rel = van("relatiesoort");
  const heeft = rel.find((r) => r.naam === "heeft");
  assert.equal(model.elements[heeft.source].naam, "Huishouden");
  assert.equal(model.elements[heeft.target].naam, "IngeschrevenPersoon");
  assert.equal(heeft.data.doelRolNaam, "relatie");
  assert.equal(heeft.data.bronKardinaliteit, "0..1");
  assert.equal(heeft.data.doelKardinaliteit, "1..*");
  assert.equal(heeft.data.unidirectioneel, true);
  assert.equal(heeft.data.datumOpname, "1 november 2008", "'Datum opname relatiesoort' → datumOpname");
  assert.equal(heeft.data.herkomstDefinitie, "GFO BG");
  assert.equal(heeft.data.tags["GEMMA-type"], "association-relationship");
  const ouders = rel.filter((r) => /^Ouder/.test(r.naam));
  assert.equal(ouders.length, 2);
  assert.ok(ouders.every((r) => r.source === r.target));
});

test("tagnamen normaliseren: suffix, spaties, trema", () => {
  assert.equal(normaliseerTagnaam("Datum opname attribuutsoort"), "datum opname");
  assert.equal(normaliseerTagnaam("Toelichting relatiesoort"), "toelichting");
  assert.equal(normaliseerTagnaam("Aanduiding  strijdigheid/nietigheid"), "aanduiding strijdigheid/nietigheid");
  assert.equal(normaliseerTagnaam("Indicatie materiële historie"), "indicatie materiele historie");
  assert.equal(normaliseerTagnaam("Herkomst"), "herkomst");
});
