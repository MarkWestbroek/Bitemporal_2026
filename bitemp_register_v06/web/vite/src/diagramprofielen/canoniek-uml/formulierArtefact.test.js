// Formulier (Open Formulieren-export) uit het samengestelde model van cg-test
// en het e-dienstmodel: de GPK-aanvraag, en het aanvraagformulier tegen de
// golden file van FUNDAMENT. Regelset canoniek-naar-formulier 0.1.0.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";

import { valideerRegelset } from "../../transformatie/regels.js";
import { maakFormulierArtefact } from "./formulierArtefact.js";
import { CANONIEK_NAAR_FORMULIER } from "./formulierRegels.js";
import { maakObjecttypeArtefact, verschillen } from "./objecttypeArtefact.js";

const lees = (naam) => JSON.parse(fs.readFileSync(new URL(`./fixtures/${naam}`, import.meta.url), "utf8"));
const datatypen = JSON.parse(fs.readFileSync(new URL("../../../../../testdata/gegevenstypen.json", import.meta.url), "utf8")).datatypes;
const sha256Hex = (tekst) => crypto.createHash("sha256").update(tekst, "utf8").digest("hex");
const modelBestand = lees("cg-test/omnium-model-cg-test-v3.json");
const referentielijsten = { Aanvraagtype: lees("cg-test/aanvraag-aanvraagtypen.json") };

async function maak(edienstBestand, identifier, objecttypeId) {
  const edienst = lees(`cg-test/${edienstBestand}`);
  const objecttype = objecttypeId ? (await maakObjecttypeArtefact({ modelBestand, edienst, identifier: objecttypeId, datatypen, sha256Hex })).artefact : null;
  return maakFormulierArtefact({ modelBestand, edienst, identifier, datatypen, referentielijsten, objecttype, peiltijdstip: "2026-10-27T12:00:00Z", sha256Hex });
}
const gpk = () => maak("gpk-edienst.json", "gehandicaptenparkeerkaart-aanvragen", "gehandicaptenparkeerkaartaanvraag");
const componenten = (artefact) => artefact.artefactInhoud.payload["formDefinitions.json"].flatMap((d) => d.configuration.components);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test("de regelset is geldig", () => {
  assert.deepEqual(valideerRegelset(CANONIEK_NAAR_FORMULIER), []);
});

test("GPK: export met drie stappen, zonder meldingen, aansluitend op het objecttype", async () => {
  const { artefact, diagnostics, aansluiting } = await gpk();
  assert.deepEqual(diagnostics, []);
  const p = artefact.artefactInhoud.payload;
  assert.deepEqual(Object.keys(p).sort(), ["_meta.json", "formDefinitions.json", "formLogic.json", "formSteps.json", "formVariables.json", "forms.json"]);
  assert.equal(artefact.artefactInhoud.formaat, "openforms-export");
  assert.deepEqual(artefact.artefactHerkomst.regelsetId, "canoniek-naar-formulier");
  assert.equal(p["forms.json"][0].slug, "gehandicaptenparkeerkaart-aanvragen");
  assert.equal(p["forms.json"][0].login_required, true);
  assert.deepEqual(p["forms.json"][0].auth_backends, [{ backend: "digid", options: {} }]);
  assert.deepEqual(p["formSteps.json"].map((s) => s.slug), ["soort-kaart", "beperking", "pasfoto"]);
  // Stap en definitie hangen aan elkaar via de url; uuid's zijn deterministisch.
  p["formSteps.json"].forEach((s, i) => assert.equal(s.form_definition, p["formDefinitions.json"][i].url));
  assert.match(p["forms.json"][0].uuid, UUID);
  // Elke component, vaste waarde en inlogwaarde heeft een property in het objecttype.
  assert.ok(aansluiting.length === 15 && aansluiting.every((r) => r.objecttypePad));
  assert.deepEqual(artefact.afhankelijkheden, [{ identifier: "gehandicaptenparkeerkaartaanvraag", reden: "het formulier registreert in het objecttype" }]);
});

test("GPK: de vorm volgt uit de inhoud van het model", async () => {
  const per = Object.fromEntries(componenten((await gpk()).artefact).map((c) => [c.key, c]));
  assert.deepEqual(Object.fromEntries(Object.entries(per).map(([k, c]) => [k, c.type])), {
    soort: "radio", kenteken: "textfield", eerdereKaart: "checkbox", eerderKaartnummer: "textfield",
    loopafstandMeter: "number", hulpmiddel: "textfield", toelichting: "textarea", pasfoto: "file",
  });
  assert.deepEqual(per.soort.values.map((w) => w.value), ["bestuurder", "passagier", "instelling"]);
  assert.deepEqual(per.soort.validate, { required: true });
  // Lengte en patroon uit het datatype; tonen-als uit de e-dienst.
  assert.deepEqual(per.kenteken.validate, { maxLength: 11, pattern: "^[A-Z0-9]{1,3}-[A-Z0-9]{1,3}-[A-Z0-9]{1,3}$" });
  assert.deepEqual(per.kenteken.conditional, { show: true, when: "soort", eq: "bestuurder" });
  assert.deepEqual(per.eerderKaartnummer.conditional, { show: true, when: "eerdereKaart", eq: true });
  // Een vorm die de e-dienst noemt krijgt geen patroon van het datatype (URL).
  assert.deepEqual(per.pasfoto.validate, { required: true });
  // Het uploadveld met de volledige standaarddefinitie van de formulierbouwer
  // (de minimale liet de SDK vastlopen, inzending FUNDAMENT 27-10).
  assert.equal(per.pasfoto.fileMaxSize, "10MB");
  assert.equal(per.pasfoto.filePattern, "*");
  assert.deepEqual(per.pasfoto.file, { name: "", type: [], allowedTypesLabels: [] });
  assert.deepEqual(per.pasfoto.openForms, { softRequired: false, translations: {} });
  assert.equal(per.pasfoto.maxNumberOfFiles, null);
  assert.equal(per.pasfoto.storage, undefined);
  // Geen validate zonder keuze en zonder verplicht in het model.
  assert.equal(per.toelichting.validate, undefined);
});

test("GPK: inloggen verplicht op de eerste stapdefinitie", async () => {
  const p = (await gpk()).artefact.artefactInhoud.payload;
  assert.deepEqual(p["formDefinitions.json"].map((d) => d.login_required), [true, false, false]);
  assert.deepEqual(p["formSteps.json"].map((d) => d.login_required), [true, false, false]);
});

test("GPK: registratie naar Open Object met plaatshouders, uit de trace van het objecttype", async () => {
  const p = (await gpk()).artefact.artefactInhoud.payload;
  const [backend] = p["forms.json"][0].registration_backends;
  assert.equal(backend.backend, "objects_api");
  const o = backend.options;
  // Wat per omgeving verschilt vult de uitrol-adapter in (afspraak FUNDAMENT 27-10).
  assert.equal(o.objecttype, "${OBJECTTYPE_URL:gehandicaptenparkeerkaartaanvraag}");
  assert.equal(o.objecttype_version, "${OBJECTTYPE_VERSION:gehandicaptenparkeerkaartaanvraag}");
  assert.equal(o.objects_api_group, "${OBJECTS_API_GROUP}");
  assert.equal(o.version, 2);
  assert.equal(o.update_existing_object, false);
  // De BSN uit de inlog in de eerste partij; een lijst wordt het eerste item.
  assert.deepEqual(o.auth_attribute_path, ["partijen", 0, "partij", "bsn"]);
  const naar = Object.fromEntries(o.variables_mapping.map((m) => [m.variable_key, m.target_path]));
  assert.deepEqual(naar.kenteken, ["kenteken"]);
  assert.deepEqual(naar.pasfoto, ["bijlagen", 0, "documentUrl"]);
  assert.deepEqual(naar.vast_partijen_0_partijrol, ["partijen", 0, "partijrol"]);
  // Aanvraagnummer en indientijdstip uit Open Formulieren zelf (besluit Mark 27-10).
  assert.deepEqual(naar.public_reference, ["aanvraagnummer"]);
  assert.deepEqual(naar.now, ["ingediendOp"]);
  assert.equal(o.variables_mapping.length, 14);
  // Vaste waarden als gebruikersvariabelen met hun beginwaarde.
  assert.deepEqual(p["formVariables.json"].map((v) => [v.key, v.initial_value, v.source]), [
    ["vast_aanvraagtype", "gehandicaptenparkeerkaart", "user_defined"],
    ["vast_status", "ingediend", "user_defined"],
    ["vast_partijen_0_partijrol", "aanvrager", "user_defined"],
    ["vast_bijlagen_0_naam", "pasfoto", "user_defined"],
  ]);
});

test("GPK: trace van modelknoop naar component", async () => {
  const { artefact } = await gpk();
  const spoor = artefact.traceregels.find((t) => t.bronGE === "GehandicaptenparkeerkaartAanvraag.GpkAanvraagKaart.kenteken");
  assert.deepEqual(spoor, {
    bronGE: "GehandicaptenparkeerkaartAanvraag.GpkAanvraagKaart.kenteken",
    regel: "Overig → tekstveld",
    doelPad: "/formDefinitions.json/0/configuration/components/1",
    actie: "aangemaakt",
  });
  assert.equal(artefact.traceregels.filter((t) => t.actie !== "aangemaakt").length, 0);
  // De registratie staat ook in de trace.
  const bsn = artefact.traceregels.find((t) => t.regel === "Registratie: waarde uit de inlog (e-dienstmodel)");
  assert.deepEqual(bsn, {
    bronGE: "Aanvraag.AanvraagPartij.Partij.PartijNatuurlijkPersoon.bsn",
    regel: "Registratie: waarde uit de inlog (e-dienstmodel)",
    doelPad: "/forms.json/0/registration_backends/0/options/auth_attribute_path",
    actie: "aangemaakt",
  });
  const nummer = artefact.traceregels.find((t) => t.bronGE === "Aanvraag.AanvraagIdentificatie.aanvraagnummer");
  assert.equal(nummer.regel, "Registratie: variabele van Open Formulieren (e-dienstmodel)");
  assert.equal(nummer.doelPad, "/forms.json/0/registration_backends/0/options/variables_mapping/12");
});

test("deterministisch: twee keer genereren geeft dezelfde hash", async () => {
  assert.equal((await gpk()).artefact.artefactInhoud.payloadHash, (await gpk()).artefact.artefactInhoud.payloadHash);
});

test("aanvraagformulier: de toelichting bij de indiening zit niet in objecttype aanvraag", async () => {
  const { diagnostics, artefact } = await maak("aanvraag-edienst.json", "aanvraag-voorbeeld", "aanvraag");
  assert.deepEqual(diagnostics.map((d) => `${d.code} ${d.sourceId}`), ["FRM-AANSLUITING Aanvraag.AanvraagIndiening.toelichting"]);
  // Zonder property geen mapping: het gegeven gaat bij de registratie verloren.
  const mapping = artefact.artefactInhoud.payload["forms.json"][0].registration_backends[0].options.variables_mapping;
  assert.equal(mapping.find((m) => m.variable_key === "toelichting"), undefined);
});

test("aanvraagformulier (zonder registratie) tegen de golden file: precies deze verschillen", async () => {
  // Zonder objecttype: de golden file heeft ook geen registratie.
  const { artefact, diagnostics } = await maak("aanvraag-edienst.json", "aanvraag-voorbeeld", null);
  assert.deepEqual(diagnostics.map((d) => d.code), ["FRM-GEEN-REGISTRATIE"]);
  const zonderUuid = (x) => JSON.parse(JSON.stringify(x).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "<uuid>"));
  const ons = zonderUuid(artefact.artefactInhoud.payload);
  const doel = zonderUuid(Object.fromEntries(fs.readdirSync(new URL("./fixtures/openforms-export-aanvraag/", import.meta.url)).map((f) => [f, lees(`openforms-export-aanvraag/${f}`)])));
  const uit = [];
  for (const f of Object.keys(doel)) {
    const [a, b] = Array.isArray(ons[f]) ? [ons[f][0], doel[f][0]] : [ons[f], doel[f]];
    if (a?.configuration) {
      a.configuration.components.forEach((c, i) => uit.push(...verschillen(c, b.configuration.components[i]).map((v) => `${f} ${c.key}${v.pad}`)));
      delete a.configuration;
      delete b.configuration;
    }
    uit.push(...verschillen(a, b).map((v) => `${f} ${v.pad}`));
  }
  assert.deepEqual([...new Set(uit)].sort(), [
    // De export draagt een tijdstip en een commit; de schrijver niet (deterministisch).
    "_meta.json /created",
    "_meta.json /of_git_sha",
    // Keuzelijst uit het register in plaats van met de hand.
    "formDefinitions.json aanvraagtype/data/values",
    // Lengte en patroon uit de datatypen KorteTekst en Emailadres.
    "formDefinitions.json aanvragerEmail/validate/pattern",
    "formDefinitions.json aanvragerNaam/validate/maxLength",
    "formSteps.json aanvraagtype/data/values",
    "formSteps.json aanvragerEmail/validate/pattern",
    "formSteps.json aanvragerNaam/validate/maxLength",
  ]);
});
