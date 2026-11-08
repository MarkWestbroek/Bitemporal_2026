// Proceskoppeling (Mark 05-11): de process-link van een proces uit het BPMN-model. Was handwerk
// bij FUNDAMENT; een gebruikerstaak met een formulier geeft een formulierkoppeling.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";

import { maakProcesLinkArtefact } from "./procesLinkArtefact.js";
import { maakBpmnArtefact } from "./bpmnArtefact.js";
import { jcsHash } from "../../transformatie/jcs.js";

const CG = new URL("../canoniek-uml/fixtures/cg-test/", import.meta.url);
const lees = (naam) => JSON.parse(fs.readFileSync(new URL(naam, CG), "utf8"));
const sha256Hex = (t) => crypto.createHash("sha256").update(t, "utf8").digest("hex");
const maak = (identifier, wijzig = (m, e) => {}) => {
  const modelBestand = lees("gpk-processen.bpmn-model.json");
  const edienst = lees("gpk-edienst.json");
  wijzig(modelBestand.model || modelBestand, edienst);
  return maakProcesLinkArtefact({ modelBestand, edienst, identifier, peiltijdstip: "2026-11-05T12:00:00Z", sha256Hex });
};

test("beoordelen: de gebruikerstaak met zijn formulier, gelijk aan het handwerk op subtitles na", async () => {
  const { artefact, diagnostics } = await maak("gehandicaptenparkeerkaart-beoordelen");
  assert.deepEqual(diagnostics, []);
  const handwerk = lees("gzac-handwerk/gehandicaptenparkeerkaart-beoordelen.process-link.json");
  // Op `subtitles` na: het handwerk had null, GZAC geeft een lege lijst terug (FUNDAMENT 05-11).
  assert.deepEqual(artefact.artefactInhoud.payload, handwerk.map((k) => ({ ...k, subtitles: [] })));
  assert.deepEqual(Object.keys(artefact.artefactInhoud.payload[0]), Object.keys(handwerk[0]));
  assert.equal(artefact.artefactInhoud.payloadHash, await jcsHash(artefact.artefactInhoud.payload, sha256Hex));
  assert.equal(artefact.artefactIdentificatie.soort, "proceskoppeling");
  assert.equal(artefact.artefactInhoud.formaat, "gzac-process-link-json");
  assert.equal(artefact.artefactHerkomst.regelsetId, "bpmn-naar-gzac");
  assert.equal(artefact.artefactHerkomst.schrijverId, "gzac-process-link-schrijver@0.1.0");
  assert.deepEqual(artefact.traceregels.map((t) => [t.bronGE, t.doelPad]), [["bp_aanvraag_beoordelen", "/0"]]);
  // Zelfde identifier als het bpmn-artefact, maar niet diens afhankelijkheden.
  assert.deepEqual(artefact.afhankelijkheden.map((a) => [a.identifier, a.soort]), [
    ["gehandicaptenparkeerkaart-beoordelen", "bpmn"],
    ["aanvraag-beoordelen", "dossierformulier"],
  ]);
});

test("de activityId is de id die de BPMN-schrijver in de XML zet", async () => {
  const { artefact } = await maak("gehandicaptenparkeerkaart-beoordelen");
  const bpmn = await maakBpmnArtefact({ modelBestand: lees("gpk-processen.bpmn-model.json"), edienst: lees("gpk-edienst.json"), identifier: "gehandicaptenparkeerkaart-beoordelen", sha256Hex });
  assert.match(bpmn.artefact.artefactInhoud.payload, new RegExp(`<bpmn:userTask id="${artefact.artefactInhoud.payload[0].activityId}"`));
  // Het bpmn-artefact neemt de afhankelijkheden van de proceskoppeling niet over.
  assert.deepEqual(bpmn.artefact.afhankelijkheden.map((a) => [a.identifier, a.soort]), [["gehandicaptenparkeerkaart", "dossierdefinitie"], ["GPK", "zaaktype"]]);
});

// Servicetaken (Mark 05-11): het model zegt wat een taak doet; de regelset maakt er de
// plugin-koppeling van. Was handwerk bij FUNDAMENT.
test("oppakken: vier servicetaken met een actie, gelijk aan het handwerk plus wat GZAC zelf teruggeeft", async () => {
  const { artefact, diagnostics } = await maak("aanvraag-oppakken");
  assert.deepEqual(diagnostics, []);
  const handwerk = lees("gzac-handwerk/aanvraag-oppakken.process-link.json");
  // Het handwerk had de vaste uuid van de pluginconfiguratie op cg-test; de uitrol vult de plaatshouder in.
  // referenceType, pluginDefinitionKey en actionResultMappings geeft GZAC zelf terug (FUNDAMENT 05-11).
  const verwacht = handwerk.map((k) => ({ ...k, pluginConfigurationId: "${PLUGINCONFIG_ID:zakenapi}", referenceType: "FIXED", pluginDefinitionKey: "zakenapi", actionResultMappings: [] }));
  assert.deepEqual(artefact.artefactInhoud.payload, verwacht);
  assert.deepEqual(artefact.artefactInhoud.payload.map((k) => [k.activityId, k.pluginActionDefinitionKey]), [
    ["zaak-aanmaken", "create-zaak"],
    ["rol-aanvrager-aanmaken", "create-natuurlijk-persoon-zaak-rol"],
    ["document-koppelen", "link-document-to-zaak"],
    ["status-ontvangen", "set-zaakstatus"],
  ]);
  // "Ontvangen" is het eerste statustype van zaaktype GPK in de e-dienst.
  assert.equal(artefact.artefactInhoud.payload[3].actionProperties.statustypeUrl, "${STATUSTYPE_URL:GPK:1}");
  assert.deepEqual(artefact.afhankelijkheden.map((a) => [a.identifier, a.soort]), [["aanvraag-oppakken", "bpmn"], ["GPK", "zaaktype"]]);
  assert.deepEqual(artefact.traceregels.map((t) => t.bronGE), ["bp_zaak_aanmaken", "bp_rol_aanvrager_aanmaken", "bp_document_koppelen", "bp_status_ontvangen"]);
});

test("toetsen op een actie: onbekende status, onbekende rol, andere rol dan de initiator, taak zonder actie", async () => {
  const codes = async (wijzig) => (await maak("aanvraag-oppakken", wijzig)).diagnostics.map((d) => [d.severity, d.code]);
  assert.deepEqual(await codes((m) => (m.elements.bp_status_ontvangen.data.actieDoel = "Bestaat niet")), [["error", "PL-STATUS"]]);
  assert.deepEqual(await codes((m) => delete m.elements.bp_status_ontvangen.data.actieDoel), [["error", "PL-STATUS"]]);
  assert.deepEqual(await codes((m) => (m.elements.bp_rol_aanvrager_aanmaken.data.actieDoel = "Bestaat niet")), [["error", "PL-ROL"]]);
  assert.deepEqual(
    await codes((m, e) => {
      e.artefacten.find((a) => a.soort === "zaaktype").zaaktype.roltypen.push({ omschrijving: "Behandelaar", omschrijvingGeneriek: "behandelaar" });
      m.elements.bp_rol_aanvrager_aanmaken.data.actieDoel = "Behandelaar";
    }),
    [["warning", "PL-ROL"]],
  );
  assert.deepEqual(await codes((m) => delete m.elements.bp_zaak_aanmaken.data.actie), [["warning", "PL-ACTIE"]]);
  assert.deepEqual(await codes((m) => (m.elements.bp_zaak_aanmaken.data.actie = "ietsAnders")), [["error", "PL-ACTIE"]]);
  // De taak die alleen de dossierstatus zet, heeft geen actie nodig en krijgt geen koppeling.
  const { artefact } = await maak("aanvraag-oppakken");
  assert.ok(!artefact.artefactInhoud.payload.some((k) => k.activityId === "status-niet-opgepakt"));
});

test("toetsen: taak zonder formulier, onbekend formulier, geen bpmn-artefact", async () => {
  const zonder = await maak("gehandicaptenparkeerkaart-beoordelen", (m) => delete m.elements.bp_aanvraag_beoordelen.data.formulier);
  assert.deepEqual(zonder.diagnostics.map((d) => [d.severity, d.code]), [["warning", "PL-FORMULIER"], ["info", "PL-LEEG"]]);
  assert.deepEqual(zonder.artefact.artefactInhoud.payload, []);

  const onbekend = await maak("gehandicaptenparkeerkaart-beoordelen", (m) => (m.elements.bp_aanvraag_beoordelen.data.formulier = "bestaat-niet"));
  assert.deepEqual(onbekend.diagnostics.map((d) => [d.severity, d.code]), [["error", "PL-FORMULIER"]]);

  await assert.rejects(
    maak("gehandicaptenparkeerkaart-beoordelen", (m, e) => (e.artefacten = e.artefacten.filter((a) => !(a.soort === "bpmn" && a.identifier === "gehandicaptenparkeerkaart-beoordelen")))),
    /geen bpmn-artefact met dezelfde identifier/,
  );
});

test("een actie met een eigen plugin, ook op een gebruikerstaak (portaaltaak, regelset 0.8.0)", async () => {
  const modelBestand = lees("gpk-processen.bpmn-model.json");
  const el = Object.values((modelBestand.model || modelBestand).elements).find((e) => e.id === "bp_aanvraag_beoordelen");
  Object.assign(el.data, { actie: "portaaltaakAanmaken", formulier: "aanvulling-gpk" });
  const { artefact, diagnostics } = await maakProcesLinkArtefact({ modelBestand, edienst: lees("gpk-edienst.json"), identifier: "gehandicaptenparkeerkaart-beoordelen", sha256Hex });
  assert.deepEqual(diagnostics, []);
  const [k] = artefact.artefactInhoud.payload;
  assert.deepEqual(
    [k.activityType, k.processLinkType, k.pluginDefinitionKey, k.pluginConfigurationId, k.pluginActionDefinitionKey, k.formDefinitionName],
    ["bpmn:UserTask:create", "plugin", "portaaltaak", "${PLUGINCONFIG_ID:portaaltaak}", "create-portaaltaak", undefined],
  );
  assert.deepEqual(k.actionProperties, { formType: "id", formTypeId: "aanvulling-gpk", sendData: [], receiveData: [], receiver: "zaakInitiator", verloopDurationInDays: 14 });
  // Zonder formulier: een fout.
  delete el.data.formulier;
  const zonder = await maakProcesLinkArtefact({ modelBestand, edienst: lees("gpk-edienst.json"), identifier: "gehandicaptenparkeerkaart-beoordelen", sha256Hex });
  assert.deepEqual(zonder.diagnostics.map((d) => [d.code, d.severity]), [["PL-FORMULIER", "error"], ["PL-LEEG", "info"]]);
});

test("servicetaak die alleen procesvariabelen zet: geen PL-ACTIE (TRANSFORMATIES 08-11)", async () => {
  const { diagnostics } = await maak("aanvraag-oppakken", (m) => {
    const el = Object.values(m.elements).find((e) => e.data?.taakSoort === "service" && e.data?.actie);
    Object.assign(el.data, { actie: "", dossierstatus: "", zetVariabelen: "beoordelingsbericht=x" });
  });
  assert.deepEqual(diagnostics.filter((d) => d.code === "PL-ACTIE"), []);
});
