// Zaaktype GPK uit het aanvraagtype (M0) + de e-dienst (cg-test, 27-10).
// Regelset canoniek-naar-zaaktype 0.1.0; payload in het formaat van
// catalogi/<naam>.json (adapter openzaak-catalogus.ps1 van FUNDAMENT).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";

import { maakZaaktypeArtefact } from "./zaaktypeArtefact.js";
import { jcsHash } from "../../transformatie/jcs.js";

const lees = (naam) => JSON.parse(fs.readFileSync(new URL(`./fixtures/cg-test/${naam}`, import.meta.url), "utf8"));
const sha256Hex = (tekst) => crypto.createHash("sha256").update(tekst, "utf8").digest("hex");

const maak = (wijzig = (e) => e, referentielijsten = { Aanvraagtype: lees("aanvraag-aanvraagtypen.json") }) =>
  maakZaaktypeArtefact({
    modelBestand: lees("omnium-model-cg-test-v3.json"),
    edienst: wijzig(lees("gpk-edienst.json")),
    identifier: "GPK",
    referentielijsten,
    peiltijdstip: "2026-10-27T12:00:00Z",
    sha256Hex,
  });
const zaaktypeVan = (e) => e.artefacten.find((a) => a.identifier === "GPK");

test("GPK: identificatie en onderwerp uit het aanvraagtype, omschrijving uit de e-dienst", async () => {
  const { artefact, diagnostics } = await maak();
  assert.deepEqual(diagnostics, []);
  assert.deepEqual(artefact.artefactIdentificatie, { soort: "zaaktype", identifier: "GPK", naam: "Zaaktype Gehandicaptenparkeerkaart aanvragen", versienummer: "0.1.0" });
  assert.equal(artefact.artefactInhoud.formaat, "catalogi-api-json");
  assert.equal(artefact.artefactHerkomst.regelsetId, "canoniek-naar-zaaktype");
  assert.equal(artefact.artefactHerkomst.regelsetVersie, "0.1.0");
  assert.equal(artefact.doelcomponent, "openzaak");
  assert.deepEqual(artefact.afhankelijkheden, []);

  const p = artefact.artefactInhoud.payload;
  assert.deepEqual(Object.keys(p), ["catalogus", "informatieobjecttypen", "zaaktype"]);
  assert.equal(p.zaaktype.identificatie, "GPK");
  assert.equal(p.zaaktype.onderwerp, "Gehandicaptenparkeerkaart");
  assert.equal(p.zaaktype.omschrijving, "Gehandicaptenparkeerkaart aanvragen");
  // Toelichting (`_…`) gaat niet mee, ook niet genest.
  assert.equal(JSON.stringify(p).includes('"_'), false);
  // Volgnummers uit de volgorde.
  assert.deepEqual(p.zaaktype.statustypen.map((s) => [s.statustypevolgnummer, s.omschrijving]), [[1, "Ontvangen"], [2, "In behandeling"], [3, "Afgehandeld"]]);
  assert.deepEqual(p.zaaktype.informatieobjecttypen.map((i) => [i.volgnummer, i.omschrijving, i.richting]), [
    [1, "Aanvraagformulier", "inkomend"],
    [2, "Bijlage", "inkomend"],
    [3, "Beschikking", "uitgaand"],
  ]);
  assert.deepEqual(p.zaaktype.selectielijstProcestype, { jaar: 2020, nummer: 11 });
  assert.deepEqual(p.zaaktype.resultaattypen.map((r) => r.selectielijstklasse), ["11.1.1", "11.2", "11.3"]);

  const gezet = artefact.traceregels.filter((t) => t.actie === "gezet").map((t) => [t.bronGE, t.doelPad]);
  assert.deepEqual(gezet, [
    ["Aanvraagtype:gehandicaptenparkeerkaart.zaaktypeIdentificatie", "/zaaktype/identificatie"],
    ["Aanvraagtype:gehandicaptenparkeerkaart.omschrijving", "/zaaktype/onderwerp"],
    ["e-dienst.naam", "/zaaktype/omschrijving"],
  ]);
  assert.ok(artefact.traceregels.some((t) => t.doelPad === "/zaaktype/statustypen" && t.actie === "letterlijk"));
  assert.equal(artefact.artefactInhoud.payloadHash, await jcsHash(p, sha256Hex));
});

test("GPK: zonder register valt het aanvraagtype terug op het nieuwe item uit de e-dienst", async () => {
  const { artefact, diagnostics } = await maak(undefined, {});
  assert.deepEqual(diagnostics.map((d) => d.code), ["ZTT-NIEUW-ITEM"]);
  assert.equal(artefact.artefactInhoud.payload.zaaktype.identificatie, "GPK");
});

test("GPK: een onderwerp in de e-dienst gaat vóór; een afwijkende identificatie is een fout", async () => {
  const { artefact, diagnostics } = await maak((e) => {
    Object.assign(zaaktypeVan(e).zaaktype, { onderwerp: "Parkeren", identificatie: "GPK2" });
    return e;
  });
  assert.equal(artefact.artefactInhoud.payload.zaaktype.onderwerp, "Parkeren");
  assert.equal(artefact.artefactInhoud.payload.zaaktype.identificatie, "GPK");
  assert.deepEqual(diagnostics.map((d) => d.code), ["ZTT-AFWIJKING"]);
});

test("GPK: toetsen op bijlage, catalogus, initiator en selectielijst", async () => {
  const { diagnostics } = await maak((e) => {
    const z = zaaktypeVan(e);
    z.zaaktype.informatieobjecttypen = z.zaaktype.informatieobjecttypen.filter((i) => i.omschrijving !== "Bijlage");
    z.zaaktype.informatieobjecttypen.push({ omschrijving: "Medisch advies", richting: "inkomend" });
    z.zaaktype.roltypen = z.zaaktype.roltypen.filter((r) => r.omschrijvingGeneriek !== "initiator");
    delete z.zaaktype.resultaattypen[1].selectielijstklasse;
    return e;
  });
  assert.deepEqual(diagnostics.map((d) => [d.severity, d.code, d.sourceId]), [
    ["error", "ZTT-IOT", "Medisch advies"],
    ["error", "ZTT-BIJLAGE", "gehandicaptenparkeerkaart-aanvragen"],
    ["warning", "ZTT-INITIATOR", null],
    ["error", "ZTT-SELECTIELIJST", "Geweigerd"],
  ]);
});
