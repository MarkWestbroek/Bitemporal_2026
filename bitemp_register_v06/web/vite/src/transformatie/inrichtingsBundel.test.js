// De bundel geeft per artefact precies wat de CLI per artefact geeft (zelfde
// payloadHash), met het objecttype doorgegeven aan formulier en dossier.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";

import { maakInrichtingsBundel, artefactBestandsnaam } from "./inrichtingsBundel.js";
import { maakObjecttypeArtefact } from "../diagramprofielen/canoniek-uml/objecttypeArtefact.js";
import { maakFormulierArtefact } from "../diagramprofielen/canoniek-uml/formulierArtefact.js";
import { maakDossierArtefact } from "../diagramprofielen/canoniek-uml/dossierArtefact.js";

const lees = (naam) => JSON.parse(fs.readFileSync(new URL(`../diagramprofielen/canoniek-uml/fixtures/cg-test/${naam}`, import.meta.url), "utf8"));
const datatypen = JSON.parse(fs.readFileSync(new URL("../../../../testdata/gegevenstypen.json", import.meta.url), "utf8")).datatypes;
const sha256Hex = (tekst) => crypto.createHash("sha256").update(tekst, "utf8").digest("hex");

const invoer = () => ({
  modelBestand: lees("omnium-model-cg-test-v3.json"),
  edienst: lees("gpk-edienst.json"),
  datatypen,
  referentielijsten: { Aanvraagtype: lees("aanvraag-aanvraagtypen.json"), Partijrol: lees("relatiebeheer-partijrollen.json") },
  peiltijdstip: "2026-10-27T12:00:00Z",
  sha256Hex,
  bpmnModellen: { "gpk-processen.bpmn-model.json": lees("gpk-processen.bpmn-model.json"), "gpk-beslissingen.dmn-model.json": lees("gpk-beslissingen.dmn-model.json") },
});

test("bestandsnaam volgt de CLI", () => {
  assert.equal(artefactBestandsnaam({ soort: "objecttype", identifier: "aanvraag" }), "aanvraag.artefact.json");
  assert.equal(artefactBestandsnaam({ soort: "dossierschema", identifier: "gpk" }), "gpk.dossierschema.artefact.json");
});

test("GPK: alle artefacten in de volgorde van de e-dienst, zonder fouten", async () => {
  const bundel = await maakInrichtingsBundel(invoer());
  const e = lees("gpk-edienst.json");
  assert.deepEqual(bundel.map((b) => [b.soort, b.identifier]), e.artefacten.map((a) => [a.soort, a.identifier]));
  for (const b of bundel) {
    assert.equal(b.fout, null, `${b.soort} ${b.identifier}: ${b.fout}`);
    assert.match(b.artefact.artefactInhoud.payloadHash, /^[0-9a-f]{64}$/);
  }
  assert.equal(new Set(bundel.map((b) => b.bestandsnaam)).size, bundel.length, "bestandsnamen uniek");
});

test("GPK: zelfde payloadHash als de losse aanroepen (zoals de CLI met --objecttype)", async () => {
  const i = invoer();
  const bundel = await maakInrichtingsBundel(i);
  const hash = (soort, id) => bundel.find((b) => b.soort === soort && b.identifier === id).artefact.artefactInhoud.payloadHash;

  const ot = (await maakObjecttypeArtefact({ ...i, identifier: "gehandicaptenparkeerkaartaanvraag" })).artefact;
  assert.equal(hash("objecttype", "gehandicaptenparkeerkaartaanvraag"), ot.artefactInhoud.payloadHash);

  const frm = await maakFormulierArtefact({ ...i, identifier: "gehandicaptenparkeerkaart-aanvragen", objecttype: ot });
  assert.equal(hash("formulier", "gehandicaptenparkeerkaart-aanvragen"), frm.artefact.artefactInhoud.payloadHash);
  assert.ok(!frm.diagnostics.some((d) => d.code === "FRM-GEEN-REGISTRATIE"));

  const ds = await maakDossierArtefact({ ...i, identifier: "gehandicaptenparkeerkaart", soort: "dossierschema", objecttype: ot });
  assert.equal(hash("dossierschema", "gehandicaptenparkeerkaart"), ds.artefact.artefactInhoud.payloadHash);
  const df = await maakDossierArtefact({ ...i, identifier: "aanvraag-beoordelen", soort: "dossierformulier", objecttype: ot });
  assert.equal(hash("dossierformulier", "aanvraag-beoordelen"), df.artefact.artefactInhoud.payloadHash);
});

test("kies: alleen het formulier, het objecttype wordt wel gemaakt maar niet teruggegeven", async () => {
  const bundel = await maakInrichtingsBundel({ ...invoer(), kies: (k) => k.soort === "formulier" });
  assert.deepEqual(bundel.map((b) => b.soort), ["formulier"]);
  assert.ok(!bundel[0].diagnostics.some((d) => d.code === "FRM-GEEN-REGISTRATIE"));
});

test("een fout bij één artefact stopt de rest niet", async () => {
  const i = invoer();
  i.edienst.artefacten.push({ soort: "onbekend", identifier: "x" });
  const bundel = await maakInrichtingsBundel(i);
  const x = bundel.find((b) => b.identifier === "x");
  assert.match(x.fout, /Onbekende artefactsoort/);
  assert.equal(bundel.filter((b) => b.fout).length, 1);
});

// Op een lege omgeving mislukte de uitrol van de tabbladen: het zaaktype bestond nog niet
// (FUNDAMENT, cg-test 05-11). Wie naar een type verwijst, hangt af van het artefact dat het maakt.
test("ART-PLAATSHOUDER: een plaatshouder zonder afhankelijkheid geeft een waarschuwing", async () => {
  const { toetsPlaatshouders } = await import("./inrichtingsBundel.js");
  const artefact = (payload, afhankelijkheden) => ({ artefactInhoud: { payload }, afhankelijkheden });
  assert.deepEqual(toetsPlaatshouders(artefact({ url: "${ZAAKTYPE_URL:GPK}" }, [{ identifier: "GPK" }])), []);
  assert.deepEqual(toetsPlaatshouders(artefact("<x a='${OBJECTTYPE_URL:aanvraag}' b='${OBJECTTYPE_VERSION:aanvraag}'/>", [])).map((d) => d.code), ["ART-PLAATSHOUDER"]);
  // Rol- en statustype: het eerste deel is het zaaktype; het tweede is geen artefact.
  assert.deepEqual(toetsPlaatshouders(artefact({ rol: "${ROLTYPE_URL:GPK:initiator}", status: "${STATUSTYPE_URL:GPK:1}" }, [{ identifier: "GPK" }])), []);
  assert.match(toetsPlaatshouders(artefact({ rol: "${ROLTYPE_URL:GPK:initiator}" }, []))[0].message, /"GPK" \(\$\{ROLTYPE_URL:GPK:initiator\}\)/);
  // Omgevingsgegevens vragen geen afhankelijkheid; een andere kale naam is een geheim.
  assert.deepEqual(toetsPlaatshouders(artefact({ a: "${PLUGINCONFIG_ID:zakenapi}", b: "${ORGANISATIE_RSIN}", c: "${CATALOGUS_DOMEIN}" }, [])), []);
  assert.deepEqual(toetsPlaatshouders(artefact({ a: "${OPENZAAK_CLIENT_SECRET}" }, [])).map((d) => d.code), ["ART-GEHEIM"]);
  // Een expressie van de engine is geen plaatshouder.
  assert.deepEqual(toetsPlaatshouders(artefact("<f>${ontvankelijkheid.ontvankelijk}</f><g>${execution.getVariable('bsn')}</g>", [])), []);

  // De GPK-bundel: het formulier draagt plaatshouders naar het objecttype en heeft die afhankelijkheid.
  const bundel = await maakInrichtingsBundel(invoer());
  assert.match(JSON.stringify(bundel.find((b) => b.soort === "formulier").artefact.artefactInhoud.payload), /\$\{OBJECTTYPE_URL:gehandicaptenparkeerkaartaanvraag\}/);
  assert.deepEqual(bundel.flatMap((b) => b.diagnostics).filter((d) => d.code === "ART-PLAATSHOUDER"), []);
  const edienst = lees("gpk-edienst.json");
  edienst.afhankelijkheden = edienst.afhankelijkheden.filter((a) => a.artefact !== "gehandicaptenparkeerkaart-aanvragen");
  const zonder = await maakInrichtingsBundel({ ...invoer(), edienst });
  assert.deepEqual(zonder.find((b) => b.soort === "formulier").diagnostics.filter((d) => d.code === "ART-PLAATSHOUDER").length, 1);
});

test("de zaaktypekoppeling hangt af van het dossierschema en het zaaktype (volgorde op een lege omgeving)", async () => {
  const bundel = await maakInrichtingsBundel(invoer());
  const link = bundel.find((b) => b.soort === "dossierzaaktypelink");
  assert.equal(link.bestandsnaam, "gehandicaptenparkeerkaart.dossierzaaktypelink.artefact.json");
  assert.deepEqual(link.diagnostics, []); // ook geen ART-PLAATSHOUDER: de plaatshouder naar GPK heeft zijn afhankelijkheid
  assert.deepEqual(link.artefact.afhankelijkheden.map((a) => [a.identifier, a.soort]), [["gehandicaptenparkeerkaart", "dossierschema"], ["GPK", "zaaktype"]]);
  const tab = bundel.find((b) => b.soort === "dossiertabbladen").artefact;
  assert.deepEqual(tab.afhankelijkheden.map((a) => [a.identifier, a.soort]), [["gehandicaptenparkeerkaart", "dossierschema"]]);
});

// Een identifier is niet uniek over soorten; het register weigert een afhankelijkheid zonder
// soort als dubbelzinnig (FUNDAMENT 05-11). In de e-diensten noemt daarom elke afhankelijkheid de soort.
test("ART-AFHANKELIJKHEID: een afhankelijkheid zonder soort geeft een waarschuwing", async () => {
  const { toetsAfhankelijkheden } = await import("./inrichtingsBundel.js");
  const edienst = lees("gpk-edienst.json");
  assert.ok(edienst.afhankelijkheden.every((a) => a.soort && a.afhankelijkVanSoort), "elke afhankelijkheid in de GPK-e-dienst noemt beide soorten");
  assert.ok(lees("aanvraag-edienst.json").afhankelijkheden.every((a) => a.soort && a.afhankelijkVanSoort));
  const bundel = await maakInrichtingsBundel(invoer());
  assert.deepEqual(bundel.flatMap((b) => b.diagnostics).filter((d) => d.code === "ART-AFHANKELIJKHEID"), []);
  assert.ok(bundel.every((b) => b.artefact.afhankelijkheden.every((a) => a.soort)));

  const zonder = { afhankelijkheden: [{ identifier: "gehandicaptenparkeerkaart-beoordelen" }, { identifier: "GPK" }, { identifier: "GPK", soort: "zaaktype" }] };
  const meldingen = toetsAfhankelijkheden(zonder, edienst);
  assert.deepEqual(meldingen.map((d) => d.code), ["ART-AFHANKELIJKHEID", "ART-AFHANKELIJKHEID"]);
  assert.match(meldingen[0].message, /dubbelzinnig \(bpmn, proceskoppeling\)/);
  assert.doesNotMatch(meldingen[1].message, /dubbelzinnig/);
});
