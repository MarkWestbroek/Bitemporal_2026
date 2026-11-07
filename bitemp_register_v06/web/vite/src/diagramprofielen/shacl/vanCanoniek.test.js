// vanCanoniek.test.js — fase 3 van "Linked data als M2": canoniek model → SHACL-shapes, op het
// aanvraag-domein van de inrichting (fixtures/aanvraag). Buiten de tests is de uitvoer met
// pyshacl gecontroleerd: meta-SHACL geldig, een kloppende aanvraag conform, en een foute
// aanvraag gaf de vier verwachte meldingen (patroon, sh:in, ontbrekende aanvrager, e-mail).
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/shacl/vanCanoniek.test.js

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { canoniekNaarShacl, xsdVoor, voegShapesIn } from "./vanCanoniek.js";
import { naarTurtle } from "./schrijver.js";
import { lintTurtle, vanTurtle } from "./adapter.js";
import { importeerV3 } from "../canoniek-uml/serialisatie.js";

const hier = path.dirname(fileURLToPath(import.meta.url));
const lees = (p) => JSON.parse(readFileSync(path.resolve(hier, p), "utf8"));
const v3 = lees("../canoniek-uml/fixtures/aanvraag/aanvraag-domein-v3.json");
const { datatypes } = lees("../../transformatie/gegevenstypen.snapshot.json");
const canoniek = importeerV3(v3);
const maak = () => canoniekNaarShacl(canoniek, { titel: "Aanvraag (SHACL)", gegevenstypen: datatypes });
const regels = (el) => (el?.compartimenten || []).flatMap((c) => c.velden || []);
const regel = (el, pad) => regels(el).find((r) => r.naam === pad)?.data;

test("xsd-datatypen uit basistype en formaat", () => {
  assert.equal(xsdVoor("string"), "xsd:string");
  assert.equal(xsdVoor("string", "date-time"), "xsd:dateTime");
  assert.equal(xsdVoor("string", "uri"), "xsd:anyURI");
  assert.equal(xsdVoor("integer", "int32"), "xsd:integer");
  assert.equal(xsdVoor("number", "double"), "xsd:decimal");
  assert.equal(xsdVoor("boolean"), "xsd:boolean");
  assert.equal(xsdVoor("date"), "xsd:date");
});

test("entiteiten worden klasse-shapes, gegevenselementen eigen shapes via sh:node", () => {
  const uit = maak();
  const els = uit.elements;
  const shapes = Object.values(els).filter((e) => e.elementType === "nodeshape");
  assert.equal(shapes.length, 11); // 3 entiteiten + 8 gegevenselementen
  const aanvraag = els.can_Aanvraag;
  assert.deepEqual([aanvraag.data.iri, aanvraag.data.ookKlasse, aanvraag.data.klasseType], ["aanvraag:Aanvraag", true, "rdfs:Class"]);
  // Compositie: sh:node, enkelvoudig → maxCount 1; meervoudig (bijlagen) → geen maxCount.
  assert.deepEqual(regel(aanvraag, "aanvraag:aanvraagIdentificatie"), { node: "aanvraag:Aanvraag_AanvraagIdentificatie", maxCount: 1, label: "AanvraagIdentificatie", typeLabel: "aanvraag:Aanvraag_AanvraagIdentificatie [0..1]" });
  assert.equal(regel(aanvraag, "aanvraag:aanvraagBijlage").maxCount, undefined);
  // Relatie met doelkardinaliteit "1": sh:class, precies één.
  const rel = regel(aanvraag, "aanvraag:aanvraagAanvrager");
  assert.deepEqual([rel.klasse, rel.minCount, rel.maxCount], ["aanvraag:Aanvrager", 1, 1]);
  // Het GE zelf: geen klasse, geen doel.
  assert.equal(els.can_Aanvraag_AanvraagIdentificatie.data.ookKlasse, undefined);
});

test("veldtypen: eigen gegevenstype, catalogus, enumeratie en basistype", () => {
  const els = maak().elements;
  const id = els.can_Aanvraag_AanvraagIdentificatie;
  // Eigen gegevenstype Aanvraagnummer: patroon en maxLength uit de validatie.
  const nr = regel(id, "aanvraag:aanvraagnummer");
  assert.deepEqual([nr.datatype, nr.pattern, nr.maxLength, nr.minCount, nr.maxCount], ["xsd:string", "^[A-Z0-9-]+$", 40, 1, 1]);
  // Aanvraagtype is (sinds referentielijst als veldtype, 77ccc678) een verwijzing naar de lijst: sh:class.
  assert.equal(regel(id, "aanvraag:aanvraagtype").klasse, "aanvraag:Aanvraagtype");
  // Catalogus: DatumTijd → xsd:dateTime, URL → xsd:anyURI met patroon, KorteTekst → maxLength 255.
  assert.equal(regel(els.can_Aanvraag_AanvraagIndiening, "aanvraag:ingediendOp").datatype, "xsd:dateTime");
  assert.equal(regel(els.can_Aanvrager_AanvragerKlantverwijzing, "aanvraag:klantUrl").datatype, "xsd:anyURI");
  assert.equal(regel(els.can_Aanvrager_AanvragerNaam, "aanvraag:naam").maxLength, 255);
  // Enumeratie → sh:in.
  assert.equal(regel(els.can_Aanvraag_AanvraagStatus, "aanvraag:status").in, '( "ingediend" "gevalideerd" "afgekeurd" "afgehandeld" )');
});

test("kruisverbanden en meldingen", () => {
  const uit = maak();
  // Elke shape een kruisverband, plus de relatie (op de shape van haar bron).
  assert.equal(uit.kruisverbanden.length, 12);
  assert.ok(uit.kruisverbanden.some((k) => k.shaclId === "can_Aanvraag" && k.canoniekId === "AanvraagAanvrager"));
  assert.deepEqual(uit.meldingen.map((m) => m.niveau), ["info", "info"]); // afgeleide velden, {uniek}
});

test("de uitvoer is geldige SHACL zonder lint-meldingen en leest terug in het profiel", () => {
  const { tekst, meldingen } = naarTurtle(maak());
  assert.deepEqual(meldingen, []);
  assert.deepEqual(lintTurtle(tekst), []);
  assert.match(tekst, /aanvraag:Aanvraag\n {4}a sh:NodeShape, rdfs:Class ;/);
  const terug = vanTurtle(tekst);
  assert.deepEqual(terug.meldingen, []);
  assert.equal(Object.values(terug.elements).filter((e) => e.elementType === "nodeshape").length, 11);
});

test("opnieuw genereren werkt bij: posities blijven, wat weg is verdwijnt", () => {
  const eerste = voegShapesIn({ elements: {}, diagrams: {} }, maak(), "m1");
  const node = eerste.diagrams[eerste.diagramId].nodes.find((n) => n.elementId === "cs_m1_can_Aanvraag");
  node.position = { x: 999, y: 999 };
  // Een element van een andere bron blijft staan.
  eerste.elements.eigen = { id: "eigen", naam: "Eigen", elementType: "nodeshape", compartimenten: [], data: {} };
  // Tweede run zonder de entiteit Aanvrager (en zijn GE's).
  const kleiner = structuredClone(canoniek);
  for (const id of Object.keys(kleiner.elements)) if (id.startsWith("Aanvrager")) delete kleiner.elements[id];
  const tweede = voegShapesIn(eerste, canoniekNaarShacl(kleiner, { gegevenstypen: datatypes }), "m1");
  assert.equal(tweede.diagrams[tweede.diagramId].nodes.find((n) => n.elementId === "cs_m1_can_Aanvraag").position.x, 999);
  assert.ok(tweede.elements.eigen);
  assert.ok(!tweede.elements.cs_m1_can_Aanvrager);
  assert.ok(tweede.weg.includes("cs_m1_can_Aanvrager"));
  // De pijlen zijn opnieuw afgeleid uit de regels.
  assert.ok(Object.values(tweede.elements).some((e) => e.elementType === "verwijzing" && e.source === "cs_m1_can_Aanvraag" && e.target === "cs_m1_can_Aanvraag_AanvraagStatus"));
});
