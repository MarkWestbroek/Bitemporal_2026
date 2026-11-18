import { test } from "node:test";
import assert from "node:assert/strict";
import "../studio/activities/regelsetsIngebouwd.js";
import { alleRegelsets } from "./regelsetCatalogus.js";
import { valideerRegelset } from "./regels.js";
import { regelsetNaarElement, elementNaarRegelset, ontwerpUitRegelsets, TRANSFORMATIE_TYPE, TRANSFORMATIE_ELEMENTTYPE, TRANSFORMATIE_FIELDTYPES } from "./regelsetModel.js";
import { profielOntwerpKern } from "../studio/activities/profielOntwerp.js";

test("elke ingebouwde regelset gaat zonder verlies naar een element en terug", () => {
  const alle = alleRegelsets();
  assert.ok(alle.length >= 11);
  for (const v of alle) {
    const element = regelsetNaarElement(v.regelset, { richting: v.richting, schrijver: v.schrijver });
    // Het element is gewone modeldata: het overleeft JSON (opslag, sync).
    const terug = elementNaarRegelset(JSON.parse(JSON.stringify(element)));
    assert.deepEqual(terug.fouten, [], v.regelset.id);
    assert.deepEqual(terug.regelset, v.regelset, v.regelset.id);
    assert.equal(terug.richting, v.richting);
    assert.equal(terug.schrijver, v.schrijver);
    if (v.vorm === "regels") assert.deepEqual(valideerRegelset(terug.regelset), []);
  }
});

test("het element: kop in de data, regels in volgorde als velden, instellingen apart", () => {
  const regelset = {
    id: "a-naar-b",
    versie: 2,
    titel: "A → B",
    bron: "a",
    doel: "b",
    prefixen: { ex: "http://example.org/" },
    regels: [
      { naam: "actor", bij: "knoop", als: { vorm: "cirkel" }, maak: { type: "actor", naam: "{tekst}" }, meld: true },
      { naam: "erft", bij: "verbinding", zet: { op: "doel", data: { abstract: true } } },
      { naam: "rest", bij: "groep", negeer: true },
    ],
  };
  const el = regelsetNaarElement(regelset, { richting: "import" });
  assert.equal(el.elementType, TRANSFORMATIE_TYPE);
  assert.equal(el.naam, "A → B");
  assert.deepEqual(el.data, { code: "a-naar-b", versie: "2", versieIsGetal: true, richting: "import", bron: "a", doel: "b" });
  const [regels, instellingen] = el.compartimenten;
  assert.deepEqual(regels.velden.map((v) => [v.naam, v.data.typeLabel, v.data.actie]), [
    ["actor", "knoop → actor", "maak"],
    ["erft", "verbinding → zet op doel", "zet"],
    ["rest", "groep → negeer", "negeer"],
  ]);
  assert.equal(regels.velden[2].data.dan, undefined);
  assert.deepEqual(instellingen.velden.map((v) => [v.naam, v.data.typeLabel]), [["prefixen", "{ex}"]]);
  assert.deepEqual(elementNaarRegelset(el).regelset, regelset);
});

test("wat niet te lezen is wordt gemeld, niet weggelaten", () => {
  const el = regelsetNaarElement({ id: "x", versie: 1, titel: "X", regels: [{ naam: "r", bij: "knoop", maak: { type: "t" } }] });
  el.compartimenten[0].velden[0].data.dan = "{ type: t }";
  el.compartimenten[0].velden.push({ naam: "leeg", fieldType: "regelDef", data: { bij: "knoop", actie: "" } });
  const { regelset, fouten } = elementNaarRegelset(el);
  assert.equal(regelset, null);
  assert.equal(fouten.length, 2);
  assert.match(fouten[0], /Regel 1 "r", dan: geen geldige JSON/);
  assert.match(fouten[1], /Regel 2 "leeg": actie moet maak, zet of negeer zijn/);
  assert.deepEqual(elementNaarRegelset({ elementType: "elementDef", naam: "Klasse", data: {} }).fouten.length, 2);
});

test("het profiel-ontwerp kent het elementtype «transformatie» en zijn veldtypen", () => {
  assert.ok(profielOntwerpKern.elementTypes.includes(TRANSFORMATIE_ELEMENTTYPE));
  for (const ft of TRANSFORMATIE_FIELDTYPES) assert.ok(profielOntwerpKern.fieldTypes.includes(ft));
  // Elke sleutel die de omzetting in de data zet, is een eigenschap van het type.
  const el = regelsetNaarElement(alleRegelsets()[0].regelset, { richting: "import", schrijver: "s" });
  const bekend = new Set(TRANSFORMATIE_ELEMENTTYPE.properties.map((p) => p.key));
  assert.deepEqual(Object.keys(el.data).filter((k) => !bekend.has(k)), []);
});

test("alle regelsets als ontwerp: één element per regelset, per richting een rij", () => {
  const alle = alleRegelsets();
  const { elements, nodes } = ontwerpUitRegelsets(alle);
  assert.equal(Object.keys(elements).length, alle.length);
  assert.equal(nodes.length, alle.length);
  assert.equal(new Set(nodes.map((n) => n.position.y)).size, new Set(alle.map((v) => v.richting)).size);
  assert.equal(new Set(nodes.map((n) => `${n.position.x},${n.position.y}`)).size, alle.length);
});
