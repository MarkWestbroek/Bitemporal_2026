// Het e-dienstformulier als FormulierDefinitie (§11.19, besluit Mark 10-11): de weg heen en terug
// geeft dezelfde stappen, en de export uit de FD dezelfde payloads als uit de e-dienst-JSON.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";

import { stappenNaarFd, fdNaarStappen, fdsUitProfiel } from "./fdFormulier.js";
import { layoutNaarFormulierModel, formulierModelNaarLayout } from "../diagramprofielen/formulier/adapter.js";
import { losInvoegingenOp } from "../shared/formulierInvoegen.js";
import { voerInrichtingsExportUit } from "./inrichtingsExport.js";
import { studioIdIndex } from "./bronArtefacten.js";
import { importeerV3 } from "../diagramprofielen/canoniek-uml/serialisatie.js";

const lees = (naam) => JSON.parse(fs.readFileSync(new URL(`../diagramprofielen/canoniek-uml/fixtures/cg-test/${naam}`, import.meta.url), "utf8"));
const datatypen = JSON.parse(fs.readFileSync(new URL("./gegevenstypen.snapshot.json", import.meta.url), "utf8")).datatypes;
const sha256Hex = (tekst) => crypto.createHash("sha256").update(tekst, "utf8").digest("hex");
const zonderToelichting = (o) => JSON.parse(JSON.stringify(o, (k, v) => (k.startsWith("_") ? undefined : v)));

const model = lees("inrichten-domeinen-v3.json");
const core = importeerV3(model);
const gpk = lees("gpk-edienst.json");
const formulier = gpk.artefacten.find((a) => a.soort === "formulier");

test("GPK: stappen → FD → stappen is gelijk", () => {
  const { layout, meta, diagnostics } = stappenNaarFd(formulier, { core, studioIds: studioIdIndex(core) });
  assert.deepEqual(diagnostics, []);
  assert.equal(meta.code, "gehandicaptenparkeerkaart-aanvragen");
  assert.deepEqual(layout.elementen.map((s) => [s.type, s.key]), [["stap", "soort-kaart"], ["stap", "beperking"], ["stap", "pasfoto"]]);
  // Kenteken en rijbewijsnummer onder één voorwaarde; een vinkje vergelijkt met true.
  const soort = layout.elementen[0].elementen;
  assert.deepEqual(soort.filter((e) => e.type === "conditioneel").map((c) => [c.conditie.waarde, c.dan.map((v) => v.key)]), [["bestuurder", ["kenteken", "rijbewijsnummer"]], [true, ["eerderKaartnummer"]]]);
  assert.match(soort[0].veld, /^Gehandicaptenparkeerkaartaanvraag\.[a-z_]+\.soort$/);
  assert.ok(soort[0].elementId);
  // De pasfoto: de bijlage met naam pasfoto, een lijst met één rij onder de eigenaar Aanvraag.
  const lijst = layout.elementen[2].elementen[0];
  assert.equal(lijst.type, "lijst");
  assert.equal(lijst.bron, "Aanvraag.aanvraagbijlagen");
  assert.deepEqual([lijst.min, lijst.max], [1, 1]);
  assert.deepEqual(lijst.elementen[0], { type: "veld", veld: "naam", vasteWaarde: "pasfoto" });
  assert.equal(lijst.elementen[1].vorm, "bestand");
  assert.deepEqual(lijst.elementen[1].vormConfig, { accept: ["image/jpeg", "image/png"], resizeTo: { width: 2000, height: 2000 } });

  const terug = fdNaarStappen(layout, { core, meta });
  assert.deepEqual(terug.diagnostics, []);
  assert.deepEqual(terug.stappen, zonderToelichting(formulier.stappen));
});

test("export uit de FD: dezelfde payloads als uit de e-dienst-JSON", async () => {
  const basis = {
    modelBestand: model,
    datatypen,
    referentieBestanden: [
      { naam: "aanvraag-aanvraagtypen.json", inhoud: lees("aanvraag-aanvraagtypen.json") },
      { naam: "relatiebeheer-verzoekpartijrollen.json", inhoud: lees("relatiebeheer-verzoekpartijrollen.json") },
    ],
    bpmnModellen: { "project:bpmnMotor05": lees("inrichten-bpmn.bpmn-model.json"), "gpk-beslissingen.dmn-model.json": lees("gpk-beslissingen.dmn-model.json") },
    peiltijdstip: "2026-10-27T12:00:00Z",
    sha256Hex,
  };
  const fd = stappenNaarFd(formulier, { core, studioIds: studioIdIndex(core) });
  const metFd = structuredClone(gpk);
  const f = metFd.artefacten.find((a) => a.soort === "formulier");
  delete f.stappen;
  f.formulierDefinitie = { model: "project:formulierdiagram", code: fd.meta.code };

  const oud = await voerInrichtingsExportUit({ ...basis, edienst: gpk });
  const nieuw = await voerInrichtingsExportUit({ ...basis, edienst: metFd, formulierDefinities: { [fd.meta.code]: fd } });
  const hashes = (r) => Object.fromEntries(r.rijen.map((x) => [`${x.soort}:${x.identifier}`, x.artefact?.artefactInhoud.payloadHash]));
  const h1 = hashes(oud);
  const h2 = hashes(nieuw);
  assert.deepEqual(Object.keys(h2), Object.keys(h1));
  for (const k of Object.keys(h1)) assert.equal(h2[k], h1[k], k);
  assert.ok(!nieuw.diagnostics.some((d) => /^FD-/.test(d.code)), JSON.stringify(nieuw.diagnostics.filter((d) => /^FD-/.test(d.code))));

  // Zonder de FD: een fout, niet stil een leeg formulier.
  const zonder = await voerInrichtingsExportUit({ ...basis, edienst: metFd });
  assert.ok(zonder.diagnostics.some((d) => d.code === "FD-ONTBREEKT"));
});

test("fdNaarStappen: wat het e-dienstformulier (nog) niet kent, wordt gemeld", () => {
  const studioIds = studioIdIndex(core);
  const { layout, meta } = stappenNaarFd(formulier, { core, studioIds });
  layout.elementen[0].elementen.push({ type: "conditioneel", conditie: { veld: "x", op: "!=", waarde: 1 }, dan: [] });
  layout.elementen[2].elementen[0].max = 5;
  const r = fdNaarStappen(layout, { core, meta });
  assert.deepEqual(r.diagnostics.map((d) => d.code).sort(), ["FD-CONDITIE", "FD-LIJST"]);
  assert.throws(() => fdNaarStappen({ type: "formulier", elementen: [{ type: "invoegen", formulier: "x" }] }, { core }), /invoegen/);
});

test("via het formulier-profiel (zoals in het project): FD → model → FD → stappen, met een ingevoegd sjabloon", () => {
  const { layout, meta } = stappenNaarFd(formulier, { core, studioIds: studioIdIndex(core) });
  // De pasfoto-stap als sjabloon dat het GPK-formulier invoegt.
  const pasfoto = layout.elementen.pop();
  const sjabloon = layoutNaarFormulierModel({ type: "formulier", elementen: [pasfoto] }, { naam: "Pasfoto", code: "sjabloon-pasfoto" });
  layout.elementen.push({ type: "invoegen", formulier: "sjabloon-pasfoto" });
  const gpk = layoutNaarFormulierModel(layout, meta);
  // Twee formulieren in één profiel; ids uniek maken zoals in het project.
  const her = (pre, m) => Object.fromEntries(Object.values(m.elements).map((e) => [pre + e.id, { ...e, id: pre + e.id, ...(e.source ? { source: pre + e.source, target: pre + e.target } : {}) }]));
  const profiel = { elements: { ...her("a_", gpk), ...her("b_", sjabloon) } };
  const fds = fdsUitProfiel(profiel, formulierModelNaarLayout);
  assert.deepEqual(Object.keys(fds).sort(), ["gehandicaptenparkeerkaart-aanvragen", "sjabloon-pasfoto"]);
  const zoek = (code) => fds[code]?.layout || null;
  const opgelost = losInvoegingenOp(fds[meta.code].layout, zoek, { code: meta.code });
  const terug = fdNaarStappen(opgelost, { core, meta: fds[meta.code].meta });
  assert.deepEqual(terug.diagnostics, []);
  assert.deepEqual(terug.stappen, zonderToelichting(formulier.stappen));
});
