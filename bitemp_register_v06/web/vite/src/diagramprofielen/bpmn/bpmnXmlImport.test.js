// bpmnXmlImport.test.js — BPMN 2.0 XML → BPMN-model: lezer, regelset, diagramlaag.
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/bpmn/bpmnXmlImport.test.js

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { DOMParser } from "@xmldom/xmldom";

import { leesBpmn, lijktOpBpmn } from "../../transformatie/bpmnXml.js";
import { valideerRegelset } from "../../transformatie/regels.js";
import { BPMN_XML_NAAR_BPMN } from "./bpmnXmlRegels.js";
import { bpmnXmlNaarModel } from "./bpmnXmlImport.js";
import { OBJECTEN, CONNECTOREN } from "./eaMapping.js";

const fixture = fs.readFileSync(new URL("./fixtures/bestelling.bpmn", import.meta.url), "utf8");

// Minimale profielkennis voor de verbindingsregels: de ids en bereiken uit
// bpmn/index.js (dat bestand zelf laadt .jsx en is hier niet importeerbaar).
const ACT = ["taak", "subproces"];
const GW = ["exclusief", "parallel", "inclusief", "complex", "event-gateway"];
const DATA = ["data-object", "data-store"];
const SEQ_BRON = ["start-event", "tussen-event", "boundary-event", ...ACT, ...GW];
const SEQ_DOEL = [...ACT, ...GW, "tussen-event", "eind-event"];
const KNOPEN = [...SEQ_BRON, "eind-event", ...DATA, "pool", "lane", "notitie"];
const elementTypes = [
  ...KNOPEN.map((id) => ({ id, shape: "x", ...(id === "pool" || id === "lane" ? { containerVoor: "bevat" } : {}), ...(id === "boundary-event" ? { randElement: { ouderTypes: ACT } } : {}), ...(id.endsWith("event") || GW.includes(id) || DATA.includes(id) ? { resizebaar: false } : {}) })),
  { id: "sequence-flow", isConnector: true, bron: { elementTypes: SEQ_BRON }, doel: { elementTypes: SEQ_DOEL } },
  { id: "message-flow", isConnector: true, bron: { elementTypes: [...ACT, "start-event", "tussen-event", "eind-event", "boundary-event", "pool"] }, doel: { elementTypes: [...ACT, "start-event", "tussen-event", "pool"] } },
  { id: "data-associatie", isConnector: true, verbindingsregels: [{ bron: { elementTypes: DATA }, doel: { elementTypes: ACT } }, { bron: { elementTypes: ACT }, doel: { elementTypes: DATA } }] },
  { id: "notitielijn", isConnector: true, bron: { elementTypes: ["notitie"] }, doel: { elementTypes: [...SEQ_BRON, "eind-event", ...DATA, "pool", "lane"] } },
  { id: "bevat", isConnector: true, bron: { elementTypes: ["pool", "lane"] }, doel: { elementTypes: ["start-event", "tussen-event", "eind-event", ...ACT, ...GW, ...DATA, "lane", "notitie"] } },
];

test("regelset is geldig en herkent het bestand", () => {
  assert.deepEqual(valideerRegelset(BPMN_XML_NAAR_BPMN), []);
  assert.ok(lijktOpBpmn({ naam: "x.bpmn" }) > 0.9);
  assert.ok(lijktOpBpmn({ tekst: fixture }) > 0.8);
  assert.equal(lijktOpBpmn({ tekst: "<html/>" }), 0);
});

test("lezer: pools, lanes, flow nodes, event-definities, boundary, default flow, DI", () => {
  const g = leesBpmn(fixture, { DOMParser });
  assert.deepEqual(g.groepen.map((x) => [x.id, x.aard, x.groep ?? null]), [
    ["Pool_klant", "participant", null],
    ["Pool_winkel", "participant", null],
    ["Lane_verkoop", "lane", "Pool_winkel"],
    ["Lane_magazijn", "lane", "Pool_winkel"],
  ]);
  const k = Object.fromEntries(g.knopen.map((x) => [x.id, x]));
  assert.equal(k.Start_ontvangen.eventDefinitie, "message");
  assert.equal(k.Start_ontvangen.groep, "Lane_verkoop");
  assert.equal(k.Taak_bestellen.groep, "Pool_klant");
  assert.equal(k.Boundary_timer.randVan, "Sub_verzenden");
  assert.equal(k.Boundary_timer.onderbrekend, false);
  assert.equal(k.Taak_inpakken.subproces, "Sub_verzenden");
  assert.equal(k.Ann_1.tekst, "Betaling via iDEAL");
  const v = Object.fromEntries(g.verbindingen.map((x) => [x.id, x]));
  assert.equal(v.SF_w2.conditie, "voorraad = 0");
  assert.equal(v.SF_w3.standaard, true);
  assert.equal(v.SF_w2.standaard, false);
  assert.deepEqual([v.DOA_1.bron, v.DOA_1.doel], ["Taak_registreren", "Data_order"]);
  assert.equal(g.diagrammen.length, 1);
  assert.deepEqual(g.diagrammen[0].vormen.Taak_bestellen, { x: 260, y: 100, width: 100, height: 80, uitgeklapt: false, horizontaal: true });
  assert.equal(g.diagrammen[0].lijnen.SF_w2.length, 4);
});

test("import: model met pools/lanes als containers, soorten, boundary op de rand, knikken, subproces-diagram", () => {
  const r = bpmnXmlNaarModel(fixture, { DOMParser, elementTypes, bestandsnaam: "bestelling.bpmn" });
  const e = r.core.elements;
  const perNaam = (naam) => Object.values(e).find((x) => x.naam === naam);
  assert.equal(perNaam("Bestelling ontvangen").elementType, "start-event");
  assert.equal(perNaam("Bestelling ontvangen").data.soort, "bericht");
  assert.equal(perNaam("Op voorraad?").elementType, "exclusief");
  assert.equal(perNaam("Verzenden").elementType, "subproces");
  const boundary = perNaam("Na 2 dagen");
  assert.equal(boundary.elementType, "boundary-event");
  assert.equal(boundary.data.soort, "timer");
  assert.equal(boundary.data.onderbrekend, false);
  assert.equal(boundary.data.randVan, perNaam("Verzenden").id);
  // Lidmaatschap: pool ∋ lane, lane ∋ taak.
  const bevat = Object.values(e).filter((x) => x.elementType === "bevat");
  assert.ok(bevat.some((b) => b.source === perNaam("Webwinkel").id && b.target === perNaam("Verkoop").id));
  assert.ok(bevat.some((b) => b.source === perNaam("Verkoop").id && b.target === perNaam("Op voorraad?").id));
  assert.ok(bevat.some((b) => b.source === perNaam("Klant").id && b.target === perNaam("Bestelling plaatsen").id));
  // Flows en hun data.
  const nee = Object.values(e).find((x) => x.elementType === "sequence-flow" && x.naam === "nee");
  assert.equal(nee.data.conditie, "voorraad = 0");
  assert.deepEqual(nee.data.knikken, [{ x: 340, y: 375 }, { x: 340, y: 360 }]);
  const ja = Object.values(e).find((x) => x.elementType === "sequence-flow" && x.naam === "ja");
  assert.equal(ja.data.standaard, true);
  assert.ok(Object.values(e).some((x) => x.elementType === "message-flow" && x.naam === "bestelling"));
  assert.ok(Object.values(e).some((x) => x.elementType === "data-associatie" && x.source === perNaam("Order registreren").id));
  assert.ok(Object.values(e).some((x) => x.elementType === "notitielijn" && x.target === perNaam("Betalen").id));
  // EA-aanvulling: taaktype, data store, verzameling, event-based gateway, escalatie.
  assert.equal(perNaam("Betalen").data.taakSoort, "user");
  assert.equal(perNaam("Afwijzen").data.taakSoort, "service");
  assert.equal(perNaam("Bestelling plaatsen").data.taakSoort, "");
  assert.equal(perNaam("Handelsregister").elementType, "data-store");
  assert.equal(perNaam("Order").data.verzameling, true);
  assert.equal(perNaam("Wachten op klant").elementType, "event-gateway");
  assert.equal(perNaam("Escalatie").data.soort, "escalatie");
  // Diagrammen: hoofd + subproces; boundary relatief aan de gastheer; events zonder size.
  const diagrammen = Object.values(r.core.diagrams);
  assert.equal(diagrammen.length, 2);
  const hoofd = diagrammen.find((d) => d.naam === "Bestelling");
  const sub = diagrammen.find((d) => d.naam === "Verzenden");
  assert.ok(hoofd && sub);
  assert.equal(perNaam("Verzenden").data.gedragDiagramId, sub.id);
  assert.ok(sub.nodes.some((n) => n.elementId === perNaam("Inpakken").id));
  assert.ok(!hoofd.nodes.some((n) => n.elementId === perNaam("Inpakken").id));
  const bNode = hoofd.nodes.find((n) => n.elementId === boundary.id);
  assert.deepEqual(bNode.position, { x: 62, y: 62 });
  assert.equal(bNode.size, undefined);
  assert.deepEqual(hoofd.nodes.find((n) => n.elementId === perNaam("Webwinkel").id).size, { width: 700, height: 300 });
  // Containers vóór hun leden in de node-lijst.
  const idx = (naam) => hoofd.nodes.findIndex((n) => n.elementId === perNaam(naam).id);
  assert.ok(idx("Webwinkel") < idx("Verkoop") && idx("Verkoop") < idx("Op voorraad?"));
  assert.ok(!r.diagnostics.some((d) => d.severity === "warning"), JSON.stringify(r.diagnostics.filter((d) => d.severity === "warning")));
});

test("zonder DI: automatische opstelling, één diagram", () => {
  const kaal = fixture.replace(/<bpmndi:BPMNDiagram[\s\S]*<\/bpmndi:BPMNDiagram>/, "");
  const r = bpmnXmlNaarModel(kaal, { DOMParser, elementTypes, bestandsnaam: "kaal.bpmn" });
  const diagrammen = Object.values(r.core.diagrams);
  assert.equal(diagrammen.length, 1);
  assert.ok(diagrammen[0].nodes.length > 10);
  assert.ok(diagrammen[0].nodes.every((n) => Number.isFinite(n.position.x)));
});

test("EA-tabel sluit op het bpmn-profiel", () => {
  const ids = new Set(elementTypes.map((t) => t.id));
  for (const r of OBJECTEN) assert.ok(ids.has(r.elementType) && !elementTypes.find((t) => t.id === r.elementType).isConnector, r.elementType);
  for (const r of CONNECTOREN) assert.ok(elementTypes.find((t) => t.id === r.elementType)?.isConnector, r.elementType);
});
