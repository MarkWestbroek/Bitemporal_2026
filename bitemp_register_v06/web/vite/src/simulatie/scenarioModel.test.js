/**
 * scenarioModel: een scenario als model (profiel simulatie) en terug (16-11, ontwerp Simulatie §12).
 * Run: node --import ./test/register-aliases.mjs --test src/simulatie/scenarioModel.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { scenarioNaarModel, scenarioUitModel, simulatiesIn, toetsVerwachting } from "./scenarioModel.js";
import { maakSimulatie } from "./simulatie.js";
import { toestandUit } from "./store.js";
import { elementTypes, simulatieDiagramType } from "../diagramprofielen/simulatie/descriptor.js";
import { valideerDiagramType } from "../diagramcore/types/typeRegistry.js";

const fixture = (naam) => JSON.parse(fs.readFileSync(new URL(`./fixtures/${naam}.json`, import.meta.url), "utf8"));
const SCENARIOS = ["gpk-scenario-1", "gpk-scenario-2", "gpk-scenario-3", "gpk-scenario-4", "gpk-scenario-5", "waterstede-1-buurtfeest", "waterstede-2-jaarmarkt", "waterstede-3-festival"];

const teller = () => {
  let n = 0;
  return () => `sm_${++n}`;
};
/** Past een wijziging toe op een elementenkaart (zoals de store dat doet). */
function pasToe(elements, w) {
  const uit = { ...elements };
  for (const e of w.toevoegen) uit[e.id] = e;
  for (const [id, patch] of Object.entries(w.bijwerken)) uit[id] = { ...uit[id], ...patch, data: { ...uit[id].data, ...(patch.data || {}) } };
  for (const id of w.verwijderen) delete uit[id];
  return uit;
}
/** Het scenario zoals het na een rondgang terugkomt: zonder toelichting. */
const kern = (s) => ({
  naam: s.naam,
  beschrijving: s.beschrijving || "",
  start: { proces: s.start.proces, type: s.start.type, id: s.start.id, object: s.start.object, variabelen: s.start.variabelen || {} },
  vulwijze: s.vulwijze,
  antwoorden: s.antwoorden || {},
  zaadje: s.zaadje,
  verwacht: s.verwacht,
});

test("het profiel is een geldig DiagramType; Instantie heeft de aard instantie", () => {
  assert.deepEqual(valideerDiagramType(simulatieDiagramType), []);
  assert.equal(elementTypes.find((t) => t.id === "instantie").aard, "instantie");
});

for (const naam of SCENARIOS) {
  test(`rondgang ${naam}: json → model → json geeft hetzelfde scenario`, () => {
    const scenario = fixture(naam);
    const w = scenarioNaarModel(scenario, { nieuwId: teller(), subjecten: [{ naam: "Proces", ref: { profielId: "bpmnMotor05", diagramId: "d1" } }] });
    assert.deepEqual(w.nieuw, { simulatie: true, scenario: true });
    const elements = pasToe({}, w);
    // Alle typen bestaan in het profiel, en elke lijn mag volgens de verbindingsregels.
    for (const e of Object.values(elements)) {
      const et = elementTypes.find((t) => t.id === e.elementType);
      assert.ok(et, e.elementType);
      if (et.isConnector) {
        assert.ok(et.bron.elementTypes.includes(elements[e.source].elementType), `${e.elementType}: bron ${elements[e.source].elementType}`);
        assert.ok(et.doel.elementTypes.includes(elements[e.target].elementType), `${e.elementType}: doel ${elements[e.target].elementType}`);
      }
    }
    assert.deepEqual(kern(scenarioUitModel(elements, w.scenarioId)), kern(scenario));
  });
}

test("een tweede scenario komt in dezelfde simulatie; hetzelfde scenario opnieuw bewaren werkt bij en ruimt op", () => {
  const nieuwId = teller();
  let elements = pasToe({}, scenarioNaarModel(fixture("gpk-scenario-4"), { nieuwId }));
  const w5 = scenarioNaarModel(fixture("gpk-scenario-5"), { elements, nieuwId });
  assert.deepEqual(w5.nieuw, { simulatie: false, scenario: true });
  elements = pasToe(elements, w5);
  const { simulaties, los } = simulatiesIn(elements);
  assert.equal(simulaties.length, 1);
  assert.deepEqual(simulaties[0].scenarios.map((s) => s.naam), [fixture("gpk-scenario-4").naam, fixture("gpk-scenario-5").naam]);
  assert.deepEqual(los, []);

  // Scenario 5 gewijzigd: één antwoord minder, een ander startobject, geen verwachting meer.
  const gewijzigd = structuredClone(fixture("gpk-scenario-5"));
  const [eersteSleutel] = Object.keys(gewijzigd.antwoorden);
  delete gewijzigd.antwoorden[eersteSleutel];
  gewijzigd.start.object.soort = "bestuurder";
  delete gewijzigd.verwacht;
  const voor = Object.keys(elements).length;
  const w = scenarioNaarModel(gewijzigd, { elements, nieuwId });
  assert.deepEqual(w.nieuw, { simulatie: false, scenario: false });
  assert.equal(w.scenarioId, w5.scenarioId, "hetzelfde element");
  assert.equal(w.toevoegen.length, 0, "niets nieuws");
  assert.ok(w.verwijderen.length >= 4, "de stub(s) en de verwachting met hun lijnen");
  elements = pasToe(elements, w);
  assert.ok(Object.keys(elements).length < voor);
  assert.ok(!Object.values(elements).some((e) => e.source && (!elements[e.source] || !elements[e.target])), "geen losse lijnen");
  assert.deepEqual(kern(scenarioUitModel(elements, w.scenarioId)), kern(gewijzigd));
});

test("verwijzingen: type, taak en startevent worden opgelost; de tekst blijft als terugval", () => {
  const scenario = fixture("waterstede-3-festival");
  const w = scenarioNaarModel(scenario, {
    nieuwId: teller(),
    zoek: {
      type: (naam) => (naam === "Evenementaanvraag" ? { profielId: "diagram05", elementId: "ent1" } : null),
      plek: (sleutel) => (sleutel === "advies-brandweer" ? { ref: { profielId: "bpmnMotor05", elementId: "taak7" }, naam: "Advies brandweer" } : null),
      start: (proces) => ({ profielId: "bpmnMotor05", elementId: `start-van-${proces}` }),
      einde: () => null,
    },
  });
  const elements = pasToe({}, w);
  const van = (type) => Object.values(elements).filter((e) => e.elementType === type);
  assert.deepEqual(van("instantie")[0].data.instantieVan, { profielId: "diagram05", elementId: "ent1" });
  const brandweer = van("stub").find((s) => s.data.plek === "advies-brandweer");
  assert.equal(brandweer.naam, "Advies brandweer");
  assert.deepEqual(brandweer.data.bij, { profielId: "bpmnMotor05", elementId: "taak7" });
  // Het gat dat je zelf vult: een stub met een wijze, zonder waarde.
  assert.deepEqual(van("stub").filter((s) => s.data.wijze).map((s) => [s.data.plek, s.data.wijze]), [["aanvraag-beoordelen", "hand"]]);

  // Terug: het type komt uit de verwijzing, het antwoord staat op de element-id van de taak
  // (de interpreter zoekt een antwoord op bpmn-id, element-id of naam).
  const terug = scenarioUitModel(elements, w.scenarioId, { naamVan: (ref) => (ref?.elementId === "ent1" ? "Evenementaanvraag" : null), procesVan: (ref) => (ref ? "evenementaanvraag-behandelen" : null) });
  assert.equal(terug.start.type, "Evenementaanvraag");
  assert.equal(terug.start.proces, "evenementaanvraag-behandelen");
  assert.deepEqual(Object.keys(terug.antwoorden).sort(), ["advies-politie", "taak7"]);
  assert.deepEqual(terug.vulwijze.perGat, { "aanvraag-beoordelen": "hand" });
  // Met plekVan (het bpmn-id van de taak) komt de oorspronkelijke sleutel terug.
  const leesbaar = scenarioUitModel(elements, w.scenarioId, { plekVan: (ref) => (ref?.elementId === "taak7" ? "advies-brandweer" : null) });
  assert.deepEqual(Object.keys(leesbaar.antwoorden).sort(), ["advies-brandweer", "advies-politie"]);
});

test("ongeldige json op een instantie geeft een fout die het element noemt", () => {
  const w = scenarioNaarModel(fixture("gpk-scenario-1"), { nieuwId: teller() });
  const elements = pasToe({}, w);
  const instantie = Object.values(elements).find((e) => e.elementType === "instantie");
  elements[instantie.id] = { ...instantie, data: { ...instantie.data, json: "{ kapot" } };
  assert.throws(() => scenarioUitModel(elements, w.scenarioId), /Instantie "aanvraag-1": geen geldige json/);
});

test("toetsVerwachting: GPK 1 komt uit waar het scenario het verwacht; een andere verwachting faalt met wat er gevonden is", () => {
  const vier = fixture("gpk-vier-processen.bpmn-model");
  const scenario = fixture("gpk-scenario-1");
  const beslissingen = JSON.parse(fs.readFileSync(new URL("../diagramprofielen/canoniek-uml/fixtures/cg-test/gpk-beslissingen.dmn-model.json", import.meta.url), "utf8"));
  const sim = maakSimulatie({ m1: { proces: vier, beslissingen: [beslissingen] }, scenario });
  const stand = sim.loop();
  const t = toestandUit(sim.log);
  const afloop = { stand, variabelen: t.variabelen, object: t.objecten[scenario.start.id]?.data, log: sim.log };
  const goed = toetsVerwachting(scenario.verwacht, afloop);
  assert.equal(goed.klopt, true, JSON.stringify(goed.punten));
  assert.deepEqual(goed.punten.map((p) => p.wat), ["einde"], "de reden wordt niet getoetst");
  const fout = toetsVerwachting({ einde: "Beschikt", via: "Stel beschikking op", aanvraagnummer: "GPK-2026-0001", "ontvankelijkheid.ontvankelijk": false, ontvankelijk: false }, afloop);
  assert.equal(fout.klopt, false);
  assert.deepEqual(fout.punten.map((p) => [p.wat, p.klopt]), [["einde", false], ["via", false], ["aanvraagnummer", true], ["ontvankelijkheid.ontvankelijk", true], ["ontvankelijk", true]]);
  assert.equal(toetsVerwachting(null, afloop), null);
});
