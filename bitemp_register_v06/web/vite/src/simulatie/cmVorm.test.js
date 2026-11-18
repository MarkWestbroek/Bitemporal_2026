// De aanvraag uit de simulatie in de cm-vorm (POC, Mark 14-11, ontwerp §11.7): de GPK-aanvraag
// van scenario 4 teruggelegd op het canonieke model van cg-test, met de toets op de state.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { maakCmBeelden, beeldVoor, cmVorm, doelSegmenten } from "./cmVorm.js";

const CG = new URL("../diagramprofielen/canoniek-uml/fixtures/cg-test/", import.meta.url);
const lees = (naam, basis = CG) => JSON.parse(fs.readFileSync(new URL(naam, basis), "utf8"));
const sha256Hex = (t) => crypto.createHash("sha256").update(t, "utf8").digest("hex");
const model = lees("inrichten-domeinen-v3.json");
const edienst = lees("gpk-edienst.json");
const aanvraag = () => structuredClone(lees("./fixtures/gpk-scenario-4.json", import.meta.url).start.object);
const beeld = async () => beeldVoor(await maakCmBeelden({ model, edienst, sha256Hex }), "GehandicaptenparkeerkaartAanvraag");

/** Zoek een knoop op zijn modelpad (id), door alle voorkomens heen. */
function vind(knoop, id) {
  if (knoop.id === id) return knoop;
  for (const v of knoop.voorkomens || []) for (const k of v) {
    const x = vind(k, id);
    if (x) return x;
  }
  return null;
}

test("doelSegmenten: properties en items, en de envelop (data) eraf", () => {
  assert.deepEqual(doelSegmenten("/jsonSchema/properties/partijen/items/properties/partij/properties/bsn"), ["partijen", "[]", "partij", "bsn"]);
  assert.deepEqual(doelSegmenten("/jsonSchema/properties/data/properties/status"), ["status"]);
  assert.equal(doelSegmenten(null), null);
});

test("de GPK-aanvraag: het type uit het scenario vindt het objecttype, ook met een andere hoofdletter", async () => {
  const b = await beeld();
  assert.equal(b.bron, "Gehandicaptenparkeerkaartaanvraag");
});

test("cm-vorm: entiteit met de ouder Aanvraag, GE's met hun velden, relaties met hun doel", async () => {
  const { boom, problemen } = cmVorm(await beeld(), aanvraag());
  assert.equal(boom.soort, "entiteit");
  assert.equal(boom.naam, "Gehandicaptenparkeerkaartaanvraag");
  // Een geërfd GE onder de ouder; het veld heeft de waarde uit het platte object.
  assert.equal(vind(boom, "Aanvraag").soort, "ouder");
  assert.equal(vind(boom, "Aanvraag.Aanvraagidentificatie.aanvraagnummer").waarde, "GPK-2026-0001");
  // Meervoudig GE: één voorkomen per bijlage.
  const bijlagen = vind(boom, "Aanvraag.Aanvraagbijlage");
  assert.equal(bijlagen.meervoudig, true);
  assert.equal(bijlagen.voorkomens.length, 1);
  assert.equal(bijlagen.voorkomens[0].find((k) => k.naam === "naam").waarde, "pasfoto");
  // Relatie met een veld (partijrol) en een doel (Partij) met zijn GE's.
  const partij = vind(boom, "Aanvraag.AanvraagPartij");
  assert.equal(partij.soort, "relatie");
  assert.equal(partij.voorkomens[0].find((k) => k.naam === "partijrol").waarde, "aanvrager");
  assert.equal(vind(partij, "Aanvraag.AanvraagPartij.Partij.PartijNatuurlijkPersoon.bsn").waarde, "999990019");
  // Een veld dat niet in het objecttype zit: onbekend, maar wel in de cm-vorm.
  const reden = vind(boom, "Aanvraag.AanvraagAanvraagstatus.reden");
  assert.equal(reden.inObjecttype, false);
  assert.equal(reden.waarde, undefined);
  // Een relatie die de e-dienst niet inbedt (komt tijdens de behandeling).
  const advies = vind(boom, "Gehandicaptenparkeerkaartaanvraag.GpkAanvraagMedischAdvies");
  assert.equal(advies.inObjecttype, false);
  assert.equal(advies.doel, "MedischAdvies");
  // Scenario 4 is een volledige aanvraag: geen fouten in de state.
  assert.deepEqual(problemen.filter((p) => p.ernst === "fout"), []);
});

test("toets: een verplicht veld leeg, en een relatie zonder bekend doel", async () => {
  const b = await beeld();
  const a = aanvraag();
  const verplicht = vind(cmVorm(b, a).boom, "Aanvraag.Aanvraagidentificatie.aanvraagnummer").verplicht;
  delete a.aanvraagnummer;
  a.partijen[0].partij = {};
  const { problemen } = cmVorm(b, a);
  const fouten = problemen.filter((p) => p.ernst === "fout").map((p) => `${p.pad}: ${p.melding}`);
  if (verplicht) assert.ok(fouten.includes("Gehandicaptenparkeerkaartaanvraag.Aanvraag.Aanvraagidentificatie.aanvraagnummer: verplicht veld zonder waarde"), fouten.join("\n"));
  assert.ok(fouten.some((f) => /AanvraagPartij\[0\]: relatie zonder bekend doel/.test(f)), fouten.join("\n"));
});

test("buiten het cm: velden op het object die nergens in het cm staan (behandelvelden)", async () => {
  const a = { ...aanvraag(), beoordeling: "toegekend", behandelaar: "medewerker-gpk-1" };
  const { buitenCm } = cmVorm(await beeld(), a);
  assert.deepEqual(buitenCm, { beoordeling: "toegekend", behandelaar: "medewerker-gpk-1" });
});

test("toets: de GE's van een Partij zijn alternatieven; een leeg alternatief is geen fout", async () => {
  const { problemen } = cmVorm(await beeld(), aanvraag());
  assert.ok(!problemen.some((p) => /PartijMaatschappelijkeActiviteit|PartijVestiging|PartijKlantverwijzing/.test(p.pad) && p.ernst === "fout"));
});

test("zonder e-dienstmodel (16-11): de structuur uit het cm, elk veld op zijn veldnaam, een meervoudig GE als lijst onder zijn meervoud", async () => {
  const { maakCmBeeldDirect } = await import("./cmVorm.js");
  assert.equal(maakCmBeeldDirect({ model, bron: "Bestaat niet" }), null);
  const direct = maakCmBeeldDirect({ model, bron: "gehandicaptenparkeerkaartaanvraag" }); // hoofdletters tellen niet
  assert.equal(direct.bron, "Gehandicaptenparkeerkaartaanvraag");
  const plat = {
    aanvraagnummer: "GPK-2026-0001",
    ingediendOp: "2026-11-12T09:00:00Z",
    status: "ingediend",
    soort: "passagier",
    eerdereKaart: false,
    aanvraagbijlagen: [{ naam: "pasfoto", documentUrl: "https://stub.example/documenten/1" }],
    beoordeling: "toegekend",
  };
  const { boom, problemen, buitenCm } = cmVorm(direct, plat);
  assert.equal(vind(boom, "Aanvraag.Aanvraagidentificatie.aanvraagnummer").waarde, "GPK-2026-0001");
  assert.equal(vind(boom, "Gehandicaptenparkeerkaartaanvraag.GpkAanvraagKaart.soort").waarde, "passagier");
  assert.equal(vind(boom, "Gehandicaptenparkeerkaartaanvraag.GpkAanvraagKaart.soort").inObjecttype, true);
  const bijlagen = vind(boom, "Aanvraag.Aanvraagbijlage");
  assert.equal(bijlagen.voorkomens.length, 1);
  assert.equal(bijlagen.voorkomens[0].find((k) => k.naam === "naam").waarde, "pasfoto");
  // Wat niet in het cm staat (een behandelveld) komt apart, zoals met een e-dienstmodel.
  assert.deepEqual(buitenCm, { beoordeling: "toegekend" });
  // De toets werkt: het verplichte type van de aanvraag ontbreekt hier.
  assert.ok(problemen.some((p) => p.ernst === "fout" && /verplicht veld zonder waarde/.test(p.melding)), JSON.stringify(problemen));
  assert.ok(!problemen.some((p) => /aanvraagnummer|ingediendOp/.test(p.pad)));
});
