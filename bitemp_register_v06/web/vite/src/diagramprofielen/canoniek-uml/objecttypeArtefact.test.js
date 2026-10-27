import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";

import { valideerRegelset } from "../../transformatie/regels.js";
import { maakObjecttypeArtefact, verschillen } from "./objecttypeArtefact.js";
import { CANONIEK_NAAR_OBJECTTYPE } from "./objecttypeRegels.js";

const lees = (naam) => JSON.parse(fs.readFileSync(new URL(`./fixtures/aanvraag/${naam}`, import.meta.url), "utf8"));
const datatypen = JSON.parse(fs.readFileSync(new URL("../../../../../testdata/gegevenstypen.json", import.meta.url), "utf8")).datatypes;
const sha256Hex = (tekst) => crypto.createHash("sha256").update(tekst, "utf8").digest("hex");

const maak = (opties = {}) =>
  maakObjecttypeArtefact({
    modelBestand: lees("aanvraag-domein-v3.json"),
    edienst: lees("aanvraag-edienst.json"),
    identifier: "aanvraag",
    datatypen,
    peiltijdstip: "2026-10-25T06:51:13Z",
    sha256Hex,
    ...opties,
  });

test("de regelset is geldig", () => {
  assert.deepEqual(valideerRegelset(CANONIEK_NAAR_OBJECTTYPE), []);
});

test("artefact in de vorm van het inrichting-register, zonder meldingen", async () => {
  const { artefact, diagnostics } = await maak();
  assert.deepEqual(diagnostics, []);
  assert.deepEqual(artefact.artefactIdentificatie, { soort: "objecttype", identifier: "aanvraag", naam: "Objecttype aanvraag", versienummer: "0.1.0" });
  assert.equal(artefact.artefactInhoud.formaat, "json-schema");
  assert.match(artefact.artefactInhoud.payloadHash, /^[0-9a-f]{64}$/);
  assert.deepEqual(artefact.artefactHerkomst, {
    regelsetId: "canoniek-naar-objecttype",
    regelsetVersie: "0.3.0",
    // Dezelfde hash als in het e-dienstmodel: JCS over het model-object.
    bronmodelHash: "5b5af637b7c7fac80e8ee9b947252b45f3f78cbc6ee1ecc61aa8d50f74ae4971",
    bronmodelVersie: "voorzet 2026-10-25 v3",
    schrijverId: "json-schema-schrijver@0.1.0",
    peiltijdstip: "2026-10-25T06:51:13Z",
  });
  assert.deepEqual(artefact.edienstversie, { edienst: "Aanvraag (voorbeeld)", versienummer: "0.1.0" });
  assert.equal(artefact.doelcomponent, "openobject");
  assert.deepEqual(artefact.afhankelijkheden, []);
});

test("het schema: selectie, ingebedde relatie, meervoudig GE, datatypen, enum, verwijzing als code", async () => {
  const { artefact } = await maak();
  const s = artefact.artefactInhoud.payload.jsonSchema;
  assert.equal(s.title, "Aanvraag");
  assert.equal(s.additionalProperties, false);
  assert.deepEqual(Object.keys(s.properties).sort(), ["aanvraagnummer", "aanvraagtype", "aanvrager", "bijlagen", "formulier", "ingediendOp", "status"]);
  // Niet geselecteerd → niet in het schema.
  for (const weg of ["toelichting", "reden"]) assert.equal(s.properties[weg], undefined);
  assert.equal(s.properties.aanvrager.properties.telefoonnummer, undefined);
  // Model-datatype en gedeelde bibliotheek.
  assert.deepEqual(s.properties.aanvraagnummer, { type: "string", description: "Uniek nummer dat de aanvraagservice toekent", pattern: "^[A-Z0-9-]+$", maxLength: 40 });
  // Optioneel met eisen: ook "" is geldig (0.3.0); verplicht (aanvraagnummer) niet.
  assert.deepEqual(s.properties.aanvrager.properties.klantUrl, {
    type: "string",
    description: "Verwijzing naar de partij in Open Klant",
    anyOf: [{ const: "" }, { format: "uri", pattern: "^https?://[^\\s]+$" }],
  });
  assert.equal(s.properties.ingediendOp.format, "date-time");
  // Enum uit het model; verwijzing naar de referentielijst als code, zonder enum.
  assert.deepEqual(s.properties.status.enum, ["ingediend", "gevalideerd", "afgekeurd", "afgehandeld"]);
  assert.deepEqual(s.properties.aanvraagtype, { type: "string", description: "Soort aanvraag (keuzelijst Aanvraagtype)" });
  // Relatie met doelKardinaliteit 1 → verplicht; required gesorteerd.
  assert.deepEqual(s.required, ["aanvraagnummer", "aanvraagtype", "aanvrager", "ingediendOp", "status"]);
  // Velden binnen het doel van een relatie zijn niet verplicht (0.2.0).
  assert.equal(s.properties.aanvrager.required, undefined);
  // Meervoudig GE → array van objecten met de meervoudsnaam.
  assert.deepEqual(s.properties.bijlagen.items.required, ["documentUrl", "naam"]);
  assert.equal(s.properties.bijlagen.items.additionalProperties, false);
  // Passthrough uit het e-dienstmodel, letterlijk.
  assert.equal(s.properties.formulier.additionalProperties, true);
});

test("trace: elke modelknoop met regel, actie en pad in het schema", async () => {
  const { artefact } = await maak();
  const per = Object.fromEntries(artefact.traceregels.map((t) => [t.bronGE ?? t.doelPad, t]));
  assert.deepEqual(per["Aanvraag.AanvraagAanvrager.Aanvrager.AanvragerNaam.naam"], {
    bronGE: "Aanvraag.AanvraagAanvrager.Aanvrager.AanvragerNaam.naam",
    regel: "Veld van het doel van een relatie → property, niet verplicht",
    doelPad: "/jsonSchema/properties/aanvrager/properties/naam",
    actie: "aangemaakt",
  });
  assert.equal(per["Aanvraag.AanvraagBijlage.documentUrl"].doelPad, "/jsonSchema/properties/bijlagen/items/properties/documentUrl");
  assert.equal(per["Aanvraag.AanvraagIndiening.toelichting"].actie, "weggelaten");
  assert.equal(per["Aanvraag.AanvraagAanvrager.Aanvrager.AanvragerContact.telefoonnummer"].actie, "weggelaten");
  assert.equal(per["Aanvraag.AanvraagIdentificatie"].actie, "opgegaan");
  assert.equal(per["/jsonSchema/properties/formulier"].actie, "letterlijk");
  assert.equal(artefact.traceregels.filter((t) => t.actie === "geen-regel" || t.actie === "overgeslagen").length, 0);
});

test("hash-toets tegen het handgemaakte objecttype: precies deze verschillen", async () => {
  const { artefact } = await maak();
  const verschil = verschillen(artefact.artefactInhoud.payload, lees("objecttype-handwerk.json")).map((v) => `${v.soort} ${v.pad}`);
  assert.deepEqual(verschil, [
    // Beschrijving van de relatie in het model ≠ tekst in het handgemaakte schema.
    "anders /jsonSchema/properties/aanvrager/description",
    // KorteTekst heeft maxLength 255 in de gedeelde bibliotheek.
    // Regelset 0.3.0: een optioneel veld met eisen mag ook leeg zijn.
    "alleen-gegenereerd /jsonSchema/properties/aanvrager/properties/email/anyOf",
    "alleen-doel /jsonSchema/properties/aanvrager/properties/email/format",
    "alleen-doel /jsonSchema/properties/aanvrager/properties/email/pattern",
    "alleen-gegenereerd /jsonSchema/properties/aanvrager/properties/klantUrl/anyOf",
    "alleen-doel /jsonSchema/properties/aanvrager/properties/klantUrl/format",
    "alleen-doel /jsonSchema/properties/aanvrager/properties/klantUrl/pattern",
    "alleen-gegenereerd /jsonSchema/properties/aanvrager/properties/naam/maxLength",
    // Regelset 0.2.0: een veld binnen het doel van een relatie is niet verplicht.
    "alleen-doel /jsonSchema/properties/aanvrager/required",
    "alleen-gegenereerd /jsonSchema/properties/bijlagen/items/properties/naam/maxLength",
    // required is een verzameling; de schrijver sorteert hem.
    "anders /jsonSchema/properties/bijlagen/items/required",
    "anders /jsonSchema/required",
  ]);
});

test("na het in lijn brengen van het handgemaakte schema is de hash gelijk", async () => {
  const { artefact } = await maak();
  const doel = lees("objecttype-handwerk.json");
  doel.jsonSchema.properties.aanvrager.description = "De partij die de aanvraag indient.";
  doel.jsonSchema.properties.aanvrager.properties.naam.maxLength = 255;
  doel.jsonSchema.properties.bijlagen.items.properties.naam.maxLength = 255;
  delete doel.jsonSchema.properties.aanvrager.required;
  for (const veld of ["email", "klantUrl"]) {
    const { format, pattern, ...rest } = doel.jsonSchema.properties.aanvrager.properties[veld];
    doel.jsonSchema.properties.aanvrager.properties[veld] = { ...rest, anyOf: [{ const: "" }, { format, pattern }] };
  }
  doel.jsonSchema.properties.bijlagen.items.required = ["documentUrl", "naam"];
  doel.jsonSchema.required = [...doel.jsonSchema.required].sort();
  const { jcsHash } = await import("../../transformatie/jcs.js");
  assert.equal(artefact.artefactInhoud.payloadHash, jcsHash(doel, sha256Hex));
});

test("een ander model dan in het e-dienstmodel en een onbekend pad worden gemeld", async () => {
  const model = lees("aanvraag-domein-v3.json");
  model.model.entiteiten[2].description += " (gewijzigd)";
  const edienst = lees("aanvraag-edienst.json");
  edienst.artefacten[0].velden.push("Aanvraag.AanvraagIdentificatie.bestaatNiet");
  const { diagnostics } = await maak({ modelBestand: model, edienst });
  assert.deepEqual(diagnostics.map((d) => d.code), ["ART-BRONMODEL", "V3-LEZER"]);
  assert.match(diagnostics[1].message, /bestaatNiet/);
});

test("deterministisch: twee keer genereren geeft dezelfde hash", async () => {
  const a = await maak();
  const b = await maak();
  assert.equal(a.artefact.artefactInhoud.payloadHash, b.artefact.artefactInhoud.payloadHash);
});
