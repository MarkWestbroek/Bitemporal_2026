// De exportstap zonder Studio: referentielijsten kiezen, bundel, register, zip-inhoud.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";

import { voerInrichtingsExportUit, verzamelReferentielijsten } from "./inrichtingsExport.js";

const lees = (naam) => JSON.parse(fs.readFileSync(new URL(`../diagramprofielen/canoniek-uml/fixtures/cg-test/${naam}`, import.meta.url), "utf8"));
const datatypen = JSON.parse(fs.readFileSync(new URL("./gegevenstypen.snapshot.json", import.meta.url), "utf8")).datatypes;
const sha256Hex = (tekst) => crypto.createHash("sha256").update(tekst, "utf8").digest("hex");
const bestanden = () => [
  { naam: "aanvraag-aanvraagtypen.json", inhoud: lees("aanvraag-aanvraagtypen.json") },
  { naam: "relatiebeheer-partijrollen.json", inhoud: lees("relatiebeheer-partijrollen.json") },
];

test("referentielijsten: bestand op naam, anders register, anders eersteVulling", async () => {
  const edienst = lees("aanvraag-edienst.json");
  const metBestand = await verzamelReferentielijsten(edienst, bestanden().slice(0, 1), null);
  assert.equal(metBestand.lijsten.Aanvraagtype.length, lees("aanvraag-aanvraagtypen.json").length);
  assert.match(metBestand.diagnostics[0].message, /aanvraag-aanvraagtypen\.json/);
  assert.match(metBestand.diagnostics[1].message, /eersteVulling/);

  const uitRegister = await verzamelReferentielijsten(edienst, [], async () => ({ items: [{ id: 1, partijrol_gegevens: [{ rel_id: 1, data: [{ versie: 1, code: "x" }] }] }] }));
  assert.deepEqual(uitRegister.lijsten.Partijrol, [{ code: "x" }]);

  const register404 = await verzamelReferentielijsten(edienst, [], async () => { throw new Error("401"); });
  assert.ok(register404.diagnostics.some((d) => d.severity === "warning" && /401/.test(d.message)));
});

test("GPK zonder register: zip met alle artefacten + overzicht", async () => {
  const uit = await voerInrichtingsExportUit({
    edienst: lees("gpk-edienst.json"),
    modelBestand: lees("omnium-model-cg-test-v3.json"),
    datatypen,
    referentieBestanden: bestanden(),
    bpmnModellen: { "gpk-processen.bpmn-model.json": lees("gpk-processen.bpmn-model.json"), "gpk-beslissingen.dmn-model.json": lees("gpk-beslissingen.dmn-model.json") },
    peiltijdstip: "2026-10-27T12:00:00Z",
    sha256Hex,
  });
  const n = lees("gpk-edienst.json").artefacten.length;
  assert.equal(uit.bestanden.length, n + 1);
  assert.ok(uit.bestanden.some((b) => b.naam === "gehandicaptenparkeerkaart.dossierschema.artefact.json"));
  assert.equal(uit.bestanden.at(-1).naam, "OVERZICHT.md");
  assert.match(uit.summary, new RegExp(`^${n} van ${n} artefacten gemaakt\\.$`));
  assert.equal(uit.registerGelezen, false);
  const ot = JSON.parse(uit.bestanden[0].inhoud);
  assert.deepEqual(Object.keys(ot).slice(0, 3), ["artefactIdentificatie", "artefactInhoud", "artefactHerkomst"]);
});

test("register onbereikbaar: wel de zip, met een waarschuwing", async () => {
  const uit = await voerInrichtingsExportUit({
    edienst: lees("aanvraag-edienst.json"),
    modelBestand: lees("omnium-model-cg-test-v3.json"),
    datatypen,
    referentieBestanden: bestanden(),
    haalJson: async () => { throw new Error("HTTP 401"); },
    sha256Hex,
  });
  assert.equal(uit.registerGelezen, false);
  assert.ok(uit.diagnostics.some((d) => d.code === "INR-REGISTER"));
  assert.ok(uit.bestanden.length >= 3);
});
