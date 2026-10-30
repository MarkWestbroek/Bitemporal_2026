// BPMN-rondgang (FUNDAMENT/Mark 30-10): de handgemaakte GZAC-processen
// (artefacten 6 en 7, fixtures/cg-test/gzac-handwerk/bpmn) inlezen met de
// BPMN-lezer, terugschrijven met de schrijver + engine-regelset gzac, en het
// verschil bekijken. Daarna het artefact uit het BPMN-model (gpk-processen):
// het oppakproces start het beoordelingsproces met een bericht (losse
// processen, Mark 30-10) in plaats van de processService-expressie.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { DOMParser } from "@xmldom/xmldom";

import { leesBpmn } from "../../transformatie/bpmnXml.js";
import { parseXml, afstammelingen, attr } from "../../transformatie/xmlBoom.js";
import { schrijfBpmn, bpmnIdUit } from "../../transformatie/bpmnXmlSchrijver.js";
import { bpmnXmlNaarModel } from "./bpmnXmlImport.js";
import { BPMN_NAAR_GZAC } from "./bpmnGzacRegels.js";
import { maakBpmnArtefact } from "./bpmnArtefact.js";

const CG = new URL("../canoniek-uml/fixtures/cg-test/", import.meta.url);
const tekst = (pad) => fs.readFileSync(new URL(pad, CG), "utf8");
const lees = (pad) => JSON.parse(tekst(pad));
const sha256Hex = (t) => crypto.createHash("sha256").update(t, "utf8").digest("hex");

/** De semantiek van een BPMN-bestand, los van opmaak, commentaar en DI-id's. */
function semantiek(xml) {
  const g = leesBpmn(xml, { DOMParser });
  const doc = parseXml(xml, { DOMParser });
  const camunda = {};
  const loop = (n) => {
    for (let k = n.firstChild; k; k = k.nextSibling) {
      if (k.nodeType !== 1) continue;
      const id = attr(k, "id") || attr(k.parentNode, "id");
      for (let i = 0; i < k.attributes.length; i += 1) {
        const a = k.attributes[i];
        if (a.prefix === "camunda") camunda[`${id}@${a.localName}`] = a.value;
      }
      loop(k);
    }
  };
  loop(doc.documentElement);
  const proces = afstammelingen(doc.documentElement, "process")[0];
  return {
    proces: { id: attr(proces, "id"), name: attr(proces, "name"), isExecutable: attr(proces, "isExecutable") },
    knopen: g.knopen.map((k) => ({ id: k.id, aard: k.aard, tekst: k.tekst, meervoudig: k.meervoudig, aangeroepenProces: k.aangeroepenProces })),
    flows: g.verbindingen.map((v) => [v.id, v.bron, v.doel, v.conditie]),
    vormen: g.diagrammen[0].vormen,
    lijnen: g.diagrammen[0].lijnen,
    camunda,
  };
}

const rondgang = (bestand, naam) => {
  const hand = tekst(`gzac-handwerk/bpmn/${bestand}.bpmn`);
  const { core, diagnostics } = bpmnXmlNaarModel(hand, { DOMParser, bestandsnaam: naam });
  const uit = schrijfBpmn({ model: core, proces: { id: bestand }, targetNamespace: "http://common-ground-lab.nl/bpmn", engine: BPMN_NAAR_GZAC });
  return { hand: semantiek(hand), terug: semantiek(uit.xml), diagnostics: [...diagnostics, ...uit.diagnostics] };
};

test("bpmnIdUit: een geldige XML-id uit vrije tekst", () => {
  assert.equal(bpmnIdUit("Zaak aanmaken"), "zaak-aanmaken");
  assert.equal(bpmnIdUit("Ëénmalig béoordelen"), "eenmalig-beoordelen");
  assert.equal(bpmnIdUit("3 stappen"), "_3-stappen");
});

test("rondgang gehandicaptenparkeerkaart-beoordelen: semantisch gelijk", () => {
  const { hand, terug, diagnostics } = rondgang("gehandicaptenparkeerkaart-beoordelen", "Gehandicaptenparkeerkaart beoordelen");
  assert.deepEqual(diagnostics, []);
  assert.deepEqual(terug, hand);
});

test("rondgang aanvraag-oppakken: gelijk op de processService-expressie na", () => {
  const { hand, terug, diagnostics } = rondgang("aanvraag-oppakken", "Aanvraag oppakken");
  assert.deepEqual(diagnostics, []);
  // De enige afwijking: het starten van het vervolgproces is engine-logica in een
  // expressie, die het model niet kent. Het BPMN-model maakt er een bericht van.
  assert.match(hand.camunda["vervolgproces-starten@expression"], /startProcessByProcessDefinitionKey/);
  assert.equal(terug.camunda["vervolgproces-starten@expression"], "${true}");
  delete hand.camunda["vervolgproces-starten@expression"];
  delete terug.camunda["vervolgproces-starten@expression"];
  assert.deepEqual(terug, hand);
});

test("schrijver zonder engine-regelset: kale BPMN, geen camunda", () => {
  const { core } = bpmnXmlNaarModel(tekst("gzac-handwerk/bpmn/aanvraag-oppakken.bpmn"), { DOMParser, bestandsnaam: "x" });
  const { xml, diagnostics } = schrijfBpmn({ model: core, proces: { id: "p" } });
  assert.doesNotMatch(xml, /camunda/);
  assert.match(xml, /<bpmn:multiInstanceLoopCharacteristics \/>/);
  assert.deepEqual(diagnostics.map((d) => d.code), ["BPMN-SCHRIJVER"]);
});

test("artefact aanvraag-oppakken uit het BPMN-model: bericht start de beoordeling, activityId's stabiel", async () => {
  const { artefact, diagnostics, aangeroepen, gestart } = await maakBpmnArtefact({
    modelBestand: lees("gpk-processen.bpmn-model.json"),
    edienst: lees("gpk-edienst.json"),
    identifier: "aanvraag-oppakken",
    sha256Hex,
  });
  assert.deepEqual(diagnostics, []);
  const xml = artefact.artefactInhoud.payload;
  assert.equal(typeof xml, "string");
  assert.equal(artefact.artefactInhoud.payloadHash, sha256Hex(xml));
  assert.equal(artefact.artefactInhoud.formaat, "bpmn-xml");
  assert.equal(artefact.artefactHerkomst.regelsetId, "bpmn-naar-gzac");
  assert.equal(artefact.artefactHerkomst.schrijverId, "bpmn-xml-schrijver@0.1.0");
  const s = semantiek(xml);
  assert.deepEqual(s.proces, { id: "aanvraag-oppakken", name: "Aanvraag oppakken", isExecutable: "true" });
  assert.deepEqual(
    s.knopen.map((k) => k.id),
    ["start", "zaak-aanmaken", "rol-aanvrager-aanmaken", "document-koppelen", "status-ontvangen", "vervolgproces-starten", "einde"]
  );
  // Regelset 0.3.0: een werpend bericht-event correleert het message start event
  // van het beoordelingsproces, op hetzelfde dossier (businessKey); oppakken
  // wacht niet op de behandeling.
  const vervolg = s.knopen.find((k) => k.id === "vervolgproces-starten");
  assert.equal(vervolg.aard, "intermediateThrowEvent");
  assert.equal(vervolg.aangeroepenProces, undefined);
  assert.equal(s.camunda["vervolgproces-starten@asyncAfter"], "true");
  assert.match(s.camunda["vervolgproces-starten-definitie@expression"], /createMessageCorrelation\('gehandicaptenparkeerkaart-beoordelen-gevraagd'\)\.processInstanceBusinessKey\(execution\.getProcessBusinessKey\(\)\).*correlateStartMessage\(\)\}$/);
  assert.match(xml, /<bpmn:message id="Message_gehandicaptenparkeerkaart-beoordelen-gevraagd" name="gehandicaptenparkeerkaart-beoordelen-gevraagd" \/>/);
  assert.doesNotMatch(xml, /callActivity|camunda:in/);
  assert.deepEqual(aangeroepen, []);
  assert.deepEqual(gestart, ["gehandicaptenparkeerkaart-beoordelen"]);
  assert.deepEqual(artefact.afhankelijkheden.map((a) => a.identifier), ["GPK", "gehandicaptenparkeerkaart-beoordelen"]);
  // Elk element in de trace, met zijn activityId.
  assert.ok(artefact.traceregels.some((t) => t.doelPad === "#document-koppelen"));
});

test("call activity: een expressie is een fout voor GZAC, een onbekend proces een waarschuwing", async () => {
  const met = async (sleutel) => {
    const m = lees("gpk-processen.bpmn-model.json");
    const el = Object.values(m.model.elements).find((e) => e.data?.bpmnId === "vervolgproces-starten");
    Object.assign(el, { elementType: "taak", data: { bpmnId: "vervolgproces-starten", aangeroepenProces: sleutel } });
    return (await maakBpmnArtefact({ modelBestand: m, edienst: lees("gpk-edienst.json"), identifier: "aanvraag-oppakken", sha256Hex })).diagnostics;
  };
  assert.deepEqual((await met("${processDefinitionKey}")).map((d) => [d.code, d.severity]), [["BPMN-AANGEROEPEN", "error"]]);
  assert.deepEqual((await met("bestaat-niet")).map((d) => [d.code, d.severity]), [["BPMN-AANGEROEPEN", "warning"]]);
});

test("bericht: zonder message start event in de e-dienst een waarschuwing", async () => {
  const m = lees("gpk-processen.bpmn-model.json");
  Object.values(m.model.elements).find((e) => e.data?.bpmnId === "vervolgproces-starten").data.bericht = "niemand-luistert";
  const { diagnostics, gestart } = await maakBpmnArtefact({ modelBestand: m, edienst: lees("gpk-edienst.json"), identifier: "aanvraag-oppakken", sha256Hex });
  assert.deepEqual(diagnostics.map((d) => [d.code, d.severity]), [["BPMN-BERICHT", "warning"]]);
  assert.deepEqual(gestart, []);
});

test("rondgang bericht: schrijven en teruglezen bewaart werpen en de berichtnaam", async () => {
  const { artefact } = await maakBpmnArtefact({ modelBestand: lees("gpk-processen.bpmn-model.json"), edienst: lees("gpk-edienst.json"), identifier: "aanvraag-oppakken", sha256Hex });
  const { core } = bpmnXmlNaarModel(artefact.artefactInhoud.payload, { DOMParser, bestandsnaam: "terug" });
  const el = Object.values(core.elements).find((e) => e.data?.bpmnId === "vervolgproces-starten");
  assert.equal(el.elementType, "tussen-event");
  assert.deepEqual({ soort: el.data.soort, richting: el.data.richting, bericht: el.data.bericht }, { soort: "bericht", richting: "werpt", bericht: "gehandicaptenparkeerkaart-beoordelen-gevraagd" });
});

test("artefact gehandicaptenparkeerkaart-beoordelen; een ontbrekende activityId is een fout", async () => {
  const edienst = lees("gpk-edienst.json");
  const maak = () => maakBpmnArtefact({ modelBestand: lees("gpk-processen.bpmn-model.json"), edienst, identifier: "gehandicaptenparkeerkaart-beoordelen", sha256Hex });
  const { artefact, diagnostics } = await maak();
  assert.deepEqual(diagnostics, []);
  assert.match(artefact.artefactInhoud.payload, /<bpmn:startEvent id="start" name="Zaak aangemaakt">[\s\S]*?<bpmn:messageEventDefinition id="start-definitie" messageRef="Message_gehandicaptenparkeerkaart-beoordelen-gevraagd" \/>/);
  assert.deepEqual(semantiek(artefact.artefactInhoud.payload).knopen.map((k) => [k.id, k.aard]), [
    ["start", "startEvent"],
    ["aanvraag-beoordelen", "userTask"],
    ["einde", "endEvent"],
  ]);
  edienst.artefacten.find((a) => a.identifier === "gehandicaptenparkeerkaart-beoordelen").activityIds.push("besluit-vastleggen");
  assert.deepEqual((await maak()).diagnostics.map((d) => d.code), ["BPMN-ACTIVITYID"]);
});
