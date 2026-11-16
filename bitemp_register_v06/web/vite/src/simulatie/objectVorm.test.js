/**
 * objectVorm: een object van de run als klein objectdiagram (16-11, ontwerp Simulatie §12.6).
 * Run: node --import ./test/register-aliases.mjs --test src/simulatie/objectVorm.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { maakCmBeelden, beeldVoor, cmVorm } from "./cmVorm.js";
import { objectVorm } from "./objectVorm.js";

const lees = (pad) => JSON.parse(fs.readFileSync(new URL(pad, import.meta.url), "utf8"));
const model = lees("../diagramprofielen/canoniek-uml/fixtures/cg-test/inrichten-domeinen-v3.json");
const edienst = lees("../diagramprofielen/canoniek-uml/fixtures/cg-test/gpk-edienst.json");
const sha256Hex = (t) => crypto.createHash("sha256").update(t, "utf8").digest("hex");
const aanvraag = () => structuredClone(lees("./fixtures/gpk-scenario-4.json").start.object);
const vormVan = async (plat, extra = {}) => {
  const beeld = beeldVoor(await maakCmBeelden({ model, edienst, sha256Hex }), "GehandicaptenparkeerkaartAanvraag");
  const { boom, problemen } = cmVorm(beeld, plat);
  return objectVorm(boom, { objectNaam: "aanvraag-1", fouten: problemen.filter((p) => p.ernst === "fout").map((p) => p.pad), ...extra });
};
const velden = (d) => Object.fromEntries(d.velden.map((v) => [v.naam, v.waarde]));

test("het hoofdobject: naam : Type, de enkelvoudige GE's van ouder en subtype genest, alleen velden met een waarde", async () => {
  const { objecten } = await vormVan(aanvraag());
  const hoofd = objecten[0];
  assert.equal(hoofd.kop, "aanvraag-1 : Gehandicaptenparkeerkaartaanvraag");
  assert.equal(hoofd.stereotype, "entiteit");
  // Aanvraag (ouder) en het subtype in één object; geen lege GE (GpkAanvraagBeperking), geen leeg veld (toelichting).
  assert.deepEqual(hoofd.secties.map((s) => s.naam), ["Aanvraagidentificatie", "Aanvraagindiening", "AanvraagAanvraagstatus", "AanvraagAanvraagtype", "GpkAanvraagKaart"]);
  assert.deepEqual(velden(hoofd.secties[1]), { ingediendOp: "2026-11-12T09:00:00Z" });
  assert.deepEqual(velden(hoofd.secties[4]), { soort: "passagier", eerdereKaart: false });
  // Een referentielijst binnen een GE is een waarde op het veld, met de omschrijving erbij.
  assert.deepEqual(hoofd.secties[3].velden, [{ naam: "type", waarde: "GPK", extra: "Gehandicaptenparkeerkaart", verplicht: true }]);
});

test("een meervoudig GE en een relatie zijn losse objecten met lijnen; het doel van de relatie is een eigen object", async () => {
  const plat = aanvraag();
  plat.bijlagen.push({ naam: "medische verklaring", documentUrl: "https://stub.example/documenten/2" });
  const { objecten, lijnen } = await vormVan(plat);
  const los = objecten.slice(1);
  assert.deepEqual(los.map((d) => [d.stereotype, d.kop, d.kolom]), [
    ["gegevenselement", ": Aanvraagbijlage", 1],
    ["gegevenselement", ": Aanvraagbijlage", 1],
    ["relatie", ": AanvraagPartij", 1],
    ["entiteit", ": Partij", 1],
  ]);
  assert.deepEqual(velden(los[1]), { naam: "medische verklaring", documentUrl: "https://stub.example/documenten/2" });
  assert.deepEqual(velden(los[2]), { partijrol: "aanvrager" });
  // Van de alternatieven van een Partij alleen wat er is.
  assert.deepEqual(los[3].secties.map((s) => [s.naam, velden(s)]), [["PartijNatuurlijkPersoon", { bsn: "999990019" }]]);
  assert.equal(los[3].inspring, true);
  assert.deepEqual(lijnen.map((l) => [l.van, l.soort, l.naar]), [
    ["hoofd", "compositie", "ge:Aanvraag.Aanvraagbijlage#0"],
    ["hoofd", "compositie", "ge:Aanvraag.Aanvraagbijlage#1"],
    ["hoofd", "relatie", "rel:Aanvraag.AanvraagPartij#0"],
    ["rel:Aanvraag.AanvraagPartij#0", "doel", "doel:Aanvraag.AanvraagPartij.Partij#0"],
  ]);
});

test("een verplicht veld zonder waarde blijft staan als fout; een gewijzigd veld is gemarkeerd; zonder bijlagen en partijen alleen het hoofdobject", async () => {
  const plat = aanvraag();
  delete plat.aanvraagnummer;
  plat.bijlagen = [];
  plat.partijen = [];
  const { objecten, lijnen } = await vormVan(plat, { gewijzigd: new Set(["soort"]) });
  assert.equal(objecten.length, 1);
  assert.deepEqual(lijnen, []);
  const [id, , , , kaart] = objecten[0].secties;
  assert.deepEqual(id.velden, [{ naam: "aanvraagnummer", waarde: undefined, verplicht: true, fout: true }]);
  assert.deepEqual(kaart.velden[0], { naam: "soort", waarde: "passagier", verplicht: true, gewijzigd: true });
  assert.deepEqual(objectVorm(null), { objecten: [], lijnen: [] });
});
