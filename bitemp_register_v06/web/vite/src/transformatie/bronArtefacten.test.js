// Bronnen als artefacten (besluit Mark 05-11): per e-dienst het e-dienstmodel, het logisch model,
// de processen en de beslissingen als eigen artefact; elk gegenereerd artefact noemt zijn bronnen.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";

import { maakBronArtefacten, bronnenVan, uuidIndex, uuidVanPad, zetBronElementIds, studioPayload, PROFIEL } from "./bronArtefacten.js";
import { maakInrichtingsBundel } from "./inrichtingsBundel.js";
import { voerInrichtingsExportUit } from "./inrichtingsExport.js";
import { jcsHash } from "./jcs.js";
import { studioViews } from "../diagramsvg/studio.js";

const lees = (naam) => JSON.parse(fs.readFileSync(new URL(`../diagramprofielen/canoniek-uml/fixtures/cg-test/${naam}`, import.meta.url), "utf8"));
const datatypen = JSON.parse(fs.readFileSync(new URL("./gegevenstypen.snapshot.json", import.meta.url), "utf8")).datatypes;
const sha256Hex = (tekst) => crypto.createHash("sha256").update(tekst, "utf8").digest("hex");
const bpmnModellen = () => ({ "gpk-processen.bpmn-model.json": lees("gpk-processen.bpmn-model.json"), "gpk-beslissingen.dmn-model.json": lees("gpk-beslissingen.dmn-model.json") });
const bronInvoer = () => ({ edienst: lees("gpk-edienst.json"), modelBestand: lees("inrichten-domeinen-v3.json"), bpmnModellen: bpmnModellen(), peiltijdstip: "2026-11-05T12:00:00Z", sha256Hex });

test("GPK: vier bronnen, identifier = de code van de e-dienst, hash over JCS", async () => {
  const { bronnen, diagnostics } = await maakBronArtefacten(bronInvoer());
  assert.deepEqual(diagnostics, []);
  assert.deepEqual(bronnen.map((b) => [b.soort, b.identifier, b.bestandsnaam]), [
    ["edienstmodel", "gehandicaptenparkeerkaart-aanvragen", "gehandicaptenparkeerkaart-aanvragen.edienstmodel.artefact.json"],
    ["logisch-model", "gehandicaptenparkeerkaart-aanvragen", "gehandicaptenparkeerkaart-aanvragen.logisch-model.artefact.json"],
    ["bpmn-bron", "gehandicaptenparkeerkaart-aanvragen", "gehandicaptenparkeerkaart-aanvragen.bpmn-bron.artefact.json"],
    ["dmn-bron", "gehandicaptenparkeerkaart-aanvragen", "gehandicaptenparkeerkaart-aanvragen.dmn-bron.artefact.json"],
  ]);
  for (const b of bronnen) {
    const { artefactIdentificatie: id, artefactInhoud: inh, artefactHerkomst: h } = b.artefact;
    assert.equal(inh.payloadHash, await jcsHash(inh.payload, sha256Hex));
    assert.equal(inh.formaat, b.soort === "edienstmodel" ? "omnium-edienstmodel-json" : "omnium-studio-json");
    assert.equal(h.schrijverId, "omnium-bron-schrijver@0.1.0");
    assert.equal(id.versienummer, "0.1.0");
    assert.deepEqual(b.artefact.edienstversie, { edienst: "Gehandicaptenparkeerkaart aanvragen", versienummer: "0.1.0" });
    assert.equal(b.artefact.doelcomponent, undefined); // een bron wordt niet uitgerold
  }
  // Het e-dienstmodel zoals gelezen.
  assert.deepEqual(bronnen[0].artefact.artefactInhoud.payload, lees("gpk-edienst.json"));
});

test("dezelfde bron geeft dezelfde hash: geen tijdstip in de payload", async () => {
  const a = await maakBronArtefacten(bronInvoer());
  const b = await maakBronArtefacten({ ...bronInvoer(), peiltijdstip: "2027-01-01T00:00:00Z" });
  assert.deepEqual(a.bronnen.map((x) => x.artefact.artefactInhoud.payloadHash), b.bronnen.map((x) => x.artefact.artefactInhoud.payloadHash));
  // De opmaak telt mee: een verschoven vakje is een andere bron.
  const invoer = bronInvoer();
  Object.values(invoer.bpmnModellen["gpk-processen.bpmn-model.json"].model.diagrams)[0].nodes[0].position.x += 10;
  const c = await maakBronArtefacten(invoer);
  const hash = (r, soort) => r.bronnen.find((x) => x.soort === soort).artefact.artefactInhoud.payloadHash;
  assert.notEqual(hash(c, "bpmn-bron"), hash(a, "bpmn-bron"));
  assert.equal(hash(c, "logisch-model"), hash(a, "logisch-model")); // een bron per profiel: het logisch model is niet geraakt
});

test("de payload van een bron is de invoer van de render-API (taal=studio); de diagrammen staan per profiel", async () => {
  const { bronnen } = await maakBronArtefacten(bronInvoer());
  const payload = (soort) => bronnen.find((b) => b.soort === soort).artefact.artefactInhoud.payload;
  assert.deepEqual(Object.keys(payload("bpmn-bron").profielen), [PROFIEL.bpmn]);
  assert.deepEqual(studioViews({ taal: "studio", model: payload("bpmn-bron") }).weergaven.map((w) => [w.naam, w.profiel]), [
    ["Aanvraag oppakken", "bpmnMotor05"],
    ["Gehandicaptenparkeerkaart beoordelen", "bpmnMotor05"],
  ]);
  assert.deepEqual(Object.keys(payload("dmn-bron").profielen), [PROFIEL.dmn]);
  // De beslistabel zit in de bron, op het element decision.
  assert.ok(Object.values(payload("dmn-bron").profielen[PROFIEL.dmn].elements).some((e) => e.elementType === "decision" && e.data?.beslistabel));
  // Zelfstandig: elk canoniek element draagt zijn domein, zodat te zien is wat geleend is.
  // Een referentielijst-instantie (Aanvraagtypen) heeft in het project (08-11) nog geen domein.
  const canoniek = Object.values(payload("logisch-model").profielen[PROFIEL.canoniek].elements).filter((e) => !e.source && e.elementType !== "package" && e.elementType !== "referentielijstInstantie");
  assert.ok(canoniek.length > 50);
  assert.ok(canoniek.every((e) => e.data?.domein));
});

test("het canonieke profiel uit de Studio-map (met diagrammen) wint van de afleiding uit V3", async () => {
  const deel = { elements: { e1: { id: "e1", naam: "Aanvraag", elementType: "entiteit", data: { domein: "aanvraag" } } }, diagrams: { d1: { id: "d1", naam: "Logisch model GPK", nodes: [{ elementId: "e1", position: { x: 0, y: 0 } }], edges: [] } } };
  const { bronnen } = await maakBronArtefacten({ ...bronInvoer(), canoniekDeel: deel });
  assert.deepEqual(bronnen.find((b) => b.soort === "logisch-model").artefact.artefactInhoud.payload, studioPayload(PROFIEL.canoniek, deel));
});

test("meldingen: geen code, een model dat niet is meegegeven", async () => {
  const invoer = bronInvoer();
  delete invoer.edienst.edienst.code;
  delete invoer.bpmnModellen["gpk-beslissingen.dmn-model.json"];
  const { bronnen, diagnostics } = await maakBronArtefacten(invoer);
  assert.deepEqual(diagnostics.map((d) => [d.severity, d.code]), [["warning", "BRON-CODE"], ["warning", "BRON-MODEL"]]);
  assert.equal(bronnen[0].identifier, "gehandicaptenparkeerkaart-aanvragen"); // uit de naam
  assert.deepEqual(bronnen.map((b) => b.soort), ["edienstmodel", "logisch-model", "bpmn-bron"]);
});

test("elk gegenereerd artefact noemt zijn bronnen, met de hash van het bronbestand", async () => {
  const { bronnen } = await maakBronArtefacten(bronInvoer());
  const hash = Object.fromEntries(bronnen.map((b) => [b.soort, b.artefact.artefactInhoud.payloadHash]));
  const bundel = await maakInrichtingsBundel({
    ...bronInvoer(),
    datatypen,
    referentielijsten: { Aanvraagtype: lees("aanvraag-aanvraagtypen.json"), Verzoekpartijrol: lees("relatiebeheer-verzoekpartijrollen.json") },
    bronnen,
  });
  const van = (soort, identifier) => bundel.find((b) => b.soort === soort && b.identifier === identifier).artefact.bronnen.map((x) => x.soort);
  assert.deepEqual(van("objecttype", "gehandicaptenparkeerkaartaanvraag"), ["logisch-model", "edienstmodel"]);
  assert.deepEqual(van("zaaktype", "GPK"), ["edienstmodel"]);
  assert.deepEqual(van("dossiertabbladen", "gehandicaptenparkeerkaart"), ["edienstmodel"]);
  assert.deepEqual(van("dossierstatussen", "gehandicaptenparkeerkaart"), ["logisch-model", "bpmn-bron", "edienstmodel"]);
  assert.deepEqual(van("dmn", "aanvraag-ontvankelijk"), ["dmn-bron", "logisch-model", "edienstmodel"]);
  assert.deepEqual(van("bpmn", "aanvraag-oppakken"), ["bpmn-bron", "edienstmodel"]);
  assert.deepEqual(van("proceskoppeling", "aanvraag-oppakken"), ["bpmn-bron", "edienstmodel"]);
  for (const b of bundel) {
    for (const x of b.artefact.bronnen) {
      assert.equal(x.identifier, "gehandicaptenparkeerkaart-aanvragen");
      assert.equal(x.payloadHash, hash[x.soort]);
    }
    // bronmodelHash blijft de hash van de hoofdbron zoals de regelset die las, niet die van het bronbestand.
    assert.notEqual(b.artefact.artefactHerkomst.bronmodelHash, hash["logisch-model"]);
  }
  // Zonder bronnen (de CLI, één artefact) geen lijst.
  const los = await maakInrichtingsBundel({ ...bronInvoer(), datatypen, referentielijsten: {}, kies: (k) => k.soort === "dossiertabbladen" });
  assert.equal(los[0].artefact.bronnen, undefined);
});

test("bronElementId: het element-id bij BPMN en DMN, de uuid bij het canonieke model", async () => {
  const invoer = bronInvoer();
  // Het model uit de Studio draagt uuid's; de fixture nog niet.
  const model = invoer.modelBestand.model || invoer.modelBestand;
  const ent = model.entiteiten.find((e) => (e.gegevenselementen || []).some((g) => g.naam === "GpkAanvraagKaart"));
  const ge = ent.gegevenselementen.find((g) => g.naam === "GpkAanvraagKaart");
  ge.velden.find((v) => v.naam === "soort").uuid = "uuid-soort";
  const partij = model.entiteiten.find((e) => e.typenaam === "Partij");
  partij.gegevenselementen.find((g) => g.naam === "PartijNaam").uuid = "uuid-partijnaam";
  assert.equal(uuidIndex(invoer.modelBestand).get(`${ent.typenaam}.GpkAanvraagKaart.soort`), "uuid-soort");

  const edienst = invoer.edienst;
  edienst.bronmodel.hash = ""; // het model is hier gewijzigd; de hash-toets is een andere test
  const bundel = await maakInrichtingsBundel({
    ...invoer,
    datatypen,
    referentielijsten: { Aanvraagtype: lees("aanvraag-aanvraagtypen.json"), Verzoekpartijrol: lees("relatiebeheer-verzoekpartijrollen.json") },
  });
  const traces = (soort, identifier) => bundel.find((b) => b.soort === soort && b.identifier === identifier).artefact.traceregels;
  const soort = traces("objecttype", "gehandicaptenparkeerkaartaanvraag").find((t) => t.bronGE === `${ent.typenaam}.GpkAanvraagKaart.soort`);
  assert.equal(soort.bronElementId, "uuid-soort");
  // Een pad over een relatie: het eind van het pad is het modelelement.
  assert.equal(traces("objecttype", "gehandicaptenparkeerkaartaanvraag").find((t) => t.bronGE === "Aanvraag.AanvraagPartij.Partij.PartijNaam").bronElementId, "uuid-partijnaam");
  // Zonder uuid in het model blijft het bij de naam.
  assert.ok(traces("objecttype", "gehandicaptenparkeerkaartaanvraag").some((t) => t.bronGE && !t.bronElementId));
  // BPMN en proceskoppeling: bronGE is het element-id.
  assert.ok(traces("bpmn", "aanvraag-oppakken").every((t) => t.bronElementId === t.bronGE));
  assert.deepEqual(traces("proceskoppeling", "aanvraag-oppakken").map((t) => t.bronElementId), ["bp_zaak_aanmaken", "bp_rol_aanvrager_aanmaken", "bp_document_koppelen", "bp_status_ontvangen"]);
  // DMN: de beslissing op element-id; een kolom met een uuid-binding op die uuid.
  assert.equal(traces("dmn", "aanvraag-ontvankelijk")[0].bronElementId, traces("dmn", "aanvraag-ontvankelijk")[0].bronGE);
  assert.deepEqual(zetBronElementIds({ traceregels: [{ bronGE: "A.b.c", bronUuid: "u1" }, { bronGE: null }] }).traceregels, [{ bronGE: "A.b.c", bronUuid: "u1", bronElementId: "u1" }, { bronGE: null }]);
});

test("uuidVanPad: het hele pad, anders het eind ervan", () => {
  const uuids = new Map([["Partij.PartijNaam.naam", "u1"], ["Aanvraag", "u2"]]);
  assert.equal(uuidVanPad(uuids, "Aanvraag.AanvraagPartij.Partij.PartijNaam.naam"), "u1");
  assert.equal(uuidVanPad(uuids, "Aanvraag"), "u2");
  assert.equal(uuidVanPad(uuids, "envelop:bsn"), null);
  assert.equal(uuidVanPad(uuids, null), null);
});

test("bronnenVan: alleen het model dat het artefact leest", () => {
  const bron = (soort, model = null) => ({ soort, identifier: model ? `x.${model}` : "x", model, artefact: { artefactInhoud: { payloadHash: `${soort}-${model}` } } });
  const bronnen = [bron("edienstmodel"), bron("bpmn-bron", "a.json"), bron("bpmn-bron", "b.json")];
  const edienst = { artefacten: [{ soort: "bpmn", identifier: "p", bron: { model: "b.json" } }] };
  assert.deepEqual(bronnenVan({ soort: "bpmn", identifier: "p", bron: { model: "b.json" } }, edienst, bronnen).map((x) => x.identifier), ["x.b.json", "x"]);
  // De proceskoppeling leest het model van het proces met dezelfde identifier.
  assert.deepEqual(bronnenVan({ soort: "proceskoppeling", identifier: "p" }, edienst, bronnen).map((x) => x.identifier), ["x.b.json", "x"]);
  // De dossierstatussen lezen alle processen.
  assert.deepEqual(bronnenVan({ soort: "dossierstatussen", identifier: "d" }, edienst, bronnen).map((x) => x.identifier), ["x.a.json", "x.b.json", "x"]);
});

test("export: de bronbestanden staan vooraan in de zip en in het overzicht", async () => {
  const uit = await voerInrichtingsExportUit({
    edienst: lees("gpk-edienst.json"),
    modelBestand: lees("inrichten-domeinen-v3.json"),
    datatypen,
    referentieBestanden: [
      { naam: "aanvraag-aanvraagtypen.json", inhoud: lees("aanvraag-aanvraagtypen.json") },
      { naam: "relatiebeheer-verzoekpartijrollen.json", inhoud: lees("relatiebeheer-verzoekpartijrollen.json") },
    ],
    bpmnModellen: bpmnModellen(),
    peiltijdstip: "2026-11-05T12:00:00Z",
    sha256Hex,
  });
  assert.deepEqual(uit.bestanden.slice(0, 4).map((b) => b.naam), [
    "gehandicaptenparkeerkaart-aanvragen.edienstmodel.artefact.json",
    "gehandicaptenparkeerkaart-aanvragen.logisch-model.artefact.json",
    "gehandicaptenparkeerkaart-aanvragen.bpmn-bron.artefact.json",
    "gehandicaptenparkeerkaart-aanvragen.dmn-bron.artefact.json",
  ]);
  assert.match(uit.summary, /artefacten gemaakt; 4 bronnen\.$/);
  const overzicht = uit.bestanden.at(-1).inhoud;
  assert.match(overzicht, /## Bronnen/);
  assert.match(overzicht, /\| gehandicaptenparkeerkaart-aanvragen\.bpmn-bron\.artefact\.json \| bpmn-bron \|/);
  // Elk artefact in de zip verwijst naar bronnen die ook in de zip zitten.
  const bronHashes = new Set(uit.bronnen.map((b) => b.artefact.artefactInhoud.payloadHash));
  for (const r of uit.rijen) assert.ok(r.artefact.bronnen.length && r.artefact.bronnen.every((x) => bronHashes.has(x.payloadHash)));
});
