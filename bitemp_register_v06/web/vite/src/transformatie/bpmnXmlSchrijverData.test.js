/**
 * BPMN-schrijver: data-objecten, data stores en data-lijnen (16-11, ontwerp Simulatie §11.8).
 * Run: node --import ./test/register-aliases.mjs --test src/transformatie/bpmnXmlSchrijverData.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import BpmnModdle from "bpmn-moddle";
import { DOMParser } from "@xmldom/xmldom";
import { schrijfBpmn } from "./bpmnXmlSchrijver.js";
import { leesBpmn } from "./bpmnXml.js";

const vier = JSON.parse(fs.readFileSync(new URL("../simulatie/fixtures/gpk-vier-processen.bpmn-model.json", import.meta.url), "utf8"));
const diagramMet = (naam) => Object.values(vier.model.diagrams).find((d) => d.naam === naam).id;

/** Leest de XML met bpmn-moddle (het schema van bpmn.io): fouten en waarschuwingen. */
async function moddle(xml) {
  const { rootElement, warnings } = await new BpmnModdle().fromXML(xml);
  return { rootElement, warnings: warnings.map((w) => w.message) };
}

test("schrijver: Aanvraag oppakken met de Aanvraag als invoer en de Zaak als data-object, met type en toestand", async () => {
  const { xml, diagnostics } = schrijfBpmn({ model: vier.model, diagramId: diagramMet("Aanvraag oppakken"), proces: { id: "aanvraag-oppakken", naam: "Aanvraag oppakken" } });
  assert.deepEqual(diagnostics.filter((d) => /data/i.test(d.message)), [], "geen meldingen over data");
  // Het type als itemDefinition, de Aanvraag als dataInput met dataState, in de ioSpecification.
  assert.match(xml, /<bpmn:itemDefinition id="Item_aanvraag" structureRef="Aanvraag" \/>/);
  assert.match(xml, /<bpmn:ioSpecification id="aanvraag-oppakken-io">\s*<bpmn:dataInput id="aanvraag" name="Aanvraag" itemSubjectRef="Item_aanvraag">\s*<bpmn:dataState id="aanvraag-toestand" name="ingediend" \/>/);
  assert.match(xml, /<bpmn:inputSet id="aanvraag-oppakken-invoer"><bpmn:dataInputRefs>aanvraag<\/bpmn:dataInputRefs><\/bpmn:inputSet>/);
  // De Zaak (uitvoer, zonder type) en Zaak [Ontvangen]: dataOutput.
  assert.match(xml, /<bpmn:dataOutput id="zaak" name="Zaak" \/>/);
  assert.match(xml, /<bpmn:dataOutput id="zaak-2" name="Zaak">\s*<bpmn:dataState id="zaak-2-toestand" name="Ontvangen" \/>/);
  // De lijnen: lezen met een placeholder-property, schrijven met een targetRef.
  assert.match(xml, /<bpmn:property id="Property_ontvankelijkheid-toetsen" name="__targetRef_placeholder" \/>\s*<bpmn:dataInputAssociation id="ontvankelijkheid-toetsen-aanvraag-in"><bpmn:sourceRef>aanvraag<\/bpmn:sourceRef><bpmn:targetRef>Property_ontvankelijkheid-toetsen<\/bpmn:targetRef>/);
  assert.match(xml, /<bpmn:dataOutputAssociation id="zaak-aanmaken-zaak-uit"><bpmn:targetRef>zaak<\/bpmn:targetRef><\/bpmn:dataOutputAssociation>/);
  assert.match(xml, /<bpmndi:BPMNEdge id="zaak-aanmaken-zaak-uit_di" bpmnElement="zaak-aanmaken-zaak-uit">/);
  assert.match(xml, /<bpmndi:BPMNShape id="aanvraag_di" bpmnElement="aanvraag">/);

  // Het schema van bpmn.io leest het zonder waarschuwingen, met de verwijzingen opgelost.
  const { rootElement, warnings } = await moddle(xml);
  assert.deepEqual(warnings, []);
  const proces = rootElement.rootElements.find((x) => x.$type === "bpmn:Process");
  assert.equal(proces.ioSpecification.dataInputs[0].itemSubjectRef.structureRef, "Aanvraag");
  const toetsen = proces.flowElements.find((x) => x.id === "ontvankelijkheid-toetsen");
  assert.equal(toetsen.dataInputAssociations[0].sourceRef[0].id, "aanvraag");
});

test("schrijver: data store met dataStore op definitions-niveau; lezen en schrijven = twee lijnen", async () => {
  const model = structuredClone(vier.model);
  const kies = diagramMet("Kies zaak om te behandelen");
  // De lijn naar het Zaakregister: lezen en schrijven.
  model.elements.conn_1794147798572_2.data.richting = "beide";
  const { xml } = schrijfBpmn({ model, diagramId: kies, proces: { id: "werkbak" }, typeNaam: () => null });
  assert.match(xml, /<bpmn:dataStore id="DataStore_zaakregister" name="Zaakregister" \/>/);
  assert.match(xml, /<bpmn:dataStoreReference id="zaakregister" name="Zaakregister" dataStoreRef="DataStore_zaakregister" \/>/);
  assert.match(xml, /<bpmn:dataInputAssociation id="zaak-kiezen-zaakregister-in">/);
  assert.match(xml, /<bpmn:dataOutputAssociation id="zaak-kiezen-zaakregister-uit">/);
  const { warnings } = await moddle(xml);
  assert.deepEqual(warnings, []);
  // De lezer (rondgang) ziet de data store en beide lijnen.
  const gelezen = leesBpmn(xml, { DOMParser });
  assert.ok(gelezen.knopen.some((k) => k.id === "zaakregister" && k.aard === "dataStoreReference"));
  // De invoer van het proces komt terug als data-object met rol en toestand.
  const zaak = gelezen.knopen.find((k) => k.id === "zaak");
  assert.deepEqual([zaak.aard, zaak.rol, zaak.toestand], ["dataInput", "invoer", "in werkbak"]);
  assert.ok(gelezen.diagrammen[0].vormen.zaak, "met een plek in de diagramlaag");
  assert.deepEqual(
    gelezen.verbindingen.filter((v) => v.aard.startsWith("data")).map((v) => [v.aard, v.bron, v.doel]).sort(),
    [
      ["dataInputAssociation", "zaak", "zaak-kiezen"],
      ["dataInputAssociation", "zaakregister", "zaak-kiezen"],
      ["dataOutputAssociation", "zaak-kiezen", "zaakregister"],
    ],
  );
});

test("rondgang: het type komt terug als naam (structureRef), de Aanvraag als invoer met toestand", () => {
  const { xml } = schrijfBpmn({ model: vier.model, diagramId: diagramMet("Aanvraag oppakken"), proces: { id: "aanvraag-oppakken" } });
  const gelezen = leesBpmn(xml, { DOMParser });
  const aanvraag = gelezen.knopen.find((k) => k.id === "aanvraag");
  assert.deepEqual([aanvraag.aard, aanvraag.rol, aanvraag.toestand, aanvraag.typeNaam], ["dataInput", "invoer", "ingediend", "Aanvraag"]);
});

test("met een engine-regelset zonder data: true blijft data notatie (info), de uitrol verandert niet", () => {
  const { xml, diagnostics } = schrijfBpmn({ model: vier.model, diagramId: diagramMet("Aanvraag oppakken"), proces: { id: "aanvraag-oppakken" }, engine: { taken: {} } });
  assert.doesNotMatch(xml, /dataInput|dataObject|itemDefinition|DataInputAssociation/i);
  assert.ok(diagnostics.some((d) => d.severity === "info" && /notatie voor deze engine/.test(d.message)));
  assert.match(schrijfBpmn({ model: vier.model, diagramId: diagramMet("Aanvraag oppakken"), proces: { id: "aanvraag-oppakken" }, engine: { taken: {}, data: true } }).xml, /<bpmn:dataInput id="aanvraag"/);
});
