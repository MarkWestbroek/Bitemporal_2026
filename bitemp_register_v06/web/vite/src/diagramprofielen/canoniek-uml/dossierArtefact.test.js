// GZAC-dossierbundel van de GPK uit het model (cg-test, FUNDAMENT 30-10):
// documentdefinitie, samenvatting, taakformulier en tabbladen. De harde test
// is de handgemaakte bundel (fixtures/cg-test/gzac-handwerk, uit de
// Fundament-repo): structureel gelijk, niet byte-gelijk. Labels komen uit de
// veldnaam of de e-dienst, beschrijvingen en beperkingen uit het model.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";

import { maakObjecttypeArtefact } from "./objecttypeArtefact.js";
import { maakDossierArtefact, labelUitNaam } from "./dossierArtefact.js";
import { jcsHash } from "../../transformatie/jcs.js";

const lees = (naam) => JSON.parse(fs.readFileSync(new URL(`./fixtures/cg-test/${naam}`, import.meta.url), "utf8"));
const datatypen = JSON.parse(fs.readFileSync(new URL("../../../../../testdata/gegevenstypen.json", import.meta.url), "utf8")).datatypes;
const sha256Hex = (tekst) => crypto.createHash("sha256").update(tekst, "utf8").digest("hex");

const modelBestand = lees("omnium-model-cg-test-v3.json");
const objecttype = async (edienst) =>
  (await maakObjecttypeArtefact({ modelBestand, edienst, identifier: "gehandicaptenparkeerkaartaanvraag", datatypen, sha256Hex })).artefact;
const maak = async (identifier, soort, wijzig = (e) => e) => {
  const edienst = wijzig(lees("gpk-edienst.json"));
  return maakDossierArtefact({ modelBestand, edienst, identifier, soort, objecttype: await objecttype(edienst), peiltijdstip: "2026-10-30T12:00:00Z", sha256Hex });
};

/** Een form.io-formulier zonder labels: de vorm die gelijk moet zijn aan het handwerk. */
const zonderLabels = (x) =>
  Array.isArray(x) ? x.map(zonderLabels) : x && typeof x === "object" ? Object.fromEntries(Object.entries(x).filter(([k]) => k !== "label").map(([k, v]) => [k, zonderLabels(v)])) : x;
const componenten = (f) => {
  const uit = [];
  const loop = (cs) => cs.forEach((c) => (uit.push(c), loop(c.components || []), (c.columns || []).forEach((k) => loop(k.components))));
  loop(f.components);
  return uit;
};

test("labelUitNaam: camelCase naar een Nederlands label", () => {
  assert.equal(labelUitNaam("ingediendOp"), "Ingediend op");
  assert.equal(labelUitNaam("loopafstandMeter"), "Loopafstand meter");
  assert.equal(labelUitNaam("aanvraagnummer"), "Aanvraagnummer");
});

test("samenvatting: gelijk aan het handwerk op de labels na, alles alleen-lezen", async () => {
  const { artefact, diagnostics } = await maak("gehandicaptenparkeerkaart.summary", "dossierformulier");
  assert.deepEqual(diagnostics, []);
  const f = artefact.artefactInhoud.payload;
  assert.deepEqual(zonderLabels(f), zonderLabels(lees("gzac-handwerk/gehandicaptenparkeerkaart.summary.form.json")));
  const velden = componenten(f).filter((c) => c.input);
  assert.equal(velden.length, 10);
  assert.ok(velden.every((c) => c.disabled === true && !c.validate));
  assert.ok(!componenten(f).some((c) => c.type === "button"));
  // Velden rij voor rij over twee kolommen; type uit het model.
  const [links, rechts] = f.components[0].components[0].columns;
  assert.deepEqual(links.components.map((c) => c.key), ["aanvraagnummer", "status", "hulpmiddel", "kenteken", "eerderKaartnummer"]);
  assert.deepEqual(rechts.components.map((c) => [c.key, c.type]), [
    ["ingediendOp", "textfield"],
    ["soort", "textfield"],
    ["loopafstandMeter", "number"],
    ["eerdereKaart", "checkbox"],
    ["toelichting", "textarea"],
  ]);
  assert.equal(rechts.components[0].label, "Ingediend op");
  // Herkomst en trace: elk veld naar zijn modelknoop.
  assert.equal(artefact.artefactIdentificatie.soort, "dossierformulier");
  assert.equal(artefact.artefactInhoud.formaat, "formio-json");
  assert.equal(artefact.artefactInhoud.payloadHash, await jcsHash(f, sha256Hex));
  assert.equal(artefact.artefactInhoud.doelbestand, undefined);
  assert.equal(artefact.artefactHerkomst.regelsetId, "canoniek-naar-gzac-dossier");
  assert.equal(artefact.artefactHerkomst.schrijverId, "gzac-dossier-schrijver@0.1.0");
  const kenteken = artefact.traceregels.find((t) => t.doelPad === "/components/0/components/0/columns/0/components/3");
  assert.equal(kenteken.bronGE, "GehandicaptenparkeerkaartAanvraag.GpkAanvraagKaart.kenteken");
  assert.deepEqual(artefact.afhankelijkheden, [{ identifier: "gehandicaptenparkeerkaart", soort: "dossierschema", reden: "het formulier toont velden van de dossierinhoud" }]);
});

test("taakformulier aanvraag-beoordelen: samenvatting + behandelvelden + verzendknop", async () => {
  const { artefact, diagnostics } = await maak("aanvraag-beoordelen", "dossierformulier");
  assert.deepEqual(diagnostics, []);
  const f = artefact.artefactInhoud.payload;
  assert.deepEqual(zonderLabels(f), zonderLabels(lees("gzac-handwerk/aanvraag-beoordelen.form.json")));
  // De labels die de e-dienst opgeeft, ook van de keuzes.
  const [, beoordeling, knop] = f.components;
  assert.deepEqual(beoordeling.components[0].values, [
    { label: "Toekennen", value: "toegekend" },
    { label: "Afwijzen", value: "afgewezen" },
  ]);
  assert.deepEqual(beoordeling.components[0].validate, { required: true });
  assert.equal(beoordeling.components[1].disabled, undefined);
  assert.equal(knop.label, "Beoordeling vastleggen");
  assert.equal(knop.action, "submit");
  assert.equal(artefact.traceregels.find((t) => t.doelPad === "/components/1/components/0").bronGE, "e-dienst:behandelveld.beoordeling");
});

test("documentdefinitie: het objecttype zonder envelop plus behandelvelden, draft-07", async () => {
  const { artefact, diagnostics } = await maak("gehandicaptenparkeerkaart", "dossierschema");
  assert.deepEqual(diagnostics.map((d) => d.code), ["DOS-FORMAT"]);
  const s = artefact.artefactInhoud.payload;
  const hand = lees("gzac-handwerk/gehandicaptenparkeerkaart.schema.document-definition.json");
  assert.equal(s.$id, hand.$id);
  assert.equal(s.$schema, hand.$schema);
  assert.equal(s.title, hand.title);
  assert.deepEqual(Object.keys(s.properties).sort(), Object.keys(hand.properties).sort());
  for (const [k, v] of Object.entries(hand.properties)) assert.equal(s.properties[k].type, v.type, k);
  assert.deepEqual(s.properties.beoordeling.enum, ["toegekend", "afgewezen"]);
  // Bovenaan open (GZAC vult aan); beperkingen en beschrijvingen uit het model.
  assert.equal(s.additionalProperties, undefined);
  assert.deepEqual(s.required, ["aanvraagnummer", "aanvraagtype", "ingediendOp", "soort", "status"]);
  assert.deepEqual(s.properties.status.enum, ["ingediend", "gevalideerd", "afgekeurd", "afgehandeld"]);
  assert.equal(s.properties.ingediendOp.format, "date-time");
  // Geen formats buiten draft-07; het patroon blijft.
  assert.ok(!JSON.stringify(s).match(/"format":"(bsn|kenteken|int32|kvk-nummer|vestigingsnummer)"/));
  assert.equal(s.properties.kenteken.anyOf[1].pattern, "^[A-Z0-9]{1,3}-[A-Z0-9]{1,3}-[A-Z0-9]{1,3}$");
  assert.equal(artefact.traceregels.find((t) => t.doelPad === "/properties/soort").bronGE, "GehandicaptenparkeerkaartAanvraag.GpkAanvraagKaart.soort");
  assert.deepEqual(artefact.afhankelijkheden.map((a) => a.identifier), ["gehandicaptenparkeerkaartaanvraag"]);
});

test("tabbladen: de standaardtabbladen uit de regelset, gelijk aan het handwerk", async () => {
  const { artefact, diagnostics } = await maak("gehandicaptenparkeerkaart", "dossiertabbladen");
  assert.deepEqual(diagnostics, []);
  assert.deepEqual(artefact.artefactInhoud.payload, lees("gzac-handwerk/gehandicaptenparkeerkaart.case-tab.json"));
  assert.equal(artefact.artefactInhoud.formaat, "gzac-case-tab-json");
  // Zelfde identifier als het schema, maar niet diens afhankelijkheden.
  assert.deepEqual(artefact.afhankelijkheden, []);
});

test("toetsen: onbekend veld, behandelveld dat al in het model staat, geen objecttype", async () => {
  const metVeld = (e) => {
    e.artefacten.find((a) => a.identifier === "gehandicaptenparkeerkaart.summary").panelen[0].velden.push("bestaatNiet");
    e.artefacten.find((a) => a.soort === "dossierschema").behandelvelden.status = { type: "string" };
    return e;
  };
  const { diagnostics } = await maak("gehandicaptenparkeerkaart.summary", "dossierformulier", metVeld);
  assert.deepEqual(diagnostics.map((d) => d.code).sort(), ["DOS-BEHANDELVELD", "DOS-VELD"]);
  const zonder = await maakDossierArtefact({ modelBestand, edienst: lees("gpk-edienst.json"), identifier: "gehandicaptenparkeerkaart", soort: "dossierschema", sha256Hex });
  assert.deepEqual(zonder.diagnostics.map((d) => d.code), ["DOS-OBJECTTYPE"]);
  await assert.rejects(maakDossierArtefact({ modelBestand, edienst: lees("gpk-edienst.json"), identifier: "GPK", soort: "dossierschema", sha256Hex }));
});
