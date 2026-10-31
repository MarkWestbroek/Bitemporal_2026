// Objecttypen uit het samengestelde model van cg-test (Fundament, 27-10):
// aanvraag v2 (partijen met rol) en de specialisatie
// GehandicaptenparkeerkaartAanvraag (erft Aanvraag). Regelset 0.4.0. De
// GPK-tests toetsen het schema zonder envelop (de modelprojectie); de envelop
// (verzoek, 0.4.0) heeft een eigen test.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";

import { maakObjecttypeArtefact } from "./objecttypeArtefact.js";

const lees = (naam) => JSON.parse(fs.readFileSync(new URL(`./fixtures/cg-test/${naam}`, import.meta.url), "utf8"));
const datatypen = JSON.parse(fs.readFileSync(new URL("../../../../../testdata/gegevenstypen.json", import.meta.url), "utf8")).datatypes;
const sha256Hex = (tekst) => crypto.createHash("sha256").update(tekst, "utf8").digest("hex");

const maak = (edienstBestand, identifier, wijzig = (e) => e) =>
  maakObjecttypeArtefact({
    modelBestand: lees("omnium-model-cg-test-v3.json"),
    edienst: wijzig(lees(edienstBestand)),
    identifier,
    datatypen,
    peiltijdstip: "2026-10-27T12:00:00Z",
    sha256Hex,
  });
const aanvraag = () => maak("aanvraag-edienst.json", "aanvraag");
const zonderEnvelop = (e) => {
  delete e.artefacten.find((a) => a.identifier === "gehandicaptenparkeerkaartaanvraag").projectie.envelop;
  return e;
};
const gpk = (wijzig = (e) => e) => maak("gpk-edienst.json", "gehandicaptenparkeerkaartaanvraag", (e) => wijzig(zonderEnvelop(e)));
const gpkMetEnvelop = () => maak("gpk-edienst.json", "gehandicaptenparkeerkaartaanvraag");

test("GPK met envelop verzoek: het schema van het model als data, voor de Verzoek-plugin van GZAC", async () => {
  const kaal = (await gpk()).artefact;
  const { artefact, diagnostics } = await gpkMetEnvelop();
  assert.deepEqual(diagnostics, []);
  const s = artefact.artefactInhoud.payload.jsonSchema;
  assert.equal(s.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(s.type, "object");
  assert.deepEqual(s.required, ["type", "data"]);
  assert.equal(s.additionalProperties, undefined);
  assert.deepEqual(Object.keys(s.properties), ["type", "bsn", "data", "attachments", "pdf_url"]);
  assert.equal(s.properties.type.const, "gehandicaptenparkeerkaart");
  assert.deepEqual(s.properties.attachments.items, { type: "string", format: "uri" });
  assert.equal(s.properties.pdf_url.format, "uri");
  // data = het schema zonder envelop, op $schema en title na.
  const { $schema, title, ...binnen } = kaal.artefactInhoud.payload.jsonSchema;
  assert.deepEqual(s.properties.data, binnen);
  assert.equal(s.title, title);
  // De trace schuift mee onder data; de envelopvelden hebben een eigen spoor.
  const pad = (a, bron) => a.traceregels.find((t) => t.bronGE === bron)?.doelPad;
  assert.equal(pad(artefact, "Aanvraag.AanvraagStatus.status"), "/jsonSchema/properties/data/properties/status");
  assert.equal(pad(kaal, "Aanvraag.AanvraagStatus.status"), "/jsonSchema/properties/status");
  assert.deepEqual(artefact.traceregels.filter((t) => t.bronGE?.startsWith("envelop:")).map((t) => t.doelPad), [
    "/jsonSchema/properties/type",
    "/jsonSchema/properties/bsn",
    "/jsonSchema/properties/data",
    "/jsonSchema/properties/attachments",
    "/jsonSchema/properties/pdf_url",
  ]);
});

test("aanvraag v2: partijen als lijst van {partijrol, partij}, zonder meldingen", async () => {
  const { artefact, diagnostics } = await aanvraag();
  assert.deepEqual(diagnostics, []);
  assert.equal(artefact.artefactHerkomst.regelsetVersie, "0.4.0");
  assert.equal(artefact.artefactIdentificatie.versienummer, "0.2.0");
  const s = artefact.artefactInhoud.payload.jsonSchema;
  assert.equal(s.properties.aanvrager, undefined);
  const item = s.properties.partijen.items;
  assert.equal(s.properties.partijen.type, "array");
  assert.deepEqual(item.required, ["partij", "partijrol"]);
  // Rol als code uit de referentielijst Partijrol.
  assert.deepEqual(item.properties.partijrol, { type: "string", description: "Rol van de partij bij deze aanvraag (referentielijst Partijrol)" });
  // De partij als de sleutels van haar "is"-GE's; geen ervan verplicht.
  assert.deepEqual(Object.keys(item.properties.partij.properties), ["bsn", "naam", "email", "kvkNummer", "vestigingsnummer", "klantUrl"]);
  assert.equal(item.properties.partij.required, undefined);
  assert.equal(item.properties.partij.additionalProperties, false);
  assert.equal(item.properties.partij.properties.bsn.anyOf[1].pattern, "^[0-9]{9}$");
  // De partijen zijn niet verplicht: het model kent geen kardinaliteit (bedrijfsregel).
  assert.deepEqual(s.required, ["aanvraagnummer", "aanvraagtype", "ingediendOp", "status"]);
});

test("aanvraag v2: trace van relatieveld, doel-object en opgegane GE's", async () => {
  const { artefact } = await aanvraag();
  const per = Object.fromEntries(artefact.traceregels.filter((t) => t.bronGE).map((t) => [t.bronGE, t]));
  assert.equal(per["Aanvraag.AanvraagPartij.partijrol"].doelPad, "/jsonSchema/properties/partijen/items/properties/partijrol");
  assert.equal(per["Aanvraag.AanvraagPartij.Partij"].doelPad, "/jsonSchema/properties/partijen/items/properties/partij");
  assert.equal(per["Aanvraag.AanvraagPartij.Partij.PartijNatuurlijkPersoon"].actie, "opgegaan");
  assert.equal(per["Aanvraag.AanvraagPartij.Partij.PartijZorgaanbieder"].actie, "weggelaten");
  assert.equal(per["Aanvraag.AanvraagPartij.Partij.PartijNatuurlijkPersoon.bsn"].doelPad, "/jsonSchema/properties/partijen/items/properties/partij/properties/bsn");
});

test("GPK: ouder en subtype in één schema", async () => {
  const { artefact, diagnostics } = await gpk();
  assert.deepEqual(diagnostics, []);
  const s = artefact.artefactInhoud.payload.jsonSchema;
  assert.equal(s.title, "GehandicaptenparkeerkaartAanvraag");
  assert.deepEqual(Object.keys(s.properties).sort(), [
    "aanvraagnummer", "aanvraagtype", "bijlagen", "eerderKaartnummer", "eerdereKaart", "hulpmiddel", "ingediendOp",
    "kenteken", "loopafstandMeter", "partijen", "rijbewijsnummer", "soort", "status", "toelichting",
  ]);
  assert.deepEqual(s.required, ["aanvraagnummer", "aanvraagtype", "ingediendOp", "soort", "status"]);
  assert.deepEqual(s.properties.soort.enum, ["bestuurder", "passagier", "instelling"]);
  assert.equal(s.properties.eerdereKaart.type, "boolean");
  assert.equal(s.properties.loopafstandMeter.type, "integer");
  assert.equal(s.properties.kenteken.anyOf[1].format, "kenteken");
  // Optioneel: ook "" (kenteken verborgen bij soort ≠ bestuurder; 0.3.0).
  assert.deepEqual(s.properties.kenteken.anyOf[0], { const: "" });
  assert.equal(artefact.artefactInhoud.payload.name, "gehandicaptenparkeerkaartaanvraag");
});

test("GPK: een geërfd veld is dezelfde modelknoop en property als in het objecttype aanvraag", async () => {
  const a = (await aanvraag()).artefact;
  const g = (await gpk()).artefact;
  const spoor = (art, id) => art.traceregels.find((t) => t.bronGE === id);
  for (const id of ["Aanvraag.AanvraagIdentificatie.aanvraagnummer", "Aanvraag.AanvraagPartij.partijrol", "Aanvraag.AanvraagBijlage.documentUrl"]) {
    assert.equal(spoor(g, id).doelPad, spoor(a, id).doelPad, id);
  }
  assert.deepEqual(g.artefactInhoud.payload.jsonSchema.properties.aanvraagnummer, a.artefactInhoud.payload.jsonSchema.properties.aanvraagnummer);
  assert.equal(spoor(g, "Aanvraag").actie, "opgegaan");
  assert.equal(spoor(g, "Aanvraag").regel, "Ouder (erft) → velden in het schema van het subtype");
});

test("GPK: twee keer toelichting botst; projectie.namen lost het op", async () => {
  const metIndiening = (e) => {
    e.artefacten[0].velden.push("Aanvraag.AanvraagIndiening.toelichting");
    return e;
  };
  const botsing = await gpk(metIndiening);
  assert.deepEqual(botsing.diagnostics.map((d) => d.code), ["JSN-DUBBEL"]);

  const hernoemd = await gpk((e) => {
    metIndiening(e).artefacten[0].projectie.namen = { "GehandicaptenparkeerkaartAanvraag.GpkAanvraagBeperking.toelichting": "beperkingToelichting" };
    return e;
  });
  assert.deepEqual(hernoemd.diagnostics, []);
  const p = hernoemd.artefact.artefactInhoud.payload.jsonSchema.properties;
  assert.equal(p.beperkingToelichting.description, "Toelichting van de aanvrager op de beperking");
  assert.equal(p.toelichting.description, "Toelichting van de aanvrager bij de aanvraag");
});

test("een onbekende ouder en een naam voor een onbekend pad worden gemeld", async () => {
  const model = lees("omnium-model-cg-test-v3.json");
  model.model.entiteiten.find((e) => e.typenaam === "GehandicaptenparkeerkaartAanvraag").erft = "Aanvraaag";
  const { diagnostics } = await maakObjecttypeArtefact({
    modelBestand: model,
    edienst: (() => {
      const e = lees("gpk-edienst.json");
      e.artefacten[0].velden = ["GehandicaptenparkeerkaartAanvraag.GpkAanvraagKaart.soort"];
      e.artefacten[0].projectie.namen = { "Bestaat.Niet": "x" };
      return e;
    })(),
    identifier: "gehandicaptenparkeerkaartaanvraag",
    datatypen,
    sha256Hex,
  });
  const meldingen = diagnostics.filter((d) => d.code === "V3-LEZER").map((d) => d.message);
  assert.ok(meldingen.some((m) => /erft van Aanvraaag/.test(m)));
  assert.ok(meldingen.some((m) => /Bestaat\.Niet/.test(m)));
});
