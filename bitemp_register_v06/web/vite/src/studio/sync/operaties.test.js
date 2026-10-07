// operaties.test.js — projectsync stap 2: acties → operaties, vangnet, remote toepassen.
// Run: node --import ./test/register-aliases.mjs --test src/studio/sync/operaties.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { createDiagramStore } from "../../diagramcore/model/createDiagramStore.js";
import {
  abonneer,
  koppelModelStore,
  ontkoppelStore,
  pasOperatieToe,
  zonderVastleggen,
  modelStoreNaam,
  diffMap,
  diffLijst,
  structuurNet,
  kruisNet,
  MODEL_OPS,
  STRUCTUUR_OPS,
} from "./operaties.js";

let teller = 0;

/** Gekoppelde store + verzamelde operaties; elke test een eigen profiel-naam. */
function maakGekoppeld() {
  const profielId = `t${++teller}`;
  const store = createDiagramStore();
  koppelModelStore(profielId, store);
  const ops = [];
  const af = abonneer((op) => {
    if (op.store === modelStoreNaam(profielId)) ops.push(op);
  });
  return { profielId, store, ops, klaar: () => (af(), ontkoppelStore(modelStoreNaam(profielId))) };
}

const el = (id, extra = {}) => ({ id, naam: id, elementType: "entiteit", compartimenten: [], data: {}, ...extra });
const model = () => ({
  diagramTypeId: "test",
  elements: { A: el("A"), B: el("B") },
  diagrams: { d1: { id: "d1", naam: "Eén", diagramType: "test", nodes: [{ elementId: "A", position: { x: 0, y: 0 } }], edges: [] } },
});
const kern = (s) => ({ elements: s.elements, diagrams: s.diagrams });

/** Speel operaties van A na op een verse, gekoppelde store B (met andere naam). */
function speelNa(ops, doelProfielId) {
  const doel = createDiagramStore();
  koppelModelStore(doelProfielId, doel);
  for (const op of ops) {
    const uit = pasOperatieToe({ ...op, store: modelStoreNaam(doelProfielId) });
    assert.equal(uit.ok, true, uit.reden);
  }
  return doel;
}

test("modelacties leveren benoemde operaties en spelen identiek na", () => {
  const { store, ops, klaar } = maakGekoppeld();
  const a = store.getState();
  a.laadModel(model());
  a.addElement(el("C"));
  a.addDiagram({ id: "d2", naam: "Twee", diagramType: "test" });
  a.addElementToDiagram("d2", "C", { x: 10, y: 20 });
  a.updateNodePosition("d2", "C", { x: 30, y: 40 });
  a.updateElement("C", { naam: "C2", data: { x: 1 } });
  a.renameDiagram("d2", "Twee-b");
  a.deleteElement("B");

  assert.deepEqual(
    ops.map((o) => o.op),
    ["laadModel", "addElement", "addDiagram", "addElementToDiagram", "updateNodePosition", "updateElement", "renameDiagram", "deleteElement"]
  );
  const b = speelNa(ops, "na1");
  assert.deepEqual(kern(b.getState()), kern(store.getState()));
  klaar();
  ontkoppelStore(modelStoreNaam("na1"));
});

test("een actie zonder effect levert geen operatie", () => {
  const { store, ops, klaar } = maakGekoppeld();
  store.getState().laadModel(model());
  ops.length = 0;
  store.getState().updateElement("bestaat-niet", { naam: "x" });
  store.getState().renameDiagram("geen", "x");
  store.getState().setActiefDiagram("d1"); // UI, niet omwikkeld
  store.getState().updateDiagramViewport("d1", { x: 1, y: 1, zoom: 2 }); // UI
  assert.equal(ops.length, 0);
  klaar();
});

test("undo op A komt als patch-operatie en speelt na op B", () => {
  const { store, ops, klaar } = maakGekoppeld();
  const a = store.getState();
  a.laadModel(model());
  a.addElement(el("C"));
  a.addElementToDiagram("d1", "C", { x: 5, y: 5 });
  store.temporal.getState().undo(); // via zundo, niet via een actie
  store.temporal.getState().undo();
  const patchOps = ops.filter((o) => o.op.startsWith("patch"));
  assert.ok(patchOps.length >= 2, `verwacht patch-operaties, kreeg ${ops.map((o) => o.op).join(",")}`);
  assert.equal(store.getState().elements.C, undefined);
  const b = speelNa(ops, "na3");
  assert.deepEqual(kern(b.getState()), kern(store.getState()));
  klaar();
  ontkoppelStore(modelStoreNaam("na3"));
});

test("remote toepassen raakt de undo-stapel van B niet", () => {
  const { store: b, klaar } = maakGekoppeld();
  const naam = modelStoreNaam(`t${teller}`);
  zonderVastleggen(() => b.getState().laadModel(model()));
  b.temporal.getState().clear();
  b.getState().addElement(el("Eigen"));
  assert.equal(b.temporal.getState().pastStates.length, 1);

  const uit = pasOperatieToe({ store: naam, op: "addElement", args: [el("VanAnder")] });
  assert.equal(uit.ok, true);
  assert.ok(b.getState().elements.VanAnder);
  assert.equal(b.temporal.getState().pastStates.length, 1, "remote operatie hoort niet in de undo-stapel");

  b.temporal.getState().undo();
  assert.equal(b.getState().elements.Eigen, undefined, "eigen werk is teruggedraaid");
  assert.ok(b.getState().elements.VanAnder, "werk van een ander blijft staan");
  klaar();
});

test("remote toepassen meldt zelf geen operatie (geen echo)", () => {
  const { store, ops, klaar } = maakGekoppeld();
  const naam = modelStoreNaam(`t${teller}`);
  zonderVastleggen(() => store.getState().laadModel(model()));
  ops.length = 0;
  pasOperatieToe({ store: naam, op: "addElement", args: [el("X")] });
  pasOperatieToe({ store: naam, op: "patchElementen", args: [{ zet: { Y: el("Y") }, wis: ["X"] }] });
  assert.equal(ops.length, 0);
  assert.ok(store.getState().elements.Y);
  assert.equal(store.getState().elements.X, undefined);
  klaar();
});

test("onbekende store of operatie faalt zacht", () => {
  assert.equal(pasOperatieToe({ store: "model:nope", op: "addElement", args: [] }).ok, false);
  const { klaar } = maakGekoppeld();
  const naam = modelStoreNaam(`t${teller}`);
  assert.equal(pasOperatieToe({ store: naam, op: "bestaatNiet", args: [] }).ok, false);
  klaar();
});

test("zonderVastleggen dempt (snapshot laden) en zet de baseline", () => {
  const { store, ops, klaar } = maakGekoppeld();
  zonderVastleggen(() => store.getState().laadModel(model()));
  assert.equal(ops.length, 0);
  store.getState().addElement(el("Z"));
  assert.deepEqual(ops.map((o) => o.op), ["addElement"]);
  klaar();
});

test("meerdere voorkomens: het gegenereerde voorkomen-id reist mee", () => {
  const { store, ops, klaar } = maakGekoppeld();
  const a = store.getState();
  a.laadModel(model());
  a.addElementToDiagram("d1", "A", { x: 50, y: 50 }, { meerdereVoorkomens: true });
  const op = ops.at(-1);
  assert.equal(op.op, "addElementToDiagram");
  assert.ok(op.args[3].nodeId, "nodeId genormaliseerd in de args");
  const b = speelNa(ops, "na8");
  assert.deepEqual(kern(b.getState()), kern(store.getState()));
  klaar();
  ontkoppelStore(modelStoreNaam("na8"));
});

test("diff-helpers en vangnetten van structuur en kruis", () => {
  const m1 = { a: { id: "a" }, b: { id: "b" } };
  const m2 = { a: m1.a, b: { id: "b", naam: "B" }, c: { id: "c" } };
  assert.deepEqual(diffMap(m1, m2), { zet: { b: m2.b, c: m2.c }, wis: [], leeg: false });
  assert.deepEqual(diffMap(m2, m1).wis, ["c"]);
  assert.equal(diffMap(m1, m1).leeg, true);

  const l1 = [{ id: "x", soort: "a" }];
  const l2 = [{ id: "x", soort: "b" }, { id: "y" }];
  assert.deepEqual(diffLijst(l1, l2), { zet: l2, wis: [], leeg: false });
  assert.deepEqual(diffLijst(l2, []).wis, ["x", "y"]);

  const s = structuurNet({ mappen: m1, plaatsing: { k: "a" } }, { mappen: m2, plaatsing: {} });
  assert.equal(s.length, 1);
  assert.deepEqual(s[0].args[0].wisPlaatsing, ["k"]);
  assert.deepEqual(structuurNet({ mappen: m1, plaatsing: {} }, { mappen: m1, plaatsing: {} }), []);

  const k = kruisNet({ links: l1 }, { links: l2 });
  assert.equal(k[0].op, "patchLinks");
  assert.deepEqual(kruisNet({ links: l1 }, { links: l1 }), []);
});

test("zetElementen (hele map vervangen) wordt als patch gemeld, niet als vervanging", () => {
  const voor = { elements: { A: el("A"), B: el("B") } };
  const na = { elements: { A: voor.elements.A, B: el("B", { naam: "B2" }), C: el("C") } };
  const uit = MODEL_OPS.zetElementen([na.elements], { voor, na, resultaat: undefined });
  assert.equal(uit.op, "patchElementen");
  assert.deepEqual(Object.keys(uit.args[0].zet), ["B", "C"]);
  assert.deepEqual(uit.args[0].wis, []);
  assert.equal(MODEL_OPS.zetElementen([voor.elements], { voor, na: voor, resultaat: undefined }), null);
});

test("boomvolgorde: schuifPlaatsing is een operatie en het vangnet meldt een sleutelvolgorde-wissel", () => {
  assert.ok("schuifPlaatsing" in STRUCTUUR_OPS, "schuifPlaatsing hoort in het vocabulaire");
  const voor = { mappen: {}, plaatsing: { a: "m1", b: "m1", c: "m1" } };
  const na = { mappen: {}, plaatsing: { b: "m1", a: "m1", c: "m1" } }; // zelfde waarden, andere volgorde
  const ops = structuurNet(voor, na);
  assert.equal(ops.length, 1);
  assert.deepEqual(ops[0].args[0].volgordePlaatsing, ["b", "a", "c"]);
  assert.deepEqual(ops[0].args[0].zetPlaatsing, {});
  assert.deepEqual(structuurNet(voor, { mappen: {}, plaatsing: { ...voor.plaatsing } }), [], "zelfde volgorde = niets");
});
