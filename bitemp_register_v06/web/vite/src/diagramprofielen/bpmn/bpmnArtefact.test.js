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
import { schrijfBpmn, bpmnIdUit, variabelenLijst, zetLijst } from "../../transformatie/bpmnXmlSchrijver.js";
import { bpmnXmlNaarModel } from "./bpmnXmlImport.js";
import { BPMN_NAAR_GZAC } from "./bpmnGzacRegels.js";
import { maakBpmnArtefact } from "./bpmnArtefact.js";
import { maakDmnArtefact } from "../dmn-drd/dmnArtefact.js";
import { maakObjecttypeArtefact } from "../canoniek-uml/objecttypeArtefact.js";

const CG = new URL("../canoniek-uml/fixtures/cg-test/", import.meta.url);
const tekst = (pad) => fs.readFileSync(new URL(pad, CG), "utf8");
const lees = (pad) => JSON.parse(tekst(pad));
const sha256Hex = (t) => crypto.createHash("sha256").update(t, "utf8").digest("hex");

/** De invoer van de beslistabel aanvraag-ontvankelijk, zoals de bundel hem aan het proces geeft. */
let _beslissingen;
const beslissingen = async () => {
  if (_beslissingen) return _beslissingen;
  const datatypen = JSON.parse(fs.readFileSync(new URL("../../../../../testdata/gegevenstypen.json", import.meta.url), "utf8")).datatypes;
  const edienst = lees("gpk-edienst.json");
  const referentielijsten = { Aanvraagtype: lees("aanvraag-aanvraagtypen.json"), Verzoekpartijrol: lees("relatiebeheer-verzoekpartijrollen.json") };
  const ot = (await maakObjecttypeArtefact({ modelBestand: lees("inrichten-domeinen-v3.json"), edienst, datatypen, referentielijsten, identifier: "gehandicaptenparkeerkaartaanvraag", sha256Hex })).artefact;
  const { invoer } = await maakDmnArtefact({ modelBestand: lees("gpk-beslissingen.dmn-model.json"), edienst, identifier: "aanvraag-ontvankelijk", objecttype: ot, sha256Hex });
  return (_beslissingen = { "aanvraag-ontvankelijk": invoer });
};

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
    beslissingen: await beslissingen(),
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
    ["start", "ontvankelijkheid-toetsen", "ontvankelijk", "status-niet-opgepakt", "niet-opgepakt", "zaak-aanmaken", "rol-aanvrager-aanmaken", "document-koppelen", "status-ontvangen", "vervolgproces-starten", "einde"]
  );
  // Ontvankelijkheid (0.4.0): de beslistabel met vaste decisionRef; ja → zaak, nee → dossierstatus, einde.
  assert.equal(s.knopen.find((k) => k.id === "ontvankelijkheid-toetsen").aard, "businessRuleTask");
  assert.equal(s.camunda["ontvankelijkheid-toetsen@decisionRef"], "aanvraag-ontvankelijk");
  assert.equal(s.camunda["ontvankelijkheid-toetsen@resultVariable"], "ontvankelijkheid");
  assert.equal(s.camunda["ontvankelijkheid-toetsen@mapDecisionResult"], "singleResult");
  assert.match(xml, /<camunda:inputParameter name="soort">\$\{documentDelegateService\.findValueByJsonPointerOrDefault\(&quot;\/soort&quot;, execution, null\)\}<\/camunda:inputParameter>/);
  assert.match(xml, /<camunda:inputParameter name="bijlagen">[^<]*&quot;\/bijlagen&quot;/);
  // 0.4.1: bsn is een procesvariabele die kan ontbreken; getVariable geeft dan null in plaats van een FEEL-fout.
  assert.match(xml, /<camunda:inputParameter name="bsn">\$\{execution\.getVariable\('bsn'\)\}<\/camunda:inputParameter>/);
  // De status is een waarde uit de statuslijst van het model (nietInBehandeling); GZAC krijgt de sleutel met koppeltekens.
  assert.equal(s.camunda["status-niet-opgepakt@expression"], "${documentDelegateService.setInternalStatus(execution, 'niet-in-behandeling')}");
  assert.deepEqual(s.flows.filter((f) => f[1] === "ontvankelijk").map((f) => [f[2], f[3]]), [
    ["zaak-aanmaken", "${ontvankelijkheid.ontvankelijk}"],
    ["status-niet-opgepakt", "${!ontvankelijkheid.ontvankelijk}"],
  ]);
  // Regelset 0.3.0: een werpend bericht-event correleert het message start event
  // van het beoordelingsproces, op hetzelfde dossier (businessKey); oppakken
  // wacht niet op de behandeling.
  const vervolg = s.knopen.find((k) => k.id === "vervolgproces-starten");
  assert.equal(vervolg.aard, "intermediateThrowEvent");
  assert.equal(vervolg.aangeroepenProces, undefined);
  assert.equal(s.camunda["vervolgproces-starten@asyncAfter"], "true");
  assert.match(s.camunda["vervolgproces-starten-definitie@expression"], /createMessageCorrelation\('gehandicaptenparkeerkaart-beoordelen-gevraagd'\)\.processInstanceBusinessKey\(execution\.getProcessBusinessKey\(\)\).*correlateStartMessage\(\)\}$/);
  assert.match(xml, /<bpmn:message id="Message_gehandicaptenparkeerkaart-beoordelen-gevraagd" name="gehandicaptenparkeerkaart-beoordelen-gevraagd" \/>/);
  assert.doesNotMatch(xml, /callActivity|<camunda:in /);
  assert.deepEqual(aangeroepen, []);
  assert.deepEqual(gestart, ["gehandicaptenparkeerkaart-beoordelen"]);
  assert.deepEqual(artefact.afhankelijkheden.map((a) => [a.identifier, a.soort]), [
    ["gehandicaptenparkeerkaart", "dossierstatussen"], // het proces zet een status van het dossier
    ["gehandicaptenparkeerkaart", "dossierdefinitie"],
    ["GPK", "zaaktype"],
    ["aanvraag-ontvankelijk", "dmn"],
    ["gehandicaptenparkeerkaart-beoordelen", "bpmn"], // niet de proceskoppeling met dezelfde identifier
  ]);
  // Elk element in de trace, met zijn activityId.
  assert.ok(artefact.traceregels.some((t) => t.doelPad === "#document-koppelen"));
});

test("call activity: een expressie is een fout voor GZAC, een onbekend proces een waarschuwing", async () => {
  const met = async (sleutel) => {
    const m = lees("gpk-processen.bpmn-model.json");
    const el = Object.values(m.model.elements).find((e) => e.data?.bpmnId === "vervolgproces-starten");
    Object.assign(el, { elementType: "taak", data: { bpmnId: "vervolgproces-starten", aangeroepenProces: sleutel } });
    return (await maakBpmnArtefact({ modelBestand: m, edienst: lees("gpk-edienst.json"), identifier: "aanvraag-oppakken", sha256Hex, beslissingen: await beslissingen() })).diagnostics;
  };
  assert.deepEqual((await met("${processDefinitionKey}")).map((d) => [d.code, d.severity]), [["BPMN-AANGEROEPEN", "error"]]);
  assert.deepEqual((await met("bestaat-niet")).map((d) => [d.code, d.severity]), [["BPMN-AANGEROEPEN", "warning"]]);
});

test("call activity: variabelen erheen en terug (regelset 0.7.0, FUNDAMENT 08-11)", () => {
  assert.deepEqual(variabelenLijst("uitkomst, a:b ,"), [{ bron: "uitkomst", doel: "uitkomst" }, { bron: "a", doel: "b" }]);
  assert.equal(variabelenLijst("Alle"), "alle");
  assert.deepEqual(variabelenLijst(""), []);
  assert.deepEqual(zetLijst('beoordelingsproces=${documentDelegateService.findValueByJsonPointerOrDefault("/beoordeling", execution, null)}, x=1'), [
    { naam: "beoordelingsproces", waarde: '${documentDelegateService.findValueByJsonPointerOrDefault("/beoordeling", execution, null)}' },
    { naam: "x", waarde: "1" },
  ]);
  const model = (data) => ({
    elements: { t: { id: "t", naam: "Beoordeel zaak", elementType: "taak", data: { aangeroepenProces: "gpk-beoordelen", ...data } } },
    diagrams: { d: { id: "d", naam: "Aanvraag behandelen", nodes: [{ elementId: "t", position: { x: 0, y: 0 } }] } },
  });
  const ext = (data) => schrijfBpmn({ model: model(data), proces: { id: "p" }, engine: BPMN_NAAR_GZAC }).xml.match(/<camunda:(in|out) [^>]*\/>/g);
  // Standaard: het dossier en alle variabelen erheen, niets terug (zoals vóór 0.7.0).
  assert.deepEqual(ext({}), ['<camunda:in businessKey="#{execution.processBusinessKey}" />', '<camunda:in variables="all" />']);
  assert.deepEqual(ext({ aangeroepenIn: "aanvraag, bsn", aangeroepenUit: "uitkomst:beoordeling" }), [
    '<camunda:in businessKey="#{execution.processBusinessKey}" />',
    '<camunda:in source="aanvraag" target="aanvraag" />',
    '<camunda:in source="bsn" target="bsn" />',
    '<camunda:out source="uitkomst" target="beoordeling" />',
  ]);
  assert.deepEqual(ext({ aangeroepenUit: "alle" }).slice(-1), ['<camunda:out variables="all" />']);
  // Zonder regelset: kale callActivity.
  assert.doesNotMatch(schrijfBpmn({ model: model({ aangeroepenUit: "uitkomst" }), proces: { id: "p" } }).xml, /camunda/);
});

test("bericht: zonder message start event in de e-dienst een waarschuwing", async () => {
  const m = lees("gpk-processen.bpmn-model.json");
  Object.values(m.model.elements).find((e) => e.data?.bpmnId === "vervolgproces-starten").data.bericht = "niemand-luistert";
  const { diagnostics, gestart } = await maakBpmnArtefact({ modelBestand: m, edienst: lees("gpk-edienst.json"), identifier: "aanvraag-oppakken", sha256Hex, beslissingen: await beslissingen() });
  assert.deepEqual(diagnostics.map((d) => [d.code, d.severity]), [["BPMN-BERICHT", "warning"]]);
  assert.deepEqual(gestart, []);
});

test("rondgang bericht: schrijven en teruglezen bewaart werpen en de berichtnaam", async () => {
  const { artefact } = await maakBpmnArtefact({ modelBestand: lees("gpk-processen.bpmn-model.json"), edienst: lees("gpk-edienst.json"), identifier: "aanvraag-oppakken", sha256Hex, beslissingen: await beslissingen() });
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
  // activityIds is een losse controle voor process-links die niet uit het model komen.
  edienst.artefacten.find((a) => a.identifier === "gehandicaptenparkeerkaart-beoordelen" && a.soort === "bpmn").activityIds = ["aanvraag-beoordelen", "besluit-vastleggen"];
  assert.deepEqual((await maak()).diagnostics.map((d) => d.code), ["BPMN-ACTIVITYID"]);
});

// Regelset 0.8.0 (FUNDAMENT 08-11): generiek behandelen ↔ specifiek beoordelen met berichten.
test("berichten: variabele naam erheen, terug wekt het wachtende proces met correlate()", async () => {
  const el = (id, elementType, data, naam = "") => ({ id, naam, elementType, data });
  const flow = (id, source, target) => ({ id, elementType: "sequence-flow", source, target, data: {} });
  const elements = Object.fromEntries([
    // Aanvraag behandelen (generiek)
    el("g1", "start-event", { soort: "bericht", bericht: "behandeling-gevraagd" }),
    el("g2", "tussen-event", { soort: "bericht", richting: "werpt", bericht: "${beoordelingsbericht}", bpmnId: "beoordeling-vragen" }),
    el("g3", "tussen-event", { soort: "bericht", bericht: "beoordeling-afgerond", bpmnId: "beoordeling-afwachten" }),
    el("g4", "eind-event", {}),
    flow("gf1", "g1", "g2"), flow("gf2", "g2", "g3"), flow("gf3", "g3", "g4"),
    // gehandicaptenparkeerkaart-beoordelen (specifiek)
    el("s1", "start-event", { soort: "bericht", bericht: "gpk-beoordelen-gevraagd" }),
    el("s2", "taak", { taakSoort: "user", bpmnId: "beoordelen", zetVariabelen: "uitkomst=toekennen, toelichting=a, b" }, "Beoordelen"),
    el("s3", "eind-event", { soort: "bericht", bericht: "beoordeling-afgerond", bpmnId: "afgerond" }),
    flow("sf1", "s1", "s2"), flow("sf2", "s2", "s3"),
    // Pool "Klantportaal" in Aanvraag behandelen: een deelnemer als documentatie (TRANSFORMATIES 08-11).
    el("kp", "pool", {}, "Klantportaal"),
    el("k1", "start-event", { soort: "bericht", bericht: "beoordeling-afgerond" }),
    el("k2", "taak", { taakSoort: "user" }, "Voer klanttaak uit"),
    el("k3", "eind-event", {}),
    { id: "kb1", elementType: "bevat", source: "kp", target: "k1", data: {} },
    { id: "kb2", elementType: "bevat", source: "kp", target: "k2", data: {} },
    { id: "kb3", elementType: "bevat", source: "kp", target: "k3", data: {} },
    flow("kf1", "k1", "k2"), flow("kf2", "k2", "k3"),
    { id: "km1", elementType: "message-flow", source: "g2", target: "k2", data: {} },
  ].map((e) => [e.id, e]));
  const nodes = (ids) => ids.map((elementId, i) => ({ elementId, position: { x: i * 150, y: 0 } }));
  const model = { elements, diagrams: { G: { id: "G", naam: "Aanvraag behandelen", nodes: nodes(["g1", "g2", "g3", "g4", "kp", "k1", "k2", "k3"]) }, S: { id: "S", naam: "Beoordelen", nodes: nodes(["s1", "s2", "s3"]) } } };
  const edienst = { edienst: { naam: "x", versienummer: "1.0.0" }, artefacten: [
    { soort: "bpmn", identifier: "aanvraag-behandelen", engine: "gzac", formaat: "bpmn-xml", bron: { diagram: "Aanvraag behandelen" } },
    { soort: "bpmn", identifier: "gpk-beoordelen", engine: "gzac", formaat: "bpmn-xml", bron: { diagram: "Beoordelen" } },
  ] };
  const maak = (identifier) => maakBpmnArtefact({ modelBestand: model, edienst, identifier, sha256Hex });

  const g = await maak("aanvraag-behandelen");
  assert.deepEqual(g.diagnostics.filter((d) => d.severity !== "info").map((d) => [d.code, d.sourceId]), [["BPMN-BERICHT", "g2"]], "variabele naam: een melding, geen fout");
  assert.deepEqual(g.diagnostics.filter((d) => d.severity === "info").map((d) => d.sourceId), ["kp", "km1"], "pool en message flow: info");
  assert.doesNotMatch(g.artefact.artefactInhoud.payload, /Voer klanttaak uit|Klantportaal/);
  const gx = g.artefact.artefactInhoud.payload;
  assert.match(gx, /createMessageCorrelation\(execution\.getVariable\('beoordelingsbericht'\)\)[^"]*correlateStartMessage\(\)\}/);
  assert.match(gx, /<bpmn:intermediateCatchEvent id="beoordeling-afwachten">[\s\S]*?messageRef="Message_beoordeling-afgerond"/);

  const s = await maak("gpk-beoordelen");
  assert.deepEqual(s.diagnostics, []);
  assert.deepEqual([s.gestart, s.gewekt], [[], ["aanvraag-behandelen"]]);
  const sx = s.artefact.artefactInhoud.payload;
  assert.match(sx, /createMessageCorrelation\('beoordeling-afgerond'\)\.processInstanceBusinessKey\(execution\.getProcessBusinessKey\(\)\)\.setVariables\(execution\.getVariables\(\)\)\.correlate\(\)\}/);
  // Vaste procesvariabelen als output-parameters; een komma zonder nieuwe naam= hoort bij de waarde.
  assert.match(sx, /<camunda:inputOutput>\s*<camunda:outputParameter name="uitkomst">toekennen<\/camunda:outputParameter>\s*<camunda:outputParameter name="toelichting">a, b<\/camunda:outputParameter>\s*<\/camunda:inputOutput>/);

  // Start én wacht dezelfde naam: wekken, met een melding.
  elements.g1.data.bericht = "beoordeling-afgerond";
  assert.deepEqual((await maak("gpk-beoordelen")).diagnostics.map((d) => d.code), ["BPMN-BERICHT"]);
});
