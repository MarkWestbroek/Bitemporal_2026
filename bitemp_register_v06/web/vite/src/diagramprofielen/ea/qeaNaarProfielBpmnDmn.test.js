// qeaNaarProfielBpmnDmn.test.js — EA's BPMN- en DMN-MDG (beide op "Analysis"-diagrammen in het GGM)
// via de gegevensgestuurde lezer en M3-MOF's tabellen. Fixtures: "[HR] Opgave verwerkingsproces -
// happy flow zonder betalen" (1218) en DMN "Statussen" (2513).
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/ea/qeaNaarProfielBpmnDmn.test.js

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { qeaNaarProfiel, zoekObjectRij } from "./qeaNaarProfiel.js";
import { EA_PROFIELEN } from "./eaProfielen.js";

const hier = dirname(fileURLToPath(import.meta.url));
const fixture = (naam) => JSON.parse(readFileSync(join(hier, "fixtures", naam), "utf8"));
const van = (model, type) => Object.values(model.elements).filter((e) => e.elementType === type);

test("wildcard: '*' in de tabel geldt voor elk Object_Type, een exacte rij wint", () => {
  const { OBJECTEN } = EA_PROFIELEN.dmn.mapping;
  assert.equal(zoekObjectRij(OBJECTEN, "Activity", ["Decision"]).elementType, "decision");
  assert.equal(zoekObjectRij(OBJECTEN, "Class", ["InputData"]).elementType, "inputData");
  assert.equal(zoekObjectRij(OBJECTEN, "Note", []).elementType, "notitie");
  assert.equal(zoekObjectRij(OBJECTEN, "Class", []), null, "zonder stereotype geen DMN-element");
});

test("'Analysis' uit elkaar gehouden: BPMN en DMN op stereotypen, Eriksson-Penker krijgt de rest", () => {
  const bpmn = fixture("bpmn-opgave.qea.json"), dmn = fixture("dmn-statussen.qea.json");
  const d1 = bpmn.t_diagram[0], d2 = dmn.t_diagram[0];
  assert.equal(EA_PROFIELEN.bpmn.diagramPast(d1, bpmn), true);
  assert.equal(EA_PROFIELEN.dmn.diagramPast(d1, bpmn), false);
  assert.equal(EA_PROFIELEN.business.diagramPast(d1, bpmn), false);
  assert.equal(EA_PROFIELEN.dmn.diagramPast(d2, dmn), true, "MDG DMN1.1::DMNDiagram");
  assert.equal(EA_PROFIELEN.bpmn.diagramPast(d2, dmn), false);
});

test("BPMN: pools, taken/subprocessen (activityType), events met soort, boundary-events op hun activiteit, gateways naar gatewayType", () => {
  const model = qeaNaarProfiel(fixture("bpmn-opgave.qea.json"), { packageId: 1089, profiel: EA_PROFIELEN.bpmn, schaal: 1 });
  assert.equal(Object.keys(model.diagrams).length, 1);
  assert.equal(van(model, "pool").length, 10);
  assert.equal(van(model, "taak").length, 9, "activityType Task");
  assert.equal(van(model, "subproces").length, 6, "activityType Sub-Process");
  const start = van(model, "start-event");
  assert.equal(start.length, 5);
  assert.equal(start.filter((e) => e.data.soort === "bericht").length, 4, "eventDefinition Message → bericht");
  // In het GGM hangen de tussen-events aan de pool (ParentID), niet aan een activiteit:
  // gewone tussen-events, geen boundary-events.
  const tussen = van(model, "tussen-event");
  assert.equal(tussen.length, 6);
  assert.equal(van(model, "boundary-event").length, 0);
  assert.ok(tussen.some((e) => e.data.soort === "timer") && tussen.filter((e) => e.data.soort === "bericht").length === 5, "eventDefinition → soort");
  assert.ok(van(model, "bevat").some((b) => model.elements[b.target]?.elementType === "tussen-event"), "tussen-event in zijn pool");
  assert.equal(van(model, "eind-event").length, 4);
  assert.equal(van(model, "parallel").length, 2, "gatewayType Parallel");
  assert.equal(van(model, "exclusief").length, 2);
  // Sinds M3-MOF (10-10) is Artifact«DataStore» een eigen data-store; samen nog steeds 11.
  assert.equal(van(model, "data-object").length + van(model, "data-store").length, 11, "DataObject + DataStore");
  assert.ok(van(model, "data-store").length >= 1, "DataStore → data-store");
  assert.ok(van(model, "sequence-flow").length >= 25);
  assert.ok(van(model, "message-flow").length >= 1);
  // Lidmaatschap: taken liggen in pools (ParentID → bevat).
  const bevat = van(model, "bevat");
  assert.ok(bevat.length >= 20);
  assert.ok(bevat.every((b) => ["pool", "lane"].includes(model.elements[b.source]?.elementType)));
});

test("BPMN: een IntermediateEvent mét een activiteit als ouder wordt een boundary-event (rand-element, geen containerlid)", () => {
  const g = (n) => `{00000000-0000-0000-0000-0000000000${String(n).padStart(2, "0")}}`;
  const bron = {
    t_package: [{ Package_ID: 1, Parent_ID: 0, Name: "P", ea_guid: g(90) }],
    t_object: [
      { Object_ID: 1, Object_Type: "Activity", Stereotype: "Activity", Name: "Beoordelen", Package_ID: 1, ea_guid: g(1) },
      { Object_ID: 2, Object_Type: "Event", Stereotype: "IntermediateEvent", Name: "te laat", Package_ID: 1, ParentID: 1, ea_guid: g(2) },
    ],
    t_objectproperties: [{ Object_ID: 2, Property: "eventDefinition", Value: "Timer" }, { Object_ID: 2, Property: "cancelActivity", Value: "false" }, { Object_ID: 1, Property: "activityType", Value: "Task" }],
    t_connector: [],
    t_diagram: [{ Diagram_ID: 5, Package_ID: 1, Diagram_Type: "Analysis", Name: "B", ea_guid: g(50) }],
    t_diagramobjects: [
      { Diagram_ID: 5, Object_ID: 1, RectLeft: 100, RectTop: -100, RectRight: 300, RectBottom: -200, Sequence: 1 },
      { Diagram_ID: 5, Object_ID: 2, RectLeft: 280, RectTop: -180, RectRight: 310, RectBottom: -210, Sequence: 2 },
    ],
    t_diagramlinks: [],
  };
  const model = qeaNaarProfiel(bron, { packageId: 1, profiel: EA_PROFIELEN.bpmn, schaal: 1 });
  const b = van(model, "boundary-event")[0];
  assert.ok(b, "boundary-event");
  assert.equal(model.elements[b.data.randVan].elementType, "taak");
  assert.equal(b.data.soort, "timer");
  assert.equal(b.data.onderbrekend, false, "cancelActivity false → niet-onderbrekend");
  assert.equal(van(model, "bevat").length, 0, "geen containerlid");
});

test("DMN: beslissingen, invoergegevens, BKM's en kennisbronnen op stereotype; informatie-eisen 1-op-1", () => {
  const model = qeaNaarProfiel(fixture("dmn-statussen.qea.json"), { packageId: 2243, profiel: EA_PROFIELEN.dmn, schaal: 1 });
  assert.equal(Object.keys(model.diagrams).length, 1);
  assert.ok(van(model, "decision").length >= 5);
  assert.ok(van(model, "inputData").length >= 3);
  const infoReq = van(model, "infoReq");
  assert.ok(infoReq.length >= 10, "Dependency«InformationRequirement»");
  assert.ok(infoReq.every((r) => model.elements[r.target]?.elementType === "decision"), "eis loopt naar de beslissing (EA's Dependency omgedraaid)");
  assert.ok(infoReq.some((r) => model.elements[r.source]?.elementType === "inputData"));
  assert.ok(Object.values(model.elements).every((e) => e.data?.stereotype === undefined), "het stereotype ís het type");
  const metToelichting = van(model, "decision").find((d) => d.data.toelichting);
  if (metToelichting) assert.equal(metToelichting.data.notes, undefined);
});

test("BPMN: taken ín een subproces hangen in de pool erboven (tekenvolgorde) en het subproces is uitgeklapt", () => {
  const model = qeaNaarProfiel(fixture("bpmn-online-opgave.qea.json"), { packageId: 1089, profiel: EA_PROFIELEN.bpmn, schaal: 1.5 });
  const per = (naam) => Object.values(model.elements).find((e) => e.naam === naam);
  const opgaveDoen = per("Opgave doen");
  assert.equal(opgaveDoen.elementType, "subproces");
  assert.equal(opgaveDoen.data.uitgeklapt, true);
  for (const naam of ["Samenstellen opgave", "Ondertekenen opgave"]) {
    const t = per(naam);
    const bevat = van(model, "bevat").find((b) => b.target === t.id);
    assert.ok(bevat, `${naam} in een container`);
    assert.equal(model.elements[bevat.source].naam, "[HR] Aangever");
  }
  // EA-volgorde: de taken liggen vóór (boven) het subproces in de nodelijst = later getekend.
  const d = Object.values(model.diagrams)[0];
  const idx = (e) => d.nodes.findIndex((n) => n.elementId === e.id);
  assert.ok(idx(per("Samenstellen opgave")) > idx(opgaveDoen));
});
