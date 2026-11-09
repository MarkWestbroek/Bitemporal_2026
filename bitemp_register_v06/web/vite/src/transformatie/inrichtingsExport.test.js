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
  { naam: "relatiebeheer-verzoekpartijrollen.json", inhoud: lees("relatiebeheer-verzoekpartijrollen.json") },
];

test("referentielijsten: bestand op naam, anders register, anders eersteVulling", async () => {
  const edienst = lees("aanvraag-edienst.json");
  const metBestand = await verzamelReferentielijsten(edienst, bestanden().slice(0, 1), null);
  assert.equal(metBestand.lijsten.Aanvraagtype.length, lees("aanvraag-aanvraagtypen.json").length);
  assert.match(metBestand.diagnostics[0].message, /aanvraag-aanvraagtypen\.json/);
  assert.match(metBestand.diagnostics[1].message, /eersteVulling/);

  // Na de rebuild van 08-11 (vorm volgens FUNDAMENT): items op /full/partijroldefinities,
  // lidmaatschap onder de items-REL (verzoekpartijrollen), instanties op
  // /full/referentielijsten/referentielijsten. Alleen de leden van de instantie komen mee.
  const gegevens = (code) => [{ rel_id: 1, data: [{ versie: 1, code: "oud" }, { versie: 2, code }] }];
  const lid = (lijst, extra = {}) => ({ rel_id: 1, referentielijst_id: lijst, aanvang: [{ versie: 1, datum: "2026-11-05" }], ...extra });
  const register = {
    "full/referentielijsten/referentielijsten": [
      { id: 1, referentielijstnamen: [{ rel_id: 1, data: [{ versie: 1, naam: "Aanvraagtypen" }] }] },
      { id: 2, referentielijstnamen: [{ rel_id: 1, data: [{ versie: 1, naam: "Verzoekpartijrollen" }] }] },
    ],
    "full/partijroldefinities": [
      { id: 1, partijrolgegevens: gegevens("aanvrager"), verzoekpartijrollen: [lid(2)] },
      { id: 2, partijrolgegevens: gegevens("anderelijst"), verzoekpartijrollen: [lid(3)] },
      { id: 3, partijrolgegevens: gegevens("geeindigd"), verzoekpartijrollen: [lid(2, { einde: [{ versie: 1, datum: "2026-11-06" }] })] },
      { id: 4, partijrolgegevens: gegevens("eindetotvandaag"), verzoekpartijrollen: [lid(2, { einde: [{ versie: 1, datum: "2026-11-07" }] })] },
      { id: 5, partijrolgegevens: gegevens("afgevoerd"), verzoekpartijrollen: [lid(2, { afvoer: "2026-11-06T10:00:00Z" })] },
      { id: 6, partijrolgegevens: gegevens("eindegecorrigeerd"), verzoekpartijrollen: [lid(2, { einde: [{ versie: 1, datum: "2026-11-06", afvoer: "2026-11-06T11:00:00Z" }] })] },
      { id: 7, partijrolgegevens: gegevens("nogniet"), verzoekpartijrollen: [lid(2, { aanvang: [{ versie: 1, datum: "2026-12-01" }] })] },
    ],
  };
  const haal = async (pad) => ({ items: register[pad.split("?")[0]] || [] });
  const metPeil = { ...edienst, referentielijsten: { Verzoekpartijrol: { ...edienst.referentielijsten.Verzoekpartijrol, peiltijdstip: "2026-11-07T12:00:00Z" } } };
  const uitRegister = await verzamelReferentielijsten(metPeil, [], haal);
  assert.deepEqual(uitRegister.lijsten.Verzoekpartijrol.map((x) => x.code), ["aanvrager", "eindetotvandaag", "eindegecorrigeerd"]); // einde is inclusief; een afgevoerd einde telt niet
  assert.match(uitRegister.diagnostics[0].message, /leden van Verzoekpartijrollen/);

  const register404 = await verzamelReferentielijsten(edienst, [], async () => { throw new Error("401"); });
  assert.ok(register404.diagnostics.some((d) => d.severity === "warning" && /401/.test(d.message)));
});

test("GPK zonder register: zip met alle artefacten + overzicht", async () => {
  const uit = await voerInrichtingsExportUit({
    edienst: lees("gpk-edienst.json"),
    modelBestand: lees("inrichten-domeinen-v3.json"),
    datatypen,
    referentieBestanden: bestanden(),
    bpmnModellen: { "project:bpmnMotor05": lees("inrichten-bpmn.bpmn-model.json"), "gpk-beslissingen.dmn-model.json": lees("gpk-beslissingen.dmn-model.json") },
    peiltijdstip: "2026-10-27T12:00:00Z",
    sha256Hex,
  });
  // De artefacten van de e-dienst plus de neutrale formulierbeschrijving (09-11).
  const n = lees("gpk-edienst.json").artefacten.length + 1;
  // De artefacten, het overzicht en de vier bronnen (e-dienstmodel, logisch model, processen, beslissingen).
  assert.equal(uit.bestanden.length, n + 1 + 4);
  assert.ok(uit.bestanden.some((b) => b.naam === "gehandicaptenparkeerkaart.dossierschema.artefact.json"));
  assert.equal(uit.bestanden.at(-1).naam, "OVERZICHT.md");
  assert.match(uit.summary, new RegExp(`^${n} van ${n} artefacten gemaakt; 4 bronnen\\.$`));
  assert.equal(uit.registerGelezen, false);
  const ot = JSON.parse(uit.bestanden.find((b) => b.naam === "gehandicaptenparkeerkaartaanvraag.artefact.json").inhoud);
  assert.deepEqual(Object.keys(ot).slice(0, 3), ["artefactIdentificatie", "artefactInhoud", "artefactHerkomst"]);
});

test("register onbereikbaar: wel de zip, met een waarschuwing", async () => {
  const uit = await voerInrichtingsExportUit({
    edienst: lees("aanvraag-edienst.json"),
    modelBestand: lees("inrichten-domeinen-v3.json"),
    datatypen,
    referentieBestanden: bestanden(),
    haalJson: async () => { throw new Error("HTTP 401"); },
    sha256Hex,
  });
  assert.equal(uit.registerGelezen, false);
  assert.ok(uit.diagnostics.some((d) => d.code === "INR-REGISTER"));
  assert.ok(uit.bestanden.length >= 3);
});

// Werkplaats (09-11): generatie aanwijsbaar (§5.6), modelvelden gekozen/weggelaten (§5.3),
// neutrale formulierbeschrijving (§5.8).
test("werkplaats: generatielabel in elke herkomst, modelvelden op het e-dienstmodel, formulier-neutraal", async () => {
  const basis = {
    edienst: lees("gpk-edienst.json"),
    modelBestand: lees("inrichten-domeinen-v3.json"),
    datatypen,
    referentieBestanden: bestanden(),
    bpmnModellen: { "project:bpmnMotor05": lees("inrichten-bpmn.bpmn-model.json"), "gpk-beslissingen.dmn-model.json": lees("gpk-beslissingen.dmn-model.json") },
    peiltijdstip: "2026-10-27T12:00:00Z",
    sha256Hex,
  };
  const zonder = await voerInrichtingsExportUit(basis);
  const uit = await voerInrichtingsExportUit({ ...basis, generatie: { label: "2026-11-09a", studioProjectId: "p-1", totVolgnummer: 4473 } });
  const json = (r) => r.bestanden.filter((b) => b.naam.endsWith(".json")).map((b) => [b.naam, JSON.parse(b.inhoud)]);

  // §5.6: elk artefact en elke bron, payloadHash ongewijzigd.
  const hashZonder = new Map(json(zonder).map(([n, a]) => [n, a.artefactInhoud.payloadHash]));
  for (const [naam, a] of json(uit)) {
    assert.deepEqual([a.artefactHerkomst.generatie, a.artefactHerkomst.studioProjectId, a.artefactHerkomst.totVolgnummer], ["2026-11-09a", "p-1", 4473], naam);
    assert.equal(a.artefactInhoud.payloadHash, hashZonder.get(naam), naam);
  }
  assert.ok(json(zonder).every(([, a]) => !("generatie" in a.artefactHerkomst)), "zonder generatie geen lege velden");
  assert.match(uit.bestanden.at(-1).inhoud, /Generatie: 2026-11-09a · Studio-project p-1 t\/m volgnummer 4473/);

  // §5.3: elk veld van het model, gekozen of weggelaten, met het Studio-id van zijn element.
  const ed = json(uit).find(([n]) => n.endsWith(".edienstmodel.artefact.json"))[1];
  const per = Object.fromEntries(ed.traceregels.map((t) => [t.bronGE, t]));
  assert.ok(ed.traceregels.length > 20);
  assert.ok(ed.traceregels.every((t) => ["gekozen", "weggelaten"].includes(t.actie) && t.bronElementId && t.doelPad.length <= 255));
  const kenteken = Object.values(per).find((t) => t.bronGE.endsWith("GpkAanvraagKaart.kenteken"));
  assert.equal(kenteken.actie, "gekozen");
  assert.deepEqual(kenteken.doelPad.split(", ").filter((x) => x === "formulier" || x === "objecttype"), ["formulier", "objecttype"]);
  assert.ok(ed.traceregels.some((t) => t.actie === "weggelaten"));
  // Een enumwaarde gaat mee met het gekozen veld van dat type.
  assert.ok(ed.traceregels.some((t) => t.regel === "modelwaarde" && t.actie === "gekozen"));

  // §5.8: de neutrale beschrijving naast het formulier.
  const nf = json(uit).find(([n]) => n === "gehandicaptenparkeerkaart-aanvragen.formulier-neutraal.artefact.json")[1];
  assert.equal(nf.artefactInhoud.formaat, "omnium-formulier-json");
  assert.equal(nf.doelcomponent, null);
  assert.deepEqual(nf.bronnen.map((b) => b.soort).sort(), ["edienstmodel", "logisch-model"]);
  const p = nf.artefactInhoud.payload;
  assert.equal(p.versie, "0.1");
  const frm = basis.edienst.artefacten.find((a) => a.soort === "formulier");
  assert.deepEqual(p.stappen.map((s) => s.key), frm.stappen.map((s) => s.slug));
  const vragen = Object.fromEntries(p.stappen.flatMap((s) => s.vragen).map((v) => [v.key, v]));
  assert.equal(vragen.soort.type, "keuze");
  assert.equal(vragen.soort.keuzeWeergave, "rondjes");
  assert.ok(vragen.soort.keuzes.length >= 2 && vragen.soort.keuzes.every((k) => "waarde" in k && "label" in k));
  assert.deepEqual(vragen.kenteken.voorwaarde, { vraag: "soort", gelijkAan: "bestuurder" });
  assert.deepEqual(vragen.eerderKaartnummer.voorwaarde, { vraag: "eerdereKaart", gelijkAan: true });
  assert.equal(vragen.eerdereKaart.type, "vinkje");
  assert.equal(vragen.rijbewijsnummer.verplicht, true);
  const bestand = Object.values(vragen).find((v) => v.type === "bestand");
  assert.ok(bestand?.bestand?.titel);
  // Optionele eigenschappen ontbreken, nooit null; bron.elementId = bronElementId van de traceregel.
  assert.ok(!JSON.stringify(p).includes("null"));
  for (const t of nf.traceregels.filter((t) => /^\/stappen\/\d+\/vragen\/\d+$/.test(t.doelPad))) {
    const [, i, j] = t.doelPad.match(/(\d+)\/vragen\/(\d+)/);
    assert.equal(p.stappen[+i].vragen[+j].bron.elementId, t.bronElementId, t.doelPad);
  }
});
