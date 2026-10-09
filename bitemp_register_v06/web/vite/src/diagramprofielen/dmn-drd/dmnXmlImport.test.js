// dmnXmlImport.test.js — DMN XML → DRD-model: lezer, regelset, DI.
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/dmn-drd/dmnXmlImport.test.js

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { DOMParser } from "@xmldom/xmldom";

import { leesDmn, lijktOpDmn } from "../../transformatie/dmnXml.js";
import { valideerRegelset } from "../../transformatie/regels.js";
import { DMN_XML_NAAR_DRD } from "./dmnXmlRegels.js";
import { dmnXmlNaarModel } from "./dmnXmlImport.js";
import { OBJECTEN, CONNECTOREN } from "./eaMapping.js";

const fixture = fs.readFileSync(new URL("./fixtures/kredietbeoordeling.dmn", import.meta.url), "utf8");

const AFNEMERS = ["decision", "bkm", "knowledgeSource"];
const elementTypes = [
  ...["decision", "inputData", "bkm", "knowledgeSource", "notitie", "boundary"].map((id) => ({ id, shape: "x" })),
  { id: "infoReq", isConnector: true, bron: { elementTypes: ["inputData", "decision"] }, doel: { elementTypes: ["decision"] } },
  { id: "knowReq", isConnector: true, bron: { elementTypes: ["bkm"] }, doel: { elementTypes: ["decision", "bkm"] } },
  { id: "authReq", isConnector: true, bron: { elementTypes: ["knowledgeSource", "decision", "inputData"] }, doel: { elementTypes: AFNEMERS } },
  { id: "notitielijn", isConnector: true, bron: { elementTypes: ["notitie"] }, doel: { elementTypes: [...AFNEMERS, "inputData", "boundary"] } },
];

test("regelset is geldig en het bestand wordt herkend", () => {
  assert.deepEqual(valideerRegelset(DMN_XML_NAAR_DRD), []);
  assert.ok(lijktOpDmn({ naam: "x.dmn" }) > 0.9);
  assert.ok(lijktOpDmn({ tekst: fixture }) > 0.8);
});

test("lezer: knopen met vraag/toelichting, requirements in DRD-richting, DI", () => {
  const g = leesDmn(fixture, { DOMParser });
  const k = Object.fromEntries(g.knopen.map((x) => [x.id, x]));
  assert.equal(k.Decision_risico.vraag, "In welke risicoklasse valt de aanvrager?");
  assert.equal(k.Input_inkomen.toelichting, "Bruto jaarinkomen van de aanvrager");
  assert.equal(k.TA_1.tekst, "Herzien per kwartaal");
  const v = Object.fromEntries(g.verbindingen.map((x) => [x.id, x]));
  assert.deepEqual([v.IR_1.bron, v.IR_1.doel, v.IR_1.aard], ["Input_inkomen", "Decision_risico", "informationRequirement"]);
  assert.deepEqual([v.KR_1.bron, v.KR_1.doel], ["BKM_score", "Decision_risico"]);
  assert.deepEqual([v.AR_1.bron, v.AR_1.doel], ["KS_beleid", "Decision_toekennen"]);
  assert.deepEqual([v.IR_3.bron, v.IR_3.doel], ["Decision_risico", "Decision_toekennen"]);
  assert.equal(g.diagrammen[0].lijnen.IR_1.length, 4);
});

test("import: DRD met posities, knikken en notitie-lijn", () => {
  const r = dmnXmlNaarModel(fixture, { DOMParser, elementTypes, bestandsnaam: "kredietbeoordeling.dmn" });
  const e = r.core.elements;
  const perNaam = (naam) => Object.values(e).find((x) => x.naam === naam);
  assert.equal(perNaam("Risicoklasse").elementType, "decision");
  assert.equal(perNaam("Risicoklasse").data.vraag, "In welke risicoklasse valt de aanvrager?");
  assert.equal(perNaam("Scoremodel").elementType, "bkm");
  assert.equal(perNaam("Kredietbeleid 2026").elementType, "knowledgeSource");
  const soorten = Object.values(e).filter((x) => x.source).map((x) => x.elementType).sort();
  assert.deepEqual(soorten, ["authReq", "infoReq", "infoReq", "infoReq", "knowReq", "notitielijn"]);
  const ir1 = Object.values(e).find((x) => x.elementType === "infoReq" && x.source === perNaam("Inkomen").id);
  assert.deepEqual(ir1.data.knikken, [{ x: 180, y: 320 }, { x: 360, y: 320 }]);
  const notitielijn = Object.values(e).find((x) => x.elementType === "notitielijn");
  assert.equal(notitielijn.target, perNaam("Kredietbeleid 2026").id);
  const d = Object.values(r.core.diagrams)[0];
  assert.equal(d.naam, "Kredietbeoordeling");
  assert.equal(d.diagramType, "dmn-drd");
  assert.deepEqual(d.nodes.find((n) => n.elementId === perNaam("Krediet toekennen?").id), { elementId: perNaam("Krediet toekennen?").id, position: { x: 300, y: 40 }, size: { width: 180, height: 80 } });
  assert.ok(!r.diagnostics.some((x) => x.severity === "warning"));
});

test("EA-tabel sluit op het dmn-drd-profiel", () => {
  for (const r of OBJECTEN) assert.ok(elementTypes.find((t) => t.id === r.elementType && !t.isConnector), r.elementType);
  for (const r of CONNECTOREN) assert.ok(elementTypes.find((t) => t.id === r.elementType)?.isConnector, r.elementType);
});
