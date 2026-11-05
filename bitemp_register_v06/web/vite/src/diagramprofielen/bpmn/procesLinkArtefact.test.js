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
  assert.deepEqual(bpmn.artefact.afhankelijkheden.map((a) => a.identifier), ["GPK"]);
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
