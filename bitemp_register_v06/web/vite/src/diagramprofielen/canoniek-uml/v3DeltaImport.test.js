// v3DeltaImport.test.js — V3 als delta in de canoniek-uml-store (31-10).
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/canoniek-uml/v3DeltaImport.test.js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createDiagramStore } from "../../diagramcore/model/createDiagramStore.js";
import { importeerV3, exporteerV3 } from "./serialisatie.js";
import { planV3Import, bouwV3ReviewBoom, metVolgendeVerbindingen, dubbeleNaampaden } from "./v3DeltaImport.js";
import { pasPlanToe, standaardKeuzes } from "../ea/vergelijkImport.js";

const CG_TEST = JSON.parse(fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "fixtures/cg-test/omnium-model-cg-test-v3.json"), "utf8"));
const kopie = () => JSON.parse(JSON.stringify(CG_TEST));

/** Een projectstore met het cg-test-model, een eigen diagram en Studio-eigen data. */
function projectStore() {
  const store = createDiagramStore();
  store.getState().laadModel(importeerV3(CG_TEST));
  const st = store.getState();
  st.addDiagram({ id: "eigen", diagramType: "canoniek-uml", naam: "Mijn GPK-view", nodes: [{ elementId: "Gehandicaptenparkeerkaart", position: { x: 10, y: 20 } }] });
  st.updateElementen({ Gehandicaptenparkeerkaart: { data: { verwijstNaar: "elders" } } });
  return store;
}

function pasToe(store, v3, kies = (k) => k) {
  const { model, plan, behoudData } = planV3Import(v3, store.getState());
  const aan = metVolgendeVerbindingen(plan, model, kies([...standaardKeuzes(plan).aan]));
  return { plan, uit: pasPlanToe(store.getState(), model, plan, { aan, behoudData }) };
}

test("dezelfde V3 opnieuw: niets nieuw, niets gewijzigd", () => {
  const store = projectStore();
  const { plan } = planV3Import(CG_TEST, store.getState());
  assert.equal(plan.elementen.nieuw.length, 0, JSON.stringify(plan.elementen.nieuw.slice(0, 3)));
  assert.deepEqual(plan.elementen.gewijzigd.map((r) => `${r.id}: ${r.verschillen}`), []);
  assert.equal(plan.diagrammen.nieuw.length, 0);
  assert.equal(plan.elementen.verdwenen.length, 0);
});

test("een gewijzigd veld en een nieuwe GE: alleen die, diagrammen en Studio-data blijven", () => {
  const store = projectStore();
  const v3 = kopie();
  const gpk = v3.model.entiteiten.find((e) => e.typenaam === "Gehandicaptenparkeerkaart");
  gpk.gegevenselementen[0].velden[0].description = "nieuw uitgelegd";
  gpk.gegevenselementen.push({ naam: "GpkOpmerking", meervoud: "gpk_opmerkingen", momentvoorkomen: "enkelvoudig", velden: [{ naam: "tekst", type: "string" }] });

  const { plan, uit } = pasToe(store, v3);
  const geId = `Gehandicaptenparkeerkaart_${gpk.gegevenselementen[0].naam}`;
  assert.deepEqual(plan.elementen.gewijzigd.map((r) => r.id), [geId]);
  assert.ok(plan.elementen.nieuw.some((r) => r.id === "Gehandicaptenparkeerkaart_GpkOpmerking"));
  assert.ok(uit.toegevoegd >= 2, "GE plus zijn compositie");

  const st = store.getState();
  assert.ok(st.elements.Gehandicaptenparkeerkaart_GpkOpmerking);
  assert.ok(Object.values(st.elements).some((e) => e.elementType === "compositie" && e.target === "Gehandicaptenparkeerkaart_GpkOpmerking"));
  assert.equal(st.diagrams.eigen?.naam, "Mijn GPK-view", "eigen diagram blijft");
  assert.equal(st.elements.Gehandicaptenparkeerkaart.data.verwijstNaar, "elders", "Studio-eigen data blijft");
  const { v3: terug } = exporteerV3(st);
  const veld = terug.model.entiteiten.find((e) => e.typenaam === "Gehandicaptenparkeerkaart").gegevenselementen[0].velden[0];
  assert.equal(veld.description, "nieuw uitgelegd");
});

test("verdwenen staat standaard uit en blijft binnen de domeinen van de import", () => {
  const store = projectStore();
  const v3 = kopie();
  v3.model.enums = v3.model.enums.filter((e) => e.goType !== "InrichtingLaag");
  const { plan } = planV3Import(v3, store.getState());
  assert.deepEqual(plan.elementen.verdwenen.filter((r) => r.elementType !== "bevat").map((r) => r.bestaandId), ["enum_InrichtingLaag"]);
  assert.ok(!standaardKeuzes(plan).aan.has("weg:enum_InrichtingLaag"));
  const boom = bouwV3ReviewBoom(plan, planV3Import(v3, store.getState()).model, store.getState());
  const blad = JSON.stringify(boom);
  assert.match(blad, /"status":"verdwenen"/);
  assert.match(blad, /"aan":false/);
});

test("uuid: een hernoemde entiteit is gewijzigd, niet verdwenen + nieuw", () => {
  const v3 = kopie();
  v3.model.entiteiten.find((e) => e.typenaam === "Product").uuid = "11111111-1111-4111-8111-111111111111";
  const store = createDiagramStore();
  store.getState().laadModel(importeerV3(v3));
  const hernoemd = JSON.parse(JSON.stringify(v3));
  hernoemd.model.entiteiten.find((e) => e.typenaam === "Product").typenaam = "Dienstproduct";
  const { plan } = planV3Import(hernoemd, store.getState());
  const r = plan.elementen.gewijzigd.find((x) => x.bestaandId === "Product");
  assert.ok(r, "Product → Dienstproduct herkend op uuid");
  assert.ok(r.verschillen.includes("naam"));
  assert.ok(!plan.elementen.verdwenen.some((x) => x.bestaandId === "Product"));
  // Zijn composities matchen op hun uiteinden (geen dubbele lijn), zijn GE's (zonder uuid) zijn nieuw.
  assert.ok(!plan.elementen.nieuw.some((x) => x.elementType === "compositie" && x.id.includes("Dienstproduct->Product_")));
});

test("lege store: het afgeleide Overzicht komt mee", () => {
  const store = createDiagramStore();
  const { plan } = planV3Import(CG_TEST, store.getState());
  assert.deepEqual(plan.diagrammen.nieuw.map((d) => d.id), ["overzicht"]);
});

test("dubbele naampaden worden gemeld", () => {
  const v3 = kopie();
  const ent = v3.model.entiteiten[0];
  ent.gegevenselementen.push({ ...ent.gegevenselementen[0] });
  assert.ok(dubbeleNaampaden(v3).some((m) => m.includes(`gegevenselement in ${ent.typenaam}`)));
  assert.deepEqual(dubbeleNaampaden(CG_TEST), []);
});

// ─────────────── uuid's: bedacht bij de export, daarna stabiel ───────────────
import { ontbrekendeUuids, vulUuids } from "./uuids.js";

test("vulUuids: elementen en velden krijgen een uuid; de export draagt ze en een tweede export is gelijk", () => {
  const store = createDiagramStore();
  store.getState().laadModel(importeerV3(CG_TEST));
  assert.ok(vulUuids(store) > 0);
  assert.equal(Object.keys(ontbrekendeUuids(store.getState())).length, 0, "tweede keer niets meer");
  const een = exporteerV3(store.getState()).v3;
  const ent = een.model.entiteiten.find((e) => e.typenaam === "Gehandicaptenparkeerkaart");
  assert.match(ent.uuid, /^[0-9a-f-]{36}$/);
  assert.match(ent.gegevenselementen[0].uuid, /^[0-9a-f-]{36}$/);
  assert.match(ent.gegevenselementen[0].velden[0].uuid, /^[0-9a-f-]{36}$/);
  assert.match(een.model.enums[0].uuid, /^[0-9a-f-]{36}$/);
  assert.deepEqual(exporteerV3(store.getState()).v3.model, een.model);
});

test("uuid's overleven V3 → Studio → V3, en een import zonder uuid matcht nog op id", () => {
  const store = createDiagramStore();
  store.getState().laadModel(importeerV3(CG_TEST));
  vulUuids(store);
  const metUuid = exporteerV3(store.getState()).v3;
  const terug = exporteerV3(importeerV3(metUuid)).v3;
  assert.deepEqual(terug.model.entiteiten.map((e) => e.uuid), metUuid.model.entiteiten.map((e) => e.uuid));
  // Het oude bestand (zonder uuid) opnieuw importeren: niets nieuw.
  const { plan } = planV3Import(CG_TEST, store.getState());
  assert.equal(plan.elementen.nieuw.length, 0);
});

test("uuid: een hernoemd veld houdt zijn eigenschappen", () => {
  const v3 = kopie();
  const ge = v3.model.entiteiten.find((e) => e.typenaam === "Gehandicaptenparkeerkaart").gegevenselementen[0];
  ge.velden[0].uuid = "22222222-2222-4222-8222-222222222222";
  ge.velden[0].description = "blijft";
  const core = importeerV3(v3);
  const geEl = Object.values(core.elements).find((e) => e.elementType === "gegevenselement" && e.naam === ge.naam);
  geEl.compartimenten.find((c) => c.compartmentType === "velden").velden[0].naam = "hernoemd";
  const uit = exporteerV3(core).v3.model.entiteiten.find((e) => e.typenaam === "Gehandicaptenparkeerkaart").gegevenselementen[0].velden[0];
  assert.equal(uit.naam, "hernoemd");
  assert.equal(uit.uuid, "22222222-2222-4222-8222-222222222222");
  assert.equal(uit.description, "blijft");
});
