// sidecarImport.test.js — de EA-import zonder browser: stand uit snapshot + ops,
// import als operaties, idempotent bij herhaling, batches binnen de api-grenzen.
// Run: node --import ./test/register-aliases.mjs --test src/diagramprofielen/ea/sidecarImport.test.js

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { maakStand, speelOpsNa, importeerInStand, bouwBatches, splitsPatch, bouwWerkbestand } from "./sidecarImport.js";
import { mapPadPlan, plaatsEaInProjectboomPlan } from "./eaProjectboom.js";
import { maakStructuurStore } from "../../studio/sync/structuurKern.js";

const hier = dirname(fileURLToPath(import.meta.url));
const fixture = (naam) => JSON.parse(readFileSync(join(hier, "fixtures", naam), "utf8"));
const DIENST = 327; // "Dienstverlening / Diagram / LayedOut" (MIM)

/** Speel de operaties van een import af op een verse stand (zoals een Studio-client dat doet). */
function standNa(werkbestand, ops) {
  const stand = maakStand(werkbestand);
  const r = speelOpsNa(stand, ops.map((o, i) => ({ ...o, volgnummer: i + 1 })));
  assert.deepEqual(r.problemen, []);
  return stand;
}

test("lege server + Dienstverlening: elementen, diagrammen en de EA-boom als operaties", () => {
  const bron = fixture("dienstverlening.qea.json");
  const stand = maakStand({});
  const { ops, verslag } = importeerInStand(stand, bron, { packageId: DIENST, doelPad: "Import / GGM" });
  // De fixture is een uitsnede (2 van de 6 diagrammen van LayedOut).
  const nDi = bron.t_diagram.length, nEl = verslag.profielen.MIM.elementen;
  assert.equal(verslag.profielen.MIM.diagrammen, nDi);
  assert.ok(nEl >= 50);
  assert.ok(verslag.mappenNieuw >= 3, "Import, GGM en LayedOut");
  assert.ok(verslag.plaatsingen >= nDi);
  const soorten = ops.map((o) => `${o.store}/${o.op}`);
  assert.ok(soorten.includes("structuur/nieuweMappen"));
  assert.ok(soorten.includes("model:mim05/patchElementen"));
  assert.ok(soorten.includes("model:mim05/patchDiagrammen"));
  assert.ok(soorten.includes("structuur/plaatsPerMap"));
  // Elementen vóór diagrammen binnen een profiel.
  assert.ok(soorten.indexOf("model:mim05/patchElementen") < soorten.indexOf("model:mim05/patchDiagrammen"));

  // Een Studio-client die de operaties toepast komt op dezelfde stand uit.
  const ander = standNa({}, ops);
  const mim = ander.modellen.get("mim05").getState();
  assert.equal(Object.keys(mim.elements).length, nEl);
  assert.equal(Object.keys(mim.diagrams).length, nDi);
  const s = ander.structuur.getState();
  const namen = Object.values(s.mappen).map((m) => m.naam);
  assert.ok(namen.includes("Import") && namen.includes("GGM") && namen.includes("LayedOut"));
  const layedOut = Object.values(s.mappen).find((m) => m.naam === "LayedOut");
  const ggm = Object.values(s.mappen).find((m) => m.naam === "GGM");
  assert.equal(layedOut.ouderId, ggm.id, "het EA-pakket onder de doelmap");
  assert.ok(Object.values(s.plaatsing).filter((m) => m === layedOut.id).length >= nDi, "diagrammen in de pakketmap");
});

test("idempotent: dezelfde import op de stand ná de operaties geeft niets", () => {
  const bron = fixture("dienstverlening.qea.json");
  const { ops, verslag } = importeerInStand(maakStand({}), bron, { packageId: DIENST, doelPad: "Import / GGM" });
  const stand2 = standNa({}, ops);
  const tweede = importeerInStand(stand2, bron, { packageId: DIENST, doelPad: "Import / GGM" });
  assert.equal(tweede.ops.length, 0, JSON.stringify(tweede.ops.map((o) => o.op)));
  assert.equal(tweede.verslag.profielen.MIM.ongewijzigd, verslag.profielen.MIM.elementen + verslag.profielen.MIM.diagrammen);
  assert.equal(tweede.verslag.mappenNieuw, 0);
});

test("stand uit een snapshot (werkbestand v3) + operaties erna; verdwenen alleen op verzoek", () => {
  const bron = fixture("dienstverlening.qea.json");
  const { ops } = importeerInStand(maakStand({}), bron, { packageId: DIENST });
  const vol = standNa({}, ops);
  const mim = vol.modellen.get("mim05").getState();
  const werkbestand = {
    formaat: "studio-project", versie: 3, project: { id: "p1", naam: "T" },
    structuur: { mappen: vol.structuur.getState().mappen, plaatsing: vol.structuur.getState().plaatsing, plaatsingVolgorde: Object.keys(vol.structuur.getState().plaatsing) },
    profielen: { mim05: { diagramTypeId: mim.diagramTypeId, elements: mim.elements, diagrams: mim.diagrams, actiefDiagramId: mim.actiefDiagramId, meta: mim.meta } },
  };
  // Een Studio-client voegde daarna een eigen element toe en hernoemde een EA-element.
  const eersteId = Object.keys(mim.elements).find((id) => !mim.elements[id].source);
  const later = [
    { volgnummer: 1, store: "model:mim05", op: "addElement", args: [{ id: "eigen-1", elementType: mim.elements[eersteId].elementType, naam: "Eigen", data: {} }] },
    { volgnummer: 2, store: "model:mim05", op: "updateElement", args: [eersteId, { naam: "Hernoemd in Omnium" }] },
    { volgnummer: 3, store: "structuur", op: "nieuweMap", args: ["Eigen map", null, "map_x"] },
    { volgnummer: 4, store: "kruis", op: "patchLinks", args: [{ zet: [{ id: "k1", van: "a", naar: "b" }], wis: [] }] },
    { volgnummer: 5, store: "kruis", op: "toggleLink", args: [] },
  ];
  const stand = maakStand(werkbestand);
  const r = speelOpsNa(stand, later);
  assert.equal(r.toegepast, 4, "patchLinks op de kruisverbanden telt mee");
  assert.equal(r.overgeslagen, 1, "andere kruis-operaties overgeslagen");
  assert.deepEqual(stand.kruis.links.map((k) => k.id), ["k1"]);
  assert.ok(stand.modellen.get("mim05").getState().elements["eigen-1"]);
  assert.ok(stand.structuur.getState().mappen.map_x);

  // Opnieuw importeren: EA wint op het hernoemde element (gewijzigd), het eigen element blijft.
  const { ops: ops2, verslag } = importeerInStand(stand, bron, { packageId: DIENST });
  assert.equal(verslag.profielen.MIM.bijgewerkt, 1);
  assert.ok(ops2.some((o) => o.op === "patchElementen" && o.args[0].zet[eersteId]?.naam !== "Hernoemd in Omnium"));
  assert.ok(stand.modellen.get("mim05").getState().elements["eigen-1"], "eigen werk blijft");

  // Verdwenen: een EA-diagram dat in Omnium nog bestaat maar niet meer in de bron
  // (de klassen op LayedOut-diagrammen liggen in een ander pakket; het diagram zelf in 327).
  const wegDiagram = bron.t_diagram[bron.t_diagram.length - 1].Diagram_ID;
  const kleiner = { ...bron, t_diagram: bron.t_diagram.filter((d) => d.Diagram_ID !== wegDiagram),
    t_diagramobjects: bron.t_diagramobjects.filter((d) => d.Diagram_ID !== wegDiagram), t_diagramlinks: (bron.t_diagramlinks || []).filter((l) => l.DiagramID !== wegDiagram) };
  const zonder = importeerInStand(stand, kleiner, { packageId: DIENST });
  assert.ok(zonder.verslag.profielen.MIM.verdwenen >= 1);
  assert.equal(zonder.verslag.profielen.MIM.verwijderd, 0, "zonder vlag blijft het staan");
  const met = importeerInStand(stand, kleiner, { packageId: DIENST, verdwenenVerwijderen: true });
  assert.ok(met.verslag.profielen.MIM.verwijderd >= 1);
  assert.ok(met.ops.some((o) => o.op === "patchDiagrammen" && o.args[0].wis.length));
});

test("bouwWerkbestand: snapshot van de stand laadt terug tot dezelfde stand (rondreis)", () => {
  const bron = fixture("dienstverlening.qea.json");
  const stand = maakStand({ formaat: "studio-project", versie: 3, project: { id: "p1", naam: "T" }, kruisverbanden: [{ id: "k1" }], eigenVeld: 7 });
  importeerInStand(stand, bron, { packageId: DIENST, doelPad: "Import / GGM" });
  const wb = bouwWerkbestand(stand, { id: "p1", naam: "Proef" });
  assert.equal(wb.formaat, "studio-project");
  assert.equal(wb.versie, 3);
  assert.deepEqual(wb.project, { id: "p1", naam: "Proef" });
  assert.equal(wb.eigenVeld, 7, "onbekende velden blijven");
  assert.deepEqual(wb.kruisverbanden, [{ id: "k1" }]);
  assert.deepEqual(wb.structuur.plaatsingVolgorde, Object.keys(wb.structuur.plaatsing));
  assert.deepEqual(Object.keys(wb.profielen), ["mim05"], "lege profielen vallen weg");
  // Terugladen en opnieuw importeren: niets te doen.
  const terug = maakStand(JSON.parse(JSON.stringify(wb)));
  const tweede = importeerInStand(terug, bron, { packageId: DIENST, doelPad: "Import / GGM" });
  assert.equal(tweede.ops.length, 0);
});

test("splitsPatch en bouwBatches houden zich aan de grenzen", () => {
  const zet = Object.fromEntries(Array.from({ length: 5000 }, (_, i) => [`e${i}`, { id: `e${i}`, naam: "x".repeat(200) }]));
  const stukken = splitsPatch({ zet, wis: ["a", "b"] }, { maxBytes: 100_000, maxSleutels: 2000 });
  assert.ok(stukken.length > 5);
  assert.equal(stukken.reduce((n, s) => n + Object.keys(s.zet).length, 0), 5000);
  assert.deepEqual(stukken[stukken.length - 1].wis, ["a", "b"]);
  for (const s of stukken) assert.ok(JSON.stringify(s).length < 110_000);
  const ops = stukken.map((s) => ({ store: "model:x", op: "patchElementen", args: [s] }));
  const batches = bouwBatches(ops, { maxOps: 3, maxBytes: 250_000 });
  assert.ok(batches.length >= Math.ceil(ops.length / 3));
  let verwacht = 1;
  for (const b of batches) for (const o of b.ops) assert.equal(o.lokaalNr, verwacht++);
});

test("mapPadPlan: bestaande schakels hergebruiken, de rest maken (ouders eerst)", () => {
  const mappen = { a: { id: "a", naam: "Import", ouderId: null }, b: { id: "b", naam: "Oud", ouderId: "a" } };
  let n = 0;
  const plan = mapPadPlan(mappen, "Import / GGM / 2026", () => `m${++n}`);
  assert.deepEqual(plan.teMaken, [{ naam: "GGM", ouderId: "a", mapId: "m1" }, { naam: "2026", ouderId: "m1", mapId: "m2" }]);
  assert.equal(plan.mapId, "m2");
  assert.equal(mapPadPlan(mappen, "", () => "x").mapId, null, "leeg pad = wortel");
  assert.equal(mapPadPlan(mappen, "Import", () => "x").mapId, "a");
});

test("structuurKern: de structuuracties doen wat de browser doet met mappen en plaatsing", () => {
  const st = maakStructuurStore();
  const [a, b] = st.getState().nieuweMappen([{ naam: "A", mapId: "A" }, { naam: "B", ouderId: "A", mapId: "B" }]);
  assert.equal(a, "A");
  st.getState().plaatsPerMap({ A: ["p::d1"], B: ["el::p::e1", "p::d2"] });
  st.getState().plaatsDiagram("p::d3", "B");
  assert.equal(st.getState().plaatsing["p::d3"], "B");
  st.getState().hernoemMap("B", "Bee");
  st.getState().verplaatsMap("B", null);
  assert.equal(st.getState().mappen.B.naam, "Bee");
  assert.equal(st.getState().mappen.B.ouderId, null);
  st.getState().patchStructuur({ zetMappen: { C: { id: "C", naam: "C", ouderId: "A" } }, wisPlaatsing: ["p::d1"] });
  assert.ok(st.getState().mappen.C && !st.getState().plaatsing["p::d1"]);
  st.getState().verwijderMap("A");
  assert.ok(!st.getState().mappen.A && !st.getState().mappen.C, "submappen mee weg");
  assert.equal(st.getState().mappen.B.naam, "Bee", "B stond al los");
  assert.ok(st.getState().plaatsing["p::d3"], "plaatsing in B blijft");
});

test("plaatsEaInProjectboomPlan: hetzelfde geheugen over profielen deelt de mappen", () => {
  const bron = fixture("dienstverlening.qea.json");
  const geheugen = new Map();
  let n = 0;
  const ctx = { bron, packageId: DIENST, geheugen, doel: null, mappen: {}, nieuwMapId: () => `m${++n}` };
  const diagram = Object.values(bron.t_diagram)[0];
  const model = { elements: {}, diagrams: { [`ead-${String(diagram.ea_guid).replace(/[{}]/g, "").toLowerCase()}`]: { id: `ead-${String(diagram.ea_guid).replace(/[{}]/g, "").toLowerCase()}`, naam: "d" } } };
  const eerste = plaatsEaInProjectboomPlan("mim05", model, ctx);
  assert.ok(eerste.teMaken.length >= 1);
  const tweede = plaatsEaInProjectboomPlan("puurUml05", model, { ...ctx, mappen: Object.fromEntries(eerste.teMaken.map((m) => [m.mapId, { id: m.mapId, naam: m.naam, ouderId: m.ouderId }])) });
  assert.equal(tweede.teMaken.length, 0, "zelfde pakketmap, niets nieuws");
  assert.deepEqual(Object.keys(tweede.keysPerMap), Object.keys(eerste.keysPerMap));
});
