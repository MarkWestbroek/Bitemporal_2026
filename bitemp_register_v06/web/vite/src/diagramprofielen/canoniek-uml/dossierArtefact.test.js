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

const modelBestand = lees("inrichten-domeinen-v3.json");
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

/** Het rijbewijsnummer (Mark 31-10) staat niet in het handwerk; het staat achteraan, dus de rest schuift niet. */
const zonderRijbewijs = (f) => JSON.parse(JSON.stringify(f, (k, v) => (Array.isArray(v) ? v.filter((c) => c?.key !== "rijbewijsnummer") : v)));

/** De samenvatting zoals in het handwerk: alleen het paneel Aanvraag met de elf velden van 30-10/31-10 (zonder aanvraagtype, partijen, bijlagen van 08-11). */
const alsHandwerk = (e) => {
  const sam = e.artefacten.find((a) => a.identifier === "gehandicaptenparkeerkaart.summary");
  sam.panelen = [{ ...sam.panelen[0], velden: sam.panelen[0].velden.filter((v) => typeof v === "string") }];
  // De keuze "aanvulling" (generiek behandelen, 08-11) staat niet in het handwerk.
  const beo = e.artefacten.find((a) => a.identifier === "aanvraag-beoordelen");
  const veld = beo.panelen.find((p) => p.key === "beoordelingPanel").velden.find((v) => v.key === "beoordeling");
  delete veld.opties.aanvulling;
  const schema = e.artefacten.find((x) => x.soort === "dossierschema");
  schema.behandelvelden = { ...schema.behandelvelden, beoordeling: { ...schema.behandelvelden.beoordeling, enum: ["toegekend", "afgewezen"] } };
  return e;
};

test("labelUitNaam: camelCase naar een Nederlands label", () => {
  assert.equal(labelUitNaam("ingediendOp"), "Ingediend op");
  assert.equal(labelUitNaam("loopafstandMeter"), "Loopafstand meter");
  assert.equal(labelUitNaam("aanvraagnummer"), "Aanvraagnummer");
});

test("samenvatting: gelijk aan het handwerk op de labels na, alles alleen-lezen", async () => {
  const { artefact, diagnostics } = await maak("gehandicaptenparkeerkaart.summary", "dossierformulier", alsHandwerk);
  assert.deepEqual(diagnostics, []);
  const f = artefact.artefactInhoud.payload;
  assert.deepEqual(zonderLabels(zonderRijbewijs(f)), zonderLabels(lees("gzac-handwerk/gehandicaptenparkeerkaart.summary.form.json")));
  const velden = componenten(f).filter((c) => c.input);
  assert.equal(velden.length, 11);
  assert.ok(velden.every((c) => c.disabled === true && !c.validate));
  assert.ok(!componenten(f).some((c) => c.type === "button"));
  // Velden rij voor rij over twee kolommen; type uit het model.
  const [links, rechts] = f.components[0].components[0].columns;
  assert.deepEqual(links.components.map((c) => c.key), ["aanvraagnummer", "status", "hulpmiddel", "kenteken", "eerderKaartnummer", "rijbewijsnummer"]);
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
  assert.equal(kenteken.bronGE, "Gehandicaptenparkeerkaartaanvraag.GpkAanvraagKaart.kenteken");
  assert.deepEqual(artefact.afhankelijkheden, [{ identifier: "gehandicaptenparkeerkaart", soort: "dossierschema", reden: "het formulier toont velden van de dossierinhoud" }]);
});

// Mark 08-11: de behandelaar ziet ook het aanvraagtype, de partijen en de bijlagen.
test("samenvatting met aanvraagtype, partijen en bijlagen: veld in een object en tabellen", async () => {
  const { artefact, diagnostics } = await maak("gehandicaptenparkeerkaart.summary", "dossierformulier");
  assert.deepEqual(diagnostics, []);
  const f = artefact.artefactInhoud.payload;
  const [aanvraag, partijen, bijlagen] = f.components;
  // Een veld in een object: container aanvraagtype met daarin omschrijving (data blijft genest).
  const type = aanvraag.components[0].columns[1].components[0];
  assert.deepEqual([type.type, type.key, type.hideLabel, type.disabled], ["container", "aanvraagtype", true, true]);
  assert.deepEqual([type.components[0].key, type.components[0].type, type.components[0].label], ["omschrijving", "textfield", "Aanvraagtype"]);
  const pt = partijen.components[0];
  assert.deepEqual([pt.type, pt.key, pt.disabled, pt.disableAddingRemovingRows], ["datagrid", "partijen", true, true]);
  assert.deepEqual(pt.components.map((c) => [c.type, c.key, c.label, c.disabled]), [["textfield", "partijrol", "Rol", true], ["container", "partij", "BSN", true]]);
  assert.deepEqual([pt.components[1].components[0].key, pt.components[1].components[0].hideLabel], ["bsn", true]);
  const bt = bijlagen.components[0];
  assert.deepEqual(bt.components.map((c) => c.key), ["naam"]); // geen documentUrl: zonder token onbruikbaar (INRICHTEN_VIZ 08-11)
  // Trace naar het model; het taakformulier neemt dezelfde panelen over.
  const trace = (pad) => artefact.traceregels.find((t) => t.doelPad === pad);
  assert.equal(trace("/components/1/components/0").regel, "Lijst van objecten: datagrid");
  assert.ok(trace("/components/2/components/0").bronGE);
  const taak = (await maak("aanvraag-beoordelen", "dossierformulier")).artefact.artefactInhoud.payload;
  assert.deepEqual(taak.components.slice(0, 3).map((p) => p.key), ["aanvraag", "partijenPanel", "bijlagenPanel"]);

  // Een object zelf of een kolom die niet bestaat wordt gemeld.
  const fout = await maak("gehandicaptenparkeerkaart.summary", "dossierformulier", (e) => {
    const sam = e.artefacten.find((a) => a.identifier === "gehandicaptenparkeerkaart.summary");
    sam.panelen = [{ key: "x", velden: ["aanvraagtype", { key: "bijlagen", kolommen: ["bestaatNiet"] }] }];
    return e;
  });
  assert.deepEqual(fout.diagnostics.map((d) => d.code), ["DOS-VELD", "DOS-VELD"]);
  assert.match(fout.diagnostics[0].message, /aanvraagtype.code/);
});

test("taakformulier aanvraag-beoordelen: samenvatting + behandelvelden + verzendknop", async () => {
  const { artefact, diagnostics } = await maak("aanvraag-beoordelen", "dossierformulier", alsHandwerk);
  assert.deepEqual(diagnostics, []);
  const f = artefact.artefactInhoud.payload;
  assert.deepEqual(zonderLabels(zonderRijbewijs(f)), zonderLabels(lees("gzac-handwerk/aanvraag-beoordelen.form.json")));
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
  // Het rijbewijsnummer (Mark 31-10) is nieuw ten opzichte van het handwerk.
  // Na het handwerk: de behandelvelden van het generieke behandelen (08-11).
  const nieuw = new Set(["rijbewijsnummer", "beschikkingToelichting", "afwijzingReden"]);
  assert.deepEqual(Object.keys(s.properties).filter((k) => !nieuw.has(k)).sort(), Object.keys(hand.properties).sort());
  assert.equal(s.properties.rijbewijsnummer.type, "string");
  // Het aanvraagtype is sinds 07-11 een relatie: een object {code, omschrijving} waar het handwerk een code had.
  for (const [k, v] of Object.entries(hand.properties)) assert.equal(s.properties[k].type, k === "aanvraagtype" ? "object" : v.type, k);
  assert.deepEqual(Object.keys(s.properties.aanvraagtype.properties), ["code", "omschrijving"]);
  assert.deepEqual(s.properties.beoordeling.enum, ["toegekend", "afgewezen", "aanvulling"]);
  // Bovenaan open (GZAC vult aan); beperkingen en beschrijvingen uit het model.
  assert.equal(s.additionalProperties, undefined);
  assert.deepEqual(s.required, ["aanvraagnummer", "aanvraagtype", "ingediendOp", "soort", "status"]);
  assert.deepEqual(s.properties.status.enum, ["ingediend", "inBehandeling", "nietInBehandeling", "afgehandeld"]);
  assert.equal(s.properties.ingediendOp.format, "date-time");
  // Geen formats buiten draft-07; het patroon blijft.
  assert.ok(!JSON.stringify(s).match(/"format":"(bsn|kenteken|int32|kvk-nummer|vestigingsnummer)"/));
  assert.equal(s.properties.kenteken.anyOf[1].pattern, "^[A-Z0-9]{1,3}-[A-Z0-9]{1,3}-[A-Z0-9]{1,3}$");
  assert.equal(artefact.traceregels.find((t) => t.doelPad === "/properties/soort").bronGE, "Gehandicaptenparkeerkaartaanvraag.GpkAanvraagKaart.soort");
  // Het objecttype (de inhoud) en de dossierdefinitie (de wortel van de bundel, FUNDAMENT 05-11).
  assert.deepEqual(artefact.afhankelijkheden.map((a) => [a.identifier, a.soort]), [["gehandicaptenparkeerkaartaanvraag", "objecttype"], ["gehandicaptenparkeerkaart", "dossierdefinitie"]]);
});

/** De e-dienst zonder de widgettabbladen van 08-11 (zoals het handwerk van 30-10). */
const zonderWidgets = (e) => ({ ...e, artefacten: e.artefacten.filter((a) => a.soort !== "dossierwidgettabbladen"), afhankelijkheden: e.afhankelijkheden.filter((a) => a.afhankelijkVanSoort !== "dossierwidgettabbladen") });

test("tabbladen: de standaardtabbladen uit de regelset, gelijk aan het handwerk", async () => {
  const { artefact, diagnostics } = await maak("gehandicaptenparkeerkaart", "dossiertabbladen", zonderWidgets);
  assert.deepEqual(diagnostics, []);
  assert.deepEqual(artefact.artefactInhoud.payload, lees("gzac-handwerk/gehandicaptenparkeerkaart.case-tab.json"));
  assert.equal(artefact.artefactInhoud.formaat, "gzac-case-tab-json");
  // Zelfde identifier als het schema, maar niet diens afhankelijkheden: alleen het dossier zelf.
  assert.deepEqual(artefact.afhankelijkheden.map((a) => [a.identifier, a.soort]), [["gehandicaptenparkeerkaart", "dossierschema"]]);
});

// Mark 08-11: een eigen tabblad Aanvraag met widgets. De vorm komt uit een met de hand
// ingericht proeftabblad op cg-test (INRICHTEN_VIZ, export van GZAC 13.50).
test("widgettabbladen: tabblad Aanvraag uit de dossierinhoud, in de vorm van het handwerk", async () => {
  const { artefact, diagnostics } = await maak("gehandicaptenparkeerkaart", "dossierwidgettabbladen");
  assert.deepEqual(diagnostics, []);
  const [tab] = artefact.artefactInhoud.payload;
  assert.deepEqual([tab.caseDefinitionKey, tab.caseDefinitionVersionTag, tab.key, tab.widgetLayout], ["gehandicaptenparkeerkaart", "1.0.0", "aanvraag", "MUURI_GAP_FREE"]);
  const [velden, partijen, bijlagen, foto] = tab.widgets;
  // Elk widget heeft dezelfde sleutels als in het handwerk.
  const hand = lees("gzac-handwerk/gehandicaptenparkeerkaart.case-widget-tab.json")[0];
  const sleutels = (o) => Object.keys(o).sort();
  assert.deepEqual(sleutels(tab), sleutels(hand));
  assert.deepEqual(sleutels(velden), sleutels(hand.widgets[0]));
  assert.deepEqual(sleutels(velden.properties.columns[0][0]), sleutels(hand.widgets[0].properties.columns[0][0]));
  assert.deepEqual(sleutels(bijlagen.properties), sleutels(hand.widgets[1].properties));
  // Velden kolom voor kolom; waarde = doc:/pad, een veld in een object met /; weergave uit het schema.
  assert.deepEqual(velden.properties.columns.map((k) => k.length), [6, 6]);
  const veld = (key) => velden.properties.columns.flat().find((v) => v.key === key);
  assert.deepEqual(veld("omschrijving"), { key: "omschrijving", title: "Aanvraagtype", value: "doc:/aanvraagtype/omschrijving", displayProperties: { type: "text", hideWhenEmpty: false } });
  assert.deepEqual(veld("loopafstandMeter"), hand.widgets[0].properties.columns[1][2]);
  assert.deepEqual(veld("eerdereKaart"), hand.widgets[0].properties.columns[0][2]);
  assert.deepEqual(veld("kenteken"), hand.widgets[0].properties.columns[1][0]);
  // Lijsten: kop uit titelVeld, velden relatief; geen documentUrl als link.
  assert.deepEqual(partijen.properties.collection, "doc:/partijen");
  assert.deepEqual(partijen.properties.title.value, "partijrol");
  assert.deepEqual(partijen.properties.fields.map((f) => [f.key, f.title, f.value]), [["bsn", "BSN", "partij/bsn"]]);
  assert.deepEqual([bijlagen.properties.collection, bijlagen.properties.title], ["doc:/bijlagen", hand.widgets[1].properties.title]);
  // documentUrl als tekst: daar leest het pasfoto-widget uit (bron), "link" toont GZAC 13.50 als ruwe HTML.
  assert.deepEqual(bijlagen.properties.fields.map((f) => [f.key, f.title, f.value, f.displayProperties.type]), [["naam", "Bijlage", "naam", "text"], ["documentUrl", "Document", "documentUrl", "text"]]);
  // Eigen widget (GZAC-WIDGET 08-11): componentKey + componentValue letterlijk; bron = de collection bijlagen.
  assert.deepEqual([foto.type, foto.key, foto.title, foto.width, foto.color], ["custom", "pasfoto", "Pasfoto", 1, "WHITE"]);
  assert.deepEqual(foto.properties, { componentKey: "documentAfbeeldingen", componentValue: { bijlagen: "/bijlagen", naam: "pasfoto", bron: "bijlagen" } });
  assert.ok(!JSON.stringify(tab).includes('"link"'));
  // Trace naar het model; het tabblad staat in de tabbladen na de samenvatting.
  const kenteken = artefact.traceregels.find((t) => t.regel.startsWith("Veld") && t.bronGE?.endsWith(".kenteken"));
  assert.equal(kenteken.bronGE, "Gehandicaptenparkeerkaartaanvraag.GpkAanvraagKaart.kenteken");
  const tabs = (await maak("gehandicaptenparkeerkaart", "dossiertabbladen")).artefact;
  assert.deepEqual(tabs.artefactInhoud.payload.map((t) => [t.key, t.type]).slice(0, 3), [["samenvatting", "standard"], ["aanvraag", "widgets"], ["documenten", "standard"]]);
  assert.equal(tabs.artefactInhoud.payload[1].contentKey, "aanvraag");
  assert.deepEqual(artefact.afhankelijkheden.map((a) => [a.identifier, a.soort]), [["gehandicaptenparkeerkaart", "dossierschema"]]);

  // Fouten: onbekend veld, geen lijst, onbekende widgetsoort.
  const fout = await maak("gehandicaptenparkeerkaart", "dossierwidgettabbladen", (e) => {
    const w = e.artefacten.find((a) => a.soort === "dossierwidgettabbladen");
    w.tabbladen = [{ key: "x", widgets: [{ type: "fields", key: "a", velden: ["bestaatNiet"] }, { type: "collection", key: "kenteken" }, { type: "image", key: "foto" }, { type: "collection", key: "bijlagen", titelVeld: "naam" }] }];
    return e;
  });
  // De laatste: een collection zonder velden, die GZAC weigert (uitrol 25).
  assert.deepEqual(fout.diagnostics.map((d) => d.code), ["DOS-VELD", "DOS-VELD", "DOS-WIDGET", "DOS-WIDGET"]);

  // Toetsen bij widgets: weergave per veld, component, pointer en bron.
  const metFoto = await maak("gehandicaptenparkeerkaart", "dossierwidgettabbladen", (e) => {
    const w = e.artefacten.find((a) => a.soort === "dossierwidgettabbladen");
    w.tabbladen[0].widgets.find((x) => x.key === "aanvraag").velden.push({ key: "kenteken", label: "Kenteken (link)", weergave: "link" });
    w.tabbladen[0].widgets.push({ type: "custom", key: "fout", waarden: { bijlagen: "/bestaatNiet", bron: "aanvraag" } });
    w.tabbladen[0].widgets.find((x) => x.key === "partijen").velden.push({ key: "partijrol", weergave: "plaatje" });
    return e;
  });
  // Een veld dat zelf een weergave kiest.
  const aanv = metFoto.artefact.artefactInhoud.payload[0].widgets.find((x) => x.key === "aanvraag");
  assert.equal(aanv.properties.columns.flat().filter((f) => f.title === "Kenteken (link)")[0].displayProperties.type, "link");
  // Onbekende weergave; geen component; pointer buiten de inhoud; bron "aanvraag" is een fields-widget.
  assert.deepEqual(metFoto.diagnostics.map((d) => d.code), ["DOS-WIDGET", "DOS-WIDGET", "DOS-VELD", "DOS-WIDGET"]);
});

// De koppeling dossier ↔ zaaktype was handwerk bij FUNDAMENT (zgw/zaak-type-link); nu uit de
// e-dienst, met plaatshouders voor wat de omgeving bepaalt (afspraak FUNDAMENT 05-11).
test("zaaktypekoppeling: zaaktype en zaakBijDossier uit de e-dienst, omgevingsgegevens als plaatshouder", async () => {
  const { artefact, diagnostics } = await maak("gehandicaptenparkeerkaart", "dossierzaaktypelink");
  assert.deepEqual(diagnostics, []);
  assert.deepEqual(artefact.artefactInhoud.payload, {
    zaakTypeUrl: "${ZAAKTYPE_URL:GPK}",
    zakenApiPluginConfigurationId: "${PLUGINCONFIG_ID:zakenapi}",
    createWithDossier: false,
    rsin: "${ORGANISATIE_RSIN}",
  });
  assert.equal(artefact.artefactInhoud.formaat, "gzac-zaak-type-link-json");
  assert.equal(artefact.artefactIdentificatie.soort, "dossierzaaktypelink");
  assert.equal(artefact.doelcomponent, "gzac");
  assert.deepEqual(artefact.afhankelijkheden.map((a) => [a.identifier, a.soort]), [["gehandicaptenparkeerkaart", "dossierschema"], ["GPK", "zaaktype"]]);
  assert.equal(artefact.traceregels.length, 4);

  const zonder = await maak("gehandicaptenparkeerkaart", "dossierzaaktypelink", (e) => {
    delete e.artefacten.find((a) => a.soort === "dossierzaaktypelink").zaaktype;
    return e;
  });
  assert.deepEqual(zonder.diagnostics.map((d) => [d.severity, d.code]), [["error", "DOS-ZAAKTYPE"]]);
  const extern = await maak("gehandicaptenparkeerkaart", "dossierzaaktypelink", (e) => {
    e.artefacten.find((a) => a.soort === "dossierzaaktypelink").zaaktype = "ANDERS";
    return e;
  });
  assert.deepEqual(extern.diagnostics.map((d) => [d.severity, d.code]), [["warning", "DOS-ZAAKTYPE"]]);
  assert.equal(extern.artefact.artefactInhoud.payload.zaakTypeUrl, "${ZAAKTYPE_URL:ANDERS}");
});

// Drie bestanden van de bundel die handwerk bij FUNDAMENT waren en geen modelkennis missen
// (Mark 05-11): alles staat in de e-dienst of is een sjabloon uit de regelset.
test("dossierdefinitie: sleutel, naam, versie en beschrijving uit de e-dienst; gelijk aan het handwerk op de beschrijving na", async () => {
  const { artefact, diagnostics } = await maak("gehandicaptenparkeerkaart", "dossierdefinitie");
  assert.deepEqual(diagnostics, []);
  const handwerk = lees("gzac-handwerk/gehandicaptenparkeerkaart.case-definition.json");
  const { description, ...rest } = artefact.artefactInhoud.payload;
  const { description: _oud, ...handwerkRest } = handwerk;
  assert.deepEqual(rest, handwerkRest);
  assert.deepEqual(Object.keys(artefact.artefactInhoud.payload), Object.keys(handwerk));
  assert.match(description, /^Dossier voor een aanvraag van een gehandicaptenparkeerkaart/);
  assert.equal(artefact.artefactInhoud.formaat, "gzac-case-definition-json");
  assert.deepEqual(artefact.afhankelijkheden, []); // de wortel van de bundel

  const eigen = await maak("gehandicaptenparkeerkaart", "dossierdefinitie", (e) => {
    const d = e.artefacten.find((a) => a.soort === "dossierdefinitie");
    delete d.versie;
    d.takenAutomatischToewijzen = true;
    return e;
  });
  assert.deepEqual(eigen.diagnostics.map((d) => [d.severity, d.code]), [["error", "DOS-VERSIE"]]);
  assert.equal(eigen.artefact.artefactInhoud.payload.autoAssignTasks, true);
});

test("dossierprocessen: elk bpmn-artefact van de e-dienst, gelijk aan het handwerk", async () => {
  const { artefact, diagnostics } = await maak("gehandicaptenparkeerkaart", "dossierprocessen");
  assert.deepEqual(diagnostics, []);
  // Het handwerk plus het generieke Aanvraag behandelen (08-11).
  assert.deepEqual(artefact.artefactInhoud.payload, [...lees("gzac-handwerk/gehandicaptenparkeerkaart.process-document-link.json"), { processDefinitionKey: "aanvraag-behandelen", canInitializeDocument: false, startableByUser: false }]);
  assert.deepEqual(artefact.afhankelijkheden.map((a) => [a.identifier, a.soort]), [
    ["gehandicaptenparkeerkaart", "dossierschema"],
    ["aanvraag-oppakken", "bpmn"],
    ["gehandicaptenparkeerkaart-beoordelen", "bpmn"],
    ["aanvraag-behandelen", "bpmn"],
  ]);

  const eigen = await maak("gehandicaptenparkeerkaart", "dossierprocessen", (e) => {
    e.artefacten.find((a) => a.soort === "dossierprocessen").processen = ["aanvraag-oppakken", "bestaat-niet"];
    return e;
  });
  assert.deepEqual(eigen.diagnostics.map((d) => d.code), ["DOS-PROCES"]);
  assert.deepEqual(eigen.artefact.artefactInhoud.payload.map((p) => p.processDefinitionKey), ["aanvraag-oppakken", "bestaat-niet"]);
});

test("documentkolommen: de standaardkolommen uit de regelset, gelijk aan het handwerk", async () => {
  const { artefact, diagnostics } = await maak("gehandicaptenparkeerkaart", "dossierdocumentkolommen");
  assert.deepEqual(diagnostics, []);
  assert.deepEqual(artefact.artefactInhoud.payload, lees("gzac-handwerk/gehandicaptenparkeerkaart.zgw-document-list-column.json"));
  const eigen = await maak("gehandicaptenparkeerkaart", "dossierdocumentkolommen", (e) => {
    e.artefacten.find((a) => a.soort === "dossierdocumentkolommen").kolommen = [{ key: "TITEL", sortering: "ASC" }];
    return e;
  });
  assert.deepEqual(eigen.artefact.artefactInhoud.payload, [{ key: "TITEL", defaultSort: "ASC" }]);
});

// De status van het dossier is de status van de aanvraag (Mark 05-11): een waarde uit de
// statuslijst van het model, die een taak in een proces zet. Was handwerk bij FUNDAMENT, met
// een eigen sleutel (niet-opgepakt).
test("dossierstatussen: de waarden uit de statuslijst die een proces zet", async () => {
  const bpmnModellen = { "project:bpmnMotor05": lees("inrichten-bpmn.bpmn-model.json") };
  const maakStatussen = async (wijzig = (e) => e, modellen = bpmnModellen) => {
    const edienst = wijzig(lees("gpk-edienst.json"));
    return maakDossierArtefact({ modelBestand, edienst, identifier: "gehandicaptenparkeerkaart", soort: "dossierstatussen", bpmnModellen: modellen, sha256Hex });
  };
  const { artefact, diagnostics } = await maakStatussen();
  assert.deepEqual(diagnostics, []);
  // Zelfde vorm als het handwerk, met de sleutel en titel uit het model en de twee velden die GZAC zelf invult.
  const handwerk = lees("gzac-handwerk/gehandicaptenparkeerkaart.internal-case-status.json");
  assert.deepEqual(artefact.artefactInhoud.payload, [{ ...handwerk[0], key: "niet-in-behandeling", title: "Niet in behandeling", retentionPeriodInDays: -1, label: null }]);
  assert.deepEqual(artefact.traceregels.map((t) => t.bronGE), ["Aanvraagstatus.nietInBehandeling"]);
  assert.equal(artefact.artefactInhoud.formaat, "gzac-internal-case-status-json");
  assert.deepEqual(artefact.afhankelijkheden.map((a) => [a.identifier, a.soort]), [["gehandicaptenparkeerkaart", "dossierschema"]]);

  // Een taak zet een status die de lijst niet kent.
  const fout = structuredClone(bpmnModellen);
  fout["project:bpmnMotor05"].model.elements.bp_status_niet_opgepakt.data.dossierstatus = "nietOpgepakt";
  assert.deepEqual((await maakStatussen((e) => e, fout)).diagnostics.map((d) => [d.severity, d.code]), [["error", "DOS-STATUS"]]);
  // Zonder BPMN-model is niet te zien wat de processen zetten.
  const zonder = await maakStatussen((e) => e, {});
  assert.deepEqual(zonder.diagnostics.map((d) => [d.severity, d.code]), [["warning", "DOS-STATUS"]]);
  assert.deepEqual(zonder.artefact.artefactInhoud.payload, []);
  // De e-dienst kiest zelf de waarden en de vormgeving.
  const eigen = await maakStatussen((e) => {
    Object.assign(e.artefacten.find((a) => a.soort === "dossierstatussen"), { waarden: ["inBehandeling", "afgehandeld"], statussen: { afgehandeld: { titel: "Klaar", kleur: "GREEN", zichtbaarInLijst: false } } });
    return e;
  }, {});
  assert.deepEqual(eigen.diagnostics, []);
  assert.deepEqual(eigen.artefact.artefactInhoud.payload.map((s) => [s.key, s.title, s.color, s.visibleInCaseListByDefault]), [
    ["in-behandeling", "In behandeling", "WARMGRAY", true],
    ["afgehandeld", "Klaar", "GREEN", false],
  ]);
  // Geen of een onbekende statuslijst.
  const lijst = async (naam) =>
    (await maakStatussen((e) => {
      const a = e.artefacten.find((x) => x.soort === "dossierstatussen");
      if (naam) a.statuslijst = naam;
      else delete a.statuslijst;
      return e;
    })).diagnostics.map((d) => d.code);
  assert.deepEqual(await lijst(null), ["DOS-STATUSLIJST"]);
  assert.deepEqual(await lijst("BestaatNiet"), ["DOS-STATUSLIJST"]);
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
